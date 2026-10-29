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

  const chipCount = await page.locator('.dgp-chip').count()
  check('输入框下方存在 Git chip 入口', chipCount > 0, `.dgp-chip=${chipCount}`)

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
    console.log('SKIP 侧边栏没有可用会话，无法验证「智能体团队」入口自身可用性')
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
