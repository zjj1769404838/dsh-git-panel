import { closeSync, openSync, readSync, realpathSync, statSync } from 'node:fs'
import { readdir, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { redact } from './vault.js'

/**
 * 文件浏览层：目录列表 + 单文件内容。
 *
 * 安全边界（与 git 命令层分开，因为它直接碰文件系统）：
 * - root 必须已在 handler 侧过 allowedRoots 闸门；这里再校验「解析后的真实路径
 *   仍在 root 之内」，软链指到外部一律拒绝（realpath 包含检查，不是字符串前缀比较）。
 * - 拒绝绝对路径、`..` 段、`.git` 目录（内部对象与凭据不该出现在浏览里）。
 * - 单文件读取有字节上限，超出截断而不是整份读进内存。
 */

/** 单文件最多读这么多字节；超出截断并标记。 */
const MAX_FILE_BYTES = 512 * 1024
/** 二进制探测窗口。 */
const SNIFF_BYTES = 8 * 1024
/** 单目录最多返回条目数。 */
const MAX_ENTRIES = 2000
/** 图片预览最多读这么多字节（base64 后约 1.37x，够看 4MB 以内的图）。 */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** 扩展名 → image MIME。未知返回空串（不是可预览图片）。 */
const IMAGE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

export interface ImageReadResult {
  ok: boolean
  root: string
  path: string
  /** 文件总字节数。 */
  size: number
  /** image/png 之类；不可预览时为空串。 */
  mime: string
  /** data: URL（base64）。失败或过大为空串。 */
  dataUrl: string
  /** 超过 MAX_IMAGE_BYTES 被截断（此时 dataUrl 为空，只报体积）。 */
  truncated: boolean
  error: string
}

/** 按扩展名判断能否当图片预览；能就返回 MIME，否则空串。 */
export function imageMimeOf(filePath: string): string {
  const name = filePath.split('/').pop() ?? filePath
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  return IMAGE_BY_EXT[name.slice(dot + 1).toLowerCase()] ?? ''
}

export interface FileEntry {
  name: string
  /** 相对 root 的路径（统一 / 分隔）。 */
  path: string
  kind: 'file' | 'dir'
  size: number
  /** 扩展名推断的语言标识（供语法高亮选 grammar）；识别不出为空串。 */
  lang: string
}

export interface DirListResult {
  ok: boolean
  root: string
  /** 相对 root 的目录路径（root 本身为空串）。 */
  path: string
  entries: FileEntry[]
  /** 条目数超过上限被截断。 */
  truncated: boolean
  error: string
}

export interface FileReadResult {
  ok: boolean
  root: string
  path: string
  /** 文本内容；二进制或读取失败为空串。 */
  content: string
  /** 文件总字节数。 */
  size: number
  /** 内容被截断（超过 MAX_FILE_BYTES）。 */
  truncated: boolean
  /** 判定为二进制（含 NUL 或非法 UTF-8 比例过高）。 */
  binary: boolean
  lang: string
  error: string
}

/** 扩展名 → 语言标识（语法高亮用；未知返回空串，界面回退纯文本）。 */
const LANG_BY_EXT: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  vue: 'xml',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  ps1: 'powershell',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  sql: 'sql',
  diff: 'diff',
  patch: 'diff',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  scala: 'scala',
  pl: 'perl',
  ex: 'elixir',
  exs: 'elixir',
}

export function langOf(filePath: string): string {
  const name = filePath.split('/').pop() ?? filePath
  const lower = name.toLowerCase()
  if (lower === 'dockerfile') return 'dockerfile'
  if (lower === 'makefile') return 'makefile'
  const dot = lower.lastIndexOf('.')
  if (dot < 0) return ''
  return LANG_BY_EXT[lower.slice(dot + 1)] ?? ''
}

/** 把外部传入的相对路径规范成安全的 POSIX 相对路径；非法返回 null。 */
function normalizeRel(input: unknown): string | null {
  if (typeof input !== 'string') return ''
  const raw = input.replace(/\\/g, '/').trim()
  if (raw.length === 0) return ''
  if (raw.length > 1024) return null
  // 绝对路径（含 Windows 盘符）一律拒绝：浏览只接受 root 内相对路径。
  if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) return null
  if (raw.includes('\u0000')) return null
  const parts: string[] = []
  for (const segment of raw.split('/')) {
    if (segment.length === 0 || segment === '.') continue
    if (segment === '..') return null
    // .git 内部对象/凭据不进入浏览面
    if (segment.toLowerCase() === '.git') return null
    parts.push(segment)
  }
  return parts.join('/')
}

/** 解析 root 的真实路径（软链本身也解析），失败返回 null。 */
async function realRoot(root: string): Promise<string | null> {
  try {
    const real = await realpath(root)
    const info = statSync(real)
    return info.isDirectory() ? real : null
  } catch {
    return null
  }
}

/**
 * 校验目标路径落在 root 之内。
 * 用 realpath 解析后再比较，`a/b/../../c` 与软链外指都拦得住。
 */
async function resolveInside(root: string, rel: string): Promise<string | null> {
  const base = await realRoot(root)
  if (!base) return null
  const target = rel.length === 0 ? base : resolve(base, rel)
  let real: string
  try {
    real = await realpath(target)
  } catch {
    // 目标还不存在（列目录时不该发生；读文件时视为错误）
    return null
  }
  const relFromBase = relative(base, real)
  if (relFromBase.length === 0) return real
  if (relFromBase.startsWith('..') || isAbsolute(relFromBase)) return null
  return real
}

function toPosix(p: string): string {
  return p.split(sep).join('/')
}

/** 列目录（不递归，懒加载由界面按需逐层调用）。 */
export async function listDir(root: string, relPath: string): Promise<DirListResult> {
  const rel = normalizeRel(relPath)
  if (rel === null) {
    return { ok: false, root, path: '', entries: [], truncated: false, error: `路径不合法：${String(relPath)}` }
  }
  const dir = await resolveInside(root, rel)
  if (!dir) {
    return { ok: false, root, path: rel, entries: [], truncated: false, error: `目录不可访问或不在授权范围内：${rel || '.'}` }
  }
  let raw: Array<{ name: string; isDir: boolean; isFile: boolean; isLink: boolean }> = []
  try {
    const items = await readdir(dir, { withFileTypes: true })
    raw = items.map((item) => ({
      name: item.name,
      isDir: item.isDirectory(),
      isFile: item.isFile(),
      isLink: item.isSymbolicLink(),
    }))
  } catch (error) {
    return { ok: false, root, path: rel, entries: [], truncated: false, error: redact(error) }
  }
  const entries: FileEntry[] = []
  let truncated = false
  // 目录在前、同类按名称排序（资源管理器习惯）。
  raw.sort((a, b) => {
    const aDir = a.isDir || (a.isLink && !a.isFile)
    const bDir = b.isDir || (b.isLink && !b.isFile)
    if (aDir !== bDir) return aDir ? -1 : 1
    return a.name.localeCompare(b.name, 'en')
  })
  for (const item of raw) {
    if (item.name.toLowerCase() === '.git') continue
    if (entries.length >= MAX_ENTRIES) {
      truncated = true
      break
    }
    const childRel = rel.length === 0 ? item.name : `${rel}/${item.name}`
    let kind: 'file' | 'dir' = item.isDir ? 'dir' : 'file'
    let size = 0
    try {
      // 软链按其目标判定（指向目录当目录，指向外部则按文件处理且读取会被 realpath 拦下）。
      const info = statSync(join(dir, item.name))
      kind = info.isDirectory() ? 'dir' : 'file'
      size = info.isDirectory() ? 0 : info.size
    } catch {
      // 断链：仍列出，但标记为文件、大小 0，点开会得到可读错误。
    }
    entries.push({
      name: item.name,
      path: toPosix(childRel),
      kind,
      size,
      lang: kind === 'file' ? langOf(item.name) : '',
    })
  }
  return { ok: true, root, path: rel, entries, truncated, error: '' }
}

/** 读单文件（文本）。二进制返回 binary=true 且 content 为空。 */
export async function readTextFile(root: string, relPath: string): Promise<FileReadResult> {
  const rel = normalizeRel(relPath)
  const empty: FileReadResult = { ok: false, root, path: '', content: '', size: 0, truncated: false, binary: false, lang: '', error: '' }
  if (rel === null || rel.length === 0) {
    return { ...empty, error: `路径不合法：${String(relPath)}` }
  }
  const file = await resolveInside(root, rel)
  if (!file) {
    return { ...empty, path: rel, error: `文件不可访问或不在授权范围内：${rel}` }
  }
  let size = 0
  try {
    const info = statSync(file)
    if (!info.isFile()) return { ...empty, path: rel, error: `不是文件：${rel}` }
    size = info.size
  } catch (error) {
    return { ...empty, path: rel, error: redact(error) }
  }
  const lang = langOf(rel)
  // 先嗅探是否二进制：含 NUL 直接判定，避免把图片/压缩包当文本读。
  try {
    const fd = openSync(file, 'r')
    const buffer = Buffer.alloc(Math.min(SNIFF_BYTES, size))
    try {
      readSync(fd, buffer, 0, buffer.length, 0)
    } finally {
      closeSync(fd)
    }
    if (buffer.includes(0)) {
      return { ok: true, root, path: rel, content: '', size, truncated: false, binary: true, lang, error: '' }
    }
  } catch (error) {
    return { ...empty, path: rel, error: redact(error) }
  }
  const truncated = size > MAX_FILE_BYTES
  try {
    const buffer = await readFile(file)
    const slice = truncated ? buffer.subarray(0, MAX_FILE_BYTES) : buffer
    // 替换非法 UTF-8 序列，避免前端拿到乱码字节。
    const content = slice.toString('utf8').replace(/\uFFFD/g, '')
    return { ok: true, root, path: rel, content, size, truncated, binary: false, lang, error: '' }
  } catch (error) {
    return { ...empty, path: rel, error: redact(error) }
  }
}

/**
 * 读图片并编码成 data: URL。
 *
 * 为什么不复用 readTextFile：文本通道对二进制直接返回空内容，
 * 图片需要原始字节；但两者共用同一套路径校验与越界判定（resolveInside）。
 * SVG 走 <img> 渲染时脚本不执行，所以按图片处理是安全的。
 */
export async function readImageFile(root: string, relPath: string): Promise<ImageReadResult> {
  const rel = normalizeRel(relPath)
  const empty: ImageReadResult = { ok: false, root, path: '', size: 0, mime: '', dataUrl: '', truncated: false, error: '' }
  if (rel === null || rel.length === 0) {
    return { ...empty, error: `路径不合法：${String(relPath)}` }
  }
  const mime = imageMimeOf(rel)
  if (mime === '') {
    return { ...empty, path: rel, error: `不是可预览的图片：${rel}` }
  }
  const file = await resolveInside(root, rel)
  if (!file) {
    return { ...empty, path: rel, mime, error: `文件不可访问或不在授权范围内：${rel}` }
  }
  let size = 0
  try {
    const info = statSync(file)
    if (!info.isFile()) return { ...empty, path: rel, mime, error: `不是文件：${rel}` }
    size = info.size
  } catch (error) {
    return { ...empty, path: rel, mime, error: redact(error) }
  }
  if (size > MAX_IMAGE_BYTES) {
    return { ok: true, root, path: rel, size, mime, dataUrl: '', truncated: true, error: '' }
  }
  try {
    const buffer = await readFile(file)
    return { ok: true, root, path: rel, size, mime, dataUrl: `data:${mime};base64,${buffer.toString('base64')}`, truncated: false, error: '' }
  } catch (error) {
    return { ...empty, path: rel, mime, error: redact(error) }
  }
}

/**
 * 仓库根的真实路径（供 handler 在列目录前把 cwd 归一）。
 * 不在授权范围时由 handler 的 requireRead 拦，这里只做存在性判断。
 */
export function safeRootSync(root: string): string | null {
  try {
    const real = realpathSync(root)
    return statSync(real).isDirectory() ? real : null
  } catch {
    return null
  }
}
