import { redact } from './vault.js'
import { ensureRepo, runGit } from './git.js'
import { normalizeRepo } from './store.js'

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
  // 「仅看当前项目相关分支」（2026-10-29 用户要求）：远程行只保留与本地
  // 分支有同名/跟踪关系的（origin/main ↔ main），孤立远端分支不进列表。
  const localNames = new Set(branches.map((branch) => branch.name))
  for (const line of remote.stdout.split('\n')) {
    if (line.trim().length === 0) continue
    const [name, head] = line.split('\t')
    // for-each-ref refs/remotes 会出现 origin/HEAD 符号引用，过滤掉。
    if (!name || name.endsWith('/HEAD')) continue
    const slash = name.indexOf('/')
    const shortName = slash > 0 ? name.slice(slash + 1) : name
    if (!localNames.has(shortName)) continue
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
export async function readCommits(
  cwd: string,
  limit: number,
  offset: number,
  ref?: string,
  search?: string,
): Promise<CommitListResult> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', commits: [], error: repo.error ?? '目录不可用', truncated: false }
  const root = repo.root!
  const cap = Math.min(Math.max(Number.isFinite(limit) ? limit : 30, 1), MAX_COMMITS)
  const skip = Math.min(Math.max(Number.isFinite(offset) ? offset : 0, 0), 100_000)
  const revision = String(ref ?? '').trim()
  // ref 只接受普通分支/标签/提交号：以 - 开头一律拒绝（避免被当成 git 选项）。
  if (revision.length > 0 && (revision.startsWith('-') || /\s/.test(revision))) {
    return { ok: false, root, commits: [], error: `分支/提交号不合法：${revision}`, truncated: false }
  }
  // 关键词检索：走 git 自己的 --grep（不在这里拼正则，也不做全量拉取后前端过滤，
  // 否则「加载更多」永远只能翻到前 N 条）。--fixed-strings 避免用户输入被当正则。
  const keyword = String(search ?? '').trim()
  if (keyword.length > 200) {
    return { ok: false, root, commits: [], error: '检索关键词过长（上限 200 字符）', truncated: false }
  }
  // 空仓库：log 直接失败，返回空列表而不是错误。
  const args = ['log']
  if (revision.length > 0) args.push(revision)
  args.push(
    `-n${cap}`,
    `--skip=${skip}`,
    '--date=iso-local',
    '--pretty=format:%H%x09%h%x09%an%x09%ae%x09%ad%x09%P%x09%D%x09%s',
  )
  if (keyword.length > 0) args.push('--regexp-ignore-case', '--fixed-strings', `--grep=${keyword}`)
  const result = await runGit(root, args)
  if (!result.ok) {
    if (/does not have any commits yet|bad revision|unknown revision|ambiguous argument/i.test(result.stderr)) {
      // 显式指定 ref 时「bad revision」是真实错误（分支不存在），不能静默返回空列表。
      if (revision.length > 0) {
        return { ok: false, root, commits: [], error: `无法解析分支或提交：${revision}`, truncated: false }
      }
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

/** 暂存全部改动（`git add -A`），用于初始化仓库后的首次提交。 */
export async function stageAll(cwd: string): Promise<{ ok: boolean; root: string; error: string }> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用' }
  const result = await runGit(repo.root!, ['add', '-A'])
  if (!result.ok) return { ok: false, root: repo.root!, error: result.error }
  return { ok: true, root: repo.root!, error: '' }
}

/**
 * 把 remote URL 解析成 owner/repo 形式的仓库键。
 * 支持 https://host/owner/repo(.git)、http://、git@host:owner/repo、ssh://git@host/owner/repo。
 * 解析不出（本地路径、file:// 等）返回 null。
 */
export function parseRemoteRepo(url: string): string | null {
  const raw = String(url ?? '').trim()
  if (raw.length === 0) return null
  let path = ''
  if (/^git@[^:]+:/i.test(raw)) {
    // scp 语法：git@host:owner/repo.git
    path = raw.replace(/^git@[^:]+:/i, '')
  } else if (/^ssh:\/\//i.test(raw)) {
    // ssh://git@host/owner/repo.git
    path = raw
      .replace(/^ssh:\/\//i, '')
      .replace(/^[^/]*@/, '')
      .replace(/^[^/]*\//, '')
  } else if (/^https?:\/\//i.test(raw)) {
    // http(s)://host/owner/repo.git
    path = raw.replace(/^https?:\/\//i, '').replace(/^[^/]*\//, '')
  } else {
    return null
  }
  path = path.split('#')[0].split('?')[0]
  const normalized = normalizeRepo(path)
  if (!normalized || normalized === '*') return null
  return normalized
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
  // 无上游或显式要求时带 -u：首次推送直接在远程创建同名分支（初始化后默认行为）。
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

/** 打开项目目录（资源管理器/Finder/xdg-open）。只 open，不执行任何 shell 字符串拼接。 */
export async function openDirectory(cwd: string): Promise<{ ok: boolean; root: string; error: string }> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用' }
  const root = repo.root!
  const { spawn } = await import('node:child_process')
  const platform = process.platform
  const command = platform === 'win32' ? 'explorer' : platform === 'darwin' ? 'open' : 'xdg-open'
  return new Promise((resolvePromise) => {
    // detached + unref：打开文件管理器后插件进程不等待、不持有子进程。
    const child = spawn(command, [root], { detached: true, stdio: 'ignore' })
    child.unref()
    child.on('error', (error) => resolvePromise({ ok: false, root, error: redact(error) }))
    // explorer 在目录已打开时可能返回非零退出码，但窗口确实会弹出；不视作失败。
    child.on('exit', () => resolvePromise({ ok: true, root, error: '' }))
  })
}

export interface DiscoveredRepo {
  root: string
  name: string
  branch: string
  remotes: string[]
}

/** 扫描授权根目录（最多下探 3 层）里的 git 仓库，供「仓库范围」页展示远程+本地所有仓库。 */
export async function discoverRepos(roots: string[]): Promise<DiscoveredRepo[]> {
  const { readdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const found: DiscoveredRepo[] = []
  const seen = new Set<string>()
  const walk = (dir: string, depth: number): void => {
    if (depth > 3 || found.length >= 50) return
    let entries: string[] = []
    try {
      entries = readdirSync(dir, { withFileTypes: true }).map((item) => item.name)
    } catch {
      return
    }
    if (entries.includes('.git')) {
      try {
        const branchRes = runGitSync(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])
        const remoteRes = runGitSync(dir, ['remote', '-v'])
        const remotes = remoteRes.ok
          ? [...new Set(remoteRes.stdout.split(String.fromCharCode(10)).filter(Boolean).map((line) => line.split(String.fromCharCode(9))[0]))]
          : []
        const key = dir.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          found.push({
            root: dir,
            name: dir.split(/[\/]/).filter(Boolean).pop() || dir,
            branch: branchRes.ok ? branchRes.stdout.trim() : '',
            remotes,
          })
        }
      } catch {
        /* 单仓失败不阻塞扫描 */
      }
      // .git 目录下不再下探
      return
    }
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue
      walk(join(dir, entry), depth + 1)
    }
  }
  for (const root of roots) {
    if (root === '*') continue
    walk(root, 0)
  }
  return found
}

// ---------------------------------------------------------------------------
// 标签（tag）：列表 / 新建 / 删除 / 推送
// ---------------------------------------------------------------------------

export interface TagRow {
  name: string
  /** 标签指向的提交短号。 */
  hash: string
  /** 附注标签的说明（轻量标签为空）。 */
  subject: string
  /** 创建时间（附注标签取 taggerdate，轻量标签取提交日期）。 */
  date: string
  /** 是否附注标签（有 tagger）。 */
  annotated: boolean
}

export interface TagListResult {
  ok: boolean
  root: string
  tags: TagRow[]
  error: string
}

const MAX_TAGS = 500

/**
 * 列出标签。
 * 用 for-each-ref 一次拿全（tag 名 / 指向对象 / 创建者时间 / 主题），
 * 不逐标签 fork 子进程。
 */
export async function readTags(cwd: string): Promise<TagListResult> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', tags: [], error: repo.error ?? '目录不可用' }
  const root = repo.root!
  const result = await runGit(root, [
    'for-each-ref',
    '--sort=-creatordate',
    '--count=500',
    'refs/tags',
    '--format=%(refname:short)%09%(objectname:short)%09%(creatordate:iso-local)%09%(taggername)%09%(subject)',
  ])
  if (!result.ok) return { ok: false, root, tags: [], error: result.error }
  const tags: TagRow[] = []
  for (const line of result.stdout.split('\n')) {
    if (line.trim().length === 0) continue
    const [name, hash, date, tagger, ...rest] = line.split('\t')
    if (!name) continue
    tags.push({
      name,
      hash: hash ?? '',
      date: date ?? '',
      // 附注标签才有 tagger；轻量标签 tagger 为空，主题取提交标题。
      annotated: (tagger ?? '').length > 0,
      subject: rest.join('\t'),
    })
    if (tags.length >= MAX_TAGS) break
  }
  return { ok: true, root, tags, error: '' }
}

/** 标签名合法性：复用分支规则（git 对两者的 ref 命名约束一致）。 */
export function validTagName(name: string): boolean {
  return validBranchName(name)
}

export interface TagWriteResult {
  ok: boolean
  root: string
  error: string
}

/** 新建标签。message 非空 → 附注标签（-a）；否则轻量标签。 */
export async function createTag(cwd: string, name: string, ref: string, message: string): Promise<TagWriteResult> {
  const tag = String(name ?? '').trim()
  if (!validTagName(tag)) return { ok: false, root: '', error: `标签名不合法：${tag || '(空)'}` }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用' }
  const root = repo.root!
  const target = String(ref ?? '').trim() || 'HEAD'
  if (target.startsWith('-') || /\s/.test(target)) {
    return { ok: false, root, error: `目标提交不合法：${target}` }
  }
  const text = String(message ?? '').trim()
  const args = ['tag']
  if (text.length > 0) {
    if (text.length > 2000) return { ok: false, root, error: '标签说明过长（上限 2000 字符）' }
    args.push('-a', tag, '-m', text, target)
  } else {
    args.push(tag, target)
  }
  const result = await runGit(root, args)
  if (!result.ok) {
    if (/already exists/i.test(result.stderr || result.stdout)) {
      return { ok: false, root, error: `标签已存在：${tag}` }
    }
    return { ok: false, root, error: result.error }
  }
  return { ok: true, root, error: '' }
}

/** 删除本地标签。 */
export async function deleteTag(cwd: string, name: string): Promise<TagWriteResult> {
  const tag = String(name ?? '').trim()
  if (!validTagName(tag)) return { ok: false, root: '', error: `标签名不合法：${tag || '(空)'}` }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用' }
  const result = await runGit(repo.root!, ['tag', '-d', tag])
  if (!result.ok) return { ok: false, root: repo.root!, error: result.error }
  return { ok: true, root: repo.root!, error: '' }
}

/** 推送单个标签到远端（`git push <remote> refs/tags/<name>`）。 */
export async function pushTag(cwd: string, remote: string, name: string): Promise<TagWriteResult> {
  const tag = String(name ?? '').trim()
  if (!validTagName(tag)) return { ok: false, root: '', error: `标签名不合法：${tag || '(空)'}` }
  const target = String(remote ?? '').trim()
  if (!/^[\w.-]{1,80}$/.test(target)) return { ok: false, root: '', error: `远端名不合法：${target || '(空)'}` }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用' }
  const result = await runGit(repo.root!, ['push', target, `refs/tags/${tag}`])
  if (!result.ok) return { ok: false, root: repo.root!, error: result.error }
  return { ok: true, root: repo.root!, error: '' }
}

// ---------------------------------------------------------------------------
// 贮藏（stash）：列表 / 保存 / 弹出 / 应用 / 删除
// ---------------------------------------------------------------------------

export interface StashRow {
  /** stash@{n} 里的 n。 */
  index: number
  /** 引用名（stash@{0}）。 */
  ref: string
  /** 贮藏时的分支。 */
  branch: string
  subject: string
}

export interface StashListResult {
  ok: boolean
  root: string
  stashes: StashRow[]
  error: string
}

/** 列出贮藏条目（`git stash list`，用 %gd 拿序号）。 */
export async function readStashes(cwd: string): Promise<StashListResult> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', stashes: [], error: repo.error ?? '目录不可用' }
  const root = repo.root!
  const result = await runGit(root, ['stash', 'list', '--date=iso-local', '--pretty=format:%gd%x09%gs'])
  if (!result.ok) {
    // 没有贮藏时部分 git 版本返回非零；视为空列表而不是错误。
    if (/no stash entries/i.test(result.stderr || result.stdout)) {
      return { ok: true, root, stashes: [], error: '' }
    }
    return { ok: false, root, stashes: [], error: result.error }
  }
  const stashes: StashRow[] = []
  for (const line of result.stdout.split('\n')) {
    if (line.trim().length === 0) continue
    const [ref, ...rest] = line.split('\t')
    const match = /stash@\{(\d+)\}/.exec(ref ?? '')
    const message = rest.join('\t')
    // gs 形如 `WIP on main: 1a2b3c4 subject` 或 `On main: message`
    const branchMatch = /^(?:WIP on|On) ([^:]+):/.exec(message)
    stashes.push({
      index: match ? Number.parseInt(match[1], 10) : stashes.length,
      ref: ref ?? `stash@{${stashes.length}}`,
      branch: branchMatch ? branchMatch[1] : '',
      subject: message,
    })
  }
  return { ok: true, root, stashes, error: '' }
}

/** 校验 stash 序号（只接受 0..999 的整数，避免把用户输入拼进 ref）。 */
function stashIndex(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n < 0 || n > 999) return null
  return Math.trunc(n)
}

/** 保存贮藏。includeUntracked → -u（未跟踪文件一并收进去）。 */
export async function stashSave(cwd: string, message: string, includeUntracked: boolean): Promise<TagWriteResult> {
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用' }
  const root = repo.root!
  const text = String(message ?? '').trim()
  if (text.length > 500) return { ok: false, root, error: '贮藏说明过长（上限 500 字符）' }
  const args = ['stash', 'push']
  if (includeUntracked) args.push('-u')
  if (text.length > 0) args.push('-m', text)
  const result = await runGit(root, args)
  if (!result.ok) return { ok: false, root, error: result.error }
  // 「没有改动可贮藏」不是错误，但要让界面知道什么都没发生。
  if (/No local changes to save/i.test(result.stdout)) {
    return { ok: false, root, error: '当前没有可贮藏的改动' }
  }
  return { ok: true, root, error: '' }
}

/** 弹出（pop）/ 应用（apply）/ 删除（drop）贮藏。 */
export async function stashAction(cwd: string, action: 'pop' | 'apply' | 'drop', index: unknown): Promise<TagWriteResult> {
  const n = stashIndex(index)
  if (n === null) return { ok: false, root: '', error: `贮藏序号不合法：${String(index)}` }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { ok: false, root: '', error: repo.error ?? '目录不可用' }
  const root = repo.root!
  const result = await runGit(root, ['stash', action, `stash@{${n}}`])
  if (!result.ok) {
    if (/no stash entries|is not a valid reference/i.test(result.stderr || result.stdout)) {
      return { ok: false, root, error: `贮藏条目不存在：stash@{${n}}` }
    }
    if (action !== 'drop' && /conflict/i.test(result.stderr || result.stdout)) {
      return { ok: false, root, error: `应用贮藏时发生冲突，请在终端解决后手动删除 stash@{${n}}` }
    }
    return { ok: false, root, error: result.error }
  }
  return { ok: true, root, error: '' }
}

/** 同步版 runGit（discover 用 readdir 同步遍历，配套同步 git 调用）。 */
function runGitSync(cwd: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const { execFileSync } = require('node:child_process') as { execFileSync: (cmd: string, args: string[], opts: object) => Buffer }
  try {
    const stdout = execFileSync('git', ['-C', cwd, ...args], { timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] })
    return { ok: true, stdout: stdout.toString(), stderr: '' }
  } catch (error) {
    const err = error as { stdout?: Buffer; stderr?: Buffer }
    return { ok: false, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' }
  }
}
