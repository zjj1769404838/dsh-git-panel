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
/* 设计令牌（ui-ux-pro-max / Dark Mode OLED）：开发者工具深色皮肤。
   变量同时挂在 root / panel / toast：panel 与 toast 是 portal，脱离 .dgp-root 继承，必须自带一份。 */
.dgp-root, .dgp-panel, .dgp-toast {
  --dgp-bg: #0f172a;
  --dgp-bg-soft: #1b2336;
  --dgp-bg-hover: #272f42;
  --dgp-fg: #f1f5f9;
  --dgp-fg-muted: #94a3b8;
  --dgp-border: #233047;
  --dgp-border-strong: #3b4a63;
  --dgp-accent: #22c55e;
  --dgp-accent-fg: #06210f;
  --dgp-danger: #ef4444;
  --dgp-warn: #f59e0b;
  --dgp-info: #38bdf8;
  --dgp-shadow: 0 1px 2px rgba(0,0,0,.45), 0 16px 44px -12px rgba(0,0,0,.72);
  --dgp-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --dgp-sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
@media (prefers-color-scheme: light) {
  .dgp-root, .dgp-panel, .dgp-toast {
    --dgp-bg: #ffffff;
    --dgp-bg-soft: #f4f7fb;
    --dgp-bg-hover: #e8eef6;
    --dgp-fg: #0f172a;
    --dgp-fg-muted: #64748b;
    --dgp-border: #e6ecf3;
    --dgp-border-strong: #cbd5e1;
    --dgp-accent: #16a34a;
    --dgp-accent-fg: #ffffff;
    --dgp-shadow: 0 1px 2px rgba(15,23,42,.10), 0 16px 44px -12px rgba(15,23,42,.28);
  }
}
.dgp-root, .dgp-panel, .dgp-toast { font: 13px/1.5 var(--dgp-sans); color: var(--dgp-fg); }
.dgp-root ::selection, .dgp-panel ::selection { background: var(--dgp-accent); color: var(--dgp-accent-fg); }

/* chip：输入框旁入口，恒显 Git 文本 + 分支 + 状态徽标 */
.dgp-chip { display: inline-flex; align-items: center; gap: 7px; padding: 4px 11px; border-radius: 8px;
  border: 1px solid var(--dgp-border-strong); background: var(--dgp-bg-soft); color: var(--dgp-fg);
  cursor: pointer; font-size: 12px; line-height: 18px; max-width: 280px; white-space: nowrap;
  transition: border-color 150ms ease, background 150ms ease, transform 120ms ease-out; }
.dgp-chip:hover { border-color: var(--dgp-accent); background: var(--dgp-bg-hover); }
.dgp-chip:active { transform: scale(.97); }
.dgp-chip svg { color: var(--dgp-accent); flex: none; }
.dgp-chip-label { font-weight: 600; letter-spacing: .04em; flex: none; }
.dgp-chip-sep { color: var(--dgp-fg-muted); flex: none; font-family: var(--dgp-mono); }
.dgp-chip-branch { overflow: hidden; text-overflow: ellipsis; min-width: 0; font-family: var(--dgp-mono); }
.dgp-chip-badge { display: inline-flex; gap: 4px; flex: none; }
.dgp-badge { font: 600 11px/1 var(--dgp-mono); padding: 3px 5px; border-radius: 5px; background: var(--dgp-bg-hover); color: var(--dgp-fg-muted); }
.dgp-badge-info { color: var(--dgp-info); }
.dgp-badge-warn { color: var(--dgp-warn); }
.dgp-badge-ok { color: var(--dgp-accent); }

/* 焦点可见 */
.dgp-chip:focus-visible, .dgp-btn:focus-visible, .dgp-iconbtn:focus-visible, .dgp-input:focus-visible {
  outline: 2px solid var(--dgp-accent); outline-offset: 2px; }
.dgp-chip:focus:not(:focus-visible), .dgp-btn:focus:not(:focus-visible), .dgp-iconbtn:focus:not(:focus-visible) { outline: none; }
.dgp-input:focus-visible { outline-offset: -1px; }

/* 面板 */
.dgp-panel { position: fixed; z-index: 2200; width: min(400px, calc(100vw - 16px)); max-height: 72vh; overflow: auto;
  background: var(--dgp-bg); color: var(--dgp-fg); border: 1px solid var(--dgp-border); border-radius: 14px;
  box-shadow: var(--dgp-shadow); padding: 0; scrollbar-width: thin; scrollbar-color: var(--dgp-border-strong) transparent;
  transform-origin: bottom left; animation: dgp-pop 160ms cubic-bezier(.16,1,.3,1); }
.dgp-panel::-webkit-scrollbar { width: 8px; }
.dgp-panel::-webkit-scrollbar-thumb { background: var(--dgp-border-strong); border-radius: 4px; }
.dgp-panel::-webkit-scrollbar-track { background: transparent; }
@keyframes dgp-pop { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes dgp-fade { from { opacity: 0; } to { opacity: 1; } }

/* 头部 / 状态栏 / 工具条 */
.dgp-head { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--dgp-border); }
.dgp-head svg { color: var(--dgp-accent); flex: none; }
.dgp-title { font-weight: 600; font-size: 13px; letter-spacing: .01em; }
.dgp-iconbtn { border: none; background: transparent; cursor: pointer; padding: 5px; border-radius: 6px;
  color: var(--dgp-fg-muted); display: inline-flex; align-items: center;
  transition: background 150ms ease, color 150ms ease, transform 120ms ease-out; }
.dgp-iconbtn:hover { background: var(--dgp-bg-hover); color: var(--dgp-fg); }
.dgp-iconbtn:active { transform: scale(.92); }
.dgp-statusbar { display: flex; align-items: center; gap: 8px; padding: 9px 14px;
  border-bottom: 1px solid var(--dgp-border); background: var(--dgp-bg-soft); }
.dgp-status-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dgp-status-dot[data-state='clean'] { background: var(--dgp-accent); }
.dgp-status-dot[data-state='dirty'] { background: var(--dgp-warn); }
.dgp-status-branch { font: 600 12px var(--dgp-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.dgp-status-meta { font: 11px var(--dgp-mono); color: var(--dgp-fg-muted); flex: none; }
.dgp-toolbar { padding: 8px 14px; border-bottom: 1px solid var(--dgp-border); background: var(--dgp-bg-soft); }

/* 分区 */
.dgp-sect { margin: 0; padding: 11px 14px; border-bottom: 1px solid var(--dgp-border); }
.dgp-sect-title { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
  color: var(--dgp-fg-muted); margin-bottom: 8px; }
.dgp-muted { color: var(--dgp-fg-muted); font-size: 12px; }
.dgp-empty { color: var(--dgp-fg-muted); padding: 6px 0; font-size: 12px; }
.dgp-spacer { flex: 1; }

/* 按钮 */
.dgp-btn { border: 1px solid var(--dgp-border-strong); background: var(--dgp-bg-soft); color: var(--dgp-fg);
  border-radius: 7px; padding: 5px 11px; cursor: pointer; font-size: 12px; line-height: 16px;
  transition: transform 120ms ease-out, background 150ms ease, border-color 150ms ease, color 150ms ease, filter 150ms ease; }
/* 实心强调按钮不套用通用 hover 背景：否则浅色主题下会变成「白字 + 浅灰底」看不清（v3.12 修复）。 */
.dgp-btn:hover:not(:disabled):not(.dgp-btn-accent) { border-color: var(--dgp-accent); background: var(--dgp-bg-hover); }
.dgp-btn:active:not(:disabled) { transform: translateY(1px); }
.dgp-btn:disabled { opacity: .4; cursor: default; }
.dgp-btn-primary { border-color: var(--dgp-accent); color: var(--dgp-accent); font-weight: 600; }
.dgp-btn-accent { background: var(--dgp-accent); color: var(--dgp-accent-fg); border-color: var(--dgp-accent); font-weight: 600; }
.dgp-btn-accent:hover:not(:disabled) { background: var(--dgp-accent); color: var(--dgp-accent-fg); filter: brightness(1.08); border-color: var(--dgp-accent); }
.dgp-btn-danger { color: var(--dgp-danger); border-color: rgba(239,68,68,.5); }
.dgp-btn-danger:hover:not(:disabled) { border-color: var(--dgp-danger); }
.dgp-btnrow { display: flex; flex-wrap: wrap; gap: 6px; }
.dgp-btn-group { margin-top: 10px; }
.dgp-btn-group:first-child { margin-top: 0; }
.dgp-group-label { font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
  color: var(--dgp-fg-muted); margin-bottom: 6px; }

/* 文件 / 提交列表 */
.dgp-file { display: flex; gap: 8px; align-items: center; padding: 3px 0; font: 12px/1.5 var(--dgp-mono); }
.dgp-file a { overflow-wrap: anywhere; min-width: 0; color: var(--dgp-info); }
.dgp-file-status { width: 20px; text-align: center; color: var(--dgp-accent); font-weight: 600; }
.dgp-file-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.dgp-file-stat { color: var(--dgp-fg-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.dgp-row-line { padding: 2px 0; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgp-hash { font: 12px var(--dgp-mono); color: var(--dgp-accent); margin-right: 8px; }

/* 表单 / 卡片 / 账号 */
.dgp-toggle { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; cursor: pointer;
  user-select: none; color: var(--dgp-fg-muted); }
.dgp-toggle input[type='checkbox'] { accent-color: var(--dgp-accent); width: 14px; height: 14px; cursor: pointer; }
.dgp-input { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 7px 10px; border-radius: 7px;
  border: 1px solid var(--dgp-border-strong); background: var(--dgp-bg); color: var(--dgp-fg); font-size: 12px; }
.dgp-input::placeholder { color: var(--dgp-fg-muted); opacity: 1; }
.dgp-card { margin-top: 8px; border: 1px solid var(--dgp-border); border-radius: 9px; padding: 10px; background: var(--dgp-bg-soft); }
.dgp-code { font-size: 18px; font-family: var(--dgp-mono); letter-spacing: .08em; margin: 4px 0; user-select: all; }
.dgp-account { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--dgp-border); }
.dgp-account:last-child { border-bottom: none; }
.dgp-acct-login { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dgp-mono); }
.dgp-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dgp-dot-connected { background: var(--dgp-accent); }
.dgp-dot-expired { background: var(--dgp-warn); }
.dgp-dot-error { background: var(--dgp-danger); }

/* toast */
.dgp-toast { position: fixed; z-index: 2300; left: 50%; transform: translateX(-50%); bottom: 24px;
  max-width: min(90vw, 420px); text-align: center; background: var(--dgp-bg-soft); color: var(--dgp-fg);
  border: 1px solid var(--dgp-border-strong); border-radius: 9px; box-shadow: var(--dgp-shadow);
  padding: 8px 15px; font-size: 12px; animation: dgp-fade 160ms ease; }

@media (prefers-reduced-motion: reduce) {
  .dgp-panel, .dgp-toast { animation: none; }
  .dgp-btn:active, .dgp-chip:active, .dgp-iconbtn:active { transform: none; }
}
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
  const label = state === 'expired' ? 'expired' : state === 'error' ? 'error' : 'connected'
  return <span className={`dgp-dot dgp-dot-${state || 'connected'}`} role="img" aria-label={label} />
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
