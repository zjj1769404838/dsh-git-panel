#!/usr/bin/env node
/**
 * 契约门禁：校验插件能被 DSH 正确加载所需的最小契约。
 * 任何一条不过，安装后就会出现「插件装了但入口不显示 / 客户端不执行」。
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

check('package.json name 与目录一致', pkg.name === 'dsh-git-panel', `实际 ${pkg.name}`)
check('type=module', pkg.type === 'module')
check('main 指向 lib/index.js', pkg.main === 'lib/index.js', `实际 ${pkg.main}`)

const exportsMap = pkg.exports ?? {}
check('exports "." 存在', exportsMap['.'] === './lib/index.js', JSON.stringify(exportsMap['.']))
check('exports "./client" 存在', exportsMap['./client'] === './lib/client.js', JSON.stringify(exportsMap['./client']))
check('exports "./package.json" 存在', exportsMap['./package.json'] === './package.json')
check('exports "./cordis.patch.yml" 存在', exportsMap['./cordis.patch.yml'] === './cordis.patch.yml')

check('dsh.manifestVersion 存在', Number(pkg.dsh?.manifestVersion) >= 1, JSON.stringify(pkg.dsh?.manifestVersion))
check('dsh.bundle.patch 指向 cordis.patch.yml', pkg.dsh?.bundle?.patch === './cordis.patch.yml', JSON.stringify(pkg.dsh?.bundle?.patch))
check('dsh.client.platform=web', pkg.dsh?.client?.platform === 'web', JSON.stringify(pkg.dsh?.client?.platform))
check('dsh.client.inject 是数组', Array.isArray(pkg.dsh?.client?.inject), JSON.stringify(pkg.dsh?.client?.inject))

const patchRaw = await readText(resolve(root, 'cordis.patch.yml'))
check('cordis.patch.yml 存在', patchRaw !== null)
if (patchRaw) {
  check('patch 含 insert 行', /^\s*-?\s*insert:/m.test(patchRaw), patchRaw.trim())
  check('patch 含插件 id', patchRaw.includes(`id: ${pkg.name}`), patchRaw.trim())
  check('patch 含插件 name', patchRaw.includes(`name: ${pkg.name}`), patchRaw.trim())
}

check('lib/index.js 已构建', await exists(resolve(root, 'lib/index.js')))
check('lib/client.js 已构建', await exists(resolve(root, 'lib/client.js')))

const nodeOut = await readText(resolve(root, 'lib/index.js'))
check('node 产物非空', (nodeOut?.length ?? 0) > 1000, `${nodeOut?.length ?? 0} 字节`)
if (nodeOut) {
  // 版本号一致性：PLUGIN_VERSION 必须等于 package.json version，否则 /health 会骗人。
  check(
    'PLUGIN_VERSION 与 package.json version 一致',
    nodeOut.includes(`"${pkg.version}"`) || nodeOut.includes(`'${pkg.version}'`),
    `期望 ${pkg.version}`,
  )
  check('node 产物导出 name', /export\s*\{[^}]*\bname\b/.test(nodeOut) || nodeOut.includes('name = "dsh-git-panel"'))
  check('node 产物注册了 webServer 路由', nodeOut.includes('/dsh-git-panel'))
}

const clientOut = await readText(resolve(root, 'lib/client.js'))
check('client 产物非空', (clientOut?.length ?? 0) > 1000, `${clientOut?.length ?? 0} 字节`)
if (clientOut) {
  check('client 产物带 ModuleLoader banner', clientOut.includes('__ModuleLoader__.load'))
  check('client 产物 id 与包名一致', clientOut.includes(`id: "${pkg.name}"`) || clientOut.includes(`id: '${pkg.name}'`))
  check('client 产物带 factory return footer', clientOut.trimEnd().endsWith('return module.exports; } });'))
  check('client 未打包 React（应为 external）', !/function\s+createElement\s*\(/.test(clientOut) || clientOut.includes('require("react")'))
  check('client 注册 conversation.input.left', clientOut.includes('conversation.input.left'))
  check('client 注册 settings.section（配置在设置页）', clientOut.includes('settings.section'))
  check('client 使用 baseURI 拼接口地址', clientOut.includes('baseURI'))
  check('client 读会话 cwd（sessions.list 快照）', clientOut.includes('getSnapshot') && clientOut.includes('cwd'))
  check('client 轮询仓库状态接口', clientOut.includes('/repo/status'))
  check('client 不再自绘配置弹层（无 dgp-overlay）', !clientOut.includes('dgp-overlay'))
  check('client 非仓库时保留降级入口（data-norepo）', clientOut.includes('data-norepo') && clientOut.includes('notRepo'))
  check('client 点击 chip 打开自带菜单（不再依赖合成快捷键）', clientOut.includes('dgp-menu') && clientOut.includes('aria-expanded'))
  check('client 提供初始化仓库入口', clientOut.includes('/repo/init') && clientOut.includes('menuInit'))
  // 交互逻辑：点开先检测；检测失败与「未初始化」必须区分开，切换项目要重新检测
  check('client 区分检测失败（menuDetectFailed）', clientOut.includes('menuDetectFailed'))
  check('client 已初始化时不再提示初始化（alreadyRepo）', clientOut.includes('alreadyRepo'))
  check('client 用 reason 区分未初始化与检测失败', clientOut.includes('no-repo') && clientOut.includes('invalid'))
  check('client 订阅会话列表以跟随项目切换（useSyncExternalStore）', clientOut.includes('useSyncExternalStore'))
  check('client 每次打开菜单都重新检测（reload）', clientOut.includes('reload'))
  // 浮层：菜单必须 portal 到 body 且层级高于宿主浮层（宿主 commands/input-trigger 用 100，panel 用 1100）
  check('client 菜单用 createPortal 挂到 body', clientOut.includes('createPortal') && clientOut.includes('react-dom'))
  check('client 菜单层级高于宿主浮层（z-index:1200）', clientOut.includes('z-index:1200'))
  check('client 菜单自带主题变量（portal 后不继承 dgp-root）', clientOut.includes('dgp-portal'))
  // 分支拓扑图：车道式 DAG（节点 + 同车道竖线 + 跨车道贝塞尔转折线）
  check('client 渲染分支拓扑图（dgp-graph）', clientOut.includes('dgp-graph'))
  check('client 用 SVG 画车道与节点', clientOut.includes('"svg"') && clientOut.includes('viewBox'))
  check('client 转折线用三次贝塞尔（C 命令）', /C\$\{|" C"|C\$/.test(clientOut) || clientOut.includes(' C'))
  check('client 按车道取色（laneColor + --dgp-lane）', clientOut.includes('laneColor') && clientOut.includes('--dgp-lane'))
  check('client 拉取提交图接口（/repo/graph）', clientOut.includes('/repo/graph'))
  check('client 图区超宽时横向滚动（overflow:auto）', clientOut.includes('dgp-graph-body'))
  check('client 节点悬浮/选中反馈（data-active）', clientOut.includes('data-active'))
  check('client ref chip 区分 local/remote/tag/head', clientOut.includes('data-kind') && clientOut.includes('graphHead'))
  // 「打开 Git 设置」：桌面端快捷键走原生 IPC，合成 keydown 到不了 settings.open，
  // 必须点宿主设置触发按钮 / 调 shortcuts.invoke，两条路都要在产物里。
  check('client 打开设置不依赖合成快捷键（点宿主触发按钮）', clientOut.includes('aria-haspopup') && clientOut.includes('aria-keyshortcuts'))
  check('client 打开设置走 shortcuts.invoke 兜底', clientOut.includes('settings.open') && clientOut.includes('invoke'))
  check('client 设置面板锚点用 data-shortcut-modal', clientOut.includes('data-shortcut-modal'))
  // 打开设置后要落在 Git 分节，而不是停在默认页；靠导航行 aria-current 判断当前分节。
  check('client 打开设置后定位到 Git 分节（aria-current）', clientOut.includes('aria-current'))
  check('client 设置触发按钮排除已展开态（aria-expanded）', clientOut.includes('aria-expanded'))
  // 误跳「智能体团队」的回归：Agent Teams 触发按钮也是 aria-haspopup="dialog"，
  // 必须靠 data-team-action / 文案排除，且绝不允许退化成「随便拿第一个按钮」。
  check('client 打开设置排除智能体团队按钮（data-team-action）', clientOut.includes('data-team-action'))
  check('client 设置触发按钮只认文案匹配（设置/Settings）', clientOut.includes('Settings|Preferences') || clientOut.includes('Preferences'))
  check('client 已 inject shortcuts 服务', /inject\s*=\s*\[[^\]]*['"]shortcuts['"]/.test(clientOut))
  // 宿主设置按钮只是 settings.launcher slot 的 fallback，被账号菜单占用后不在 DOM；
  // 真入口是账号菜单里的「设置」项，必须走这条路径。
  check('client 打开设置走宿主账号菜单（账号菜单）', clientOut.includes('账号菜单'))
  check('client 账号菜单里找「设置」菜单项', clientOut.includes('role="menu"') && clientOut.includes('menuitem'))
  check('client 快捷键兜底同时试 Ctrl+, 与 Ctrl+Alt+,', clientOut.includes('altKey'))
  // ---- 2026-10-29 UI 增强：统计条 / toast / 骨架屏 / 空状态 / 改动明细 / 默认账号 / 重新授权 / 当前目录授权 ----
  check('client 渲染统计条（dgp-stats）', clientOut.includes('dgp-stats'))
  check('client 统计条带语义色档（data-tone=ok|warn|danger）', clientOut.includes('dgp-stat') && clientOut.includes('data-tone'))
  check('client 统计条用等宽数字（tabular-nums）', clientOut.includes('tabular-nums'))
  check('client 提供 toast 组件（dgp-toast）', clientOut.includes('dgp-toast'))
  check('client toast 用 aria-live 播报', clientOut.includes('aria-live'))
  check('client toast 用 portal 挂在 body', clientOut.includes('createPortal') && clientOut.includes('dgp-toast-wrap'))
  check('client 提供骨架屏（dgp-skel）', clientOut.includes('dgp-skel'))
  check('client 骨架屏尊重 reduced-motion', clientOut.includes('prefers-reduced-motion'))
  check('client 提供图形化空状态（dgp-empty）', clientOut.includes('dgp-empty'))
  check('client 渲染工作区改动明细（dgp-changes）', clientOut.includes('dgp-changes'))
  check('client 拉取改动明细接口（/repo/changes）', clientOut.includes('/repo/changes'))
  check('client 改动明细区分增删（data-sign=add|del）', clientOut.includes('data-sign'))
  check('client 支持设定默认账号（defaultAccountId）', clientOut.includes('defaultAccountId'))
  check('client 支持重新授权（reauthTarget）', clientOut.includes('reauthTarget'))
  check('client 重新授权有提示条（dgp-callout）', clientOut.includes('dgp-callout'))
  check('client 已移除「当前会话仓库」快捷授权（无 dgp:cwd 通道）', !clientOut.includes('dgp:cwd') && !clientOut.includes('scopeCurrent'))
  check('client 旧 note 动态反馈机制已移除（改用 toast）', !clientOut.includes('setNote'))
  check('client 菜单静态提示行仍保留（dgp-menu-note）', clientOut.includes('dgp-menu-note'))
  // ---- 2026-10-29 Git 工作台（IDEA 式主面板 + 二级弹窗）----
  check('client 渲染 Git 工作台主面板（dgp-wb）', clientOut.includes('dgp-wb') && clientOut.includes('wbTitle'))
  check('client 工作台顶栏有 Fetch/Pull/Push', clientOut.includes('/repo/fetch') && clientOut.includes('/repo/pull') && clientOut.includes('/repo/push'))
  check('client 工作台左侧变更列表带勾选与批量操作', clientOut.includes('/repo/stage') && clientOut.includes('/repo/unstage') && clientOut.includes('/repo/discard'))
  check('client discard 强制二次确认（confirmed:true）', clientOut.includes('confirmed: true'))
  check('client 工作台提交走 /repo/commit 且带 amend', clientOut.includes('/repo/commit') && clientOut.includes('amend'))
  check('client 分支操作走 /repo/branches/*', clientOut.includes('/repo/branches/create') && clientOut.includes('/repo/branches/checkout') && clientOut.includes('/repo/branches/delete'))
  check('client 分支管理走二级弹窗（dgp-modal）', clientOut.includes('dgp-modal-mask') && clientOut.includes('"dialog"'))
  check('client 提交详情弹窗拉 /repo/commit', clientOut.includes('/repo/commit?cwd=') || clientOut.includes('/repo/commit'))
  check('client 远程仓库管理走 /repo/remotes/*', clientOut.includes('/repo/remotes/add') && clientOut.includes('/repo/remotes/remove'))
  check('client Pull 策略弹窗提供 merge/rebase', clientOut.includes('wbPullMerge') && clientOut.includes('wbPullRebase'))
  check('client 提交前校验暂存区与消息（wbCommitNeedsStaged）', clientOut.includes('wbCommitNeedsStaged'))
  check('client 同步失败分三态（conflicted/rejected/missingConfig）', clientOut.includes('syncConflicted') && clientOut.includes('syncRejected') && clientOut.includes('syncMissingConfig'))
  check('client 未初始化时只显示初始化入口（wbInitHint）', clientOut.includes('wbInitHint'))
  check('client 未授权时引导去设置（wbUnauthorizedHint）', clientOut.includes('wbUnauthorizedHint'))
  check('client 空仓库历史给空态（wbNoCommits）', clientOut.includes('wbNoCommits'))
  check('client 操作有 busy 防重复提交（canCommit 门 + run 守卫）', clientOut.includes('wbCommitNeedsStaged') && clientOut.includes('actionFailed'))
  check('client diff 预览带截断提示（diffTruncated）', clientOut.includes('diffTruncated'))
}
// ---- node 半边：git-ops 命令层与工作台端点 ----
{
  const gitOps = await readText(resolve(root, 'src/node/git-ops.ts'))
  if (gitOps) {
    check('git-ops 提供分支读写（readBranches/createBranch/checkoutBranch）', gitOps.includes('export async function readBranches') && gitOps.includes('export async function createBranch') && gitOps.includes('export async function checkoutBranch'))
    check('git-ops 提供暂存/提交（stagePaths/commitStaged）', gitOps.includes('export async function stagePaths') && gitOps.includes('export async function commitStaged'))
    check('git-ops 提交前校验暂存区非空', gitOps.includes("diff', '--cached', '--quiet"))
    check('git-ops 分支名合法性校验（validBranchName）', gitOps.includes('export function validBranchName'))
    check('git-ops push 用 --force-with-lease 而非 --force', gitOps.includes('--force-with-lease') && !gitOps.includes("'--force',"))
    check('git-ops pull 支持 merge/rebase 策略', gitOps.includes('--no-rebase') && gitOps.includes('--rebase'))
    check('git-ops 同步结果分类（classifySync）', gitOps.includes('function classifySync'))
  }
  const handlerSrc = await readText(resolve(root, 'src/node/handler.ts'))
  if (handlerSrc) {
    for (const route of ['/repo/branches', '/repo/remotes', '/repo/commits', '/repo/commit', '/repo/diff', '/repo/stage', '/repo/unstage', '/repo/discard', '/repo/commit', '/repo/pull', '/repo/push', '/repo/fetch', '/repo/remotes/add', '/repo/removes'.replace('removes', 'remotes/remove')]) {
      check(`handler 挂载工作台端点 ${route}`, handlerSrc.includes(`'${route}'`))
    }
    check('handler 工作台写端点统一 requireWrite 闸门', handlerSrc.includes('const requireWrite'))
    check('handler 只读端点 fail-closed（requireRead）', handlerSrc.includes('const requireRead'))
    check('handler discard 端点强制 confirmed', handlerSrc.includes('body.confirmed !== true'))
  }
}

if (failures.length > 0) {
  console.error(`✗ gates 失败 ${failures.length} 项：`)
  for (const item of failures) console.error('  - ' + item)
  process.exit(1)
}
console.log(`✓ gates 通过 ${passes.length} 项`)
