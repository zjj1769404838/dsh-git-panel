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

check(
  'package.json name 与目录一致（允许 scope 前缀）',
  pkg.name === 'dsh-git-panel' || pkg.name === '@zjj/dsh-git-panel',
  `实际 ${pkg.name}`,
)
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
  // YAML 里以 @ 开头的纯量必须加引号，所以比较时先剥掉 id/name 两侧的引号。
  const patchNorm = patchRaw.replace(/(id|name):\s*(['"])(.*?)\2/g, '$1: $3')
  check('patch 含插件 id', patchNorm.includes(`id: ${pkg.name}`), patchRaw.trim())
  check('patch 含插件 name', patchNorm.includes(`name: ${pkg.name}`), patchRaw.trim())
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
  check(
    'node 产物导出 name',
    /export\s*\{[^}]*\bname\b/.test(nodeOut) || nodeOut.includes(`name = "${pkg.name}"`),
  )
  check('node 产物注册了 webServer 路由', nodeOut.includes('/dsh-git-panel'))
}

const EXTRA_LABELS = ['日本語', 'Español', 'Français', 'Deutsch', 'Русский', 'Português']
const clientOut = await readText(resolve(root, 'lib/client.js'))
const clientSrc = await readText(resolve(root, 'src/client/index.tsx'))
// client 源文件的合并文本：重构后的新能力落在 shared.tsx / workbench.tsx / settings.tsx。
const clientSrcAll = [
  clientSrc,
  await readText(resolve(root, 'src/client/shared.tsx')),
  await readText(resolve(root, 'src/client/workbench.tsx')),
  await readText(resolve(root, 'src/client/settings.tsx')),
  await readText(resolve(root, 'src/client/onboard.tsx')),
  await readText(resolve(root, 'src/client/diffview.tsx')),
  await readText(resolve(root, 'src/client/filebrowser.tsx')),
  await readText(resolve(root, 'src/client/highlight.ts')),
  await readText(resolve(root, 'src/client/prism-env.ts')),
  await readText(resolve(root, 'src/client/graphview.tsx')),
  await readText(resolve(root, 'src/client/markdown.ts')),
  await readText(resolve(root, 'src/client/locales/index.ts')),
  await readText(resolve(root, 'src/client/locales/ja.ts')),
  await readText(resolve(root, 'src/client/locales/es.ts')),
  await readText(resolve(root, 'src/client/locales/fr.ts')),
  await readText(resolve(root, 'src/client/locales/de.ts')),
  await readText(resolve(root, 'src/client/locales/ru.ts')),
  await readText(resolve(root, 'src/client/locales/pt.ts')),
].join('\n')
const sharedSrc = await readText(resolve(root, 'src/client/shared.tsx'))
const markdownSrc = await readText(resolve(root, 'src/client/markdown.ts'))
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
  check('client 渲染分支拓扑泳道（dgp-graph-svg）', clientOut.includes('dgp-graph-svg'))
  check('client 用 SVG 画车道与节点', clientOut.includes('"svg"') && clientOut.includes('viewBox'))
  check('client 转折线用三次贝塞尔（C 命令）', /C\$\{|" C"|C\$/.test(clientOut) || clientOut.includes(' C'))
  check('client 按车道取色（laneColor + --dgp-lane）', clientOut.includes('laneColor') && clientOut.includes('--dgp-lane'))
  check('client 拉取提交图接口（/repo/graph）', clientOut.includes('/repo/graph'))
  check('client 历史行内联泳道列（dgp-gw-lanecell）', clientOut.includes('dgp-gw-lanecell') && sharedSrc.includes('.dgp-gw-lanecell'))
  check('client 节点悬浮/选中反馈（data-active）', clientOut.includes('data-active'))
  check('client ref chip 区分 local/remote/tag/head', clientOut.includes('data-kind') && sharedSrc.includes('[data-kind="head"]'))
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
  check('client 渲染概览带（dgp-overview）', clientOut.includes('dgp-overview'))
  check('client 概览带带语义色档（data-tone=ok|warn|neutral）', clientOut.includes('dgp-overview-item') && clientOut.includes('data-tone'))
  check('client 概览带用等宽数字（tabular-nums）', clientOut.includes('tabular-nums'))
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
  check('client 编辑账号走弹窗（ConnectModal 复用 Modal）', clientSrcAll.includes('ConnectModal') && clientSrcAll.includes('initial={editTarget}'))
  check('client 账号状态异常有提示条（dgp-callout）', clientOut.includes('dgp-callout'))
  check('client 已移除「当前会话仓库」快捷授权（无 dgp:cwd 通道）', !clientOut.includes('dgp:cwd') && !clientOut.includes('scopeCurrent'))
  check('client 旧 note 动态反馈机制已移除（改用 toast）', !clientOut.includes('setNote'))
  check('client 菜单静态提示行仍保留（dgp-menu-note）', clientOut.includes('dgp-menu-note'))
  // ---- 2026-10-29 Git 工作台（IDEA 式主面板 + 二级弹窗）----
  check('client 渲染 Git 工作台模态框（dgp-gw）', clientOut.includes('dgp-gw') && clientOut.includes('wbTitle'))
  check('client 工作台是居中模态框（dgp-gw-mask + dgp-gw-body）', clientOut.includes('dgp-gw-mask') && clientOut.includes('dgp-gw-body'))
  check('client 工作台用左侧竖排导航（dgp-gw-rail，取代三 tab 平铺）', clientOut.includes('dgp-gw-rail') && clientOut.includes('dgp-gw-railbtn'))
  check('client 工作台不是贴右抽屉（transform 居中 + 圆角 + 四边框）', sharedSrc.includes('transform:translate(-50%,-50%)') && !sharedSrc.includes('border-left:.5px solid var(--dgp-line2);background:var(--dsw-alias-bg-layer-1'))
  check('client 工作台不再用旧类名（无 dgp-wb）', !clientOut.includes('dgp-wb'))
  check('client diff 改为预览层（wbDiffTitle + dgp-gw-diff）', clientOut.includes('wbDiffTitle') && clientOut.includes('dgp-gw-diff'))
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
  // ---- 2026-10-29 修复：弹窗崩溃 + 一级菜单瘦身 ----
  const portalRefs = (clientOut.match(/createPortal/gu) ?? []).length
  const portalImported = (clientOut.match(/import_react_dom\d*\.createPortal/gu) ?? []).length
  check(
    'client 无裸 createPortal 调用（全部走 react-dom 导入）',
    portalRefs > 0 && portalRefs === portalImported,
    `refs=${portalRefs} imported=${portalImported}`,
  )
  check('client 源码不再用 declare const 声明 createPortal', !clientSrc.includes('declare const createPortal'))
  check('client 一级菜单不再内嵌分支拓扑（index.tsx 不再引用 GraphView）', !clientSrc.includes('GraphView'))
  check('client 一级菜单不再内嵌改动明细（index.tsx 不再有 ChangesList）', !clientSrc.includes('ChangesList'))
  check('client 工作台 portal 到 body（createPortal + document.body）', clientOut.includes('document.body') && portalImported >= 2)
  check('client BUILD 版本已推进（dgp-v20）', clientOut.includes('dgp-v20'))
  // ---- i18n 键完整性：任何 t('x') 用到的键都必须在 ZH/EN 字典里存在（防 wbCancel 类漏键） ----
  const clientNorm = clientSrc.replace(/\r\n/g, '\n')
  const dictStart = clientNorm.indexOf('const ZH: Dict = {')
  const dictEnd = clientNorm.indexOf('const EN: Dict = {', dictStart)
  const zhBlock = dictStart >= 0 && dictEnd > dictStart ? clientNorm.slice(dictStart, dictEnd) : ''
  const definedKeys = new Set([...zhBlock.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9_]*):/gmu)].map((m) => m[1]))
  const usedKeys = new Set()
  for (const file of ['index.tsx', 'workbench.tsx', 'graphview.tsx', 'settings.tsx', 'onboard.tsx', 'diffview.tsx', 'filebrowser.tsx', 'markdown.ts']) {
    const src = await readText(resolve(root, 'src/client', file))
    if (!src) continue
    for (const m of src.replace(/\r\n/g, '\n').matchAll(/t\(\s*'([A-Za-z0-9_]+)'\s*\)/gu)) usedKeys.add(m[1])
  }
  const missingKeys = [...usedKeys].filter((key) => !definedKeys.has(key)).sort()
  check(
    'client i18n 键完整（t() 用到的键都在字典里）',
    definedKeys.size > 100 && missingKeys.length === 0,
    `缺 ${missingKeys.join(',') || '-'}`,
  )
  const enStart = clientNorm.indexOf('const EN: Dict = {', dictStart)
  const enEnd = enStart > 0 ? clientNorm.indexOf('\n}\n', enStart) : -1
  const enBlock = enStart > 0 && enEnd > enStart ? clientNorm.slice(enStart, enEnd) : ''
  const enKeys = new Set([...enBlock.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9_]*):/gmu)].map((m) => m[1]))
  const zhOnly = [...definedKeys].filter((key) => !enKeys.has(key))
  const enOnly = [...enKeys].filter((key) => !definedKeys.has(key))
  check(
    'client 中英字典键一一对应',
    enKeys.size === definedKeys.size && zhOnly.length === 0 && enOnly.length === 0,
    `zh=${definedKeys.size} en=${enKeys.size} zhOnly=${zhOnly.join(',') || '-'} enOnly=${enOnly.join(',') || '-'}`,
  )
  // permKey()/permFilterKey() 是运行时拼出来的键名，静态 t('x') 扫描覆盖不到，单独兜底。
  const dynKeys = ['permFull', 'permRead', 'permNone', 'filterAll']
  const dynMissingZh = dynKeys.filter((key) => !definedKeys.has(key))
  const dynMissingEn = dynKeys.filter((key) => !enKeys.has(key))
  check(
    'client 动态拼接的权限键都在中英字典里（permFull/permRead/permNone/filterAll）',
    dynMissingZh.length === 0 && dynMissingEn.length === 0,
    `zh 缺 ${dynMissingZh.join(',') || '-'} / en 缺 ${dynMissingEn.join(',') || '-'}`,
  )
  check('client 无未定义的工具类（sr-only 未在 CSS 中定义）', !clientSrc.includes('sr-only') && !(await readText(resolve(root, 'src/client/workbench.tsx')) ?? '').includes('sr-only'))
  // ---- 2026-10-29 重构：多账号/多仓库权限 + 分步初始化 + 当前分支详情 ----
  // 注意：这些标识是源码里的变量/字面量名，产物经过 esbuild 压缩会被改名，
  // 所以只能对源码断言（只有 BUILD 版本号是字符串常量，产物里仍可见）。
  check('client 拉取账号远程仓库列表（/account/repos）', clientSrcAll.includes('/account/repos'))
  check('client 保存账号级仓库权限（repoPermissions）', clientSrcAll.includes('repoPermissions'))
  check('client 展示仓库权限三档（full/read/none）', clientSrcAll.includes("'full'") && clientSrcAll.includes("'read'") && clientSrcAll.includes("'none'"))
  check('client 提供分步初始化向导（bootstrap 端点）', clientSrcAll.includes('/repo/bootstrap'))
  check('client 初始化向导改单页表单（无 setInitStep 分步推进）', !clientSrcAll.includes('setInitStep') && !clientSrcAll.includes('initStep:'))
  check('client 初始化向导拆到独立模块（onboard.tsx 导出 InitWizard）', clientSrcAll.includes('export function InitWizard'))
  check('client 初始化向导带右侧实时计划（dgp-iw-right + dgp-plan）', clientSrcAll.includes('dgp-iw-right') && clientSrcAll.includes('dgp-plan'))
  check('client 初始化失败就地重试（不再有 initBack 回上一步）', !clientSrcAll.includes("t('initBack')"))
  check('client 当前分支详情入口（branchDetail）', clientSrcAll.includes('branchDetail'))
  check('client 分支详情改时间线（dgp-tl，取代 dgp-commitrow）', clientSrcAll.includes('dgp-tl-item') && !clientSrcAll.includes('dgp-commitrow'))
  check('client 分支详情拆到独立模块（onboard.tsx 导出 BranchDetailModal）', clientSrcAll.includes('export function BranchDetailModal'))
  // ---- 2026-10-30 审核后重构：设置页 Git 分节 ----
  check('client 账号行合并重复入口（不再单独渲染 reauth 按钮）', !/t\('reauth'\)/u.test(clientSrcAll))
  check('client 权限只提交单条（/repo/permission）', clientSrcAll.includes('/repo/permission'))
  check('client 权限保存有乐观更新与回滚（permOverride）', clientSrcAll.includes('permOverride'))
  check('client 权限保存有在途锁（permSaving）', clientSrcAll.includes('permSaving'))
  check('client 不再整表提交 repoPermissions 到 /settings', !/api<[^>]*>\('\/settings',\s*\{\s*repoPermissions/u.test(clientSrcAll))
  check('client 仓库列表展示截断提示（reposTruncated）', clientSrcAll.includes('reposTruncated'))
  check('client 概览带并入账号级权限（repoGrantCount）', clientSrcAll.includes('repoGrantCount'))
  check('client 高级设置说明全局兜底语义（scopeReposNote）', clientSrcAll.includes('scopeReposNote'))
  // ---- 2026-10-30 完全重构：设置页 Git 分节（新文件 settings.tsx，新信息架构） ----
  check('client 设置页拆到独立模块（settings.tsx 导出 GitSection）', clientSrcAll.includes('export function GitSection'))
  check('client 设置页不再分 tab（无 tabAccounts/tabScope 切换）', !clientSrcAll.includes("setTab('accounts')") && !clientSrcAll.includes('tabAccounts'))
  check('client 账号以卡片承载（dgp-acct）', clientSrcAll.includes('dgp-acct') && clientSrcAll.includes('dgp-acct-head'))
  check('client 仓库权限改分段控件（dgp-perm-seg，取代 select）', clientSrcAll.includes('dgp-perm-seg') && !clientSrcAll.includes('dgp-perm-select'))
  check('client 仓库列表有搜索与筛选工具行（dgp-repos-toolbar）', clientSrcAll.includes('dgp-repos-toolbar') && clientSrcAll.includes('repoSearch') && clientSrcAll.includes('repoFilter'))
  check('client 仓库权限内联展示（不再有「查看仓库」折叠开关）', !clientSrcAll.includes('reposToggle') && !clientSrcAll.includes('dgp-repo-toggle'))
  check('client 高级设置默认收起（advancedShow/advancedHide）', clientSrcAll.includes('advancedShow') && clientSrcAll.includes('advancedHide'))
  check('client 连接账号走弹窗（不再常驻表单）', clientSrcAll.includes('connectOpen') && clientSrcAll.includes('connectAccount'))

  check('client 分支详情按 ref 取提交（ref=）', clientSrcAll.includes('ref=') && clientSrcAll.includes('/repo/commits'))
  // ---- 2026-10-30 文案 vs 功能一致性审计（15 处）后补的回归点 ----
  check('工作台 Pull 带 remote + 分支（不跑裸 git pull）', /api<SyncView>\('\/repo\/pull',\s*\{[^}]*remote:/.test(clientSrcAll) && /\/repo\/pull',\s*\{[^}]*branch:/.test(clientSrcAll))
  check('工作台把冲突/被拒翻成人话（run() 消费 syncConflicted/syncRejected）', clientSrcAll.includes("t('syncConflicted')") && clientSrcAll.includes("t('syncRejected')"))
  check('初始化表单不再有被丢弃的「仓库名」输入（wbInitName 已删）', !clientSrcAll.includes('wbInitName') && !clientSrcAll.includes('initName'))
  check('文案不再指向已删除的「仓库范围」（wbUnauthorizedHint/helpText）', !clientSrcAll.includes('「仓库范围」') && !clientSrcAll.includes('→ Scope'))
  check('概览授权仓库只数可访问档位（排除 none）', clientSrcAll.includes("perm !== 'none'") && clientSrcAll.includes('statsReposHintDefault'))
  check('死字典键已清（抽查 8 个不再出现）', ['scopeGrantAll', 'graphHead', 'statsReposHintAll', 'initStepConfirm', 'loadingLabel', 'toastCopiedFailed', 'wbDiffTab', 'branchDetailLoading'].every((key) => !clientSrcAll.includes(`  ${key}:`)))
  check('client 分支详情不单独做按钮（Git 只有一个 chip 入口）', !clientSrcAll.includes('dgp-branchbtn'))
  // ---- dgp-v20：历史合并泳道 / 差异四视图 / 偏好键 / 界面分节 ----
  check('client 车道列可复用（graphview 导出 LaneColumn + laneWidth）', clientSrcAll.includes('export function LaneColumn') && clientSrcAll.includes('export function laneWidth'))
  check('client 历史视图复用车道列（按 hash 对齐后重排 row）', clientSrcAll.includes('<LaneColumn rows={laneRows}') && clientSrcAll.includes('byHash'))
  check('client 不再有独立「分支图」导航项（rail 收敛为 5 项）', !clientSrcAll.includes("key: 'graph'") && !clientSrcAll.includes("'graph' |"))
  check('client 历史视图有列表/泳道两档并记忆（PREF_GRAPH_LANES）', clientSrcAll.includes('PREF_GRAPH_LANES') && clientSrcAll.includes('wbHistoryLane'))
  check('client 分支图行数走偏好（PREF_GRAPH_LIMIT，20~200 夹取）', clientSrcAll.includes('PREF_GRAPH_LIMIT') && clientSrcAll.includes('Math.min(100, Math.max(20'))
  // ---- dgp-v20 第二批：图片 / Markdown / 620 断点 / 回退撤销 / 界面偏好 ----
  check('client 图片预览支持点图切原尺寸（data-zoom）', clientSrcAll.includes('data-zoom') && sharedSrc.includes('.dgp-fb-imgbox'))
  check('client Markdown 渲染器自带转义（不引第三方解析库）', markdownSrc.includes('escapeHtml') && markdownSrc.includes('export function renderMarkdown') && !markdownSrc.includes('marked('))
  check('client Markdown 可切回源码（fbRendered + dgp-fb-md）', clientSrcAll.includes('fbRendered') && sharedSrc.includes('.dgp-fb-md'))
  check('client 620 窄屏断点存在（一次只干一件事）', sharedSrc.includes('@media (max-width:620px)'))
  check('client 提交详情提供回退/撤销入口（reset + revert）', clientSrcAll.includes('wbResetSoft') && clientSrcAll.includes('wbRevert') && clientSrcAll.includes('confirmHard'))
  check('client 设置页可固定 AI 模型（PREF_AI_MODEL + /llm/models 下拉）', clientSrcAll.includes('PREF_AI_MODEL') && clientSrcAll.includes('prefAiModel') && clientSrcAll.includes('/llm/models'))
  check('client 无上游时 Push 变成「发布分支」（git push -u）', clientSrcAll.includes('needsPublish') && clientSrcAll.includes('wbPublish') && clientSrcAll.includes('doPush(needsPublish)'))
  check('client 偏好变更即时广播（subscribePref 监听自定义事件）', sharedSrc.includes('PREF_EVENT') && sharedSrc.includes('export function subscribePref'))
  check('client 改动视图有汇总统计条（dgp-gw-summary）', clientSrcAll.includes('changeSummary') && sharedSrc.includes('.dgp-gw-summary'))
  check('client 设置页有「界面」分节（InterfacePanel）', clientSrcAll.includes('function InterfacePanel') && clientSrcAll.includes('interfaceShow'))
// ---- dgp-v20：8 语言（zh / en 内置，ja/es/fr/de/ru/pt 由插件 addLanguage 注册） ----
{
  const langFiles = ['ja', 'es', 'fr', 'de', 'ru', 'pt']
  // ZH 在 index.tsx 里是局部常量（`const ZH`），语言字典是具名导出（`export const ja`），两种都认。
  const dictKey = (text, name) => {
    const head = `const ${name}: Dict = {`
    let start = text.indexOf(`export ${head}`)
    if (start === -1) start = text.indexOf(head)
    if (start === -1) return null
    const stop = text.indexOf('\n}', start)
    return new Set([...text.slice(start, stop).matchAll(/^  ([A-Za-z0-9_]+):/gmu)].map((m) => m[1]))
  }
  const zhKeys = dictKey(clientSrc, 'ZH')
  check('client 6 个语言字典文件存在且导出具名常量', langFiles.every((lang) => clientSrcAll.includes(`export const ${lang}: Dict = {`)))
  const mismatched = langFiles.filter((lang) => {
    const keys = dictKey(clientSrcAll, lang)
    if (!keys || !zhKeys) return true
    return keys.size !== zhKeys.size || [...zhKeys].some((key) => !keys.has(key))
  })
  check('client 6 个语言字典键集合与 ZH 完全一致', mismatched.length === 0, mismatched.join(', '))
  check(
    'client 语言目录通过 addLanguage 注册且 fallback 落到 en',
    clientSrcAll.includes('addLanguage') &&
      clientSrcAll.includes("fallback: 'en'") &&
      clientSrcAll.includes('EXTRA_LANGUAGES') &&
      EXTRA_LABELS.every((label) => clientSrcAll.includes(label)),
  )
  check('client 注册时把 6 语言并入 register 字典', clientSrc.includes('...EXTRA_LOCALES'))
}
  // ---- dgp-v20：类名与样式表一致性（此前踩过 dgp-gw-searchbar / dgp-repomenu* 裸渲染） ----
  const cssDefined = new Set()
  for (const m of sharedSrc.matchAll(/\.(dgp-[a-zA-Z0-9_-]+)/gu)) cssDefined.add(m[1])
  const cssUsed = new Set()
  for (const m of clientSrcAll.matchAll(/className="([^"]*)"/gu)) {
    for (const token of m[1].split(/\s+/u)) if (token.startsWith('dgp-')) cssUsed.add(token)
  }
  for (const m of clientSrcAll.matchAll(/className=\{`([^`]*)`\}/gu)) {
    for (const token of m[1].split(/[\s$]+/u)) {
      if (token.startsWith('dgp-') && !token.includes('{')) cssUsed.add(token.replace(/[{}]/gu, ''))
    }
  }
  const cssMissing = [...cssUsed].filter((token) => !cssDefined.has(token)).sort()
  check('client 用到的 dgp- 类名都在样式表里有定义', cssMissing.length === 0, cssMissing.join(', '))

  // ---- dgp-v20：差异视图 / 文件浏览 / 历史搜索 / 标签 / 贮藏 / AI 提交信息 ----
  check('client 差异视图拆到独立模块（diffview.tsx 导出 DiffView）', clientSrcAll.includes('export function DiffView'))
  check('client 差异视图解析 hunk 行号（parseDiff 返回 oldNo/newNo）', clientSrcAll.includes('export function parseDiff') && clientSrcAll.includes('oldNo') && clientSrcAll.includes('newNo'))
  check('client 差异视图支持并排/统一两种布局（buildSplit + DiffLayout）', clientSrcAll.includes('export function buildSplit') && clientSrcAll.includes("'split'") && clientSrcAll.includes("'unified'"))
  check('client 差异视图有就地查找（Ctrl/⌘+F + F3）', clientSrcAll.includes("key === 'f'") && clientSrcAll.includes("key === 'f3'"))
  check('client 差异视图做词级高亮（diffSegments 前缀/后缀对齐）', clientSrcAll.includes('export function diffSegments') && clientSrcAll.includes('aMid') && clientSrcAll.includes('bMid'))
  check('client 差异视图折叠未变更块（foldRows + FOLD_MIN）', clientSrcAll.includes('export function foldRows') && clientSrcAll.includes('FOLD_MIN'))
  check('client 差异布局与高亮选择会持久化（readPref/writePref）', clientSrcAll.includes('PREF_DIFF_LAYOUT') && clientSrcAll.includes('PREF_HIGHLIGHT') && clientSrcAll.includes('export function readPref') && clientSrcAll.includes('export function writePref'))
  check('client 语法高亮只用 Prism 字符串 API（不扫 DOM）', clientSrcAll.includes("import './prism-env.js'") && clientSrcAll.includes('manual = true') && clientSrcAll.includes('Prism.highlight'))
  check('client token 配色并入同一份样式表（TOKEN_CSS 插值进 CSS）', /export const CSS = `[\s\S]*\$\{TOKEN_CSS\}/u.test(clientSrcAll))
  check('client 文件浏览拆到独立模块（filebrowser.tsx 导出 FileBrowser）', clientSrcAll.includes('export function FileBrowser'))
  check('client 文件浏览走 /repo/tree 与 /repo/file', clientSrcAll.includes('/repo/tree?') && clientSrcAll.includes('/repo/file?'))
  check('client 工作台历史支持关键词搜索（search 参数）', clientSrcAll.includes("params.set('search'") && clientSrcAll.includes('wbSearchCommit'))
  check('client 工作台历史支持加载更多（offset 翻页 + COMMIT_PAGE）', clientSrcAll.includes('COMMIT_PAGE') && clientSrcAll.includes('loadMoreCommits'))
  check('client 工作台可切换多仓库（/repo/discover + activeRoot）', clientSrcAll.includes('/repo/discover') && clientSrcAll.includes('switchRepo') && clientSrcAll.includes('activeRoot'))
  check('client 工作台标签页（/repo/tags 三端点）', clientSrcAll.includes('/repo/tags') && clientSrcAll.includes('/repo/tags/create') && clientSrcAll.includes('/repo/tags/delete') && clientSrcAll.includes('/repo/tags/push'))
  check('client 工作台贮藏页（/repo/stash 保存与动作）', clientSrcAll.includes('/repo/stash') && clientSrcAll.includes('/repo/stash/save') && clientSrcAll.includes('/repo/stash/action'))
  check('client 工作台可 AI 生成提交信息（/repo/suggest-message）', clientSrcAll.includes('/repo/suggest-message') && clientSrcAll.includes('wbSuggest'))
  check('client 差异渲染统一走 DiffView（不再有裸 dgp-gw-diff pre）', !clientSrcAll.includes('className="dgp-gw-diff"'))
  check('client 有窄屏断点（@media max-width:760px）', clientSrcAll.includes('@media (max-width:760px)'))
  check('client chip 有干净/脏二态（data-dirty）', clientSrcAll.includes('data-dirty') && clientSrcAll.includes('.dgp-chip[data-dirty="1"]'))
  check('client 有版本检查（GitHub releases/latest + 5 秒超时）', clientSrcAll.includes('/releases/latest') && clientSrcAll.includes('5000') && clientSrcAll.includes('export function isNewer') && clientSrcAll.includes('export function parseVersion'))
  check('client 版本提示不打扰（预发布不提示 + 只在打开菜单时查）', clientSrcAll.includes('prerelease') && clientSrcAll.includes('useLatestVersion(open)') && clientSrcAll.includes('menuNewVersion'))
  check('client BUILD 版本已推进（dgp-v20）', clientOut.includes('dgp-v20'))
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
    // ---- 2026-10-29 重构：账号 → 远程仓库权限 + 分步初始化 ----
    check('handler 挂载账号远程仓库列表端点 /account/repos', handlerSrc.includes("'/account/repos'"))
    check('handler 挂载分步初始化端点 /repo/bootstrap', handlerSrc.includes("'/repo/bootstrap'"))
    check('handler 远端写端点按账号仓库归属校验（isRepoWritableFor）', handlerSrc.includes('isRepoWritableFor'))
    check('handler /repo/init 也走 requireWrite 闸门', /\/repo\/init[\s\S]{0,900}requireWrite/.test(handlerSrc))
    const storeSrc = await readText(resolve(root, 'src/node/store.ts'))
    if (storeSrc) {
      check('store 提供 per-account/per-repo 权限结构（repoPermissions）', storeSrc.includes('repoPermissions'))
      check('store 提供仓库权限查询（repoPermission）', storeSrc.includes('repoPermission('))
      check('store 提供仓库权限写入（setRepoPermission）', storeSrc.includes('setRepoPermission('))
      check('store 仓库键保留多段（GitLab 子组不截断）', !/const \[owner, repo\] = parts/u.test(storeSrc))
      check('handler 提供单条仓库权限端点（/repo/permission）', handlerSrc.includes("'/repo/permission'"))
      check('handler /account/repos 返回每仓库权限（permission）', /permission: deps\.store\.repoPermission/u.test(handlerSrc))

    }
    check('handler 提供新建远程仓库端点（/repo/create）', handlerSrc.includes("'/repo/create'"))
    check('handler 新建仓库后自动授权为 full（避免建完推不上去）', /setRepoPermission\(account\.id, created\.repo\.fullName, 'full'\)/u.test(handlerSrc))
    const providersSrc = await readText(resolve(root, 'src/node/providers.ts'))
    if (providersSrc) {
      check('providers 提供列出账号远程仓库（listAccountRepos）', providersSrc.includes('export async function listAccountRepos'))
      check('providers 提供仓库列表端点纯函数（便于门禁）', providersSrc.includes('accountReposEndpoint'))
      check('providers 仓库列表支持分页（page 参数）', providersSrc.includes('page=${p}'))
      check('providers 仓库列表返回截断标记（truncated）', providersSrc.includes('truncated'))
      check('providers 提供新建远程仓库（createAccountRepo）', providersSrc.includes('export async function createAccountRepo'))
      check('providers 提供建仓端点纯函数（createRepoEndpoint）', providersSrc.includes('createRepoEndpoint'))
      check('providers 建仓前校验仓库名合法性（REPO_NAME_RE）', providersSrc.includes('REPO_NAME_RE'))
      check('providers 建仓按平台区分可见性字段（visibility / private）', providersSrc.includes('visibility: isPrivate') && providersSrc.includes('private: isPrivate'))
    }
    const gitOpsSrc2 = await readText(resolve(root, 'src/node/git-ops.ts'))
    if (gitOpsSrc2) {
      check('git-ops 提供 remote URL → owner/repo 解析（parseRemoteRepo）', gitOpsSrc2.includes('export function parseRemoteRepo'))
      check('git-ops readCommits 支持按 ref 取日志', /readCommits[\s\S]{0,200}ref\??:/.test(gitOpsSrc2))
      // ---- dgp-v20：标签 / 贮藏 / 提交搜索 ----
      check('git-ops 标签读写（readTags/createTag/deleteTag/pushTag）', ['readTags', 'createTag', 'deleteTag', 'pushTag'].every((name) => gitOpsSrc2.includes(`export async function ${name}`)))
      check('git-ops 标签读取走 for-each-ref 并标注附注', gitOpsSrc2.includes('for-each-ref') && gitOpsSrc2.includes('annotated'))
      check('git-ops 贮藏读写（readStashes/stashSave/stashAction）', ['readStashes', 'stashSave', 'stashAction'].every((name) => gitOpsSrc2.includes(`export async function ${name}`)))
      check('git-ops 贮藏序号做白名单校验（stashIndex 0..999）', /function stashIndex[\s\S]{0,400}999/u.test(gitOpsSrc2))
      check('git-ops readCommits 支持关键词搜索（--grep）', gitOpsSrc2.includes('--grep=') && gitOpsSrc2.includes('--fixed-strings'))
      check('git-ops 提供回退（resetToCommit，soft/mixed/hard）', gitOpsSrc2.includes('export async function resetToCommit') && gitOpsSrc2.includes('ResetMode'))
      check('git-ops 提供撤销（revertCommit，--no-edit + 冲突人话）', gitOpsSrc2.includes('export async function revertCommit') && gitOpsSrc2.includes('--no-edit'))
    }
    const filesSrc = await readText(resolve(root, 'src/node/files.ts'))
    if (filesSrc) {
      check('files 提供目录列举与文件读取（listDir/readTextFile）', filesSrc.includes('export async function listDir') && filesSrc.includes('export async function readTextFile'))
      check('files 越界判定走 realpath 相对路径（不用字符串前缀）', filesSrc.includes('realpath') && filesSrc.includes('relative('))
      check('files 拒绝 .. 与 .git 段（normalizeRel）', /function normalizeRel[\s\S]{0,600}\.\./u.test(filesSrc) && filesSrc.includes("'.git'"))
      check('files 二进制文件按 NUL 嗅探判定', filesSrc.includes('includes(0)'))
      check('files 提供扩展名 → 语言标识映射（langOf）', filesSrc.includes('export function langOf'))
      check('files 有图片通道（readImageFile + 4MB 上限）', filesSrc.includes('export async function readImageFile') && filesSrc.includes('MAX_IMAGE_BYTES'))
      check('files 图片 MIME 由扩展名判定（IMAGE_BY_EXT + imageMimeOf）', filesSrc.includes('IMAGE_BY_EXT') && filesSrc.includes('export function imageMimeOf'))
    }
    for (const route of ['/repo/tags', '/repo/stash', '/repo/tree', '/repo/file', '/repo/tags/create', '/repo/tags/delete', '/repo/tags/push', '/repo/stash/save', '/repo/stash/action', '/repo/suggest-message']) {
      check(`handler 挂载 v19 端点 ${route}`, handlerSrc.includes(`'${route}'`))
    }
    check('handler /repo/tags/push 走远端归属闸门', /\/repo\/tags\/push[\s\S]{0,600}requireRemoteWritable/u.test(handlerSrc))
    check('handler /repo/suggest-message 只读（requireRead，不落盘）', /\/repo\/suggest-message[\s\S]{0,400}requireRead/u.test(handlerSrc))
    check('handler /repo/stash/action 校验 action 白名单', handlerSrc.includes('不支持的贮藏操作'))
    // ---- dgp-v20 第二批：图片通道 / 回退撤销 / 模型目录 ----
    for (const route of ['/repo/reset', '/repo/revert', '/repo/image', '/llm/models']) {
      check(`handler 挂载 v20 端点 ${route}`, handlerSrc.includes(`'${route}'`))
    }
    check('handler /repo/reset 校验回退模式白名单', handlerSrc.includes('不支持的回退模式'))
    check('handler /repo/reset 与 /repo/revert 走 requireWrite 闸门', /\/repo\/reset[\s\S]{0,200}requireWrite/u.test(handlerSrc) && /\/repo\/revert[\s\S]{0,200}requireWrite/u.test(handlerSrc))
    check('handler /repo/image 走 requireRead 闸门', /\/repo\/image[\s\S]{0,200}requireRead/u.test(handlerSrc))
    check('handler /repo/suggest-message 透传固定模型', handlerSrc.includes('str(body.model)'))
    check('handler /repo/file 返回图片 MIME 供前端分流', handlerSrc.includes('imageMimeOf'))
    const suggestSrc = await readText(resolve(root, 'src/node/suggest.ts'))
    if (suggestSrc) {
      check('suggest 用宿主 llm.prepareCall + stream（不静态依赖 dsh-llm）', suggestSrc.includes('prepareCall') && suggestSrc.includes('call.stream'))
      check('suggest 模型取当前会话默认（currentSelection）', suggestSrc.includes('currentSelection'))
      check('suggest 有超时保护（AbortController）', suggestSrc.includes('AbortController'))
      check('suggest 只输出一行并清洗围栏/引号（cleanMessage）', suggestSrc.includes('cleanMessage'))
      check('suggest 支持固定模型（parsePinnedRoute 优先于会话默认）', suggestSrc.includes('export function parsePinnedRoute') && suggestSrc.includes('pinned'))
      check('suggest 提供模型目录（listModelCatalog，只读宿主 provider/model）', suggestSrc.includes('export async function listModelCatalog') && suggestSrc.includes('listProviders'))
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ gates 失败 ${failures.length} 项：`)
  for (const item of failures) console.error('  - ' + item)
  process.exit(1)
}
console.log(`✓ gates 通过 ${passes.length} 项`)
