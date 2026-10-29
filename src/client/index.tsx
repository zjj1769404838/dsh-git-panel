import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

/** 服务短名（不是 package.json 里的全名）。 */
export const inject = ['slots', 'sessions', 'locale']

const NS = 'dsh-git-panel'
const ROUTE = '/dsh-git-panel'
const BUILD = 'dgp-v8'

type Dict = Record<string, string>

const ZH: Dict = {
  entry: 'Git',
  entryTitle: '当前仓库状态',
  navLabel: 'Git',
  panelTitle: 'Git 账号与仓库授权',
  panelSubtitle: '连接账号，并限定 Agent 可以触达的仓库与目录',
  tabAccounts: '账号',
  tabScope: '仓库范围',
  tabHelp: '授权说明',
  groupAccounts: '已连接',
  groupConnect: '连接新账号',
  groupScopeRepos: '远端仓库',
  groupScopeRoots: '本地目录',
  groupPolicy: '写操作策略',
  noAccount: '尚未连接任何 Git 账号',
  noAccountHint: '连接后，Agent 才能在授权范围内读取仓库信息、分支、差异与提交记录。',
  connected: '已连接',
  expired: '授权已失效',
  errored: '凭据异常',
  disconnect: '断开',
  reauth: '重新授权',
  recheck: '校验',
  provider: '平台',
  method: '接入方式',
  oauth: 'OAuth 设备码',
  pat: '个人访问令牌（PAT）',
  oauthPro: '适合本机交互式使用：浏览器打开一次授权页、输入代码即可，不需要复制令牌，权限由平台授权页控制。',
  patPro: '适合无人值守/CI/自建实例：可精确限制到单个仓库与只读 scope，令牌只在本机加密保存。',
  tokenLabel: '访问令牌',
  tokenPlaceholder: '粘贴 PAT（仅本次提交，保存后不再回显）',
  clientIdLabel: 'OAuth App Client ID',
  clientIdHint: '需要你在平台上自建 OAuth App 并填入其 Client ID；本插件不内置任何第三方应用凭据。',
  hostLabel: '实例地址（自建时填）',
  hostPlaceholder: '例如 git.example.com',
  apiBaseLabel: 'API 地址（可选）',
  apiBasePlaceholder: '例如 https://git.example.com/api/v1',
  connect: '连接',
  connecting: '连接中…',
  cancel: '取消',
  save: '保存范围',
  saved: '已保存',
  scopeRepos: '允许 Agent 操作的远端仓库',
  scopeReposHint: '每行一个 owner/repo；填 * 表示全部仓库（不推荐）。留空表示不允许任何远端操作。',
  scopeRoots: '允许 Agent 操作的本地仓库目录',
  scopeRootsHint: '每行一个绝对路径。本地 git 命令只会在这些目录（含子目录）内执行；填 * 表示不限制目录（等同于放开本机全部仓库，谨慎使用）。',
  allowWrite: '允许 Agent 修改仓库',
  allowWriteHint: '开启后 Agent 可执行 add/commit/checkout 等写操作；关闭时全部写操作会被拒绝。',
  requireConfirm: '写操作前需要我确认',
  requireConfirmHint: '开启后 Agent 每次写操作都会先返回待确认信息，需你同意后才真正执行。',
  defaultAccount: '默认账号',
  userCode: '在浏览器中打开下面的地址，输入代码完成授权',
  copy: '复制',
  copied: '已复制',
  waiting: '等待授权…',
  authDone: '授权完成',
  authFailed: '授权失败',
  currentRepo: '当前会话仓库',
  notRepo: '当前会话目录不是 Git 仓库',
  menuInit: '初始化 Git 项目',
  menuInitHint: '只创建 .git 目录，不会删除或覆盖现有文件',
  menuSettings: '打开 Git 设置',
  menuCopyPath: '复制目录路径',
  menuRefresh: '刷新状态',
  menuChecking: '正在检测仓库状态…',
  menuDetectFailed: '无法检测仓库状态',
  menuRetry: '重新检测',
  alreadyRepo: '当前目录已经是 Git 仓库，无需初始化',
  initRunning: '正在初始化…',
  initDone: '仓库已初始化',
  initFailed: '初始化失败',
  menuTitle: '仓库',
  menuNoRepo: '此目录还不是仓库，初始化后即可跟踪改动',
  unauthorizedRoot: '当前目录未在授权范围内',
  graphTitle: '分支拓扑',
  graphLoading: '正在读取提交图…',
  graphEmpty: '仓库还没有任何提交',
  graphFailed: '读取提交图失败',
  graphTruncated: '仅显示最近 {n} 条提交',
  graphLanes: '{n} 条车道',
  graphHead: 'HEAD',
  graphRemote: '远端',
  graphTag: '标签',
  graphCopyHash: '复制提交哈希',
  graphCopied: '已复制哈希',
  graphDetached: '游离 HEAD',
  noSession: '当前没有会话',
  detached: '游离 HEAD',
  changed: '处改动',
  refresh: '刷新',
  errLoad: '无法读取面板状态，请确认插件已加载并重试',
  helpText:
    '授权边界：Agent 只能读取你在「仓库范围」里列出的仓库与目录；未授权、授权失效、仓库不存在或 git 命令失败时，工具都会返回可读的原因，不会静默失败。令牌只以 AES-256-GCM 加密保存在本机 ~/.dsh/git-panel/state.json，界面与日志中都不会出现明文。',
  removeConfirm: '断开后该账号的令牌会被立即删除，Agent 将无法再使用它。确定断开？',
}

const EN: Dict = {
  entry: 'Git',
  entryTitle: 'Current repository status',
  navLabel: 'Git',
  panelTitle: 'Git account access',
  panelSubtitle: 'Connect accounts and limit which repositories the agent may touch',
  tabAccounts: 'Accounts',
  tabScope: 'Scope',
  tabHelp: 'Authorization',
  groupAccounts: 'Connected',
  groupConnect: 'Connect an account',
  groupScopeRepos: 'Remote repositories',
  groupScopeRoots: 'Local directories',
  groupPolicy: 'Write policy',
  noAccount: 'No Git account connected yet',
  noAccountHint: 'Once connected, the agent can read repository info, branches, diffs and commits within the authorized scope.',
  connected: 'Connected',
  expired: 'Authorization expired',
  errored: 'Credential error',
  disconnect: 'Disconnect',
  reauth: 'Re-authorize',
  recheck: 'Verify',
  provider: 'Provider',
  method: 'Method',
  oauth: 'OAuth device flow',
  pat: 'Personal access token (PAT)',
  oauthPro: 'Best for interactive local use: open one browser page, type the code, no token copying.',
  patPro: 'Best for unattended/CI/self-hosted: scope it to a single repository, read-only; stored encrypted locally.',
  tokenLabel: 'Access token',
  tokenPlaceholder: 'Paste a PAT (submitted once, never shown again)',
  clientIdLabel: 'OAuth App Client ID',
  clientIdHint: 'Create your own OAuth App on the provider and paste its Client ID; this plugin ships no third-party credentials.',
  hostLabel: 'Instance host (self-hosted)',
  hostPlaceholder: 'e.g. git.example.com',
  apiBaseLabel: 'API base (optional)',
  apiBasePlaceholder: 'e.g. https://git.example.com/api/v1',
  connect: 'Connect',
  connecting: 'Connecting…',
  cancel: 'Cancel',
  save: 'Save scope',
  saved: 'Saved',
  scopeRepos: 'Remote repositories the agent may use',
  scopeReposHint: 'One owner/repo per line; * means all repositories (not recommended). Empty means no remote access.',
  scopeRoots: 'Local repository directories the agent may use',
  scopeRootsHint: 'One absolute path per line. Local git commands only run inside these directories. * means no directory limit (the whole machine — use with care).',
  allowWrite: 'Allow the agent to modify repositories',
  allowWriteHint: 'When on, the agent may run add/commit/checkout; when off, every write is rejected.',
  requireConfirm: 'Ask me before every write',
  requireConfirmHint: 'When on, each write returns a pending confirmation that you must approve.',
  defaultAccount: 'Default account',
  userCode: 'Open the URL below in a browser and enter the code',
  copy: 'Copy',
  copied: 'Copied',
  waiting: 'Waiting for authorization…',
  authDone: 'Authorized',
  authFailed: 'Authorization failed',
  currentRepo: 'Current session repository',
  notRepo: 'The current session directory is not a Git repository',
  menuInit: 'Initialize Git project',
  menuInitHint: 'Creates only the .git directory; existing files are kept as-is',
  menuSettings: 'Open Git settings',
  menuCopyPath: 'Copy directory path',
  menuRefresh: 'Refresh status',
  menuChecking: 'Checking repository status…',
  menuDetectFailed: 'Cannot detect repository status',
  menuRetry: 'Check again',
  alreadyRepo: 'This directory is already a Git repository',
  initRunning: 'Initializing…',
  initDone: 'Repository initialized',
  initFailed: 'Initialization failed',
  menuTitle: 'Repository',
  menuNoRepo: 'This directory is not a repository yet; initialize it to start tracking changes',
  unauthorizedRoot: 'The current directory is outside the authorized scope',
  graphTitle: 'Branch topology',
  graphLoading: 'Loading commit graph…',
  graphEmpty: 'This repository has no commits yet',
  graphFailed: 'Failed to load the commit graph',
  graphTruncated: 'Showing the latest {n} commits',
  graphLanes: '{n} lanes',
  graphHead: 'HEAD',
  graphRemote: 'remote',
  graphTag: 'tag',
  graphCopyHash: 'Copy commit hash',
  graphCopied: 'Hash copied',
  graphDetached: 'detached HEAD',
  noSession: 'No active session',
  detached: 'detached HEAD',
  changed: 'changed',
  refresh: 'Refresh',
  errLoad: 'Cannot read panel state; make sure the plugin is loaded and retry',
  helpText:
    'Authorization boundary: the agent can only read the repositories and directories listed in “Scope”. Unauthorized repos, expired grants, missing repositories and failing git commands all return a readable reason. Tokens are stored with AES-256-GCM in ~/.dsh/git-panel/state.json and never appear in the UI or logs.',
  removeConfirm: 'Disconnecting deletes this token immediately; the agent will no longer be able to use it. Continue?',
}

interface AccountView {
  id: string
  provider: string
  kind: 'oauth' | 'pat'
  login: string
  displayName: string
  avatarUrl: string
  host: string
  scopes: string[]
  status: 'connected' | 'expired' | 'error'
  lastError: string
  lastCheckedAt: number
}

interface SettingsView {
  allowedRepos: string[]
  allowedRoots: string[]
  allowWrite: boolean
  requireConfirm: boolean
  defaultAccountId: string
}

interface PanelState {
  accounts: AccountView[]
  settings: SettingsView
}

interface ProviderView {
  id: string
  label: string
  host: string
  oauthHint: string
  patHint: string
  patUrl: string
}

interface RepoStatusView {
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
  /**
   * repo=确认是仓库；no-repo=目录存在但没有 .git（才允许显示初始化）；
   * invalid=路径非法/不存在/不可读（检测失败，不能当成未初始化）。
   */
  reason?: 'repo' | 'no-repo' | 'invalid'
}

/** 路由基于当前页面 baseURI，避免硬编码端口（GUI 每次重启端口会变）。 */
function routeUrl(path: string): string {
  const base = document.baseURI || location.href
  return new URL(ROUTE + path, base).toString()
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(routeUrl(path), {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: 'same-origin',
    })
    const text = await response.text()
    let json: any = null
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

const CSS = `
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
  --dgp-r-xs:var(--dsw-radius-xs,4px);
  --dgp-r-sm:var(--dsw-radius-sm,8px);
  --dgp-ease:var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1));
  --dgp-fast:var(--ds-transition-duration-fast,.1s);
  --dgp-code:var(--ds-font-family-code,"SF Mono","JetBrains Mono",Consolas,Menlo,monospace);
  color:var(--dgp-fg);font-family:inherit;font-size:14px;line-height:22px;-webkit-font-smoothing:antialiased;
}
/* 分节骨架：与宿主 settings 的行式布局同一套度量 */
.dgp-section{display:flex;flex-direction:column;padding:2px 0 8px;max-width:100%}
.dgp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:0 0 14px;border-bottom:.5px solid var(--dgp-line)}
.dgp-title{font-size:14px;font-weight:500;line-height:22px;color:var(--dgp-fg);display:flex;align-items:center;gap:7px}
.dgp-sub{font-size:12px;line-height:18px;color:var(--dgp-muted);margin-top:4px}
/* 分段控件 */
.dgp-tabs,.dgp-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:var(--dgp-r-sm);background:var(--dgp-inset);align-self:flex-start;max-width:100%;overflow:hidden}
.dgp-tab,.dgp-seg button{appearance:none;border:0;margin:0;background:transparent;color:var(--dgp-muted);height:26px;padding:0 12px;border-radius:calc(var(--dgp-r-sm) - 3px);font:inherit;font-size:12px;line-height:18px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background var(--dgp-fast) var(--dgp-ease),color var(--dgp-fast) var(--dgp-ease),box-shadow var(--dgp-fast) var(--dgp-ease)}
.dgp-tab:hover,.dgp-seg button:hover{color:var(--dgp-fg2)}
.dgp-tab[data-on="1"],.dgp-seg button[data-on="1"]{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dgp-fg);box-shadow:var(--dsw-shadow-lv1,0 2px 4px 0 #0000000d)}
.dgp-tab:focus-visible,.dgp-seg button:focus-visible{outline:2px solid var(--dgp-accent);outline-offset:-1px}
/* 分组与行 */
.dgp-group{display:flex;flex-direction:column}
.dgp-group-title{font-size:11px;line-height:16px;font-weight:500;letter-spacing:.02em;text-transform:uppercase;color:var(--dgp-faint);padding:18px 0 4px}
.dgp-row{display:flex;align-items:center;gap:8px;min-width:0}
.dgp-line{border-bottom:.5px solid var(--dgp-line);padding:13px 0;display:flex;align-items:center;justify-content:space-between;gap:24px}
.dgp-line:last-of-type{border-bottom:none}
.dgp-line-main{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.dgp-line-side{display:flex;align-items:center;gap:6px;flex:0 0 auto}
.dgp-name{font-size:14px;line-height:22px;font-weight:500;color:var(--dgp-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-meta{font-size:12px;line-height:18px;color:var(--dgp-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dgp-meta code,.dgp-mono{font-family:var(--dgp-code);font-size:11.5px}
.dgp-hint{font-size:12px;line-height:18px;color:var(--dgp-muted);margin-top:5px}
.dgp-err{font-size:12px;line-height:18px;color:var(--dgp-danger);margin-top:6px;word-break:break-word}
.dgp-ok{font-size:12px;line-height:18px;color:var(--dgp-ok);margin-top:6px}
/* 状态点与徽章 */
.dgp-dot{width:6px;height:6px;border-radius:50%;background:var(--dgp-faint);flex:0 0 auto;box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-faint) 14%,transparent)}
.dgp-dot[data-state="connected"]{background:var(--dgp-ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-ok) 16%,transparent)}
.dgp-dot[data-state="expired"],.dgp-dot[data-state="error"]{background:var(--dgp-danger);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-danger) 16%,transparent)}
.dgp-badge{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:var(--dgp-r-xs);border:.5px solid var(--dgp-line2);font-size:11px;line-height:16px;font-weight:500;color:var(--dgp-muted);white-space:nowrap}
.dgp-badge[data-tone="mono"]{font-family:var(--dgp-code)}
.dgp-badge[data-state="connected"]{color:var(--dgp-ok);border-color:color-mix(in srgb,var(--dgp-ok) 40%,transparent);background:color-mix(in srgb,var(--dgp-ok) 10%,transparent)}
.dgp-badge[data-state="expired"],.dgp-badge[data-state="error"]{color:var(--dgp-danger);border-color:color-mix(in srgb,var(--dgp-danger) 40%,transparent);background:color-mix(in srgb,var(--dgp-danger) 9%,transparent)}
/* 按钮 */
.dgp-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:28px;padding:0 11px;border-radius:var(--dgp-r-sm);border:.5px solid var(--dgp-line2);background:transparent;color:var(--dgp-fg2);font:inherit;font-size:12px;line-height:18px;font-weight:500;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background var(--dgp-fast) var(--dgp-ease),color var(--dgp-fast) var(--dgp-ease),border-color var(--dgp-fast) var(--dgp-ease)}
.dgp-btn:hover:not(:disabled){background:var(--dgp-hover);color:var(--dgp-fg)}
.dgp-btn:focus-visible{outline:2px solid var(--dgp-accent);outline-offset:1px}
.dgp-btn:disabled{opacity:.45;cursor:not-allowed}
.dgp-btn.primary{background:var(--dsw-alias-button-primary-fill,#0f1115);border-color:transparent;color:var(--dsw-alias-label-primary-inverted,#fff)}
.dgp-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#3c3c3d);color:var(--dsw-alias-label-primary-inverted,#fff)}
.dgp-btn.danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger,#ec13130d);border-color:color-mix(in srgb,var(--dgp-danger) 45%,transparent);color:var(--dgp-danger)}
.dgp-btn.ghost{border-color:transparent}
/* 表单 */
.dgp-field{display:flex;flex-direction:column;padding:13px 0;border-bottom:.5px solid var(--dgp-line)}
.dgp-field:last-of-type{border-bottom:none}
.dgp-label{font-size:12px;line-height:18px;font-weight:500;color:var(--dgp-fg2);margin-bottom:7px}
.dgp-input,.dgp-select,.dgp-area{width:100%;box-sizing:border-box;height:32px;padding:0 10px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-sm);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dgp-fg);font:inherit;font-size:13px;line-height:20px;outline:none;transition:border-color var(--dgp-fast) var(--dgp-ease),box-shadow var(--dgp-fast) var(--dgp-ease)}
/* 单行控件不铺满整行：与宿主设置页「行内定宽控件」同一观感，避免表单感过重 */
.dgp-input,.dgp-select{max-width:340px}
.dgp-select{appearance:none;padding-right:26px;background-image:linear-gradient(45deg,transparent 50%,var(--dgp-muted) 50%),linear-gradient(135deg,var(--dgp-muted) 50%,transparent 50%);background-position:calc(100% - 14px) 14px,calc(100% - 9px) 14px;background-size:5px 5px,5px 5px;background-repeat:no-repeat}
.dgp-area{height:auto;min-height:76px;padding:8px 10px;resize:vertical;font-family:var(--dgp-code);font-size:12px;line-height:20px}
.dgp-input::placeholder,.dgp-area::placeholder{color:var(--dgp-faint)}
.dgp-input:focus,.dgp-select:focus,.dgp-area:focus{border-color:var(--dgp-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgp-accent) 18%,transparent)}
/* 勾选项 */
.dgp-check{display:flex;align-items:flex-start;gap:10px;padding:13px 0;border-bottom:.5px solid var(--dgp-line);cursor:pointer}
.dgp-check:last-of-type{border-bottom:none}
.dgp-check input{appearance:none;flex:0 0 auto;width:16px;height:16px;margin:3px 0 0;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-xs);background:var(--dsw-alias-bg-layer-1,#fff);cursor:pointer;position:relative;transition:background var(--dgp-fast) var(--dgp-ease),border-color var(--dgp-fast) var(--dgp-ease)}
.dgp-check input:checked{background:var(--dgp-accent);border-color:var(--dgp-accent)}
.dgp-check input:checked::after{content:"";position:absolute;left:4.5px;top:1.5px;width:4px;height:8px;border:solid #fff;border-width:0 1.5px 1.5px 0;transform:rotate(42deg)}
.dgp-check input:focus-visible{outline:2px solid var(--dgp-accent);outline-offset:1px}
.dgp-check-body{display:flex;flex-direction:column;gap:3px;min-width:0}
.dgp-check-title{font-size:13px;line-height:20px;font-weight:500;color:var(--dgp-fg)}
/* 说明块 */
.dgp-card{background:var(--dgp-inset);border-radius:var(--dgp-r-sm);padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.dgp-kv{display:grid;grid-template-columns:88px minmax(0,1fr);gap:6px 12px;font-size:12px;line-height:18px;margin:0}
.dgp-kv dt{color:var(--dgp-muted);margin:0}
.dgp-kv dd{color:var(--dgp-fg2);margin:0;overflow-wrap:anywhere}
.dgp-code{font-family:var(--dgp-code);font-size:20px;line-height:28px;font-weight:600;letter-spacing:.14em;color:var(--dgp-fg);font-variant-numeric:tabular-nums}
.dgp-link{color:var(--dsw-alias-link,var(--dgp-accent));text-decoration:none;border-bottom:.5px solid color-mix(in srgb,currentColor 40%,transparent)}
.dgp-link:hover{border-bottom-color:currentColor}
.dgp-sep{height:.5px;background:var(--dgp-line);margin:2px 0}
/* composer 分支 chip（opencode 风格：等宽、无边框、低存在感） */
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
.dgp-chip-wrap{position:relative;display:inline-flex;align-items:center}
/* chip 弹出菜单：portal 到 body，fixed 定位在 chip 上方（composer 在屏幕底部，向下会出界）。
   z-index 必须高于宿主浮层（commands/input-trigger 用 100，model-selection/chat/panel 用 1100）。 */
.dgp-menu{display:flex;flex-direction:column;position:fixed;z-index:1200;min-width:236px;max-width:320px;max-height:min(340px,60vh);overflow-y:auto;padding:4px;border:.5px solid var(--dgp-line2);border-radius:var(--dgp-r-md);background:var(--dsw-alias-bg-layer-1,var(--dgp-bg,#fff));box-shadow:var(--dsw-elevation-prominent,0 8px 28px #00000026);font-family:var(--dsw-font-family,inherit);font-size:12px;line-height:18px;color:var(--dgp-fg2);box-sizing:border-box}
.dgp-menu-head{padding:7px 9px 6px;display:flex;align-items:center;gap:6px;color:var(--dgp-faint);font-size:11px;line-height:16px;letter-spacing:.02em;text-transform:uppercase}
.dgp-menu-sum{padding:0 9px 7px;color:var(--dgp-muted);font-size:11px;line-height:16px;font-family:var(--dgp-code);word-break:break-all}
/* 带分支拓扑时加宽：图区需要 380px 以上才看得清车道与提交标题。 */
.dgp-menu[data-graph="1"]{width:min(440px,calc(100vw - 16px));min-width:0;max-width:min(440px,calc(100vw - 16px));max-height:min(520px,72vh)}
.dgp-menu-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;border:0;border-radius:var(--dgp-r-sm);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background var(--dgp-fast) var(--dgp-ease)}
.dgp-menu-item:hover:not(:disabled){background:var(--dgp-hover)}
.dgp-menu-item:disabled{opacity:.55;cursor:default}
.dgp-menu-item svg{flex:0 0 auto;opacity:.75}
.dgp-menu-item-main{display:flex;flex-direction:column;min-width:0;gap:1px}
.dgp-menu-item-title{color:var(--dgp-fg);font-size:12px;line-height:17px}
.dgp-menu-item-hint{color:var(--dgp-faint);font-size:11px;line-height:15px}
/* 主行动（未初始化时的「初始化 Git 项目」）：只靠图标与字重强调，不加填充色，保持菜单安静 */
.dgp-menu-item[data-primary="1"] .dgp-menu-item-title{font-weight:500}
.dgp-menu-item[data-primary="1"] svg{color:var(--dgp-accent);opacity:1}
.dgp-menu-note{padding:7px 9px;color:var(--dgp-muted);font-size:11px;line-height:16px}
.dgp-menu-note[data-tone="error"]{color:var(--dgp-danger)}
.dgp-menu-note[data-tone="ok"]{color:var(--dsw-alias-state-success-primary,#22c55e)}
.dgp-menu-sep{height:.5px;background:var(--dgp-line);margin:3px 6px}

/* ------------------------------------------------------------------ */
/* 分支拓扑图（车道式 DAG）                                            */
/* 车道宽 13px、行高 26px：与 gitk / VS Code Git Graph 同量级，         */
/* 8 条以内车道仍可读；超宽时图区横向滚动而不是压缩车道。               */
/* 颜色按车道索引取（车道稳定 → 颜色稳定），不按分支名哈希。            */
/* ------------------------------------------------------------------ */
/* 车道配色：按车道索引取色（车道稳定 → 颜色稳定），8 色循环。
   浅色主题与深色主题各一套，保证同一条线在两种背景下都可读。 */
.dgp-root,.dgp-portal{
  --dgp-lane-0:#4176e6;--dgp-lane-1:#1f9d63;--dgp-lane-2:#c98a06;--dgp-lane-3:#8b5cf6;
  --dgp-lane-4:#0ea5e9;--dgp-lane-5:#e0526a;--dgp-lane-6:#e2762e;--dgp-lane-7:#64748b;
}
body[data-ds-dark-theme] .dgp-root,body[data-ds-dark-theme] .dgp-portal{
  --dgp-lane-0:#7aaaff;--dgp-lane-1:#4ecf9a;--dgp-lane-2:#e9b949;--dgp-lane-3:#b18cff;
  --dgp-lane-4:#56c8f5;--dgp-lane-5:#f57e94;--dgp-lane-6:#f59a63;--dgp-lane-7:#94a3b8;
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
`

function useStyles(): void {
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

function Dot({ state }: { state?: string }) {
  return <span className="dgp-dot" data-state={state ?? 'none'} aria-hidden="true" />
}

function BranchIcon() {
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

/** 设置面板在 DOM 里的稳定锚点（宿主 SettingsPanel 上写死）。 */
const SETTINGS_PANEL_SELECTOR = '[data-shortcut-modal="settings"]'

/**
 * 设置入口按钮的候选选择器，按可信度排序。
 * 宿主 SettingsRoot 的 trigger 恒带 `aria-haspopup="dialog"`；`aria-keyshortcuts`
 * 只在快捷键目录里有 settings.open 这一行时才渲染，所以不能只依赖后者。
 */
const SETTINGS_TRIGGER_SELECTORS = [
  'button[aria-haspopup="dialog"][aria-keyshortcuts]',
  'button[aria-haspopup="dialog"]',
]

/** 兜底时按可见文案认设置按钮（宿主 locale 可能给中文或英文）。 */
const SETTINGS_TRIGGER_LABEL = /设置|設定|Settings|Preferences/i

function isSettingsOpen(): boolean {
  return document.querySelector(SETTINGS_PANEL_SELECTOR) !== null
}

/** 找到宿主的设置入口按钮；已展开的不算（再点会把它关掉）。 */
function findSettingsTrigger(): HTMLButtonElement | undefined {
  for (const selector of SETTINGS_TRIGGER_SELECTORS) {
    const nodes = Array.from(document.querySelectorAll<HTMLButtonElement>(selector))
    const usable = nodes.filter((node) => !node.disabled && node.getAttribute('aria-expanded') !== 'true')
    if (usable.length === 0) continue
    const labeled = usable.find((node) => SETTINGS_TRIGGER_LABEL.test(node.getAttribute('aria-label') ?? node.textContent ?? ''))
    return labeled ?? usable[0]
  }
  return undefined
}

/** 等一帧，让 React 把 state 刷到 DOM 上再判定。 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    try {
      window.requestAnimationFrame(() => resolve())
    } catch {
      window.setTimeout(resolve, 16)
    }
  })
}

/** 跑一次动作，等两帧后看设置面板有没有出现。 */
async function attempt(open: () => void): Promise<boolean> {
  if (isSettingsOpen()) return true
  try {
    open()
  } catch {
    return false
  }
  await nextFrame()
  if (isSettingsOpen()) return true
  await nextFrame()
  return isSettingsOpen()
}

/**
 * 面板已打开后，把左侧导航切到 Git 分节。
 * 宿主导航行结构固定：`nav > div.navList > button[aria-current] > span.<navLabel 文案>`，
 * 文案来自我们注册 settings.section 时给的 `label`，即 t('navLabel')。
 */
async function selectSettingsSection(label: string): Promise<void> {
  const panel = document.querySelector(SETTINGS_PANEL_SELECTOR)
  if (panel === null) return
  const rows = Array.from(panel.querySelectorAll<HTMLButtonElement>('nav button'))
  const target = rows.find((row) => {
    const text = (row.textContent ?? '').trim()
    return text === label
  })
  if (target === undefined) return
  if (target.getAttribute('aria-current') === 'true') return
  target.click()
  await nextFrame()
}

/**
 * 打开 DSH 设置页并切到 Git 分节。
 *
 * 不能只靠派发合成键盘事件：桌面端 `installNativeKeyboard` 接管快捷键后走原生 IPC，
 * 且 `installKeyboard` 里 `if (native) return` 直接跳过 DOM keydown 分支，
 * 合成的 Ctrl/Cmd+, 在桌面端永远到不了 `settings.open`。
 *
 * 按可信度依次尝试，任一成功即止：
 * 1) 点宿主自己的设置触发按钮（走宿主 onClick，最稳）；
 * 2) `shortcuts.registry.invoke('settings.open', ...)`（原生菜单走的同一条路，不校验 isTrusted）；
 * 3) 兜底派发 keydown（Web 端 runtime 无原生桥接，这条路有效）。
 */
async function openSettingsSection(
  ctx?: { shortcuts?: { registry?: { invoke?: (id: string, context: any) => void } } },
  sectionLabel?: string,
): Promise<void> {
  if (!isSettingsOpen()) {
    // 1) 点宿主的设置触发按钮。
    const trigger = findSettingsTrigger()
    if (trigger !== undefined) {
      const opened = await attempt(() => trigger.click())
      if (!opened) await openSettingsFallback(ctx)
    } else {
      await openSettingsFallback(ctx)
    }
  }
  if (sectionLabel !== undefined && sectionLabel !== '') await selectSettingsSection(sectionLabel)
}

/** 触发按钮不可用时的两条兜底路径。 */
async function openSettingsFallback(ctx?: {
  shortcuts?: { registry?: { invoke?: (id: string, context: any) => void } }
}): Promise<void> {
  // 2) 直接调 ShortcutRegistry.invoke：与原生菜单调用完全一致。
  const invoke = ctx?.shortcuts?.registry?.invoke
  if (typeof invoke === 'function') {
    const opened = await attempt(() =>
      invoke('settings.open', {
        region: 'page',
        modal: null,
        target: document.activeElement,
        source: 'menu',
      }),
    )
    if (opened) return
  }

  // 3) 兜底：Web 端 runtime 没有原生键盘桥接，keydown 分支可用。
  await attempt(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: ',',
        code: 'Comma',
        // 宿主默认绑定是 modifiers:['primary']；Windows 上 primary = control，
        // 不能同时置 metaKey，否则 bindingKey 匹配不上。
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
  })
}

/* ------------------------------------------------------------------ */
/* 设置页分节                                                          */
/* ------------------------------------------------------------------ */

interface SectionProps {
  t: (key: string) => string
  close?: () => void
}

function GitSection({ t }: SectionProps) {
  useStyles()
  const [tab, setTab] = useState<'accounts' | 'scope' | 'help'>('accounts')
  const [state, setState] = useState<PanelState | null>(null)
  const [providers, setProviders] = useState<ProviderView[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [provider, setProvider] = useState('github')
  const [method, setMethod] = useState<'oauth' | 'pat'>('pat')
  const [token, setToken] = useState('')
  const [clientId, setClientId] = useState('')
  const [host, setHost] = useState('')
  const [apiBase, setApiBase] = useState('')
  const [flow, setFlow] = useState<{ pollKey: string; userCode: string; verificationUri: string; interval: number } | null>(null)
  const [flowMsg, setFlowMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const [reposText, setReposText] = useState('')
  const [rootsText, setRootsText] = useState('')
  const [allowWrite, setAllowWrite] = useState(false)
  const [requireConfirm, setRequireConfirm] = useState(true)
  const [savedTick, setSavedTick] = useState(0)

  const timerRef = useRef<number | null>(null)

  const applyState = useCallback((next: PanelState) => {
    setState(next)
    setReposText(next.settings.allowedRepos.join('\n'))
    setRootsText(next.settings.allowedRoots.join('\n'))
    setAllowWrite(next.settings.allowWrite)
    setRequireConfirm(next.settings.requireConfirm)
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await api<{ ok: boolean; state: PanelState; providers: ProviderView[]; error?: string }>('/state')
      if (!data.ok) {
        setError(data.error ?? t('errLoad'))
        return
      }
      setError('')
      setProviders(data.providers ?? [])
      applyState(data.state)
    } catch (err) {
      setError(t('errLoad') + '：' + (err instanceof Error ? err.message : String(err)))
    }
  }, [applyState, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const stopPolling = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const pollOnce = useCallback(
    async (pollKey: string, interval: number) => {
      try {
        const data = await api<any>('/oauth/poll', { pollKey })
        if (data.status === 'authorized') {
          stopPolling()
          setFlow(null)
          setFlowMsg(t('authDone'))
          setToken('')
          if (data.state) applyState(data.state)
          return
        }
        if (data.status === 'denied' || data.status === 'expired' || data.status === 'error') {
          stopPolling()
          setFlow(null)
          setFlowMsg((data.error as string) || t('authFailed'))
          return
        }
        const wait = (data.retryAfter as number) > 0 ? (data.retryAfter as number) : interval
        timerRef.current = window.setTimeout(() => void pollOnce(pollKey, interval), Math.max(wait, 3) * 1000)
      } catch (err) {
        stopPolling()
        setFlowMsg(err instanceof Error ? err.message : String(err))
      }
    },
    [applyState, t],
  )

  const startOAuth = async () => {
    setBusy(true)
    setError('')
    setFlowMsg('')
    try {
      const data = await api<any>('/oauth/start', { provider, clientId, host, apiBase })
      if (!data.ok) {
        setError(data.error ?? t('authFailed'))
        return
      }
      const pollKey = String(data.pollKey ?? '')
      setFlow({ pollKey, userCode: data.flow.userCode, verificationUri: data.flow.verificationUri, interval: data.flow.interval })
      setFlowMsg(t('waiting'))
      if (pollKey) {
        timerRef.current = window.setTimeout(() => void pollOnce(pollKey, data.flow.interval), Math.max(data.flow.interval, 3) * 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const connectPat = async () => {
    if (token.trim().length === 0) {
      setError('请填写访问令牌')
      return
    }
    setBusy(true)
    setError('')
    setFlowMsg('')
    try {
      const data = await api<any>('/pat/connect', { provider, token, host, apiBase })
      if (!data.ok) {
        setError(data.error ?? '连接失败')
        return
      }
      setToken('')
      setFlowMsg('')
      if (data.state) applyState(data.state)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async (id: string) => {
    if (!window.confirm(t('removeConfirm'))) return
    setBusy(true)
    try {
      const data = await api<any>('/accounts/remove', { id })
      if (data.state) applyState(data.state)
      if (!data.ok && data.error) setError(data.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const recheck = async (id: string) => {
    setBusy(true)
    try {
      const data = await api<any>('/accounts/recheck', { id })
      if (data.state) applyState(data.state)
      if (!data.ok && data.error) setError(data.error)
      else setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const saveScope = async () => {
    setBusy(true)
    try {
      const data = await api<any>('/settings', {
        allowedRepos: reposText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        allowedRoots: rootsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        allowWrite,
        requireConfirm,
      })
      if (data.state) applyState(data.state)
      if (data.ok) setSavedTick((value) => value + 1)
      else setError(data.error ?? '保存失败')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const currentProvider = useMemo(() => providers.find((item) => item.id === provider), [providers, provider])
  const accounts = state?.accounts ?? []
  const primaryState = accounts.find((item) => item.status === 'connected')?.status ?? accounts[0]?.status

  const statusText = (value: string) =>
    value === 'connected' ? t('connected') : value === 'expired' ? t('expired') : t('errored')

  return (
    <div className="dgp-root dgp-section">
      <div className="dgp-head">
        <div>
          <div className="dgp-title">
            <Dot state={primaryState} />
            {t('panelTitle')}
          </div>
          <div className="dgp-sub">{t('panelSubtitle')}</div>
        </div>
        <div className="dgp-tabs" role="tablist">
          <button type="button" role="tab" className="dgp-tab" aria-selected={tab === 'accounts'} data-on={tab === 'accounts' ? '1' : '0'} onClick={() => setTab('accounts')}>
            {t('tabAccounts')}
          </button>
          <button type="button" role="tab" className="dgp-tab" aria-selected={tab === 'scope'} data-on={tab === 'scope' ? '1' : '0'} onClick={() => setTab('scope')}>
            {t('tabScope')}
          </button>
          <button type="button" role="tab" className="dgp-tab" aria-selected={tab === 'help'} data-on={tab === 'help' ? '1' : '0'} onClick={() => setTab('help')}>
            {t('tabHelp')}
          </button>
        </div>
      </div>

      {error ? <div className="dgp-err">{error}</div> : null}

      {tab === 'accounts' ? (
        <>
          <div className="dgp-group">
            <div className="dgp-group-title">{t('groupAccounts')}</div>
            {accounts.length === 0 ? (
              <div className="dgp-line">
                <div className="dgp-line-main">
                  <div className="dgp-name" style={{ fontWeight: 400, color: 'var(--dgp-fg2)' }}>
                    {t('noAccount')}
                  </div>
                  <div className="dgp-hint" style={{ marginTop: 2 }}>
                    {t('noAccountHint')}
                  </div>
                </div>
              </div>
            ) : (
              accounts.map((account) => (
                <div className="dgp-line" key={account.id}>
                  <div className="dgp-line-main">
                    <div className="dgp-row">
                      <Dot state={account.status} />
                      <span className="dgp-name">{account.login || '(unknown)'}</span>
                      <span className="dgp-badge">{account.provider}</span>
                      <span className="dgp-badge" data-tone="mono">
                        {account.kind === 'oauth' ? 'OAuth' : 'PAT'}
                      </span>
                      <span className="dgp-badge" data-state={account.status}>
                        {statusText(account.status)}
                      </span>
                    </div>
                    <div className="dgp-meta">
                      {account.host ? <span>{account.host}</span> : null}
                      {account.scopes.length > 0 ? <code>{account.scopes.join(' ')}</code> : null}
                    </div>
                    {account.lastError ? <div className="dgp-err">{account.lastError}</div> : null}
                  </div>
                  <div className="dgp-line-side">
                    <button type="button" className="dgp-btn ghost" disabled={busy} onClick={() => void recheck(account.id)}>
                      {t('recheck')}
                    </button>
                    <button type="button" className="dgp-btn danger" disabled={busy} onClick={() => void disconnect(account.id)}>
                      {t('disconnect')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="dgp-group">
            <div className="dgp-group-title">{t('groupConnect')}</div>

            <div className="dgp-field">
              <label className="dgp-label">{t('provider')}</label>
              <select className="dgp-select" value={provider} onChange={(event) => setProvider(event.target.value)}>
                {(providers.length > 0 ? providers : [{ id: 'github', label: 'GitHub' } as ProviderView]).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="dgp-field">
              <label className="dgp-label">{t('method')}</label>
              <div className="dgp-seg" role="group">
                <button type="button" data-on={method === 'pat' ? '1' : '0'} onClick={() => setMethod('pat')}>
                  {t('pat')}
                </button>
                <button type="button" data-on={method === 'oauth' ? '1' : '0'} onClick={() => setMethod('oauth')}>
                  {t('oauth')}
                </button>
              </div>
              <div className="dgp-hint">{method === 'pat' ? currentProvider?.patHint ?? t('patPro') : currentProvider?.oauthHint ?? t('oauthPro')}</div>
            </div>

            {provider === 'gitea' ? (
              <>
                <div className="dgp-field">
                  <label className="dgp-label">{t('hostLabel')}</label>
                  <input className="dgp-input" value={host} placeholder={t('hostPlaceholder')} onChange={(event) => setHost(event.target.value)} />
                </div>
                <div className="dgp-field">
                  <label className="dgp-label">{t('apiBaseLabel')}</label>
                  <input className="dgp-input" value={apiBase} placeholder={t('apiBasePlaceholder')} onChange={(event) => setApiBase(event.target.value)} />
                </div>
              </>
            ) : null}

            {method === 'pat' ? (
              <>
                <div className="dgp-field">
                  <label className="dgp-label">{t('tokenLabel')}</label>
                  <input
                    className="dgp-input"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={token}
                    placeholder={t('tokenPlaceholder')}
                    onChange={(event) => setToken(event.target.value)}
                  />
                  {currentProvider?.patUrl ? (
                    <div className="dgp-hint">
                      <a className="dgp-link" href={currentProvider.patUrl} target="_blank" rel="noreferrer noopener">
                        {currentProvider.patUrl}
                      </a>
                    </div>
                  ) : null}
                </div>
                <div className="dgp-field" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <div className="dgp-row">
                    <button type="button" className="dgp-btn primary" disabled={busy} onClick={() => void connectPat()}>
                      {busy ? t('connecting') : t('connect')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="dgp-field">
                  <label className="dgp-label">{t('clientIdLabel')}</label>
                  <input className="dgp-input" value={clientId} placeholder="Iv1.xxxxxxxxxxxx" onChange={(event) => setClientId(event.target.value)} />
                  <div className="dgp-hint">{t('clientIdHint')}</div>
                </div>
                {flow ? (
                  <div className="dgp-field" style={{ borderBottom: 'none' }}>
                    <div className="dgp-card">
                      <div className="dgp-hint" style={{ marginTop: 0 }}>
                        {t('userCode')}
                      </div>
                      <div className="dgp-code">{flow.userCode}</div>
                      <div className="dgp-row">
                        <a className="dgp-btn" href={flow.verificationUri} target="_blank" rel="noreferrer noopener">
                          {flow.verificationUri || 'open'}
                        </a>
                        <button
                          type="button"
                          className="dgp-btn"
                          onClick={() => {
                            void navigator.clipboard?.writeText(flow.userCode)
                            setCopied(true)
                            window.setTimeout(() => setCopied(false), 1500)
                          }}
                        >
                          {copied ? t('copied') : t('copy')}
                        </button>
                        <button
                          type="button"
                          className="dgp-btn ghost"
                          onClick={() => {
                            stopPolling()
                            setFlow(null)
                            setFlowMsg('')
                          }}
                        >
                          {t('cancel')}
                        </button>
                      </div>
                      {flowMsg ? <div className="dgp-hint">{flowMsg}</div> : null}
                    </div>
                  </div>
                ) : (
                  <div className="dgp-field" style={{ borderBottom: 'none' }}>
                    <div className="dgp-row">
                      <button type="button" className="dgp-btn primary" disabled={busy} onClick={() => void startOAuth()}>
                        {busy ? t('connecting') : t('connect')}
                      </button>
                    </div>
                    {flowMsg ? <div className="dgp-ok">{flowMsg}</div> : null}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : null}

      {tab === 'scope' ? (
        <>
          <div className="dgp-group">
            <div className="dgp-group-title">{t('groupScopeRepos')}</div>
            <div className="dgp-field">
              <label className="dgp-label">{t('scopeRepos')}</label>
              <textarea className="dgp-area" value={reposText} onChange={(event) => setReposText(event.target.value)} placeholder={'owner/repo\nanother-owner/another-repo'} />
              <div className="dgp-hint">{t('scopeReposHint')}</div>
            </div>
          </div>

          <div className="dgp-group">
            <div className="dgp-group-title">{t('groupScopeRoots')}</div>
            <div className="dgp-field">
              <label className="dgp-label">{t('scopeRoots')}</label>
              <textarea className="dgp-area" value={rootsText} onChange={(event) => setRootsText(event.target.value)} placeholder={'D:\\work\\my-repo'} />
              <div className="dgp-hint">{t('scopeRootsHint')}</div>
            </div>
          </div>

          <div className="dgp-group">
            <div className="dgp-group-title">{t('groupPolicy')}</div>
            <label className="dgp-check">
              <input type="checkbox" checked={allowWrite} onChange={(event) => setAllowWrite(event.target.checked)} />
              <span className="dgp-check-body">
                <span className="dgp-check-title">{t('allowWrite')}</span>
                <span className="dgp-hint" style={{ marginTop: 0 }}>
                  {t('allowWriteHint')}
                </span>
              </span>
            </label>
            <label className="dgp-check">
              <input type="checkbox" checked={requireConfirm} onChange={(event) => setRequireConfirm(event.target.checked)} />
              <span className="dgp-check-body">
                <span className="dgp-check-title">{t('requireConfirm')}</span>
                <span className="dgp-hint" style={{ marginTop: 0 }}>
                  {t('requireConfirmHint')}
                </span>
              </span>
            </label>
            <div className="dgp-line" style={{ borderBottom: 'none', justifyContent: 'flex-start', gap: 10 }}>
              <button type="button" className="dgp-btn primary" disabled={busy} onClick={() => void saveScope()}>
                {t('save')}
              </button>
              {savedTick > 0 ? <span className="dgp-ok" style={{ marginTop: 0 }}>{t('saved')}</span> : null}
            </div>
          </div>
        </>
      ) : null}

      {tab === 'help' ? (
        <div className="dgp-group" style={{ paddingTop: 14 }}>
          <div className="dgp-card">
            <div className="dgp-hint" style={{ marginTop: 0, lineHeight: '20px' }}>
              {t('helpText')}
            </div>
            <div className="dgp-sep" />
            <dl className="dgp-kv">
              <dt>{t('oauth')}</dt>
              <dd>{t('oauthPro')}</dd>
              <dt>{t('pat')}</dt>
              <dd>{t('patPro')}</dd>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 分支拓扑图：车道式 DAG 渲染                                          */
/* 图元只有三种（节点 / 同车道竖线 / 跨车道 S 形转折线），一条分支跨 N   */
/* 行靠 N 个竖线段拼出，不存在跨行长连线，因此连线永不穿过中间节点。      */
/* ------------------------------------------------------------------ */

const LANE_W = 13
const ROW_H = 34
const LANE_PAD = 9
const DOT_R = 4

interface GraphRefView {
  name: string
  kind: 'head' | 'local' | 'remote' | 'tag'
}

interface GraphRowView {
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

interface RepoGraphView {
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

function laneColor(lane: number): string {
  return `var(--dgp-lane-${((lane % 8) + 8) % 8})`
}

function laneX(lane: number): number {
  return LANE_PAD + lane * LANE_W
}

function rowY(row: number): number {
  return row * ROW_H + ROW_H / 2
}

/** 跨车道转折线：三次贝塞尔，控制点各占半个行高，形成 S 形，与 gitk 视觉一致。 */
function curvePath(from: number, to: number, row: number): string {
  const x1 = laneX(from)
  const y1 = rowY(row)
  const x2 = laneX(to)
  const y2 = rowY(row + 1)
  const half = ROW_H / 2
  return `M${x1} ${y1} C${x1} ${y1 + half} ${x2} ${y2 - half} ${x2} ${y2}`
}

interface GraphProps {
  t: (key: string) => string
  graph: RepoGraphView | null
  loading: boolean
  error: string
}

function GraphView({ t, graph, loading, error }: GraphProps) {
  const [active, setActive] = useState<string>('')
  const [copied, setCopied] = useState('')

  const rows = graph?.rows ?? []
  const laneCount = Math.max(1, graph?.laneCount ?? 1)
  const width = LANE_PAD * 2 + (laneCount - 1) * LANE_W
  const height = Math.max(ROW_H, rows.length * ROW_H)
  const selected = rows.find((item) => item.hash === active) ?? null

  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(hash)
      window.setTimeout(() => setCopied(''), 1500)
    } catch {
      setCopied('')
    }
  }

  if (loading && !graph) {
    return (
      <div className="dgp-graph">
        <div className="dgp-graph-head">
          <span>{t('graphTitle')}</span>
        </div>
        <div className="dgp-graph-note">{t('graphLoading')}</div>
      </div>
    )
  }

  if (error.length > 0) {
    return (
      <div className="dgp-graph">
        <div className="dgp-graph-head">
          <span>{t('graphTitle')}</span>
        </div>
        <div className="dgp-graph-note" data-tone="error">
          {t('graphFailed')}：{error}
        </div>
      </div>
    )
  }

  if (!graph || rows.length === 0) {
    return (
      <div className="dgp-graph">
        <div className="dgp-graph-head">
          <span>{t('graphTitle')}</span>
        </div>
        <div className="dgp-graph-note">{t('graphEmpty')}</div>
      </div>
    )
  }

  return (
    <div className="dgp-graph">
      <div className="dgp-graph-head">
        <span>{t('graphTitle')}</span>
        <span className="dgp-graph-meta">
          {t('graphLanes').replace('{n}', String(laneCount))}
          {graph.truncated ? ` · ${t('graphTruncated').replace('{n}', String(rows.length))}` : ''}
        </span>
      </div>
      <div className="dgp-graph-body">
        <svg className="dgp-graph-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {/* 先画线，再画节点：节点盖在连线之上，交叉处不会糊。 */}
          {rows.map((item) =>
            item.through.map((lane) => (
              <line
                key={`t-${item.row}-${lane}`}
                className="dgp-graph-line"
                x1={laneX(lane)}
                y1={rowY(item.row)}
                x2={laneX(lane)}
                y2={rowY(item.row + 1)}
                stroke={laneColor(lane)}
              />
            )),
          )}
          {rows.map((item) =>
            item.segments.map((seg) =>
              // 同车道：垂直直落；跨车道：S 形贝塞尔。两种都用 stroke 上色，交接处不跳色。
              seg.from === seg.to ? (
                <line
                  key={`s-${item.row}-${seg.from}-${seg.to}`}
                  className="dgp-graph-line"
                  x1={laneX(seg.from)}
                  y1={rowY(item.row)}
                  x2={laneX(seg.to)}
                  y2={rowY(item.row + 1)}
                  stroke={laneColor(seg.from)}
                />
              ) : (
                <path
                  key={`s-${item.row}-${seg.from}-${seg.to}`}
                  className="dgp-graph-line"
                  d={curvePath(seg.from, seg.to, item.row)}
                  stroke={laneColor(seg.to)}
                />
              ),
            ),
          )}
          {rows.map((item) => {
            const isHead = item.refs.some((ref) => ref.kind === 'head')
            return (
              <circle
                key={`d-${item.hash}`}
                className="dgp-graph-dot"
                cx={laneX(item.lane)}
                cy={rowY(item.row)}
                r={isHead ? DOT_R + 1.4 : DOT_R}
                fill={laneColor(item.lane)}
              />
            )
          })}
          {/* HEAD 外环：与「当前分支」区分开，只用描边不填充，避免抢眼。 */}
          {rows
            .filter((item) => item.refs.some((ref) => ref.kind === 'head'))
            .map((item) => (
              <circle
                key={`h-${item.hash}`}
                cx={laneX(item.lane)}
                cy={rowY(item.row)}
                r={DOT_R + 4}
                fill="none"
                stroke={laneColor(item.lane)}
                strokeWidth="1"
                opacity="0.45"
              />
            ))}
        </svg>

        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          {rows.map((item) => {
            const isHead = item.refs.some((ref) => ref.kind === 'head')
            return (
              <div
                key={`r-${item.hash}`}
                className="dgp-graph-row"
                data-active={active === item.hash ? '1' : '0'}
                data-current={isHead ? '1' : '0'}
                title={`${item.short} · ${item.author} · ${item.date}\n${item.subject}`}
                onMouseEnter={() => setActive(item.hash)}
                onMouseLeave={() => setActive((current) => (current === item.hash ? '' : current))}
                onClick={() => setActive(item.hash)}
              >
                <span className="dgp-graph-main">
                  <span className="dgp-graph-subject">{item.subject || item.short}</span>
                  <span className="dgp-graph-sub">
                    <span className="dgp-graph-hash">{item.short}</span>
                    <span className="dgp-graph-author">
                      {item.author} · {item.date}
                    </span>
                  </span>
                </span>
                {item.refs.length > 0 ? (
                  <span className="dgp-graph-refs">
                    {item.refs.slice(0, 3).map((ref) => (
                      <span key={`${item.hash}-${ref.kind}-${ref.name}`} className="dgp-graph-ref" data-kind={ref.kind} title={ref.name}>
                        {ref.name}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {selected ? (
        <div className="dgp-graph-detail">
          <span className="dgp-graph-detail-text" title={`${selected.hash}\n${selected.subject}`}>
            {selected.short} · {selected.author} · {selected.date}
          </span>
          <button
            type="button"
            className="dgp-graph-copy"
            title={copied === selected.hash ? t('graphCopied') : t('graphCopyHash')}
            aria-label={t('graphCopyHash')}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void copyHash(selected.hash)}
          >
            <CopyIcon />
          </button>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* composer 状态 chip（opencode 风格）                                  */
/* ------------------------------------------------------------------ */

interface ChipProps {
  t: (key: string) => string
  sessionId?: string
  sessions?: any
  shortcuts?: { registry?: { invoke?: (id: string, context: any) => void } }
}

interface MenuAnchor {
  left: number
  /** 上方空间不足时翻到 chip 下方，此时用 top 而非 bottom。 */
  top?: number
  bottom?: number
}

interface Note {
  tone: 'error' | 'ok' | 'plain'
  text: string
}

function BranchChip({ t, sessionId, sessions, shortcuts }: ChipProps) {
  useStyles()
  const [status, setStatus] = useState<RepoStatusView | null>(null)
  const [graph, setGraph] = useState<RepoGraphView | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState('')
  const [detectError, setDetectError] = useState('')
  const [checking, setChecking] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note | null>(null)
  const [anchor, setAnchor] = useState<MenuAnchor>({ left: 0, bottom: 0 })
  const wrapRef = useRef<HTMLSpanElement | null>(null)
  const menuRef = useRef<HTMLSpanElement | null>(null)

  // 会话列表变化（切换项目/会话）时立刻重算 cwd：不能沿用上一个项目的检测结果。
  const cwd = useSyncExternalStore(
    useMemo(() => {
      return (listener: () => void) => {
        try {
          const list = sessions?.list
          return typeof list?.subscribe === 'function' ? list.subscribe(listener) : () => {}
        } catch {
          return () => {}
        }
      }
    }, [sessions]),
    useCallback(() => {
      try {
        if (!sessionId || !sessions) return ''
        const value = sessions.list?.getSnapshot?.()?.byId?.[sessionId]?.cwd
        return typeof value === 'string' ? value : ''
      } catch {
        return ''
      }
    }, [sessionId, sessions]),
    () => '',
  )

  const reload = useCallback(async (): Promise<void> => {
    if (!cwd) {
      setStatus(null)
      setDetectError('')
      return
    }
    setChecking(true)
    try {
      const data = await api<{ ok: boolean; status?: RepoStatusView; error?: string }>(
        `/repo/status?cwd=${encodeURIComponent(cwd)}`,
      )
      if (data.ok && data.status) {
        setStatus(data.status)
        setDetectError('')
      } else {
        // 接口正常但拿不到状态：视为检测失败，明确告知而不是当成「不是仓库」。
        setStatus(null)
        setDetectError(data.error || t('menuDetectFailed'))
      }
    } catch (error) {
      setStatus(null)
      setDetectError((error as Error).message || t('menuDetectFailed'))
    } finally {
      setChecking(false)
    }
  }, [cwd, t])

  // 提交图只在「确实是仓库」时才拉，且与状态检测解耦：状态失败不影响图，
  // 图失败也不把整体判成检测失败（避免一个只读接口拖垮 chip 主状态）。
  const loadGraph = useCallback(async (): Promise<void> => {
    if (!cwd) {
      setGraph(null)
      setGraphError('')
      return
    }
    setGraphLoading(true)
    try {
      const data = await api<{ ok: boolean; graph?: RepoGraphView; error?: string }>(
        `/repo/graph?cwd=${encodeURIComponent(cwd)}&limit=30`,
      )
      if (data.ok && data.graph) {
        setGraph(data.graph)
        setGraphError('')
      } else {
        setGraph(null)
        setGraphError(data.error || t('graphFailed'))
      }
    } catch (error) {
      setGraph(null)
      setGraphError((error as Error).message || t('graphFailed'))
    } finally {
      setGraphLoading(false)
    }
  }, [cwd, t])

  useEffect(() => {
    // 切换项目/会话时立刻丢弃上一个项目的检测结果，避免沿用旧状态。
    setStatus(null)
    setDetectError('')
    setGraph(null)
    setGraphError('')
    setNote(null)
    if (!cwd) return
    let alive = true
    const load = () => {
      if (alive) void reload()
    }
    load()
    const timer = window.setInterval(load, 15_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [cwd, reload])

  // 提交图随「确认是仓库」加载，不跟随 15s 轮询（历史变化频率低，避免无谓 IO）。
  useEffect(() => {
    if (!cwd) {
      setGraph(null)
      setGraphError('')
      return
    }
    if (!status || !status.isRepo) return
    void loadGraph()
  }, [cwd, status?.isRepo, loadGraph])

  // 点空白 / Esc 关闭菜单
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      const target = event.target instanceof Node ? event.target : null
      if (!target) return
      // 菜单已 portal 到 body，不再位于 wrapRef 内，两处都要放过，否则点菜单项会先被关掉。
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  if (!cwd) return null

  const isRepo = status !== null && status.isRepo
  // 路径非法/不存在属于「检测失败」，不能当成「未初始化」而给出初始化按钮。
  const invalidPath = status !== null && !isRepo && status.reason === 'invalid'
  // reason 缺失（旧版 node 半边）时回退为「不是仓库即可初始化」，不让功能失效。
  const canInit = status !== null && !isRepo && (status.reason ? status.reason === 'no-repo' : true)
  const detectFailed = !isRepo && (detectError.length > 0 || invalidPath)
  const detectMessage = detectError || (invalidPath ? status?.error || '' : '') || t('menuDetectFailed')
  const label = !status
    ? t('entry')
    : status.detached
      ? status.head || 'HEAD'
      : status.branch || status.head || t('entry')
  const aux = isRepo
    ? [status!.ahead > 0 ? `↑${status!.ahead}` : '', status!.behind > 0 ? `↓${status!.behind}` : '', status!.changed > 0 ? `${status!.changed}*` : '']
        .filter(Boolean)
        .join(' ')
    : ''
  const warn = isRepo && status!.authorized === false

  const title = !status
    ? detectFailed
      ? `${t('entryTitle')} · ${t('menuDetectFailed')}`
      : t('entryTitle')
    : isRepo
      ? `${t('entryTitle')}${status.root ? ' · ' + status.root : ''}${warn ? ' · ' + t('unauthorizedRoot') : ''}`
      : detectFailed
        ? `${t('entryTitle')} · ${t('menuDetectFailed')}`
        : `${t('entryTitle')} · ${t('notRepo')}`

  // 菜单定位：优先在 chip 上方展开（composer 贴着窗口底部），上方放不下才翻到下方；
  // 水平方向收敛在视口内。portal 到 body 后与 composer 的包含块彻底无关。
  const placeMenu = useCallback(() => {
    const chip = wrapRef.current?.getBoundingClientRect()
    if (!chip) return
    const menu = menuRef.current?.getBoundingClientRect()
    const gap = 6
    const width = menu?.width && menu.width > 0 ? menu.width : 260
    const height = menu?.height && menu.height > 0 ? menu.height : 260
    const left = Math.min(Math.max(8, chip.left), Math.max(8, window.innerWidth - width - 8))
    const spaceAbove = chip.top - gap
    const spaceBelow = window.innerHeight - chip.bottom - gap
    if (spaceAbove >= height || spaceAbove >= spaceBelow) {
      setAnchor({ left: Math.round(left), bottom: Math.round(window.innerHeight - chip.top + gap) })
    } else {
      setAnchor({ left: Math.round(left), top: Math.round(chip.bottom + gap) })
    }
  }, [])

  // 打开后按真实尺寸再校正一次；窗口变化/滚动时跟随。
  useLayoutEffect(() => {
    if (!open) return
    placeMenu()
    const onMove = () => placeMenu()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open, placeMenu])

  const toggle = () => {
    const next = !open
    if (next) {
      // portal + fixed 定位：脱离 composer 容器（含 container-type 形成的包含块），避免被裁。
      placeMenu()
      setNote(null)
      // 每次打开菜单都重新检测，避免用上一次的结果（尤其切换项目后）。
      void reload()
      // 已确认是仓库时同时刷新提交图（切项目后图也要跟着换）。
      if (status?.isRepo) void loadGraph()
    }
    setOpen(next)
  }

  const runInit = async () => {
    setBusy(true)
    setNote({ tone: 'plain', text: t('initRunning') })
    try {
      const data = await api<{ ok: boolean; error?: string; result?: { created?: boolean; branch?: string } }>('/repo/init', {
        cwd,
        branch: 'main',
      })
      if (data.ok) {
        const branch = data.result?.branch ? ' · ' + data.result.branch : ''
        // created=false 说明这里本来就有仓库（并发/已被别处初始化），不能说成「刚初始化」。
        setNote({
          tone: 'ok',
          text: data.result?.created === false ? `${t('alreadyRepo')}${branch}` : `${t('initDone')}${branch}`,
        })
        await reload()
      } else {
        setNote({ tone: 'error', text: data.error || t('initFailed') })
        // 失败后重查一次，避免界面停留在过期状态（例如目录已被别人初始化）。
        await reload()
      }
    } catch (error) {
      setNote({ tone: 'error', text: `${t('initFailed')}：${(error as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(cwd)
      setNote({ tone: 'ok', text: t('copied') })
    } catch {
      setNote({ tone: 'error', text: cwd })
    }
  }

  const summary = checking && !status
    ? `${cwd} · ${t('menuChecking')}`
    : detectFailed
      ? `${cwd} · ${t('menuDetectFailed')}`
      : !status
        ? cwd
        : isRepo
          ? `${status.root || cwd}${status.branch ? ' · ' + status.branch : status.head ? ' · ' + status.head : ''}`
          : `${cwd} · ${t('notRepo')}`

  return (
    <span className="dgp-root dgp-chip-wrap" ref={wrapRef}>
      <button
        type="button"
        className="dgp-chip"
        data-warn={warn ? '1' : '0'}
        data-norepo={isRepo ? '0' : '1'}
        data-open={open ? '1' : '0'}
        title={title}
        aria-label={`${t('entryTitle')}: ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggle}
      >
        <BranchIcon />
        <span className="dgp-chip-name">{label}</span>
        {aux ? <span className="dgp-chip-aux">{aux}</span> : null}
        {warn ? <Dot state="error" /> : null}
      </button>

      {open
        ? createPortal(
            <span
              className="dgp-portal dgp-menu"
              role="menu"
              ref={menuRef}
              data-graph={isRepo ? '1' : '0'}
              style={{
                left: `${anchor.left}px`,
                ...(anchor.top !== undefined ? { top: `${anchor.top}px` } : { bottom: `${anchor.bottom}px` }),
              }}
            >
          <span className="dgp-menu-head">
            <BranchIcon />
            {t('menuTitle')}
          </span>
          <span className="dgp-menu-sum">{summary}</span>

          {/* 分支拓扑：只有确认是仓库才画图，非仓库/检测失败仍走下面的原有菜单项。 */}
          {isRepo ? (
            <>
              <span className="dgp-menu-sep" />
              <GraphView t={t} graph={graph} loading={graphLoading} error={graphError} />
            </>
          ) : null}

          <span className="dgp-menu-sep" />

          {/* 状态未知：先检测，不猜。 */}
          {!status && !detectFailed ? (
            <span className="dgp-menu-note" data-tone="plain">
              {t('menuChecking')}
            </span>
          ) : null}

          {/* 检测失败：明确告知 + 重试入口，不把它当成「不是仓库」。 */}
          {detectFailed ? (
            <>
              <span className="dgp-menu-note" data-tone="error">
                {t('menuDetectFailed')}：{detectMessage}
              </span>
              <button
                type="button"
                className="dgp-menu-item"
                role="menuitem"
                disabled={checking}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void reload()}
              >
                <RefreshIcon />
                <span className="dgp-menu-item-main">
                  <span className="dgp-menu-item-title">{t('menuRetry')}</span>
                </span>
              </button>
            </>
          ) : null}

          {/* 未初始化（目录存在但没有 .git）：主入口。 */}
          {canInit ? (
            <button
              type="button"
              className="dgp-menu-item"
              role="menuitem"
              data-primary="1"
              disabled={busy}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void runInit()}
            >
              <PlusIcon />
              <span className="dgp-menu-item-main">
                <span className="dgp-menu-item-title">{t('menuInit')}</span>
                <span className="dgp-menu-item-hint">{t('menuInitHint')}</span>
              </span>
            </button>
          ) : null}

          {/* 已初始化：不再出现初始化入口，只给刷新。 */}
          {isRepo ? (
            <button type="button" className="dgp-menu-item" role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => void reload()}>
              <RefreshIcon />
              <span className="dgp-menu-item-main">
                <span className="dgp-menu-item-title">{t('menuRefresh')}</span>
                <span className="dgp-menu-item-hint">{aux || t('alreadyRepo')}</span>
              </span>
            </button>
          ) : null}

          <button type="button" className="dgp-menu-item" role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => void copyPath()}>
            <CopyIcon />
            <span className="dgp-menu-item-main">
              <span className="dgp-menu-item-title">{t('menuCopyPath')}</span>
            </span>
          </button>

          <button
            type="button"
            className="dgp-menu-item"
            role="menuitem"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpen(false)
              void openSettingsSection({ shortcuts }, t('navLabel'))
            }}
          >
            <GearIcon />
            <span className="dgp-menu-item-main">
              <span className="dgp-menu-item-title">{t('menuSettings')}</span>
            </span>
          </button>

          {note ? (
            <>
              <span className="dgp-menu-sep" />
              <span className="dgp-menu-note" data-tone={note.tone}>
                {note.text}
              </span>
            </>
          ) : null}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13 2.8V5.6h-2.8" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="6" width="7" height="7" rx="1.5" />
      <path d="M10 4.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v4.5A1.5 1.5 0 0 0 4 10h.5" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.8v1.4M8 12.8v1.4M2.6 8H1.2M14.8 8h-1.4M4.2 4.2 3.2 3.2M12.8 12.8l-1-1M11.8 4.2l1-1M3.2 12.8l1-1" />
    </svg>
  )
}


interface ClientContext {
  slots?: {
    inject?: (name: string, factory: () => any) => void
    register?: (options: any, component: any) => any
  }
  locale?: { register?: (namespace: string, dicts: Record<string, Dict>) => void; bind?: (namespace: string) => (key: string) => string }
  sessions?: any
  /** 可选服务软取：取不到返回 undefined，不会抛错。 */
  get?: (name: string) => any
  /** 可选服务：宿主快捷键服务，用于程序化触发 settings.open。 */
  shortcuts?: { registry?: { invoke?: (id: string, context: any) => void } }
  logger?: { info?: (msg: string) => void; warn?: (msg: string) => void; error?: (msg: string) => void }
  effect?: (fn: () => void, label?: string) => void
}

export function apply(ctx: ClientContext): void {
  let t: (key: string) => string = (key: string) => ZH[key] ?? key
  try {
    ctx.locale?.register?.(NS, { zh: ZH, en: EN })
    const bound = ctx.locale?.bind?.(NS)
    if (typeof bound === 'function') {
      t = (key: string) => {
        const value = bound(key)
        return typeof value === 'string' && value.length > 0 && value !== key ? value : ZH[key] ?? key
      }
    }
  } catch (error) {
    ctx.logger?.warn?.(`[${NS}] locale 注册失败：${String(error)}`)
  }

  const sessions = ctx.sessions
  // shortcuts 是可选服务：软取，取不到也不影响 chip 渲染，只是「打开 Git 设置」少一条路径。
  const shortcuts = typeof ctx.get === 'function' ? ctx.get('shortcuts') : undefined

  // 1) 设置页分节：全部配置都放这里（账号 / 仓库范围 / 授权说明）。
  try {
    ctx.slots?.inject?.('settings.section', () => {
      try {
        return ctx.slots?.register?.(
          {
            name: 'settings.section',
            id: 'git-panel',
            order: 20,
            label: () => t('navLabel'),
            locale: NS,
            inject: () => ({ t }),
          },
          GitSection,
        )
      } catch (error) {
        ctx.logger?.error?.(`[${NS}] settings.section 注册失败：${String(error)}`)
        return undefined
      }
    })
    ctx.logger?.info?.(`[${NS}] 设置分节已注册（${BUILD}）`)
  } catch (error) {
    ctx.logger?.error?.(`[${NS}] settings.section 注入失败：${String(error)}`)
  }

  // 2) 输入框下方左侧：只显示当前仓库分支（opencode 风格），点击进设置页。
  try {
    ctx.slots?.inject?.('conversation.input.left', () => {
      try {
        return ctx.slots?.register?.(
          {
            name: 'conversation.input.left',
            id: 'dsh-git-panel-branch',
            order: 30,
            locale: NS,
            inject: (sessionId: string) => ({ t, sessionId, sessions, shortcuts }),
          },
          BranchChip,
        )
      } catch (error) {
        ctx.logger?.error?.(`[${NS}] 入口注册失败：${String(error)}`)
        return undefined
      }
    })
    ctx.logger?.info?.(`[${NS}] 分支 chip 已注册到 conversation.input.left（${BUILD}）`)
  } catch (error) {
    ctx.logger?.error?.(`[${NS}] conversation.input.left 注入失败：${String(error)}`)
  }
}
