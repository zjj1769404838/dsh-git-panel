#!/usr/bin/env node
/**
 * 截图脚本：打开设置 → Git 分节，关掉遮挡的「用户须知」弹窗后截干净图。
 * 用法：node scripts/shot-settings.mjs [http://127.0.0.1:63801]
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

mkdirSync('.work', { recursive: true })
const browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ['--disable-gpu'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
try {
  await context.addCookies([{ ...makeCookie(readSecret()), domain: '127.0.0.1', path: '/', httpOnly: true }])
  const page = await context.newPage()
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)

  // 反复清障：dsh-auto-memory 引导浮层（「跳过向导」）、dsh-purge 用户须知（「我已知晓并继续」）等。
  for (let round = 0; round < 6; round += 1) {
    const acted = await page.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      for (const box of boxes) {
        if (box instanceof HTMLInputElement && !box.checked) box.click()
      }
      let hit = false
      for (const btn of document.querySelectorAll('button, [role="button"]')) {
        const label = (btn.textContent ?? '').trim()
        if (/^(跳过向导|我已知晓并继续|知道了|关闭)$/.test(label)) {
          btn.click()
          hit = true
        }
      }
      return hit
    })
    if (!acted) break
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(600)

  // chip → 菜单 → 打开 Git 设置（与 e2e-settings 完全一致的路径，evaluate 点击绕开引导浮层）
  await page.evaluate(() => document.querySelector('.dgp-chip')?.click())
  await page.waitForTimeout(1200)
  const clicked = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.dgp-menu button, .dgp-menu [role="menuitem"]'))
    const target = items.find((item) => /打开\s*Git\s*设置/i.test(item.textContent ?? ''))
    if (target === undefined) return 'not-found'
    target.click()
    return 'clicked'
  })
  console.log('menu click:', clicked)
  await page.waitForTimeout(2500)

  // 关掉 dsh-purge 的「用户须知」首屏弹窗（它盖在设置面板之上）：先勾选再点确认。
  await page.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
    for (const box of boxes) {
      if (box instanceof HTMLInputElement && !box.checked) box.click()
    }
    for (const btn of document.querySelectorAll('button')) {
      if (/我已知晓并继续/.test(btn.textContent ?? '')) btn.click()
    }
  })
  await page.waitForTimeout(1200)

  const panel = page.locator('[data-shortcut-modal="settings"]')
  await panel.screenshot({ path: '.work/settings-new.png' })
  await page.screenshot({ path: '.work/settings-new-full.png' })

  // 展开高级设置再截一张
  await page.evaluate(() => {
    const root = document.querySelector('[data-shortcut-modal="settings"]')
    const buttons = Array.from(root?.querySelectorAll('button') ?? [])
    buttons.find((b) => /高级设置|Advanced settings/.test(b.textContent ?? ''))?.click()
  })
  await page.waitForTimeout(900)
  await panel.screenshot({ path: '.work/settings-new-advanced.png' })

  // 滚到高级设置底部，截权限开关区
  await page.evaluate(() => {
    const panelEl = document.querySelector('[data-shortcut-modal="settings"]')
    const scroller = panelEl?.querySelector('.dgp-section')?.parentElement ?? panelEl
    const adv = panelEl?.querySelector('.dgp-adv')
    if (adv instanceof HTMLElement) adv.scrollIntoView({ block: 'end' })
    else if (scroller instanceof HTMLElement) scroller.scrollTop = scroller.scrollHeight
  })
  await page.waitForTimeout(700)
  await panel.screenshot({ path: '.work/settings-new-advanced-bottom.png' })
  console.log('screenshots: .work/settings-new.png / settings-new-advanced.png / settings-new-advanced-bottom.png')
} finally {
  await browser.close()
}
