/**
 * client 半边公共层（v3 极简化）：API 调用、样式、通用小组件、共享类型，
 * 以及「命令注入器」——把指令文本写进宿主输入框（可选代按发送）。
 * 注入链路与 prompt-optimizer 已验证的做法一致：
 * 官方 data-* 锚点 → textarea（原生 value setter + input/change 事件）
 * → contenteditable（execCommand insertText，失败退 textContent + InputEvent）。
 */
import { useEffect } from 'react'

export const NS = 'dsh-git-panel'
export const ROUTE = '/dsh-git-panel'

export type Dict = Record<string, string>

/** 路由基于当前页面 baseURI，避免硬编码端口（GUI 每次重启端口会变）。 */
export function routeUrl(path: string): string {
  const base = document.baseURI || location.href
  return new URL(ROUTE + path, base).toString()
}

/** 统一 fetch：20s 超时 + 非 JSON 报可读错误。 */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(routeUrl(path), {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text()
    let json: unknown = null
    try {
      json = text.length > 0 ? JSON.parse(text) : null
    } catch {
      json = null
    }
    if (!json) throw new Error(`接口返回非 JSON（HTTP ${response.status}）`)
    return json as T
  } finally {
    clearTimeout(timer)
  }
}

// ---- 视图类型（node 半边返回形状，与 handler.ts 对齐） ----

export interface RepoStatusView {
  isRepo: boolean
  root: string
  branch: string
  detached: boolean
  head: string
  ahead: number
  behind: number
  changed: number
  authorized: boolean
  error: string
}

export interface ChangeFileView {
  path: string
  index: string
  worktree: string
  staged: boolean
  untracked: boolean
  added: number
  deleted: number
}

export interface RepoChangesView {
  isRepo: boolean
  root: string
  branch: string
  dirty: boolean
  files: ChangeFileView[]
}

export interface CommitRowView {
  hash: string
  author: string
  date: string
  subject: string
  refs?: string
}

export interface BranchRowView {
  name: string
  current: boolean
  remote: boolean
  tracking: string
  lastDate?: string
  lastAuthor?: string
  head?: string
}

export interface AccountView {
  id: string
  provider: string
  kind: 'oauth' | 'pat'
  login: string
  displayName: string
  avatarUrl: string
  clientId: string
  scopes: string[]
  createdAt: number
  lastCheckedAt: number
  status: 'connected' | 'expired' | 'error'
  lastError: string
}

export interface SettingsView {
  allowWrite: boolean
  requireConfirm: boolean
  defaultAccountId: string
  autoSubmit: boolean
}

export interface PanelState {
  version: number
  accounts: AccountView[]
  settings: SettingsView
}

// ---- 本地偏好（localStorage） ----

export const PREF_EVENT = 'dgp:pref-changed'
export const PREF_AUTO_SUBMIT = 'dgp.autoSubmit'

export function readPref(key: string, fallback: string): string {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
    window.dispatchEvent(new Event(PREF_EVENT))
  } catch {
    /* 隐私模式下 localStorage 不可用：偏好退化为默认值 */
  }
}

export function subscribePref(onChange: () => void): () => void {
  const handler = () => onChange()
  window.addEventListener(PREF_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(PREF_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

// ---- 样式 ----

export const CSS = `
.dgp-root { font-size: 13px; color: var(--dsh-fg, inherit); }
.dgp-root ::selection { background: var(--dsh-accent, #4a9eff); color: #fff; }
.dgp-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px;
  border: 1px solid var(--dsh-border, rgba(128,128,128,.35)); background: var(--dsh-bg, transparent);
  cursor: pointer; font-size: 12px; line-height: 18px; max-width: 260px; white-space: nowrap; color: inherit; }
.dgp-chip:hover { border-color: var(--dsh-accent, #4a9eff); }
.dgp-chip:focus-visible, .dgp-btn:focus-visible, .dgp-iconbtn:focus-visible {
  outline: 2px solid var(--dsh-accent, #4a9eff); outline-offset: 1px; }
.dgp-chip:focus:not(:focus-visible), .dgp-btn:focus:not(:focus-visible), .dgp-iconbtn:focus:not(:focus-visible) { outline: none; }
.dgp-chip-branch { overflow: hidden; text-overflow: ellipsis; }
.dgp-chip-badge { opacity: .8; font-variant-numeric: tabular-nums; }
.dgp-panel { position: fixed; z-index: 2200; width: 384px; max-height: 70vh; overflow: auto;
  background: var(--dsh-popover-bg, var(--dsh-bg, #fff)); border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,.18), 0 12px 32px -8px rgba(0,0,0,.35);
  padding: 10px 12px; scrollbar-width: thin; scrollbar-color: var(--dsh-border, rgba(128,128,128,.5)) transparent;
  transform-origin: bottom left; animation: dgp-pop 140ms cubic-bezier(.16,1,.3,1); }
@keyframes dgp-pop { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .dgp-panel { animation: none; } }
.dgp-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.dgp-title { font-weight: 600; flex: 1; }
.dgp-iconbtn { border: none; background: transparent; cursor: pointer; padding: 6px; border-radius: 6px; opacity: .7;
  color: inherit; display: inline-flex; align-items: center; }
.dgp-iconbtn:hover { background: rgba(128,128,128,.15); opacity: 1; }
.dgp-sect { margin: 10px 0; }
.dgp-sect > .dgp-sect:first-child { margin-top: 0; }
.dgp-sect-title { font-size: 11px; font-weight: 500; opacity: .65; letter-spacing: .02em; margin-bottom: 6px; }
.dgp-btn { border: 1px solid var(--dsh-border, rgba(128,128,128,.35)); background: var(--dsh-bg, transparent);
  color: inherit; border-radius: 7px; padding: 5px 11px; cursor: pointer; font-size: 12px; line-height: 16px; }
.dgp-btn:hover:not(:disabled) { border-color: var(--dsh-accent, #4a9eff); }
.dgp-btn:active:not(:disabled) { transform: translateY(1px); }
.dgp-btn:disabled { opacity: .45; cursor: default; }
.dgp-btnrow { display: flex; flex-wrap: wrap; gap: 6px; }
.dgp-file { display: flex; gap: 8px; align-items: baseline; padding: 2px 0; font-family: var(--dsh-mono, monospace); font-size: 12px; }
.dgp-file-status { width: 20px; text-align: center; opacity: .85; }
.dgp-file-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }
.dgp-file-stat { opacity: .65; font-size: 11px; font-variant-numeric: tabular-nums; }
.dgp-row-line { padding: 2px 0; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgp-hash { font-family: var(--dsh-mono, monospace); opacity: .65; margin-right: 6px; }
.dgp-empty { opacity: .6; padding: 6px 0; font-size: 12px; }
.dgp-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; user-select: none; }
.dgp-toast { position: fixed; z-index: 2300; left: 50%; transform: translateX(-50%); bottom: 24px;
  background: var(--dsh-popover-bg, #222); color: var(--dsh-fg, #fff); border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,.2), 0 8px 24px -6px rgba(0,0,0,.35);
  padding: 7px 14px; font-size: 12px; animation: dgp-pop 140ms cubic-bezier(.16,1,.3,1); }
.dgp-account { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.dgp-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dgp-dot-connected { background: #2e9e5b; }
.dgp-dot-expired { background: #c77f2a; }
.dgp-dot-error { background: #c0392b; }
.dgp-input { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 6px 9px; border-radius: 7px;
  border: 1px solid var(--dsh-border, rgba(128,128,128,.4)); background: transparent; color: inherit; font-size: 12px; }
.dgp-input:focus-visible { outline: 2px solid var(--dsh-accent, #4a9eff); outline-offset: -1px; }
.dgp-muted { opacity: .65; font-size: 11px; }
.dgp-card { margin-top: 8px; border: 1px solid var(--dsh-border, rgba(128,128,128,.4)); border-radius: 8px; padding: 8px; }
.dgp-code { font-size: 18px; font-family: var(--dsh-mono, monospace); letter-spacing: .06em; margin: 4px 0; user-select: all; }
.dgp-spacer { flex: 1; }
@media (prefers-reduced-motion: reduce) { .dgp-toast, .dgp-btn:active { animation: none; transform: none; } }
`

export function useStyles(): void {
  useEffect(() => {
    if (document.getElementById('dgp-style')) return
    const style = document.createElement('style')
    style.id = 'dgp-style'
    style.textContent = CSS
    document.head.appendChild(style)
  }, [])
}

// ---- 小组件 ----

export function Dot({ state }: { state?: string }) {
  return <span className={`dgp-dot dgp-dot-${state || 'connected'}`} />
}

export function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
}

// ---- 命令注入器 ----

interface ComposerFound {
  el: HTMLElement
  kind: 'textarea' | 'input' | 'contenteditable'
  setText: (value: string) => Promise<boolean>
}

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** 发现宿主输入框：官方 data-* 锚点 → textarea → contenteditable，取可见的最高者。 */
function findComposer(): ComposerFound | null {
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.height >= 24
  }
  const anchors = [
    '[data-composer-input]',
    '[data-composer-seat] textarea',
    '[data-composer-seat] [contenteditable="true"]',
    'textarea',
    '[contenteditable="true"]',
  ]
  const seen: HTMLElement[] = []
  for (const sel of anchors) {
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const h = el as HTMLElement
      if (!visible(h)) continue
      if (seen.indexOf(h) === -1) seen.push(h)
    }
  }
  if (seen.length === 0) return null
  const el = seen.reduce((a, b) => (b.getBoundingClientRect().height > a.getBoundingClientRect().height ? b : a))

  const tag = el.tagName.toLowerCase()
  if (tag === 'textarea' || tag === 'input') {
    const box = el as HTMLTextAreaElement
    return {
      el,
      kind: tag,
      setText: async (v: string) => {
        const proto = Object.getPrototypeOf(box)
        const desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(box, 'value')
        if (desc && desc.set) desc.set.call(box, v)
        else box.value = v
        box.dispatchEvent(new Event('input', { bubbles: true }))
        box.dispatchEvent(new Event('change', { bubbles: true }))
        return box.value === v
      },
    }
  }

  // contenteditable（宿主可能是 Lexical/ProseMirror，需等选区同步后再 execCommand）
  return {
    el,
    kind: 'contenteditable',
    setText: async (v: string) => {
      const inner = (el.querySelector('[contenteditable="true"]') as HTMLElement | null) || el
      const focusTarget = inner.isContentEditable ? inner : el
      focusTarget.focus()
      const sel = window.getSelection()
      const selectAllInside = (node: HTMLElement) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        if (sel) {
          sel.removeAllRanges()
          sel.addRange(range)
        }
      }
      const norm = (s: string) => s.replace(/\u200b/g, '').replace(/\s+/g, ' ').trim()
      const readBack = () => norm(focusTarget.textContent ?? '')
      let written = false
      for (let attempt = 0; attempt < 3 && !written; attempt++) {
        selectAllInside(focusTarget)
        await nextTick()
        let cmdOk = false
        try {
          cmdOk = document.execCommand('insertText', false, v)
        } catch {
          cmdOk = false
        }
        written = cmdOk && readBack() === norm(v)
      }
      if (!written) {
        focusTarget.textContent = v
        written = readBack() === norm(v)
      }
      try {
        focusTarget.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v }))
      } catch {
        focusTarget.dispatchEvent(new Event('input', { bubbles: true }))
      }
      return written
    },
  }
}

/** 找输入框同一工具栏里的发送按钮：向上 6 层，找含 button 的兄弟容器，取最后一个启用按钮。 */
function findSendButton(el: HTMLElement): HTMLButtonElement | null {
  let node: HTMLElement | null = el
  for (let depth = 0; depth < 6 && node; depth++) {
    const parent = node.parentElement
    if (!parent) break
    for (const child of Array.from(parent.children) as HTMLElement[]) {
      if (child.contains(el)) continue
      const buttons = Array.from(child.querySelectorAll('button')) as HTMLButtonElement[]
      const enabled = buttons.filter((b) => !b.disabled && b.getBoundingClientRect().width > 0)
      if (enabled.length > 0) return enabled[enabled.length - 1]
    }
    node = parent
  }
  return null
}

export interface InjectResult {
  ok: boolean
  submitted: boolean
  error?: string
}

/**
 * 把指令文本注入宿主输入框。autoSubmit=true 时尝试代按发送按钮；
 * 找不到发送按钮只回报 submitted:false——指令已在框里，用户手动回车即可。
 */
export async function injectCommand(text: string, autoSubmit: boolean): Promise<InjectResult> {
  const composer = findComposer()
  if (!composer) return { ok: false, submitted: false, error: '未找到输入框（composer 不可见）' }
  const written = await composer.setText(text)
  if (!written) return { ok: false, submitted: false, error: '写入输入框失败（回读校验不通过）' }
  if (!autoSubmit) return { ok: true, submitted: false }
  const button = findSendButton(composer.el)
  if (button) {
    button.click()
    return { ok: true, submitted: true }
  }
  return { ok: true, submitted: false, error: '未定位到发送按钮，指令已放入输入框' }
}
