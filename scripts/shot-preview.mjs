#!/usr/bin/env node
/**
 * 预览截图脚本（dgp-v22）：从**真实运行中的 DSH GUI** 截取当前版本的界面到 docs/preview/。
 * 用法：node scripts/shot-preview.mjs [http://127.0.0.1:PORT]
 *
 * 为什么不用静态 HTML 渲染：以前这里是一个把 CSS 抽出来拼静态页面的 preview.mjs，
 * 界面向后演进后它的 markup 引用的是已删除的类（.dgp-stats 等），产物会与真实界面不符，
 * 于是 README 上「用 preview.mjs 重新生成预览」就成了假话。本脚本改成真机实拍，
 * 与 e2e 走同一条路径（同一套切会话选法 + 同一套清浮层做法），拍到什么就是什么。
 *
 * 产出 6 张（供 screenshots.json 引用，市场最多显示 8 张）：
 *   settings.png            设置页 Git 分节（密度版：概览带 + 账号一行摘要）
 *   settings-expanded.png   账号卡展开态（仓库列表 + 三档权限分段控件）
 *   chip-menu.png           输入框旁 chip 与其分组菜单
 *   workbench-changes.png   工作台改动页（双栏：左列表 / 右就地差异）
 *   workbench-history.png   工作台历史页（搜索 + 列表/泳道）
 *   workbench-files.png     工作台文件页（目录树 + Markdown 渲染）
 *
 * **截图前一律打码**（见 PRIVACY_PATTERNS）：账号名、与本插件无关的仓库名、本机绝对路径、
 * PAT scope、邮箱。预览图要展示的是界面结构，不是我的账号，所以这些位置糊掉、布局不动。
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash, createHmac } from 'node:crypto'
import { chromium } from 'playwright-core'

const BASE = process.argv[2] ?? 'http://127.0.0.1:63801'
const OUT_DIR = 'docs/preview'
const PROJECT_NAME = 'dsh-git-panel'
const NEWLINE_RE = /\r?\n/u
const BROWSER_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]

function b64u(value) {
  return Buffer.from(value).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

/** 读取宿主 browser-session secret（base64url），解码成 HMAC 用的原始字节。 */
function readSecret() {
  const file = join(homedir(), '.dsh', '.credentials.yaml')
  if (!existsSync(file)) throw new Error(`找不到凭据文件：${file}`)
  const text = readFileSync(file, 'utf8')
  const match = text.match(/client-connection\/browser-session:[\s\S]{0,200}?secret:\s*(\S+)/)
  if (match === null) throw new Error('凭据文件里没有 browser-session.secret')
  return Buffer.from(match[1].replaceAll('-', '+').replaceAll('_', '/'), 'base64')
}

/** 按宿主 dsh-client-connection 的规则铸造 dsh-auth-* cookie（绝不打印凭据）。 */
function makeCookie(secret) {
  const authority = new URL(BASE).host
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

mkdirSync(OUT_DIR, { recursive: true })
const browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ['--disable-gpu'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })

const shots = []
async function snap(page, selector, name) {
  await page.locator(selector).screenshot({ path: `${OUT_DIR}/${name}` })
  shots.push(name)
  console.log(`shot: ${OUT_DIR}/${name}`)
}

/**
 * 第三方引导浮层（dsh-auto-memory 向导、dsh-purge「用户须知」）是延迟弹出的，
 * 单纯 remove() 挡不住后面的截图：先等一轮、点掉确认按钮，再兜底移除残留遮罩。
 */
async function clearOverlays(page, { clickButtons = true } = {}) {
  await page.waitForTimeout(2500)
  for (let round = 0; round < 6; round += 1) {
    if (!clickButtons) break
    const acted = await page.evaluate(() => {
      for (const box of document.querySelectorAll('input[type="checkbox"]')) {
        if (box instanceof HTMLInputElement && !box.checked) box.click()
      }
      let hit = false
      for (const btn of document.querySelectorAll('button, [role="button"]')) {
        // 关键：宿主设置面板自己也有「关闭」按钮。不加这两条限定，清障就会把刚打开的面板点掉。
        if (btn.closest('[data-shortcut-modal]') !== null) continue
        const label = (btn.textContent ?? '').trim()
        if (/^(跳过向导|我已知晓并继续|知道了)$/.test(label)) {
          btn.click()
          hit = true
        }
      }
      return hit
    })
    if (!acted) break
    await page.waitForTimeout(700)
  }
  await page.evaluate(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    for (const node of document.querySelectorAll('body *')) {
      if (!(node instanceof HTMLElement)) continue
      const style = getComputedStyle(node)
      if (style.position !== 'fixed' && style.position !== 'absolute') continue
      if (Number(style.zIndex) < 900) continue
      const rect = node.getBoundingClientRect()
      if (rect.width < vw * 0.5 || rect.height < vh * 0.5) continue
      if (/dgp|dsh-auth/iu.test(node.className)) continue
      // 宿主自己的设置面板（data-shortcut-modal="settings"）也是 fixed + 大尺寸 + 高 z-index，
      // 不豁免就会把它一并删掉 —— 设置面板打不开的假象正是这么来的。
      if (node.hasAttribute('data-shortcut-modal')) continue
      if (node.querySelector('[data-shortcut-modal]') !== null) continue
      node.remove()
    }
  })
  await page.waitForTimeout(400)
}

/**
 * 截图前打码：预览图要展示的是界面结构，不是账号信息。
 * 做法是把命中的文字包进 `.dgp-redact` 斜纹条（字形置为透明、底色换成斜纹），
 * **不改文本长度、不改盒模型**，所以布局与真机逐像素一致，只是敏感处糊掉。
 * 规则可带 skipIn：渲染成 HTML 的 README 里 `github:zjj1769404838/dsh-git-panel`
 * 是公开的安装指令，那一块保留原样。
 */
const REDACT_STYLE_ID = 'dgp-redact-style'
const REDACT_CLASS = 'dgp-redact'

/** 所有截图共用的规则：邮箱、本机绝对路径。 */
const PRIVACY_COMMON = [
  { source: '[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+', flags: 'u' },
  // 任意盘符开头的绝对路径（反斜杠与正斜杠两种写法都要覆盖）
  { source: '[A-Za-z]:[\\\\/][^\\s"\'`]{1,}', flags: 'u' },
  { source: '/home/[\\w.-]{1,}/', flags: 'u' },
]

/** 设置页专属：账号名，以及与本插件无关的其它仓库名。 */
const PRIVACY_SETTINGS = [
  { source: 'zjj1769404838', flags: 'gu' },
  { source: 'zjj-free', flags: 'gu' },
  { source: 'dnfm-arena', flags: 'gu' },
  { source: 'dsh-prompt-optimizer', flags: 'gu' },
  { source: 'pixel-adventure', flags: 'gu' },
]

/** 工作台专属：提交作者列里也会出现账号名，但渲染出的 README 正文要保留原样。 */
const PRIVACY_WORKBENCH = [{ source: 'zjj1769404838', flags: 'gu', skipIn: '.dgp-fb-md' }]

/** 需要整块盖马赛克的容器（PAT scope 列表这类无法按词遮的长串）。 */
const PRIVACY_HATCH_SELECTORS = ['.dgp-scopes']

async function redactPrivacy(page, rootSelector, extraRules) {
  await page.evaluate(
    ({ rootSelector: root, rules, hatchSelectors, styleId, hatchClass }) => {
      const rootEl = document.querySelector(root)
      if (rootEl === null) return
      if (document.getElementById(styleId) === null) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent =
          `.${hatchClass}{color:transparent !important;` +
          `background:repeating-linear-gradient(135deg,#aab1bc 0 3px,#8f97a3 3px 6px) !important;` +
          `border-radius:2px}`
        document.head.appendChild(style)
      }
      // 整块遮的先打标，这样按词遮时能跳过它们（避免重复套壳）
      for (const selector of hatchSelectors) {
        for (const box of rootEl.querySelectorAll(selector)) box.classList.add(hatchClass)
      }
      const compiled = rules.map((rule) => ({
        all: new RegExp(rule.source, rule.flags.includes('g') ? rule.flags : `${rule.flags}g`),
        skipIn: rule.skipIn ?? null,
      }))
      const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT)
      const nodes = []
      while (walker.nextNode()) nodes.push(walker.currentNode)
      for (const node of nodes) {
        const text = node.nodeValue ?? ''
        if (text.trim() === '') continue
        // 已经遮过的（第二次截图会重走一遍）、或位于跳过区里的，一律不动
        if (node.parentElement?.closest(`.${hatchClass}`) != null) continue
        const hits = []
        for (const rule of compiled) {
          if (rule.skipIn !== null && node.parentElement?.closest(rule.skipIn) != null) continue
          rule.all.lastIndex = 0
          for (const match of text.matchAll(rule.all)) {
            if (match[0] === '') continue
            hits.push([match.index, match.index + match[0].length])
          }
        }
        if (hits.length === 0) continue
        // 区间并集：重叠的命中合成一段，避免嵌套
        hits.sort((a, b) => a[0] - b[0])
        const merged = []
        for (const [start, end] of hits) {
          const last = merged[merged.length - 1]
          if (last !== undefined && start <= last[1]) last[1] = Math.max(last[1], end)
          else merged.push([start, end])
        }
        const frag = document.createDocumentFragment()
        let cursor = 0
        for (const [start, end] of merged) {
          if (start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, start)))
          const mask = document.createElement('span')
          mask.className = hatchClass
          mask.textContent = text.slice(start, end)
          frag.appendChild(mask)
          cursor = end
        }
        if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)))
        node.parentNode?.replaceChild(frag, node)
      }
    },
    {
      rootSelector,
      rules: [...PRIVACY_COMMON, ...extraRules],
      hatchSelectors: PRIVACY_HATCH_SELECTORS,
      styleId: REDACT_STYLE_ID,
      hatchClass: REDACT_CLASS,
    },
  )
}

try {
  await context.addCookies([{ ...makeCookie(readSecret()), domain: '127.0.0.1', path: '/', httpOnly: true }])
  const page = await context.newPage()
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  await clearOverlays(page)

  // ---- ⓪ 切到本项目的会话（与 e2e-workbench / e2e-settings 同一套选法）----
  // GUI 默认可能停在非 Git 目录的会话，那时 chip 只是灰化占位，后面的链路全都点不到。
  await page.waitForSelector('[role="treeitem"]', { timeout: 15_000 })
  async function clickProject() {
    return page.evaluate((name) => {
      const row = [...document.querySelectorAll('[role="treeitem"]')].find(
        (item) => String(item.className).includes('projectRow') && item.textContent.trim() === name,
      )
      if (!row) return false
      row.click()
      return true
    }, PROJECT_NAME)
  }
  // 从项目行往后走，遇到下一个 projectRow 就停：不能 filter 全部 sessionRow，
  // 那会把别的项目下的会话也捞进来（GUI 默认选中的常是非 Git 目录的会话）。
  async function listSessionsUnderProject() {
    return page.evaluate((name) => {
      const rows = [...document.querySelectorAll('[role="treeitem"]')]
      const index = rows.findIndex(
        (item) => String(item.className).includes('projectRow') && item.textContent.trim() === name,
      )
      if (index < 0) return []
      const out = []
      for (const item of rows.slice(index + 1)) {
        const cls = String(item.className)
        if (cls.includes('projectRow')) break
        if (cls.includes('sessionRow')) out.push(item.textContent.trim().slice(0, 40))
      }
      return out
    }, PROJECT_NAME)
  }
  async function clickSessionByText(text) {
    return page.evaluate(
      ({ name, target }) => {
        const rows = [...document.querySelectorAll('[role="treeitem"]')]
        const index = rows.findIndex(
          (item) => String(item.className).includes('projectRow') && item.textContent.trim() === name,
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
      },
      { name: PROJECT_NAME, target: text },
    )
  }
  async function readChipLabel() {
    if ((await page.locator('.dgp-chip').count()) === 0) return ''
    const text = (await page.locator('.dgp-chip').first().innerText()).trim()
    return text.split(NEWLINE_RE).map((line) => line.trim()).filter(Boolean)[0] ?? ''
  }

  if (!(await clickProject())) throw new Error(`侧栏里找不到项目 ${PROJECT_NAME}，无法截图`)
  await page.waitForTimeout(800)
  let sessions = await listSessionsUnderProject()
  for (let attempt = 0; attempt < 3 && sessions.length === 0; attempt += 1) {
    await clickProject()
    await page.waitForTimeout(900)
    sessions = await listSessionsUnderProject()
  }
  if (sessions.length === 0) throw new Error('项目下没有会话，chip 无从渲染')
  let chipLabel = ''
  for (const session of sessions) {
    await clickSessionByText(session)
    await page.waitForTimeout(2000)
    // chip 首帧显示 'Git' 占位，状态接口回来后才换成真实分支：轮询最多 6 秒。
    for (let attempt = 0; attempt < 6; attempt += 1) {
      chipLabel = await readChipLabel()
      if (chipLabel && chipLabel !== 'Git') break
      await page.waitForTimeout(1000)
    }
    if (chipLabel && chipLabel !== 'Git') break
  }
  if (!chipLabel || chipLabel === 'Git') throw new Error('chip 没显示真实分支，GUI 实例可能不可用')
  console.log(`session: ${sessions[0]} | chip: ${chipLabel}`)

  // ---- ① chip 与其分组菜单 ----
  await page.evaluate(() => document.querySelector('.dgp-chip')?.click())
  await page.waitForTimeout(1000)
  if ((await page.locator('.dgp-portal.dgp-menu').count()) === 0) throw new Error('chip 菜单没渲染')
  await page.evaluate(() => {
    // 菜单是 portal 到 body 的兄弟节点：把 chip 与菜单一起截进同一张图。
    const chip = document.querySelector('.dgp-chip')
    const menu = document.querySelector('.dgp-portal.dgp-menu')
    const chipRect = chip?.getBoundingClientRect()
    const menuRect = menu?.getBoundingClientRect()
    if (!chipRect || !menuRect) return
    const box = document.createElement('div')
    box.id = 'dgp-shot-region'
    box.style.cssText = `position:fixed;z-index:-1;left:${Math.min(chipRect.left, menuRect.left) - 8}px;top:${Math.min(chipRect.top, menuRect.top) - 8}px;width:${Math.max(chipRect.right, menuRect.right) - Math.min(chipRect.left, menuRect.left) + 16}px;height:${Math.max(chipRect.bottom, menuRect.bottom) - Math.min(chipRect.top, menuRect.top) + 16}px;`
    document.body.appendChild(box)
  })
  await page.locator('#dgp-shot-region').screenshot({ path: `${OUT_DIR}/chip-menu.png` })
  shots.push('chip-menu.png')
  console.log(`shot: ${OUT_DIR}/chip-menu.png`)
  await page.evaluate(() => document.querySelector('#dgp-shot-region')?.remove())
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)

  // ---- ② 设置页 Git 分节 ----
  // 菜单是 React 状态更新后才 portal 出来的：必须「点 chip → 等一帧 → 再找菜单项」，
  // 同一次 evaluate 里点完立刻查会查不到（首跑就是这么断的）。
  async function clickMenuItem(pattern) {
    await page.evaluate(() => document.querySelector('.dgp-chip')?.click())
    await page.waitForTimeout(1000)
    return page.evaluate(
      (source) => {
        const re = new RegExp(source, 'iu')
        const items = Array.from(document.querySelectorAll('.dgp-menu button, .dgp-menu [role="menuitem"]'))
        const target = items.find((item) => re.test(item.textContent ?? ''))
        if (target === undefined) return 'not-found'
        target.click()
        return 'clicked'
      },
      pattern.source,
    )
  }
  const settingsClicked = await clickMenuItem(/打开\s*Git\s*设置/i)
  console.log(`open settings: ${settingsClicked}`)
  await page.waitForTimeout(2500)
  // 面板已经打开了：这里只清遮罩，绝不再点任何按钮（否则会把宿主面板关掉）。
  await clearOverlays(page, { clickButtons: false })
  if ((await page.locator('[data-shortcut-modal="settings"]').count()) === 0) throw new Error('设置面板没打开')
  await snap(page, '[data-shortcut-modal="settings"] .dgp-section', 'settings.png')

  // 展开一张账号卡（v22 默认折叠，至多自动展开一张）再截明细
  await page.evaluate(() => {
    const closed = document.querySelector('.dgp-section .dgp-acct[data-open="0"] .dgp-acct-summary')
    if (closed instanceof HTMLElement) closed.click()
  })
  await page.waitForTimeout(1500)
  await snap(page, '.dgp-section', 'settings-expanded.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)

  // ---- ③ 工作台三页 ----
  const wbClicked = await clickMenuItem(/工作台|Workbench/i)
  console.log(`open workbench: ${wbClicked}`)
  await page.waitForTimeout(2500)
  if ((await page.locator('.dgp-gw').count()) === 0) throw new Error('工作台没打开')
  // 点一个改动行，让右栏渲染就地差异——空态截图展示不出这个双栏形态的价值
  const previewed = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.dgp-gw-row .dgp-gw-path')]
    // 优先挑一个文本文件（图片的 diff 没有可读内容）
    const pick =
      rows.find((item) => /\.(tsx?|jsx?|mjs|json|md|css|ya?ml)$/u.test(item.textContent ?? '')) ?? rows[0]
    if (pick === undefined) return null
    pick.click()
    return pick.textContent
  })
  console.log(`preview row: ${previewed ?? '(无改动行)'}`)
  await page.waitForTimeout(2500)
  await snap(page, '.dgp-gw', 'workbench-changes.png')

  async function openTab(label) {
    const done = await page.evaluate((name) => {
      const tab = [...document.querySelectorAll('.dgp-gw-tab')].find((item) => (item.textContent ?? '').includes(name))
      if (tab === undefined) return false
      tab.click()
      return true
    }, label)
    await page.waitForTimeout(2200)
    return done
  }
  if (await openTab('历史')) await snap(page, '.dgp-gw', 'workbench-history.png')
  else console.error('跳过 workbench-history：找不到历史页签')
  if (await openTab('文件')) {
    // 选一个 markdown 文件，让右栏展示渲染效果而不是纯文本
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('button')].find((item) => /^README\.md$/u.test((item.textContent ?? '').trim()))
      if (row instanceof HTMLElement) row.click()
    })
    await page.waitForTimeout(2500)
    await snap(page, '.dgp-gw', 'workbench-files.png')
  } else console.error('跳过 workbench-files：找不到文件页签')

  console.log(`done: ${shots.length}/6 张截图 -> ${OUT_DIR}/`)
  if (shots.length < 6) process.exitCode = 1
} finally {
  await browser.close()
}
