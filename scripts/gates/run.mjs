#!/usr/bin/env node
/**
 * 契约门禁（v3.1 极简化版）：校验插件能被 DSH 正确加载所需的最小契约，
 * 以及本轮简化拍板的行为契约（写通道唯一性、命令注入语义、依赖归零）。
 * 任何一条不过，安装后就会出现「插件装了但入口不显示 / 客户端不执行」。
 * 历史备注：旧版 530 行 harness 断言 v22 工作台/多平台账号/Markdown 预览等
 * 已删除功能面，随简化整体重写；删功能必删对应断言，不留旧断言。
 */
import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const failures = []
const passes = []

function check(name, condition, detail = '') {
  if (condition) passes.push(name)
  else failures.push(detail ? `${name} — ${detail}` : name)
}

async function readText(path) {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const pkgRaw = await readText(resolve(root, 'package.json'))
check('package.json 存在', pkgRaw !== null)
const pkg = pkgRaw ? JSON.parse(pkgRaw) : {}

check(
  'package.json name 与目录一致（允许 scope 前缀）',
  pkg.name === 'dsh-git-panel' || pkg.name === '@zjj/dsh-git-panel' || pkg.name === '@zjjlivingfree/dsh-git-panel',
  `实际 ${pkg.name}`,
)
check('type=module', pkg.type === 'module')
check('main 指向 lib/index.js', pkg.main === 'lib/index.js')
check('exports 含 ./client ./package.json ./cordis.patch.yml', pkg.exports && './client' in pkg.exports && './package.json' in pkg.exports && './cordis.patch.yml' in pkg.exports)
check('dsh.bundle.patch 指向 ./cordis.patch.yml', pkg.dsh?.bundle?.patch === './cordis.patch.yml')
check('dsh.client.platform=web', pkg.dsh?.client?.platform === 'web')
check('files 含 lib 与 cordis.patch.yml', Array.isArray(pkg.files) && pkg.files.includes('lib') && pkg.files.includes('cordis.patch.yml'))
check('运行时依赖归零（v3 拍板：prismjs 已删）', pkg.dependencies === undefined || Object.keys(pkg.dependencies).length === 0, JSON.stringify(pkg.dependencies ?? {}))

const cordisRaw = await readText(resolve(root, 'cordis.patch.yml'))
check('cordis.patch.yml 存在', cordisRaw !== null)
check('cordis.patch.yml 声明 insert + name=包名', cordisRaw !== null && cordisRaw.includes('- insert:') && (cordisRaw.includes(`'${pkg.name}'`) || cordisRaw.includes(`"${pkg.name}"`)))

// ---- 产物存在且与源码同步（构建纪律：改 src 必先重建再测）----
const libIndex = await readText(resolve(root, 'lib/index.js'))
const libClient = await readText(resolve(root, 'lib/client.js'))
check('lib/index.js 存在', libIndex !== null)
check('lib/client.js 存在', libClient !== null)
if (libIndex && libClient) {
  check('lib/client.js ModuleLoader id=包名', libClient.includes(`window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}`))
  check('lib 产物不含 prismjs 残留', !libClient.includes('node_modules/prismjs'))
  check('lib/index.js 注册 name 常量与包名一致', libIndex.includes(JSON.stringify(pkg.name)))
}

// ---- node 半边契约 ----
const srcIndex = await readText(resolve(root, 'src/index.ts'))
check('src/index.ts 导出 name/inject/apply', srcIndex !== null && srcIndex.includes('export const name') && srcIndex.includes("export const inject = ['webServer']") && srcIndex.includes('export function apply'))
check('src/index.ts 不再软取 llm/defaultModel（suggest 已删）', srcIndex !== null && !srcIndex.includes("ctx.get?.('llm')"))
// 版本锁步：package.json / src/index.ts PLUGIN_VERSION / package-lock.json 三者一致，防语义漂移
const lockRaw = await readText(resolve(root, 'package-lock.json'))
const lock = lockRaw ? JSON.parse(lockRaw) : {}
const srcVersion = srcIndex !== null ? (srcIndex.match(/PLUGIN_VERSION = '([^']+)'/) ?? [])[1] : null
check('PLUGIN_VERSION 与 package.json version 锁步', srcVersion === pkg.version, `src ${srcVersion} vs pkg ${pkg.version}`)
check('package-lock 版本锁步', lock.version === pkg.version && lock.packages?.['']?.version === pkg.version, `${lock.version}/${lock.packages?.['']?.version} vs ${pkg.version}`)

const handler = await readText(resolve(root, 'src/node/handler.ts'))
check('handler 存在且 ROUTE_PREFIX 不变', handler !== null && handler.includes("export const ROUTE_PREFIX = '/dsh-git-panel'"))
check('handler 同源校验保留', handler !== null && handler.includes('export function isSameOrigin'))
for (const ep of ['/repo/status', '/repo/changes', '/repo/branches', '/repo/commits', '/repo/diff', '/repo/tags', '/repo/stash', '/account/repos', '/pat/connect', '/oauth/start', '/oauth/poll', '/accounts/remove', '/accounts/recheck', '/settings']) {
  check(`handler 保留端点 ${ep}`, handler !== null && handler.includes(`'${ep}'`))
}
// 行为契约：写执行通道唯一（UI 侧 HTTP 写端点已删，写只走 Agent 工具）。
// 注意 GET /repo/commit（提交详情，只读）与被删的 POST /repo/commit 同名，
// 字符串判不了分支——改写函数面断言：handler 不得 import/调用任何写操作函数。
const WRITE_FNS = ['stagePaths', 'commitStaged', 'pushRepo', 'pullRepo', 'fetchRepo', 'discardPaths', 'resetToCommit', 'revertCommit', 'createBranch', 'deleteBranch', 'stashSave', 'stashAction']
check('handler 不引用任何 git-ops 写函数（写通道唯一）', handler !== null && !WRITE_FNS.some((fn) => handler.includes(fn)))
for (const gone of ['/repo/stage', '/repo/unstage', '/repo/push', '/repo/pull', '/repo/fetch', '/repo/discard', '/repo/init', '/repo/bootstrap', '/repo/reset', '/repo/revert', '/repo/permission']) {
  check(`handler 已删写端点 ${gone}`, handler !== null && !handler.includes(`'${gone}'`))
}

// ---- Agent 工具契约（乙案：7 工具，写走 git_write/git_confirm）----
const tools = await readText(resolve(root, 'src/node/tools.ts'))
check('tools 注册 7 个 git_* 工具', tools !== null && ['git_panel_status', 'git_repo_info', 'git_branches', 'git_diff', 'git_log', 'git_write', 'git_confirm'].every((name) => tools.includes(`name: '${name}'`)))
check('tools 不再注册 git_remote_info（平台 API 已删）', tools !== null && !tools.includes("name: 'git_remote_info'"))
const WRITE_ACTIONS = ['init', 'add', 'commit', 'checkout', 'switch', 'restore', 'reset', 'stash', 'merge', 'rebase', 'push', 'pull', 'fetch', 'cherry-pick', 'revert', 'tag', 'branch', 'clean']
check('git_write 动作面覆盖基础 git（拍板红线）', tools !== null && WRITE_ACTIONS.every((action) => tools.includes(`'${action}'`)))
check('git_write 仍走 confirmToken 机制', tools !== null && tools.includes('confirmToken') && tools.includes('pendingWrites'))
// v3.3 拍板改契约（透明披露）：目录白名单闸门整体移除——旧断言「授权闸门=目录白名单」作废，
// 换成防复活断言：store/tools/handler 不得再出现 isRootAllowed/allowedRoots/normalizeRoots 标识符。
check('目录白名单闸门已移除且防复活（isRootAllowed 零出现）', tools !== null && !tools.includes('isRootAllowed') && !tools.includes('allowedRoots'))

// ---- store 契约 ----
const store = await readText(resolve(root, 'src/node/store.ts'))
check('store 设置含 autoSubmit（直接提交开关）', store !== null && store.includes('autoSubmit'))
// 标识符级判据（不能用 repoPermissions/allowedRepos 泛词——store 的迁移注释里合法提及它们）
check('store 仓库三档权限方法已删', store !== null && !store.includes('setRepoPermission') && !store.includes('isRepoWritableFor') && !store.includes('normalizeRepoPermissions'))
check('store 令牌密文存储（seal/open）', store !== null && store.includes('seal(') && store.includes('open('))

// ---- git 可移植路径发现契约（v3.13）----
const gitMod = await readText(resolve(root, 'src/node/git.ts'))
check('git 路径发现从环境变量推导 + DSH_GIT_PATH 覆盖（零硬编码个人路径）', gitMod !== null && gitMod.includes('process.env.ProgramFiles') && gitMod.includes("'DSH_GIT_PATH'") && !gitMod.includes('17694') && !gitMod.includes('my-projects') && !gitMod.includes('D:/'))
check('git 子进程 env.PATH 前置 Git 支持目录（GUI 启动缺 PATH 也能找到 git）', gitMod !== null && gitMod.includes('env: gitChildEnv()') && gitMod.includes('gitSupportDirs()') && gitMod.includes('delimiter'))
check('ENOENT 不再伪装成退出码1：spawnFailed 给出可读环境缺件提示', gitMod !== null && gitMod.includes('spawnFailed') && gitMod.includes('找不到 git 可执行文件'))

// ---- providers 契约：不内置任何第三方应用凭据 ----
const providers = await readText(resolve(root, 'src/node/providers.ts'))
check('providers 仅 GitHub 单平台', providers !== null && !providers.includes("'gitlab'") && !providers.includes("'gitea'"))
check('providers 设备码 client_id 由调用方传入（零内置凭据）', providers !== null && providers.includes('startDeviceFlow(clientId') && !/client_id:\s*['"]Iv/.test(providers))

// ---- client 半边契约（v3 命令注入器）----
const clientIndex = await readText(resolve(root, 'src/client/index.tsx'))
check('client 导出 inject + apply', clientIndex !== null && clientIndex.includes('export const inject') && clientIndex.includes('export function apply'))
check('client 注册 conversation.input.left', clientIndex !== null && clientIndex.includes("'conversation.input.left'"))
check('client 不再注册 settings.section（v3.2 拍板：设置并入面板）', clientIndex !== null && !clientIndex.includes("'settings.section'"))
check('面板含账号与授权折叠区（GearSection + details）', clientIndex !== null && clientIndex.includes('GearSection') && clientIndex.includes('<details'))
check('折叠区覆盖账号/写策略两块（目录编辑已随 v3.3 移除）', clientIndex !== null && clientIndex.includes('/pat/connect') && clientIndex.includes('/oauth/start') && clientIndex.includes('allowWrite') && !clientIndex.includes('allowedRoots'))
check('client 防复活：不再出现目录白名单标识符', clientIndex !== null && !clientIndex.includes('rootsTitle') && !clientIndex.includes('saveRoots'))
// v3.10：npm 凭据多账号+切换（active 账号同步 ~/.npmrc；旧单卡契约升级并披露）
check('npm 卡端点契约：connect/status/switch/remove 四端双侧在位', handler !== null && ['/npm/connect', '/npm/status', '/npm/switch', '/npm/remove'].every((p) => handler.includes(`'${p}'`) && clientIndex.includes(p)))
check('npm 多账号存储契约：store 有 npmAccounts 表 + active id + 密文替换语义', store !== null && store.includes('npmAccounts') && store.includes('npmActiveId') && store.includes('addNpmAccount') && store.includes('removeNpmAccount') && store.includes('setNpmActiveId'))
check('npm 切换 fail-closed：handler switch 先 whoami 验证失败不切换', handler !== null && /npm\/switch[\s\S]{0,900}whoamiNpm/.test(handler))
const npmMod = await readText(resolve(root, 'src/node/npm.ts'))
check('npm 模块契约：whoami Bearer 验证 + 仅写 TOKEN_KEY 行 + 备份语义', npmMod !== null && npmMod.includes('/-/whoami') && npmMod.includes('//registry.npmjs.org/:_authToken') && npmMod.includes('copyFileSync'))
check('npm-publish 指令模板指向面板 npm 卡（不再要求手动 npm login 为唯一路径）', clientIndex !== null && clientIndex.includes('「账号与授权 → npm」'))
check('指令模板统一引用 git_write（乙案受控通道）', clientIndex !== null && (clientIndex.match(/git_write/g) ?? []).length >= 6)
check('client 调用 injectCommand 注入', clientIndex !== null && clientIndex.includes('injectCommand('))
const shared = await readText(resolve(root, 'src/client/shared.tsx'))
check('shared 注入链含官方锚点 data-composer-input', shared !== null && shared.includes('[data-composer-input]'))
check('shared textarea 写入走原生 value setter', shared !== null && shared.includes('getOwnPropertyDescriptor(proto'))
check('shared 直接提交找发送按钮', shared !== null && shared.includes('findSendButton'))
check('shared 不再引用 highlight/prismjs', shared !== null && !shared.includes('highlight.js') && !shared.includes('prism'))

// ---- 已删件防复活 ----
for (const gone of ['src/client/workbench.tsx', 'src/client/settings.tsx', 'src/client/onboard.tsx', 'src/client/diffview.tsx', 'src/client/filebrowser.tsx', 'src/client/graphview.tsx', 'src/client/markdown.ts', 'src/client/highlight.ts', 'src/client/locales/index.ts', 'src/node/graph.ts', 'src/node/files.ts', 'src/node/suggest.ts', 'src/node/vault.ts.keep']) {
  if (gone.endsWith('.keep')) continue
  check(`已删 ${gone}`, (await exists(resolve(root, gone))) === false)
}
check('src/node/vault.ts 保留（令牌加密仍需要）', await exists(resolve(root, 'src/node/vault.ts')))

if (failures.length > 0) {
  console.error(`✗ gates 失败 ${failures.length} 项：`)
  for (const item of failures) console.error('  - ' + item)
  process.exit(1)
}
console.log(`✓ gates 通过 ${passes.length} 项`)
