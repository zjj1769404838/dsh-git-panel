import { randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { PanelStore } from './store.js'
import { readRepoChanges, readRepoStatus } from './git.js'
import {
  readBranches,
  readCommitDetail,
  readCommits,
  readDiff,
  readRemotes,
  readStashes,
  readTags,
} from './git-ops.js'
import {
  listAccountRepos,
  pollDeviceFlow,
  startDeviceFlow,
  verifyToken,
} from './providers.js'
import { configureNpmToken, npmConfigView, npmTokenFromNpmrc, whoamiNpm } from './npm.js'
import { redact } from './vault.js'

export const ROUTE_PREFIX = '/dsh-git-panel'
const MAX_BODY_BYTES = 256 * 1024

interface JsonBody {
  [key: string]: unknown
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = Buffer.from(JSON.stringify(body), 'utf8')
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('content-length', String(payload.length))
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(payload)
}

/** 同源校验：拒绝跨站页面调用本地接口（携带副作用）。 */
export function isSameOrigin(req: IncomingMessage): boolean {
  const site = req.headers['sec-fetch-site']
  if (typeof site === 'string' && site.toLowerCase() === 'cross-site') return false
  const origin = req.headers.origin
  const host = req.headers.host
  if (typeof origin === 'string' && origin.length > 0) {
    if (typeof host !== 'string' || host.length === 0) return false
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }
  return true
}

function readBody(req: IncomingMessage): Promise<{ ok: boolean; body?: JsonBody; error?: string }> {
  return new Promise((resolve) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        req.destroy()
        resolve({ ok: false, error: `请求体超过上限（${MAX_BODY_BYTES} 字节）` })
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim()
      if (text.length === 0) {
        resolve({ ok: true, body: {} })
        return
      }
      try {
        const parsed = JSON.parse(text)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          resolve({ ok: false, error: '请求体必须是 JSON 对象' })
          return
        }
        resolve({ ok: true, body: parsed as JsonBody })
      } catch {
        resolve({ ok: false, error: '请求体不是合法 JSON' })
      }
    })
    req.on('error', () => resolve({ ok: false, error: '读取请求体失败' }))
  })
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export interface HandlerDeps {
  store: PanelStore
  version: string
  log?: (level: string, message: string) => void
  startedAt?: number
}

interface PendingFlow {
  clientId: string
  deviceCode: string
  createdAt: number
}

/** 进行中的设备码授权（pollKey → 流程），一次性消费，20 分钟过期。 */
const pendingFlows = new Map<string, PendingFlow>()

/**
 * 插件 HTTP 接口（v3 极简化）。全部端点都在 `${ROUTE_PREFIX}/...` 下，供 client 半边调用。
 * 约定：只读 + 账号管理；写操作不在此通道（由 Agent 经 git_write/git_confirm 工具执行）。
 * 永不返回明文令牌；错误一律 `{ ok:false, error }`。
 */
export function createHandler(deps: HandlerDeps) {
  const startedAt = deps.startedAt ?? Date.now()

  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = (req.method ?? 'GET').toUpperCase()
    const url = new URL(req.url ?? '/', 'http://dsh.internal')
    const path = url.pathname.startsWith(ROUTE_PREFIX) ? url.pathname.slice(ROUTE_PREFIX.length) || '/' : url.pathname

    try {
      // 同源闸门：跨站页面不得借道本地接口读写（GET 也拒——状态探测本身可经 DOM 侧信道完成，不值得开口子）。
      if (!isSameOrigin(req)) {
        sendJson(res, 403, { ok: false, error: '拒绝跨站请求' })
        return
      }

      // ---- 只读 GET ----
      if (method === 'GET') {
        if (path === '/health') {
          sendJson(res, 200, { ok: true, version: deps.version, startedAt })
          return
        }
        if (path === '/state') {
          sendJson(res, 200, { ok: true, state: deps.store.snapshot() })
          return
        }
        if (path === '/repo/status') {
          const cwd = str(url.searchParams.get('cwd')).trim()
          if (!cwd) {
            sendJson(res, 400, { ok: false, error: '缺少 cwd 参数', status: null })
            return
          }
          const status = await readRepoStatus(cwd)
          sendJson(res, 200, { ok: true, status: { ...status, authorized: true } })
          return
        }
        if (path === '/repo/changes') {
          const cwd = str(url.searchParams.get('cwd')).trim()
          if (!cwd) {
            sendJson(res, 400, { ok: false, error: '缺少 cwd 参数', changes: null })
            return
          }
          const changes = await readRepoChanges(cwd)
          sendJson(res, 200, { ok: true, changes })
          return
        }

        /** 读端点统一闸门：目录闸门已随白名单移除（v3.3 拍板：本地目录默认可读），只校验 cwd。 */
        const requireRead = (errorPayload: Record<string, unknown>): string | null => {
          const dir = str(url.searchParams.get('cwd')).trim()
          if (!dir) {
            sendJson(res, 400, { ok: false, error: '缺少 cwd 参数', ...errorPayload })
            return null
          }
          return dir
        }

        if (path === '/repo/branches') {
          const dir = requireRead({ branches: [], current: '' })
          if (!dir) return
          const result = await readBranches(dir)
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error, branches: [], current: '' })
            return
          }
          sendJson(res, 200, { ok: true, root: result.root, current: result.current, branches: result.branches })
          return
        }
        if (path === '/repo/remotes') {
          const dir = requireRead({ remotes: [] })
          if (!dir) return
          const result = await readRemotes(dir)
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error, remotes: [] })
            return
          }
          sendJson(res, 200, { ok: true, root: result.root, remotes: result.remotes, upstream: result.upstream })
          return
        }
        if (path === '/repo/commits') {
          const dir = requireRead({ commits: [] })
          if (!dir) return
          const limit = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
          const offset = Number.parseInt(url.searchParams.get('offset') ?? '', 10)
          const ref = str(url.searchParams.get('ref')).trim()
          const search = str(url.searchParams.get('search')).trim()
          const result = await readCommits(
            dir,
            Number.isFinite(limit) ? limit : 30,
            Number.isFinite(offset) ? offset : 0,
            ref || undefined,
            search || undefined,
          )
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error, commits: [] })
            return
          }
          sendJson(res, 200, { ok: true, root: result.root, commits: result.commits, truncated: result.truncated })
          return
        }
        if (path === '/repo/tags') {
          const dir = requireRead({ tags: [] })
          if (!dir) return
          const result = await readTags(dir)
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error, tags: [] })
            return
          }
          sendJson(res, 200, { ok: true, root: result.root, tags: result.tags })
          return
        }
        if (path === '/repo/stash') {
          const dir = requireRead({ stashes: [] })
          if (!dir) return
          const result = await readStashes(dir)
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error, stashes: [] })
            return
          }
          sendJson(res, 200, { ok: true, root: result.root, stashes: result.stashes })
          return
        }
        if (path === '/repo/commit') {
          const rev = str(url.searchParams.get('rev')).trim()
          const dir = requireRead({ commit: null, files: [], diff: '' })
          if (!dir) return
          const result = await readCommitDetail(dir, rev)
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error, commit: null, files: [], diff: '' })
            return
          }
          sendJson(res, 200, {
            ok: true,
            root: result.root,
            commit: result.commit,
            files: result.files,
            diff: result.diff,
            diffTruncated: result.diffTruncated,
          })
          return
        }
        if (path === '/repo/diff') {
          const dir = requireRead({ diff: '' })
          if (!dir) return
          const modeRaw = str(url.searchParams.get('mode')).trim()
          const mode = modeRaw === 'staged' || modeRaw === 'commit' ? modeRaw : 'worktree'
          const result = await readDiff(
            dir,
            mode,
            str(url.searchParams.get('path')).trim(),
            str(url.searchParams.get('rev')).trim(),
          )
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error, diff: '', truncated: false, totalLines: 0 })
            return
          }
          sendJson(res, 200, {
            ok: true,
            root: result.root,
            diff: result.diff,
            truncated: result.truncated,
            totalLines: result.totalLines,
          })
          return
        }
        // 账号下的远程仓库列表（只读，供账号卡展示）。
        if (path === '/account/repos') {
          const accountId = str(url.searchParams.get('accountId')).trim()
          const account = accountId ? deps.store.getAccount(accountId) : deps.store.activeAccount()
          if (!account) {
            sendJson(res, 200, { ok: false, error: accountId ? '账号不存在' : '尚未连接 Git 账号', repos: [] })
            return
          }
          const token = deps.store.revealSecret(account.id)
          if (!token) {
            deps.store.markAccount(account.id, { status: 'error', lastError: '凭据无法解密' })
            sendJson(res, 200, { ok: false, error: '凭据无法解密，请重新授权', repos: [] })
            return
          }
          const result = await listAccountRepos(token)
          if (!result.ok) {
            sendJson(res, 200, { ok: false, error: result.error ?? '读取仓库列表失败', repos: [] })
            return
          }
          sendJson(res, 200, { ok: true, repos: result.repos, truncated: result.truncated })
          return
        }
        sendJson(res, 404, { ok: false, error: `未知接口：GET ${path}` })
        return
      }

      // ---- 账号管理 / 设置 POST ----
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, error: `不支持的方法：${method}` })
        return
      }
      const parsed = await readBody(req)
      if (!parsed.ok) {
        sendJson(res, 400, { ok: false, error: parsed.error })
        return
      }
      const body = parsed.body ?? {}

      if (path === '/pat/connect') {
        const token = str(body.token).trim()
        if (token.length === 0) {
          sendJson(res, 400, { ok: false, error: '请填写访问令牌' })
          return
        }
        const verified = await verifyToken(token)
        if (!verified.ok || !verified.identity) {
          sendJson(res, 400, { ok: false, error: verified.error ?? '令牌校验失败' })
          return
        }
        const identity = verified.identity
        if (!identity.login) {
          sendJson(res, 400, { ok: false, error: '令牌有效但无法读取账号身份（可能缺少 user 读取权限）' })
          return
        }
        const label = str(body.label).trim()
        const record = deps.store.addAccount({
          provider: 'github',
          kind: 'pat',
          login: identity.login,
          displayName: label ? `${identity.displayName || identity.login}（${label}）` : identity.displayName,
          avatarUrl: identity.avatarUrl,
          scopes: identity.scopes,
          token,
        })
        deps.log?.('info', `PAT 账号已接入：${record.login}`)
        sendJson(res, 200, { ok: true, account: { ...record, secret: '' }, state: deps.store.snapshot() })
        return
      }

      if (path === '/oauth/start') {
        const clientId = str(body.clientId).trim()
        const started = await startDeviceFlow(clientId)
        if (!started.ok || !started.flow) {
          sendJson(res, 400, { ok: false, error: started.error ?? '无法发起 OAuth 授权' })
          return
        }
        // deviceCode 不外发给页面：页面只拿到一个一次性的 pollKey。
        const pollKey = randomBytes(12).toString('hex')
        pendingFlows.set(pollKey, { clientId, deviceCode: started.flow.deviceCode, createdAt: Date.now() })
        sendJson(res, 200, {
          ok: true,
          pollKey,
          flow: {
            userCode: started.flow.userCode,
            verificationUri: started.flow.verificationUri,
            expiresIn: started.flow.expiresIn,
            interval: started.flow.interval,
          },
        })
        return
      }

      if (path === '/oauth/poll') {
        const pollKey = str(body.pollKey).trim()
        const pending = pendingFlows.get(pollKey)
        if (!pollKey || !pending) {
          sendJson(res, 400, { ok: false, status: 'expired', error: '授权流程已过期，请重新发起' })
          return
        }
        if (Date.now() - pending.createdAt > 20 * 60_000) {
          pendingFlows.delete(pollKey)
          sendJson(res, 400, { ok: false, status: 'expired', error: '授权流程已过期，请重新发起' })
          return
        }
        const result = await pollDeviceFlow(pending.clientId, pending.deviceCode)
        if (result.status === 'authorized' && result.token) {
          const verified = await verifyToken(result.token)
          if (!verified.ok || !verified.identity?.login) {
            pendingFlows.delete(pollKey)
            sendJson(res, 400, { ok: false, status: 'error', error: verified.error ?? '授权成功但读取账号身份失败' })
            return
          }
          const identity = verified.identity
          const record = deps.store.addAccount({
            provider: 'github',
            kind: 'oauth',
            login: identity.login,
            displayName: identity.displayName,
            avatarUrl: identity.avatarUrl,
            clientId: pending.clientId,
            scopes: identity.scopes,
            token: result.token,
          })
          pendingFlows.delete(pollKey)
          deps.log?.('info', `OAuth 账号已接入：${record.login}`)
          sendJson(res, 200, { ok: true, status: 'authorized', account: { ...record, secret: '' }, state: deps.store.snapshot() })
          return
        }
        if (result.status === 'denied' || result.status === 'expired' || result.status === 'error') {
          pendingFlows.delete(pollKey)
        }
        sendJson(res, 200, { ok: true, status: result.status, error: result.error ?? '', retryAfter: result.retryAfter ?? 0 })
        return
      }

      if (path === '/accounts/remove') {
        const id = str(body.id).trim()
        if (!id) {
          sendJson(res, 400, { ok: false, error: '缺少账号 id' })
          return
        }
        const removed = deps.store.removeAccount(id)
        deps.log?.('info', `账号已断开：${id}`)
        sendJson(res, 200, { ok: removed, error: removed ? undefined : '账号不存在', state: deps.store.snapshot() })
        return
      }

      if (path === '/accounts/recheck') {
        const id = str(body.id).trim()
        const account = deps.store.getAccount(id)
        if (!account) {
          sendJson(res, 404, { ok: false, error: '账号不存在' })
          return
        }
        const token = deps.store.revealSecret(id)
        if (!token) {
          deps.store.markAccount(id, { status: 'error', lastError: '凭据无法解密' })
          sendJson(res, 400, { ok: false, error: '凭据无法解密，请重新授权', state: deps.store.snapshot() })
          return
        }
        const verified = await verifyToken(token)
        if (!verified.ok) {
          deps.store.markAccount(id, { status: 'expired', lastError: verified.error ?? '校验失败' })
          sendJson(res, 200, { ok: false, error: verified.error ?? '校验失败', state: deps.store.snapshot() })
          return
        }
        deps.store.markAccount(id, {
          status: 'connected',
          lastError: '',
          login: verified.identity?.login || account.login,
          displayName: verified.identity?.displayName || account.displayName,
          scopes: verified.identity?.scopes?.length ? verified.identity.scopes : account.scopes,
        })
        sendJson(res, 200, { ok: true, state: deps.store.snapshot() })
        return
      }

      // ---- npm 发布凭据（发布走 AI 执行，npm 凭据配进 npm 官方存储位置 ~/.npmrc）----
      // 连接：验证 token → 写入 ~/.npmrc 的官方源 authToken 行（等同 npm login 效果）。
      if (path === '/npm/connect') {
        const token = str(body.token).trim()
        if (token.length === 0) {
          sendJson(res, 400, { ok: false, error: '请填写 npm token' })
          return
        }
        const identity = await whoamiNpm(token)
        if (!identity.ok || !identity.username) {
          sendJson(res, 400, { ok: false, error: identity.error ?? 'token 验证失败' })
          return
        }
        const written = configureNpmToken(token)
        if (!written.ok) {
          sendJson(res, 500, { ok: false, error: written.error ?? '写入失败' })
          return
        }
        deps.log?.('info', `npm 凭据已配置：${identity.username}（写入 ~/.npmrc 官方源 authToken 行）`)
        sendJson(res, 200, { ok: true, username: identity.username, npm: npmConfigView() })
        return
      }
      // 状态查询：界面只拿掩码；whoami 验真在服务端内部用明文 token，不外泄。
      if (path === '/npm/status') {
        const view = npmConfigView()
        if (view.configured) {
          const identity = await whoamiNpm(npmTokenFromNpmrc())
          sendJson(res, 200, {
            ok: true,
            npm: { configured: true, masked: view.masked, username: identity.ok ? identity.username : '', status: identity.ok ? 'connected' : 'error', error: identity.ok ? '' : identity.error ?? '' },
          })
          return
        }
        sendJson(res, 200, { ok: true, npm: { configured: false, masked: '', username: '', status: 'none', error: '' } })
        return
      }

      if (path === '/settings') {
        const patch: Record<string, unknown> = {}
        if ('allowWrite' in body) patch.allowWrite = body.allowWrite === true
        if ('requireConfirm' in body) patch.requireConfirm = body.requireConfirm !== false
        if ('autoSubmit' in body) patch.autoSubmit = body.autoSubmit === true
        if ('defaultAccountId' in body) patch.defaultAccountId = str(body.defaultAccountId)
        const settings = deps.store.updateSettings(patch as never)
        sendJson(res, 200, { ok: true, settings, state: deps.store.snapshot() })
        return
      }

      // 写操作端点已随 v3 极简化移除：仓库变更一律走 Agent 工具 git_write / git_confirm。
      sendJson(res, 404, { ok: false, error: `未知接口：POST ${path}（仓库写操作请走 Agent 工具 git_write / git_confirm）` })
    } catch (error) {
      deps.log?.('error', `接口异常 ${method} ${path}：${redact(error)}`)
      sendJson(res, 500, { ok: false, error: '内部错误' })
    }
  }
}
