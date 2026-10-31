import { chromium } from 'playwright-core'
const URL = process.env.DSH_GUI || 'http://127.0.0.1:50479'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(8000)
await page.screenshot({ path: 'D:/my-projects/plugins/@zjj/dsh-model-auto-select/.tmp-page.png' })
console.log('title:', await page.title())
console.log('body len:', (await page.evaluate(() => document.body.innerText)).length)
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 600))
await browser.close()
