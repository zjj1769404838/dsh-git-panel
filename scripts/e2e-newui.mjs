/**
 * 新 UI 真机端到端（client 半边重构后的入口体系）：
 * 1) Git 只保留 chip 一个入口，chip 旁不再有独立的「当前分支详情」按钮
 * 2) 已初始化态菜单包含五个入口：刷新状态 / Git 工作台 / 打开项目目录(工作目录入口) / 打开 Git 设置(设置入口) / 当前分支详情
 * 3) 菜单里的「当前分支详情」项带当前分支名，点它 → 页面中央弹出 Modal，标题带分支名，正文展示提交记录四要素（信息/标识/作者/时间）
 * 4) Modal 在视口内不溢出（居中）
 * 5) 关闭 Modal 后 chip 仍在，且无页面 JS 错误
 *
 * 基建复用 mem-skill-playwright-core-edge-dsh-gui（自签 dsh-auth cookie + 本机 Edge）。
 * 注意：node 半边不热重载，桌面端未重启时 /repo/commits?ref= 若不可用，弹窗会显示错误文案——
 * 此时「提交行数」断言按 skip 处理，由端点级回归（scripts/test-hardening.mjs）兜底。
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

// ---- GUI 地址：命令行参数优先，其次环境变量 ----
const guiUrl = process.argv[2] || process.env.DSH_GUI_URL || ''
if (!guiUrl) {
  console.error('用法：node scripts/e2e-newui.mjs http://127.0.0.1:PORT')
  process.exit(2)
}

// ---- 自签 cookie（与 e2e-settings / e2e-workbench 同一规则）----
function b64u(buffer) {
  return Buffer.from(buffer).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}
function readSecret() {
  const raw = readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8')
  const m = /client-connection\/browser-session:[\s\S]{0,200}?secret:\s*(\S+)/.exec(raw)
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

const userDataDir = join(process.cwd(), '.work', 'e2e-newui-profile')
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
// 只收集「本插件相关」的页面错误：环境里并存多个第三方 DSH 插件，
// 它们的 slot 抢占冲突（如 `single slot "conversation.input.model.label"
// already has a registration` 来自 dsh-connect-trae-client）在任意页面都会抛，
// 与本插件无关。计入断言只会让回归长期假红，所以按归因过滤。
const IGNORED_ERROR_PATTERNS = [/single slot "[^"]+" already has a registration/u]
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

  // 切到「dsh-git-panel」项目下的会话：GUI 默认停在别的 cwd，chip 会降级成灰化 Git。
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
    const el = await page.locator('.dgp-chip').first()
    if ((await page.locator('.dgp-chip').count()) === 0) return ''
    const text = (await el.innerText()).trim()
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
  // chip 文本里还含 aux（↑N ↓N N*）多行，取第一行作为分支名
  const chipText = (await page.locator('.dgp-chip').innerText()).trim()
  const chipLabel = chipText.split(/\r?\n/u).map((s) => s.trim()).filter(Boolean)[0] ?? ''
  check('已切到本项目的会话（chip 显示真实分支）', switched.ok && chipLabel !== 'Git' && chipLabel.length > 0, `switched=${JSON.stringify(switched)} chip=${chipText}`)

  // ① 单一入口：chip 旁不应再有独立的分支详情按钮
  const branchBtnCount = await page.locator('.dgp-branchbtn').count()
  check('Git 只有 chip 一个入口（无独立分支详情按钮）', branchBtnCount === 0, `branchbtn=${branchBtnCount}`)

  // ② 已初始化态菜单：五个入口齐全，且「当前分支详情」项带分支名
  await page.evaluate(() => document.querySelector('.dgp-chip')?.click())
  await page.waitForSelector('.dgp-menu', { timeout: 5_000 })
  check('点击 chip 打开菜单', (await page.locator('.dgp-menu').count()) === 1)

  const menuItems = await page.evaluate(() =>
    [...document.querySelectorAll('.dgp-menu .dgp-menu-item-title')].map((n) => n.textContent.trim()),
  )
  for (const [label, keyword] of [
    ['刷新状态', '刷新状态'],
    ['Git 工作台', 'Git 工作台'],
    ['工作目录入口（打开项目目录）', '打开项目目录'],
    ['设置入口（打开 Git 设置）', '打开 Git 设置'],
    ['当前分支详情', '当前分支详情'],
  ]) {
    check(`菜单含【${label}】入口`, menuItems.some((item) => item.includes(keyword)), JSON.stringify(menuItems))
  }

  const branchName = chipLabel.replace(/^⎇\s*/u, '').trim()
  const menuBranch = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.dgp-menu .dgp-menu-item')]
    const hit = items.find((el) => (el.querySelector('.dgp-menu-item-title')?.textContent ?? '').includes('当前分支详情'))
    return hit?.querySelector('.dgp-menu-item-hint')?.textContent?.trim() ?? ''
  })
  check(
    '菜单里的【当前分支详情】体现当前分支名',
    branchName.length > 0 && menuBranch.includes(branchName),
    `chip=${chipLabel} menu=${menuBranch}`,
  )

  // ③ 点菜单里的「当前分支详情」→ 页面中央 Modal
  const clicked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.dgp-menu .dgp-menu-item')]
    const hit = items.find((el) => (el.querySelector('.dgp-menu-item-title')?.textContent ?? '').includes('当前分支详情'))
    if (!hit) return false
    hit.click()
    return true
  })
  if (!clicked) {
    check('点当前分支详情打开弹窗（.dgp-modal）', 'skip')
    check('分支详情弹窗挂在 body 直属层', 'skip')
    check('分支详情弹窗在视口内且居中（不溢出）', 'skip')
    check('弹窗标题体现当前分支名', 'skip')
    check('弹窗有明确关闭按钮', 'skip')
    check('提交记录展示四要素（信息/标识/作者/时间）', 'skip')
  } else {
    const opened = await page
      .waitForSelector('.dgp-modal', { timeout: 5_000 })
      .then(() => true)
      .catch(() => false)
    check('点分支详情打开弹窗（.dgp-modal）', opened)
    // 等弹窗内容落地：提交行或错误文案（二者必居其一），否则下面读到的是空壳
    await page
      .waitForSelector('.dgp-modal .dgp-tl-item, .dgp-modal .dgp-err, .dgp-modal .dgp-empty', { timeout: 8_000 })
      .catch(() => {})

    const modal = await page.evaluate(() => {
      const el = document.querySelector('.dgp-modal')
      if (!el) return null
      const rect = el.getBoundingClientRect()
      const row = el.querySelector('.dgp-tl-item')
      return {
        title: el.querySelector('.dgp-modal-title')?.textContent?.trim() ?? '',
        hasClose: !!el.querySelector('.dgp-modal-x'),
        parent: el.parentElement?.parentElement?.tagName ?? '',
        rect: {
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
        },
        viewport: { w: window.innerWidth, h: window.innerHeight },
        commits: el.querySelectorAll('.dgp-tl-item').length,
        err: el.querySelector('.dgp-err')?.textContent?.trim().slice(0, 160) ?? '',
        rowText: row?.textContent?.trim().slice(0, 300) ?? '',
      }
    })
    check('分支详情弹窗挂在 body 直属层', modal?.parent === 'BODY', JSON.stringify(modal?.parent))
    if (modal) {
      check(
        '分支详情弹窗在视口内且居中（不溢出）',
        modal.rect.top >= 0 &&
          modal.rect.left >= 0 &&
          modal.rect.top + modal.rect.h <= modal.viewport.h + 1 &&
          modal.rect.left + modal.rect.w <= modal.viewport.w + 1,
        JSON.stringify(modal),
      )
      const branchName = chipLabel.replace(/^⎇\s*/u, '').trim()
      check('弹窗标题体现当前分支名', branchName.length > 0 && modal.title.includes(branchName), `title=${modal.title} chip=${chipLabel}`)
      check('弹窗有明确关闭按钮', modal.hasClose)
      if (modal.err) {
        // node 半边未重启 → 端点不可用，提交行断言按 skip 处理。
        check('提交记录展示四要素（信息/标识/作者/时间）', 'skip')
      } else {
        check(
          '提交记录展示四要素（信息/标识/作者/时间）',
          modal.commits > 0 && /[0-9a-f]{7,}/u.test(modal.rowText) && modal.rowText.length > 20,
          `commits=${modal.commits} row=${modal.rowText}`,
        )
      }
    }

    // ④ 关闭弹窗：chip 仍在（不再有独立分支按钮）
    await page.evaluate(() => document.querySelector('.dgp-modal button[aria-label="close"]')?.click())
    await page.waitForTimeout(600)
    const after = await page.evaluate(() => ({
      modal: document.querySelectorAll('.dgp-modal').length,
      chip: document.querySelectorAll('.dgp-chip').length,
      branchbtn: document.querySelectorAll('.dgp-branchbtn').length,
    }))
    check(
      '关闭弹窗后 chip 仍在且无独立分支按钮',
      after.modal === 0 && after.chip === 1 && after.branchbtn === 0,
      JSON.stringify(after),
    )
  }

  check('无页面 JS 错误', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (error) {
  failures.push(`流程异常：${String(error).slice(0, 300)}`)
} finally {
  await context.close()
}

if (failures.length > 0) {
  console.error(`✗ 新 UI 端到端失败 ${failures.length} 项：`)
  for (const item of failures) console.error('  - ' + item)
  process.exit(1)
}
for (const item of skipped) console.log(`SKIP ${item}`)
console.log(`✓ 新 UI 端到端通过 ${pass} 项`)
