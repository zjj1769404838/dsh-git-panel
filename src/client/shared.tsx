/**
 * client 半边公共层（v3.15 极简化）：API 调用、样式、通用小组件、共享类型。
 * v3.15：删除「命令注入器」（把指令写进宿主输入框 + 可选代按发送）整套——
 * 交互动作链下线，面板只承载状态展示与基础配置。
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

// ---- 样式 ----

export const CSS = `
/* 设计令牌（ui-ux-pro-max / Dark Mode OLED）：开发者工具深色皮肤。
   变量同时挂在 root / panel：panel 是 portal，脱离 .dgp-root 继承，必须自带一份。 */
.dgp-root, .dgp-panel {
  --dgp-bg: #08090a;
  --dgp-bg-soft: #0f1115;
  --dgp-bg-hover: #16181d;
  --dgp-bg-inset: #050607;
  --dgp-fg: #f7f8fa;
  --dgp-fg-muted: #8a8f98;
  --dgp-fg-faint: #565b66;
  --dgp-border: #1c1e22;
  --dgp-border-strong: #34373d;
  --dgp-accent: #5e6ad2;
  --dgp-accent-hover: #6e78e8;
  --dgp-accent-strong: #98a2f3;
  --dgp-accent-fg: #ffffff;
  --dgp-danger: #e5484d;
  --dgp-warn: #f5a524;
  --dgp-info: #4a9eff;
  --dgp-shadow: 0 1px 2px rgba(0,0,0,.5), 0 12px 32px -8px rgba(0,0,0,.65);
  --dgp-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --dgp-sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
@media (prefers-color-scheme: light) {
  .dgp-root, .dgp-panel {
    --dgp-bg: #ffffff;
    --dgp-bg-soft: #f7f8f9;
    --dgp-bg-hover: #eef0f3;
    --dgp-bg-inset: #f0f2f4;
    --dgp-fg: #1a1d21;
    --dgp-fg-muted: #5e6370;
    --dgp-fg-faint: #9aa0a8;
    --dgp-border: #e6e8eb;
    --dgp-border-strong: #d3d7dc;
    --dgp-accent: #4a59d8;
    --dgp-accent-hover: #3f4dd0;
    --dgp-accent-strong: #4350c9;
    --dgp-accent-fg: #ffffff;
    --dgp-danger: #d23b3f;
    --dgp-warn: #c9820a;
    --dgp-info: #2f7fe0;
    --dgp-shadow: 0 1px 2px rgba(15,23,42,.08), 0 12px 32px -8px rgba(15,23,42,.18);
  }
}
.dgp-root, .dgp-panel { font: 13px/1.5 var(--dgp-sans); color: var(--dgp-fg); }
.dgp-root ::selection, .dgp-panel ::selection { background: var(--dgp-accent); color: var(--dgp-accent-fg); }

/* chip：输入框旁入口，恒显 Git 文本 + 分支（v3.15 去掉状态数字徽标） */
.dgp-chip { display: inline-flex; align-items: center; gap: 7px; padding: 4px 11px; border-radius: 9px;
  border: 1px solid var(--dgp-border-strong); background: var(--dgp-bg-soft); color: var(--dgp-fg);
  cursor: pointer; font-size: 12px; line-height: 18px; max-width: 280px; white-space: nowrap;
  transition: border-color 150ms ease, background 150ms ease, transform 120ms ease-out; }
.dgp-chip:hover { border-color: var(--dgp-accent); background: var(--dgp-bg-hover); }
.dgp-chip:active { transform: scale(.97); }
.dgp-chip svg { color: var(--dgp-accent-strong); flex: none; }
.dgp-chip-label { font-weight: 600; letter-spacing: .02em; flex: none; }
.dgp-chip-sep { color: var(--dgp-fg-faint); flex: none; font-family: var(--dgp-mono); }
.dgp-chip-branch { overflow: hidden; text-overflow: ellipsis; min-width: 0; font-family: var(--dgp-mono); color: var(--dgp-fg-muted); }

/* 焦点可见 */
.dgp-chip:focus-visible, .dgp-btn:focus-visible, .dgp-iconbtn:focus-visible, .dgp-input:focus-visible {
  outline: 2px solid var(--dgp-accent-strong); outline-offset: 2px; }
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

/* 头部 / 状态栏 */
.dgp-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--dgp-border); }
.dgp-head svg { color: var(--dgp-accent-strong); flex: none; }
.dgp-title { font-weight: 600; font-size: 13px; letter-spacing: .01em; }
.dgp-iconbtn { border: none; background: transparent; cursor: pointer; padding: 5px; border-radius: 7px;
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

/* 分区 */
.dgp-sect { margin: 0; padding: 13px 14px; border-bottom: 1px solid var(--dgp-border); }
.dgp-sect:last-child { border-bottom: none; }
.dgp-sect-title { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
  color: var(--dgp-fg-muted); margin-bottom: 9px; }
.dgp-muted { color: var(--dgp-fg-muted); font-size: 12px; }
.dgp-empty { color: var(--dgp-fg-muted); padding: 6px 0; font-size: 12px; }
.dgp-spacer { flex: 1; }

/* 按钮 */
.dgp-btn { border: 1px solid var(--dgp-border-strong); background: var(--dgp-bg-soft); color: var(--dgp-fg);
  border-radius: 7px; padding: 5px 12px; cursor: pointer; font-size: 12px; line-height: 17px;
  transition: transform 120ms ease-out, background 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease; }
.dgp-btn:hover:not(:disabled):not(.dgp-btn-accent) { border-color: var(--dgp-accent); background: var(--dgp-bg-hover); }
.dgp-btn:active:not(:disabled) { transform: translateY(1px); }
.dgp-btn:disabled { opacity: .4; cursor: default; }
/* 主操作按钮（建仓 / 发布 / 连接）：实心 accent，白字，hover 微亮 */
.dgp-btn-accent { background: var(--dgp-accent); border-color: var(--dgp-accent); color: var(--dgp-accent-fg); font-weight: 600; }
.dgp-btn-accent:hover:not(:disabled) { background: var(--dgp-accent-hover); border-color: var(--dgp-accent-hover); }
.dgp-btn-danger { color: var(--dgp-danger); border-color: rgba(229,72,77,.45); }
.dgp-btn-danger:hover:not(:disabled) { border-color: var(--dgp-danger); background: var(--dgp-bg-hover); }
.dgp-btnrow { display: flex; flex-wrap: wrap; gap: 6px; }

/* 文件列表 */
.dgp-file { display: flex; gap: 8px; align-items: center; padding: 3px 0; font: 12px/1.5 var(--dgp-mono); }
.dgp-file a { overflow-wrap: anywhere; min-width: 0; color: var(--dgp-info); }
.dgp-file-status { width: 20px; text-align: center; color: var(--dgp-accent-strong); font-weight: 600; }
.dgp-file-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

/* 表单字段 */
.dgp-field { margin-top: 8px; }
.dgp-label { display: block; font-size: 11px; font-weight: 600; color: var(--dgp-fg-muted); letter-spacing: .02em; }
.dgp-checkbox { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; cursor: pointer; user-select: none; color: var(--dgp-fg-muted); margin-top: 8px; }
.dgp-checkbox input[type='checkbox'] { accent-color: var(--dgp-accent); width: 14px; height: 14px; cursor: pointer; }
.dgp-toggle { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; cursor: pointer;
  user-select: none; color: var(--dgp-fg-muted); }
.dgp-toggle input[type='checkbox'] { accent-color: var(--dgp-accent); width: 14px; height: 14px; cursor: pointer; }
.dgp-input { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 7px 10px; border-radius: 7px;
  border: 1px solid var(--dgp-border-strong); background: var(--dgp-bg-inset); color: var(--dgp-fg); font-size: 12px;
  transition: border-color 150ms ease, box-shadow 150ms ease; }
.dgp-input:focus { border-color: var(--dgp-accent); }
.dgp-input::placeholder { color: var(--dgp-fg-muted); opacity: 1; }
.dgp-card { margin-top: 8px; border: 1px solid var(--dgp-border); border-radius: 10px; padding: 11px 12px; background: var(--dgp-bg-soft); }
.dgp-code { font-size: 18px; font-family: var(--dgp-mono); letter-spacing: .08em; margin: 4px 0; user-select: all; color: var(--dgp-accent-strong); }
.dgp-account { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--dgp-border); }
.dgp-account:last-child { border-bottom: none; }
.dgp-acct-login { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dgp-mono); font-size: 12px; }
.dgp-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dgp-dot-connected { background: var(--dgp-accent); }
.dgp-dot-expired { background: var(--dgp-warn); }
.dgp-dot-error { background: var(--dgp-danger); }

/* 远程地址行 */
.dgp-remote { display: flex; align-items: center; gap: 8px; padding: 5px 0; min-width: 0; }
.dgp-remote-name { font: 600 12px var(--dgp-mono); color: var(--dgp-fg); flex: none; }
.dgp-remote-url { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; color: var(--dgp-info); text-decoration: none; font-size: 12px; }
.dgp-remote-url:hover { text-decoration: underline; }

/* 最近提交 */
.dgp-commit { display: flex; align-items: baseline; gap: 8px; padding: 5px 0; min-width: 0; }
.dgp-commit-hash { font: 600 12px var(--dgp-mono); color: var(--dgp-accent-strong); flex: none; }
.dgp-commit-subject { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; color: var(--dgp-fg); font-size: 12px; }
.dgp-commit-date { flex: none; color: var(--dgp-fg-muted); font-size: 11px; font-family: var(--dgp-mono); }

@media (prefers-reduced-motion: reduce) {
  .dgp-panel { animation: none; }
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
