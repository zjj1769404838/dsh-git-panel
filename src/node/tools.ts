import { randomBytes } from 'node:crypto'
import type { PanelStore } from './store.js'
import { normalizeRepo } from './store.js'
import { ensureRepo, runGit } from './git.js'
import { fetchRepo, PROVIDERS, providerOf } from './providers.js'
import { parseRemoteRepo } from './git-ops.js'
import { redact } from './vault.js'

const OBJECT_SCHEMA = { type: 'object', additionalProperties: true }
const textBlocks = (text: string) => [{ type: 'text', text }]

interface ToolsService {
  register?: (tool: any) => any
}

export interface ToolContext {
  store: PanelStore
  tools?: ToolsService
  log?: (level: string, message: string) => void
}

interface PendingWrite {
  token: string
  repo: string
  root: string
  args: string[]
  action: string
  createdAt: number
}

const PENDING_TTL_MS = 5 * 60_000

/** 待确认的写操作队列（内存态；重启即失效，符合「不落盘、不残留」的预期）。 */
const pendingWrites = new Map<string, PendingWrite>()

function ok(value: unknown) {
  return { ok: true, ...(value as object) }
}

function fail(error: string, extra: Record<string, unknown> = {}) {
  return { ok: false, error, ...extra }
}

function requireAccount(ctx: ToolContext, accountId?: string) {
  const account = ctx.store.activeAccount(accountId)
  if (!account) return { error: '尚未接入任何 Git 账号，请先在输入框左侧的 Git 面板里连接账号（支持 OAuth 或访问令牌）' }
  if (account.status === 'expired') {
    return { error: `账号 ${account.login} 的授权已失效，请在 Git 面板里重新授权` }
  }
  const token = ctx.store.revealSecret(account.id)
  if (!token) return { error: `账号 ${account.login} 的凭据无法解密，请重新授权` }
  return { account, token }
}

function resolveRoot(ctx: ToolContext, cwd: string) {
  // 先判授权范围，再看目录是不是仓库：未授权路径连「是不是仓库」都不该被告知。
  if (typeof cwd !== 'string' || cwd.trim().length === 0) return { error: '缺少工作目录参数（cwd）' }
  if (!ctx.store.isRootAllowed(cwd)) {
    const allowed = ctx.store.settings().allowedRoots
    return {
      error:
        `目录 ${cwd} 不在允许范围内。已授权根目录：` +
        (allowed.length > 0 ? allowed.join('、') : '（尚未设置）') +
        '。请让用户在 Git 面板的「仓库范围」里添加该目录。',
    }
  }
  const repo = ensureRepo(cwd)
  if (!repo.ok) return { error: repo.error ?? '目录不可用' }
  return { root: repo.root! }
}

function summarizeStatus(raw: string) {
  const lines = raw.split('\n').filter((line) => line.trim().length > 0)
  const branchLine = lines.find((line) => line.startsWith('##')) ?? ''
  const files = lines.filter((line) => !line.startsWith('##'))
  return { branch: branchLine.replace(/^##\s*/, ''), changed: files.length, files: files.slice(0, 200) }
}

export function registerGitTools(ctx: ToolContext): () => void {
  const tools = ctx.tools
  if (!tools || typeof tools.register !== 'function') {
    ctx.log?.('warn', 'tools 服务不可用，Agent 工具未注册（面板功能仍可用）')
    return () => {}
  }
  const disposers: Array<() => void> = []

  const add = (tool: any) => {
    try {
      const disposer = tools.register!(tool)
      if (typeof disposer === 'function') disposers.push(disposer)
    } catch (error) {
      ctx.log?.('error', `工具 ${tool?.name} 注册失败：${redact(error)}`)
    }
  }

  add({
    name: 'git_panel_status',
    description:
      '查看 Git 接入状态：已连接账号（脱敏）、授权状态、允许 Agent 操作的远端仓库与本地目录、是否允许写操作。调用任何其它 git_* 工具前可先查这个确认权限范围。',
    parameters: { type: 'object', properties: {}, required: [] },
    output: { schema: OBJECT_SCHEMA, render: (_args: any, value: any) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute() {
      const settings = ctx.store.settings()
      return ok({
        accounts: ctx.store.accounts().map((item) => ({
          id: item.id,
          provider: item.provider,
          kind: item.kind,
          login: item.login,
          status: item.status,
          scopes: item.scopes,
          lastCheckedAt: item.lastCheckedAt,
          lastError: item.lastError,
        })),
        allowedRepos: settings.allowedRepos,
        allowedRoots: settings.allowedRoots,
        allowWrite: settings.allowWrite,
        requireConfirm: settings.requireConfirm,
        note:
          settings.allowedRepos.length === 0
            ? '尚未授权任何远端仓库：远端 API 操作会被拒绝，只能对 allowedRoots 内的本地仓库做只读操作。'
            : '远端操作仅限 allowedRepos 内仓库。',
      })
    },
  })

  add({
    name: 'git_repo_info',
    description:
      '读取本地仓库基本信息：当前分支、远端地址（已脱敏）、工作区改动统计、最近一次提交。cwd 必须是已授权的本地仓库根目录。',
    parameters: {
      type: 'object',
      properties: { cwd: { type: 'string', description: '本地仓库根目录的绝对路径' } },
      required: ['cwd'],
    },
    output: { schema: OBJECT_SCHEMA, render: (_args: any, value: any) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args: any) {
      const resolved = resolveRoot(ctx, String(args?.cwd ?? ''))
      if ('error' in resolved) return fail(resolved.error!)
      const root = resolved.root!
      const [status, remote, branch, lastCommit] = await Promise.all([
        runGit(root, ['status', '--porcelain=v1', '--branch']),
        runGit(root, ['remote', '-v']),
        runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
        runGit(root, ['log', '-1', '--pretty=format:%h|%an|%ad|%s', '--date=iso']),
      ])
      if (!status.ok) return fail(status.error)
      const summary = summarizeStatus(status.stdout)
      const last = lastCommit.ok ? lastCommit.stdout.split('|') : []
      return ok({
        root,
        branch: branch.ok ? branch.stdout.trim() : summary.branch,
        remotes: remote.ok ? redact(remote.stdout.trim()) : '',
        changedFiles: summary.changed,
        files: summary.files,
        lastCommit: last.length >= 4 ? { hash: last[0], author: last[1], date: last[2], subject: last.slice(3).join('|') } : null,
      })
    },
  })

  add({
    name: 'git_branches',
    description: '列出本地分支（含是否跟踪远端、最近提交时间与作者），可选只看某个模式匹配的分支。',
    parameters: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: '本地仓库根目录的绝对路径' },
        pattern: { type: 'string', description: '可选：分支名包含的子串' },
      },
      required: ['cwd'],
    },
    output: { schema: OBJECT_SCHEMA, render: (_args: any, value: any) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args: any) {
      const resolved = resolveRoot(ctx, String(args?.cwd ?? ''))
      if ('error' in resolved) return fail(resolved.error!)
      const result = await runGit(resolved.root!, [
        'branch',
        '--list',
        '--verbose',
        '--no-abbrev',
        `*${String(args?.pattern ?? '')}*`,
      ])
      if (!result.ok) return fail(result.error)
      const rows = result.stdout
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => {
          const current = line.startsWith('*')
          const body = line.replace(/^\*\s*/, '').trim()
          const parts = body.split(/\s+/)
          return { name: parts[0], current, head: parts[1] ?? '', tracking: parts.slice(2).join(' ') }
        })
      return ok({ root: resolved.root, count: rows.length, branches: rows })
    },
  })

  add({
    name: 'git_diff',
    description:
      '查看代码差异：默认工作区未暂存改动；mode=staged 看已暂存；mode=commit 看某个提交（需 rev）；mode=range 看两个提交之间（需 base/head）。可传 path 限定文件。',
    parameters: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: '本地仓库根目录的绝对路径' },
        mode: { type: 'string', enum: ['worktree', 'staged', 'commit', 'range'] },
        rev: { type: 'string', description: 'mode=commit 时的提交号' },
        base: { type: 'string', description: 'mode=range 的起点' },
        head: { type: 'string', description: 'mode=range 的终点' },
        path: { type: 'string', description: '可选：限定某个文件或目录' },
        maxLines: { type: 'number', description: '最多返回多少行，默认 400' },
      },
      required: ['cwd'],
    },
    output: { schema: OBJECT_SCHEMA, render: (_args: any, value: any) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args: any) {
      const resolved = resolveRoot(ctx, String(args?.cwd ?? ''))
      if ('error' in resolved) return fail(resolved.error!)
      const mode = String(args?.mode ?? 'worktree')
      const limit = Math.min(Math.max(Number(args?.maxLines) || 400, 20), 2000)
      const gitArgs = ['diff', '--no-color']
      if (mode === 'staged') gitArgs.push('--cached')
      else if (mode === 'commit') {
        const rev = String(args?.rev ?? '')
        if (!rev) return fail('mode=commit 需要提供 rev（提交号或 HEAD~1）')
        gitArgs.push(`${rev}^`, rev)
      } else if (mode === 'range') {
        const base = String(args?.base ?? '')
        const head = String(args?.head ?? 'HEAD')
        if (!base) return fail('mode=range 需要提供 base')
        gitArgs.push(base, head)
      }
      const path = String(args?.path ?? '').trim()
      if (path) gitArgs.push('--', path)
      const result = await runGit(resolved.root!, gitArgs)
      if (!result.ok) return fail(result.error)
      const lines = result.stdout.split('\n')
      return ok({
        root: resolved.root,
        mode,
        path: path || null,
        truncated: lines.length > limit,
        totalLines: lines.length,
        diff: lines.slice(0, limit).join('\n'),
      })
    },
  })

  add({
    name: 'git_log',
    description: '读取提交记录：默认最近 20 条；可按分支、作者、路径、时间范围过滤，也可用 grep 搜索提交信息。',
    parameters: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: '本地仓库根目录的绝对路径' },
        limit: { type: 'number', description: '返回条数，默认 20，最大 200' },
        branch: { type: 'string', description: '可选：分支名或提交号' },
        author: { type: 'string', description: '可选：作者过滤' },
        grep: { type: 'string', description: '可选：提交信息关键词' },
        path: { type: 'string', description: '可选：限定文件/目录' },
        since: { type: 'string', description: '可选：起始时间，如 2026-01-01 或 3 weeks ago' },
      },
      required: ['cwd'],
    },
    output: { schema: OBJECT_SCHEMA, render: (_args: any, value: any) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args: any) {
      const resolved = resolveRoot(ctx, String(args?.cwd ?? ''))
      if ('error' in resolved) return fail(resolved.error!)
      const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 200)
      const gitArgs = ['log', `-n${limit}`, '--pretty=format:%h%x09%an%x09%ad%x09%s', '--date=short']
      const branch = String(args?.branch ?? '').trim()
      if (branch) gitArgs.push(branch)
      const author = String(args?.author ?? '').trim()
      if (author) gitArgs.push(`--author=${author}`)
      const grep = String(args?.grep ?? '').trim()
      if (grep) gitArgs.push(`--grep=${grep}`, '-i')
      const since = String(args?.since ?? '').trim()
      if (since) gitArgs.push(`--since=${since}`)
      const path = String(args?.path ?? '').trim()
      if (path) gitArgs.push('--', path)
      const result = await runGit(resolved.root!, gitArgs)
      if (!result.ok) {
        if (/does not have any commits yet/i.test(result.stderr)) return ok({ root: resolved.root, commits: [], note: '仓库还没有任何提交' })
        return fail(result.error)
      }
      const commits = result.stdout
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => {
          const [hash, authorName, date, ...rest] = line.split('\t')
          return { hash, author: authorName, date, subject: rest.join('\t') }
        })
      return ok({ root: resolved.root, count: commits.length, commits })
    },
  })

  add({
    name: 'git_remote_info',
    description:
      '查询已授权远端仓库的元信息（默认分支、可见性、最近推送时间、stars 等）。仓库必须在用户授权的 allowedRepos 范围内。',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/repo 形式' },
        accountId: { type: 'string', description: '可选：指定用哪个已连接账号' },
      },
      required: ['repo'],
    },
    output: { schema: OBJECT_SCHEMA, render: (_args: any, value: any) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args: any) {
      const repo = String(args?.repo ?? '').trim()
      // 远端仓库键：优先按 URL 形态解析，退回 owner/repo 直接归一化。
      const repoKey = parseRemoteRepo(repo) ?? (normalizeRepo(repo) || null)
      // 授权判定：优先按「账号 → 仓库」权限表（表内未列出的仓库默认 full）；
      // 没有权限表的老账号回落到全局 allowedRepos。两条路径都拒绝才报错。
      const accountId = args?.accountId ? String(args.accountId) : undefined
      const account0 = accountId ? ctx.store.getAccount(accountId) : ctx.store.activeAccount()
      if (accountId && !account0) {
        return fail(`账号 ${accountId} 不存在，请在 Git 面板里重新选择账号后重试。`)
      }
      const permitted = account0
        ? repoKey !== null && ctx.store.isRepoAllowedFor(account0.id, repoKey)
        : ctx.store.isRepoAllowed(repo)
      if (!permitted) {
        const allowed = ctx.store.settings().allowedRepos
        return fail(
          `仓库 ${repo} 不在授权范围内。已授权：` +
            (allowed.length > 0 ? allowed.join('、') : '（尚未授权任何仓库）') +
            '。请让用户在 Git 面板里添加该仓库后再试。',
        )
      }
      const found = requireAccount(ctx, accountId)
      if ('error' in found) return fail(found.error!)
      const account = found.account!
      const meta = PROVIDERS[providerOf(account.provider)]
      const result = await fetchRepo(providerOf(account.provider), found.token!, repo, account.apiBase || undefined, account.host)
      if (!result.ok) {
        if (/401/.test(result.error ?? '')) ctx.store.markAccount(account.id, { status: 'expired', lastError: result.error })
        return fail(result.error ?? '查询失败')
      }
      const data = result.repo ?? {}
      const permission = repoKey ? ctx.store.repoPermission(account.id, repoKey) : 'none'
      return ok({
        provider: meta.label,
        account: account.login,
        repo,
        repoKey,
        permission,
        writable: permission === 'full',
        defaultBranch: data.default_branch ?? data.default_branch ?? '',
        private: data.private ?? data.visibility === 'private',
        description: data.description ?? '',
        stars: data.stargazers_count ?? data.star_count ?? 0,
        pushedAt: data.pushed_at ?? data.last_activity_at ?? '',
        htmlUrl: data.html_url ?? data.web_url ?? '',
      })
    },
  })

  add({
    name: 'git_write',
    description:
      '执行会改变仓库状态的操作（add / commit / checkout / switch / restore / stash / tag）。' +
      '调用前必须向用户说明将执行的动作与目标仓库；若用户开启了「写操作需确认」，本工具只返回待确认信息与 confirmToken，需再调用 git_confirm 才真正执行。',
    parameters: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: '本地仓库根目录的绝对路径' },
        action: { type: 'string', description: '动作名：add / commit / checkout / switch / restore / stash / tag' },
        args: { type: 'array', items: { type: 'string' }, description: '传给 git 的附加参数（不含子命令）' },
        reason: { type: 'string', description: '为什么要做这个改动（会展示给用户）' },
      },
      required: ['cwd', 'action', 'args'],
    },
    output: { schema: OBJECT_SCHEMA, render: (_args: any, value: any) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args: any) {
      const settings = ctx.store.settings()
      if (!settings.allowWrite) {
        return fail('当前未开启写操作权限。请让用户在 Git 面板里打开「允许 Agent 修改仓库」后再试。')
      }
      // 先做零成本的参数校验，再碰文件系统：非法动作不该因为目录不存在而报出误导性错误。
      const action = String(args?.action ?? '')
      const allowedActions = ['add', 'commit', 'checkout', 'switch', 'restore', 'stash', 'tag']
      if (!allowedActions.includes(action)) {
        return fail(`不支持的写动作：${action || '(空)'}。允许：${allowedActions.join(' / ')}`)
      }
      const resolved = resolveRoot(ctx, String(args?.cwd ?? ''))
      if ('error' in resolved) return fail(resolved.error!)
      const root = resolved.root!
      const rawArgs = Array.isArray(args?.args) ? args.args.map((item: unknown) => String(item)) : []
      const reason = String(args?.reason ?? '').trim()

      if (settings.requireConfirm) {
        const token = randomBytes(9).toString('hex')
        pendingWrites.set(token, {
          token,
          repo: root,
          root,
          args: [action, ...rawArgs],
          action,
          createdAt: Date.now(),
        })
        // 清理过期条目
        for (const [key, item] of pendingWrites) {
          if (Date.now() - item.createdAt > PENDING_TTL_MS) pendingWrites.delete(key)
        }
        return ok({
          pending: true,
          confirmToken: token,
          summary: `将执行 git ${action} ${rawArgs.join(' ')}（仓库：${root}）`,
          reason: reason || '（未说明原因）',
          next: '请先向用户确认，再调用 git_confirm 并传入该 confirmToken。',
        })
      }

      const result = await runGit(root, [action, ...rawArgs])
      if (!result.ok) return fail(result.error, { command: result.command, stdout: result.stdout })
      return ok({ executed: true, command: result.command, stdout: result.stdout, stderr: result.stderr })
    },
  })

  add({
    name: 'git_confirm',
    description: '确认并执行上一步 git_write 返回的待确认写操作。confirmToken 来自 git_write 的返回值。',
    parameters: {
      type: 'object',
      properties: {
        confirmToken: { type: 'string', description: 'git_write 返回的 confirmToken' },
        confirmed: { type: 'boolean', description: '用户是否已明确同意执行' },
      },
      required: ['confirmToken'],
    },
    output: { schema: OBJECT_SCHEMA, render: (_args: any, value: any) => textBlocks(JSON.stringify(value, null, 2)) },
    async execute(args: any) {
      if (args?.confirmed === false) return fail('用户未同意执行，已取消该写操作')
      const token = String(args?.confirmToken ?? '')
      const pending = pendingWrites.get(token)
      if (!pending) return fail('确认令牌无效或已过期（有效期 5 分钟），请重新调用 git_write')
      pendingWrites.delete(token)
      if (Date.now() - pending.createdAt > PENDING_TTL_MS) return fail('确认已超时，请重新调用 git_write')
      const result = await runGit(pending.root, pending.args)
      if (!result.ok) return fail(result.error, { command: result.command, stdout: result.stdout })
      return ok({ executed: true, command: result.command, stdout: result.stdout, stderr: result.stderr })
    },
  })

  return () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        /* ignore */
      }
    }
    pendingWrites.clear()
  }
}
