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
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))

try {
  await page.goto(guiUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  const title = await page.title()
  check('页面已加载（认证通过）', title.includes('DeepSeek'), `title=${title}`)

  await page.waitForSelector('.dgp-chip', { timeout: 15_000 })
  check('输入框下方存在 Git chip 入口', (await page.locator('.dgp-chip').count()) === 1)

  await page.evaluate(() => document.querySelector('.dgp-chip')?.click())
  await page.waitForSelector('.dgp-menu', { timeout: 5_000 })
  check('点击 chip 打开菜单', (await page.locator('.dgp-menu').count()) === 1)

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
    await page.waitForSelector('.dgp-wb', { timeout: 5_000 })
    check('点击后 Git 工作台面板出现（.dgp-wb）', (await page.locator('.dgp-wb').count()) === 1)
    check('工作台带「Git 工作台」标题或空态', (await page.locator('.dgp-wb-head, .dgp-wb-state').count()) >= 1)

    // node 半边是旧版时 status 接口仍可用（老路由），面板会渲染三种首态之一：
    // 正常面板 / 未初始化 / 授权提示。任一都算「面板活着」。
    const stateCount = await page.locator('.dgp-wb-state').count()
    const mainCount = await page.locator('.dgp-wb-main').count()
    check('工作台渲染出主面板或状态首屏', stateCount >= 1 || mainCount >= 1, `state=${stateCount} main=${mainCount}`)
    check('面板有可交互的关闭按钮', (await page.locator('.dgp-wb .dgp-wb-x').count()) >= 1)
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
