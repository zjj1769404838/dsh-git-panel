import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'
import { pluginDir, stateFile } from './paths.js'
import { open, redact, seal } from './vault.js'

export type AuthKind = 'oauth' | 'pat'
export type AccountStatus = 'connected' | 'expired' | 'error'

export interface AccountRecord {
  id: string
  /** 平台标识：github / gitlab / gitea / custom（自定义 host 时按 Gitea 风格探测）。 */
  provider: string
  kind: AuthKind
  login: string
  displayName: string
  avatarUrl: string
  host: string
  /** REST API 根地址（GitHub 是 https://api.github.com，不是网页域名）；空则回退平台默认。 */
  apiBase: string
  scopes: string[]
  /** 密文（`v1.` 前缀）；明文只在内存里短暂存在。 */
  secret: string
  createdAt: number
  lastCheckedAt: number
  status: AccountStatus
  lastError: string
}

export interface Settings {
  /** 允许 Agent 操作的远端仓库（owner/repo）；空数组=未授权任何仓库。`*` 表示全部。 */
  allowedRepos: string[]
  /** 允许 Agent 操作的本地工作区根目录（绝对路径）；本地 git 命令只在这些目录内执行。 */
  allowedRoots: string[]
  /** 是否允许写操作（commit/push/checkout 等）。默认关闭。 */
  allowWrite: boolean
  /** 写操作前是否要求用户在界面上确认。 */
  requireConfirm: boolean
  defaultAccountId: string
}

export interface PanelState {
  version: number
  accounts: AccountRecord[]
  settings: Settings
}

const DEFAULT_SETTINGS: Settings = {
  allowedRepos: [],
  allowedRoots: [],
  allowWrite: false,
  requireConfirm: true,
  defaultAccountId: '',
}

function normalizeRoot(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (raw.length === 0) return null
  return raw.replace(/[\\/]+$/, '')
}

export function normalizeRoots(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const item of input) {
    const root = normalizeRoot(item)
    if (root && !out.includes(root)) out.push(root)
  }
  return out
}

function emptyState(): PanelState {
  return { version: 1, accounts: [], settings: { ...DEFAULT_SETTINGS } }
}

function normalizeRepo(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (raw.length === 0) return null
  if (raw === '*') return '*'
  // 允许粘贴完整 URL 或 owner/repo(.git)
  const cleaned = raw
    .replace(/^git@[^:]+:/, '')
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/\.git$/, '')
    .replace(/^\/+|\/+$/g, '')
  const parts = cleaned.split('/')
  if (parts.length < 2) return null
  const [owner, repo] = parts
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null
  return `${owner}/${repo}`
}

export function normalizeRepos(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const item of input) {
    const repo = normalizeRepo(item)
    if (repo && !out.includes(repo)) out.push(repo)
  }
  return out
}

/** 账号状态 + 设置的单文件存储；每次写入先写临时文件再 rename，避免半截 JSON。 */
export class PanelStore {
  private state: PanelState = emptyState()

  constructor(private readonly file: string = stateFile()) {
    this.load()
  }

  private load(): void {
    try {
      if (!existsSync(this.file)) {
        this.state = emptyState()
        return
      }
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<PanelState>
      const accounts = Array.isArray(raw.accounts) ? (raw.accounts as AccountRecord[]) : []
      this.state = {
        version: 1,
        accounts: accounts
          .filter((item) => item && typeof item.id === 'string' && typeof item.secret === 'string')
          .map((item) => ({
            id: item.id,
            provider: typeof item.provider === 'string' ? item.provider : 'github',
            kind: item.kind === 'oauth' ? 'oauth' : 'pat',
            login: typeof item.login === 'string' ? item.login : '',
            displayName: typeof item.displayName === 'string' ? item.displayName : '',
            avatarUrl: typeof item.avatarUrl === 'string' ? item.avatarUrl : '',
            host: typeof item.host === 'string' ? item.host : '',
            apiBase: typeof item.apiBase === 'string' ? item.apiBase : '',
            scopes: Array.isArray(item.scopes) ? item.scopes.filter((s) => typeof s === 'string') : [],
            secret: item.secret,
            createdAt: Number(item.createdAt) || Date.now(),
            lastCheckedAt: Number(item.lastCheckedAt) || 0,
            status: item.status === 'expired' || item.status === 'error' ? item.status : 'connected',
            lastError: typeof item.lastError === 'string' ? item.lastError : '',
          })),
        settings: {
          allowedRepos: normalizeRepos(raw.settings?.allowedRepos),
          allowedRoots: normalizeRoots(raw.settings?.allowedRoots),
          allowWrite: raw.settings?.allowWrite === true,
          requireConfirm: raw.settings?.requireConfirm !== false,
          defaultAccountId:
            typeof raw.settings?.defaultAccountId === 'string' ? raw.settings.defaultAccountId : '',
        },
      }
    } catch (error) {
      // 状态文件损坏时不让插件挂掉：退回空状态，原文件保留为 .broken 供人工检查。
      try {
        renameSync(this.file, `${this.file}.broken`)
      } catch {
        /* ignore */
      }
      this.state = emptyState()
      console.warn('[dsh-git-panel] state.json 读取失败，已重置：' + redact(error))
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), { mode: 0o600 })
    renameSync(tmp, this.file)
  }

  snapshot(): PanelState {
    return {
      version: this.state.version,
      accounts: this.state.accounts.map((item) => ({ ...item, secret: '' })),
      settings: { ...this.state.settings, allowedRepos: [...this.state.settings.allowedRepos] },
    }
  }

  accounts(): AccountRecord[] {
    return this.state.accounts
  }

  settings(): Settings {
    return this.state.settings
  }

  getAccount(id: string): AccountRecord | undefined {
    return this.state.accounts.find((item) => item.id === id)
  }

  /** 取默认账号：显式默认 → 唯一账号 → 第一个。 */
  activeAccount(preferred?: string): AccountRecord | undefined {
    const wanted = preferred ?? this.state.settings.defaultAccountId
    if (wanted) {
      const hit = this.getAccount(wanted)
      if (hit) return hit
    }
    if (this.state.accounts.length === 1) return this.state.accounts[0]
    return this.state.accounts[0]
  }

  addAccount(input: {
    provider: string
    kind: AuthKind
    login: string
    displayName?: string
    avatarUrl?: string
    host: string
    apiBase?: string
    scopes: string[]
    token: string
  }): AccountRecord {
    const record: AccountRecord = {
      id: randomBytes(8).toString('hex'),
      provider: input.provider,
      kind: input.kind,
      login: input.login,
      displayName: input.displayName ?? input.login,
      avatarUrl: input.avatarUrl ?? '',
      host: input.host,
      apiBase: input.apiBase ?? '',
      scopes: [...input.scopes],
      secret: seal(input.token),
      createdAt: Date.now(),
      lastCheckedAt: Date.now(),
      status: 'connected',
      lastError: '',
    }
    // 同 provider + login 视为重新授权：替换旧记录，避免列表里出现两条同名账号。
    const replaced = this.state.accounts.filter(
      (item) => item.provider === record.provider && item.login === record.login,
    )
    const replacedDefault = replaced.some((item) => item.id === this.state.settings.defaultAccountId)
    this.state.accounts = this.state.accounts.filter((item) => !replaced.includes(item))
    this.state.accounts.unshift(record)
    // 重新授权后旧 id 已失效：把默认账号改指到新记录，避免 defaultAccountId 悬空。
    if (!this.state.settings.defaultAccountId || replacedDefault) {
      this.state.settings.defaultAccountId = record.id
    }
    this.persist()
    return record
  }

  removeAccount(id: string): boolean {
    const before = this.state.accounts.length
    this.state.accounts = this.state.accounts.filter((item) => item.id !== id)
    if (this.state.settings.defaultAccountId === id) {
      this.state.settings.defaultAccountId = this.state.accounts[0]?.id ?? ''
    }
    if (this.state.accounts.length === before) return false
    this.persist()
    return true
  }

  /** 读取明文令牌（仅内存使用，调用方不得写入日志或返回值）。 */
  revealSecret(id: string): string | null {
    const record = this.getAccount(id)
    if (!record) return null
    try {
      return open(record.secret)
    } catch {
      return null
    }
  }

  markAccount(id: string, patch: Partial<Pick<AccountRecord, 'status' | 'lastError' | 'lastCheckedAt' | 'login' | 'displayName' | 'scopes'>>): void {
    const record = this.getAccount(id)
    if (!record) return
    Object.assign(record, patch, { lastCheckedAt: patch.lastCheckedAt ?? Date.now() })
    this.persist()
  }

  updateSettings(patch: Partial<Settings>): Settings {
    const next = { ...this.state.settings, ...patch }
    if ('allowedRepos' in patch) next.allowedRepos = normalizeRepos(patch.allowedRepos)
    if ('allowedRoots' in patch) next.allowedRoots = normalizeRoots(patch.allowedRoots)
    if ('allowWrite' in patch) next.allowWrite = patch.allowWrite === true
    if ('requireConfirm' in patch) next.requireConfirm = patch.requireConfirm !== false
    if (typeof next.defaultAccountId !== 'string') next.defaultAccountId = ''
    this.state.settings = next
    this.persist()
    return { ...next, allowedRepos: [...next.allowedRepos], allowedRoots: [...next.allowedRoots] }
  }

  /** 远端仓库是否在授权范围内。空列表=未授权；`*`=全部。 */
  isRepoAllowed(repo: string): boolean {
    const normalized = normalizeRepo(repo)
    if (!normalized) return false
    const list = this.state.settings.allowedRepos
    if (list.includes('*')) return true
    return list.includes(normalized)
  }

  /** 本地目录是否在授权根目录内（按路径段比较，避免 `/repo-evil` 命中 `/repo`）。`*` 表示全部目录。 */
  isRootAllowed(dir: string): boolean {
    const target = normalizeRoot(dir)
    if (!target) return false
    if (this.state.settings.allowedRoots.includes('*')) return true
    const norm = (value: string) => value.replace(/\\/g, '/').toLowerCase()
    const targetNorm = norm(target)
    return this.state.settings.allowedRoots.some((root) => {
      const rootNorm = norm(normalizeRoot(root) ?? '')
      if (!rootNorm) return false
      return targetNorm === rootNorm || targetNorm.startsWith(rootNorm + '/')
    })
  }

  reset(): void {
    this.state = emptyState()
    this.persist()
  }
}

export { normalizeRepo, pluginDir }
