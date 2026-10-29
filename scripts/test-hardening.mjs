#!/usr/bin/env node
/**
 * 加固回归：用 mock ctx 驱动真实产物（lib/index.js），验证
 *  - 请求体上限 / 同源校验 / nosniff / no-store
 *  - 令牌永不明文出现在响应里（/state、/pat/connect 返回）
 *  - 设置归一化（仓库名、根目录）与权限判定（未授权仓库/目录被拒）
 *  - Agent 工具：未授权仓库拒绝、写操作在 allowWrite=false 时拒绝、requireConfirm 走两段确认
 *  - 错误信息可读（不是异常栈）
 */
import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tmp = await mkdtemp(join(tmpdir(), 'dgp-test-'))
process.env.DSH_HOME = tmp

const mod = await import('../lib/index.js')

let pass = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) pass += 1
  else failures.push(detail ? `${name} — ${detail}` : name)
}

function mockRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    headersSent: false,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value
    },
    end(payload) {
      this.headersSent = true
      this.body = payload ? String(payload) : ''
    },
  }
  return res
}

function mockReq({ method = 'GET', url = '/', headers = {}, body = null } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1:54711', ...headers }
  req.destroy = () => {
    req.destroyed = true
  }
  process.nextTick(() => {
    if (body !== null) req.emit('data', Buffer.from(body))
    req.emit('end')
  })
  return req
}

async function call(handler, options) {
  const res = mockRes()
  await handler(mockReq(options), res)
  let json = null
  try {
    json = res.body ? JSON.parse(res.body) : null
  } catch {
    json = null
  }
  return { status: res.statusCode, headers: res.headers, body: res.body, json }
}

// ---- 用 mock ctx 驱动真实 apply，捕获 webServer 注册与 tools 注册 ----
const registeredTools = new Map()
const fakeTools = {
  register(tool) {
    registeredTools.set(tool.name, tool)
    return () => registeredTools.delete(tool.name)
  },
}

let handler = null
let routePath = ''
const ctx = {
  logger: { info() {}, warn() {}, error() {} },
  effect(fn) {
    fn()
  },
  get(name) {
    return name === 'tools' ? fakeTools : undefined
  },
  webServer: {
    register(options) {
      handler = options.handler
      routePath = options.path
    },
  },
}

mod.apply(ctx)

check('apply 注册了 webServer 路由', typeof handler === 'function')
check('路由前缀正确', routePath === '/dsh-git-panel', routePath)
check('注册了 Agent 工具', registeredTools.size >= 7, `实际 ${registeredTools.size}`)
check('工具 name 前缀一致', [...registeredTools.keys()].every((name) => name.startsWith('git_')), [...registeredTools.keys()].join(','))

// ---- /health ----
{
  const r = await call(handler, { method: 'GET', url: '/dsh-git-panel/health' })
  check('health 返回 200', r.status === 200, String(r.status))
  check('health 版本与 package 一致', r.json?.version === mod.PLUGIN_VERSION, `${r.json?.version} vs ${mod.PLUGIN_VERSION}`)
  check('health 带 nosniff', r.headers['x-content-type-options'] === 'nosniff')
  check('health 带 no-store', r.headers['cache-control'] === 'no-store')
}

// ---- 同源校验 ----
{
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    headers: { 'sec-fetch-site': 'cross-site' },
    body: JSON.stringify({ allowWrite: true }),
  })
  check('跨站请求被拒（403）', r.status === 403, String(r.status))
  check('跨站拒绝有可读原因', typeof r.json?.error === 'string' && r.json.error.includes('跨站'), r.json?.error)
}
{
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    headers: { origin: 'https://evil.example', host: '127.0.0.1:54711' },
    body: JSON.stringify({ allowWrite: true }),
  })
  check('Origin 与 Host 不一致被拒（403）', r.status === 403, String(r.status))
}

// ---- 请求体上限 ----
{
  const huge = JSON.stringify({ allowedRepos: ['a/b'], pad: 'x'.repeat(300 * 1024) })
  const r = await call(handler, { method: 'POST', url: '/dsh-git-panel/settings', body: huge })
  check('超大请求体被拒（413）', r.status === 413, String(r.status))
}

// ---- 未知接口 / 方法 ----
{
  const r = await call(handler, { method: 'GET', url: '/dsh-git-panel/nope' })
  check('未知接口 405/404', r.status === 405 || r.status === 404, String(r.status))
}

// ---- 设置归一化 ----
{
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({
      allowedRepos: ['https://github.com/Owner/Repo.git', 'owner/repo', 'bad', 'git@github.com:foo/bar.git'],
      allowedRoots: ['D:\\work\\repo\\', '/tmp/x'],
      allowWrite: false,
      requireConfirm: true,
    }),
  })
  check('设置保存成功', r.json?.ok === true, JSON.stringify(r.json))
  check('URL 形式仓库被归一化', r.json?.settings?.allowedRepos?.includes('Owner/Repo'), JSON.stringify(r.json?.settings?.allowedRepos))
  check('重复仓库被去重', new Set(r.json?.settings?.allowedRepos ?? []).size === (r.json?.settings?.allowedRepos ?? []).length)
  check('非法仓库被丢弃', !(r.json?.settings?.allowedRepos ?? []).includes('bad'))
  check('根目录去尾斜杠', (r.json?.settings?.allowedRoots ?? []).includes('D:\\work\\repo'), JSON.stringify(r.json?.settings?.allowedRoots))
}

// ---- /state 永不返回明文 ----
{
  const r = await call(handler, { method: 'GET', url: '/dsh-git-panel/state' })
  check('state 返回 200', r.status === 200, String(r.status))
  check('state 含 providers 元数据', Array.isArray(r.json?.providers) && r.json.providers.length >= 3)
  check('state 账号 secret 已置空', (r.json?.state?.accounts ?? []).every((a) => a.secret === ''))
  check('state 响应不含 v1. 密文', !r.body.includes('v1.'))
}

// ---- /repo/status：composer 分支 chip 的数据来源 ----
{
  const missing = await call(handler, { method: 'GET', url: '/dsh-git-panel/repo/status' })
  check('repo/status 缺 cwd 返回 400', missing.status === 400, String(missing.status))
  check('repo/status 缺 cwd 给可读错误', String(missing.json?.error ?? '').includes('cwd'), JSON.stringify(missing.json))

  const nonRepo = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/status?cwd=${encodeURIComponent(tmp)}` })
  check('repo/status 非仓库返回 200', nonRepo.status === 200, String(nonRepo.status))
  check('repo/status 非仓库 isRepo=false', nonRepo.json?.status?.isRepo === false, JSON.stringify(nonRepo.json).slice(0, 200))
  check('repo/status 非仓库不算错误', nonRepo.json?.ok === true, JSON.stringify(nonRepo.json).slice(0, 200))
  // 只有「目录存在但没有 .git」才算未初始化（可给初始化入口）
  check('repo/status 目录无 .git 标记 reason=no-repo', nonRepo.json?.status?.reason === 'no-repo', String(nonRepo.json?.status?.reason))

  // 路径非法/不存在属于检测失败，不能当成「未初始化」
  const missingDir = await call(handler, {
    method: 'GET',
    url: `/dsh-git-panel/repo/status?cwd=${encodeURIComponent(join(tmp, 'no-such-dir'))}`,
  })
  check('repo/status 目录不存在标记 reason=invalid', missingDir.json?.status?.reason === 'invalid', String(missingDir.json?.status?.reason))
  check('repo/status 目录不存在给可读原因', String(missingDir.json?.status?.error ?? '').length > 0, String(missingDir.json?.status?.error ?? '').slice(0, 120))

  const relative = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/status?cwd=${encodeURIComponent('relative/dir')}` })
  check('repo/status 相对路径标记 reason=invalid', relative.json?.status?.reason === 'invalid', String(relative.json?.status?.reason))
}

// ---- PAT 连接：无效令牌返回可读错误且不含令牌原文 ----
{
  const fakeToken = 'ghp_' + 'A'.repeat(36)
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/pat/connect',
    body: JSON.stringify({ provider: 'github', token: fakeToken }),
  })
  check('无效令牌连接失败', r.json?.ok === false, JSON.stringify(r.json))
  check('失败原因可读', typeof r.json?.error === 'string' && r.json.error.length > 0, r.json?.error)
  check('响应里不含令牌明文', !r.body.includes(fakeToken))
}

// ---- 空令牌校验 ----
{
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/pat/connect',
    body: JSON.stringify({ provider: 'github', token: '' }),
  })
  check('空令牌被拒（400）', r.status === 400, String(r.status))
}

// ---- OAuth：缺 clientId 时给出明确提示，且不泄露任何凭据 ----
{
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/oauth/start',
    body: JSON.stringify({ provider: 'github', clientId: '' }),
  })
  check('OAuth 缺 clientId 被拒', r.json?.ok === false, JSON.stringify(r.json))
  check('OAuth 提示说明需要自己的 Client ID', String(r.json?.error ?? '').includes('Client ID'), r.json?.error)
}
{
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/oauth/poll',
    body: JSON.stringify({ pollKey: 'deadbeef' }),
  })
  check('无效 pollKey 返回过期提示', r.json?.status === 'expired', JSON.stringify(r.json))
}

// ---- 账号移除：不存在时给可读错误 ----
{
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/accounts/remove',
    body: JSON.stringify({ id: 'nope' }),
  })
  check('移除不存在账号 ok=false', r.json?.ok === false, JSON.stringify(r.json))
  check('移除失败有原因', typeof r.json?.error === 'string' && r.json.error.length > 0)
}

// ---- Agent 工具：未授权仓库被拒 ----
{
  const tool = registeredTools.get('git_remote_info')
  const result = await tool.execute({ repo: 'someone/secret-repo' })
  check('未授权仓库被拒', result.ok === false, JSON.stringify(result))
  check('拒绝信息说明授权范围', String(result.error).includes('不在授权范围'), result.error)
}

// ---- Agent 工具：未授权目录被拒 ----
{
  const tool = registeredTools.get('git_repo_info')
  const result = await tool.execute({ cwd: process.cwd() })
  check('未授权目录被拒', result.ok === false, JSON.stringify(result))
  check('拒绝信息列出已授权根目录', String(result.error).includes('已授权根目录'), result.error)
}

// ---- Agent 工具：非仓库目录给出可读错误 ----
{
  const tool = registeredTools.get('git_repo_info')
  const result = await tool.execute({ cwd: tmp })
  check('非 git 目录被拒', result.ok === false, JSON.stringify(result))
}

// ---- Agent 工具：写操作默认关闭 ----
{
  const tool = registeredTools.get('git_write')
  const result = await tool.execute({ cwd: tmp, action: 'commit', args: ['-m', 'x'] })
  check('写操作默认被拒', result.ok === false, JSON.stringify(result))
  check('写拒绝提示开启开关', String(result.error).includes('写操作'), result.error)
}

// ---- Agent 工具：非法写动作被拒 ----
{
  await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ allowedRoots: [process.cwd()], allowWrite: true, requireConfirm: true }),
  })
  const tool = registeredTools.get('git_write')
  const result = await tool.execute({ cwd: process.cwd(), action: 'push', args: ['origin', 'main'] })
  check('不在白名单的写动作被拒', result.ok === false, JSON.stringify(result))
  check('拒绝信息列出允许动作', String(result.error).includes('允许'), result.error)
}

// ---- 工具输出形状 ----
{
  const tool = registeredTools.get('git_panel_status')
  const value = await tool.execute({})
  check('status 工具返回 ok', value.ok === true, JSON.stringify(value))
  check('status 工具不回显令牌字段', !JSON.stringify(value).includes('secret'))
  const blocks = tool.output.render({}, value)
  check('render 返回 text block', Array.isArray(blocks) && blocks[0]?.type === 'text' && blocks[0].text.includes('ok'))
}

// ---- 真实仓库端到端：只读工具 + 两段式写确认 ----
{
  const repo = join(tmp, 'repo')
  const { execFileSync } = await import('node:child_process')
  const { mkdirSync, writeFileSync } = await import('node:fs')
  mkdirSync(repo, { recursive: true })
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' })
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test User')
  writeFileSync(join(repo, 'README.md'), '# hello\n')
  git('add', '.')
  git('commit', '-q', '-m', 'initial commit')
  writeFileSync(join(repo, 'README.md'), '# hello world\n')

  await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ allowedRoots: [repo], allowWrite: true, requireConfirm: true }),
  })

  const info = await registeredTools.get('git_repo_info').execute({ cwd: repo })
  check('真实仓库 repo_info 成功', info.ok === true, JSON.stringify(info).slice(0, 300))
  check('repo_info 报出当前分支', info.branch === 'main', String(info.branch))
  check('repo_info 报出改动文件数', info.changedFiles === 1, String(info.changedFiles))

  const branches = await registeredTools.get('git_branches').execute({ cwd: repo })
  check('branches 返回 main', (branches.branches ?? []).some((b) => b.name === 'main'), JSON.stringify(branches).slice(0, 200))
  check('branches 标记当前分支', (branches.branches ?? []).find((b) => b.name === 'main')?.current === true)

  const diff = await registeredTools.get('git_diff').execute({ cwd: repo, mode: 'worktree' })
  check('diff 读到未暂存改动', diff.ok === true && diff.diff.includes('hello world'), String(diff.diff).slice(0, 200))

  const log = await registeredTools.get('git_log').execute({ cwd: repo, limit: 5 })
  check('log 读到提交', log.ok === true && log.count === 1, JSON.stringify(log).slice(0, 200))
  check('log 提交信息正确', log.commits?.[0]?.subject === 'initial commit', JSON.stringify(log.commits?.[0]))

  // 两段式写确认：先拿 token，不执行
  const pending = await registeredTools.get('git_write').execute({ cwd: repo, action: 'add', args: ['README.md'], reason: '测试确认流程' })
  check('写操作返回待确认', pending.ok === true && pending.pending === true, JSON.stringify(pending).slice(0, 200))
  check('待确认含 confirmToken', typeof pending.confirmToken === 'string' && pending.confirmToken.length === 18, String(pending.confirmToken))
  check('待确认摘要含动作与仓库', String(pending.summary).includes('git add') && String(pending.summary).includes(repo), pending.summary)
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: repo, encoding: 'utf8' }).trim()
  check('未确认前未真正执行', staged === '', staged)

  // 用户拒绝 → 不执行
  const rejected = await registeredTools.get('git_confirm').execute({ confirmToken: pending.confirmToken, confirmed: false })
  check('用户拒绝后取消', rejected.ok === false && String(rejected.error).includes('取消'), JSON.stringify(rejected))
  const stillStaged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: repo, encoding: 'utf8' }).trim()
  check('拒绝后仍未执行', stillStaged === '', stillStaged)

  // 重新发起并确认 → 真正执行
  const pending2 = await registeredTools.get('git_write').execute({ cwd: repo, action: 'add', args: ['README.md'], reason: '测试确认流程' })
  const done = await registeredTools.get('git_confirm').execute({ confirmToken: pending2.confirmToken, confirmed: true })
  check('确认后执行成功', done.ok === true && done.executed === true, JSON.stringify(done).slice(0, 200))
  const afterStaged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: repo, encoding: 'utf8' }).trim()
  check('确认后确实暂存了文件', afterStaged.includes('README.md'), afterStaged)

  // 令牌复用：同一 token 不能用第二次
  const reused = await registeredTools.get('git_confirm').execute({ confirmToken: pending2.confirmToken, confirmed: true })
  check('confirmToken 不可复用', reused.ok === false, JSON.stringify(reused))

  // 越权：子目录外挂路径被拒（路径段比较）
  const outside = await registeredTools.get('git_repo_info').execute({ cwd: repo + '-evil' })
  check('相邻同名目录不命中授权', outside.ok === false, JSON.stringify(outside))

  // /repo/status 在真实仓库 + 已授权目录下的行为（composer chip 用）
  const authorized = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/status?cwd=${encodeURIComponent(repo)}` })
  check('repo/status 真实仓库返回 200', authorized.status === 200, String(authorized.status))
  check('repo/status 报出分支', authorized.json?.status?.branch === 'main', JSON.stringify(authorized.json?.status ?? {}).slice(0, 200))
  check('repo/status 标记已授权', authorized.json?.status?.authorized === true, JSON.stringify(authorized.json?.status ?? {}).slice(0, 200))
  check('repo/status 报出改动数', authorized.json?.status?.changed === 1, String(authorized.json?.status?.changed))
  check('repo/status 非 detached', authorized.json?.status?.detached === false, String(authorized.json?.status?.detached))
  check('repo/status 真实仓库标记 reason=repo', authorized.json?.status?.reason === 'repo', String(authorized.json?.status?.reason))

  // 未授权目录：仍返回仓库信息但 authorized=false，且不泄露上游 ahead/behind
  await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ allowedRoots: [join(tmp, 'other-place')], allowWrite: false, requireConfirm: true }),
  })
  const unauthorized = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/status?cwd=${encodeURIComponent(repo)}` })
  check('repo/status 未授权目录返回 200', unauthorized.status === 200, String(unauthorized.status))
  check('repo/status 未授权标记 authorized=false', unauthorized.json?.status?.authorized === false, JSON.stringify(unauthorized.json?.status ?? {}).slice(0, 200))
  check('repo/status 未授权不泄露 ahead/behind', (unauthorized.json?.status?.ahead ?? 0) === 0 && (unauthorized.json?.status?.behind ?? 0) === 0)

  // 根目录写 `*` 表示不限制（旧实现只对仓库名支持 `*`，根目录填 `*` 会被静默全拒）
  await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ allowedRoots: ['*'], allowWrite: false, requireConfirm: true }),
  })
  const wildcard = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/status?cwd=${encodeURIComponent(repo)}` })
  check('根目录 * 视为全部授权', wildcard.json?.status?.authorized === true, JSON.stringify(wildcard.json?.status ?? {}).slice(0, 200))
}

// ---- apiBase 与 host 不得混用（GitHub 的 API 域名是 api.github.com） ----
{
  const bad = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/pat/connect',
    body: JSON.stringify({ provider: 'github', token: 'ghp_notARealTokenForUrlProbe000000000000000000', host: 'github.com', apiBase: '' }),
  })
  const err = String(bad.json?.error ?? '')
  check('PAT 校验打到 api.github.com（不是网页域名）', !/410|wayfaring/i.test(err), err.slice(0, 160))
  check('PAT 校验失败给出可读原因', /401|令牌无效|Bad credentials/i.test(err), err.slice(0, 160))
}

// ---- 初始化仓库：/repo/init（chip 菜单里的「初始化仓库」） ----
{
  const fresh = join(tmp, 'fresh-repo')
  await mkdir(fresh, { recursive: true })
  // 预置文件：初始化不得删除/覆盖它们
  await writeFile(join(fresh, 'keep-me.txt'), 'keep this content\n', 'utf8')
  await mkdir(join(fresh, 'src'), { recursive: true })
  await writeFile(join(fresh, 'src', 'app.js'), 'console.log(1)\n', 'utf8')

  // 未授权目录必须先被拒（不能借初始化把任意目录变成仓库）
  await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ allowedRoots: [join(tmp, 'nowhere')], allowWrite: true, requireConfirm: true }),
  })
  const denied = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/init', body: JSON.stringify({ cwd: fresh }) })
  check('repo/init 未授权目录被拒', denied.status === 403, String(denied.status))
  check('repo/init 拒绝信息含已授权根目录', /不在 Agent 可操作范围|已授权根目录/.test(String(denied.json?.error ?? '')), String(denied.json?.error ?? '').slice(0, 160))
  check('repo/init 被拒时没有创建仓库', !existsSync(join(fresh, '.git')))

  // 授权后初始化成功
  await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ allowedRoots: [tmp], allowWrite: true, requireConfirm: true }),
  })
  const created = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/init', body: JSON.stringify({ cwd: fresh, branch: 'main' }) })
  check('repo/init 在已授权目录创建成功', created.status === 200 && created.json?.ok === true, JSON.stringify(created.json ?? {}).slice(0, 200))
  check('repo/init 回报 created=true', created.json?.result?.created === true, JSON.stringify(created.json?.result ?? {}))
  check('repo/init 回报初始分支', created.json?.result?.branch === 'main', String(created.json?.result?.branch))
  check('repo/init 真的创建了 .git', existsSync(join(fresh, '.git')))

  // 初始化不得删除或覆盖既有文件
  check('repo/init 保留原有文件', existsSync(join(fresh, 'keep-me.txt')))
  check('repo/init 保留原有子目录文件', existsSync(join(fresh, 'src', 'app.js')))
  check('repo/init 未改动原有文件内容', (await readFile(join(fresh, 'keep-me.txt'), 'utf8')) === 'keep this content\n')

  // 初始化后 chip 状态接口应识别为仓库
  const afterInit = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/status?cwd=${encodeURIComponent(fresh)}` })
  check('repo/init 后 repo/status 识别为仓库', afterInit.json?.status?.isRepo === true, JSON.stringify(afterInit.json?.status ?? {}).slice(0, 200))

  // 幂等：再次初始化不报错、不重建
  const again = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/init', body: JSON.stringify({ cwd: fresh }) })
  check('repo/init 对已有仓库幂等', again.status === 200 && again.json?.result?.created === false, JSON.stringify(again.json?.result ?? {}))

  // 参数校验
  const noCwd = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/init', body: JSON.stringify({}) })
  check('repo/init 缺 cwd 返回 400', noCwd.status === 400, String(noCwd.status))
  const badPath = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/init', body: JSON.stringify({ cwd: join(tmp, 'missing-dir') }) })
  check('repo/init 目录不存在给出可读原因', badPath.json?.ok === false && /目录不存在/.test(String(badPath.json?.error ?? '')), String(badPath.json?.error ?? '').slice(0, 120))
}

// ---- 分支拓扑：/repo/graph（chip 菜单里的车道式 DAG） ----
{
  const { execFileSync } = await import('node:child_process')
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const graphRepo = join(tmp, 'graph-repo')
  mkdirSync(graphRepo, { recursive: true })
  const git = (...args) => execFileSync('git', args, { cwd: graphRepo, stdio: 'ignore' })
  const commit = (file, text, message) => {
    writeFileSync(join(graphRepo, file), text)
    git('add', '.')
    git('commit', '-q', '-m', message)
  }
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test User')
  commit('a.txt', 'a\n', 'main: first')
  git('checkout', '-q', '-b', 'feat/a')
  commit('b.txt', 'b\n', 'feat: second')
  git('checkout', '-q', 'main')
  commit('c.txt', 'c\n', 'main: second')
  git('merge', '-q', '--no-ff', 'feat/a', '-m', 'merge feat/a')

  // 未授权：不能泄露提交历史
  await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ allowedRoots: [join(tmp, 'nowhere')], allowWrite: true, requireConfirm: true }),
  })
  const graphDenied = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/graph?cwd=${encodeURIComponent(graphRepo)}` })
  check('repo/graph 未授权时 authorized=false', graphDenied.json?.graph?.authorized === false, JSON.stringify(graphDenied.json ?? {}).slice(0, 200))
  check('repo/graph 未授权时不泄露提交', (graphDenied.json?.graph?.rows ?? []).length === 0 && graphDenied.json?.graph?.laneCount === 0, JSON.stringify(graphDenied.json?.graph ?? {}).slice(0, 200))

  await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ allowedRoots: [graphRepo], allowWrite: true, requireConfirm: true }),
  })

  const graphRes = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/graph?cwd=${encodeURIComponent(graphRepo)}` })
  const graph = graphRes.json?.graph ?? {}
  check('repo/graph 已授权时 ok', graphRes.status === 200 && graphRes.json?.ok === true, JSON.stringify(graphRes.json ?? {}).slice(0, 200))
  check('repo/graph 报出当前分支', graph.branch === 'main', String(graph.branch))
  check('repo/graph 有提交行', Array.isArray(graph.rows) && graph.rows.length >= 3, String((graph.rows ?? []).length))
  check('repo/graph 车道数 >= 2（有分叉）', Number(graph.laneCount) >= 2, String(graph.laneCount))
  check('repo/graph 存在跨车道转折线（分叉/汇合）', (graph.rows ?? []).some((row) => (row.segments ?? []).some((seg) => seg.from !== seg.to)))
  check('repo/graph 主干相邻提交之间有竖直连线', (graph.rows ?? []).some((row) => (row.segments ?? []).some((seg) => seg.from === seg.to)))
  check('repo/graph 每行都有 lane 与 row 索引', (graph.rows ?? []).every((row) => Number.isInteger(row.lane) && Number.isInteger(row.row)))
  check('repo/graph 首行是 HEAD（新→旧）', (graph.rows ?? [])[0]?.short === execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: graphRepo, encoding: 'utf8' }).trim())
  check('repo/graph 含 HEAD ref 标记', (graph.rows ?? []).some((row) => (row.refs ?? []).some((ref) => ref.kind === 'head')))

  // truncated：limit 小于历史条数时必须标记
  const limited = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/graph?cwd=${encodeURIComponent(graphRepo)}&limit=5` })
  check('repo/graph 支持 limit', (limited.json?.graph?.rows ?? []).length <= 5, String((limited.json?.graph?.rows ?? []).length))

  // 参数与异常
  const graphNoCwd = await call(handler, { method: 'GET', url: '/dsh-git-panel/repo/graph' })
  check('repo/graph 缺 cwd 返回 400', graphNoCwd.status === 400, String(graphNoCwd.status))
  const graphNoRepo = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/graph?cwd=${encodeURIComponent(join(tmp, 'missing-dir'))}` })
  check('repo/graph 目录不存在时 reason=invalid', graphNoRepo.json?.graph?.reason === 'invalid', String(graphNoRepo.json?.graph?.reason))

  const notRepo = join(tmp, 'graph-not-repo')
  await mkdir(notRepo, { recursive: true })
  const graphNotRepo = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/graph?cwd=${encodeURIComponent(notRepo)}` })
  check('repo/graph 非仓库时 reason=no-repo', graphNotRepo.json?.graph?.reason === 'no-repo', String(graphNotRepo.json?.graph?.reason))
  check('repo/graph 非仓库时 rows 为空', (graphNotRepo.json?.graph?.rows ?? []).length === 0)
}

// ---- 工作区改动明细：/repo/changes（chip 菜单里的改动列表） ----
{
  const { execFileSync } = await import('node:child_process')
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const chRepo = join(tmp, 'changes-repo')
  mkdirSync(chRepo, { recursive: true })
  const cgit = (...args) => execFileSync('git', args, { cwd: chRepo, stdio: 'ignore' })
  cgit('init', '-q', '-b', 'main')
  cgit('config', 'user.email', 'test@example.com')
  cgit('config', 'user.name', 'Test User')
  writeFileSync(join(chRepo, 'keep.txt'), 'a\n')
  cgit('add', '.')
  cgit('commit', '-q', '-m', 'init')

  // 参数校验
  const changesNoCwd = await call(handler, { method: 'GET', url: '/dsh-git-panel/repo/changes' })
  check('repo/changes 缺 cwd 返回 400', changesNoCwd.status === 400, String(changesNoCwd.status))
  check('repo/changes 缺 cwd 给可读错误', String(changesNoCwd.json?.error ?? '').includes('cwd'), JSON.stringify(changesNoCwd.json ?? {}))

  // 非仓库目录
  const notRepoDir = join(tmp, 'changes-not-repo')
  await mkdir(notRepoDir, { recursive: true })
  const changesNotRepo = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/changes?cwd=${encodeURIComponent(notRepoDir)}` })
  check('repo/changes 非仓库返回 200', changesNotRepo.status === 200, String(changesNotRepo.status))
  check('repo/changes 非仓库 isRepo=false', changesNotRepo.json?.changes?.isRepo === false, JSON.stringify(changesNotRepo.json ?? {}).slice(0, 200))
  check('repo/changes 非仓库文件列表为空', (changesNotRepo.json?.changes?.files ?? []).length === 0)

  // 未授权目录：不能泄露文件名与分支名
  await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ allowedRoots: [join(tmp, 'nowhere-2')], allowWrite: true, requireConfirm: true }),
  })
  const changesDenied = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/changes?cwd=${encodeURIComponent(chRepo)}` })
  check('repo/changes 未授权时不泄露路径', changesDenied.json?.changes?.root === '', JSON.stringify(changesDenied.json ?? {}).slice(0, 200))
  check('repo/changes 未授权时不泄露分支', changesDenied.json?.changes?.branch === '', JSON.stringify(changesDenied.json ?? {}).slice(0, 200))
  check('repo/changes 未授权时不泄露文件名', (changesDenied.json?.changes?.files ?? []).length === 0, JSON.stringify(changesDenied.json ?? {}).slice(0, 200))

  // 授权后：已修改文件 + 未跟踪文件 + 已暂存文件
  await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ allowedRoots: [chRepo], allowWrite: true, requireConfirm: true }),
  })
  writeFileSync(join(chRepo, 'keep.txt'), 'a\nb\nc\n')
  writeFileSync(join(chRepo, 'new.txt'), 'x\ny\n')
  writeFileSync(join(chRepo, 'staged.txt'), 's\n')
  cgit('add', 'staged.txt')

  const changesRes = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/changes?cwd=${encodeURIComponent(chRepo)}` })
  const changes = changesRes.json?.changes ?? {}
  check('repo/changes 已授权返回 ok', changesRes.status === 200 && changesRes.json?.ok === true, JSON.stringify(changesRes.json ?? {}).slice(0, 200))
  check('repo/changes 报出仓库根', String(changes.root ?? '').length > 0, String(changes.root ?? ''))
  check('repo/changes 报出当前分支', changes.branch === 'main', String(changes.branch ?? ''))
  check('repo/changes 标记 dirty', changes.dirty === true, String(changes.dirty))
  const changed = (changes.files ?? []).find((f) => f.path === 'keep.txt')
  check('repo/changes 含已修改文件', !!changed, JSON.stringify((changes.files ?? []).map((f) => f.path)).slice(0, 200))
  check('repo/changes 已修改文件工作区状态为 M', changed?.worktree === 'M', String(changed?.worktree))
  check('repo/changes 已修改文件增行数为 2', changed?.added === 2, String(changed?.added))
  check('repo/changes 已修改文件未暂存', changed?.staged === false, String(changed?.staged))
  const staged = (changes.files ?? []).find((f) => f.path === 'staged.txt')
  check('repo/changes 含已暂存文件', !!staged, JSON.stringify((changes.files ?? []).map((f) => f.path)).slice(0, 200))
  check('repo/changes 已暂存文件标记 staged=true', staged?.staged === true, String(staged?.staged))
  const untracked = (changes.files ?? []).find((f) => f.path === 'new.txt')
  check('repo/changes 含未跟踪文件', !!untracked, JSON.stringify((changes.files ?? []).map((f) => f.path)).slice(0, 200))
  check('repo/changes 未跟踪文件状态为 ?', untracked?.worktree === '?', String(untracked?.worktree))
  check('repo/changes 文件按路径升序', (changes.files ?? []).map((f) => f.path).join('|') === [...(changes.files ?? [])].map((f) => f.path).sort().join('|'))
}

// ---- Git 工作台（IDEA 式面板）端点级行为回归：临时真实仓库 ----
{
  const wbRepo = join(tmp, 'wb-repo')
  const { execFileSync } = await import('node:child_process')
  const { writeFileSync } = await import('node:fs')
  const { mkdirSync } = await import('node:fs')
  mkdirSync(wbRepo, { recursive: true })
  const git = (...args) => execFileSync('git', args, { cwd: wbRepo, stdio: 'ignore' })
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'wb@example.com')
  git('config', 'user.name', 'WB Test')
  writeFileSync(join(wbRepo, 'a.txt'), 'one\n')
  git('add', '.')
  git('commit', '-q', '-m', 'first')
  writeFileSync(join(wbRepo, 'a.txt'), 'one\ntwo\n')
  writeFileSync(join(wbRepo, 'b-new.txt'), 'brand new\n')

  // 授权这个仓库、允许写。
  await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ allowedRoots: [wbRepo], allowWrite: true, requireConfirm: true }),
  })

  // 只读：分支列表
  const br = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/branches?cwd=${encodeURIComponent(wbRepo)}` })
  check('wb/branches 200', br.status === 200 && br.json?.ok === true, JSON.stringify(br.json ?? {}).slice(0, 200))
  check('wb/branches 含 main 且 current', br.json?.current === 'main' && (br.json?.branches ?? []).some((b) => b.name === 'main' && b.current === true))

  // 只读：commits
  const cm = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/commits?cwd=${encodeURIComponent(wbRepo)}&limit=10` })
  check('wb/commits 200 且 1 条', cm.status === 200 && (cm.json?.commits ?? []).length === 1, JSON.stringify(cm.json?.commits ?? []).slice(0, 200))
  check('wb/commits subject=first', cm.json?.commits?.[0]?.subject === 'first')
  check('wb/commits 带 refs 装饰', String(cm.json?.commits?.[0]?.refs ?? '').includes('main'))

  // 只读：commit 详情
  const rev = cm.json?.commits?.[0]?.hash ?? ''
  const cd = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/commit?cwd=${encodeURIComponent(wbRepo)}&rev=${encodeURIComponent(rev)}` })
  check('wb/commit 200 且含文件表', cd.status === 200 && (cd.json?.files ?? []).some((f) => f.path === 'a.txt'), JSON.stringify(cd.json?.files ?? []).slice(0, 200))
  check('wb/commit diff 非空', String(cd.json?.diff ?? '').includes('@@') || String(cd.json?.diff ?? '').length > 0)

  // 只读：diff worktree / staged
  const dw = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/diff?cwd=${encodeURIComponent(wbRepo)}&mode=worktree` })
  check('wb/diff worktree 含 +two', dw.json?.ok === true && String(dw.json?.diff ?? '').includes('+two'), String(dw.json?.diff ?? '').slice(0, 120))
  const ds = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/diff?cwd=${encodeURIComponent(wbRepo)}&mode=staged` })
  check('wb/diff staged 空时 ok 且空 diff', ds.json?.ok === true && String(ds.json?.diff ?? '') === '', JSON.stringify(ds.json ?? {}).slice(0, 120))

  // 只读：remotes（无远程时给空表 + 无 upstream）
  const rm0 = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/remotes?cwd=${encodeURIComponent(wbRepo)}` })
  check('wb/remotes 无远程时 ok 且空表', rm0.json?.ok === true && Array.isArray(rm0.json?.remotes) && rm0.json.remotes.length === 0)

  // 未授权目录 fail-closed：commit 详情不泄露
  const unauthorized = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/commits?cwd=${encodeURIComponent(process.cwd())}` })
  check('wb/commits 未授权 403', unauthorized.status === 403, String(unauthorized.status))
  check('wb/commits 未授权不泄露提交', !JSON.stringify(unauthorized.json ?? {}).includes('subject'))

  // 写链路：stage → commit → branches/create → checkout → delete
  const st = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/repo/stage',
    body: JSON.stringify({ cwd: wbRepo, paths: ['a.txt', 'b-new.txt'] }),
  })
  check('wb/stage ok', st.json?.ok === true, JSON.stringify(st.json ?? {}).slice(0, 200))

  const cmRes = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/changes?cwd=${encodeURIComponent(wbRepo)}` })
  const stagedFile = (cmRes.json?.changes?.files ?? []).find((f) => f.path === 'a.txt')
  check('wb/stage 后文件标记 staged', stagedFile?.staged === true, JSON.stringify(stagedFile ?? {}))

  // 空消息提交被拒
  const badCommit = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/repo/commit',
    body: JSON.stringify({ cwd: wbRepo, message: '' }),
  })
  check('wb/commit 空消息被拒', badCommit.json?.ok === false && String(badCommit.json?.error ?? '').length > 0, JSON.stringify(badCommit.json ?? {}).slice(0, 160))

  const goodCommit = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/repo/commit',
    body: JSON.stringify({ cwd: wbRepo, message: 'second: staged work' }),
  })
  check('wb/commit 成功返回 hash', goodCommit.json?.ok === true && typeof goodCommit.json?.hash === 'string' && goodCommit.json.hash.length > 0, JSON.stringify(goodCommit.json ?? {}).slice(0, 160))

  const cm2 = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/commits?cwd=${encodeURIComponent(wbRepo)}` })
  check('wb/commits 现在两条且最新是 second', (cm2.json?.commits ?? []).length === 2 && cm2.json?.commits?.[0]?.subject === 'second: staged work', JSON.stringify(cm2.json?.commits ?? []).slice(0, 160))

  const mk = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/repo/branches/create',
    body: JSON.stringify({ cwd: wbRepo, name: 'wb/feature', checkout: true }),
  })
  check('wb/branches/create + checkout ok', mk.json?.ok === true, JSON.stringify(mk.json ?? {}).slice(0, 160))
  const br2 = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/branches?cwd=${encodeURIComponent(wbRepo)}` })
  check('wb/branches 切换后 current=wb/feature', br2.json?.current === 'wb/feature', String(br2.json?.current))

  // 非法分支名被拒
  const badName = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/repo/branches/create',
    body: JSON.stringify({ cwd: wbRepo, name: '-evil', checkout: false }),
  })
  check('wb/branches/create 非法名被拒', badName.json?.ok === false && String(badName.json?.error ?? '').includes('不合法'), JSON.stringify(badName.json ?? {}).slice(0, 160))

  const co = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/branches/checkout', body: JSON.stringify({ cwd: wbRepo, name: 'main' }) })
  check('wb/branches/checkout 回 main', co.json?.ok === true && (await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/branches?cwd=${encodeURIComponent(wbRepo)}` })).json?.current === 'main')

  const bd = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/branches/delete', body: JSON.stringify({ cwd: wbRepo, name: 'wb/feature' }) })
  check('wb/branches/delete ok', bd.json?.ok === true, JSON.stringify(bd.json ?? {}).slice(0, 160))

  // discard 无确认被拒（400） + 带确认执行
  writeFileSync(join(wbRepo, 'a.txt'), 'one\ntwo\nthree\n')
  const dNo = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/discard', body: JSON.stringify({ cwd: wbRepo, paths: ['a.txt'] }) })
  check('wb/discard 缺 confirmed 400', dNo.status === 400, String(dNo.status))
  const dYes = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/discard', body: JSON.stringify({ cwd: wbRepo, paths: ['a.txt'], confirmed: true }) })
  check('wb/discard 带确认 ok', dYes.json?.ok === true, JSON.stringify(dYes.json ?? {}).slice(0, 160))
  const after = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/diff?cwd=${encodeURIComponent(wbRepo)}&mode=worktree` })
  check('wb/discard 后 worktree 干净', after.json?.ok === true && String(after.json?.diff ?? '') === '', String(after.json?.diff ?? '').slice(0, 120))

  // 路径逃逸被拒
  const escape = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/stage', body: JSON.stringify({ cwd: wbRepo, paths: ['../../etc/passwd'] }) })
  check('wb/stage 路径逃逸被拒', escape.json?.ok === false && String(escape.json?.error ?? '').includes('不合法'), JSON.stringify(escape.json ?? {}).slice(0, 160))

  // 远程管理：add → remotes 列表 → remove
  const ra = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/remotes/add', body: JSON.stringify({ cwd: wbRepo, name: 'origin', url: 'https://example.com/wb/repo.git' }) })
  check('wb/remotes/add ok', ra.json?.ok === true, JSON.stringify(ra.json ?? {}).slice(0, 160))
  const rl = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/remotes?cwd=${encodeURIComponent(wbRepo)}` })
  check('wb/remotes 列出 origin', (rl.json?.remotes ?? []).some((r) => r.name === 'origin' && r.url === 'https://example.com/wb/repo.git'), JSON.stringify(rl.json?.remotes ?? []).slice(0, 160))
  const badUrl = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/remotes/add', body: JSON.stringify({ cwd: wbRepo, name: 'x', url: 'file:///C:/windows' }) })
  check('wb/remotes/add 非法 URL 被拒', badUrl.json?.ok === false, JSON.stringify(badUrl.json ?? {}).slice(0, 160))
  const rr = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/remotes/remove', body: JSON.stringify({ cwd: wbRepo, name: 'origin' }) })
  check('wb/remotes/remove ok', rr.json?.ok === true, JSON.stringify(rr.json ?? {}).slice(0, 160))

  // push 缺 remote：missingConfig 结构化反馈（远程已被移除）
  const p0 = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/push', body: JSON.stringify({ cwd: wbRepo, remote: '', branch: 'main' }) })
  check('wb/push 缺 remote 报 missingConfig', p0.json?.ok === false && p0.json?.missingConfig === true, JSON.stringify(p0.json ?? {}).slice(0, 200))

  // allowWrite=false 时写端点被拒
  await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ allowedRoots: [wbRepo], allowWrite: false, requireConfirm: true }),
  })
  const wOff = await call(handler, { method: 'POST', url: '/dsh-git-panel/repo/stage', body: JSON.stringify({ cwd: wbRepo, paths: ['a.txt'] }) })
  check('wb/stage 在 allowWrite=false 时 403', wOff.status === 403, String(wOff.status))
  const rOff = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/branches?cwd=${encodeURIComponent(wbRepo)}` })
  check('wb/branches 只读不受 allowWrite 影响', rOff.status === 200 && rOff.json?.ok === true)
}

// ---- 重构回归：账号 → 仓库权限三档 + 远端归属闸门 + 初始化向导 ----
{
  const { execFileSync } = await import('node:child_process')
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const { createCipheriv, randomBytes } = await import('node:crypto')

  const permRepo = join(tmp, 'perm-repo')
  mkdirSync(permRepo, { recursive: true })
  const pgit = (...args) => execFileSync('git', args, { cwd: permRepo, stdio: 'ignore' })
  pgit('init', '-q', '-b', 'main')
  pgit('config', 'user.email', 'test@example.com')
  pgit('config', 'user.name', 'Test User')
  writeFileSync(join(permRepo, 'a.txt'), 'hello')
  pgit('add', '.')
  pgit('commit', '-q', '-m', 'init commit')

  // 造一个已连接账号：令牌用测试密钥加密落盘，插件侧只当密文处理。
  const stateDir = join(tmp, 'git-panel')
  mkdirSync(stateDir, { recursive: true })
  const key = randomBytes(32)
  writeFileSync(join(stateDir, 'key.bin'), key)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const secretPlain = 'ghp_faketokenforunitest000000000000000000000'
  const cipherBody = Buffer.concat([cipher.update(secretPlain, 'utf8'), cipher.final()])
  const sealed = 'v1.' + Buffer.concat([iv, cipher.getAuthTag(), cipherBody]).toString('base64')
  const acctId = 'acct-test-1'
  await writeFile(
    join(stateDir, 'state.json'),
    JSON.stringify(
      {
        version: 1,
        accounts: [
          {
            id: acctId,
            provider: 'github',
            kind: 'pat',
            login: 'tester',
            displayName: 'Tester',
            avatarUrl: '',
            host: 'github.com',
            apiBase: 'https://api.github.com',
            scopes: ['repo'],
            secret: sealed,
            createdAt: Date.now(),
            lastCheckedAt: Date.now(),
            status: 'connected',
            lastError: '',
          },
        ],
        settings: {
          allowedRepos: [],
          allowedRoots: [permRepo],
          allowWrite: true,
          requireConfirm: true,
          defaultAccountId: acctId,
          // 权限表：显式 none / read；表内未列出的仓库默认 full。
          repoPermissions: { [acctId]: { 'owner/denied-repo': 'none', 'owner/readonly-repo': 'read' } },
        },
      },
      null,
      2,
    ),
  )

  let handler2 = null
  const tools2 = new Map()
  const ctx2 = {
    logger: { info() {}, warn() {}, error() {} },
    effect(fn) {
      fn()
    },
    get(name) {
      if (name !== 'tools') return undefined
      return {
        register(tool) {
          tools2.set(tool.name, tool)
          return () => tools2.delete(tool.name)
        },
      }
    },
    webServer: {
      register(options) {
        handler2 = options.handler
      },
    },
  }
  mod.apply(ctx2)
  check('注入账号状态后重新注册路由', typeof handler2 === 'function')

  // 权限表在 /state 中可见且档位保真
  const st = await call(handler2, { method: 'GET', url: '/dsh-git-panel/state' })
  const perms = st.json?.state?.settings?.repoPermissions?.[acctId] ?? {}
  check('state 返回账号权限表', !!st.json?.state?.settings?.repoPermissions, JSON.stringify(st.json?.state?.settings ?? {}).slice(0, 200))
  check('权限表 none 档保真', perms['owner/denied-repo'] === 'none', JSON.stringify(perms))
  check('权限表 read 档保真', perms['owner/readonly-repo'] === 'read', JSON.stringify(perms))
  check('state 不含令牌明文', !st.body.includes('ghp_faketokenforunitest'), 'state 回显了令牌')

  // 远端归属闸门：none / read 拒绝写，未列出的默认 full 放行
  const addDenied = await call(handler2, {
    method: 'POST',
    url: '/dsh-git-panel/repo/remotes/add',
    body: JSON.stringify({ cwd: permRepo, name: 'denied', url: 'https://example.com/owner/denied-repo.git', accountId: acctId }),
  })
  check('未授权仓库加远程被拒 403', addDenied.status === 403, String(addDenied.status))
  check('未授权仓库拒绝原因可读', String(addDenied.json?.error ?? '').includes('未授权写入'), addDenied.json?.error)

  const addReadonly = await call(handler2, {
    method: 'POST',
    url: '/dsh-git-panel/repo/remotes/add',
    body: JSON.stringify({ cwd: permRepo, name: 'ro', url: 'https://example.com/owner/readonly-repo.git', accountId: acctId }),
  })
  check('只读仓库写操作被拒 403', addReadonly.status === 403, String(addReadonly.status))

  const addAllowed = await call(handler2, {
    method: 'POST',
    url: '/dsh-git-panel/repo/remotes/add',
    body: JSON.stringify({ cwd: permRepo, name: 'allowed', url: 'https://example.com/owner/allowed-repo.git', accountId: acctId }),
  })
  check('权限表未列出的仓库默认可写', addAllowed.json?.ok === true, JSON.stringify(addAllowed.json ?? {}).slice(0, 200))

  const addBadAcct = await call(handler2, {
    method: 'POST',
    url: '/dsh-git-panel/repo/remotes/add',
    body: JSON.stringify({ cwd: permRepo, name: 'x', url: 'https://example.com/owner/other.git', accountId: 'nope' }),
  })
  check('指定不存在账号被拒 403', addBadAcct.status === 403, String(addBadAcct.status))

  // 初始化向导：参数校验 + 分支撞名降级 + origin 不静默覆盖
  const bootBadAcct = await call(handler2, {
    method: 'POST',
    url: '/dsh-git-panel/repo/bootstrap',
    body: JSON.stringify({ cwd: permRepo, accountId: 'nope', remoteMode: 'new', remoteUrl: 'https://example.com/owner/allowed-repo.git', branchName: 'main', branchMode: 'new' }),
  })
  check('bootstrap 指定不存在账号报错', bootBadAcct.json?.ok === false && String(bootBadAcct.json?.error ?? '').includes('账号不存在'), JSON.stringify(bootBadAcct.json ?? {}).slice(0, 200))

  const bootNoUrl = await call(handler2, {
    method: 'POST',
    url: '/dsh-git-panel/repo/bootstrap',
    body: JSON.stringify({ cwd: permRepo, accountId: acctId, remoteMode: 'new', branchName: 'main' }),
  })
  check('bootstrap 新建远程缺地址报错', bootNoUrl.json?.ok === false && String(bootNoUrl.json?.error ?? '').includes('远程仓库地址'), JSON.stringify(bootNoUrl.json ?? {}).slice(0, 200))

  const bootNoRepo = await call(handler2, {
    method: 'POST',
    url: '/dsh-git-panel/repo/bootstrap',
    body: JSON.stringify({ cwd: permRepo, accountId: acctId, remoteMode: 'existing', branchName: 'main' }),
  })
  check('bootstrap 选已有远程缺仓库名报错', bootNoRepo.json?.ok === false && String(bootNoRepo.json?.error ?? '').includes('远程仓库'), JSON.stringify(bootNoRepo.json ?? {}).slice(0, 200))

  const bootDup = await call(handler2, {
    method: 'POST',
    url: '/dsh-git-panel/repo/bootstrap',
    body: JSON.stringify({ cwd: permRepo, accountId: acctId, remoteMode: 'new', remoteUrl: 'https://example.com/owner/allowed-repo.git', branchName: 'main', branchMode: 'new' }),
  })
  check('bootstrap 新建分支撞名降级为切换', bootDup.json?.ok === true, JSON.stringify(bootDup.json ?? {}).slice(0, 240))
  check('bootstrap 撞名给出可读步骤', (bootDup.json?.steps ?? []).some((item) => String(item).includes('已存在')), JSON.stringify(bootDup.json?.steps ?? []))

  const bootConflict = await call(handler2, {
    method: 'POST',
    url: '/dsh-git-panel/repo/bootstrap',
    body: JSON.stringify({ cwd: permRepo, accountId: acctId, remoteMode: 'new', remoteUrl: 'https://example.com/owner/other-repo.git', branchName: 'main', branchMode: 'existing' }),
  })
  check('bootstrap 不静默覆盖 origin', bootConflict.json?.ok === false && String(bootConflict.json?.error ?? '').includes('origin'), JSON.stringify(bootConflict.json ?? {}).slice(0, 200))

  // 提交历史：按 ref 取 + 非法 ref 可读错误
  const commitsOk = await call(handler2, { method: 'GET', url: `/dsh-git-panel/repo/commits?cwd=${encodeURIComponent(permRepo)}&ref=main` })
  check('commits 按 ref 取历史', commitsOk.json?.ok === true && (commitsOk.json?.commits ?? []).length >= 1, JSON.stringify(commitsOk.json ?? {}).slice(0, 200))
  const commitRow = (commitsOk.json?.commits ?? [])[0] ?? {}
  check('提交行含哈希/信息/作者/时间', !!commitRow.shortHash && !!commitRow.subject && !!commitRow.author && !!commitRow.date, JSON.stringify(commitRow).slice(0, 200))

  const commitsBad = await call(handler2, { method: 'GET', url: `/dsh-git-panel/repo/commits?cwd=${encodeURIComponent(permRepo)}&ref=no-such-ref-xyz` })
  check('commits 非法 ref 报可读错误', commitsBad.json?.ok === false && String(commitsBad.json?.error ?? '').includes('无法解析'), JSON.stringify(commitsBad.json ?? {}).slice(0, 200))

  // 账号仓库列表：账号不存在时立即报可读错误（不触网）
  const reposMissing = await call(handler2, { method: 'GET', url: '/dsh-git-panel/account/repos?accountId=nope' })
  check('account/repos 账号不存在给可读错误', reposMissing.json?.ok === false && String(reposMissing.json?.error ?? '').length > 0, JSON.stringify(reposMissing.json ?? {}).slice(0, 200))
}

await rm(tmp, { recursive: true, force: true })

if (failures.length > 0) {
  console.error(`✗ 加固回归失败 ${failures.length} 项：`)
  for (const item of failures) console.error('  - ' + item)
  process.exit(1)
}
console.log(`✓ 加固回归通过 ${pass} 项`)
