import { randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { PanelStore } from './store.js'
import { normalizeRepos, normalizeRoots } from './store.js'
import { initRepo, readRepoStatus } from './git.js'
import { readRepoGraph } from './graph.js'
import { pollDeviceFlow, PROVIDERS, providerOf, startDeviceFlow, verifyToken } from './providers.js'
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

/**
 * 插件 HTTP 接口。全部端点都在 `${ROUTE_PREFIX}/...` 下，供 client 半边调用。
 * 约定：永不返回明文令牌；错误一律 `{ ok:false, error }`。
 */
export function createHandler(deps: HandlerDeps) {
  const startedAt = deps.startedAt ?? Date.now()

  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = (req.method ?? 'GET').toUpperCase()
    const url = new URL(req.url ?? '/', 'http://dsh.internal')
    const path = url.pathname.startsWith(ROUTE_PREFIX) ? url.pathname.slice(ROUTE_PREFIX.length) || '/' : url.pathname

    try {
      if (path === '/health') {
        sendJson(res, 200, {
          status: 'ok',
          plugin: 'dsh-git-panel',
          version: deps.version,
          uptime: Math.round((Date.now() - startedAt) / 1000),
          accounts: deps.store.accounts().length,
        })
        return
      }

      // 只读端点：GET
      if (method === 'GET' && path === '/state') {
        sendJson(res, 200, { ok: true, state: deps.store.snapshot(), providers: Object.values(PROVIDERS) })
        return
      }

      if (method === 'GET' && path === '/providers') {
        sendJson(res, 200, { ok: true, providers: Object.values(PROVIDERS) })
        return
      }

      // 供 composer 状态 chip 使用：只读、无副作用，非仓库不是错误。
      if (method === 'GET' && path === '/repo/status') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        if (!cwd) {
          sendJson(res, 400, { ok: false, error: '缺少 cwd 参数', status: null })
          return
        }
        const status = await readRepoStatus(cwd)
        if (status.isRepo && !deps.store.isRootAllowed(cwd)) {
          sendJson(res, 200, {
            ok: true,
            status: {
              isRepo: true,
              root: status.root,
              branch: status.branch,
              detached: status.detached,
              head: status.head,
              ahead: 0,
              behind: 0,
              changed: status.changed,
              authorized: false,
              error: '',
            },
          })
          return
        }
        sendJson(res, 200, { ok: true, status: { ...status, authorized: true } })
        return
      }

      // 提交图（分支拓扑）：只读。未授权目录不返回图内容，只回报 authorized:false。
      if (method === 'GET' && path === '/repo/graph') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        if (!cwd) {
          sendJson(res, 400, { ok: false, error: '缺少 cwd 参数', graph: null })
          return
        }
        const graph = await readRepoGraph(cwd, url.searchParams.get('limit'))
        if (graph.isRepo && !deps.store.isRootAllowed(cwd)) {
          sendJson(res, 200, {
            ok: true,
            graph: {
              isRepo: true,
              root: graph.root,
              branch: graph.branch,
              head: graph.head,
              detached: graph.detached,
              reason: 'repo',
              error: '',
              truncated: false,
              laneCount: 0,
              rows: [],
              authorized: false,
            },
          })
          return
        }
        sendJson(res, 200, { ok: true, graph: { ...graph, authorized: true } })
        return
      }

      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, error: `不支持的请求方法：${method}` })
        return
      }

      if (!isSameOrigin(req)) {
        sendJson(res, 403, { ok: false, error: '拒绝跨站请求（同源校验未通过）' })
        return
      }

      const parsed = await readBody(req)
      if (!parsed.ok) {
        sendJson(res, 413, { ok: false, error: parsed.error })
        return
      }
      const body = parsed.body ?? {}

      // 初始化仓库：写操作，必须过同源校验 + 根目录授权闸门。
      if (path === '/repo/init') {
        const cwd = str(body.cwd).trim()
        if (!cwd) {
          sendJson(res, 400, { ok: false, error: '缺少 cwd 参数' })
          return
        }
        if (!deps.store.isRootAllowed(cwd)) {
          sendJson(res, 403, {
            ok: false,
            error: `目录不在 Agent 可操作范围内：${cwd}（已授权根目录：${deps.store.settings().allowedRoots.join('、') || '无'}）`,
          })
          return
        }
        const branch = str(body.branch).trim() || 'main'
        const result = await initRepo(cwd, branch)
        if (!result.ok) {
          sendJson(res, 400, { ok: false, error: result.error, result })
          return
        }
        deps.log?.('info', `仓库初始化：${result.root}（created=${result.created}）`)
        sendJson(res, 200, { ok: true, result })
        return
      }

      if (path === '/pat/connect') {
        const provider = providerOf(body.provider)
        const token = str(body.token).trim()
        const apiBase = str(body.apiBase).trim()
        const host = str(body.host).trim() || PROVIDERS[provider].host
        if (token.length === 0) {
          sendJson(res, 400, { ok: false, error: '请填写访问令牌' })
          return
        }
        const verified = await verifyToken(provider, token, apiBase || undefined, host)
        if (!verified.ok || !verified.identity) {
          sendJson(res, 400, { ok: false, error: verified.error ?? '令牌校验失败' })
          return
        }
        const identity = verified.identity
        if (!identity.login) {
          sendJson(res, 400, { ok: false, error: '令牌有效但无法读取账号身份（可能缺少 user:read 权限）' })
          return
        }
        const record = deps.store.addAccount({
          provider,
          kind: 'pat',
          login: identity.login,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
          host,
          apiBase,
          scopes: identity.scopes,
          token,
        })
        deps.log?.('info', `PAT 账号已接入：${record.provider}/${record.login}`)
        sendJson(res, 200, { ok: true, account: { ...record, secret: '' }, state: deps.store.snapshot() })
        return
      }

      if (path === '/oauth/start') {
        const provider = providerOf(body.provider)
        const clientId = str(body.clientId).trim()
        const scope = str(body.scope).trim() || (provider === 'gitlab' ? 'read_api read_repository' : 'repo read:user')
        const apiBase = str(body.apiBase).trim()
        const host = str(body.host).trim() || PROVIDERS[provider].host
        const started = await startDeviceFlow(provider, clientId, scope, apiBase || undefined, host)
        if (!started.ok || !started.flow) {
          sendJson(res, 400, { ok: false, error: started.error ?? '无法发起 OAuth 授权' })
          return
        }
        // deviceCode 不外发给页面：页面只拿到一个一次性的 pollKey。
        const pollKey = randomBytes(12).toString('hex')
        pendingFlows.set(pollKey, {
          provider,
          clientId,
          apiBase,
          host,
          deviceCode: started.flow.deviceCode,
          createdAt: Date.now(),
        })
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
        const provider = providerOf(pending.provider)
        const result = await pollDeviceFlow(provider, pending.clientId, pending.deviceCode, pending.apiBase || undefined, pending.host)
        if (result.status === 'authorized' && result.token) {
          const verified = await verifyToken(provider, result.token, pending.apiBase || undefined, pending.host)
          if (!verified.ok || !verified.identity?.login) {
            pendingFlows.delete(pollKey)
            sendJson(res, 400, { ok: false, status: 'error', error: verified.error ?? '授权成功但读取账号身份失败' })
            return
          }
          const identity = verified.identity
          const record = deps.store.addAccount({
            provider,
            kind: 'oauth',
            login: identity.login,
            displayName: identity.displayName,
            avatarUrl: identity.avatarUrl,
            host: pending.host || PROVIDERS[provider].host,
            apiBase: pending.apiBase,
            scopes: result.scopes && result.scopes.length > 0 ? result.scopes : identity.scopes,
            token: result.token,
          })
          pendingFlows.delete(pollKey)
          deps.log?.('info', `OAuth 账号已接入：${record.provider}/${record.login}`)
          sendJson(res, 200, { ok: true, status: 'authorized', account: { ...record, secret: '' }, state: deps.store.snapshot() })
          return
        }
        if (result.status === 'denied' || result.status === 'expired' || result.status === 'error') {
          pendingFlows.delete(pollKey)
        }
        sendJson(res, 200, {
          ok: true,
          status: result.status,
          error: result.error ?? '',
          retryAfter: result.retryAfter ?? 0,
        })
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
        const verified = await verifyToken(providerOf(account.provider), token, account.apiBase || undefined, account.host)
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

      if (path === '/settings') {
        const patch: Record<string, unknown> = {}
        if ('allowedRepos' in body) patch.allowedRepos = normalizeRepos(body.allowedRepos)
        if ('allowedRoots' in body) patch.allowedRoots = normalizeRoots(body.allowedRoots)
        if ('allowWrite' in body) patch.allowWrite = body.allowWrite === true
        if ('requireConfirm' in body) patch.requireConfirm = body.requireConfirm !== false
        if ('defaultAccountId' in body) patch.defaultAccountId = str(body.defaultAccountId)
        const settings = deps.store.updateSettings(patch as any)
        deps.log?.('info', `设置已更新：repos=${settings.allowedRepos.length} roots=${settings.allowedRoots.length} write=${settings.allowWrite}`)
        sendJson(res, 200, { ok: true, settings, state: deps.store.snapshot() })
        return
      }

      sendJson(res, 404, { ok: false, error: `未知接口：${path}` })
    } catch (error) {
      deps.log?.('error', `接口异常 ${path}：${redact(error)}`)
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: `服务内部错误：${redact(error)}` })
      else res.end()
    }
  }
}

/** OAuth 设备码的临时上下文（内存态，不落盘，含 clientId/deviceCode 但不含令牌）。 */
const pendingFlows = new Map<
  string,
  { provider: string; clientId: string; apiBase: string; host: string; deviceCode: string; createdAt: number }
>()
