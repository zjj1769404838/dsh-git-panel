/**
 * Git 工作台 GUI 端到端：chip → 菜单 → 「Git 工作台」 → 主面板渲染断言。
 * 基建复用 mem-skill-playwright-core-edge-dsh-gui（自签 dsh-auth cookie + 本机 Edge）。
 * 运行中的 node 半边可能没有 /repo/branches 等新端点（不热重载），
 * 面板骨架断言不依赖这些端点——只断言 UI 结构出现。
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { createHash, createHmac } from 'node:crypto'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const NEWLINE_RE = /\r?\n/u
let pass = 0
const failures = []
const skipped = []
function check(name, condition, detail = '') {
  if (condition === 'skip') {
    skipped.push(name)
    return
  }
  if (condition) pass += 1
  else failures.push(detail ? `${name} — ${detail}` : name)
}

// ---- GUI 地址：命令行参数优先，否则扫最近的 dsh-web 日志 ----
const guiUrl = process.argv[2] || process.env.DSH_GUI_URL || ''
if (!guiUrl) {
  console.error('用法：node scripts/e2e-workbench.mjs http://127.0.0.1:PORT')
  process.exit(2)
}

// ---- 自签 cookie（与 e2e-settings 同一规则）----
function b64u(buffer) {
  return Buffer.from(buffer).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}
function readSecret() {
  const raw = readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8')
  const m = /client-connection[\s\S]*?browser-session[\s\S]*?secret:\s*([A-Za-z0-9_-]+)/.exec(raw)
  if (!m) throw new Error('未找到 browser-session secret')
  return Buffer.from(m[1].replaceAll('-', '+').replaceAll('_', '/'), 'base64')
}
function makeCookie(authority) {
  const secret = readSecret()
  const payload = { version: 1, authority, issuedAt: Date.now(), expiresAt: Date.now() + 3600_000 }
  const body = b64u(Buffer.from(JSON.stringify(payload)))
  const sig = b64u(createHmac('sha256', secret).update(body).digest())
  const name = 'dsh-auth-' + b64u(createHash('sha256').update(authority).digest())
  return { name, value: `v1.${body}.${sig}` }
}

const host = new URL(guiUrl).host
const cookie = makeCookie(host)

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const executablePath = EDGE_CANDIDATES.find((p) => {
  try {
    return !!readFileSync(p)
  } catch {
    return false
  }
})
if (!executablePath) throw new Error('未找到本机 Edge')

const userDataDir = join(process.cwd(), '.work', 'e2e-wb-profile')
mkdirSync(userDataDir, { recursive: true })

const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath,
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: ['--no-first-run', '--disable-extensions'],
})
await context.addCookies([{ ...cookie, domain: new URL(guiUrl).hostname, path: '/', httpOnly: true }])

const page = await context.newPage()
// 只收集「本插件相关」的页面错误。
// 环境里同时装着多个第三方 DSH 插件，它们的 slot 抢占冲突（例如
// `single slot "conversation.input.model.label" already has a registration`
// 来自 dsh-connect-trae-client）会在任意页面加载时抛出，与本插件无关。
// 这类噪声若计入断言，会让工作台回归长期假红——所以按「归因于本插件」过滤：
// 报错文本里出现本插件标识（dgp / dsh-git-panel / GitPanel）才算本插件的错。
const errors = []
const IGNORED_ERROR_PATTERNS = [
  /single slot "[^"]+" already has a registration/u,
]
function isOwnError(text) {
  if (/dgp|dsh-git-panel|GitPanel/iu.test(text)) return true
  return !IGNORED_ERROR_PATTERNS.some((re) => re.test(text))
}
page.on('pageerror', (error) => {
  const text = String(error)
  if (isOwnError(text)) errors.push(text)
})

try {
  await page.goto(guiUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  const title = await page.title()
  check('页面已加载（认证通过）', title.includes('DeepSeek'), `title=${title}`)

  // 切到「dsh-git-panel」项目下的会话：GUI 默认停在别的 cwd，chip 会降级成灰化 Git，
  // 而分支管理/二级弹窗只在本项目（真实 git 仓库）下才出现。
  const treeReady = await page
    .waitForSelector('[role="treeitem"]', { timeout: 15_000 })
    .then(() => true)
    .catch(() => false)

  // 点项目行是展开/折叠切换：先点一次让它展开，重新查询后再点它下面的会话行。
  async function clickProject() {
    return page.evaluate(() => {
      const row = [...document.querySelectorAll('[role="treeitem"]')].find(
        (item) => String(item.className).includes('projectRow') && item.textContent.trim() === 'dsh-git-panel',
      )
      if (!row) return false
      row.click()
      return true
    })
  }
  // 列出该项目下的会话行（项目行之后的全部 sessionRow）
  async function listSessionsUnderProject() {
    return page.evaluate(() => {
      const rows = [...document.querySelectorAll('[role="treeitem"]')]
      const index = rows.findIndex(
        (item) => String(item.className).includes('projectRow') && item.textContent.trim() === 'dsh-git-panel',
      )
      if (index < 0) return []
      return rows
        .slice(index + 1)
        .filter((item) => String(item.className).includes('sessionRow'))
        .map((item) => item.textContent.trim().slice(0, 40))
    })
  }
  // 按文本点某个会话行（DOM 会重建，每次都重新查询）
  async function clickSessionByText(text) {
    return page.evaluate((target) => {
      const rows = [...document.querySelectorAll('[role="treeitem"]')]
      const index = rows.findIndex(
        (item) => String(item.className).includes('projectRow') && item.textContent.trim() === 'dsh-git-panel',
      )
      if (index < 0) return false
      const session = rows
        .slice(index + 1)
        .filter((item) => String(item.className).includes('sessionRow'))
        .find((item) => item.textContent.trim().slice(0, 40) === target)
      if (!session) return false
      session.click()
      return true
    }, text)
  }
  // chip 当前显示的分支名（空串表示还没渲染出 chip）
  async function readChipLabel() {
    if ((await page.locator('.dgp-chip').count()) === 0) return ''
    const text = (await page.locator('.dgp-chip').first().innerText()).trim()
    return text.split(NEWLINE_RE).map((s) => s.trim()).filter(Boolean)[0] ?? ''
  }

  // 项目下可能有多个会话（其中「新会话」目录并非 Git 仓库），
  // 逐个点过去，直到 chip 显示出真实分支名为止。
  let switched = { ok: false, why: 'no tree' }
  if (treeReady) {
    const found = await clickProject()
    if (!found) switched = { ok: false, why: 'no project row' }
    else {
      await page.waitForTimeout(600)
      let sessions = await listSessionsUnderProject()
      if (sessions.length === 0) {
        // 项目行原本是展开的，刚才那一下把它折叠了：再点一次展开。
        await clickProject()
        await page.waitForTimeout(600)
        sessions = await listSessionsUnderProject()
      }
      for (const session of sessions) {
        await clickSessionByText(session)
        await page.waitForTimeout(2000)
        const label = await readChipLabel()
        if (label && label !== 'Git') {
          switched = { ok: true, session }
          break
        }
      }
      if (!switched.ok) switched = { ok: false, why: 'no git session', sessions }
    }
  }
  await page.waitForTimeout(1500)

  await page.waitForSelector('.dgp-chip', { timeout: 15_000 })
  check('输入框下方存在 Git chip 入口', (await page.locator('.dgp-chip').count()) === 1)
  const chipLabel = (await page.locator('.dgp-chip').innerText()).trim()
  check('已切到本项目的会话（chip 显示真实分支）', switched.ok && chipLabel !== 'Git', `switched=${JSON.stringify(switched)} chip=${chipLabel}`)

  await page.evaluate(() => document.querySelector('.dgp-chip')?.click())
  await page.waitForSelector('.dgp-menu', { timeout: 5_000 })
  check('点击 chip 打开菜单', (await page.locator('.dgp-menu').count()) === 1)

  // 一级菜单只留操作项：分支拓扑图与改动明细已收进工作台，菜单里不能再出现。
  check('一级菜单不再内嵌分支拓扑图（无 .dgp-graph）', (await page.locator('.dgp-menu .dgp-graph').count()) === 0)
  check('一级菜单不再内嵌改动明细（无 .dgp-changes）', (await page.locator('.dgp-menu .dgp-changes').count()) === 0)

  const wbItem = page.locator('.dgp-menu-item', { hasText: 'Git 工作台' })
  const hasWb = (await wbItem.count()) > 0
  check('菜单里有「Git 工作台」入口', hasWb)

  if (!hasWb) {
    failures.push('菜单缺「Git 工作台」入口——client 产物可能是旧版（硬刷新后重试）')
  } else {
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('.dgp-menu-item')]
      const target = items.find((item) => item.textContent?.includes('Git 工作台'))
      target?.click()
    })
    await page.waitForSelector('.dgp-gw', { timeout: 5_000 })
    check('点击后 Git 工作台面板出现（.dgp-gw）', (await page.locator('.dgp-gw').count()) === 1)
    check('工作台带「Git 工作台」标题或空态', (await page.locator('.dgp-gw-top, .dgp-gw-state').count()) >= 1)

    // node 半边是旧版时 status 接口仍可用（老路由），面板会渲染三种首态之一：
    // 正常面板 / 未初始化 / 授权提示。任一都算「面板活着」。
    const stateCount = await page.locator('.dgp-gw-state').count()
    const mainCount = await page.locator('.dgp-gw-main').count()
    check('工作台渲染出主面板或状态首屏', stateCount >= 1 || mainCount >= 1, `state=${stateCount} main=${mainCount}`)
    check('面板有可交互的关闭按钮', (await page.locator('.dgp-gw .dgp-gw-x').count()) >= 1)

    // 工作台已 portal 到 body：composer 行有 container-type:inline-size（layout containment），
    // 留在原地会让 position:fixed 的包含块降级成那一行——遮罩铺不满、面板被裁、点击冒泡进输入区。
    check('工作台挂在 body 直属层（脱离 composer 包含块）', (await page.evaluate(() => {
      const panel = document.querySelector('.dgp-gw')
      return !!panel && panel.parentElement === document.body
    })))

    // 形态断言：居中模态框（不是贴右抽屉）。判据同时看几何与样式：
    // 左右留白近似对称、上下也居中，且没有右侧单边贴边。
    const shape = await page.evaluate(() => {
      const panel = document.querySelector('.dgp-gw')
      if (!panel) return null
      const rect = panel.getBoundingClientRect()
      const style = getComputedStyle(panel)
      return {
        left: Math.round(rect.left),
        right: Math.round(window.innerWidth - rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(window.innerHeight - rect.bottom),
        radius: parseFloat(style.borderTopLeftRadius) || 0,
        borderTop: parseFloat(style.borderTopWidth) || 0,
        borderLeft: parseFloat(style.borderLeftWidth) || 0,
      }
    })
    check(
      '工作台是居中模态框（左右留白对称，不是贴右抽屉）',
      !!shape && Math.abs(shape.left - shape.right) <= 4 && shape.left > 24,
      JSON.stringify(shape),
    )
    check(
      '工作台四周都有圆角与边框（模态框形态）',
      !!shape && shape.radius >= 8 && shape.borderTop > 0 && shape.borderLeft > 0,
      JSON.stringify(shape),
    )

    // 回归：二级弹窗此前用裸 createPortal（运行时 undefined）→ 一点就抛 ReferenceError，
    // 整棵 React 子树被卸载，弹窗与 chip 一起消失。这里点开分支管理，三件事必须同时成立。
    // 会话目录不是仓库时（未初始化首屏）没有分支按钮，该组断言按 skip 处理，
    // 由 gates 的「无裸 createPortal」静态断言兜底。
    const branchBtn = page.locator('.dgp-gw-branch')
    if ((await branchBtn.count()) === 0) {
      check('工作台顶栏有分支管理入口', 'skip')
      check('点分支管理打开二级弹窗（.dgp-modal）', 'skip')
      check('弹窗打开后 chip 仍在（无 React 崩溃）', 'skip')
      check('弹窗打开后工作台仍在（无 React 崩溃）', 'skip')
      check('弹窗挂在 body 直属层（未被 composer 包含块裁切）', 'skip')
      check('弹窗期间无页面 JS 错误', 'skip')
    } else {
      check('工作台顶栏有分支管理入口', true)
      await page.evaluate(() => document.querySelector('.dgp-gw-branch')?.click())
      const modalOpened = await page
        .waitForSelector('.dgp-modal', { timeout: 5_000 })
        .then(() => true)
        .catch(() => false)
      check('点分支管理打开二级弹窗（.dgp-modal）', modalOpened)
      check('弹窗打开后 chip 仍在（无 React 崩溃）', (await page.locator('.dgp-chip').count()) === 1)
      check('弹窗打开后工作台仍在（无 React 崩溃）', (await page.locator('.dgp-gw').count()) === 1)
      check('弹窗挂在 body 直属层（未被 composer 包含块裁切）', (await page.evaluate(() => {
        const modal = document.querySelector('.dgp-modal')
        return !!modal && modal.parentElement?.parentElement === document.body
      })))
      check('弹窗期间无页面 JS 错误', errors.length === 0, errors.slice(0, 3).join(' | '))

      // 用户报的「二级弹窗里点任何地方弹窗就消失」：把弹窗内每个可点项都点一遍，
      // 每次点完断言弹窗/工作台/chip 三件套都还在（关闭按钮除外，它本来就该关）。
      const snapshot = () =>
        page.evaluate(() => ({
          modal: document.querySelectorAll('.dgp-modal').length,
          wb: document.querySelectorAll('.dgp-gw').length,
          chip: document.querySelectorAll('.dgp-chip').length,
        }))
      const closeModal = () =>
        page.evaluate(() => {
          document.querySelector('.dgp-modal button[aria-label="close"]')?.click()
        })

      await closeModal()
      await page.waitForTimeout(400)

      // ① 分支管理弹窗：点「新建分支」进入二级表单，再点输入框/复选/关闭。
      await page.evaluate(() => document.querySelector('.dgp-gw-branch')?.click())
      await page.waitForSelector('.dgp-modal', { timeout: 5_000 })
      const branchSteps = []
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('.dgp-modal button')].find((b) => (b.textContent ?? '').includes('新建分支'))
        btn?.click()
      })
      await page.waitForTimeout(500)
      branchSteps.push(await snapshot())
      await page.evaluate(() => {
        const input = document.querySelector('.dgp-modal input[type="text"], .dgp-modal input:not([type])')
        if (input instanceof HTMLElement) input.click()
        const box = document.querySelector('.dgp-modal input[type="checkbox"]')
        if (box instanceof HTMLElement) box.click()
      })
      await page.waitForTimeout(400)
      branchSteps.push(await snapshot())
      check(
        '分支弹窗内点输入框/复选框不会关掉弹窗',
        branchSteps.every((s) => s.modal === 1 && s.wb === 1 && s.chip === 1),
        JSON.stringify(branchSteps),
      )
      await closeModal()
      await page.waitForTimeout(300)
      await closeModal()
      await page.waitForTimeout(400)

      // ② Pull / 远程仓库弹窗：点标题与正文区域（非按钮）也不能关。
      for (const [label, keyword] of [['Pull', 'Pull'], ['远程仓库', '远程仓库']]) {
        const opened = await page.evaluate((text) => {
          const btn = [...document.querySelectorAll('.dgp-gw-top button')].find((b) => (b.textContent ?? '').includes(text))
          if (!btn) return false
          btn.click()
          return true
        }, keyword)
        if (!opened) {
          check(`${label} 弹窗可打开`, 'skip')
          continue
        }
        await page.waitForTimeout(500)
        await page.evaluate(() => {
          const title = document.querySelector('.dgp-modal .dgp-modal-title, .dgp-modal h3, .dgp-modal strong')
          if (title instanceof HTMLElement) title.click()
          const body = document.querySelector('.dgp-modal p, .dgp-modal .dgp-modal-body')
          if (body instanceof HTMLElement) body.click()
        })
        await page.waitForTimeout(400)
        const after = await snapshot()
        check(`${label} 弹窗内点击正文不会关掉弹窗`, after.modal === 1 && after.wb === 1 && after.chip === 1, JSON.stringify(after))
        await closeModal()
        await page.waitForTimeout(400)
      }

      // ③ 提交详情弹窗：点标题栏与内容区。
      // 提交详情只从历史视图的提交行进入：先切到「历史」，再点第一行。
      await page.evaluate(() => {
        const rail = [...document.querySelectorAll('.dgp-gw-railbtn')].find((b) => (b.textContent ?? '').includes('历史'))
        if (rail instanceof HTMLElement) rail.click()
      })
      await page.waitForTimeout(700)
      const commitOpened = await page.evaluate(() => {
        const row = document.querySelector('.dgp-gw-logrow')
        if (!row) return false
        row.click()
        return true
      })
      if (!commitOpened) {
        check('提交详情弹窗可打开', 'skip')
      } else {
        await page.waitForTimeout(700)
        await page.evaluate(() => {
          const title = document.querySelector('.dgp-modal .dgp-modal-title, .dgp-modal h3')
          if (title instanceof HTMLElement) title.click()
        })
        await page.waitForTimeout(400)
        const after = await snapshot()
        check('提交详情弹窗内点击不会关掉弹窗', after.modal === 1 && after.wb === 1 && after.chip === 1, JSON.stringify(after))
        await closeModal()
        await page.waitForTimeout(400)
      }

      // ④ 顶栏工具与左侧竖排导航切换：改动 / 历史 / 文件 / 标签 / 贮藏（Diff 已改为预览层；
      //    dgp-v20 起「分支图」并入历史列表的泳道，不再是独立导航项）。
      const tabResults = []
      for (const keyword of ['改动', '历史', '文件', '标签', '贮藏']) {
        const ok = await page.evaluate((text) => {
          const btn = [...document.querySelectorAll('.dgp-gw-railbtn')].find((b) => (b.textContent ?? '').includes(text))
          if (!btn) return false
          btn.click()
          return true
        }, keyword)
        await page.waitForTimeout(500)
        tabResults.push({ keyword, ok, state: await snapshot() })
      }
      check(
        '切左侧导航不会关掉工作台',
        tabResults.filter((r) => r.ok).every((r) => r.state.wb === 1 && r.state.chip === 1),
        JSON.stringify(tabResults),
      )
      const refreshed = await page.evaluate(() => {
        const btn = document.querySelector('.dgp-gw-top .dgp-gw-icon')
        if (!btn) return false
        btn.click()
        return true
      })
      await page.waitForTimeout(1200)
      const afterRefresh = await snapshot()
      check('点刷新不会关掉工作台', !refreshed || (afterRefresh.wb === 1 && afterRefresh.chip === 1), JSON.stringify(afterRefresh))

      // ⑤ 勾选/预览改动行：点复选框与文件名。
      const fileClicked = await page.evaluate(() => {
        const box = document.querySelector('.dgp-gw-row input[type="checkbox"]')
        if (box instanceof HTMLElement) box.click()
        const path = document.querySelector('.dgp-gw-path')
        if (path instanceof HTMLElement) path.click()
        return true
      })
      await page.waitForTimeout(900)
      const afterFile = await snapshot()
      check('点改动行不会关掉工作台', !fileClicked || (afterFile.wb === 1 && afterFile.chip === 1), JSON.stringify(afterFile))
      check('弹窗全流程无页面 JS 错误', errors.length === 0, errors.slice(0, 3).join(' | '))
    }
  }

  check('无页面 JS 错误', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (error) {
  failures.push(`流程异常：${String(error).slice(0, 300)}`)
} finally {
  await context.close()
}

if (failures.length > 0) {
  console.error(`✗ 工作台端到端失败 ${failures.length} 项：`)
  for (const item of failures) console.error('  - ' + item)
  process.exit(1)
}
for (const item of skipped) console.log(`SKIP ${item}`)
console.log(`✓ 工作台端到端通过 ${pass} 项`)
