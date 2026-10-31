#!/usr/bin/env node
/**
 * dgp-v20 真机端到端：设置页「界面」分节 / 工作台改动汇总条 / 文件视图 Markdown 渲染 /
 * 提交详情回退撤销与差异四视图。
 *
 * 前置：DSH 桌面端已加载本插件（node 半边新端点需重启）；GUI 里存在名为 dsh-git-panel 的项目，
 * 且其下至少一个会话的 cwd 是本仓库——脚本会依次点开这些会话，直到 chip 显示真实分支。
 * 用法：node scripts/e2e-v20.mjs [http://127.0.0.1:PORT]
 * 产出截图：.work/v20-*.png
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash, createHmac } from 'node:crypto'
import { chromium } from 'playwright-core'

const BASE = process.argv[2] ?? 'http://127.0.0.1:64122'
const authority = new URL(BASE).host
const BROWSER = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PROJECT_NAME = 'dsh-git-panel'
const NEWLINE_RE = /\r?\n/u

function b64u(value) {
  return Buffer.from(value).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}
function readSecret() {
  const text = readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8')
  const match = text.match(/client-connection\/browser-session:[\s\S]{0,200}?secret:\s*(\S+)/)
  if (match === null) throw new Error('no secret')
  return Buffer.from(match[1].replaceAll('-', '+').replaceAll('_', '/'), 'base64')
}
function makeCookie(secret) {
  const now = Date.now()
  const payload = { version: 1, authority, issuedAt: now, expiresAt: now + 7 * 86400000 }
  const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'))
  const signature = b64u(createHmac('sha256', secret).update(body).digest())
  return { name: 'dsh-auth-' + b64u(createHash('sha256').update(authority).digest()), value: `v1.${body}.${signature}` }
}
async function clearOverlays(page) {
  for (let round = 0; round < 6; round += 1) {
    const acted = await page.evaluate(() => {
      for (const box of document.querySelectorAll('input[type="checkbox"]')) {
        if (box instanceof HTMLInputElement && !box.checked) box.click()
      }
      let hit = false
      for (const btn of document.querySelectorAll('button, [role="button"]')) {
        const label = (btn.textContent ?? '').trim()
        if (/^(跳过向导|我已知晓并继续|知道了|继续|开始使用)$/.test(label)) { btn.click(); hit = true }
      }
      return hit
    })
    if (!acted) break
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(400)
}

mkdirSync('.work', { recursive: true })
const browser = await chromium.launch({ executablePath: BROWSER, headless: true, args: ['--disable-gpu'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
const out = []
function say(name, value) { out.push(`${value ? 'PASS' : 'FAIL'}  ${name}`) }

try {
  await context.addCookies([{ ...makeCookie(readSecret()), domain: '127.0.0.1', path: '/', httpOnly: true }])
  const page = await context.newPage()
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  await clearOverlays(page)

  // 切到本项目会话
  await page.waitForSelector('[role="treeitem"]', { timeout: 15_000 }).catch(() => null)
  await page.evaluate((name) => {
    const row = [...document.querySelectorAll('[role="treeitem"]')].find(
      (item) => String(item.className).includes('projectRow') && item.textContent.trim() === name,
    )
    row?.click()
  }, PROJECT_NAME)
  await page.waitForTimeout(700)
  const sessions = await page.evaluate((name) => {
    const rows = [...document.querySelectorAll('[role="treeitem"]')]
    const index = rows.findIndex((i) => String(i.className).includes('projectRow') && i.textContent.trim() === name)
    if (index < 0) return []
    return rows.slice(index + 1).filter((i) => String(i.className).includes('sessionRow')).map((i) => i.textContent.trim().slice(0, 40))
  }, PROJECT_NAME)
  for (const session of sessions) {
    await page.evaluate((args) => {
      const rows = [...document.querySelectorAll('[role="treeitem"]')]
      const index = rows.findIndex((i) => String(i.className).includes('projectRow') && i.textContent.trim() === args.name)
      if (index < 0) return
      rows.slice(index + 1).filter((i) => String(i.className).includes('sessionRow'))
        .find((i) => i.textContent.trim().slice(0, 40) === args.target)?.click()
    }, { name: PROJECT_NAME, target: session })
    await page.waitForTimeout(2000)
    const first = (await page.locator('.dgp-chip').count()) === 0
      ? ''
      : ((await page.locator('.dgp-chip').first().innerText()).trim().split(NEWLINE_RE)[0] ?? '')
    if (first !== '' && first !== 'Git') break
  }

  // ① 设置页「界面」分节
  await page.evaluate(() => document.querySelector('.dgp-chip')?.click())
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.dgp-menu button')]
    items.find((b) => /打开 Git 设置/.test(b.textContent ?? ''))?.click()
  })
  await page.waitForTimeout(2500)
  await clearOverlays(page)
  say('设置页 Git 分节渲染', (await page.locator('.dgp-overview').count()) === 1)
  const ifaceBtn = await page.locator('.dgp-overview button', { hasText: /界面/ }).count()
  say('概览带有「界面」按钮', ifaceBtn >= 1)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.dgp-overview button')]
    btns.find((b) => /^(界面|Interface)$/.test((b.textContent ?? '').trim()))?.click()
  })
  await page.waitForTimeout(900)
  say('「界面」面板展开（dgp-num 行数输入框）', (await page.locator('.dgp-num').count()) >= 1)
  say('差异布局四档', (await page.locator('.dgp-seg button').count()) >= 4)
  say('AI 模型下拉存在', (await page.locator('.dgp-adv select').count()) >= 1)
  const aiOptions = await page.evaluate(() => {
    const sel = document.querySelector('.dgp-adv select')
    return sel instanceof HTMLSelectElement ? sel.options.length : 0
  })
  say('AI 模型下拉有选项（含跟随默认）', aiOptions >= 1)
  await page.screenshot({ path: '.work/v20-settings-interface.png', fullPage: false })
  if (await page.locator('.dgp-section').count()) await page.locator('.dgp-section').first().screenshot({ path: '.work/v20-settings-interface-section.png' })

  // ② 工作台：改动汇总条 + 文件视图 Markdown
  await page.evaluate(() => document.querySelector('.dgp-chip')?.click())
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.dgp-menu button')]
    items.find((b) => /Git\s*工作台/.test(b.textContent ?? ''))?.click()
  })
  await page.waitForTimeout(2500)
  say('工作台模态框打开', (await page.locator('.dgp-gw').count()) === 1)
  say('改动视图汇总条存在', (await page.locator('.dgp-gw-summary').count()) === 1)

  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.dgp-gw-tab')]
    btns.find((b) => /文件|Files/.test(b.textContent ?? ''))?.click()
  })
  await page.waitForTimeout(1800)
  say('文件视图渲染', (await page.locator('.dgp-fb').count()) === 1)
  const mdOpened = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.dgp-fb-row, .dgp-fb-name, button')]
    const target = rows.find((n) => (n.textContent ?? '').trim() === 'README.md')
    if (!target) return false
    target.click()
    return true
  })
  await page.waitForTimeout(2200)
  say('点击 README.md', mdOpened)
  const mdCount = await page.locator('.dgp-fb-md').count()
  say('Markdown 渲染视图出现（.dgp-fb-md）', mdCount >= 1)
  const mdHeads = await page.evaluate(() => document.querySelectorAll('.dgp-fb-md h1, .dgp-fb-md h2, .dgp-fb-md h3').length)
  say('Markdown 渲染出标题元素', mdHeads >= 1)
  const mdTables = await page.evaluate(() => {
    const table = document.querySelector('.dgp-fb-md table.dgp-md-table')
    if (table === null) return -1
    const head = table.querySelectorAll('thead th').length
    return head > 0 ? head : 0
  })
  say('Markdown 表格渲染为真表格（thead th）', mdTables >= 2)
  if (await page.locator('.dgp-gw').count()) await page.locator('.dgp-gw').screenshot({ path: '.work/v20-files-markdown.png' })

  // ③ 提交详情弹窗里的四视图 + 回退按钮
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.dgp-gw-tab')]
    btns.find((b) => /历史|History/.test(b.textContent ?? ''))?.click()
  })
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.dgp-gw-logrow')]
    rows[0]?.click()
  })
  await page.waitForTimeout(2200)
  const modalCount = await page.locator('.dgp-modal').count()
  say('提交详情弹窗打开', modalCount >= 1)
  const hasReset = await page.locator('.dgp-modal button', { hasText: /回退/ }).count()
  const hasRevert = await page.locator('.dgp-modal button', { hasText: /撤销此提交/ }).count()
  say('提交详情有回退按钮', hasReset >= 1)
  say('提交详情有撤销按钮', hasRevert >= 1)
  const layoutBtns = await page.evaluate(() => {
    const segs = [...document.querySelectorAll('.dgp-modal .dgp-seg button')].map((b) => (b.textContent ?? '').trim())
    return segs
  })
  say(`差异四档（实际 ${JSON.stringify(layoutBtns)}）`, layoutBtns.length >= 4)
  say('差异视图有行号列', (await page.locator('.dgp-modal .dgp-dv-num, .dgp-modal .dgp-dv-gutter, .dgp-modal .dgp-dv-row').count()) >= 1)
  if (await page.locator('.dgp-modal').count()) await page.locator('.dgp-modal').first().screenshot({ path: '.work/v20-commit-detail.png' })
} finally {
  await browser.close()
  console.log(out.join('\n'))
  const fails = out.filter((line) => line.startsWith('FAIL'))
  console.log(`\n${out.length - fails.length}/${out.length} passed`)
  if (fails.length > 0) process.exitCode = 1
}
