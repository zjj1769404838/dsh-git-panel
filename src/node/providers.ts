/**
 * GitHub 单平台接入（v3 极简化：GitLab/Gitea/自建实例与远端仓库 API 已移除）。
 * 保留能力：PAT 校验、OAuth 设备码、列仓库（供账号卡展示）。
 * 语义边界：令牌只做账号管理与展示，git 推送/拉取用本机 git 凭据体系。
 */
import { redact } from './vault.js'

export interface GitHubIdentity {
  login: string
  displayName: string
  avatarUrl: string
  scopes: string[]
}

export interface VerifyResult {
  ok: boolean
  identity?: GitHubIdentity
  error?: string
}

const API = 'https://api.github.com'

async function githubFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application+json',
      'user-agent': 'dsh-git-panel',
      ...(init.headers ?? {}),
    },
  })
}

export async function verifyToken(token: string): Promise<VerifyResult> {
  try {
    const res = await githubFetch('/user', token)
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: res.status === 401 ? '令牌无效或已撤销' : '令牌被 GitHub 拒绝（可能缺少 user 读取权限）' }
    }
    if (!res.ok) return { ok: false, error: `GitHub 返回 ${res.status}` }
    const data = (await res.json()) as Record<string, any>
    const scopesRes = await fetch(`${API}/`, { headers: { authorization: `Bearer ${token}`, accept: 'application+json' } })
    const scopes = (scopesRes.headers.get('x-oauth-scopes') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    return {
      ok: true,
      identity: {
        login: String(data.login ?? ''),
        displayName: String(data.name || data.login || ''),
        avatarUrl: String(data.avatar_url ?? ''),
        scopes,
      },
    }
  } catch (error) {
    return { ok: false, error: `网络错误：${redact(error)}` }
  }
}

export interface AccountRepo {
  fullName: string
  description: string
  private: boolean
  defaultBranch: string
  pushedAt: string
}

export async function listAccountRepos(token: string): Promise<{ ok: boolean; repos: AccountRepo[]; truncated: boolean; error?: string }> {
  try {
    const res = await githubFetch('/user/repos?per_page=100&sort=pushed', token)
    if (!res.ok) return { ok: false, repos: [], truncated: false, error: `GitHub 返回 ${res.status}` }
    const list = (await res.json()) as Record<string, any>[]
    const repos = list.slice(0, 100).map((item) => ({
      fullName: String(item.full_name ?? ''),
      description: String(item.description ?? ''),
      private: item.private === true,
      defaultBranch: String(item.default_branch ?? ''),
      pushedAt: String(item.pushed_at ?? ''),
    }))
    return { ok: true, repos, truncated: list.length >= 100 }
  } catch (error) {
    return { ok: false, repos: [], truncated: false, error: `网络错误：${redact(error)}` }
  }
}

// ─── OAuth 设备码流程 ───
// 沿用原插件的既有决定：本插件不内置任何第三方 OAuth 应用凭据，
// client_id 由用户在连接账号时自填（需自建一个 GitHub OAuth App）。

export interface DeviceFlowStart {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export async function startDeviceFlow(clientId: string): Promise<{ ok: boolean; flow?: DeviceFlowStart; error?: string }> {
  if (!clientId.trim()) return { ok: false, error: '缺少 OAuth App 的 Client ID（需自建后填入，本插件不内置任何应用凭据）' }
  try {
    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ client_id: clientId.trim(), scope: 'repo read:user' }).toString(),
    })
    const text = await res.text()
    const params = new URLSearchParams(text)
    if (!res.ok || !params.get('device_code')) {
      return { ok: false, error: `发起授权失败（HTTP ${res.status}）：${params.get('error') ?? text.slice(0, 120)}` }
    }
    return {
      ok: true,
      flow: {
        deviceCode: String(params.get('device_code')),
        userCode: String(params.get('user_code') ?? ''),
        verificationUri: String(params.get('verification_uri') ?? 'https://github.com/login/device'),
        expiresIn: Number(params.get('expires_in') ?? 900),
        interval: Number(params.get('interval') ?? 5),
      },
    }
  } catch (error) {
    return { ok: false, error: `网络错误：${redact(error)}` }
  }
}

export interface DeviceFlowPoll {
  status: 'authorized' | 'pending' | 'denied' | 'expired' | 'error'
  token?: string
  error?: string
  retryAfter?: number
}

export async function pollDeviceFlow(clientId: string, deviceCode: string): Promise<DeviceFlowPoll> {
  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ client_id: clientId.trim(), device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }).toString(),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, any>
    if (data.access_token) return { status: 'authorized', token: String(data.access_token) }
    const err = String(data.error ?? '')
    if (err === 'authorization_pending') return { status: 'pending' }
    if (err === 'slow_down') return { status: 'pending', retryAfter: Number(data.interval ?? 10) }
    if (err === 'access_denied') return { status: 'denied', error: '你在授权页拒绝了本次授权' }
    if (err === 'expired_token') return { status: 'expired', error: '设备码已过期，请重新发起' }
    return { status: 'error', error: err || 'GitHub 返回异常' }
  } catch (error) {
    return { status: 'error', error: `网络错误：${redact(error)}` }
  }
}
