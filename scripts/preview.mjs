#!/usr/bin/env node
// 视觉验收工具：从构建产物 lib/client.js 里抽出真实 CSS，注入宿主浅/深两套主题 token，
// 渲染静态 HTML 并用本机 Edge 无头截图到 docs/preview/。
// 用法：node scripts/preview.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'docs', 'preview')
const workDir = join(root, '.work', 'preview')

// ---- 1. 取 CSS ------------------------------------------------------------
const bundle = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
const marker = 'var CSS = `'
const start = bundle.indexOf(marker)
const end = bundle.indexOf('`;\nfunction useStyles', start)
if (start < 0 || end < 0) throw new Error('lib/client.js 里找不到 CSS 块，先跑 npm run bundle')
const css = bundle
  .slice(start + marker.length, end)
  .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))

// ---- 2. 宿主主题 token（取自 dsh-client-ui-theme，只保留插件用到的）--------
const LIGHT = `
--dsw-alias-label-primary:#0f1115;--dsw-alias-label-secondary:#61666b;--dsw-alias-label-tertiary:#81858c;
--dsw-alias-label-caption:#adb2b8;--dsw-alias-label-primary-inverted:#fff;
--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#fff;
--dsw-alias-bg-module-platform:#f5f6f7;--dsw-alias-border-l2:#0000001a;--dsw-alias-border-l3:#0000001f;
--dsw-alias-interactive-bg-hover:#2631480f;--dsw-alias-interactive-bg-active:#2631481a;
--dsw-alias-interactive-bg-hover-danger:#ec13130d;--dsw-alias-state-business-primary:#4176e6;
--dsw-alias-state-error-primary:#ec1313;--dsw-alias-state-success-primary:#22c55e;
--dsw-alias-button-primary-fill:#0f1115;--dsw-alias-button-primary-hover:#3c3c3d;--dsw-alias-link:#4176e6;
--dsw-radius-xs:4px;--dsw-radius-sm:8px;--dsw-radius-md:12px;
--ds-ease-in-out:cubic-bezier(.4,0,.2,1);--ds-transition-duration-fast:.1s;
--ds-font-family-code:"SF Mono","JetBrains Mono",Consolas,Menlo,monospace;
--dsw-shadow-lv1:0 2px 4px 0 #0000000d;`

const DARK = `
--dsw-alias-label-primary:#f5f6f7;--dsw-alias-label-secondary:#cfd3d6;--dsw-alias-label-tertiary:#adb2b8;
--dsw-alias-label-caption:#81858c;--dsw-alias-label-primary-inverted:#0f1115;
--dsw-alias-bg-base:#151517;--dsw-alias-bg-layer-1:#232324;--dsw-alias-bg-layer-2:#2c2c2e;
--dsw-alias-bg-module-platform:#353638;--dsw-alias-border-l2:#ffffff1f;--dsw-alias-border-l3:#ffffff29;
--dsw-alias-interactive-bg-hover:#ffffff14;--dsw-alias-interactive-bg-active:#ffffff24;
--dsw-alias-interactive-bg-hover-danger:#f25a5a26;--dsw-alias-state-business-primary:#7aaaff;
--dsw-alias-state-error-primary:#f25a5a;--dsw-alias-state-success-primary:#22c55e;
--dsw-alias-button-primary-fill:#f5f6f7;--dsw-alias-button-primary-hover:#fff;--dsw-alias-link:#7aaaff;
--dsw-radius-xs:4px;--dsw-radius-sm:8px;--dsw-radius-md:12px;
--ds-ease-in-out:cubic-bezier(.4,0,.2,1);--ds-transition-duration-fast:.1s;
--ds-font-family-code:"SF Mono","JetBrains Mono",Consolas,Menlo,monospace;
--dsw-shadow-lv1:0 2px 4px 0 #00000026;`

// ---- 3. 各 tab 的静态样张 -------------------------------------------------
const ICON =
  '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.8" cy="3.6" r="1.5"/><circle cx="4.8" cy="12.4" r="1.5"/><circle cx="11.2" cy="6.2" r="1.5"/><path d="M4.8 5.1v5.8"/><path d="M11.2 7.7v.5a2.5 2.5 0 0 1-2.5 2.5H6.3"/></svg>'

const head = (active) => `
  <div class="dgp-head">
    <div>
      <div class="dgp-title"><span class="dgp-dot" data-state="connected"></span>Git 账号与仓库授权</div>
      <div class="dgp-sub">连接账号，并限定 Agent 可以触达的仓库与目录</div>
    </div>
    <div class="dgp-tabs">
      <button class="dgp-tab" data-on="${active === 'accounts' ? 1 : 0}">账号</button>
      <button class="dgp-tab" data-on="${active === 'scope' ? 1 : 0}">仓库范围</button>
      <button class="dgp-tab" data-on="${active === 'help' ? 1 : 0}">授权说明</button>
    </div>
  </div>`

const accountsTab = `
<div class="dgp-root dgp-section">
  ${head('accounts')}
  <div class="dgp-group">
    <div class="dgp-group-title">已连接</div>
    <div class="dgp-line">
      <div class="dgp-line-main">
        <div class="dgp-row">
          <span class="dgp-dot" data-state="connected"></span>
          <span class="dgp-name">octocat</span>
          <span class="dgp-badge">github</span>
          <span class="dgp-badge" data-tone="mono">PAT</span>
          <span class="dgp-badge" data-state="connected">已连接</span>
        </div>
        <div class="dgp-meta"><span>github.com</span><code>repo read:user</code></div>
      </div>
      <div class="dgp-line-side">
        <button class="dgp-btn ghost">校验</button>
        <button class="dgp-btn danger">断开</button>
      </div>
    </div>
    <div class="dgp-line">
      <div class="dgp-line-main">
        <div class="dgp-row">
          <span class="dgp-dot" data-state="expired"></span>
          <span class="dgp-name">dev@gitlab</span>
          <span class="dgp-badge">gitlab</span>
          <span class="dgp-badge" data-tone="mono">OAuth</span>
          <span class="dgp-badge" data-state="expired">授权已失效</span>
        </div>
        <div class="dgp-err">令牌已过期（HTTP 401）：请重新授权后再试。</div>
      </div>
      <div class="dgp-line-side">
        <button class="dgp-btn ghost">校验</button>
        <button class="dgp-btn danger">断开</button>
      </div>
    </div>
  </div>
  <div class="dgp-group">
    <div class="dgp-group-title">连接新账号</div>
    <div class="dgp-field">
      <label class="dgp-label">平台</label>
      <select class="dgp-select"><option>GitHub</option></select>
    </div>
    <div class="dgp-field">
      <label class="dgp-label">接入方式</label>
      <div class="dgp-seg"><button data-on="1">个人访问令牌（PAT）</button><button data-on="0">OAuth 设备码</button></div>
      <div class="dgp-hint">适合无人值守 / CI / 自建实例：可精确限制到单个仓库与只读 scope，令牌只在本机加密保存。</div>
    </div>
    <div class="dgp-field">
      <label class="dgp-label">访问令牌</label>
      <input class="dgp-input" type="password" value="ghp_xxxxxxxxxxxxxxxxxxxx" />
      <div class="dgp-hint"><a class="dgp-link" href="#">https://github.com/settings/tokens</a></div>
    </div>
    <div class="dgp-field" style="border-bottom:none;padding-bottom:0">
      <div class="dgp-row"><button class="dgp-btn primary">连接</button></div>
    </div>
  </div>
</div>`

const scopeTab = `
<div class="dgp-root dgp-section">
  ${head('scope')}
  <div class="dgp-group">
    <div class="dgp-group-title">远端仓库</div>
    <div class="dgp-field">
      <label class="dgp-label">允许 Agent 操作的远端仓库</label>
      <textarea class="dgp-area">octocat/Hello-World
deepseek-ai/dsh</textarea>
      <div class="dgp-hint">每行一个 owner/repo；填 * 表示全部仓库（不推荐）。留空表示不允许任何远端操作。</div>
    </div>
  </div>
  <div class="dgp-group">
    <div class="dgp-group-title">本地目录</div>
    <div class="dgp-field">
      <label class="dgp-label">允许 Agent 操作的本地仓库目录</label>
      <textarea class="dgp-area">D:\\my-projects\\plugins\\dsh-git-panel</textarea>
      <div class="dgp-hint">每行一个绝对路径。本地 git 命令只会在这些目录（含子目录）内执行。</div>
    </div>
  </div>
  <div class="dgp-group">
    <div class="dgp-group-title">写操作策略</div>
    <label class="dgp-check">
      <input type="checkbox" />
      <span class="dgp-check-body">
        <span class="dgp-check-title">允许 Agent 修改仓库</span>
        <span class="dgp-hint" style="margin-top:0">开启后 Agent 可执行 add/commit/checkout 等写操作；关闭时全部写操作会被拒绝。</span>
      </span>
    </label>
    <label class="dgp-check">
      <input type="checkbox" checked />
      <span class="dgp-check-body">
        <span class="dgp-check-title">写操作前需要我确认</span>
        <span class="dgp-hint" style="margin-top:0">开启后 Agent 每次写操作都会先返回待确认信息，需你同意后才真正执行。</span>
      </span>
    </label>
    <div class="dgp-line" style="border-bottom:none;justify-content:flex-start;gap:10px">
      <button class="dgp-btn primary">保存范围</button>
      <span class="dgp-ok" style="margin-top:0">已保存</span>
    </div>
  </div>
</div>`

const helpTab = `
<div class="dgp-root dgp-section">
  ${head('help')}
  <div class="dgp-group" style="padding-top:16px">
    <div class="dgp-card">
      <div class="dgp-hint" style="margin-top:0;line-height:19px">Agent 只能读取「仓库范围」里列出的仓库与目录；未授权、授权失效、仓库不存在或 git 命令失败时，工具都会返回可读原因，不会静默失败。令牌以 AES-256-GCM 加密保存在本机，界面与日志中不会出现明文。</div>
      <div class="dgp-sep"></div>
      <dl class="dgp-kv">
        <dt>OAuth 设备码</dt><dd>本机交互式使用：浏览器打开一次授权页、输入代码即可，无需复制令牌。</dd>
        <dt>个人访问令牌</dt><dd>无人值守 / CI / 自建实例：可精确限制到单个仓库与只读 scope。</dd>
        <dt>保存位置</dt><dd><code>~/.dsh/git-panel/state.json</code></dd>
      </dl>
    </div>
  </div>
</div>`

const chipSample = `
<div class="dgp-root" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l2)">
  <button class="dgp-root dgp-chip">${ICON}<span class="dgp-chip-name">main</span><span class="dgp-chip-aux">↑2 ↓1 3*</span></button>
  <button class="dgp-root dgp-chip">${ICON}<span class="dgp-chip-name">feature/redesign-settings-section</span></button>
  <button class="dgp-root dgp-chip">${ICON}<span class="dgp-chip-name">a1b2c3d</span></button>
  <button class="dgp-root dgp-chip" data-warn="1">${ICON}<span class="dgp-chip-name">main</span><span class="dgp-chip-aux">未授权</span></button>
  <button class="dgp-root dgp-chip" data-norepo="1">${ICON}<span class="dgp-chip-name">Git</span></button>
</div>`

const menuSample = `
<div class="dgp-root" style="position:relative;height:340px;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l2)">
  <div class="dgp-chip-wrap" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px">
    <button class="dgp-root dgp-chip" data-norepo="1" data-open="1">${ICON}<span class="dgp-chip-name">Git</span></button>
    <span class="dgp-portal dgp-menu" role="menu" style="position:static">
      <span class="dgp-menu-head">${ICON}Repository</span>
      <span class="dgp-menu-sum">~/projects/example-repo · not a Git repository</span>
      <span class="dgp-menu-sep"></span>
      <button class="dgp-menu-item" data-primary="1"><span class="dgp-menu-item-main"><span class="dgp-menu-item-title">Initialize Git project</span><span class="dgp-menu-item-hint">Creates only the .git directory; existing files are kept as-is</span></span></button>
      <span class="dgp-menu-sep"></span>
      <button class="dgp-menu-item"><span class="dgp-menu-item-main"><span class="dgp-menu-item-title">Open Git settings</span></span></button>
    </span>
  </div>
</div>`

// ---- 分支拓扑样例：与 layoutGraph 同几何（车道 13px / 行高 26px / 节点半径 4px）----
// 手工展开一个「main + feat/a 分叉后 --no-ff 汇合」的四行图，用来肉眼验收车道与转折线。
const GRAPH_ROWS = [
  { y: 17, lane: 0, short: '7f3c1ab', subject: 'merge feat/a', refs: [{ name: 'HEAD -> main', kind: 'head' }, { name: 'main', kind: 'local' }] },
  { y: 51, lane: 0, short: '2b8d904', subject: 'main: second commit', refs: [] },
  { y: 85, lane: 1, short: 'c41e7f2', subject: 'feat: second commit', refs: [{ name: 'feat/a', kind: 'local' }] },
  { y: 119, lane: 0, short: 'a10ff33', subject: 'main: first commit', refs: [] },
]
const graphSample = `
<div class="dgp-root" style="padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l2)">
  <div class="dgp-portal dgp-graph">
    <div class="dgp-graph-head"><span>Branch topology</span><span class="dgp-graph-meta">2 lanes</span></div>
    <div class="dgp-graph-body" style="display:flex;align-items:flex-start">
      <svg class="dgp-graph-svg" width="31" height="136" viewBox="0 0 31 136" aria-hidden="true">
        <line class="dgp-graph-line" x1="9" y1="17" x2="9" y2="51" stroke="var(--dgp-lane-0)" />
        <line class="dgp-graph-line" x1="22" y1="51" x2="22" y2="85" stroke="var(--dgp-lane-1)" />
        <line class="dgp-graph-line" x1="9" y1="51" x2="9" y2="119" stroke="var(--dgp-lane-0)" />
        <path class="dgp-graph-line" d="M9 17 C9 34 22 68 22 85" stroke="var(--dgp-lane-1)" />
        <path class="dgp-graph-line" d="M22 85 C22 102 9 102 9 119" stroke="var(--dgp-lane-0)" />
        <circle class="dgp-graph-dot" cx="9" cy="17" r="5.4" fill="var(--dgp-lane-0)" />
        <circle class="dgp-graph-dot" cx="9" cy="51" r="4" fill="var(--dgp-lane-0)" />
        <circle class="dgp-graph-dot" cx="22" cy="85" r="4" fill="var(--dgp-lane-1)" />
        <circle class="dgp-graph-dot" cx="9" cy="119" r="4" fill="var(--dgp-lane-0)" />
        <circle cx="9" cy="17" r="8" fill="none" stroke="var(--dgp-lane-0)" stroke-width="1" opacity=".45" />
      </svg>
      <div style="min-width:0;flex:1 1 auto">
        ${GRAPH_ROWS.map(
          (row, index) => `<div class="dgp-graph-row" data-active="${index === 2 ? '1' : '0'}" data-current="${index === 0 ? '1' : '0'}">
          <span class="dgp-graph-main">
            <span class="dgp-graph-subject">${row.subject}</span>
            <span class="dgp-graph-sub"><span class="dgp-graph-hash">${row.short}</span><span class="dgp-graph-author">Test User · 2026-10-29</span></span>
          </span>
          ${row.refs.map((ref) => `<span class="dgp-graph-refs"><span class="dgp-graph-ref" data-kind="${ref.kind}">${ref.name}</span></span>`).join('')}
        </div>`,
        ).join('')}
      </div>
    </div>
    <div class="dgp-graph-detail">
      <span class="dgp-graph-detail-text">c41e7f2 · Test User · 2026-10-29</span>
      <button class="dgp-graph-copy" aria-label="Copy hash">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.6"/><path d="M10.5 5.5V3.6A1.6 1.6 0 0 0 8.9 2H3.6A1.6 1.6 0 0 0 2 3.6v5.3a1.6 1.6 0 0 0 1.6 1.6h1.9"/></svg>
      </button>
    </div>
  </div>
</div>`

// ---- 4. 新增样张的兜底 CSS -------------------------------------------------
// 本次 UI 增强的新 class（dgp-stats / dgp-changes / dgp-toast / dgp-empty / dgp-skel）
// 由 Lead 在 src/client/index.tsx 里实现，产物 lib/client.js 里的 CSS 可能还没同步。
// 这里先写一份中性兜底样式，且**放在产物 CSS 之前**：产物里一旦出现同规则，以后者为准。
// 兜底只用宿主 token 与中性色，不臆造品牌色，避免和最终实现打架。
const FALLBACK_CSS = `
.dgp-stats{display:flex;flex-wrap:wrap;gap:10px}
.dgp-stat{flex:1 1 150px;min-width:0;padding:10px 12px;border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2)}
.dgp-stat-label{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.dgp-stat-value{font-size:20px;font-weight:600;line-height:26px;color:var(--dsw-alias-label-primary)}
.dgp-stat-hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgp-stat[data-tone="ok"] .dgp-stat-value{color:var(--dsw-alias-state-success-primary)}
.dgp-stat[data-tone="warn"] .dgp-stat-value{color:#d29922}
.dgp-stat[data-tone="danger"] .dgp-stat-value{color:var(--dsw-alias-state-error-primary)}

.dgp-changes{display:flex;flex-direction:column}
.dgp-changes-head{display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:6px 2px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);
  border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dgp-changes-count{flex:0 0 auto;color:var(--dsw-alias-label-caption)}
.dgp-change{display:flex;align-items:center;gap:8px;padding:5px 2px;
  font-size:12px;line-height:18px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dgp-change:last-child{border-bottom:none}
.dgp-change-code{flex:0 0 auto;width:20px;text-align:center;
  font-family:var(--ds-font-family-code);font-size:11px;color:var(--dsw-alias-label-secondary)}
.dgp-change-code[data-code="M"]{color:var(--dsw-alias-state-business-primary)}
.dgp-change-code[data-code="A"]{color:var(--dsw-alias-state-success-primary)}
.dgp-change-code[data-code="D"]{color:var(--dsw-alias-state-error-primary)}
.dgp-change-code[data-code="??"]{color:var(--dsw-alias-label-caption)}
.dgp-change-path{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:var(--ds-font-family-code);font-size:11.5px;color:var(--dsw-alias-label-primary)}
.dgp-change-stat{flex:0 0 auto;font-family:var(--ds-font-family-code);font-size:11px}
.dgp-change-stat[data-sign="add"]{color:var(--dsw-alias-state-success-primary)}
.dgp-change-stat[data-sign="del"]{color:var(--dsw-alias-state-error-primary)}
.dgp-change[data-staged="1"]{background:var(--dsw-alias-interactive-bg-hover)}

.dgp-toast-wrap{display:flex;justify-content:flex-end}
.dgp-toast{display:flex;align-items:center;gap:8px;margin:4px 0;padding:8px 12px;max-width:100%;
  border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2);
  border:.5px solid var(--dsw-alias-border-l3);box-shadow:var(--dsw-shadow-lv1);
  font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary)}
.dgp-toast-dot{flex:0 0 auto;width:6px;height:6px;border-radius:50%;
  background:var(--dsw-alias-label-tertiary)}
.dgp-toast[data-tone="ok"] .dgp-toast-dot{background:var(--dsw-alias-state-success-primary)}
.dgp-toast[data-tone="error"] .dgp-toast-dot{background:var(--dsw-alias-state-error-primary)}
.dgp-toast[data-tone="info"] .dgp-toast-dot{background:var(--dsw-alias-state-business-primary)}
.dgp-toast-text{min-width:0}

.dgp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  padding:28px 20px;text-align:center;color:var(--dsw-alias-label-tertiary)}
.dgp-empty-art{color:var(--dsw-alias-label-caption)}
.dgp-empty-title{font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dgp-empty-hint{font-size:12px;line-height:19px;color:var(--dsw-alias-label-caption);max-width:420px}

.dgp-skel{display:flex;flex-direction:column;gap:8px;padding:6px 2px}
.dgp-skel-line{height:10px;border-radius:5px;background:var(--dsw-alias-interactive-bg-hover)}
`

// ---- 5. 本次 UI 增强新增的样张 ---------------------------------------------
// 类名契约与 Lead 的实现一一对应；这里只负责把静态结构摆出来供肉眼验收。

// 设置页顶部「授权概览」统计条
const statsSample = `
<div class="dgp-stats">
  <div class="dgp-stat">
    <div class="dgp-stat-label">已连接账号</div>
    <div class="dgp-stat-value">2</div>
    <div class="dgp-stat-hint">1 个已失效</div>
  </div>
  <div class="dgp-stat" data-tone="warn">
    <div class="dgp-stat-label">授权目录</div>
    <div class="dgp-stat-value">3</div>
    <div class="dgp-stat-hint">D:\\work</div>
  </div>
  <div class="dgp-stat" data-tone="ok">
    <div class="dgp-stat-label">授权仓库</div>
    <div class="dgp-stat-value">*</div>
    <div class="dgp-stat-hint">全部仓库</div>
  </div>
  <div class="dgp-stat" data-tone="danger">
    <div class="dgp-stat-label">写操作</div>
    <div class="dgp-stat-value">关</div>
    <div class="dgp-stat-hint">需二次确认</div>
  </div>
</div>`

// chip 菜单里的「工作区改动」区块（含一条已暂存项）
const changesSample = `
<div class="dgp-changes">
  <div class="dgp-changes-head">
    <span>工作区改动</span>
    <span class="dgp-changes-count">4 个文件</span>
  </div>
  <div class="dgp-change">
    <span class="dgp-change-code" data-code="M">M</span>
    <span class="dgp-change-path">src/client/index.tsx</span>
    <span class="dgp-change-stat" data-sign="add">+128</span>
    <span class="dgp-change-stat" data-sign="del">-36</span>
  </div>
  <div class="dgp-change" data-staged="1">
    <span class="dgp-change-code" data-code="A">A</span>
    <span class="dgp-change-path">docs/enhancement-plan.md</span>
    <span class="dgp-change-stat" data-sign="add">+412</span>
  </div>
  <div class="dgp-change">
    <span class="dgp-change-code" data-code="??">??</span>
    <span class="dgp-change-path">.work/tmp.log</span>
    <span class="dgp-change-stat" data-sign="add">+17</span>
  </div>
  <div class="dgp-change">
    <span class="dgp-change-code" data-code="D">D</span>
    <span class="dgp-change-path">scripts/legacy.mjs</span>
    <span class="dgp-change-stat" data-sign="del">-88</span>
  </div>
</div>`

// 右下角轻量通知（成功 / 失败两种）
const toastSample = `
<div class="dgp-portal dgp-toast-wrap">
  <div class="dgp-toast" data-tone="ok">
    <span class="dgp-toast-dot"></span>
    <span class="dgp-toast-text">已保存仓库范围</span>
  </div>
</div>
<div class="dgp-portal dgp-toast-wrap">
  <div class="dgp-toast" data-tone="error">
    <span class="dgp-toast-dot"></span>
    <span class="dgp-toast-text">令牌已过期（HTTP 401）：请重新授权后再试。</span>
  </div>
</div>`

// 空状态（图形化 + 文案 + 次要说明）
const emptySample = `
<div class="dgp-empty">
  <svg class="dgp-empty-art" width="88" height="60" viewBox="0 0 88 60" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6" y="8" width="34" height="44" rx="6"/>
    <path d="M15 22h16M15 30h16M15 38h10"/>
    <path d="M52 30h14M59 23v14"/>
    <circle cx="66" cy="30" r="13" stroke-dasharray="3 4"/>
  </svg>
  <div class="dgp-empty-title">尚未连接任何 Git 账号</div>
  <div class="dgp-empty-hint">连接后，Agent 才能在授权范围内读取仓库信息、分支、差异与提交记录。</div>
</div>`

// 骨架屏（改动列表加载中）
const skeletonSample = `
<div class="dgp-skel">
  <div class="dgp-skel-line" style="width:62%"></div>
  <div class="dgp-skel-line" style="width:44%"></div>
  <div class="dgp-skel-line" style="width:78%"></div>
</div>`

// ---- 6. 拼页面 ------------------------------------------------------------
// 宿主设置面板 800px - 导航 188px - 左右 padding 24px×2 = 612px 内容宽
const CONTENT_WIDTH = 612
// 新增样张按「设置页宽档」出图（720px 画布），toast 用小画布
const WIDE_WIDTH = 720
const TOAST_WIDTH = 360
// toast 在真实页面里是 fixed 定位（右下角），预览时改成静态流式排版，否则会被画布裁掉。
const TOAST_PREVIEW_CSS = `
.dgp-toast-wrap{position:static;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.dgp-toast{max-width:100%;white-space:normal;animation:none}
.dgp-toast-text{white-space:normal}`

function page(dark, body, { width = CONTENT_WIDTH, extraCss = '' } = {}) {
  const tokens = dark ? DARK : LIGHT
  const bg = dark ? '#151517' : '#ffffff'
  return `<!doctype html><meta charset="utf-8"><style>
:root{${tokens}}
html,body{margin:0;background:${bg};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.wrap{width:${width}px;padding:0 24px 24px;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2)}
h3{font:500 11px/16px inherit;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-caption);margin:0;padding:20px 0 6px}
/* 兜底 CSS 放在产物 CSS 之前：产物里有同规则时以产物为准 */
${FALLBACK_CSS}
${css}
${extraCss}
</style><div class="wrap">${body}</div>`
}

const shots = [
  {
    name: 'light',
    dark: false,
    width: CONTENT_WIDTH,
    height: 2400,
    body: `<h3>accounts</h3>${accountsTab}<h3>scope</h3>${scopeTab}<h3>authorization</h3>${helpTab}<h3>composer chip</h3>${chipSample}`,
  },
  {
    name: 'dark',
    dark: true,
    width: CONTENT_WIDTH,
    height: 2400,
    body: `<h3>accounts</h3>${accountsTab}<h3>scope</h3>${scopeTab}<h3>authorization</h3>${helpTab}<h3>composer chip</h3>${chipSample}`,
  },
  {
    name: 'tail-light',
    dark: false,
    width: CONTENT_WIDTH,
    height: 1500,
    body: `<h3>authorization tab</h3>${helpTab}<h3>composer chip</h3>${chipSample}<h3>chip menu</h3>${menuSample}<h3>branch topology</h3>${graphSample}`,
  },
  {
    name: 'tail-dark',
    dark: true,
    width: CONTENT_WIDTH,
    height: 1500,
    body: `<h3>authorization tab</h3>${helpTab}<h3>composer chip</h3>${chipSample}<h3>chip menu</h3>${menuSample}<h3>branch topology</h3>${graphSample}`,
  },
  // ---- 本次 UI 增强新增样张：每个都出浅色 / 深色两版 ----
  {
    name: 'stats-light',
    dark: false,
    width: WIDE_WIDTH,
    height: 320,
    body: `<h3>授权概览</h3>${statsSample}`,
  },
  {
    name: 'stats-dark',
    dark: true,
    width: WIDE_WIDTH,
    height: 320,
    body: `<h3>授权概览</h3>${statsSample}`,
  },
  {
    name: 'changes-light',
    dark: false,
    width: WIDE_WIDTH,
    height: 480,
    body: `<h3>工作区改动</h3>${changesSample}<h3>骨架屏</h3>${skeletonSample}`,
  },
  {
    name: 'changes-dark',
    dark: true,
    width: WIDE_WIDTH,
    height: 480,
    body: `<h3>工作区改动</h3>${changesSample}<h3>骨架屏</h3>${skeletonSample}`,
  },
  {
    name: 'toast-light',
    dark: false,
    width: TOAST_WIDTH,
    height: 240,
    extraCss: TOAST_PREVIEW_CSS,
    body: `<h3>通知</h3>${toastSample}`,
  },
  {
    name: 'toast-dark',
    dark: true,
    width: TOAST_WIDTH,
    height: 240,
    extraCss: TOAST_PREVIEW_CSS,
    body: `<h3>通知</h3>${toastSample}`,
  },
  {
    name: 'empty-light',
    dark: false,
    width: WIDE_WIDTH,
    height: 400,
    body: `<h3>空状态</h3>${emptySample}`,
  },
  {
    name: 'empty-dark',
    dark: true,
    width: WIDE_WIDTH,
    height: 400,
    body: `<h3>空状态</h3>${emptySample}`,
  },
]

// ---- 5. 渲染 + 截图 -------------------------------------------------------
const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]

function findBrowser() {
  for (const candidate of EDGE_CANDIDATES) {
    try {
      readFileSync(candidate)
      return candidate
    } catch {
      /* 换下一个 */
    }
  }
  return ''
}

const browser = findBrowser()
if (!browser) {
  console.error('[preview] 没找到 Microsoft Edge，跳过截图（HTML 仍已生成）')
}

mkdirSync(outDir, { recursive: true })
mkdirSync(workDir, { recursive: true })

for (const shot of shots) {
  const htmlPath = join(workDir, `${shot.name}.html`)
  writeFileSync(htmlPath, page(shot.dark, shot.body, { width: shot.width, extraCss: shot.extraCss ?? '' }))
  if (!browser) continue
  execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',
      `--window-size=${shot.width},${shot.height}`,
      `--screenshot=${join(outDir, `${shot.name}.png`)}`,
      `file:///${htmlPath.replace(/\\/g, '/')}`,
    ],
    { stdio: 'pipe' },
  )
  console.log(`[preview] ${shot.name}.png`)
}

console.log(`[preview] 完成 → ${outDir}`)
