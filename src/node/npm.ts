import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
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
