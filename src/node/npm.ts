import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { pluginDir } from './paths.js'
import { maskSecret, redact } from './vault.js'

const REGISTRY = 'https://registry.npmjs.org'
const TOKEN_KEY = '//registry.npmjs.org/:_authToken'

export interface NpmIdentity {
  ok: boolean
  username?: string
  status?: number
  error?: string
}

/** npm 用户配置文件路径（NPM_CONFIG_USERCONFIG 优先，同 npm 官方语义）。 */
export function npmrcPath(): string {
  const fromEnv = process.env.NPM_CONFIG_USERCONFIG
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim()
  return join(homedir(), '.npmrc')
}

/** 从 ~/.npmrc 读取官方源 authToken；不存在返回空串。 */
export function npmTokenFromNpmrc(): string {
  try {
    const file = npmrcPath()
    if (!existsSync(file)) return ''
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\/\/registry\.npmjs\.org\/:_authToken\s*=\s*(.+)$/)
      if (m && m[1].trim().length > 0) return m[1].trim()
    }
  } catch {
    /* 读不到视为未配置 */
  }
  return ''
}

/** 带 Bearer token 查官方源 whoami（端点实测：无 token 401，有效 token 200 + username）。 */
export async function whoamiNpm(token: string): Promise<NpmIdentity> {
  if (typeof token !== 'string' || token.trim().length === 0) return { ok: false, error: '缺少 token' }
  try {
    const res = await fetch(`${REGISTRY}/-/whoami`, { headers: { authorization: `Bearer ${token.trim()}` } })
    if (res.status === 401 || res.status === 403) return { ok: false, status: res.status, error: 'token 无效或无权限（npm 官方源拒绝）' }
    if (!res.ok) return { ok: false, status: res.status, error: `npm 官方源返回 ${res.status}` }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const username = typeof data.username === 'string' ? data.username : ''
    if (!username) return { ok: false, error: 'whoami 返回缺少 username 字段' }
    return { ok: true, username, status: res.status }
  } catch (error) {
    return { ok: false, error: `网络错误：${redact(error)}` }
  }
}

/**
 * 把 token 写入 ~/.npmrc 的官方源 authToken 行（即 npm 官方存储位置，等同 npm login 效果）。
 * fail-closed：调用方必须先通过 whoamiNpm 验证；先备份原文件再整文件重写；
 * 只替换该键的全部行，其余行原样保留；不经 argv 传 token（防进程参数泄漏）。
 */
export function configureNpmToken(token: string): { ok: boolean; backup?: string; error?: string } {
  if (typeof token !== 'string' || token.trim().length === 0) return { ok: false, error: '缺少 token' }
  const file = npmrcPath()
  try {
    let lines: string[] = []
    if (existsSync(file)) {
      const raw = readFileSync(file, 'utf8')
      if (raw.trim().length > 0) {
        lines = raw.split(/\r?\n/)
        // 备份保留最近 5 份在插件私有目录（0600 目录惯例同 vault）。
        try {
          mkdirSync(pluginDir(), { recursive: true })
          const stamp = new Date().toISOString().replace(/[:.]/g, '-')
          const backup = join(pluginDir(), `npmrc.bak-${stamp}`)
          copyFileSync(file, backup)
          try {
            writeFileSync(backup, raw, { mode: 0o600 })
          } catch {
            /* Windows chmod 语义有限 */
          }
        } catch {
          /* 备份失败不阻塞写入：内容有 git/历史兜底，继续 */
        }
      }
    }
    const kept = lines.filter((line) => !line.trim().startsWith(TOKEN_KEY))
    kept.push(`${TOKEN_KEY}=${token.trim()}`)
    const out = kept.join('\n') + '\n'
    try {
      writeFileSync(file, out, { mode: 0o600 })
    } catch {
      writeFileSync(file, out)
    }
    return { ok: true, backup: undefined }
  } catch (error) {
    return { ok: false, error: `写入 npmrc 失败：${redact(error)}` }
  }
}

/** 面板展示用：当前 npm 配置状态（token 只回掩码）。 */
export function npmConfigState(): { configured: boolean; masked: string; token: string } {
  const token = npmTokenFromNpmrc()
  return { configured: token.length > 0, masked: maskSecret(token), token }
}

/** 接口响应专用：绝不含明文 token。 */
export function npmConfigView(): { configured: boolean; masked: string } {
  const state = npmConfigState()
  return { configured: state.configured, masked: state.masked }
}

/**
 * 读取 cwd 下 package.json 的 name 字段（面板展示用，构建发布前先核对包名）。
 * 非标准包目录返回 { ok:false }，不抛错。
 */
export function getPackageName(cwd: string): { ok: boolean; name: string; error: string } {
  if (typeof cwd !== 'string' || cwd.trim().length === 0) return { ok: false, name: '', error: '缺少工作目录参数' }
  try {
    const raw = readFileSync(join(cwd, 'package.json'), 'utf8')
    const data = JSON.parse(raw) as { name?: unknown }
    if (typeof data.name !== 'string') return { ok: false, name: '', error: 'package.json 缺少 name 字段' }
    return { ok: true, name: data.name, error: '' }
  } catch (error) {
    return { ok: false, name: '', error: `读取 package.json 失败：${redact(error)}` }
  }
}

/**
 * 改写 cwd 下 package.json 的 name 字段（用户确认包名不对时改）。
 * 采用原样反序列化再回写，尽量保真；字段缺失则补建。
 */
export function setPackageName(cwd: string, name: string): { ok: boolean; error: string } {
  if (typeof cwd !== 'string' || cwd.trim().length === 0) return { ok: false, error: '缺少工作目录参数' }
  const clean = typeof name === 'string' ? name.trim() : ''
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(clean)) {
    return { ok: false, error: '包名不符合 npm 命名规范' }
  }
  const file = join(cwd, 'package.json')
  if (!existsSync(file)) return { ok: false, error: '未找到 package.json' }
  try {
    const raw = readFileSync(file, 'utf8')
    const data = JSON.parse(raw) as Record<string, unknown>
    data.name = clean
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
    return { ok: true, error: '' }
  } catch (error) {
    return { ok: false, error: `写入 package.json 失败：${redact(error)}` }
  }
}

/**
 * 发布到 npm（v3.17 拍板：显式「发布」按钮，不自动发；改包名不会触发发布）。
 * 走 shell `npm publish`，凭据读取 ~/.npmrc（npm login 写入），不进 argv、不落盘、不回显。
 * 钉官方源 --access=public；npmmirror 等只读镜像会拒 PUT，故强制官方源。
 */
export function publishPackage(cwd: string): Promise<{ ok: boolean; output: string; error: string }> {
  return new Promise((resolve) => {
    if (typeof cwd !== 'string' || cwd.trim().length === 0) {
      resolve({ ok: false, output: '', error: '缺少工作目录参数' })
      return
    }
    const child = spawn(
      'npm',
      ['publish', '--access=public', '--registry=https://registry.npmjs.org'],
      { cwd, windowsHide: true, timeout: 180_000 },
    )
    let out = ''
    let err = ''
    child.stdout?.on('data', (chunk) => { out += String(chunk) })
    child.stderr?.on('data', (chunk) => { err += String(chunk) })
    child.on('error', (error) => resolve({ ok: false, output: out, error: `启动 npm 失败：${redact(error)}` }))
    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true, output: out, error: '' })
      else resolve({ ok: false, output: out + err, error: `npm publish 退出码 ${code}` })
    })
  })
}
