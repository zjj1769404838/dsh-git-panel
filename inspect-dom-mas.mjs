// 只读排查脚本：列出页面上所有被本插件标注过的节点 + 所有 aria-haspopup="menu" 按钮
import { chromium } from 'playwright-core'

const URL = process.env.DSH_GUI || 'http://127.0.0.1:50479'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)

const report = await page.evaluate(() => {
  const own = 'data-mas-own'
  const badges = [...document.querySelectorAll(`[${own}]`)].map((el) => ({
    text: el.textContent,
    tag: el.tagName,
    parentTag: el.parentElement?.tagName,
    parentText: (el.parentElement?.textContent || '').slice(0, 60),
    parentAria: el.parentElement?.getAttribute('aria-label'),
    parentClass: (el.parentElement?.className || '').slice(0, 80),
  }))
  const menus = [...document.querySelectorAll('button[aria-haspopup="menu"]')].map((el) => ({
    aria: el.getAttribute('aria-label'),
    text: (el.textContent || '').slice(0, 60),
    cls: (el.className || '').slice(0, 80),
    hasModelSpan: el.querySelector('span[data-model-id]') !== null,
  }))
  const rows = [...document.querySelectorAll('span[data-model-id][data-provider-id]')].map((el) => ({
    model: el.getAttribute('data-model-id'),
    provider: el.getAttribute('data-provider-id'),
    hostText: [...el.childNodes].filter((n) => !(n.nodeType === 1 && n.hasAttribute?.(own))).map((n) => n.textContent).join('').trim().slice(0, 40),
    ownText: [...el.querySelectorAll(`[${own}]`)].map((n) => n.textContent).join('|'),
  }))
  return { badgeCount: badges.length, badges, menuCount: menus.length, menus, rowCount: rows.length, rows }
})

console.log(JSON.stringify(report, null, 2))
await browser.close()
