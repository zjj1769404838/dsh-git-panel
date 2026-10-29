import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { keyFile, pluginDir } from './paths.js'

const KEY_BYTES = 32
const IV_BYTES = 12
const TAG_BYTES = 16
const PREFIX = 'v1.'

/**
 * 本机密钥：首次使用时生成 32 字节随机密钥，权限收紧到 0600。
 * 令牌只用它加密落盘，明文永不写入磁盘、永不出现在日志里。
 */
function loadOrCreateKey(): Buffer {
  const file = keyFile()
  try {
    const raw = readFileSync(file)
    if (raw.length === KEY_BYTES) return raw
  } catch {
    /* 不存在或不可读 → 新建 */
  }
  mkdirSync(dirname(file), { recursive: true })
  const key = randomBytes(KEY_BYTES)
  writeFileSync(file, key, { mode: 0o600 })
  try {
    chmodSync(file, 0o600)
  } catch {
    /* Windows 上 chmod 语义有限，忽略 */
  }
  return key
}

/** 加密明文令牌 → `v1.<base64(iv|tag|ciphertext)>`。 */
export function seal(plain: string): string {
  if (typeof plain !== 'string' || plain.length === 0) throw new Error('empty secret')
  const key = loadOrCreateKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, body]).toString('base64')
}

/** 解密 `v1.` 密文；密文被改动或密钥不匹配时抛错。 */
export function open(sealed: string): string {
  if (typeof sealed !== 'string' || !sealed.startsWith(PREFIX)) throw new Error('unsupported secret format')
  const raw = Buffer.from(sealed.slice(PREFIX.length), 'base64')
  if (raw.length < IV_BYTES + TAG_BYTES) throw new Error('corrupted secret')
  const key = loadOrCreateKey()
  const iv = raw.subarray(0, IV_BYTES)
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const body = raw.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
}

/** 只保留尾部 4 位，用于界面上「已配置」的弱提示。 */
export function maskSecret(plain: string | undefined | null): string {
  if (typeof plain !== 'string' || plain.length === 0) return ''
  const tail = plain.slice(-4)
  return '••••' + tail
}

const REDACT_RULES: Array<[RegExp, string]> = [
  // 常见令牌形态：ghp_/gho_/ghu_/ghs_/ghr_/github_pat_、glpat-、Bearer、Basic
  [/\b(gh[pousr]_[A-Za-z0-9]{16,})/g, '***'],
  [/\b(github_pat_[A-Za-z0-9_]{20,})/g, '***'],
  [/\b(glpat-[A-Za-z0-9_-]{16,})/g, '***'],
  [/(Authorization\s*:\s*)(Bearer|Basic|token)\s+[^\s'"]+/gi, '$1$2 ***'],
  [/(https?:\/\/)([^/\s:@]+):([^/\s@]+)@/g, '$1$2:***@'],
  [/([?&](?:access_token|token|private_token|client_secret)=)[^&\s]+/gi, '$1***'],
]

/** 日志/错误文本统一脱敏：任何令牌、URL 内嵌密码、Authorization 头都打码。 */
export function redact(input: unknown): string {
  let text = typeof input === 'string' ? input : input instanceof Error ? input.message : String(input ?? '')
  for (const [pattern, replacement] of REDACT_RULES) text = text.replace(pattern, replacement)
  return text
}

/** 递归脱敏对象里的字符串字段（用于工具返回值与接口响应）。 */
export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redact(value) as unknown as T
  if (Array.isArray(value)) return value.map((item) => redactDeep(item)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/token|secret|password|authorization/i.test(key)) {
        out[key] = typeof item === 'string' && item.length > 0 ? '***' : item
        continue
      }
      out[key] = redactDeep(item)
    }
    return out as unknown as T
  }
  return value
}

/** 常量时间比较，避免把「哪一位不同」当侧信道。 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export { pluginDir }
