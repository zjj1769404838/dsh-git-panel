import { redact } from './vault.js'

export type ProviderId = 'github' | 'gitlab' | 'gitea'

export interface ProviderMeta {
  id: ProviderId
  label: string
  host: string
  apiBase: string
  /** 该平台支持的能力说明，用于界面文案。 */
  oauthHint: string
  patHint: string
  patUrl: string
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  github: {
    id: 'github',
    label: 'GitHub',
    host: 'github.com',
    apiBase: 'https://api.github.com',
    oauthHint: '设备码流程：点「连接」后浏览器打开一次授权页、输入 8 位代码即可，无需复制令牌。适合本机交互式使用。',
    patHint: '个人访问令牌（Fine-grained / classic）：适合 CI、无人值守、或无法打开浏览器时；可精确限制到单个仓库与只读权限。',
    patUrl: 'https://github.com/settings/tokens',
  },
  gitlab: {
    id: 'gitlab',
    label: 'GitLab',
    host: 'gitlab.com',
    apiBase: 'https://gitlab.com',
    oauthHint: '设备码流程：需要先在 GitLab 应用设置里开启 device flow；开启后与 GitHub 体验一致。',
    patHint: '个人访问令牌（read_api / read_repository）：适合自建实例与无人值守场景，权限可按 scope 收紧。',
    patUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens',
  },
  gitea: {
    id: 'gitea',
    label: 'Gitea / 自建',
    host: '',
    apiBase: '',
    oauthHint: '自建实例通常未开启设备码流程，建议使用访问令牌接入。',
    patHint: '访问令牌：在实例的「设置 → 应用 → 生成令牌」创建，建议只勾选 read:repository。',
    patUrl: '',
  },
}

export function providerOf(value: unknown): ProviderId {
  return value === 'gitlab' || value === 'gitea' ? value : 'github'
}

/**
 * 账号实际使用的 REST 根地址。
 * 显式 apiBase 优先 → 平台默认 → 按 host 推断（自建实例按 Gitea 风格补 `/api/v1`）。
 * 注意：**网页域名不等于 API 域名**（GitHub 是 api.github.com），绝不能把 host 直接当 apiBase。
 */
export function resolveApiBase(provider: ProviderId, apiBase?: string, host?: string): string {
  const explicit = (apiBase ?? '').trim().replace(/\/+$/, '')
  if (explicit) return explicit
  const meta = PROVIDERS[provider]
  if (meta.apiBase) return meta.apiBase.replace(/\/+$/, '')
  const bare = (host ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  if (!bare) return ''
  return provider === 'gitlab' ? `https://${bare}` : `https://${bare}/api/v1`
}

export interface Identity {
  login: string
  displayName: string
  avatarUrl: string
  scopes: string[]
}

export interface HttpResult {
  ok: boolean
  status: number
  json: any
  text: string
  headers: Headers | null
  error: string
}

const TIMEOUT_MS = 20_000

async function request(url: string, init: RequestInit & { token?: string } = {}): Promise<HttpResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': 'dsh-git-panel/0.1.0',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (init.token) headers.authorization = `Bearer ${init.token}`
  try {
    const response = await fetch(url, { ...init, headers, signal: controller.signal })
    const text = await response.text()
    let json: any = null
    try {
      json = text.length > 0 ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return {
      ok: response.ok,
      status: response.status,
      json,
      text,
      headers: response.headers,
      error: response.ok ? '' : describeHttpError(response.status, json, text),
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return {
      ok: false,
      status: 0,
      json: null,
      text: '',
      headers: null,
      error: aborted ? `请求超时（${TIMEOUT_MS / 1000}s）` : `网络请求失败：${redact(error)}`,
    }
  } finally {
    clearTimeout(timer)
  }
}

function describeHttpError(status: number, json: any, text: string): string {
  const message =
    (json && typeof json.message === 'string' && json.message) ||
    (json && typeof json.error === 'string' && json.error) ||
    (json && typeof json.error_description === 'string' && json.error_description) ||
    (text || '').slice(0, 200)
  if (status === 401) return `令牌无效或已失效（401）${message ? '：' + message : ''}`
  if (status === 403) return `权限不足或触发限流（403）${message ? '：' + message : ''}`
  if (status === 404) return `仓库或资源不存在，或令牌无权访问（404）${message ? '：' + message : ''}`
  if (status === 429) return `请求过于频繁（429），请稍后再试`
  return `请求失败（${status}）${message ? '：' + message : ''}`
}

function parseScopes(headers: Headers | null): string[] {
  if (!headers) return []
  const raw = headers.get('x-oauth-scopes') ?? headers.get('x-gitlab-scopes') ?? ''
  if (!raw) return []
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 校验令牌并取回账号身份。任何失败都返回可读原因，不回显令牌。 */
export async function verifyToken(provider: ProviderId, token: string, apiBase?: string, host?: string): Promise<{ ok: boolean; identity?: Identity; error?: string }> {
  if (typeof token !== 'string' || token.trim().length === 0) return { ok: false, error: '令牌为空' }
  const base = resolveApiBase(provider, apiBase, host)
  if (!base) return { ok: false, error: '该平台需要填写 API 地址（例如 https://git.example.com/api/v1）' }

  if (provider === 'gitlab') {
    const result = await request(`${base}/api/v4/user`, { token })
    if (!result.ok) return { ok: false, error: result.error }
    const user = result.json ?? {}
    return {
      ok: true,
      identity: {
        login: String(user.username ?? ''),
        displayName: String(user.name ?? user.username ?? ''),
        avatarUrl: String(user.avatar_url ?? ''),
        scopes: parseScopes(result.headers),
      },
    }
  }

  const url = provider === 'gitea' ? `${base}/user` : `${base}/user`
  const result = await request(url, { token })
  if (!result.ok) return { ok: false, error: result.error }
  const user = result.json ?? {}
  return {
    ok: true,
    identity: {
      login: String(user.login ?? user.username ?? ''),
      displayName: String(user.name ?? user.full_name ?? user.login ?? ''),
      avatarUrl: String(user.avatar_url ?? ''),
      scopes: parseScopes(result.headers),
    },
  }
}

export interface DeviceFlowStart {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export interface DeviceFlowPoll {
  status: 'pending' | 'slow_down' | 'authorized' | 'denied' | 'expired' | 'error'
  token?: string
  scopes?: string[]
  error?: string
  retryAfter?: number
}

/**
 * OAuth 设备码流程（GitHub 官方支持；GitLab 需实例开启 device flow）。
 * client_id 由用户在设置面板填入自己的 OAuth App，不内置任何第三方凭据。
 */
export async function startDeviceFlow(
  provider: ProviderId,
  clientId: string,
  scope: string,
  apiBase?: string,
  host?: string,
): Promise<{ ok: boolean; flow?: DeviceFlowStart; error?: string }> {
  if (!clientId || clientId.trim().length === 0) {
    return { ok: false, error: '请先在设置里填写该平台的 OAuth App Client ID（OAuth 需要你自己的应用凭据）' }
  }
  const base = resolveApiBase(provider, apiBase, host)
  if (!base) return { ok: false, error: '该平台需要填写 API 地址（例如 https://git.example.com/api/v1）' }
  const endpoint =
    provider === 'gitlab'
      ? `${base}/oauth/authorize_device`
      : `${base}/login/device/code`
  const body =
    provider === 'gitlab'
      ? new URLSearchParams({ client_id: clientId, scope })
      : new URLSearchParams({ client_id: clientId, scope })

  const result = await request(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!result.ok) {
    const hint =
      provider === 'gitlab'
        ? '（GitLab 设备码流程需实例开启；未开启时请改用访问令牌）'
        : ''
    return { ok: false, error: result.error + hint }
  }
  const json = result.json ?? {}
  const deviceCode = String(json.device_code ?? '')
  const userCode = String(json.user_code ?? json.user_code ?? '')
  if (!deviceCode) return { ok: false, error: '授权服务未返回 device_code，可能是该实例不支持设备码流程' }
  return {
    ok: true,
    flow: {
      deviceCode,
      userCode,
      verificationUri: String(json.verification_uri ?? json.verification_uri_complete ?? ''),
      expiresIn: Number(json.expires_in) || 900,
      interval: Number(json.interval) || 5,
    },
  }
}

export async function pollDeviceFlow(
  provider: ProviderId,
  clientId: string,
  deviceCode: string,
  apiBase?: string,
  host?: string,
): Promise<DeviceFlowPoll> {
  const base = resolveApiBase(provider, apiBase, host)
  if (!base) return { status: 'error', error: '该平台需要填写 API 地址（例如 https://git.example.com/api/v1）' }
  const endpoint = provider === 'gitlab' ? `${base}/oauth/token` : `${base}/login/oauth/access_token`
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  })
  const result = await request(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = result.json ?? {}
  const error = String(json.error ?? '')
  if (error === 'authorization_pending') return { status: 'pending' }
  if (error === 'slow_down') return { status: 'slow_down', retryAfter: Number(json.interval) || 10 }
  if (error === 'expired_token') return { status: 'expired', error: '设备码已过期，请重新发起授权' }
  if (error === 'access_denied') return { status: 'denied', error: '授权被拒绝' }
  if (!result.ok || error) {
    return { status: 'error', error: result.error || `授权失败：${error || '未知错误'}` }
  }
  const token = String(json.access_token ?? '')
  if (!token) return { status: 'error', error: '授权服务未返回 access_token' }
  const scope = String(json.scope ?? '')
  return {
    status: 'authorized',
    token,
    scopes: scope ? scope.split(/[,\s]+/).filter(Boolean) : [],
  }
}

/** 仓库信息查询（只读，用于面板展示与工具校验仓库是否存在）。 */
export async function fetchRepo(
  provider: ProviderId,
  token: string,
  fullName: string,
  apiBase?: string,
  host?: string,
): Promise<{ ok: boolean; repo?: any; error?: string }> {
  const base = resolveApiBase(provider, apiBase, host)
  if (!base) return { ok: false, error: '该平台需要填写 API 地址（例如 https://git.example.com/api/v1）' }
  const [owner, name] = fullName.split('/')
  if (!owner || !name) return { ok: false, error: `仓库名不合法：${fullName}` }
  const url =
    provider === 'gitlab'
      ? `${base}/api/v4/projects/${encodeURIComponent(fullName)}`
      : `${base}/repos/${owner}/${name}`
  const result = await request(url, { token })
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, repo: result.json }
}

/** 账号下的远程仓库（用于权限授权与 bootstrap 选择目标）。 */
export interface AccountRepoInfo {
  /** owner/repo（GitLab 可能是 group/subgroup/repo） */
  fullName: string
  name: string
  owner: string
  /** 可直接 `git remote add` 的克隆地址 */
  url: string
  private: boolean
  defaultBranch: string
}

/** 单页仓库数（三家平台都支持这个量级）。 */
const REPO_PAGE_SIZE = 100
/** 最多翻几页：500 个仓库封顶，避免超大账号把一次请求拖成几十秒。 */
const REPO_MAX_PAGES = 5

/**
 * 各平台「列出账号可见仓库」的接口路径（带分页）。
 * 单独导出便于单测断言拼接结果（不做任何网络请求）。
 */
export function accountReposEndpoint(provider: ProviderId, base: string, page = 1): string {
  const root = String(base ?? '').replace(/\/+$/, '')
  const p = Math.max(1, Math.floor(page) || 1)
  if (provider === 'gitlab') {
    return `${root}/api/v4/projects?membership=true&per_page=${REPO_PAGE_SIZE}&page=${p}`
  }
  if (provider === 'gitea') {
    return `${root}/user/repos?limit=${REPO_PAGE_SIZE}&page=${p}`
  }
  return `${root}/user/repos?per_page=${REPO_PAGE_SIZE}&page=${p}&affiliation=owner,collaborator,organization_member`
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return ''
}

function mapAccountRepo(provider: ProviderId, raw: any): AccountRepoInfo | null {
  if (!raw || typeof raw !== 'object') return null
  if (provider === 'gitlab') {
    const path = pickString(raw.path_with_namespace)
    if (!path) return null
    const segments = path.split('/')
    const name = pickString(raw.name) || segments[segments.length - 1] || ''
    const owner = segments.slice(0, -1).join('/')
    return {
      fullName: path,
      name,
      owner,
      url: pickString(raw.http_url_to_repo, raw.ssh_url_to_repo, raw.web_url),
      private: raw.visibility === 'private',
      defaultBranch: pickString(raw.default_branch) || 'main',
    }
  }
  // GitHub / Gitea 字段结构接近。
  const fullName = pickString(raw.full_name)
  if (!fullName) return null
  const segments = fullName.split('/')
  return {
    fullName,
    name: pickString(raw.name) || segments[segments.length - 1] || '',
    owner: pickString(raw.owner?.login, raw.owner?.username, raw.namespace?.login) || segments.slice(0, -1).join('/'),
    url: pickString(raw.clone_url, raw.http_url_to_repo, raw.ssh_url, raw.web_url),
    private: raw.private === true || raw.visibility === 'private',
    defaultBranch: pickString(raw.default_branch) || 'main',
  }
}

/**
 * 列出某账号可见的全部远程仓库。
 * 任何失败都返回 `{ok:false,error}`（可读中文），绝不抛异常、绝不回显令牌。
 */
export async function listAccountRepos(
  provider: ProviderId,
  token: string,
  apiBase?: string,
  host?: string,
): Promise<{ ok: boolean; repos: AccountRepoInfo[]; error?: string; truncated?: boolean }> {
  if (typeof token !== 'string' || token.trim().length === 0) {
    return { ok: false, repos: [], error: '令牌为空' }
  }
  const base = resolveApiBase(provider, apiBase, host)
  if (!base) return { ok: false, repos: [], error: '该平台需要填写 API 地址（例如 https://git.example.com/api/v1）' }

  const repos: AccountRepoInfo[] = []
  const seen = new Set<string>()
  let truncated = false
  for (let page = 1; page <= REPO_MAX_PAGES; page += 1) {
    const result = await request(accountReposEndpoint(provider, base, page), { token })
    // 第一页失败才算失败；后续页失败就用已拿到的结果（不把整次列表判死）。
    if (!result.ok) {
      if (page === 1) return { ok: false, repos: [], error: result.error || '读取仓库列表失败' }
      truncated = true
      break
    }
    const list = Array.isArray(result.json) ? result.json : []
    for (const item of list) {
      const mapped = mapAccountRepo(provider, item)
      if (!mapped) continue
      if (seen.has(mapped.fullName)) continue
      seen.add(mapped.fullName)
      repos.push(mapped)
    }
    // 不满一页说明已到末页。
    if (list.length < REPO_PAGE_SIZE) {
      truncated = false
      break
    }
    // 满页且已到页数上限 → 明确告知调用方还有更多。
    if (page === REPO_MAX_PAGES) truncated = true
  }
  return { ok: true, repos, truncated }
}
