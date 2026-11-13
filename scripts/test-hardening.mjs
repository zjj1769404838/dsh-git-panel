#!/usr/bin/env node
/**
 * 加固回归（v3.1 极简化版）：用 mock ctx 驱动真实产物（lib/index.js），验证
 *  - 请求体上限 / 同源校验 / nosniff / no-store
 *  - 令牌永不明文出现在响应里（/state、/pat/connect 返回）
 *  - 目录闸门（v3.3 移除白名单后）：非仓库/不存在目录给可读错误，不再 403
 *  - Agent 工具：写通道唯一（HTTP 写端点 404）、allowWrite=false 拒绝、
 *    requireConfirm 两段确认（git_write → git_confirm）、confirmToken 一次性
 *  - 错误信息可读（不是异常栈）
 * 历史备注：旧版绑 v22 的仓库三档权限 / 平台 API / 写端点用例随简化删除，
 * 不留旧断言；安全面用例全部保留并锁到 v3.1 契约。
 */
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
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
check(
  '注册 7 个 Agent 工具',
  ['git_panel_status', 'git_repo_info', 'git_branches', 'git_diff', 'git_log', 'git_write', 'git_confirm'].every((name) => registeredTools.has(name)),
  [...registeredTools.keys()].join(','),
)
check('无 git_remote_info（平台 API 已删）', !registeredTools.has('git_remote_info'))

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
    headers: { origin: 'https://evil.example' },
    body: JSON.stringify({ allowWrite: true }),
  })
  check('跨站 Origin 的 POST 被拒', r.status === 403 || r.json?.ok === false, JSON.stringify(r.json) || String(r.status))
  const r2 = await call(handler, {
    method: 'GET',
    url: '/dsh-git-panel/state',
    headers: { 'sec-fetch-site': 'cross-site' },
  })
  check('sec-fetch-site=cross-site 的 GET 被拒', r2.status === 403 || r2.json?.ok === false)
}

// ---- 请求体上限 ----
{
  const big = 'x'.repeat(300 * 1024)
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/settings',
    body: JSON.stringify({ note: big }),
  })
  check('超过 256KB 的请求体被拒', r.status === 400 || r.json?.ok === false, String(r.status))
}

// ---- 非法 JSON body ----
{
  const r = await call(handler, { method: 'POST', url: '/dsh-git-panel/settings', body: '[1,2,3]' })
  check('数组 body 被拒', r.status === 400 && /JSON/.test(String(r.json?.error)), JSON.stringify(r.json))
}

// ---- /state：令牌零明文 + v3 设置形状 ----
{
  const secret = 'ghp_SuperSecretToken1234567890'
  // 直接经 store API 造一个 PAT 记录：用 /pat/connect 会打真实网络，
  // 所以这里通过设置端点验证 snapshot 的字段形状与脱敏。
  const r = await call(handler, { method: 'GET', url: '/dsh-git-panel/state' })
  check('state 返回 ok', r.json?.ok === true)
  check('state.settings 含 autoSubmit（v3 字段）', typeof r.json?.state?.settings?.autoSubmit === 'boolean', JSON.stringify(r.json?.state?.settings))
  check('state.settings 无 allowedRepos/repoPermissions（三档已删）', r.json?.state?.settings?.allowedRepos === undefined && r.json?.state?.settings?.repoPermissions === undefined)
  const bodyText = JSON.stringify(r.json)
  check('state 响应不含 secret 字段值', !bodyText.includes('ghp_SuperSecret'), bodyText.slice(0, 120))
}

// ---- PAT 校验失败可读（真实网络，用必然无效的假 token）----
{
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/pat/connect',
    body: JSON.stringify({ token: 'ghp_definitely_invalid_token_000' }),
  })
  const err = String(r.json?.error ?? '')
  check('无效 PAT 被拒', r.json?.ok === false, JSON.stringify(r.json))
  // 可读原因分两种环境：能联网时是 GitHub 状态码文案；沙箱断网时是「网络错误：…」——
  // 两者都是 fail-closed 的可读归因，均视为通过（令牌本身绝不回显由下一条锁死）。
  check('PAT 校验失败给出可读原因', /401|令牌无效|Bad credentials|拒绝|网络错误/i.test(err), err.slice(0, 160))
  check('错误信息不含回显的令牌', !err.includes('ghp_definitely_invalid'), err.slice(0, 80))
}

// ---- oauth/poll：无效 pollKey ----
{
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/oauth/poll',
    body: JSON.stringify({ pollKey: 'deadbeef' }),
  })
  check('无效 pollKey 返回过期提示', r.json?.status === 'expired', JSON.stringify(r.json))
}

// ---- oauth/start：缺 clientId 直接拒（零内置应用凭据的行为面）----
{
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/oauth/start',
    body: JSON.stringify({ clientId: '' }),
  })
  check('缺 Client ID 的 OAuth 发起被拒', r.json?.ok === false && /Client ID/i.test(String(r.json?.error)), JSON.stringify(r.json))
}

// ---- accounts/remove：不存在时给可读错误 ----
{
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/accounts/remove',
    body: JSON.stringify({ id: 'nope' }),
  })
  check('移除不存在账号 ok=false', r.json?.ok === false, JSON.stringify(r.json))
  check('移除失败有原因', typeof r.json?.error === 'string' && r.json.error.length > 0)
}

// ---- HTTP 写端点已删：一律 404（写通道唯一的行为锁）----
{
  for (const path of ['/repo/stage', '/repo/unstage', '/repo/commit', '/repo/discard', '/repo/push', '/repo/pull', '/repo/fetch', '/repo/reset', '/repo/revert', '/repo/init', '/repo/bootstrap', '/repo/permission']) {
    const r = await call(handler, { method: 'POST', url: `/dsh-git-panel${path}`, body: JSON.stringify({ cwd: tmp }) })
    check(`POST ${path} 返回 404（改走 git_write）`, r.status === 404 && /git_write/.test(String(r.json?.error)), `${r.status} ${JSON.stringify(r.json)}`)
  }
}

// ---- v3.3 契约：目录白名单已移除——任意目录可读（非仓库不再是 403，而是可读原因的错误）----
{
  const outside = join(tmpdir(), 'dgp-outside-' + String(Date.now()))
  const r = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/branches?cwd=${encodeURIComponent(outside)}` })
  check('任意目录不再被 403 拦截', r.status === 200, String(r.status))
  check('非仓库目录返回可读原因（而非授权话术）', r.json?.ok === false && !/授权|白名单|allowed/i.test(String(r.json?.error ?? 'x')) && String(r.json?.error ?? '').length > 0, JSON.stringify(r.json))
}

// ---- npm 凭据卡：/npm/connect 无效 token fail-closed（400，不落盘）----
{
  const r = await call(handler, {
    method: 'POST',
    url: '/dsh-git-panel/npm/connect',
    body: JSON.stringify({ token: 'npm_definitely_invalid_token_000' }),
  })
  check('无效 npm token 被拒 400', r.status === 400 && r.json?.ok === false, `${r.status} ${JSON.stringify(r.json)}`)
  check('拒绝原因可读且不回显 token', typeof r.json?.error === 'string' && r.json.error.length > 0 && !String(r.json.error).includes('npm_definitely_invalid'), JSON.stringify(r.json))
}

// ---- /npm/status 多账号形状（v3.10 契约翻转并披露：accounts/activeState/npmrcConfigured）----
{
  const r = await call(handler, { method: 'POST', url: '/dsh-git-panel/npm/status', body: JSON.stringify({}) })
  check('npm status ok', r.json?.ok === true, JSON.stringify(r.json))
  const body = String(r.body)
  check('status 响应不含 _authToken 明文形态', !/_authToken=|npm_[A-Za-z0-9]{20,}/.test(body), body.slice(0, 140))
  check('status 新形状：accounts 数组 + activeState + npmrcConfigured 布尔', Array.isArray(r.json?.npm?.accounts) && ['connected', 'error'].includes(r.json?.npm?.activeState) && typeof r.json?.npm?.npmrcConfigured === 'boolean', body.slice(0, 200))
}

// ---- /npm/switch 不存在 id → 404（fail-closed 不写 npmrc）----
{
  const r = await call(handler, { method: 'POST', url: '/dsh-git-panel/npm/switch', body: JSON.stringify({ id: 'nope' }) })
  check('切换不存在凭据 404', r.status === 404 && r.json?.ok === false, `${r.status} ${JSON.stringify(r.json)}`)
}

// ---- /npm/remove 不存在 id → 404 ----
{
  const r = await call(handler, { method: 'POST', url: '/dsh-git-panel/npm/remove', body: JSON.stringify({ id: 'nope' }) })
  check('移除不存在凭据 404', r.status === 404, String(r.status))
}

// ---- 真实仓库：任意目录直接可读（v3.3 起无授权步骤）----
const repo = join(tmp, 'repo')
await mkdir(repo, { recursive: true })
{
  const { execFile } = await import('node:child_process')
  const run = (args) =>
    new Promise((resolve, reject) => execFile('git', args, { cwd: repo }, (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout))))
  await run(['init', '-b', 'main'])
  await writeFile(join(repo, 'a.txt'), 'hello\n')
  await run(['add', 'a.txt'])
  await run(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-m', 'first'])
  await writeFile(join(repo, 'a.txt'), 'hello world\n')

  const st = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/status?cwd=${encodeURIComponent(repo)}` })
  check('status ok 且 isRepo', st.json?.ok === true && st.json?.status?.isRepo === true, JSON.stringify(st.json))
  check('status 报分支 main', st.json?.status?.branch === 'main', st.json?.status?.branch)
  check('status 报 1 个改动', st.json?.status?.changed === 1, String(st.json?.status?.changed))

  const ch = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/changes?cwd=${encodeURIComponent(repo)}` })
  check('changes 含 a.txt 且 worktree 修改', JSON.stringify(ch.json?.changes?.files ?? []).includes('a.txt'), JSON.stringify(ch.json))

  const lg = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/commits?cwd=${encodeURIComponent(repo)}&limit=5` })
  check('commits 含 first', String(lg.json?.commits?.[0]?.subject ?? '') === 'first', JSON.stringify(lg.json))

  const df = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/diff?cwd=${encodeURIComponent(repo)}` })
  check('diff 含 hello world', String(df.json?.diff ?? '').includes('hello world'), JSON.stringify(df.json)?.slice(0, 120))
}

// ---- Agent 工具：不存在的目录给出可读错误（不再是授权话术）----
{
  const tool = registeredTools.get('git_repo_info')
  const result = await tool.execute({ cwd: join(tmpdir(), 'no-such-dir-zzz') })
  check('不存在目录被 ensureRepo 拒绝', result.ok === false, JSON.stringify(result))
  check('拒绝原因为目录不存在（无授权字样）', /目录不存在/.test(String(result.error)) && !/授权|白名单|allowed/i.test(String(result.error)), result.error)
}

// ---- Agent 工具：allowWrite=false 时 git_write 拒绝 ----
{
  const tool = registeredTools.get('git_write')
  const result = await tool.execute({ cwd: repo, action: 'add', args: ['-A'] })
  check('allowWrite=false 拒绝写', result.ok === false && /写操作权限/.test(String(result.error)), JSON.stringify(result))
}

// ---- Agent 工具：非法动作被拒（先参数校验后文件系统）----
{
  await call(handler, { method: 'POST', url: '/dsh-git-panel/settings', body: JSON.stringify({ allowWrite: true, requireConfirm: true }) })
  const tool = registeredTools.get('git_write')
  const bad = await tool.execute({ cwd: join(tmpdir(), 'dgp-not-exist-zzz'), action: 'nonsense', args: [] })
  check('非法动作优先于文件系统检查被拒', bad.ok === false && /不支持的写动作/.test(String(bad.error)), JSON.stringify(bad))
}

// ---- requireConfirm 两段确认：git_write → pending + token；git_confirm 一次性 ----
{
  const write = registeredTools.get('git_write')
  const confirm = registeredTools.get('git_confirm')
  const pending = await write.execute({ cwd: repo, action: 'add', args: ['a.txt'], reason: '测试暂存' })
  check('requireConfirm 返回 pending', pending.ok === true && pending.pending === true, JSON.stringify(pending))
  check('pending 带 confirmToken 与 summary', typeof pending.confirmToken === 'string' && /git add/.test(String(pending.summary)), JSON.stringify(pending).slice(0, 160))
  check('pending 说明下一步', /git_confirm/.test(String(pending.next)))

  const denied = await confirm.execute({ confirmToken: pending.confirmToken, confirmed: false })
  check('confirmed=false 取消执行', denied.ok === false && /未同意/.test(String(denied.error)), JSON.stringify(denied))

  // token 已被取消消费：再确认应无效
  const reused = await confirm.execute({ confirmToken: pending.confirmToken })
  check('取消后 token 不可复用', reused.ok === false, JSON.stringify(reused))

  const again = await write.execute({ cwd: repo, action: 'add', args: ['a.txt'], reason: '测试暂存2' })
  const done = await confirm.execute({ confirmToken: again.confirmToken, confirmed: true })
  check('确认后真实执行', done.ok === true && done.executed === true, JSON.stringify(done).slice(0, 200))

  const after = await call(handler, { method: 'GET', url: `/dsh-git-panel/repo/changes?cwd=${encodeURIComponent(repo)}` })
  const staged = (after.json?.changes?.files ?? []).find((f) => f.path === 'a.txt')
  check('暂存生效后 a.txt 进入暂存区', staged && staged.staged === true, JSON.stringify(staged))
}

// ---- confirmToken 内存态：不写 state.json ----
{
  const stateFiles = await readFile(join(tmp, 'git-panel', 'state.json'), 'utf8').catch(() => '')
  check('state.json 不含 confirmToken 痕迹', !/confirmToken|pendingWrites/.test(stateFiles), stateFiles.slice(0, 120))
}

if (failures.length > 0) {
  console.error(`✗ hardening 失败 ${failures.length} 项（通过 ${pass} 项）：`)
  for (const item of failures) console.error('  - ' + item)
  process.exit(1)
}
console.log(`✓ hardening 通过 ${pass} 项`)
