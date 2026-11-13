import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'
import { stateFile } from './paths.js'
import { open, redact, seal } from './vault.js'

export type AuthKind = 'oauth' | 'pat'
export type AccountStatus = 'connected' | 'expired' | 'error'

export interface AccountRecord {
  id: string
  provider: string
  kind: AuthKind
  login: string
  displayName: string
  avatarUrl: string
  /** OAuth App Client ID（设备码流程需要；PAT 账号可为空）。 */
  clientId: string
  scopes: string[]
  /** 密文（`v1.` 前缀）；明文只在内存里短暂存在。 */
  secret: string
  createdAt: number
  lastCheckedAt: number
  status: AccountStatus
  lastError: string
}

export interface Settings {
  /** 是否允许写操作（git_write）。默认关闭。 */
  allowWrite: boolean
  /** 写操作前是否要求用户在界面上确认（git_write → git_confirm）。 */
  requireConfirm: boolean
  defaultAccountId: string
  /** 「直接提交」按钮偏好：注入指令后是否代按发送。 */
  autoSubmit: boolean
  /** v3.10：当前生效的 npm 凭据 id（'' = 未选定，跟随 ~/.npmrc 现状）。 */
  npmActiveId: string
}

export interface PanelState {
  version: number
  accounts: AccountRecord[]
  settings: Settings
  /** v3.10：npm 发布凭据多账号表（token 密文；activeId 同步进 ~/.npmrc）。 */
  npmAccounts: NpmAccountRecord[]
}

export interface NpmAccountRecord {
  id: string
  login: string
  /** 密文（`v1.` 前缀）；明文只在内存短暂存在。 */
  secret: string
  createdAt: number
  lastCheckedAt: number
  lastError: string
}

export const NPM_PROVIDER = 'npm'

const DEFAULT_SETTINGS: Settings = {
  allowWrite: false,
  requireConfirm: true,
  defaultAccountId: '',
  autoSubmit: false,
  npmActiveId: '',
}

function emptyState(): PanelState {
  return { version: 3, accounts: [], settings: { ...DEFAULT_SETTINGS }, npmAccounts: [] }
}

/** npm 记录（provider=npm 的 GitHub 账号卡不认它）。 */
function isNpmRecord(item: AccountRecord): boolean {
  return item.provider === NPM_PROVIDER
}

/**
 * 账号状态 + 设置的单文件存储；每次写入先写临时文件再 rename，避免半截 JSON。
 * v3 极简化：仓库级三档权限表（repoPermissions/allowedRepos）已移除——
 * 授权模型收敛为「本地目录白名单 + allowWrite + requireConfirm」。
 */
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
        version: 3,
        accounts: accounts
          .filter((item) => item && typeof item.id === 'string' && typeof item.secret === 'string' && !isNpmRecord(item))
          .map((item) => ({
            id: item.id,
            provider: typeof item.provider === 'string' ? item.provider : 'github',
            kind: item.kind === 'oauth' ? 'oauth' : 'pat',
            login: typeof item.login === 'string' ? item.login : '',
            displayName: typeof item.displayName === 'string' ? item.displayName : '',
            avatarUrl: typeof item.avatarUrl === 'string' ? item.avatarUrl : '',
            clientId: typeof item.clientId === 'string' ? item.clientId : '',
            scopes: Array.isArray(item.scopes) ? item.scopes.filter((s) => typeof s === 'string') : [],
            secret: item.secret,
            createdAt: Number(item.createdAt) || Date.now(),
            lastCheckedAt: Number(item.lastCheckedAt) || 0,
            status: item.status === 'expired' || item.status === 'error' ? item.status : 'connected',
            lastError: typeof item.lastError === 'string' ? item.lastError : '',
          })),
        settings: {
          allowWrite: raw.settings?.allowWrite === true,
          requireConfirm: raw.settings?.requireConfirm !== false,
          defaultAccountId: typeof raw.settings?.defaultAccountId === 'string' ? raw.settings.defaultAccountId : '',
          autoSubmit: (raw.settings as Partial<Settings> | undefined)?.autoSubmit === true,
          npmActiveId: typeof raw.settings?.npmActiveId === 'string' ? raw.settings.npmActiveId : '',
        },
        npmAccounts: (Array.isArray(raw.npmAccounts) ? raw.npmAccounts : [])
          .filter((item) => item && typeof item.id === 'string' && typeof item.secret === 'string' && typeof item.login === 'string')
          .map((item) => ({
            id: item.id,
            login: item.login,
            secret: item.secret,
            createdAt: Number(item.createdAt) || Date.now(),
            lastCheckedAt: Number(item.lastCheckedAt) || 0,
            lastError: typeof item.lastError === 'string' ? item.lastError : '',
          })),
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
      settings: { ...this.state.settings },
      npmAccounts: this.state.npmAccounts.map((item) => ({ ...item, secret: '' })),
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
    return this.state.accounts[0]
  }

  addAccount(input: {
    provider: string
    kind: AuthKind
    login: string
    displayName?: string
    avatarUrl?: string
    clientId?: string
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
      clientId: input.clientId ?? '',
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

  markAccount(
    id: string,
    patch: Partial<Pick<AccountRecord, 'status' | 'lastError' | 'lastCheckedAt' | 'login' | 'displayName' | 'scopes'>>,
  ): void {
    const record = this.getAccount(id)
    if (!record) return
    Object.assign(record, patch, { lastCheckedAt: patch.lastCheckedAt ?? Date.now() })
    this.persist()
  }

  updateSettings(patch: Partial<Settings>): Settings {
    const next = { ...this.state.settings, ...patch }
    if ('allowWrite' in patch) next.allowWrite = patch.allowWrite === true
    if ('requireConfirm' in patch) next.requireConfirm = patch.requireConfirm !== false
    if ('autoSubmit' in patch) next.autoSubmit = patch.autoSubmit === true
    if (typeof next.defaultAccountId !== 'string') next.defaultAccountId = ''
    if (typeof next.npmActiveId !== 'string') next.npmActiveId = ''
    this.state.settings = next
    this.persist()
    return { ...next }
  }

  // ---- v3.10 npm 凭据多账号 ----

  npmAccounts(): NpmAccountRecord[] {
    return this.state.npmAccounts
  }

  getNpmAccount(id: string): NpmAccountRecord | undefined {
    return this.state.npmAccounts.find((item) => item.id === id)
  }

  /** 新增/替换 npm 凭据：同 login 视为更新 token（换新 id 会丢历史，故原地换密文保留 id）。 */
  addNpmAccount(input: { login: string; token: string }): NpmAccountRecord {
    const existing = this.state.npmAccounts.find((item) => item.login === input.login)
    if (existing) {
      existing.secret = seal(input.token)
      existing.lastCheckedAt = Date.now()
      existing.lastError = ''
      this.persist()
      return existing
    }
    const record: NpmAccountRecord = {
      id: randomBytes(8).toString('hex'),
      login: input.login,
      secret: seal(input.token),
      createdAt: Date.now(),
      lastCheckedAt: Date.now(),
      lastError: '',
    }
    this.state.npmAccounts.unshift(record)
    this.persist()
    return record
  }

  removeNpmAccount(id: string): boolean {
    const before = this.state.npmAccounts.length
    this.state.npmAccounts = this.state.npmAccounts.filter((item) => item.id !== id)
    if (this.state.settings.npmActiveId === id) this.state.settings.npmActiveId = ''
    if (this.state.npmAccounts.length === before) return false
    this.persist()
    return true
  }

  markNpmAccount(id: string, patch: Partial<Pick<NpmAccountRecord, 'lastCheckedAt' | 'lastError'>>): void {
    const record = this.getNpmAccount(id)
    if (!record) return
    Object.assign(record, patch, { lastCheckedAt: patch.lastCheckedAt ?? Date.now() })
    this.persist()
  }

  /** 读取 npm 明文 token（仅内存使用，不得写日志/返回值）。 */
  revealNpmSecret(id: string): string | null {
    const record = this.getNpmAccount(id)
    if (!record) return null
    try {
      return open(record.secret)
    } catch {
      return null
    }
  }

  setNpmActiveId(id: string): void {
    this.state.settings.npmActiveId = typeof id === 'string' ? id : ''
    this.persist()
  }

  reset(): void {
    this.state = emptyState()
    this.persist()
  }
}

