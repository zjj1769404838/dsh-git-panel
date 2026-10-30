#!/usr/bin/env node
/**
 * 截图脚本：chip 后置三页（Git 工作台模态框 / 当前分支详情时间线 / chip 分组菜单）。
 * 用法：node scripts/shot-pages.mjs [http://127.0.0.1:63801]
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash, createHmac } from 'node:crypto'
import { chromium } from 'playwright-core'

const BASE = process.argv[2] ?? 'http://127.0.0.1:63801'
const authority = new URL(BASE).host
const BROWSER_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]

function b64u(value) {
  return Buffer.from(value).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function readSecret() {
  const file = join(homedir(), '.dsh', '.credentials.yaml')
  if (!existsSync(file)) throw new Error(`找不到凭据文件：${file}`)
  const text = readFileSync(file, 'utf8')
  const match = text.match(/client-connection\/browser-session:[\s\S]{0,200}?secret:\s*(\S+)/)
  if (match === null) throw new Error('凭据文件里没有 browser-session.secret')
  return Buffer.from(match[1].replaceAll('-', '+').replaceAll('_', '/'), 'base64')
}

function makeCookie(secret) {
  const now = Date.now()
  const payload = { version: 1, authority, issuedAt: now, expiresAt: now + 7 * 86400000 }
  const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'))
  const signature = b64u(createHmac('sha256', secret).update(body).digest())
  return { name: 'dsh-auth-' + b64u(createHash('sha256').update(authority).digest()), value: `v1.${body}.${signature}` }
}

function findBrowser() {
  for (const candidate of BROWSER_CANDIDATES) if (existsSync(candidate)) return candidate
  throw new Error('找不到可用的 Edge/Chrome')
}

async function clearOverlays(page) {
  for (let round = 0; round < 6; round += 1) {
    const acted = await page.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      for (const box of boxes) {
        if (box instanceof HTMLInputElement && !box.checked) box.click()
      }
      let hit = false
      for (const btn of document.querySelectorAll('button, [role="button"]')) {
        const label = (btn.textContent ?? '').trim()
        if (/^(跳过向导|我已知晓并继续|知道了|继续|开始使用)$/.test(label)) {
          btn.click()
          hit = true
        }
      }
      return hit
    })
    if (!acted) break
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(400)
}

mkdirSync('.work', { recursive: true })
const browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ['--disable-gpu'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
try {
  await context.addCookies([{ ...makeCookie(readSecret()), domain: '127.0.0.1', path: '/', httpOnly: true }])
  const page = await context.newPage()
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  await clearOverlays(page)

  // ① chip 分组菜单
  await page.evaluate(() => document.querySelector('.dgp-chip')?.click())
  await page.waitForTimeout(1200)
  await page.screenshot({ path: '.work/pages-menu.png' })

  // ② Git 工作台模态框
  const openWb = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.dgp-menu button, .dgp-menu [role="menuitem"]'))
    const target = items.find((item) => /Git\s*工作台/.test(item.textContent ?? ''))
    if (target === undefined) return 'not-found'
    target.click()
    return 'clicked'
  })
  console.log('workbench:', openWb)
  await page.waitForTimeout(2500)
  await clearOverlays(page)
  await page.screenshot({ path: '.work/pages-workbench.png' })

  const wb = page.locator('.dgp-gw')
  if (await wb.count()) {
    await wb.screenshot({ path: '.work/pages-workbench-panel.png' })
    // 切到「历史」
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.dgp-gw-railbtn'))
      btns.find((b) => /历史|History/.test(b.textContent ?? ''))?.click()
    })
    await page.waitForTimeout(1400)
    await wb.screenshot({ path: '.work/pages-workbench-history.png' })
    // 历史里的「泳道」档（dgp-v20 起分支图并入历史列表）
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.dgp-seg button'))
      btns.find((b) => /泳道|Lanes/.test(b.textContent ?? ''))?.click()
    })
    await page.waitForTimeout(1800)
    await wb.screenshot({ path: '.work/pages-workbench-lane.png' })
    // 关闭模态框
    await page.evaluate(() => document.querySelector('.dgp-gw-x')?.click())
    await page.waitForTimeout(900)
  }

  // ③ 当前分支详情（时间线）
  await page.evaluate(() => document.querySelector('.dgp-chip')?.click())
  await page.waitForTimeout(1100)
  const openDetail = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.dgp-menu button, .dgp-menu [role="menuitem"]'))
    const target = items.find((item) => /当前分支详情/.test(item.textContent ?? ''))
    if (target === undefined) return 'not-found'
    target.click()
    return 'clicked'
  })
  console.log('branch detail:', openDetail)
  await page.waitForTimeout(2600)
  await page.screenshot({ path: '.work/pages-branchdetail.png' })
  const modal = page.locator('.dgp-modal')
  if (await modal.count()) await modal.screenshot({ path: '.work/pages-branchdetail-modal.png' })

  console.log('screenshots: .work/pages-menu.png / pages-workbench*.png / pages-branchdetail*.png')
} finally {
  await browser.close()
}
