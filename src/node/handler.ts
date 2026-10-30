import { randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { PanelStore } from './store.js'
import { normalizeRepos, normalizeRoots } from './store.js'
import { initRepo, readRepoChanges, readRepoStatus } from './git.js'
import { readRepoGraph } from './graph.js'
import {
  addRemote,
  checkoutBranch,
  commitStaged,
  createBranch,
  deleteBranch,
  discardPaths,
  fetchRepo,
  discoverRepos,
  hasMergeConflicts,
  openDirectory,
  parseRemoteRepo,
  pullRepo,
  pushRepo,
  readBranches,
  readCommitDetail,
  readCommits,
  readDiff,
  readRemotes,
  readStashes,
  readTags,
  removeRemote,
  renameBranch,
  stageAll,
  stagePaths,
  stashAction,
  stashSave,
  createTag,
  deleteTag,
  pushTag,
  unstagePaths,
} from './git-ops.js'
import { listDir, readTextFile } from './files.js'
import { suggestCommitMessage, type DefaultModelLike, type LlmLike } from './suggest.js'
import { pollDeviceFlow, PROVIDERS, providerOf, startDeviceFlow, verifyToken, listAccountRepos, createAccountRepo } from './providers.js'
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
  /** 宿主模型服务（软取，缺失时「生成提交信息」明确不可用）。 */
  llm?: LlmLike
  /** 宿主默认模型选择（跟随会话默认模型）。 */
  defaultModel?: DefaultModelLike
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

      // 账号下的远程仓库列表（只读）：用于选择 bootstrap 目标与设置仓库权限。
      if (method === 'GET' && path === '/account/repos') {
        const accountId = str(url.searchParams.get('accountId')).trim()
        const account = accountId ? deps.store.getAccount(accountId) : deps.store.activeAccount()
        if (!account) {
          sendJson(res, 200, {
            ok: false,
            error: accountId ? '账号不存在' : '尚未连接 Git 账号，请先在设置中连接账号',
            repos: [],
          })
          return
        }
        const token = deps.store.revealSecret(account.id)
        if (!token) {
          deps.store.markAccount(account.id, { status: 'error', lastError: '凭据无法解密' })
          sendJson(res, 200, { ok: false, error: '凭据无法解密，请重新授权', repos: [] })
          return
        }
        const result = await listAccountRepos(
          providerOf(account.provider),
          token,
          account.apiBase || undefined,
          account.host,
        )
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error ?? '读取仓库列表失败', repos: [] })
          return
        }
        // 权限档位由 node 侧唯一事实源判定（store.repoPermission），client 不再自己算一遍，
        // 避免「有表默认 full / 无表回退 allowedRepos」两处实现各自漂移。
        const repos = result.repos.map((repo) => ({
          ...repo,
          permission: deps.store.repoPermission(account.id, repo.fullName),
        }))
        sendJson(res, 200, { ok: true, repos, truncated: result.truncated === true })
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

      // 工作区改动明细：只读。未授权目录不返回任何文件名与分支名。
      if (method === 'GET' && path === '/repo/changes') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        if (!cwd) {
          sendJson(res, 400, { ok: false, error: '缺少 cwd 参数', changes: null })
          return
        }
        const changes = await readRepoChanges(cwd)
        if (changes.isRepo && !deps.store.isRootAllowed(cwd)) {
          sendJson(res, 200, {
            ok: true,
            changes: { isRepo: true, root: '', branch: '', dirty: false, files: [] },
          })
          return
        }
        sendJson(res, 200, { ok: true, changes })
        return
      }

      /** body.paths 归一成 string[]（容错非字符串项）。 */
      const pathList = (value: unknown): string[] =>
        Array.isArray(value) ? value.map((item) => String(item).trim()).filter((item) => item.length > 0) : []

      /** Git 工作台只读端点的统一闸门：目录授权（未授权 fail-closed，不泄露仓库内容）。 */
      const requireRead = (cwd: unknown, errorPayload: Record<string, unknown>): string | null => {
        const dir = str(cwd).trim()
        if (!dir) {
          sendJson(res, 400, { ok: false, error: '缺少 cwd 参数', ...errorPayload })
          return null
        }
        if (!deps.store.isRootAllowed(dir)) {
          sendJson(res, 403, {
            ok: false,
            error: `目录不在可读范围内：${dir}（已授权根目录：${deps.store.settings().allowedRoots.join('、') || '无'}）`,
            ...errorPayload,
          })
          return null
        }
        return dir
      }

      // ---- Git 工作台（IDEA 式面板）只读端点：GET，放在 405 判断之前。 ----

      // 分支列表（本地 + 远端 + 跟踪关系）：只读，未授权 fail-closed。
      if (method === 'GET' && path === '/repo/branches') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        const dir = requireRead(cwd, { branches: [], current: '' })
        if (!dir) return
        const result = await readBranches(dir)
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, branches: [], current: '' })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root, current: result.current, branches: result.branches })
        return
      }

      // 远程仓库列表 + 当前 upstream：只读。
      if (method === 'GET' && path === '/repo/remotes') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        const dir = requireRead(cwd, { remotes: [] })
        if (!dir) return
        const result = await readRemotes(dir)
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, remotes: [] })
          return
        }
        sendJson(res, 200, {
          ok: true,
          root: result.root,
          remotes: result.remotes,
          upstream: result.upstream,
          upstreamRemote: result.upstreamRemote,
        })
        return
      }

      // 提交历史：只读，limit/offset 分页；可选 ref（分支/标签/提交号）限定历史范围；
      // 可选 search 走 git --grep（服务端过滤，配合「加载更多」才能翻到旧提交）。
      if (method === 'GET' && path === '/repo/commits') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        const dir = requireRead(cwd, { commits: [] })
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

      // 标签列表：只读。
      if (method === 'GET' && path === '/repo/tags') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        const dir = requireRead(cwd, { tags: [] })
        if (!dir) return
        const result = await readTags(dir)
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, tags: [] })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root, tags: result.tags })
        return
      }

      // 贮藏列表：只读。
      if (method === 'GET' && path === '/repo/stash') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        const dir = requireRead(cwd, { stashes: [] })
        if (!dir) return
        const result = await readStashes(dir)
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, stashes: [] })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root, stashes: result.stashes })
        return
      }

      // 文件浏览：列目录（懒加载，界面按层调用）。
      if (method === 'GET' && path === '/repo/tree') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        const dir = requireRead(cwd, { entries: [] })
        if (!dir) return
        const result = await listDir(dir, str(url.searchParams.get('path')).trim())
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, entries: [] })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root, path: result.path, entries: result.entries, truncated: result.truncated })
        return
      }

      // 文件浏览：读单个文件（文本，二进制判定 + 截断）。
      if (method === 'GET' && path === '/repo/file') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        const dir = requireRead(cwd, { content: '' })
        if (!dir) return
        const result = await readTextFile(dir, str(url.searchParams.get('path')).trim())
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, content: '' })
          return
        }
        sendJson(res, 200, {
          ok: true,
          root: result.root,
          path: result.path,
          content: result.content,
          size: result.size,
          truncated: result.truncated,
          binary: result.binary,
          lang: result.lang,
        })
        return
      }

      // 单个提交详情（元信息 + 文件表 + diff）：只读。
      if (method === 'GET' && path === '/repo/commit') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        const rev = str(url.searchParams.get('rev')).trim()
        const dir = requireRead(cwd, { commit: null, files: [], diff: '' })
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

      // diff 预览：mode=worktree（未暂存）| staged（已暂存）| commit。
      if (method === 'GET' && path === '/repo/diff') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        const dir = requireRead(cwd, { diff: '' })
        if (!dir) return
        const modeRaw = str(url.searchParams.get('mode')).trim()
        const mode = modeRaw === 'staged' || modeRaw === 'commit' ? modeRaw : 'worktree'
        const result = await readDiff(dir, mode, str(url.searchParams.get('path')).trim(), str(url.searchParams.get('rev')).trim())
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, diff: '', truncated: false, totalLines: 0 })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root, diff: result.diff, truncated: result.truncated, totalLines: result.totalLines })
        return
      }

      // 打开项目目录（系统文件管理器）：带授权闸门，不泄露未授权目录。
      // 「仓库范围」页：扫描已授权根下的本地仓库（远程 remotes 一并返回）。
      // `*` 根跳过——不扫全机。
      if (method === 'GET' && path === '/repo/discover') {
        const settings = deps.store.snapshot().settings
        const roots = settings.allowedRoots.filter((root) => root !== '*')
        const repos = await discoverRepos(roots)
        sendJson(res, 200, { ok: true, repos })
        return
      }

      // 打开项目目录（系统文件管理器）：带授权闸门，不泄露未授权目录。
      if (method === 'GET' && path === '/repo/open') {
        const cwd = str(url.searchParams.get('cwd')).trim()
        const dir = requireRead(cwd, {})
        if (!dir) return
        const result = await openDirectory(dir)
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root })
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

      /** Git 工作台写端点的统一闸门：目录授权 → allowWrite。失败时已写响应并返回 null。 */
      const requireWrite = (cwd: unknown): string | null => {
        const dir = str(cwd).trim()
        if (!dir) {
          sendJson(res, 400, { ok: false, error: '缺少 cwd 参数' })
          return null
        }
        if (!deps.store.isRootAllowed(dir)) {
          sendJson(res, 403, {
            ok: false,
            error: `目录不在 Agent 可操作范围内：${dir}（已授权根目录：${deps.store.settings().allowedRoots.join('、') || '无'}）`,
          })
          return null
        }
        if (!deps.store.settings().allowWrite) {
          sendJson(res, 403, { ok: false, error: '当前未开启写操作权限：请在 DSH 设置 → Git → 仓库范围里打开「允许修改仓库」' })
          return null
        }
        return dir
      }

      /**
       * 远端写端点的「归属授权」闸门：确认目标远端仓库在该账号下可写。
       * - 显式给了 accountId 但账号不存在 → 403（fail-closed）。
       * - 一个账号都没有 → 放行（没有凭据归属可言），只记一条 warn。
       * - 目标仓库解析不出（本地路径 remote 等）→ 放行，记 warn。
       * - 解析成功但该账号对该仓库非 full → 403。
       * 失败时已写响应并返回 false。
       */
      const requireRemoteWritable = async (
        cwd: string,
        payload: JsonBody,
        url: string,
      ): Promise<boolean> => {
        const requestedId = str(payload.accountId).trim()
        const account = requestedId
          ? deps.store.getAccount(requestedId)
          : deps.store.activeAccount()
        if (requestedId && !account) {
          sendJson(res, 403, { ok: false, error: '账号不存在' })
          return false
        }
        if (!account) {
          deps.log?.('warn', `远端操作未绑定账号（跳过归属校验）：${url}`)
          return true
        }
        const repoKey = parseRemoteRepo(url)
        if (!repoKey) {
          deps.log?.('warn', `远端地址无法解析为 owner/repo（跳过归属校验）：${url}`)
          return true
        }
        if (!deps.store.isRepoWritableFor(account.id, repoKey)) {
          sendJson(res, 403, {
            ok: false,
            error: `目标远程仓库 ${repoKey} 未授权写入`,
          })
          return false
        }
        return true
      }

      // ---- Git 工作台（IDEA 式面板）写端点：POST，统一走 requireWrite 闸门。 ----
      // 暂存文件。
      if (path === '/repo/stage') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const result = await stagePaths(cwd, pathList(body.paths))
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root })
        return
      }

      // 取消暂存。
      if (path === '/repo/unstage') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const result = await unstagePaths(cwd, pathList(body.paths))
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root })
        return
      }

      // 丢弃未提交改动（破坏性）：必须显式 confirmed:true，否则拒绝执行。
      if (path === '/repo/discard') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        if (body.confirmed !== true) {
          sendJson(res, 400, { ok: false, error: '丢弃改动是破坏性操作：需要 confirmed:true 才能执行' })
          return
        }
        const result = await discardPaths(cwd, pathList(body.paths))
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root })
        return
      }

      // 提交暂存区（message + amend）。
      if (path === '/repo/commit') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const result = await commitStaged(cwd, str(body.message), body.amend === true)
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error, output: result.output })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root, hash: result.hash, output: result.output })
        return
      }

      // 生成提交信息草稿（AI）：只读仓库内容，不暂存不提交，结果由用户确认后再走 /repo/commit。
      if (path === '/repo/suggest-message') {
        const dir = requireRead(body.cwd, { message: '', source: 'none' })
        if (!dir) return
        const result = await suggestCommitMessage(
          { llm: deps.llm, defaultModel: deps.defaultModel, log: deps.log },
          dir,
          str(body.hint),
        )
        sendJson(res, 200, {
          ok: result.ok,
          error: result.error,
          message: result.message,
          source: result.source,
          provider: result.provider,
          model: result.model,
        })
        return
      }

      // 新建分支（可选立即切换）。
      if (path === '/repo/branches/create') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const result = await createBranch(cwd, str(body.name), str(body.startPoint), body.checkout !== false)
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root, output: result.output })
        return
      }

      // 切换分支。
      if (path === '/repo/branches/checkout') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const result = await checkoutBranch(cwd, str(body.name))
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root, output: result.output })
        return
      }

      // 删除分支（force=true 强删未合并分支）。
      if (path === '/repo/branches/delete') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const result = await deleteBranch(cwd, str(body.name), body.force === true)
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root, output: result.output })
        return
      }

      // 重命名分支。
      if (path === '/repo/branches/rename') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const result = await renameBranch(cwd, str(body.name), str(body.newName))
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root, output: result.output })
        return
      }

      /** 取 remote 名称（兼容 remote / remoteName 两种入参）。 */
      const remoteNameOf = (payload: JsonBody): string => {
        const explicit = str(payload.remoteName).trim()
        if (explicit) return explicit
        const legacy = str(payload.remote).trim()
        return legacy
      }

      /**
       * 取目标远端 URL 列表：给定 remote 名则取该条；未给则取全部 remote。
       * remote 不存在时返回空数组（后续 push/fetch 自己报 missingConfig）。
       */
      const remoteUrlsOf = async (cwd: string, name: string): Promise<string[]> => {
        const result = await readRemotes(cwd)
        if (!result.ok) return []
        if (name.length === 0) return result.remotes.map((item) => item.url)
        const hit = result.remotes.find((item) => item.name === name)
        return hit ? [hit.url] : []
      }

      // fetch（安全：只下载不合并）。
      if (path === '/repo/fetch') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const remoteName = remoteNameOf(body)
        for (const url of await remoteUrlsOf(cwd, remoteName)) {
          if (!(await requireRemoteWritable(cwd, body, url))) return
        }
        const result = await fetchRepo(cwd, str(body.remote))
        sendJson(res, 200, {
          ok: result.ok,
          error: result.error,
          output: result.output,
          conflicted: result.conflicted,
          rejected: result.rejected,
          missingConfig: result.missingConfig,
        })
        return
      }

      // pull（merge / rebase 策略二选一）。
      if (path === '/repo/pull') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const remoteName = remoteNameOf(body)
        for (const url of await remoteUrlsOf(cwd, remoteName)) {
          if (!(await requireRemoteWritable(cwd, body, url))) return
        }
        const strategy = body.strategy === 'rebase' ? 'rebase' : 'merge'
        const result = await pullRepo(cwd, str(body.remote), str(body.branch), strategy)
        sendJson(res, 200, {
          ok: result.ok,
          error: result.error,
          output: result.output,
          conflicted: result.conflicted,
          rejected: result.rejected,
          missingConfig: result.missingConfig,
        })
        return
      }

      // push（setUpstream / force-with-lease / tags）。
      if (path === '/repo/push') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const targetRemote = remoteNameOf(body)
        // 未指定 remote 时 push 自身会报「缺少 remote 名称」，不阻塞也不放行到真实远端。
        if (targetRemote.length > 0) {
          for (const url of await remoteUrlsOf(cwd, targetRemote)) {
            if (!(await requireRemoteWritable(cwd, body, url))) return
          }
        }
        const options = (typeof body === 'object' && body !== null ? body : {}) as { force?: unknown; setUpstream?: unknown; tags?: unknown }
        const result = await pushRepo(cwd, str(body.remote), str(body.branch), {
          force: options.force === true,
          setUpstream: options.setUpstream === true,
          tags: options.tags === true,
        })
        sendJson(res, 200, {
          ok: result.ok,
          error: result.error,
          output: result.output,
          conflicted: result.conflicted,
          rejected: result.rejected,
          missingConfig: result.missingConfig,
        })
        return
      }

      // 远程仓库：添加。
      if (path === '/repo/remotes/add') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const targetUrl = str(body.url)
        if (!(await requireRemoteWritable(cwd, body, targetUrl))) return
        const result = await addRemote(cwd, str(body.name), targetUrl)
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root })
        return
      }

      // 远程仓库：移除。
      if (path === '/repo/remotes/remove') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const result = await removeRemote(cwd, str(body.name))
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root })
        return
      }

      // 冲突状态检测：供面板在 pull/merge 之后轮询。
      if (path === '/repo/conflicts') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const conflicted = await hasMergeConflicts(cwd)
        sendJson(res, 200, { ok: true, conflicted })
        return
      }

      // ---- 标签（tag）写端点 ----
      // 新建标签：轻量 / 附注（给 message 即附注）。
      if (path === '/repo/tags/create') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const result = await createTag(cwd, str(body.name), str(body.ref), str(body.message))
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root })
        return
      }

      // 删除本地标签。
      if (path === '/repo/tags/delete') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const result = await deleteTag(cwd, str(body.name))
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root })
        return
      }

      // 推送标签：属于远端写操作，过归属授权闸门。
      if (path === '/repo/tags/push') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const targetRemote = str(body.remote).trim() || 'origin'
        for (const url of await remoteUrlsOf(cwd, targetRemote)) {
          if (!(await requireRemoteWritable(cwd, body, url))) return
        }
        const result = await pushTag(cwd, targetRemote, str(body.name))
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root })
        return
      }

      // ---- 贮藏（stash）写端点 ----
      if (path === '/repo/stash/save') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const result = await stashSave(cwd, str(body.message), body.includeUntracked === true)
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root })
        return
      }

      // pop / apply / drop 共用一个端点，action 白名单校验。
      if (path === '/repo/stash/action') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const action = str(body.action).trim()
        if (action !== 'pop' && action !== 'apply' && action !== 'drop') {
          sendJson(res, 400, { ok: false, error: `不支持的贮藏操作：${action || '(空)'}` })
          return
        }
        const result = await stashAction(cwd, action, body.index)
        if (!result.ok) {
          sendJson(res, 200, { ok: false, error: result.error })
          return
        }
        sendJson(res, 200, { ok: true, root: result.root })
        return
      }

      // 初始化仓库：写操作，必须过同源校验 + requireWrite 闸门（根目录授权 + 允许写）。
      if (path === '/repo/init') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
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

      // 一键初始化：本地仓库 + 远程 origin + 分支 + 可选首次提交。
      if (path === '/repo/bootstrap') {
        const cwd = requireWrite(body.cwd)
        if (!cwd) return
        const steps: string[] = []

        // 1) 账号校验：必须存在且凭据可解。
        const accountId = str(body.accountId).trim()
        const account = accountId ? deps.store.getAccount(accountId) : deps.store.activeAccount()
        if (!account) {
          sendJson(res, 200, { ok: false, error: accountId ? '账号不存在' : '尚未连接 Git 账号，请先在设置中连接账号' })
          return
        }
        const token = deps.store.revealSecret(account.id)
        if (!token) {
          deps.store.markAccount(account.id, { status: 'error', lastError: '凭据无法解密' })
          sendJson(res, 200, { ok: false, error: '凭据无法解密，请重新授权' })
          return
        }

        // 2) 解析远程目标。
        const remoteMode = body.remoteMode === 'existing' ? 'existing' : 'new'
        let remoteUrl = str(body.remoteUrl).trim()
        const repoFullName = str(body.repoFullName).trim()
        if (remoteMode === 'existing') {
          if (!repoFullName) {
            sendJson(res, 200, { ok: false, error: '请选择要使用的远程仓库' })
            return
          }
          if (!remoteUrl) {
            const listed = await listAccountRepos(
              providerOf(account.provider),
              token,
              account.apiBase || undefined,
              account.host,
            )
            if (!listed.ok) {
              sendJson(res, 200, { ok: false, error: listed.error ?? '读取远程仓库列表失败' })
              return
            }
            const hit = listed.repos.find((item) => item.fullName.toLowerCase() === repoFullName.toLowerCase())
            if (!hit) {
              sendJson(res, 200, { ok: false, error: `未在该账号的远程仓库中找到 ${repoFullName}` })
              return
            }
            remoteUrl = hit.url
          }
        } else if (!remoteUrl) {
          sendJson(res, 200, { ok: false, error: '请填写远程仓库地址' })
          return
        }

        // 3) 远端归属授权（fail-closed）：解析得出 owner/repo 时必须对该账号可写。
        const repoKey = parseRemoteRepo(remoteUrl)
        if (repoKey && !deps.store.isRepoWritableFor(account.id, repoKey)) {
          sendJson(res, 403, { ok: false, error: `远程仓库 ${repoKey} 未授权写入` })
          return
        }

        // 4) 初始化本地仓库。
        const branchName = str(body.branchName).trim() || 'main'
        let root = cwd
        const status = await readRepoStatus(cwd)
        if (!status.isRepo) {
          const init = await initRepo(cwd, branchName)
          if (!init.ok) {
            sendJson(res, 200, { ok: false, error: init.error ?? '初始化本地仓库失败' })
            return
          }
          root = init.root
          steps.push('已初始化本地仓库')
        } else {
          root = status.root
        }

        // 5) 远程 origin：已存在且指向不同地址时不静默覆盖。
        const remotes = await readRemotes(root)
        const origin = remotes.ok ? remotes.remotes.find((item) => item.name === 'origin') : undefined
        if (origin) {
          if (origin.url !== remoteUrl) {
            sendJson(res, 200, { ok: false, error: 'origin 已存在且指向不同地址' })
            return
          }
          steps.push('已存在远程 origin')
        } else {
          const added = await addRemote(root, 'origin', remoteUrl)
          if (!added.ok) {
            sendJson(res, 200, { ok: false, error: added.error ?? '添加远程 origin 失败' })
            return
          }
          steps.push('已添加远程 origin')
        }

        // 6) 分支：new = 新建并切换；existing = 直接切换（分支不存在则报错）。
        // 「新建分支」撞名时降级为「切换到已存在分支」——git init -b 已建同名分支，直接创建会失败。
        const branchMode = body.branchMode === 'existing' ? 'existing' : 'new'
        let branch = branchName
        const branchList = await readBranches(root)
        const branchExists =
          branchList.ok && branchList.branches.some((item) => item.kind === 'local' && item.name === branchName)
        if (branchMode === 'new' && !branchExists) {
          const created = await createBranch(root, branchName, '', true)
          if (!created.ok) {
            sendJson(res, 200, { ok: false, error: `创建分支 ${branchName} 失败：${created.error || '分支已存在或名称不合法'}` })
            return
          }
          steps.push(`已创建分支 ${branchName}`)
          steps.push(`已切换到分支 ${branchName}`)
        } else {
          const switched = await checkoutBranch(root, branchName)
          if (!switched.ok) {
            sendJson(res, 200, { ok: false, error: `切换到分支 ${branchName} 失败：${switched.error || '分支不存在'}` })
            return
          }
          steps.push(branchMode === 'new' ? `分支 ${branchName} 已存在，已切换到该分支` : `已切换到分支 ${branchName}`)
        }

        // 7) 可选首次提交。
        const message = str(body.initialCommitMessage).trim()
        if (message.length > 0) {
          const staged = await stageAll(root)
          if (!staged.ok) {
            sendJson(res, 200, { ok: false, error: staged.error ?? '暂存文件失败' })
            return
          }
          const committed = await commitStaged(root, message, false)
          if (!committed.ok) {
            sendJson(res, 200, { ok: false, error: `创建首次提交失败：${committed.error || '未知原因'}` })
            return
          }
          steps.push('已创建首次提交')
        }

        deps.log?.('info', `仓库初始化完成：${root}（origin=${remoteUrl}）`)
        sendJson(res, 200, { ok: true, root, branch, remoteName: 'origin', remoteUrl, steps, error: '' })
        return
      }

      // 在已连接账号下新建一个空远程仓库：用于「本地目录 → 远端仓库」从零开始。
      // 这是写操作（会在远端产生资源），过 requireWrite + 归属授权；建完自动补进该账号的权限表（full），
      // 否则新仓库会因为「不在授权名单里」而无法 push。
      if (path === '/repo/create') {
        const cwd = str(body.cwd).trim()
        if (cwd) {
          const allowed = requireWrite(cwd)
          if (!allowed) return
        }
        const accountId = str(body.accountId).trim()
        const account = accountId ? deps.store.getAccount(accountId) : deps.store.activeAccount()
        if (!account) {
          sendJson(res, 200, { ok: false, error: accountId ? '账号不存在' : '尚未连接 Git 账号，请先在设置中连接账号' })
          return
        }
        const token = deps.store.revealSecret(account.id)
        if (!token) {
          deps.store.markAccount(account.id, { status: 'error', lastError: '凭据无法解密' })
          sendJson(res, 200, { ok: false, error: '凭据无法解密，请重新授权' })
          return
        }
        const name = str(body.name).trim()
        if (!name) {
          sendJson(res, 400, { ok: false, error: '请填写仓库名' })
          return
        }
        const created = await createAccountRepo(
          providerOf(account.provider),
          token,
          {
            name,
            private: body.private === true,
            description: str(body.description).trim(),
            owner: str(body.owner).trim() || undefined,
          },
          account.apiBase || undefined,
          account.host,
        )
        if (!created.ok || !created.repo) {
          sendJson(res, 200, { ok: false, error: created.error ?? '创建远程仓库失败' })
          return
        }
        // 新仓库默认授权 full：用户刚在账号下建出来，意图就是要用它。
        deps.store.setRepoPermission(account.id, created.repo.fullName, 'full')
        deps.log?.('info', `远程仓库已创建：${account.provider}/${created.repo.fullName}`)
        sendJson(res, 200, { ok: true, repo: created.repo, state: deps.store.snapshot() })
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
        const label = str(body.label).trim()
        const record = deps.store.addAccount({
          provider,
          kind: 'pat',
          login: identity.login,
          displayName: label ? `${identity.displayName || identity.login}（${label}）` : identity.displayName,
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

      // 单条仓库权限写入：只改「该账号对该仓库」这一格，不整表覆盖。
      // 整表 POST /settings 的做法在连点/多窗口下会互相覆盖（后写者把前者的改动抹掉）。
      if (path === '/repo/permission') {
        const accountId = str(body.accountId).trim()
        const repoFullName = str(body.repo).trim()
        const perm = str(body.permission).trim()
        if (!accountId || !repoFullName) {
          sendJson(res, 400, { ok: false, error: '缺少 accountId 或 repo 参数' })
          return
        }
        if (perm !== 'full' && perm !== 'read' && perm !== 'none') {
          sendJson(res, 400, { ok: false, error: `权限档位不合法：${perm || '(空)'}` })
          return
        }
        const account = deps.store.getAccount(accountId)
        if (!account) {
          sendJson(res, 404, { ok: false, error: '账号不存在' })
          return
        }
        const applied = deps.store.setRepoPermission(accountId, repoFullName, perm)
        deps.log?.('info', `仓库权限已更新：${accountId.slice(0, 8)}… ${repoFullName}=${applied}`)
        sendJson(res, 200, {
          ok: true,
          repo: repoFullName,
          permission: applied,
          state: deps.store.snapshot(),
        })
        return
      }

      if (path === '/settings') {
        const patch: Record<string, unknown> = {}
        if ('allowedRepos' in body) patch.allowedRepos = normalizeRepos(body.allowedRepos)
        if ('allowedRoots' in body) patch.allowedRoots = normalizeRoots(body.allowedRoots)
        if ('allowWrite' in body) patch.allowWrite = body.allowWrite === true
        if ('requireConfirm' in body) patch.requireConfirm = body.requireConfirm !== false
        if ('defaultAccountId' in body) patch.defaultAccountId = str(body.defaultAccountId)
        if ('repoPermissions' in body) patch.repoPermissions = body.repoPermissions
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
