#!/usr/bin/env node
/**
 * 截图脚本：非 Git 仓库状态下的初始化流程（chip 菜单 → 初始化 Git 项目 → 单页表单 + 实时计划）。
 * 用法：node scripts/shot-init.mjs [http://127.0.0.1:63801]
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
      for (const box of Array.from(document.querySelectorAll('input[type="checkbox"]'))) {
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

  // ① 非仓库状态的 chip
  const chip = await page.evaluate(() => {
    const node = document.querySelector('.dgp-chip')
    if (node === null) return { found: false }
    return { found: true, text: (node.textContent ?? '').trim(), norepo: node.getAttribute('data-norepo') }
  })
  console.log('chip:', JSON.stringify(chip))
  await page.screenshot({ path: '.work/init-chip.png' })

  // ② 点开 chip 菜单（未初始化应只给「初始化 Git 项目」）
  await page.evaluate(() => document.querySelector('.dgp-chip')?.click())
  await page.waitForTimeout(1200)
  const menu = await page.evaluate(() => {
    const root = document.querySelector('.dgp-menu')
    if (root === null) return { found: false }
    return {
      found: true,
      items: Array.from(root.querySelectorAll('button, [role="menuitem"]')).map((n) => (n.textContent ?? '').trim()),
      text: (root.textContent ?? '').trim().slice(0, 400),
    }
  })
  console.log('menu:', JSON.stringify(menu))
  await page.screenshot({ path: '.work/init-menu.png' })

  // ③ 点「初始化 Git 项目」打开向导
  const clicked = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.dgp-menu button, .dgp-menu [role="menuitem"]'))
    const target = items.find((item) => /初始化\s*Git\s*项目/.test(item.textContent ?? ''))
    if (target === undefined) return 'not-found'
    target.click()
    return 'clicked'
  })
  console.log('init click:', clicked)
  await page.waitForTimeout(1500)
  const wizard = await page.evaluate(() => {
    const root = document.querySelector('.dgp-iw')
    if (root === null) return { found: false }
    const plan = root.querySelector('.dgp-plan')
    return {
      found: true,
      sections: Array.from(root.querySelectorAll('.dgp-iw-secthead')).map((n) => (n.textContent ?? '').trim()),
      planText: (plan?.textContent ?? '').trim(),
      options: Array.from(root.querySelectorAll('.dgp-option')).map((n) => (n.textContent ?? '').trim()),
      buttons: Array.from(document.querySelectorAll('.dgp-modal-foot button')).map((n) => (n.textContent ?? '').trim()),
    }
  })
  console.log('wizard:', JSON.stringify(wizard, null, 2))
  await page.screenshot({ path: '.work/init-wizard.png' })
  const panel = await page.evaluate(() => {
    const root = document.querySelector('.dgp-modal')
    if (root === null) return null
    const rect = root.getBoundingClientRect()
    return { w: Math.round(rect.width), h: Math.round(rect.height), top: Math.round(rect.top), left: Math.round(rect.left) }
  })
  console.log('modal rect:', JSON.stringify(panel))
  await page.screenshot({ path: '.work/init-wizard-full.png', fullPage: false })

  // ④ 点「在该账号下新建仓库」展开建仓面板
  const opened = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.dgp-iw button'))
    const target = buttons.find((item) => (item.textContent ?? '').includes('新建仓库'))
    if (target === undefined) return 'not-found'
    target.click()
    return 'clicked'
  })
  console.log('create open:', opened)
  await page.waitForTimeout(900)
  const createPanel = await page.evaluate(() => {
    const root = document.querySelector('.dgp-iw-create')
    if (root === null) return { found: false }
    return {
      found: true,
      text: (root.textContent ?? '').trim().slice(0, 300),
      inputs: Array.from(root.querySelectorAll('input')).map((n) => ({ type: n.type, value: n.value })),
      buttons: Array.from(root.querySelectorAll('button')).map((n) => ({ text: (n.textContent ?? '').trim(), disabled: n.disabled })),
    }
  })
  console.log('create panel:', JSON.stringify(createPanel, null, 2))
  await page.screenshot({ path: '.work/init-create.png' })

  console.log('screenshots: .work/init-chip.png / init-menu.png / init-wizard.png / init-wizard-full.png / init-create.png')
} finally {
  await context.close()
  await browser.close()
}
