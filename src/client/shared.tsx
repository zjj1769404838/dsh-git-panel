/**
 * client 半边公共层：API 调用、样式注入、通用小组件与共享类型。
 * index.tsx（chip + 设置页）与 workbench.tsx（Git 工作台）都从这里引用，
 * esbuild 会把三者打进同一个 lib/client.js 产物，不产生额外请求。
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

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

/** 供 index.tsx 继续使用的旧名（内部同一路由函数）。 */
export const routeUrlLegacy = routeUrl

// ---- 仓库状态/变更/图视图类型（node 半边返回形状） ----

export interface RepoStatusView {
  isRepo: boolean
  root: string
  branch: string
  detached: boolean
  head: string
  ahead: number
  behind: number
  changed: number
  authorized?: boolean
  error: string
  /** repo=确认是仓库；no-repo=目录存在但没有 .git（才允许显示初始化）；invalid=路径非法/不存在/不可读。 */
  reason?: 'repo' | 'no-repo' | 'invalid'
}

export interface ChangeFileView {
  path: string
  index: string
  worktree: string
  added: number
  deleted: number
  staged: boolean
}

export interface RepoChangesView {
  isRepo: boolean
  root: string
  branch: string
  dirty: boolean
  files: ChangeFileView[]
}

export interface GraphRefView {
  name: string
  kind: 'head' | 'local' | 'remote' | 'tag'
}

export interface GraphRowView {
  hash: string
  short: string
  parents: string[]
  author: string
  date: string
  subject: string
  refs: GraphRefView[]
  row: number
  lane: number
  segments: Array<{ from: number; to: number }>
  through: number[]
}

// ---- 设置页 Git 分节视图类型（settings.tsx / index.tsx 共用） ----

/** 已连接的 Git 账号（node 侧 /state 返回形状）。 */
export interface AccountView {
  id: string
  provider: string
  kind: 'oauth' | 'pat'
  login: string
  displayName: string
  avatarUrl: string
  host: string
  apiBase: string
  scopes: string[]
  status: 'connected' | 'expired' | 'error'
  lastError: string
  lastCheckedAt: number
}

/** 仓库访问权限档位：完整 / 只读 / 无权限。 */
export type RepoPermission = 'full' | 'read' | 'none'

/** 权限档位字面量表（node 侧只接受这三个值）。 */
export const REPO_PERMISSIONS: RepoPermission[] = ['full', 'read', 'none']

/** 账号下的远程仓库（node 侧 /account/repos 返回的形状）。 */
export interface AccountRepoView {
  fullName: string
  name: string
  owner: string
  url: string
  private: boolean
  defaultBranch: string
  /** node 侧判定好的当前权限档位（唯一事实源），client 不再自己推导。 */
  permission?: RepoPermission
}

/** 授权范围设置。 */
export interface SettingsView {
  allowedRepos: string[]
  allowedRoots: string[]
  allowWrite: boolean
  requireConfirm: boolean
  defaultAccountId: string
  /** 账号 → 仓库（owner/repo）→ 权限档位。 */
  repoPermissions?: Record<string, Record<string, RepoPermission>>
}

/** /state 返回的面板状态。 */
export interface PanelState {
  accounts: AccountView[]
  settings: SettingsView
}

/** 平台信息（/state 返回的 providers）。 */
export interface ProviderView {
  id: string
  label: string
  host: string
  oauthHint: string
  patHint: string
  patUrl: string
}

export interface RepoGraphView {
  isRepo: boolean
  root: string
  branch: string
  head: string
  detached: boolean
  reason?: 'repo' | 'no-repo' | 'invalid'
  error: string
  truncated: boolean
  laneCount: number
  rows: GraphRowView[]
  authorized?: boolean
}

/** 全部样式（.dgp-* 体系）。index 与 workbench 共用一份，id 幂等注入。 */
export const CSS = `
/* 作用域：只影响插件自己的 DOM。颜色/圆角/动效一律取宿主主题 token，
   并带浅色主题真实取值作 fallback（宿主未注入时也不至于走样）。
   .dgp-portal 用于 portal 到 body 的浮层（脱离 .dgp-root 后变量必须自带）。 */
.dgp-root,.dgp-portal{
  --dgp-fg:var(--dsw-alias-label-primary,#0f1115);
  --dgp-fg2:var(--dsw-alias-label-secondary,#61666b);
  --dgp-muted:var(--dsw-alias-label-tertiary,#81858c);
  --dgp-faint:var(--dsw-alias-label-caption,#adb2b8);
  --dgp-line:var(--dsw-alias-border-l2,#0000001a);
  --dgp-line2:var(--dsw-alias-border-l3,#0000001f);
  --dgp-inset:var(--dsw-alias-bg-module-platform,#f5f6f7);
  --dgp-hover:var(--dsw-alias-interactive-bg-hover,#2631480f);
  --dgp-accent:var(--dsw-alias-state-business-primary,#4176e6);
  --dgp-danger:var(--dsw-alias-state-error-primary,#ec1313);
  --dgp-ok:var(--dsw-alias-state-success-primary,#22c55e);
  --dgp-warn:#b45309;
  --dgp-r-xs:var(--dsw-radius-xs,4px);
  --dgp-r-sm:var(--dsw-radius-sm,8px);
  --dgp-ease:var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1));
  --dgp-fast:var(--ds-transition-duration-fast,.1s);
  --dgp-code:var(--ds-font-family-code,"SF Mono","JetBrains Mono",Consolas,Menlo,monospace);
  color:var(--dgp-fg);font-family:inherit;font-size:14px;line-height:22px;-webkit-font-smoothing:antialiased;
}
.dgp-section{display:flex;flex-direction:column;padding:2px 0 8px;max-width:100%}
.dgp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:0 0 14px;border-bottom:.5px solid var(--dgp-line)}
.dgp-title{font-size:14px;font-weight:500;line-height:22px;color:var(--dgp-fg);display:flex;align-items:center;gap:7px}
.dgp-sub{font-size:12px;line-height:18px;color:var(--dgp-muted);margin-top:4px}
.dgp-tabs,.dgp-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:var(--dgp-r-sm);background:var(--dgp-inset);align-self:flex-start;max-width:100%;overflow:hidden}
.dgp-tab,.dgp-seg button{appearance:none;border:0;margin:0;background:transparent;color:var(--dgp-muted);height:26px;padding:0 12px;border-radius:calc(var(--dgp-r-sm) - 3px);font:inherit;font-size:12px;line-height:18px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background var(--dgp-fast) var(--dgp-ease),color var(--dgp-fast) var(--dgp-ease),box-shadow var(--dgp-fast) var(--dgp-ease)}
.dgp-tab:hover,.dgp-seg button:hover{color:var(--dgp-fg2)}
.dgp-tab[data-on="1"],.dgp-seg button[data-on="1"]{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dgp-fg);box-shadow:var(--dsw-shadow-lv1,0 2px 4px 0 #0000000d)}
.dgp-tab:focus-visible,.dgp-seg button:focus-visible{outline:2px solid var(--dgp-accent);outline-offset:-1px}
.dgp-group{display:flex;flex-direction:column}
.dgp-group-title{font-size:11px;line-height:16px;font-weight:500;letter-spacing:.02em;text-transform:uppercase;color:var(--dgp-faint);padding:18px 0 4px}
.dgp-row{display:flex;align-items:center;gap:8px;min-width:0}
.dgp-line{border-bottom:.5px solid var(--dgp-line);padding:13px 0;display:flex;align-items:center;justify-content:space-between;gap:24px}
.dgp-line:last-of-type{border-bottom:none}
.dgp-line-main{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.dgp-line-side{display:flex;align-items:center;gap:6px;flex:0 0 auto}
.dgp-line-sep{width:1px;height:16px;background:var(--dgp-line);margin:0 2px;flex:0 0 auto}
.dgp-repo[data-saving="1"]{opacity:.6}
.dgp-name{font-size:14px;line-height:22px;font-weight:500;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-meta{font-size:12px;line-height:18px;color:var(--dgp-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dgp-meta code,.dgp-mono{font-family:var(--dgp-code);font-size:11.5px}
.dgp-hint{font-size:12px;line-height:18px;color:var(--dgp-muted);margin-top:5px}
.dgp-err{font-size:12px;line-height:18px;color:var(--dgp-danger);margin-top:6px;word-break:break-word}
.dgp-ok{font-size:12px;line-height:18px;color:var(--dgp-ok);margin-top:6px}
.dgp-dot{width:6px;height:6px;border-radius:50%;background:var(--dgp-faint);flex:0 0 auto;box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-faint) 14%,transparent)}
.dgp-dot[data-state="connected"]{background:var(--dgp-ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-ok) 16%,transparent)}
.dgp-dot[data-state="expired"],.dgp-dot[data-state="error"]{background:var(--dgp-danger);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-danger) 16%,transparent)}
.dgp-badge{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:var(--dgp-r-xs);border:.5px solid var(--dgp-line2);font-size:11px;line-height:16px;font-weight:500;color:var(--dgp-muted);white-space:nowrap}
.dgp-badge[data-tone="mono"]{font-family:var(--dgp-code)}
.dgp-badge[data-state="connected"]{color:var(--dgp-ok);border-color:color-mix(in srgb,var(--dgp-ok) 40%,transparent);background:color-mix(in srgb,var(--dgp-ok) 10%,transparent)}
.dgp-badge[data-state="expired"],.dgp-badge[data-state="error"]{color:var(--dgp-danger);border-color:color-mix(in srgb,var(--dgp-danger) 40%,transparent);background:color-mix(in srgb,var(--dgp-danger) 9%,transparent)}
.dgp-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:28px;padding:0 11px;border-radius:var(--dgp-r-sm);border:.5px solid var(--dgp-line2);background:transparent;color:var(--dgp-fg2);font:inherit;font-size:12px;line-height:18px;font-weight:500;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background var(--dgp-fast) var(--dgp-ease),color var(--dgp-fast) var(--dgp-ease),border-color var(--dgp-fast) var(--dgp-ease)}
.dgp-btn:hover:not(:disabled){background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-btn:focus-visible{outline:2px solid var(--dgp-accent);outline-offset:1px}
.dgp-btn:disabled{opacity:.45;cursor:not-allowed}
.dgp-btn.primary{background:var(--dsw-alias-button-primary-fill,#0f1115);border-color:transparent;color:var(--dsw-alias-label-primary-inverted,#fff)}
.dgp-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#3c3c3d);color:var(--dsw-alias-label-primary-inverted,#fff)}
.dgp-btn.danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger,#ec13130d);border-color:color-mix(in srgb,var(--dgp-danger) 45%,transparent);color:var(--dgp-danger)}
.dgp-btn.ghost{border-color:transparent}
.dgp-field{display:flex;flex-direction:column;padding:13px 0;border-bottom:.5px solid var(--dgp-line)}
.dgp-field:last-of-type{border-bottom:none}
.dgp-label{font-size:12px;line-height:18px;font-weight:500;color:var(--dgp-fg2);margin-bottom:7px}
.dgp-input,.dgp-select,.dgp-area{width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dgp-fg);font:inherit;font-size:13px;line-height:20px;outline:none;transition:border-color var(--dgp-fast) var(--dgp-ease),box-shadow var(--dgp-fast) var(--dgp-ease)}
.dgp-input,.dgp-select{max-width:340px}
.dgp-select{appearance:none;padding-right:26px;background-image:linear-gradient(45deg,transparent 50%,var(--dgp-muted) 50%),linear-gradient(135deg,var(--dgp-muted) 50%,transparent 50%);background-position:calc(100% - 14px) 14px,calc(100% - 9px) 14px;background-size:5px 5px,5px 5px;background-repeat:no-repeat}
.dgp-area{height:auto;min-height:76px;padding:8px 10px;resize:vertical;font-family:var(--dgp-code);font-size:12px;line-height:20px}
.dgp-input::placeholder,.dgp-area::placeholder{color:var(--dgp-faint)}
.dgp-input:focus,.dgp-select:focus,.dgp-area:focus{border-color:var(--dgp-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-accent) 18%,transparent)}
.dgp-check{display:flex;align-items:flex-start;gap:10px;padding:13px 0;border-bottom:.5px solid var(--dgp-line);cursor:pointer}
.dgp-check:last-of-type{border-bottom:none}
.dgp-check input{appearance:none;flex:0 0 auto;width:16px;height:16px;margin:3px 0 0;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-xs);background:var(--dsw-alias-bg-layer-1,#fff);cursor:pointer;position:relative;transition:background var(--dgp-fast) var(--dgp-ease),border-color var(--dgp-fast) var(--dgp-ease)}
.dgp-check input:checked{background:var(--dgp-accent);border-color:var(--dgp-accent)}
.dgp-check input:checked::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;border:solid #fff;border-width:0 1.5px 1.5px 0;transform:rotate(42deg)}
.dgp-check input:focus-visible{outline:2px solid var(--dgp-accent);outline-offset:1px}
.dgp-check-body{display:flex;flex-direction:column;gap:3px;min-width:0}
.dgp-check-title{font-size:13px;line-height:20px;font-weight:500;color:var(--dgp-fg)}
.dgp-card{background:var(--dgp-inset);border-radius:var(--dgp-r-sm);padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.dgp-kv{display:grid;grid-template-columns:88px minmax(0,1fr);gap:6px 12px;font-size:12px;line-height:18px;margin:0}
.dgp-kv dt{color:var(--dgp-muted);margin:0}
.dgp-kv dd{color:var(--dgp-fg2);margin:0;overflow-wrap:anywhere}
.dgp-code{font-family:var(--dgp-code);font-size:20px;line-height:28px;font-weight:600;letter-spacing:.14em;color:var(--dgp-fg);font-variant-numeric:tabular-nums}
.dgp-link{color:var(--dsw-alias-link,var(--dgp-accent));text-decoration:none;border-bottom:.5px solid color-mix(in srgb,currentColor 40%,transparent)}
.dgp-link:hover{border-bottom-color:currentColor}
.dgp-sep{height:.5px;background:var(--dgp-line);margin:2px 0}
.dgp-chip{display:inline-flex;align-items:center;gap:5px;height:22px;max-width:240px;padding:0 6px;margin:0;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-muted);cursor:pointer;font-family:var(--dgp-code);font-size:11px;line-height:16px;white-space:nowrap;overflow:hidden;transition:background var(--dgp-fast) var(--dgp-ease),color var(--dgp-fast) var(--dgp-ease)}
.dgp-chip:hover{background:var(--dgp-hover);color:var(--dgp-fg2)}
.dgp-chip:active{background:var(--dsw-alias-interactive-bg-active,#2631481a)}
.dgp-chip:focus-visible{outline:2px solid var(--dgp-accent);outline-offset:1px}
.dgp-chip svg{flex:0 0 auto;opacity:.7;transition:opacity var(--dgp-fast) var(--dgp-ease)}
.dgp-chip:hover svg{opacity:1}
.dgp-chip-name{overflow:hidden;text-overflow:ellipsis;max-width:150px}
.dgp-chip-aux{color:var(--dgp-faint);font-variant-numeric:tabular-nums}
.dgp-chip[data-warn="1"]{color:var(--dgp-danger)}
.dgp-chip[data-warn="1"] svg{opacity:1}
.dgp-chip[data-norepo="1"]{color:var(--dgp-faint)}
.dgp-chip[data-open="1"]{background:var(--dgp-hover);color:var(--dgp-fg2)}
.dgp-chip-wrap{position:relative;display:inline-flex;align-items:center;gap:4px}
.dgp-menu{display:flex;flex-direction:column;position:fixed;z-index:1200;min-width:236px;max-width:320px;max-height:min(340px,60vh);overflow-y:auto;padding:4px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-md);background:var(--dsw-alias-bg-layer-1,var(--dgp-bg,#fff));box-shadow:var(--dsw-elevation-prominent,0 8px 28px #00000026);font-family:var(--dsw-font-family,inherit);font-size:12px;line-height:18px;color:var(--dgp-fg2);box-sizing:border-box}
.dgp-menu-head{padding:7px 9px 6px;display:flex;align-items:center;gap:6px;color:var(--dgp-faint);font-size:11px;line-height:16px;letter-spacing:.02em;text-transform:uppercase}
.dgp-menu-sum{padding:0 9px 7px;color:var(--dgp-muted);font-size:11px;line-height:16px;font-family:var(--dgp-code);word-break:break-all}
.dgp-menu[data-graph="1"]{width:min(440px,calc(100vw - 16px));min-width:0;max-width:min(440px,calc(100vw - 16px));max-height:min(520px,72vh)}
.dgp-menu-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;border:0;border-radius:var(--dgp-r-sm);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background var(--dgp-fast) var(--dgp-ease)}
.dgp-menu-item:hover:not(:disabled){background:var(--dgp-hover)}
.dgp-menu-item:disabled{opacity:.55;cursor:default}
.dgp-menu-item svg{flex:0 0 auto;opacity:.75}
.dgp-menu-item-main{display:flex;flex-direction:column;min-width:0;gap:1px}
.dgp-menu-item-title{color:var(--dgp-fg);font-size:12px;line-height:17px}
.dgp-menu-item-hint{color:var(--dgp-faint);font-size:11px;line-height:15px}
.dgp-menu-item[data-primary="1"] .dgp-menu-item-title{font-weight:500}
.dgp-menu-item[data-primary="1"] svg{color:var(--dgp-accent);opacity:1}
.dgp-menu-note{padding:7px 9px;color:var(--dgp-muted);font-size:11px;line-height:16px}
.dgp-menu-note[data-tone="error"]{color:var(--dgp-danger)}
.dgp-menu-note[data-tone="ok"]{color:var(--dsw-alias-state-success-primary,#22c55e)}
.dgp-menu-sep{height:.5px;background:var(--dgp-line);margin:3px 6px}
/* 菜单分组标题：把「仓库动作」与「打开/设置」分开，避免一堆同级项平铺。 */
.dgp-menu-group{padding:6px 9px 3px;color:var(--dgp-faint);font-size:10.5px;line-height:15px;letter-spacing:.03em;text-transform:uppercase}
.dgp-root,.dgp-portal{
  --dgp-lane-0:#4176e6;--dgp-lane-1:#1f9d63;--dgp-lane-2:#c98a06;--dgp-lane-3:#8b5cf6;
  --dgp-lane-4:#0ea5e9;--dgp-lane-5:#e0526a;--dgp-lane-6:#e2762e;--dgp-lane-7:#64748b;
}
body[data-ds-dark-theme] .dgp-root,body[data-ds-dark-theme] .dgp-portal{
  --dgp-lane-0:#7aaaff;--dgp-lane-1:#4ecf9a;--dgp-lane-2:#e9b949;--dgp-lane-3:#b18cff;
  --dgp-lane-4:#56c8f5;--dgp-lane-5:#f57e94;--dgp-lane-6:#f59a63;--dgp-lane-7:#94a3b8;
  --dgp-warn:#e9b949;
}
.dgp-graph{display:flex;flex-direction:column;min-width:0}
.dgp-graph-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px 5px;color:var(--dgp-faint);font-size:11px;line-height:16px;letter-spacing:.02em;text-transform:uppercase}
.dgp-graph-meta{text-transform:none;letter-spacing:0;font-variant-numeric:tabular-nums;color:var(--dgp-faint)}
.dgp-graph-body{display:flex;align-items:flex-start;max-height:min(320px,46vh);overflow:auto;overscroll-behavior:contain;padding:2px 4px 4px}
.dgp-graph-row{display:flex;align-items:center;gap:8px;height:34px;padding:0 5px;border-radius:var(--dgp-r-xs);cursor:default;min-width:0;transition:background var(--dgp-fast) var(--dgp-ease)}
.dgp-graph-row:hover{background:var(--dgp-hover)}
.dgp-graph-row[data-active="1"]{background:var(--dgp-hover)}
.dgp-graph-row[data-current="1"] .dgp-graph-subject{color:var(--dgp-fg)}
.dgp-graph-svg{flex:0 0 auto;display:block;overflow:visible}
.dgp-graph-dot{stroke:var(--dsw-alias-bg-layer-1,var(--dgp-bg,#fff));stroke-width:1.5;transition:r var(--dgp-fast) var(--dgp-ease)}
.dgp-graph-line{fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
.dgp-graph-main{display:flex;flex-direction:column;min-width:0;gap:0;flex:1 1 auto}
.dgp-graph-subject{color:var(--dgp-fg2);font-size:12px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dgp-graph-sub{display:flex;align-items:center;gap:6px;min-width:0;color:var(--dgp-faint);font-size:10px;line-height:13px;font-family:var(--dgp-code);white-space:nowrap;overflow:hidden}
.dgp-graph-hash{flex:0 0 auto;opacity:.85}
.dgp-graph-author{overflow:hidden;text-overflow:ellipsis;min-width:0}
.dgp-graph-refs{display:flex;align-items:center;gap:4px;flex:0 0 auto}
.dgp-graph-ref{display:inline-flex;align-items:center;height:15px;padding:0 5px;border-radius:var(--dgp-r-xs);border:.5px solid var(--dgp-line2);background:transparent;color:var(--dgp-muted);font-family:var(--dgp-code);font-size:10px;line-height:15px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-graph-ref[data-kind="head"]{border-color:transparent;background:var(--dgp-accent);color:#fff;font-weight:500}
.dgp-graph-ref[data-kind="tag"]{border-color:var(--dgp-line2);color:var(--dgp-warn,#b45309)}
.dgp-graph-ref[data-kind="remote"]{color:var(--dgp-faint)}
.dgp-graph-note{padding:6px 9px 8px;color:var(--dgp-faint);font-size:11px;line-height:16px}
.dgp-graph-note[data-tone="error"]{color:var(--dgp-danger)}
.dgp-graph-detail{display:flex;align-items:center;gap:6px;padding:6px 9px 2px;border-top:.5px solid var(--dgp-line);margin-top:2px;color:var(--dgp-muted);font-size:11px;line-height:16px;min-width:0}
.dgp-graph-detail-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--dgp-code)}
.dgp-graph-copy{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-faint);cursor:pointer}
.dgp-graph-copy:hover{background:var(--dgp-hover);color:var(--dgp-fg2)}
/* 概览带：一行摘要，取代四格统计卡（信息密度高、不抢视觉重心）。 */
.dgp-overview{display:flex;align-items:center;flex-wrap:wrap;gap:0;margin:12px 0 14px;padding:7px 2px;border-top:.5px solid var(--dgp-line);border-bottom:.5px solid var(--dgp-line)}
.dgp-overview-item{display:inline-flex;align-items:baseline;gap:5px;padding:0 11px;min-width:0;white-space:nowrap}
.dgp-overview-item:first-child{padding-left:0}
.dgp-overview-label{font-size:11px;line-height:16px;color:var(--dgp-faint);letter-spacing:.02em}
.dgp-overview-num{font-family:var(--dgp-code);font-size:13px;line-height:18px;font-weight:600;color:var(--dgp-fg2);font-variant-numeric:tabular-nums}
.dgp-overview-hint{font-size:11px;line-height:16px;color:var(--dgp-warn,#b45309)}
.dgp-overview-item[data-tone="ok"] .dgp-overview-num{color:var(--dgp-ok)}
.dgp-overview-item[data-tone="warn"] .dgp-overview-num{color:var(--dgp-warn,#b45309)}
.dgp-overview-sep{width:1px;height:12px;background:var(--dgp-line);flex:0 0 auto}
.dgp-overview-gap,.dgp-acct-gap{flex:1 1 auto;min-width:8px}
.dgp-callout{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;padding:8px 10px 8px 12px;border:.5px solid var(--dgp-line2);border-left:2px solid var(--dgp-accent);border-radius:var(--dgp-r-xs);background:var(--dgp-inset);color:var(--dgp-fg2);font-size:12px;line-height:18px}
.dgp-callout-text{min-width:0;overflow:hidden;text-overflow:ellipsis}
.dgp-empty{display:flex;flex-direction:column;align-items:center;gap:7px;padding:26px 16px 24px;text-align:center;color:var(--dgp-muted)}
.dgp-empty-art{color:var(--dgp-faint);opacity:.85}
.dgp-empty-title{font-size:13px;line-height:19px;font-weight:500;color:var(--dgp-fg2)}
.dgp-empty-hint{font-size:12px;line-height:18px;color:var(--dgp-muted);max-width:44ch}
.dgp-skel{display:flex;flex-direction:column;gap:7px;padding:9px 0}
.dgp-skel-line{height:11px;border-radius:var(--dgp-r-xs);background:linear-gradient(90deg,var(--dgp-inset) 0%,var(--dgp-hover) 42%,var(--dgp-inset) 84%);background-size:220% 100%;animation:dgp-shimmer 1.25s linear infinite}
@keyframes dgp-shimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}
@media (prefers-reduced-motion:reduce){.dgp-skel-line{animation:none;background:var(--dgp-inset)}}
.dgp-changes{display:flex;flex-direction:column;min-width:0}
.dgp-changes-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:5px 9px 6px;color:var(--dgp-faint);font-size:11px;line-height:16px;letter-spacing:.02em;text-transform:uppercase}
.dgp-changes-count{text-transform:none;letter-spacing:0;font-variant-numeric:tabular-nums;color:var(--dgp-faint)}
.dgp-change{display:flex;align-items:center;gap:7px;padding:4px 9px;min-width:0;border-radius:var(--dgp-r-xs);transition:background var(--dgp-fast) var(--dgp-ease)}
.dgp-change:hover{background:var(--dgp-hover)}
.dgp-change-code{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:16px;padding:0 4px;border-radius:3px;background:var(--dgp-inset);color:var(--dgp-muted);font-family:var(--dgp-code);font-size:10px;line-height:16px;font-weight:600}
.dgp-change-code[data-code="A"]{color:var(--dgp-ok);background:color-mix(in srgb,var(--dgp-ok) 12%,transparent)}
.dgp-change-code[data-code="D"]{color:var(--dgp-danger);background:color-mix(in srgb,var(--dgp-danger) 11%,transparent)}
.dgp-change-code[data-code="R"],.dgp-change-code[data-code="C"]{color:var(--dgp-lane-3);background:color-mix(in srgb,var(--dgp-lane-3) 12%,transparent)}
.dgp-change-code[data-code="??"]{color:var(--dgp-warn,#b45309);background:color-mix(in srgb,var(--dgp-warn,#b45309) 12%,transparent)}
.dgp-change-path{flex:1 1 auto;min-width:0;color:var(--dgp-fg2);font-family:var(--dgp-code);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}
.dgp-change[data-staged="1"] .dgp-change-path{color:var(--dgp-fg)}
.dgp-change-stat{flex:0 0 auto;font-family:var(--dgp-code);font-size:10.5px;line-height:15px;font-variant-numeric:tabular-nums}
.dgp-change-stat[data-sign="add"]{color:var(--dgp-ok)}
.dgp-change-stat[data-sign="del"]{color:var(--dgp-danger)}
.dgp-change-stat[data-sign="staged"]{color:var(--dgp-accent)}
.dgp-changes-note{padding:6px 9px 8px;color:var(--dgp-faint);font-size:11px;line-height:16px}
.dgp-changes-note[data-tone="error"]{color:var(--dgp-danger)}
.dgp-toast-wrap{position:fixed;right:18px;bottom:18px;z-index:1300;pointer-events:none}
.dgp-toast{display:flex;align-items:center;gap:8px;max-width:340px;padding:9px 13px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:var(--dsw-elevation-prominent,0 8px 28px #00000026);color:var(--dgp-fg);font-size:12px;line-height:18px;animation:dgp-toast-in .18s var(--dgp-ease) both}
.dgp-toast-dot{flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:var(--dgp-faint)}
.dgp-toast[data-tone="ok"] .dgp-toast-dot{background:var(--dgp-ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-ok) 16%,transparent)}
.dgp-toast[data-tone="error"] .dgp-toast-dot{background:var(--dgp-danger);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-danger) 16%,transparent)}
.dgp-toast[data-tone="info"] .dgp-toast-dot{background:var(--dgp-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-accent) 16%,transparent)}
.dgp-toast-text{min-width:0;overflow:hidden;text-overflow:ellipsis}
@keyframes dgp-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.dgp-toast{animation:none}}

/* ------------------------------------------------------------------ */
/* Git 工作台（dgp-v17：贴右全高抽屉）                                  */
/* ------------------------------------------------------------------ */
.dgp-gw-mask{position:fixed;inset:0;z-index:1140;background:color-mix(in srgb,#000 26%,transparent)}
.dgp-gw{position:fixed;z-index:1150;top:0;right:0;bottom:0;width:min(1080px,calc(100vw - 80px));display:flex;flex-direction:column;border-left:.5px solid var(--dgp-line2);background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:-18px 0 56px #00000030;overflow:hidden;font-size:12px;line-height:18px;animation:dgp-gw-in .2s var(--dgp-ease) both}
@keyframes dgp-gw-in{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.dgp-gw{animation:none}}
.dgp-gw-top{display:flex;align-items:center;gap:6px;padding:9px 12px;border-bottom:.5px solid var(--dgp-line);flex:0 0 auto;flex-wrap:wrap}
.dgp-gw-crumb{font-weight:500;color:var(--dgp-fg)}
.dgp-gw-repo{display:inline-flex;align-items:center;gap:5px;font-weight:500;color:var(--dgp-fg);min-width:0;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-gw-branch{appearance:none;display:inline-flex;align-items:center;gap:4px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-fg2);height:24px;padding:0 8px;font:inherit;font-size:11.5px;font-family:var(--dgp-code);cursor:pointer;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-gw-branch:hover{background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-gw-branch[data-current="1"]{color:var(--dgp-fg);border-color:color-mix(in srgb,var(--dgp-accent) 40%,var(--dgp-line2))}
.dgp-gw-caret{color:var(--dgp-faint);font-size:9px}
.dgp-gw-aux{font-family:var(--dgp-code);font-size:11px;color:var(--dgp-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.dgp-gw-spacer{flex:1 1 auto}
.dgp-gw-btnbar{display:inline-flex;align-items:center;gap:4px;flex:0 0 auto}
.dgp-gw .dgp-btn{height:24px;padding:0 9px;font-size:11px}
.dgp-gw .dgp-btn.primary{height:24px}
.dgp-gw-icon{appearance:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-faint);cursor:pointer}
.dgp-gw-icon:hover:not(:disabled){background:var(--dgp-hover);color:var(--dgp-fg2)}
.dgp-gw-icon:disabled{opacity:.45;cursor:not-allowed}
.dgp-gw-x{appearance:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-faint);cursor:pointer;font-size:15px;line-height:1}
.dgp-gw-x:hover{background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-gw-state{flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:34px 20px;overflow-y:auto}
.dgp-gw-initform{display:flex;flex-direction:column;gap:10px;align-items:stretch;width:min(420px,100%)}
.dgp-gw-initform .dgp-input{max-width:none;width:100%}
/* 主体：左侧竖排导航 + 主区（一次只呈现一件事） */
.dgp-gw-body{display:flex;flex:1 1 auto;min-height:0}
.dgp-gw-rail{flex:0 0 132px;display:flex;flex-direction:column;gap:1px;padding:8px 6px;border-right:.5px solid var(--dgp-line);background:var(--dgp-inset);min-height:0;overflow-y:auto}
.dgp-gw-railbtn{appearance:none;display:flex;align-items:center;gap:6px;width:100%;padding:7px 9px;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-fg2);font:inherit;font-size:12px;line-height:18px;text-align:left;cursor:pointer;transition:background var(--dgp-fast) var(--dgp-ease),color var(--dgp-fast) var(--dgp-ease)}
.dgp-gw-railbtn:hover{background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-gw-railbtn[data-on="1"]{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dgp-fg);font-weight:500;box-shadow:0 0 0 .5px var(--dgp-line2)}
.dgp-gw-railbtn-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-gw-railbtn-count{flex:0 0 auto;font-family:var(--dgp-code);font-size:10.5px;color:var(--dgp-faint);font-variant-numeric:tabular-nums}
.dgp-gw-main{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;min-height:0}
/* 改动视图：提交区在上，列表在下 */
.dgp-gw-commit{display:flex;flex-direction:column;gap:6px;padding:10px 12px 9px;border-bottom:.5px solid var(--dgp-line);flex:0 0 auto}
.dgp-gw-msg{box-sizing:border-box;width:100%;min-height:56px;max-height:140px;padding:7px 10px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dgp-fg);font:inherit;font-size:12px;line-height:18px;resize:vertical;outline:none}
.dgp-gw-msg:focus{border-color:var(--dgp-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-accent) 18%,transparent)}
.dgp-gw-commitbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dgp-gw-amend{display:inline-flex;align-items:center;gap:5px;color:var(--dgp-muted);font-size:11px;white-space:nowrap;cursor:pointer}
.dgp-gw-amend input{accent-color:var(--dgp-accent)}
.dgp-gw-staged-count{font-family:var(--dgp-code);font-size:11px;color:var(--dgp-faint);font-variant-numeric:tabular-nums;min-width:12px;text-align:right}
.dgp-gw-lists{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;min-height:0;padding:2px 0 10px}
.dgp-gw-group{display:flex;flex-direction:column;align-items:stretch}
.dgp-gw-grouphead{display:flex;align-items:center;gap:7px;padding:7px 12px 3px;font-size:11px;font-weight:500;letter-spacing:.02em;text-transform:uppercase;color:var(--dgp-faint)}
.dgp-gw-checkall{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.dgp-gw-checkall input{accent-color:var(--dgp-accent);margin:0}
.dgp-gw-count{font-family:var(--dgp-code);font-variant-numeric:tabular-nums}
.dgp-gw-textbtn{appearance:none;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-faint);font:inherit;font-size:10.5px;padding:2px 6px;cursor:pointer}
.dgp-gw-textbtn:hover:not(:disabled){background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-gw-textbtn:disabled{opacity:.45;cursor:not-allowed}
.dgp-gw-textbtn[data-danger="1"]:hover{color:var(--dgp-danger)}
.dgp-gw-row{display:flex;align-items:center;gap:7px;padding:3px 12px;min-width:0}
.dgp-gw-row:hover{background:var(--dgp-hover)}
.dgp-gw-row input{accent-color:var(--dgp-accent);flex:0 0 auto;margin:0}
.dgp-gw-code{flex:0 0 auto;appearance:none;display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:16px;padding:0 4px;border:0;border-radius:3px;background:var(--dgp-inset);color:var(--dgp-muted);font-family:var(--dgp-code);font-size:10px;font-weight:600;cursor:pointer}
.dgp-gw-code[data-code="A"]{color:var(--dgp-ok);background:color-mix(in srgb,var(--dgp-ok) 12%,transparent)}
.dgp-gw-code[data-code="D"]{color:var(--dgp-danger);background:color-mix(in srgb,var(--dgp-danger) 11%,transparent)}
.dgp-gw-code[data-code="??"]{color:var(--dgp-warn,#b45309);background:color-mix(in srgb,var(--dgp-warn,#b45309) 12%,transparent)}
.dgp-gw-path{flex:1 1 auto;min-width:0;appearance:none;border:0;background:transparent;color:var(--dgp-fg2);font-family:var(--dgp-code);font-size:11px;line-height:16px;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0}
.dgp-gw-row[data-staged="1"] .dgp-gw-path{color:var(--dgp-fg)}
.dgp-gw-path:hover{color:var(--dgp-fg);text-decoration:underline}
.dgp-gw-stat{flex:0 0 auto;display:inline-flex;gap:5px;font-family:var(--dgp-code);font-size:10.5px;font-variant-numeric:tabular-nums}
.dgp-gw-stat b{font-weight:600}
.dgp-gw-stat b[data-sign="add"]{color:var(--dgp-ok)}
.dgp-gw-stat b[data-sign="del"]{color:var(--dgp-danger)}
.dgp-gw-rowact{flex:0 0 auto;appearance:none;border:0;border-radius:var(--dgp-r-xs);background:transparent;color:var(--dgp-faint);font:inherit;font-size:10.5px;padding:2px 6px;cursor:pointer;opacity:0;transition:opacity var(--dgp-fast) var(--dgp-ease)}
.dgp-gw-row:hover .dgp-gw-rowact{opacity:1}
.dgp-gw-rowact:hover{background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-gw-rowact[data-danger="1"]:hover{color:var(--dgp-danger)}
.dgp-gw-batch{display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:.5px solid var(--dgp-line);flex:0 0 auto;flex-wrap:wrap}
.dgp-gw-batch-count{font-family:var(--dgp-code);font-size:11px;color:var(--dgp-muted);font-variant-numeric:tabular-nums}
/* 历史 / 分支图视图 */
.dgp-gw-scroll{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;min-height:0}
.dgp-gw-log{display:flex;flex-direction:column;padding:4px 0 10px}
.dgp-gw-logrow{display:flex;align-items:center;gap:7px;width:100%;padding:5px 12px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;min-width:0}
.dgp-gw-logrow:hover{background:var(--dgp-hover)}
.dgp-gw-loghash{flex:0 0 auto;font-family:var(--dgp-code);font-size:10.5px;color:var(--dgp-accent)}
.dgp-gw-logmsg{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dgp-fg2)}
.dgp-gw-logmeta{flex:0 0 auto;color:var(--dgp-faint);font-family:var(--dgp-code);font-size:10px;font-variant-numeric:tabular-nums;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-gw-diff{margin:0;padding:2px 0;font-family:var(--dgp-code);font-size:10.5px;line-height:15px;color:var(--dgp-fg2);white-space:pre;overflow:auto;max-height:min(420px,50vh)}
.dgp-gw-detail .dgp-kv{margin:0 0 8px}
.dgp-gw-msgtext{margin:0 0 8px;padding:8px 10px;background:var(--dgp-inset);border-radius:var(--dgp-r-sm);font:inherit;font-size:12px;white-space:pre-wrap;color:var(--dgp-fg2)}
.dgp-gw-secttitle{padding:8px 0 4px;color:var(--dgp-faint);font-size:11px;letter-spacing:.02em;text-transform:uppercase}
/* 分支 / 远程管理（二级弹窗内） */
.dgp-gw-branchcols{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}
.dgp-gw-branchrow{display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:.5px solid var(--dgp-line);min-width:0}
.dgp-gw-branchrow[data-current="1"] .dgp-gw-branchname{color:var(--dgp-accent);font-weight:500}
.dgp-gw-branchname{font-family:var(--dgp-code);font-size:11.5px;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1 1 auto}
.dgp-gw-branchmeta{font-family:var(--dgp-code);font-size:10px;color:var(--dgp-muted);white-space:nowrap}
.dgp-gw-remoteurl{font-size:10.5px;color:var(--dgp-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1 1 auto}
/* ------------------------------------------------------------------ */
/* 账号 → 远程仓库权限（多账号管理）                                    */
/* ------------------------------------------------------------------ */
.dgp-repos{display:flex;flex-direction:column;gap:2px;padding:6px 0 2px 10px;border-left:1.5px solid var(--dgp-line);margin-top:2px}
.dgp-repo{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:.5px solid var(--dgp-line);min-width:0}
.dgp-repo:last-child{border-bottom:none}
.dgp-repo-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}
.dgp-repo-name{font-family:var(--dgp-code);font-size:12px;line-height:18px;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-repo-meta{font-size:11px;line-height:16px;color:var(--dgp-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dgp-perm{flex:0 0 auto;display:flex;align-items:center;gap:6px}
/* 三档权限：分段控件（一眼看全三档，点一下就改，取代原来的下拉框）。 */
.dgp-perm-seg{flex:0 0 auto;display:inline-flex;align-items:center;gap:1px;padding:1px;border-radius:var(--dgp-r-xs);background:var(--dgp-inset)}
.dgp-perm-seg button{appearance:none;border:0;background:transparent;color:var(--dgp-muted);font:inherit;font-size:11px;line-height:16px;padding:2px 8px;border-radius:calc(var(--dgp-r-xs) - 1px);cursor:pointer;white-space:nowrap;transition:background var(--dgp-fast) var(--dgp-ease),color var(--dgp-fast) var(--dgp-ease)}
.dgp-perm-seg button:hover{background:var(--dgp-hover);color:var(--dgp-fg2)}
.dgp-perm-seg button[data-on="1"]{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dgp-fg);font-weight:500;box-shadow:0 0 0 .5px var(--dgp-line2)}
.dgp-perm-seg button[data-perm="full"][data-on="1"]{color:var(--dgp-ok)}
.dgp-perm-seg button[data-perm="none"][data-on="1"]{color:var(--dgp-danger)}
.dgp-perm-seg button:disabled{cursor:default;opacity:.55}
.dgp-perm-seg[data-saving="1"] button{cursor:progress}
.dgp-perm-saving{font-size:10.5px;line-height:16px;color:var(--dgp-faint);white-space:nowrap}
/* 仓库工具行：搜索 + 权限筛选 + 计数 + 刷新。 */
.dgp-repos-toolbar{display:flex;align-items:center;gap:8px;padding:8px 0 6px;flex-wrap:wrap}
.dgp-search{flex:1 1 150px;min-width:110px;height:26px;font-size:12px;padding:0 8px}
.dgp-filter{flex:0 0 auto}
.dgp-filter button{font-size:11px;padding:2px 7px}
.dgp-repos-count{font-size:11px;line-height:16px;color:var(--dgp-faint);font-variant-numeric:tabular-nums;white-space:nowrap}
/* 账号卡：一个账号一张，仓库权限直接内联，操作收在头部右侧。 */
.dgp-acct{display:flex;flex-direction:column;gap:0;margin:0 0 12px;padding:10px 12px 12px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dsw-alias-bg-layer-1,#fff)}
.dgp-acct[data-status="error"],.dgp-acct[data-status="expired"]{border-color:color-mix(in srgb,var(--dgp-warn,#b45309) 45%,var(--dgp-line2))}
.dgp-acct-head{display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap}
.dgp-acct-name{font-size:13px;line-height:19px;font-weight:600;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:min(260px,45vw)}
.dgp-acct-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:3px 0 0;font-size:11px;line-height:16px;color:var(--dgp-muted);min-width:0}
.dgp-acct .dgp-repos{margin-top:8px;padding-left:0;border-left:0}
/* 高级设置折叠区：本地目录白名单 + 全局兜底仓库 + 写开关。 */
.dgp-adv{margin:2px 0 12px;padding:11px 12px 12px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dgp-inset)}
/* ------------------------------------------------------------------ */
/* 初始化向导（单页表单 + 右侧实时计划）                                */
/* ------------------------------------------------------------------ */
.dgp-iw{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.78fr);gap:16px;min-width:0;align-items:start}
.dgp-iw-left{display:flex;flex-direction:column;gap:14px;min-width:0}
.dgp-iw-right{display:flex;flex-direction:column;gap:10px;min-width:0;padding:11px 12px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dgp-inset);position:sticky;top:0}
.dgp-iw-sect{display:flex;flex-direction:column;gap:7px;min-width:0}
.dgp-iw-secthead{font-size:11px;line-height:16px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--dgp-muted)}
.dgp-iw-secthead[data-tone="ok"]{color:var(--dgp-ok)}
.dgp-iw-secthead[data-tone="error"]{color:var(--dgp-danger)}
.dgp-iw-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 12px}
.dgp-iw-inline{display:flex;flex-direction:column;gap:6px;margin-top:2px}
.dgp-options{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none}
.dgp-option{display:flex;align-items:center;gap:9px;padding:7px 9px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);cursor:pointer;min-width:0;transition:background var(--dgp-fast) var(--dgp-ease),border-color var(--dgp-fast) var(--dgp-ease)}
.dgp-option:hover{background:var(--dgp-hover)}
.dgp-option[data-on="1"]{border-color:var(--dgp-accent);background:color-mix(in srgb,var(--dgp-accent) 9%,transparent)}
.dgp-option input{flex:0 0 auto;accent-color:var(--dgp-accent);margin:0}
.dgp-option-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 auto}
.dgp-option-title{font-size:12.5px;line-height:18px;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-option-hint{font-size:11px;line-height:16px;color:var(--dgp-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-plan{display:flex;flex-direction:column;gap:5px;margin:0;padding:0;list-style:none}
.dgp-plan li{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:18px;color:var(--dgp-fg2);overflow-wrap:anywhere}
.dgp-plan li::before{content:"";flex:0 0 auto;width:5px;height:5px;margin-top:6px;border-radius:50%;background:var(--dgp-accent)}
.dgp-plan[data-tone="error"] li::before{background:var(--dgp-danger)}
/* ------------------------------------------------------------------ */
/* 当前分支详情（提交时间线）                                          */
/* ------------------------------------------------------------------ */
.dgp-tl{display:flex;flex-direction:column;margin:0;padding:0 0 0 4px;list-style:none}
.dgp-tl-item{position:relative;display:flex;align-items:flex-start;gap:11px;padding:0 0 12px 14px;border-left:.5px solid var(--dgp-line2);min-width:0}
.dgp-tl-item:last-child{border-left-color:transparent;padding-bottom:0}
.dgp-tl-node{position:absolute;left:-3.5px;top:4px;width:6px;height:6px;border-radius:50%;background:var(--dgp-line2)}
.dgp-tl-item[data-first="1"] .dgp-tl-node{background:var(--dgp-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-accent) 18%,transparent)}
.dgp-tl-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}
.dgp-tl-subject{font-size:12.5px;line-height:18px;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-tl-meta{display:flex;align-items:center;gap:8px;font-size:11px;line-height:16px;color:var(--dgp-muted);flex-wrap:wrap;min-width:0}
.dgp-tl-hash{font-family:var(--dgp-code);color:var(--dgp-accent);flex:0 0 auto}
.dgp-tl-author{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px}
.dgp-tl-date{font-family:var(--dgp-code);font-variant-numeric:tabular-nums;color:var(--dgp-faint);flex:0 0 auto}
.dgp-modal-mask{position:fixed;inset:0;z-index:1250;background:color-mix(in srgb,#000 32%,transparent);display:flex;align-items:center;justify-content:center}
.dgp-modal{max-height:min(560px,80vh);display:flex;flex-direction:column;border-radius:var(--dgp-r-lg,12px);border:.5px solid var(--dgp-line2);background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 18px 56px #00000040;overflow:hidden}
.dgp-modal-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:.5px solid var(--dgp-line);flex:0 0 auto}
.dgp-modal-title{font-weight:500;color:var(--dgp-fg);font-size:13px}
.dgp-modal-x{appearance:none;border:0;background:transparent;color:var(--dgp-faint);width:24px;height:24px;border-radius:var(--dgp-r-xs);cursor:pointer;font-size:15px;line-height:1}
.dgp-modal-x:hover{background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-modal-body{padding:10px 14px 14px;overflow-y:auto;min-height:0}
.dgp-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:10px 14px;border-top:.5px solid var(--dgp-line);flex:0 0 auto}
.dgp-modal-text{margin:0 0 8px;color:var(--dgp-fg2);font-size:12px;line-height:18px}
.dgp-modal-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;font-family:var(--dgp-code);font-size:11px;color:var(--dgp-fg2)}
.dgp-modal-list li{display:flex;align-items:center;gap:8px;justify-content:space-between;word-break:break-all}
.dgp-modal-foot .dgp-btn{min-width:78px}
`

/** 幂等注入样式（同 id 只更新内容）。 */
export function useStyles(): void {
  useEffect(() => {
    const id = 'dgp-style'
    const existing = document.getElementById(id)
    if (existing) {
      if (existing.textContent !== CSS) existing.textContent = CSS
      return
    }
    const node = document.createElement('style')
    node.id = id
    node.textContent = CSS
    document.head.appendChild(node)
  }, [])
}

// ---- 通用小组件 ----

export function Dot({ state }: { state?: string }) {
  return <span className="dgp-dot" data-state={state ?? 'none'} aria-hidden="true" />
}

export function BranchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="4.8" cy="3.6" r="1.5" />
      <circle cx="4.8" cy="12.4" r="1.5" />
      <circle cx="11.2" cy="6.2" r="1.5" />
      <path d="M4.8 5.1v5.8" />
      <path d="M11.2 7.7v.5a2.5 2.5 0 0 1-2.5 2.5H6.3" />
    </svg>
  )
}

export function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13 2.8V5.6h-2.8" />
    </svg>
  )
}

export function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="6" width="7" height="7" rx="1.5" />
      <path d="M10 4.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v4.5A1.5 1.5 0 0 0 4 10h.5" />
    </svg>
  )
}

export function GearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.8v1.4M8 12.8v1.4M2.6 8H1.2M14.8 8h-1.4M4.2 4.2 3.2 3.2M12.8 12.8l-1-1M11.8 4.2l1-1M3.2 12.8l1-1" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}

/** 空状态：几何插画 + 标题 + 说明。 */
export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="dgp-empty">
      <svg className="dgp-empty-art" width="88" height="60" viewBox="0 0 88 60" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="6" y="8" width="34" height="44" rx="6" />
        <path d="M15 22h16M15 30h16M15 38h10" />
        <path d="M52 30h14M59 23v14" />
        <circle cx="66" cy="30" r="13" strokeDasharray="3 4" />
      </svg>
      <div className="dgp-empty-title">{title}</div>
      <div className="dgp-empty-hint">{hint}</div>
    </div>
  )
}

/** 骨架屏。 */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  const widths = ['62%', '44%', '78%', '55%', '70%']
  return (
    <div className="dgp-skel" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div className="dgp-skel-line" key={index} style={{ width: widths[index % widths.length] }} />
      ))}
    </div>
  )
}

/** 轻提示 toast。 */
export function Toast({ tone, text, onDone }: { tone: 'ok' | 'error' | 'info'; text: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2600)
    return () => window.clearTimeout(timer)
  }, [onDone])
  return createPortal(
    <div className="dgp-portal dgp-toast-wrap">
      <div className="dgp-toast" data-tone={tone} role="status" aria-live="polite">
        <span className="dgp-toast-dot" aria-hidden="true" />
        <span className="dgp-toast-text">{text}</span>
      </div>
    </div>,
    document.body,
  )
}

/** 文案插值：把 {n} 之类占位符换成实际数值。 */
export function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match))
}

export { createPortal }
