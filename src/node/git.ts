import { execFile } from 'node:child_process'
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { redact } from './vault.js'

const TIMEOUT_MS = 30_000
const MAX_OUTPUT = 400_000

export interface GitRunResult {
  ok: boolean
  code: number
  stdout: string
  stderr: string
  /** 失败时给 Agent/界面看的一句话原因（含必要 git 输出）。 */
  error: string
  command: string
}

/** 只允许这些子命令；写操作由调用方另行检查 allowWrite。 */
const READ_ONLY = new Set([
  'status',
  'log',
  'diff',
  'show',
  'branch',
  'remote',
  'rev-parse',
  'rev-list',
  'ls-files',
  'tag',
  'describe',
  'blame',
])
const WRITE = new Set(['init', 'add', 'commit', 'checkout', 'switch', 'restore', 'reset', 'stash', 'merge', 'rebase', 'push', 'pull', 'fetch', 'cherry-pick', 'revert', 'tag', 'branch'])

export function isWriteCommand(sub: string): boolean {
  return WRITE.has(sub)
}

export function isKnownCommand(sub: string): boolean {
  return READ_ONLY.has(sub) || WRITE.has(sub)
}

/** 统一裁剪输出，避免把整仓 diff 灌进上下文。 */
function clip(text: string): string {
  if (text.length <= MAX_OUTPUT) return text
  return text.slice(0, MAX_OUTPUT) + `\n…（输出已截断，共 ${text.length} 字符）`
}

function describeFailure(sub: string, code: number, stderr: string, stdout: string): string {
  const detail = (stderr || stdout || '').trim()
  const short = detail.split('\n').slice(0, 12).join('\n')
  if (code === 128 && /not a git repository/i.test(detail)) return '目标目录不是 Git 仓库（缺少 .git）'
  if (/does not have any commits yet/i.test(detail)) return '仓库还没有任何提交'
  if (/pathspec .* did not match/i.test(detail)) return `路径不存在或没有匹配的文件：${short}`
  if (/could not resolve host|unable to access|Authentication failed|Permission denied \(publickey\)/i.test(detail)) {
    return `无法访问远端（网络或凭据问题）：${short}`
  }
  if (/would be overwritten by (checkout|merge)/i.test(detail)) return `本地有未提交改动，切换/合并被拒绝：${short}`
  return `git ${sub} 失败（退出码 ${code}）：${short || '无输出'}`
}

export function ensureRepo(cwd: string): { ok: boolean; root?: string; error?: string } {
  if (typeof cwd !== 'string' || cwd.trim().length === 0) return { ok: false, error: '缺少工作目录参数' }
  if (!isAbsolute(cwd)) return { ok: false, error: `工作目录必须是绝对路径：${cwd}` }
  const dir = resolve(cwd)
  if (!existsSync(dir)) return { ok: false, error: `目录不存在：${dir}` }
  try {
    if (!statSync(dir).isDirectory()) return { ok: false, error: `不是目录：${dir}` }
  } catch (error) {
    return { ok: false, error: `无法访问目录：${redact(error)}` }
  }
  if (!existsSync(join(dir, '.git'))) return { ok: false, error: `${dir} 不是 Git 仓库（未找到 .git）` }
  return { ok: true, root: dir }
}

/** 供输入框 chip 渲染的仓库状态。非仓库不是错误，返回 isRepo:false。 */
export interface RepoStatus {
  isRepo: boolean
  root: string
  branch: string
  detached: boolean
  head: string
  ahead: number
  behind: number
  changed: number
  error: string
  /**
   * 检测结论：
   * - `repo`：确认是仓库
   * - `no-repo`：目录存在但还没有 .git —— 只有这种情况才允许显示「初始化」
   * - `invalid`：路径非法/不存在/不可读/不是目录 —— 检测失败，不能当成「未初始化」
   */
  reason: 'repo' | 'no-repo' | 'invalid'
}

export async function readRepoStatus(cwd: string): Promise<RepoStatus> {
  const empty: RepoStatus = {
    isRepo: false,
    root: '',
    branch: '',
    detached: false,
    head: '',
    ahead: 0,
    behind: 0,
    changed: 0,
    error: '',
    reason: 'invalid',
  }
  const repo = ensureRepo(cwd)
  if (!repo.ok) {
    const message = repo.error ?? '不是 Git 仓库'
    // 只有「目录确实存在、只是没有 .git」才是可初始化的未初始化状态。
    const notInitialized = /未找到 \.git/.test(message)
    return { ...empty, error: message, reason: notInitialized ? 'no-repo' : 'invalid' }
  }
  const root = repo.root as string

  const branchRes = await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const headRes = await runGit(root, ['rev-parse', '--short', 'HEAD'])
  const head = headRes.ok ? headRes.stdout.trim() : ''
  if (!branchRes.ok) {
    // 空仓库（还没有任何提交）不算错误：只回报无分支。
    return { ...empty, isRepo: true, root, head, error: branchRes.error, reason: 'repo' }
  }
  const rawBranch = branchRes.stdout.trim()
  const detached = rawBranch === 'HEAD'

  let ahead = 0
  let behind = 0
  const counts = await runGit(root, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'])
  if (counts.ok) {
    const parts = counts.stdout.trim().split(/\s+/)
    behind = Number.parseInt(parts[0] ?? '0', 10) || 0
    ahead = Number.parseInt(parts[1] ?? '0', 10) || 0
  }

  let changed = 0
  const status = await runGit(root, ['status', '--porcelain'])
  if (status.ok) {
    changed = status.stdout.split('\n').filter((line) => line.trim().length > 0).length
  }

  return {
    isRepo: true,
    root,
    branch: detached ? '' : rawBranch,
    detached,
    head,
    ahead,
    behind,
    changed,
    error: '',
    reason: 'repo',
  }
}

/** 单个文件的改动明细。 */
export interface ChangeFile {
  /** 相对仓库根的路径，POSIX 分隔符 */
  path: string
  /** 暂存区状态码：'' | 'M' | 'A' | 'D' | 'R' | 'C' | 'U' 等，取自 git status porcelain v1 第一列 */
  index: string
  /** 工作区状态码：第二列 */
  worktree: string
  /** 相对 HEAD 的新增行数（无则为 0） */
  added: number
  /** 相对 HEAD 的删除行数（无则为 0） */
  deleted: number
  /** 是否已暂存（index 列非空） */
  staged: boolean
}

/** 仓库工作区改动汇总。 */
export interface RepoChanges {
  /** 是否是 git 仓库 */
  isRepo: boolean
  /** 仓库根绝对路径（非仓库时为 ''） */
  root: string
  /** 当前分支（非仓库或游离时为 ''） */
  branch: string
  /** 是否有未提交的改动 */
  dirty: boolean
  /** 改动文件列表 */
  files: ChangeFile[]
}

/** 改动明细最多返回多少条文件。 */
const MAX_CHANGE_FILES = 500
/** 未跟踪文件统计行数时的上限（避免大文件拖慢扫描）。 */
const MAX_UNTRACKED_LINES = 2000

/**
 * 还原 git 的 C 风格引号路径（core.quotepath 触发时出现）。
 * 无法还原时保留原样，不抛错。
 */
function decodeGitPath(raw: string): string {
  if (raw.length < 2 || !raw.startsWith('"') || !raw.endsWith('"')) return raw
  const body = raw.slice(1, -1)
  const bytes: number[] = []
  let i = 0
  while (i < body.length) {
    const ch = body[i]
    if (ch !== '\\') {
      for (const byte of Buffer.from(ch, 'utf8')) bytes.push(byte)
      i += 1
      continue
    }
    i += 1
    const next = body[i] ?? ''
    if (next >= '0' && next <= '7') {
      const oct = body.slice(i, i + 3)
      if (/^[0-7]{3}$/.test(oct)) {
        bytes.push(Number.parseInt(oct, 8))
        i += 3
        continue
      }
    }
    switch (next) {
      case 'n':
        bytes.push(0x0a)
        i += 1
        break
      case 't':
        bytes.push(0x09)
        i += 1
        break
      case 'r':
        bytes.push(0x0d)
        i += 1
        break
      case 'a':
        bytes.push(0x07)
        i += 1
        break
      case 'b':
        bytes.push(0x08)
        i += 1
        break
      case 'f':
        bytes.push(0x0c)
        i += 1
        break
      case 'v':
        bytes.push(0x0b)
        i += 1
        break
      case '"':
        bytes.push(0x22)
        i += 1
        break
      case '\\':
        bytes.push(0x5c)
        i += 1
        break
      default:
        // 无法识别的转义：原样保留反斜杠
        bytes.push(0x5c)
        break
    }
  }
  return Buffer.from(bytes).toString('utf8')
}

/** 找到引号字符串的结束位置（跳过转义），找不到返回 -1。 */
function findQuoteEnd(text: string): number {
  let i = 1
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2
      continue
    }
    if (text[i] === '"') return i
    i += 1
  }
  return -1
}

/**
 * 解析 porcelain v1 状态行里 `XY ` 之后的路径部分。
 * 重命名（`old -> new`）取箭头右侧的新路径。
 */
function splitStatusPath(rest: string): string {
  if (rest.startsWith('"')) {
    const end = findQuoteEnd(rest)
    if (end > 0) {
      const first = rest.slice(0, end + 1)
      const remainder = rest.slice(end + 1)
      if (remainder.startsWith(' -> ')) return decodeGitPath(remainder.slice(4))
      return decodeGitPath(first)
    }
  }
  const arrow = rest.indexOf(' -> ')
  if (arrow >= 0) return decodeGitPath(rest.slice(arrow + 4))
  return decodeGitPath(rest)
}

/** numstat 里的路径：可能是 `old => new` 或 `{old => new}`，统一取新路径。 */
function normalizeNumstatPath(raw: string): string {
  let text = decodeGitPath(raw)
  const arrow = text.lastIndexOf(' => ')
  if (arrow >= 0) {
    text = text.slice(arrow + 4)
  } else if (text.includes('{') && text.includes('=>')) {
    const start = text.lastIndexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) text = text.slice(start + 1, end)
  }
  return text.trim()
}

/** 统计文件行数（上限 cap），失败返回 0。 */
function countFileLines(absPath: string, cap = MAX_UNTRACKED_LINES): number {
  let fd: number | null = null
  try {
    const info = statSync(absPath)
    if (!info.isFile()) return 0
    fd = openSync(absPath, 'r')
    const buffer = Buffer.alloc(64 * 1024)
    let count = 0
    let lastByte = -1
    for (;;) {
      const read = readSync(fd, buffer, 0, buffer.length, null)
      if (read <= 0) break
      for (let i = 0; i < read; i += 1) {
        if (buffer[i] === 0x0a) count += 1
        lastByte = buffer[i]
      }
      if (count >= cap) break
    }
    if (lastByte !== -1 && lastByte !== 0x0a) count += 1
    return Math.min(count, cap)
  } catch {
    return 0
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd)
      } catch {
        /* 忽略关闭失败 */
      }
    }
  }
}

/**
 * 读取仓库工作区改动明细。
 * 非仓库/非法路径不抛错，返回 isRepo:false 的空结果（与 readRepoStatus 一致的容错风格）。
 */
export async function readRepoChanges(cwd: string): Promise<RepoChanges> {
  const empty: RepoChanges = { isRepo: false, root: '', branch: '', dirty: false, files: [] }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return empty
  const root = repo.root as string

  const top = await runGit(root, ['rev-parse', '--show-toplevel'])
  const repoRoot = top.ok && top.stdout.trim().length > 0 ? top.stdout.trim() : root

  const branchRes = await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const rawBranch = branchRes.ok ? branchRes.stdout.trim() : ''
  const branch = rawBranch && rawBranch !== 'HEAD' ? rawBranch : ''

  const files = new Map<string, ChangeFile>()
  const status = await runGit(root, ['status', '--porcelain', '--untracked-files=all'])
  if (status.ok) {
    for (const line of status.stdout.split('\n')) {
      if (line.trim().length === 0) continue
      if (line.length < 4) continue
      const code = line.slice(0, 2)
      const path = splitStatusPath(line.slice(3))
      if (path.length === 0) continue
      let index = ''
      let worktree = ''
      let staged = false
      if (code === '??') {
        // 未跟踪文件：不在暂存区
        index = ''
        worktree = '?'
        staged = false
      } else {
        index = code[0] === ' ' ? '' : code[0]
        worktree = code[1] === ' ' ? '' : code[1]
        staged = index.length > 0
      }
      files.set(path, { path, index, worktree, added: 0, deleted: 0, staged })
    }
  }

  // 增删行数：优先 diff HEAD（暂存区+工作区合计）；仓库没有提交时退回 diff --cached。
  const numstat = await runGit(root, ['diff', '--numstat', 'HEAD'])
  const diffRes = numstat.ok ? numstat : await runGit(root, ['diff', '--numstat', '--cached'])
  if (diffRes.ok) {
    for (const line of diffRes.stdout.split('\n')) {
      if (line.trim().length === 0) continue
      const parts = line.split('\t')
      if (parts.length < 3) continue
      const added = Number.parseInt(parts[0], 10)
      const deleted = Number.parseInt(parts[1], 10)
      const path = normalizeNumstatPath(parts.slice(2).join('\t'))
      if (path.length === 0) continue
      const target = files.get(path)
      if (!target) continue
      target.added = Number.isFinite(added) && added > 0 ? added : 0
      target.deleted = Number.isFinite(deleted) && deleted > 0 ? deleted : 0
    }
  }

  // 未跟踪文件按实际行数计入 added（超长文件截断）。
  for (const file of files.values()) {
    if (file.worktree !== '?' || file.added > 0) continue
    file.added = countFileLines(join(repoRoot, file.path))
  }

  const list = Array.from(files.values()).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const limited = list.slice(0, MAX_CHANGE_FILES)

  return {
    isRepo: true,
    root: repoRoot,
    branch,
    dirty: limited.length > 0,
    files: limited,
  }
}

export interface InitResult {
  ok: boolean
  root: string
  branch: string
  /** true=本次真的执行了 git init；false=目录里已经有仓库（幂等）。 */
  created: boolean
  error: string
}

/**
 * 在指定目录初始化 Git 仓库。已存在 .git 时幂等返回 created:false，
 * 绝不覆盖或重置既有仓库。
 */
export async function initRepo(cwd: string, branch = 'main'): Promise<InitResult> {
  const fail = (error: string, root = ''): InitResult => ({ ok: false, root, branch: '', created: false, error })
  if (typeof cwd !== 'string' || cwd.trim().length === 0) return fail('缺少工作目录参数')
  if (!isAbsolute(cwd)) return fail(`工作目录必须是绝对路径：${cwd}`)
  const dir = resolve(cwd)
  if (!existsSync(dir)) return fail(`目录不存在：${dir}`)
  try {
    if (!statSync(dir).isDirectory()) return fail(`不是目录：${dir}`)
  } catch (error) {
    return fail(`无法访问目录：${redact(error)}`)
  }
  if (existsSync(join(dir, '.git'))) {
    const status = await readRepoStatus(dir)
    return { ok: true, root: dir, branch: status.branch || status.head, created: false, error: '' }
  }

  const initial = typeof branch === 'string' && /^[\w./-]{1,80}$/.test(branch) ? branch : 'main'
  const result = await runGit(dir, ['init', '-b', initial])
  if (!result.ok) return fail(result.error, dir)
  const status = await readRepoStatus(dir)
  return { ok: true, root: dir, branch: status.branch || initial, created: true, error: '' }
}

/**
 * 执行 git。用 execFile 直接传参数数组（不经 shell），杜绝命令注入；
 * 参数里禁止出现 `--upload-pack`、`--exec` 这类可执行外部程序的选项。
 */
export function runGit(cwd: string, args: string[]): Promise<GitRunResult> {
  const safeArgs = args.filter((item) => typeof item === 'string' && item.length > 0)
  const sub = safeArgs[0] ?? ''
  const dangerous = safeArgs.some((item) => /^--(upload-pack|exec|receive-pack|template|separate-git-dir|open-files-in-pager|pager)=/i.test(item))
  const command = `git ${safeArgs.join(' ')}`
  if (dangerous) {
    return Promise.resolve({
      ok: false,
      code: 1,
      stdout: '',
      stderr: '',
      error: '参数包含不允许的 git 选项（可执行外部程序类）',
      command,
    })
  }
  if (!isKnownCommand(sub)) {
    return Promise.resolve({
      ok: false,
      code: 1,
      stdout: '',
      stderr: '',
      error: `不支持的 git 子命令：${sub || '(空)'}`,
      command,
    })
  }
  return new Promise((resolvePromise) => {
    execFile(
      'git',
      safeArgs,
      {
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT * 4,
        windowsHide: true,
        env: {
          ...process.env,
          // 禁止 git 弹交互提示/编辑器，否则会卡死进程。
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: '',
          GIT_PAGER: 'cat',
          GIT_EDITOR: 'true',
        },
      },
      (error, stdoutRaw, stderrRaw) => {
        const stdout = clip(String(stdoutRaw ?? ''))
        const stderr = clip(String(stderrRaw ?? ''))
        if (!error) {
          resolvePromise({ ok: true, code: 0, stdout, stderr, error: '', command })
          return
        }
        const code = typeof (error as any).code === 'number' ? (error as any).code : 1
        const killed = (error as any).killed === true
        const message = killed
          ? `git ${sub} 超时（${TIMEOUT_MS / 1000}s）被终止`
          : describeFailure(sub, code, stderr, stdout)
        resolvePromise({
          ok: false,
          code,
          stdout,
          stderr,
          error: redact(message),
          command,
        })
      },
    )
  })
}
