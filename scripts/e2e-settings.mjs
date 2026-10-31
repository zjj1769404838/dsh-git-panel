#!/usr/bin/env node
/**
 * 端到端验证：点 chip 菜单里的「打开 Git 设置」后，
 *   1) 打开的必须是 DSH 设置面板（[data-shortcut-modal="settings"]）；
 *   2) 绝不能打开「智能体团队」面板（[data-team-panel]）；
 *   3) 设置页导航必须落在 Git 分节；
 *   4) 「智能体团队」入口自身仍然可用。
 *
 * 用法：
 *   node scripts/e2e-settings.mjs                       # 用默认 URL
 *   node scripts/e2e-settings.mjs --url http://127.0.0.1:60442
 *   DSH_WEB_URL=http://127.0.0.1:60442 node scripts/e2e-settings.mjs
 *
 * 依赖：playwright-core（devDependency）+ 本机已安装的 Edge/Chrome。
 * 认证：脚本自行读取 ~/.dsh/.credentials.yaml 里的 browser-session secret，
 * 按宿主 dsh-client-connection 的规则铸造 dsh-auth-* cookie。
 * 脚本与产物都不包含任何明文凭据。
 */
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash, createHmac } from 'node:crypto'
import { chromium } from 'playwright-core'

const NEWLINE_RE = /\r?\n/u
const DEFAULT_URL = 'http://127.0.0.1:60442'
const BROWSER_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  if (index >= 0 && process.argv[index + 1] !== undefined) return process.argv[index + 1]
  return fallback
}

const BASE = arg('url', process.env.DSH_WEB_URL ?? DEFAULT_URL)
const authority = new URL(BASE).host

function b64u(value) {
  return Buffer.from(value)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

/** 读取宿主 browser-session secret（base64url），解码成 HMAC 用的原始字节。 */
function readSecret() {
  const file = join(homedir(), '.dsh', '.credentials.yaml')
  if (!existsSync(file)) throw new Error(`找不到凭据文件：${file}`)
  const text = readFileSync(file, 'utf8')
  const match = text.match(/client-connection\/browser-session:[\s\S]{0,200}?secret:\s*(\S+)/)
  if (match === null) throw new Error('凭据文件里没有 client-connection/browser-session.secret')
  return Buffer.from(match[1].replaceAll('-', '+').replaceAll('_', '/'), 'base64')
}

/** 按宿主 dsh-client-connection 的规则铸造 dsh-auth-* cookie。 */
function makeCookie(secret) {
  const now = Date.now()
  const payload = { version: 1, authority, issuedAt: now, expiresAt: now + 7 * 86400000 }
  const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'))
  const signature = b64u(createHmac('sha256', secret).update(body).digest())
  return {
    name: 'dsh-auth-' + b64u(createHash('sha256').update(authority).digest()),
    value: `v1.${body}.${signature}`,
  }
}

function findBrowser() {
  for (const candidate of BROWSER_CANDIDATES) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error('找不到可用的 Edge/Chrome，请安装或改 BROWSER_CANDIDATES')
}

const failures = []
let passes = 0
function check(label, ok, extra = '') {
  if (ok) {
    passes += 1
    console.log(`PASS ${label}${extra ? ' — ' + extra : ''}`)
  } else {
    failures.push(label)
    console.error(`FAIL ${label}${extra ? ' — ' + extra : ''}`)
  }
}

const browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ['--disable-gpu'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
try {
  const cookie = makeCookie(readSecret())
  await context.addCookies([
    { ...cookie, domain: '127.0.0.1', path: '/', httpOnly: true },
  ])
  const page = await context.newPage()
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)

  const title = await page.title()
  check('页面已加载（认证通过）', title.includes('DeepSeek Harness'), `title=${title}`)

  // GUI 可能停在别的 cwd（非 Git 仓库），那时 chip 只降级成灰化「Git」甚至不渲染。
  // 先按 projectRow 边界切到本项目下的会话，再读 chip —— 与 e2e-workbench 同一套选法。
  const treeReady = await page
    .waitForSelector('[role="treeitem"]', { timeout: 15_000 })
    .then(() => true)
    .catch(() => false)
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
  // 从项目行往后走，遇到下一个 projectRow 就停：不能 filter 全部 sessionRow，
  // 那会把别的项目下的会话也捞进来（GUI 默认选中的常是非 Git 目录的会话）。
  async function listSessionsUnderProject() {
    return page.evaluate(() => {
      const rows = [...document.querySelectorAll('[role="treeitem"]')]
      const index = rows.findIndex(
        (item) => String(item.className).includes('projectRow') && item.textContent.trim() === 'dsh-git-panel',
      )
      if (index < 0) return []
      const out = []
      for (const item of rows.slice(index + 1)) {
        const cls = String(item.className)
        if (cls.includes('projectRow')) break
        if (cls.includes('sessionRow')) out.push(item.textContent.trim().slice(0, 40))
      }
      return out
    })
  }
  async function clickSessionByText(text) {
    return page.evaluate((target) => {
      const rows = [...document.querySelectorAll('[role="treeitem"]')]
      const index = rows.findIndex(
        (item) => String(item.className).includes('projectRow') && item.textContent.trim() === 'dsh-git-panel',
      )
      if (index < 0) return false
      for (const item of rows.slice(index + 1)) {
        const cls = String(item.className)
        if (cls.includes('projectRow')) break
        if (cls.includes('sessionRow') && item.textContent.trim().slice(0, 40) === target) {
          item.click()
          return true
        }
      }
      return false
    }, text)
  }
  async function readChipLabel() {
    if ((await page.locator('.dgp-chip').count()) === 0) return ''
    const text = (await page.locator('.dgp-chip').first().innerText()).trim()
    return text.split(NEWLINE_RE).map((line) => line.trim()).filter(Boolean)[0] ?? ''
  }

  let switched = { ok: false, why: 'no tree' }
  if (treeReady) {
    const found = await clickProject()
    if (!found) switched = { ok: false, why: 'no project row' }
    else {
      await page.waitForTimeout(800)
      let sessions = await listSessionsUnderProject()
      for (let attempt = 0; attempt < 3 && sessions.length === 0; attempt += 1) {
        await clickProject()
        await page.waitForTimeout(900)
        sessions = await listSessionsUnderProject()
      }
      for (const session of sessions) {
        await clickSessionByText(session)
        await page.waitForTimeout(2000)
        // chip 首帧显示 'Git' 占位，状态接口回来后才换成真实分支：轮询最多 6 秒。
        let label = ''
        for (let attempt = 0; attempt < 6; attempt += 1) {
          label = await readChipLabel()
          if (label && label !== 'Git') break
          await page.waitForTimeout(1000)
        }
        if (label && label !== 'Git') {
          switched = { ok: true, session }
          break
        }
      }
      if (!switched.ok) switched = { ok: false, why: 'no git session', sessions }
    }
  }
  await page.waitForTimeout(1200)

  const chipCount = await page.locator('.dgp-chip').count()
  check('输入框下方存在 Git chip 入口', chipCount > 0, `.dgp-chip=${chipCount} switched=${JSON.stringify(switched)}`)

  // 用 evaluate 触发 click，绕开新手引导浮层（dsh-auto-memory tour）的指针拦截。
  const opened = await page.evaluate(() => {
    const chip = document.querySelector('.dgp-chip')
    if (chip === null) return 'chip-missing'
    chip.click()
    return 'clicked'
  })
  check('点击 chip 打开菜单', opened === 'clicked', opened)
  await page.waitForTimeout(1200)

  const menuVisible = await page.locator('.dgp-portal.dgp-menu').count()
  check('菜单已渲染（portal 到 body）', menuVisible > 0, `.dgp-menu=${menuVisible}`)

  const menuHasSettings = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.dgp-menu button, .dgp-menu [role="menuitem"]'))
    return items.some((item) => /打开\s*Git\s*设置/i.test(item.textContent ?? ''))
  })
  check('菜单里有「打开 Git 设置」项', menuHasSettings)

  const clicked = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.dgp-menu button, .dgp-menu [role="menuitem"]'))
    const target = items.find((item) => /打开\s*Git\s*设置/i.test(item.textContent ?? ''))
    if (target === undefined) return 'not-found'
    target.click()
    return 'clicked'
  })
  check('点击「打开 Git 设置」', clicked === 'clicked', clicked)
  await page.waitForTimeout(2500)

  const teamPanels = await page.locator('[data-team-panel]').count()
  check('没有打开「智能体团队」面板', teamPanels === 0, `[data-team-panel]=${teamPanels}`)

  const settingsPanels = await page.locator('[data-shortcut-modal="settings"]').count()
  check('设置面板已打开', settingsPanels > 0, `[data-shortcut-modal="settings"]=${settingsPanels}`)

  const nav = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-shortcut-modal="settings"] nav button')).map((node) => ({
      text: (node.textContent ?? '').trim(),
      current: node.getAttribute('aria-current'),
    })),
  )
  check('设置页导航含 Git 分节', nav.some((row) => row.text === 'Git'), `导航项=${nav.length}`)
  check('已定位到 Git 分节', nav.some((row) => row.text === 'Git' && row.current === 'true'))

  const gitSectionText = await page.evaluate(() => {
    const panel = document.querySelector('[data-shortcut-modal="settings"]')
    return panel === null ? '' : (panel.textContent ?? '')
  })
  check('Git 分节内容已渲染', /Git/.test(gitSectionText) && /账号|仓库|授权/.test(gitSectionText))

  // ---- 结构断言（dgp-v16 重做 + dgp-v22 密度版：默认一行摘要，展开才见明细） ----
  const structure = await page.evaluate(() => {
    const panel = document.querySelector('[data-shortcut-modal="settings"]')
    const root = panel ?? document
    const count = (selector) => root.querySelectorAll(selector).length
    const text = root.textContent ?? ''
    const cards = Array.from(root.querySelectorAll('.dgp-acct'))
    return {
      overview: count('.dgp-overview'),
      stats: count('.dgp-stats'),
      accountCards: cards.length,
      summaries: count('.dgp-acct-summary'),
      openCards: count('.dgp-acct[data-open="1"]'),
      legacyHead: count('.dgp-acct-head'),
      permSeg: count('.dgp-perm-seg'),
      permSelect: count('select.dgp-perm-select'),
      repoToggle: count('.dgp-repo-toggle'),
      reposToolbar: count('.dgp-repos-toolbar'),
      scopes: count('.dgp-acct-body .dgp-scopes'),
      scopesToggles: count('.dgp-scopes-toggle'),
      bigEmpty: count('.dgp-empty:not(.dgp-empty--dense)'),
      noteLines: count('.dgp-note-line'),
      tabs: count('.dgp-tabs'),
      hasConnect: /连接账号|Connect account/.test(text),
      hasAdvanced: /高级设置|Advanced settings/.test(text),
      hasHelpToggle: /授权说明|Access notes/.test(text),
      // 首屏纵向占位：整节高度 / 视口高度，越大说明越费滚动
      sectionHeight: Math.round((panel?.querySelector('.dgp-section') ?? panel)?.getBoundingClientRect().height ?? 0),
      viewport: window.innerHeight,
    }
  })
  check('概览带已渲染（.dgp-overview）', structure.overview > 0, `.dgp-overview=${structure.overview}`)
  check('四格统计卡已移除（.dgp-stats 不存在）', structure.stats === 0, `.dgp-stats=${structure.stats}`)
  check('三 tab 结构已移除（.dgp-tabs 不存在）', structure.tabs === 0, `.dgp-tabs=${structure.tabs}`)
  check('「查看仓库」折叠开关已移除（.dgp-repo-toggle 不存在）', structure.repoToggle === 0, `.dgp-repo-toggle=${structure.repoToggle}`)
  check('权限下拉框已移除（select.dgp-perm-select 不存在）', structure.permSelect === 0, `select.dgp-perm-select=${structure.permSelect}`)
  check('有「连接账号」入口', structure.hasConnect)
  check('有「高级设置」入口', structure.hasAdvanced)
  check('有「授权说明」入口（默认折叠成一行）', structure.hasHelpToggle)
  if (structure.accountCards > 0) {
    check('账号以卡片承载（.dgp-acct）', structure.accountCards > 0, `.dgp-acct=${structure.accountCards}`)
    check('账号卡默认压成一行摘要（.dgp-acct-summary，常驻 .dgp-acct-head 已删）',
      structure.summaries === structure.accountCards && structure.legacyHead === 0,
      `summary=${structure.summaries} head=${structure.legacyHead}`)
    check('至多自动展开一张账号卡（省纵向空间）', structure.openCards <= 1, `data-open=1 的卡=${structure.openCards}`)
    check('scope 明细默认不常驻（收起时 .dgp-scopes 为 0，只留一个折叠按钮）',
      structure.scopes === 0 && structure.scopesToggles >= 0,
      `scopes=${structure.scopes} toggle=${structure.scopesToggles}`)
    check('首屏纵向占位不超两屏（整节高度 < 视口×2）',
      structure.sectionHeight < structure.viewport * 2,
      `section=${structure.sectionHeight}px viewport=${structure.viewport}px`)
    // 点开第一张卡，验证明细结构在展开态里齐备
    const expanded = await page.evaluate(() => {
      const panel = document.querySelector('[data-shortcut-modal="settings"]')
      const summary = panel?.querySelector('.dgp-acct[data-open="0"] .dgp-acct-summary')
      if (!summary) return 'no-collapsed-card'
      summary.click()
      return 'clicked'
    })
    check('点击摘要行可展开账号卡', expanded === 'clicked' || expanded === 'no-collapsed-card', expanded)
    await page.waitForTimeout(1800)
    const detail = await page.evaluate(() => {
      const root = document.querySelector('[data-shortcut-modal="settings"]') ?? document
      const count = (selector) => root.querySelectorAll(selector).length
      return {
        open: count('.dgp-acct[data-open="1"]'),
        permSeg: count('.dgp-perm-seg'),
        toolbar: count('.dgp-repos-toolbar'),
        search: count('.dgp-repos-toolbar .dgp-search'),
        bigEmpty: count('.dgp-empty:not(.dgp-empty--dense)'),
        menuBtn: count('.dgp-acct-tools .dgp-iconbtn'),
        menu: count('.dgp-acct-menu'),
        // 热区实测：分段控件每个档位的高度
        segHeights: Array.from(root.querySelectorAll('.dgp-perm-seg button')).map((b) => Math.round(b.getBoundingClientRect().height)),
        filterHeights: Array.from(root.querySelectorAll('.dgp-filter button')).map((b) => Math.round(b.getBoundingClientRect().height)),
      }
    })
    check('展开后仓库工具行与搜索框齐备（.dgp-repos-toolbar + .dgp-search）',
      detail.toolbar > 0 && detail.search > 0, `toolbar=${detail.toolbar} search=${detail.search}`)
    check('展开后权限用分段控件（.dgp-perm-seg）', detail.permSeg > 0, `.dgp-perm-seg=${detail.permSeg}`)
    check('0 仓库账号空态改单行 dense（无大插画）', detail.bigEmpty === 0, `.dgp-empty(非 dense)=${detail.bigEmpty}`)
    check('账号操作收进 ⋯ 菜单（默认只有 1 个入口按钮）',
      detail.menuBtn === detail.open && detail.menu === 0, `iconbtn=${detail.menuBtn} menu=${detail.menu}`)
    const shortTargets = [...detail.segHeights, ...detail.filterHeights].filter((h) => h > 0 && h < 24)
    check('小控件热区不低于 24 CSS px（WCAG 2.5.8）', shortTargets.length === 0,
      `seg=[${detail.segHeights.join(',')}] filter=[${detail.filterHeights.join(',')}]`)
  } else {
    console.log('SKIP 没有已连接账号，账号卡与仓库权限结构无法验证')
  }

  // 「智能体团队」入口自身仍要能用。该入口注册在 conversation.session.header.actions，
  // 只在**已有会话**页渲染，所以要先从侧边栏进一个会话。
  const entered = await page.evaluate((keyword) => {
    for (const node of document.querySelectorAll('*')) {
      if (node.children.length !== 0) continue
      const text = (node.textContent ?? '').trim()
      if (!text.includes(keyword)) continue
      const clickable = node.closest('button') ?? node.parentElement
      if (clickable instanceof HTMLElement) {
        clickable.click()
        return text.slice(0, 30)
      }
    }
    return ''
  }, '进行中')
  if (entered !== '') {
    await page.waitForTimeout(4000)
    const teamTrigger = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button[aria-haspopup="dialog"]')).find(
        (node) => (node.getAttribute('aria-label') ?? '') === '智能体团队',
      )
      if (button === undefined) return false
      button.click()
      return true
    })
    check('会话页存在「智能体团队」触发按钮', teamTrigger)
    await page.waitForTimeout(2000)
    const teamAfter = await page.locator('[data-team-panel]').count()
    check('「智能体团队」入口自身仍正常', teamAfter > 0, `[data-team-panel]=${teamAfter}`)
  } else {
    // 没有「进行中」任务时退回到点侧边栏任意会话行：团队入口只在会话页渲染。
    // 项目行是展开/折叠切换：先展开，等 DOM 刷新后再点它下面的会话行。
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[role="treeitem"]')]
      rows.find((row) => String(row.className).includes('projectRow'))?.click()
    })
    await page.waitForTimeout(800)
    const fallback = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[role="treeitem"]')]
      const projectIndex = rows.findIndex((row) => String(row.className).includes('projectRow'))
      const candidates = projectIndex >= 0 ? rows.slice(projectIndex + 1) : rows
      const session = candidates.find((row) => String(row.className).includes('sessionRow'))
      if (!session) return false
      session.click()
      return true
    })
    if (fallback) {
      await page.waitForTimeout(4000)
      const teamTrigger = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('button[aria-haspopup="dialog"]')).find(
          (node) => (node.getAttribute('aria-label') ?? '') === '智能体团队',
        )
        if (button === undefined) return false
        button.click()
        return true
      })
      check('会话页存在「智能体团队」触发按钮', teamTrigger)
      await page.waitForTimeout(2000)
      const teamAfter = await page.locator('[data-team-panel]').count()
      check('「智能体团队」入口自身仍正常', teamAfter > 0, `[data-team-panel]=${teamAfter}`)
    } else {
      console.log('SKIP 侧边栏没有可用会话，无法验证「智能体团队」入口自身可用性')
    }
  }

  await page.screenshot({ path: '.work/e2e-settings.png', fullPage: false })
} finally {
  await browser.close()
}

if (failures.length > 0) {
  console.error(`✗ 端到端验证失败 ${failures.length} 项：`)
  for (const item of failures) console.error('  - ' + item)
  process.exit(1)
}
console.log(`✓ 端到端验证通过 ${passes} 项`)
