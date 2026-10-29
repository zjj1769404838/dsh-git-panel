import { redact } from './vault.js'
import { ensureRepo, runGit } from './git.js'

/**
 * Git 工作台（IDEA 式面板）的命令层：全部走 `runGit`（execFile 参数数组、
 * 子命令白名单、危险选项拦截、超时与输出裁剪）。这一层只做「参数组装 +
 * 结果结构化」，不做授权判断——授权闸门统一在 handler 的写端点里。
 */

const CLIP_LOG = 400

/** 分支名合法性：拒绝空串、空白、以 - 开头、含空白或 git 保留字符序列。 */
export function validBranchName(name: string): boolean {
  if (typeof name !== 'string') return false
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > 120) return false
  if (trimmed.startsWith('-') || trimmed.startsWith('/') || trimmed.endsWith('/')) return false
  if (trimmed.endsWith('.lock') || trimmed.includes('..') || trimmed.includes('@{')) return false
  if (/[\s~^:?*[\\\u0000-\u001f\u007f]/.test(trimmed)) return false
  if (/^(HEAD|FETCH_HEAD|ORIG_HEAD|MERGE_HEAD|CHERRY_PICK_HEAD|rebase|refs\/)/i.test(trimmed)) return false
  return true
}

function clipLog(text: string): string {
  if (text.length <= CLIP_LOG) return text
  return text.slice(0, CLIP_LOG) + `…（输出已截断，共 ${text.length} 字符）`
}

function firstLine(text: string): string {
  return text.split('\n').find((line) => line.trim().length > 0)?.trim() ?? ''
}

/** 分支信息（本地/远端统一视图）。 */
export interface BranchRow {
  name: string
  /** 当前检出分支 */
  current: boolean
  /** 本地分支才有 head；远端行 head 指向远端 tip */
  head: string
  /** tracking 分支（本地分支） */
  upstream: string
  ahead: number
  behind: number
  kind: 'local' | 'remote'
  /** 相对当前 HEAD 的提交数（远端行）：>0 表示本地落后 */
  tip: string
}

export interface BranchListResult {
  ok: boolean
  root: string
  current: string
  branches: BranchRow[]
  error: string
}

/** 列出本地 + 远端分支（跟踪关系、ahead/behind）。 */
export async function readBranches(cwd: string): Promise<BranchListResult> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', current: '', branches: [], error: repo.error ?? '目录不可用' }
  const root = repo.root!

  const currentRes = await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const current = currentRes.ok ? currentRes.stdout.trim() : ''

  const local = await runGit(root, [
    'for-each-ref',
    '--format=%(refname:short)%09%(objectname:short)%09%(upstream:short)%09%(upstream:track)',
    'refs/heads',
  ])
  const remote = await runGit(root, [
    'for-each-ref',
    '--format=%(refname:short)%09%(objectname:short)',
    'refs/remotes',
  ])
  if (!local.ok || !remote.ok) {
    return { ok: false, root, current, branches: [], error: local.error || remote.error }
  }

  const branches: BranchRow[] = []
  for (const line of local.stdout.split('\n')) {
    if (line.trim().length === 0) continue
    const [name, head, upstream, track] = line.split('\t')
    let ahead = 0
    let behind = 0
    if (track) {
      const ah = /\[ahead (\d+)[^\]]*\]/.exec(track)
      const bh = /\[behind (\d+)[^\]]*\]/.exec(track)
      if (ah) ahead = Number.parseInt(ah[1], 10) || 0
      if (bh) behind = Number.parseInt(bh[1], 10) || 0
    }
    branches.push({
      name,
      head: head ?? '',
      upstream: upstream ?? '',
      ahead,
      behind,
      current: current === name,
      kind: 'local',
      tip: '',
    })
  }
  for (const line of remote.stdout.split('\n')) {
    if (line.trim().length === 0) continue
    const [name, head] = line.split('\t')
    // for-each-ref refs/remotes 会出现 origin/HEAD 符号引用，过滤掉。
    if (!name || name.endsWith('/HEAD')) continue
    branches.push({ name, head: head ?? '', upstream: '', ahead: 0, behind: 0, current: false, kind: 'remote', tip: head ?? '' })
  }
  return { ok: true, root, current, branches, error: '' }
}

export interface BranchActionResult {
  ok: boolean
  root: string
  error: string
  output: string
}

/** 新建分支（可选立即切换）。 */
export async function createBranch(cwd: string, name: string, startPoint: string, checkout: boolean): Promise<BranchActionResult> {
  if (!validBranchName(name)) return { ok: false, root: '', error: `分支名不合法：${name}`, output: '' }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用', output: '' }
  const root = repo.root!
  const args = checkout ? ['checkout', '-b', name] : ['branch', name]
  if (startPoint.trim().length > 0) args.push(startPoint.trim())
  const result = await runGit(root, args)
  if (!result.ok) return { ok: false, root, error: result.error, output: clipLog(result.stdout) }
  return { ok: true, root, error: '', output: firstLine(result.stdout) }
}

/** 切换分支。工作区脏不静默处理：由调用方（handler/UI）先校验。 */
export async function checkoutBranch(cwd: string, name: string): Promise<BranchActionResult> {
  if (!validBranchName(name)) return { ok: false, root: '', error: `分支名不合法：${name}`, output: '' }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用', output: '' }
  const result = await runGit(repo.root!, ['checkout', name])
  if (!result.ok) return { ok: false, root: repo.root!, error: result.error, output: clipLog(result.stdout) }
  return { ok: true, root: repo.root!, error: '', output: firstLine(result.stdout) }
}

/** 删除本地分支。force=true 用 -D（未合并分支）；默认 -d 让 git 自己拒绝丢失提交。 */
export async function deleteBranch(cwd: string, name: string, force: boolean): Promise<BranchActionResult> {
  if (!validBranchName(name)) return { ok: false, root: '', error: `分支名不合法：${name}`, output: '' }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用', output: '' }
  const result = await runGit(repo.root!, ['branch', force ? '-D' : '-d', name])
  if (!result.ok) return { ok: false, root: repo.root!, error: result.error, output: clipLog(result.stdout) }
  return { ok: true, root: repo.root!, error: '', output: firstLine(result.stdout) }
}

/** 重命名本地分支。 */
export async function renameBranch(cwd: string, name: string, newName: string): Promise<BranchActionResult> {
  if (!validBranchName(newName)) return { ok: false, root: '', error: `新分支名不合法：${newName}`, output: '' }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用', output: '' }
  const result = await runGit(repo.root!, ['branch', '-m', name, newName])
  if (!result.ok) return { ok: false, root: repo.root!, error: result.error, output: clipLog(result.stdout) }
  return { ok: true, root: repo.root!, error: '', output: firstLine(result.stdout) }
}

/** 暂存指定路径（数组）。 */
export async function stagePaths(cwd: string, paths: string[]): Promise<{ ok: boolean; root: string; error: string }> {
  const clean = (Array.isArray(paths) ? paths : []).map((item) => String(item).trim()).filter((item) => item.length > 0)
  if (clean.length === 0) return { ok: false, root: '', error: '请选择要暂存的文件' }
  for (const item of clean) {
    // 路径必须是相对仓库根的普通路径：拒绝绝对路径、.. 上跳与 git 选项样式的参数。
    if (/^(-|[A-Za-z]:[\\/]|\/|\.\.)/.test(item) || item.includes('..')) {
      return { ok: false, root: '', error: `路径不合法：${item}（必须是仓库内的相对路径）` }
    }
  }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用' }
  const result = await runGit(repo.root!, ['add', '--', ...clean])
  if (!result.ok) return { ok: false, root: repo.root!, error: result.error }
  return { ok: true, root: repo.root!, error: '' }
}

/** 取消暂存（保留工作区改动）。 */
export async function unstagePaths(cwd: string, paths: string[]): Promise<{ ok: boolean; root: string; error: string }> {
  const clean = (Array.isArray(paths) ? paths : []).map((item) => String(item).trim()).filter((item) => item.length > 0)
  if (clean.length === 0) return { ok: false, root: '', error: '请选择要取消暂存的文件' }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用' }
  const result = await runGit(repo.root!, ['restore', '--staged', '--', ...clean])
  if (!result.ok) return { ok: false, root: repo.root!, error: result.error }
  return { ok: true, root: repo.root!, error: '' }
}

/**
 * 丢弃指定路径的未提交改动（工作区，含未跟踪文件的删除）。
 * 破坏性：handler 层必须校验 confirmed:true 才调用到这里。
 */
export async function discardPaths(cwd: string, paths: string[]): Promise<{ ok: boolean; root: string; error: string }> {
  const clean = (Array.isArray(paths) ? paths : []).map((item) => String(item).trim()).filter((item) => item.length > 0)
  if (clean.length === 0) return { ok: false, root: '', error: '请选择要丢弃改动的文件' }
  for (const item of clean) {
    if (/^(-|[A-Za-z]:[\\/]|\/|\.\.)/.test(item) || item.includes('..')) {
      return { ok: false, root: '', error: `路径不合法：${item}（必须是仓库内的相对路径）` }
    }
  }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用' }
  const root = repo.root!
  const tracked = await runGit(root, ['restore', '--worktree', '--', ...clean])
  // 未跟踪文件 restore 不处理（git 不认识），走 clean -f 精确删除。
  const untracked: string[] = []
  for (const item of clean) {
    const check = await runGit(root, ['ls-files', '--', item])
    if (check.ok && check.stdout.trim().length === 0) untracked.push(item)
  }
  if (untracked.length > 0) {
    // -f 前缀路径必须逐个传，避免 clean 误删其它文件。
    const cleaned = await runGit(root, ['clean', '-f', '--', ...untracked])
    if (!cleaned.ok && !tracked.ok) return { ok: false, root, error: tracked.error || cleaned.error }
  }
  if (!tracked.ok) return { ok: false, root, error: tracked.error }
  return { ok: true, root, error: '' }
}

export interface CommitResult {
  ok: boolean
  root: string
  error: string
  /** 新提交的短 hash（成功时） */
  hash: string
  output: string
}

/** 提交暂存区。amend=true 追加到上一次提交（--no-edit 保持原消息，除非另给消息）。 */
export async function commitStaged(cwd: string, message: string, amend: boolean): Promise<CommitResult> {
  const text = typeof message === 'string' ? message.trim() : ''
  if (text.length === 0 && !amend) return { ok: false, root: '', hash: '', error: '提交信息不能为空', output: '' }
  if (text.length > 4000) return { ok: false, root: '', hash: '', error: '提交信息过长（上限 4000 字符）', output: '' }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', hash: '', error: repo.error ?? '目录不可用', output: '' }
  const root = repo.root!

  // 先查暂存区：空提交直接拒绝（未开启 --allow-empty），错误信息可理解。
  const staged = await runGit(root, ['diff', '--cached', '--quiet'])
  if (staged.ok && !amend) {
    // --quiet 退出码 0 = 无差异 = 暂存区为空
    return { ok: false, root, hash: '', error: '暂存区是空的：请先在左侧变更列表勾选文件并暂存', output: '' }
  }
  if (staged.ok && amend) {
    return { ok: false, root, hash: '', error: '暂存区是空的：Amend 需要至少一个暂存的改动', output: '' }
  }

  const args = ['commit', '-m', text.length > 0 ? text : '--no-edit', '--no-verify']
  if (amend) args.push('--amend')
  const result = await runGit(root, args)
  if (!result.ok) {
    // 已有提交的暂存区为空时 diff --cached --quiet 不报错但 commit 会失败，统一转成可理解文案。
    if (/nothing to commit/.test(result.stderr || result.stdout)) {
      return { ok: false, root, hash: '', error: '暂存区是空的：请先暂存文件再提交', output: clipLog(result.stdout) }
    }
    return { ok: false, root, hash: '', error: result.error, output: clipLog(result.stdout) }
  }
  const hashRes = await runGit(root, ['rev-parse', '--short', 'HEAD'])
  return { ok: true, root, hash: hashRes.ok ? hashRes.stdout.trim() : '', error: '', output: firstLine(result.stdout) }
}

export interface CommitRow {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  subject: string
  /** 分支装饰（HEAD -> main, origin/main） */
  refs: string
  parents: string[]
}

export interface CommitListResult {
  ok: boolean
  root: string
  commits: CommitRow[]
  error: string
  truncated: boolean
}

const MAX_COMMITS = 200

/** 提交历史（--topo-order 带图，父母 hash 单列出来给图与详情用）。 */
export async function readCommits(cwd: string, limit: number, offset: number): Promise<CommitListResult> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', commits: [], error: repo.error ?? '目录不可用', truncated: false }
  const root = repo.root!
  const cap = Math.min(Math.max(Number.isFinite(limit) ? limit : 30, 1), MAX_COMMITS)
  const skip = Math.min(Math.max(Number.isFinite(offset) ? offset : 0, 0), 100_000)
  // 空仓库：log 直接失败，返回空列表而不是错误。
  const result = await runGit(root, [
    'log',
    `-n${cap}`,
    `--skip=${skip}`,
    '--date=iso-local',
    '--pretty=format:%H%x09%h%x09%an%x09%ae%x09%ad%x09%P%x09%D%x09%s',
  ])
  if (!result.ok) {
    if (/does not have any commits yet|bad revision/i.test(result.stderr)) {
      return { ok: true, root, commits: [], error: '', truncated: false }
    }
    return { ok: false, root, commits: [], error: result.error, truncated: false }
  }
  const commits: CommitRow[] = []
  for (const line of result.stdout.split('\n')) {
    if (line.trim().length === 0) continue
    const [hash, shortHash, author, email, date, parents, refs, ...rest] = line.split('\t')
    commits.push({
      hash,
      shortHash,
      author,
      email,
      date,
      subject: rest.join('\t'),
      refs: refs ?? '',
      parents: (parents ?? '').split(' ').filter((item) => item.length > 0),
    })
  }
  return { ok: true, root, commits, error: '', truncated: commits.length >= cap }
}

export interface CommitDetail {
  ok: boolean
  root: string
  error: string
  commit: (CommitRow & { message: string }) | null
  files: Array<{ path: string; added: number; deleted: number; status: string }>
  diff: string
  diffTruncated: boolean
}

const MAX_DETAIL_DIFF = 60_000

/** 单个提交详情：元信息 + 变更文件 + diff。 */
export async function readCommitDetail(cwd: string, rev: string): Promise<CommitDetail> {
  const revision = String(rev ?? '').trim()
  if (revision.length === 0 || /^-/.test(revision)) {
    return { ok: false, root: '', error: `提交号不合法：${revision}`, commit: null, files: [], diff: '', diffTruncated: false }
  }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用', commit: null, files: [], diff: '', diffTruncated: false }
  const root = repo.root!

  const meta = await runGit(root, ['show', '--no-color', '-s', '--date=iso-local', '--format=%H%x09%h%x09%an%x09%ae%x09%ad%x09%P%x09%D%x09%B%x09EOFMETA', revision])
  if (!meta.ok) return { ok: false, root, error: meta.error, commit: null, files: [], diff: '', diffTruncated: false }

  const lines = meta.stdout.split('\n')
  const metaLine = lines[0] ?? ''
  const [hash, shortHash, author, email, date, parents, refs] = metaLine.split('\t')
  // %B 完整消息到 EOFMETA 标记为止（可能多行）。
  const eof = lines.findIndex((line) => line.trim() === 'EOFMETA')
  const message = eof > 0 ? lines.slice(0, eof).slice(1).join('\n').replace(/\n$/, '') : lines[1] ?? ''
  const commit = {
    hash,
    shortHash,
    author,
    email,
    date,
    parents: (parents ?? '').split(' ').filter((item) => item.length > 0),
    refs: refs ?? '',
    subject: message.split('\n')[0] ?? '',
    message,
  }

  const numstat = await runGit(root, ['show', '--no-color', '--numstat', '--format=', revision])
  const files: CommitDetail['files'] = []
  if (numstat.ok) {
    for (const line of numstat.stdout.split('\n')) {
      if (line.trim().length === 0) continue
      const parts = line.split('\t')
      if (parts.length < 3) continue
      files.push({
        added: /^-+$/.test(parts[0]) ? 0 : Number.parseInt(parts[0], 10) || 0,
        deleted: /^-+$/.test(parts[1]) ? 0 : Number.parseInt(parts[1], 10) || 0,
        status: parts[0] === '-' ? 'rename' : 'changed',
        path: parts.slice(2).join('\t'),
      })
    }
  }

  const diff = await runGit(root, ['show', '--no-color', '--format=', revision])
  const raw = diff.ok ? diff.stdout : ''
  const diffTruncated = raw.length > MAX_DETAIL_DIFF
  return { ok: true, root, error: '', commit, files, diff: diffTruncated ? raw.slice(0, MAX_DETAIL_DIFF) : raw, diffTruncated }
}

export type DiffMode = 'worktree' | 'staged' | 'commit'

export interface DiffResult {
  ok: boolean
  root: string
  error: string
  diff: string
  truncated: boolean
  totalLines: number
}

const MAX_DIFF = 80_000

/** diff：worktree（未暂存）/ staged（已暂存）/ commit（单提交）。 */
export async function readDiff(cwd: string, mode: DiffMode, path: string, rev: string): Promise<DiffResult> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用', diff: '', truncated: false, totalLines: 0 }
  const root = repo.root!
  let args: string[]
  if (mode === 'staged') args = ['diff', '--no-color', '--cached']
  else if (mode === 'commit') {
    const revision = String(rev ?? '').trim()
    if (!revision || /^-/.test(revision)) return { ok: false, root, error: `提交号不合法：${rev}`, diff: '', truncated: false, totalLines: 0 }
    args = ['diff', '--no-color', `${revision}^`, revision]
  } else args = ['diff', '--no-color']
  const clean = String(path ?? '').trim()
  if (clean) {
    if (/^(-|[A-Za-z]:[\\/]|\/|\.\.)/.test(clean) || clean.includes('..')) {
      return { ok: false, root, error: `路径不合法：${clean}`, diff: '', truncated: false, totalLines: 0 }
    }
    args.push('--', clean)
  }
  const result = await runGit(root, args)
  if (!result.ok) return { ok: false, root, error: result.error, diff: '', truncated: false, totalLines: 0 }
  const lines = result.stdout.split('\n')
  const truncated = result.stdout.length > MAX_DIFF
  return { ok: true, root, error: '', diff: truncated ? result.stdout.slice(0, MAX_DIFF) : result.stdout, truncated, totalLines: lines.length }
}

export interface RemoteRow {
  name: string
  url: string
}

export interface RemoteListResult {
  ok: boolean
  root: string
  remotes: RemoteRow[]
  error: string
  /** 当前分支的 upstream（origin/main 形式） */
  upstream: string
  upstreamRemote: string
}

/** 列出 remotes + 当前分支 upstream。 */
export async function readRemotes(cwd: string): Promise<RemoteListResult> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', remotes: [], error: repo.error ?? '目录不可用', upstream: '', upstreamRemote: '' }
  const root = repo.root!
  const result = await runGit(root, ['remote', '-v'])
  if (!result.ok) return { ok: false, root, remotes: [], error: result.error, upstream: '', upstreamRemote: '' }
  const remotes: RemoteRow[] = []
  const seen = new Set<string>()
  for (const line of result.stdout.split('\n')) {
    if (line.trim().length === 0) continue
    const [name, url] = line.split('\t')
    if (!name || seen.has(name)) continue
    seen.add(name)
    remotes.push({ name, url: (url ?? '').replace(/\s+\(.*\)$/, '') })
  }
  const up = await runGit(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
  const upstream = up.ok ? up.stdout.trim() : ''
  const upstreamRemote = upstream.includes('/') ? upstream.split('/')[0] : ''
  return { ok: true, root, remotes, error: '', upstream, upstreamRemote }
}

export interface RemoteActionResult {
  ok: boolean
  root: string
  error: string
}

/** 添加 remote。 */
export async function addRemote(cwd: string, name: string, url: string): Promise<RemoteActionResult> {
  const remoteName = String(name ?? '').trim()
  const remoteUrl = String(url ?? '').trim()
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(remoteName)) return { ok: false, root: '', error: `remote 名称不合法：${remoteName}（字母数字._-）` }
  if (!/^https?:\/\/.+/i.test(remoteUrl) && !/^git@.+/.test(remoteUrl) && !/^ssh:\/\/.+/i.test(remoteUrl)) {
    return { ok: false, root: '', error: `URL 不合法：${remoteUrl}（支持 https/git@/ssh）` }
  }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用' }
  const result = await runGit(repo.root!, ['remote', 'add', remoteName, remoteUrl])
  if (!result.ok) return { ok: false, root: repo.root!, error: result.error }
  return { ok: true, root: repo.root!, error: '' }
}

export async function removeRemote(cwd: string, name: string): Promise<RemoteActionResult> {
  const remoteName = String(name ?? '').trim()
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(remoteName)) return { ok: false, root: '', error: `remote 名称不合法：${remoteName}` }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用' }
  const result = await runGit(repo.root!, ['remote', 'remove', remoteName])
  if (!result.ok) return { ok: false, root: repo.root!, error: result.error }
  return { ok: true, root: repo.root!, error: '' }
}

export interface SyncResult {
  ok: boolean
  root: string
  error: string
  /** fetch/pull/push 的关键输出（裁剪） */
  output: string
  /** pull 产生冲突时 true */
  conflicted: boolean
  /** push 被拒绝（非 fast-forward 等） */
  rejected: boolean
  /** 无 upstream / 无远程 */
  missingConfig: boolean
}

/** 从同步输出里识别冲突/被拒/缺配置，转成结构化状态。 */
function classifySync(sub: string, code: number, stderr: string, stdout: string): { conflicted: boolean; rejected: boolean; missingConfig: boolean } {
  const text = `${stderr}\n${stdout}`
  if (/CONFLICT|Automatic merge failed|needs merge/i.test(text)) return { conflicted: true, rejected: false, missingConfig: false }
  if (sub === 'push' && /rejected|non-fast-forward|fetch first/i.test(text)) return { conflicted: false, rejected: true, missingConfig: false }
  if (/no configured push destination|no upstream configured|does not appear to be a git repository|No tracking information|set-upstream/i.test(text)) {
    return { conflicted: false, rejected: false, missingConfig: true }
  }
  return { conflicted: false, rejected: false, missingConfig: false }
}

/** fetch（只下载不合并，安全）。 */
export async function fetchRepo(cwd: string, remote: string): Promise<SyncResult> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用', output: '', conflicted: false, rejected: false, missingConfig: false }
  const root = repo.root!
  const name = String(remote ?? '').trim()
  const args = name.length > 0 ? ['fetch', '--', name] : ['fetch', '--all']
  const result = await runGit(root, args)
  if (!result.ok) {
    return {
      ok: false,
      root,
      error: result.error,
      output: clipLog(result.stderr || result.stdout),
      ...classifySync('fetch', result.code, result.stderr, result.stdout),
    }
  }
  return { ok: true, root, error: '', output: clipLog(result.stderr || result.stdout), conflicted: false, rejected: false, missingConfig: false }
}

/** pull（merge 或 rebase 策略）。 */
export async function pullRepo(cwd: string, remote: string, branch: string, strategy: 'merge' | 'rebase'): Promise<SyncResult> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用', output: '', conflicted: false, rejected: false, missingConfig: false }
  const root = repo.root!
  const args = ['pull', strategy === 'rebase' ? '--rebase' : '--no-rebase']
  const remoteName = String(remote ?? '').trim()
  const branchName = String(branch ?? '').trim()
  if (remoteName.length > 0 && !/^[\w.-]{1,60}$/.test(remoteName)) return { ok: false, root, error: `remote 名称不合法：${remoteName}`, output: '', conflicted: false, rejected: false, missingConfig: false }
  if (branchName.length > 0 && !validBranchName(branchName)) return { ok: false, root, error: `分支名不合法：${branchName}`, output: '', conflicted: false, rejected: false, missingConfig: false }
  if (remoteName.length > 0) args.push('--', remoteName)
  if (branchName.length > 0) args.push(branchName)
  const result = await runGit(root, args)
  if (!result.ok) {
    return {
      ok: false,
      root,
      error: result.error,
      output: clipLog(result.stderr || result.stdout),
      ...classifySync('pull', result.code, result.stderr, result.stdout),
    }
  }
  return { ok: true, root, error: '', output: clipLog(result.stderr || result.stdout), conflicted: false, rejected: false, missingConfig: false }
}

/** push。force=true 走 --force-with-lease（比 --force 安全：他人有新提交时拒绝）。 */
export async function pushRepo(cwd: string, remote: string, branch: string, options: { force?: boolean; setUpstream?: boolean; tags?: boolean }): Promise<SyncResult> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用', output: '', conflicted: false, rejected: false, missingConfig: false }
  const root = repo.root!
  const remoteName = String(remote ?? '').trim()
  const branchName = String(branch ?? '').trim()
  if (!remoteName || !/^[\w.-]{1,60}$/.test(remoteName)) return { ok: false, root, error: '缺少 remote 名称（先在远程仓库弹窗里配置）', output: '', conflicted: false, rejected: false, missingConfig: true }
  if (!branchName || !validBranchName(branchName)) return { ok: false, root, error: `分支名不合法：${branchName}`, output: '', conflicted: false, rejected: false, missingConfig: false }
  const args = ['push']
  if (options?.force) args.push('--force-with-lease')
  if (options?.tags) args.push('--follow-tags')
  if (options?.setUpstream) args.push('-u')
  args.push('--', remoteName, branchName)
  const result = await runGit(root, args)
  if (!result.ok) {
    return {
      ok: false,
      root,
      error: result.error,
      output: clipLog(result.stderr || result.stdout),
      ...classifySync('push', result.code, result.stderr, result.stdout),
    }
  }
  return { ok: true, root, error: '', output: clipLog(result.stderr || result.stdout), conflicted: false, rejected: false, missingConfig: false }
}

/** 给 handler 用的冲突状态检测：status porcelain 里含 U 状态即有未解决冲突。 */
export async function hasMergeConflicts(cwd: string): Promise<boolean> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return false
  const result = await runGit(repo.root!, ['status', '--porcelain'])
  if (!result.ok) return false
  return result.stdout.split('\n').some((line) => /^(DD|AU|UD|UA|DU|AA|UU)/.test(line.slice(0, 2)))
}

/** 错误兜底：把未知异常转成字符串（统一走 redact 防泄漏）。 */
export function describeError(error: unknown): string {
  return redact(error)
}
