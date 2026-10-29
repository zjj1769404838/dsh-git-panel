# dsh-git-panel · 产品分析与 UI 增强方案

> 版本：BUILD `dgp-v9` ｜ 基线提交：`a03b54c` ｜ 本轮改动：见第八节
> 适用读者：插件维护者、宿主设置页的设计/审核者

---

## 一、现状分析

### 1.1 形态与边界

插件是 DSH 桌面端 bundle 插件，只有两个半边：

| 半边 | 产物 | 职责 |
| --- | --- | --- |
| node | `lib/index.js` | `webServer` 路由（`/dsh-git-panel/*`）+ 8 个 Agent 工具（`ctx.get('tools').register`） |
| client | `lib/client.js` | 两个 slot 注册：`settings.section`（设置页 `Git` 分节）+ `conversation.input.left`（输入区分支 chip） |

依赖面刻意收敛到零：client 侧的 `react` / `react/jsx-runtime` / `react-dom` 全部 `external`，由宿主提供；不引入任何第三方 UI 库、状态库、图标库。

### 1.2 现有能力盘点

**node 半边**

- `src/node/git.ts`：只读命令白名单（`status/log/diff/show/branch/remote/rev-parse/rev-list/ls-files/tag/describe/blame`）、写命令白名单、危险参数拒绝（`--upload-pack=` / `--exec=` / `--pager=` 等）、`GIT_TERMINAL_PROMPT=0`、30s 超时、`describeFailure()` 把 Git 原始报错翻译成人话。
- `src/node/graph.ts`：分支拓扑的解析与车道布局。
- `src/node/handler.ts`：路由 `/health` `/state` `/providers` `/repo/status` `/repo/graph` `POST /repo/init` `/pat/connect` `/oauth/start` `/oauth/poll` `/accounts/remove` `/accounts/recheck` `/settings`；同源校验 + 256 KiB 请求体上限；未授权目录一律 fail-closed。
- `src/node/store.ts`：账号元数据与授权范围（`allowedRoots` / `allowedRepos` 支持 `*`）、`allowWrite` / `requireConfirm` / `defaultAccountId`。
- `src/node/vault.ts`：AES-256-GCM 落盘 + `redact()` 脱敏。

**client 半边（`src/client/index.tsx`，单文件 ~2600 行）**

- `GitSection`：设置页 `Git` 分节，三个 tab（账号 / 仓库范围 / 授权说明）。
- `BranchChip`：输入框下方左侧的分支状态 chip + 自绘菜单（仓库摘要 / 分支拓扑图 / 初始化 / 刷新 / 复制路径 / 打开设置）。
- `openSettingsSection`：打开宿主设置页的四级降级链路（账号菜单 → 设置按钮 → `shortcuts.invoke` → 合成键盘事件）。
- 样式：单条 `CSS` 模板字符串（`--dgp-*` 变量 + 宿主 `--dsw-alias-*` token + 浅色 fallback），深色主题用 `body[data-ds-dark-theme]` 覆盖。

### 1.3 体验缺口（用户视角的具体抱怨）

| 现象 | 根因 | 现有代码位置 |
| --- | --- | --- |
| 「我现在到底授权到什么程度」要读半屏表单才能判断 | 没有概览层，只有详情表单 | `GitSection` 只渲染 `dgp-group` 行式表单 |
| 保存 / 校验 / 复制的反馈只在按钮附近的一行小字，菜单一关就没了 | 只有 `dgp-menu-note` 静态行 + `window.confirm` | `BranchChip` 的 `note` state、`disconnect` 的 `window.confirm` |
| 想知道「还没提交哪些文件」必须开终端 | node 侧没有工作区改动接口 | `src/node/git.ts` 无 `readRepoChanges` |
| 令牌过期后要重新找平台、找接入方式、填表单 | 重新授权等于从零手填 | `GitSection` 无「重新授权」预填 |
| 多账号时 Agent 到底用哪个说不清 | `defaultAccountId` 存在但界面不暴露 | `SettingsView.defaultAccountId` 未渲染 |
| 授权目录要手打绝对路径，容易打错 | 只有 textarea | `scopeRoots` textarea |
| 加载时白屏/纯文本跳字 | 只有 `loading` 文本 | `GraphView` 的 loading 分支 |

### 1.4 设计取向（沿用，不引入新皮肤）

插件刻意**不做独立品牌色**，所有颜色取宿主 `--dsw-alias-*` token。辨识度靠三件事实现：**语义色映射**（状态码 → 固定语义色）、**排版层级**（等宽 + 数字 tabular-nums + 大写小标签）、**信息密度**（一屏能读完）。浅/深双主题必须同时成立。

---

## 二、建议新增功能列表

> 标记 `[已落地]` 的条目本轮已实现并有回归覆盖；其余为后续排期建议。

### F1 · 授权概览统计条 `[已落地]`

- **目标**：一屏说清「授权到什么程度」，不用逐行读表单。
- **涉及文件**：`src/client/index.tsx`（`GitSection` 统计条 + CSS `.dgp-stats` / `.dgp-stat`）。
- **实现方式**：在错误行下方渲染四格 —— 账号数（副标题区分已连接/异常）、授权目录数（`*` 显示 `∞`）、授权仓库数（`*` 显示 `∞`）、写操作开关（开/关 + 是否需二次确认）。数据全部来自已有的 `PanelState`，不新增接口。
- **用户价值**：把「我配好了吗」这个问题从「读表单」降为「扫一眼」。
- **复杂度 / 优先级**：低（纯前端派生量）/ **P0**。

### F2 · 轻提示 toast `[已落地]`

- **目标**：动作反馈统一、可见、可关闭菜单后仍留存。
- **涉及文件**：`src/client/index.tsx`（`Toast` 组件 + `showToast` 回调 + `ChangesList` 之外的反馈点）。
- **实现方式**：新增 `Toast({tone,text,onDone})`，`createPortal` 挂 `document.body`（脱离 composer 的 layout containment），`role="status" aria-live="polite"`，2.6s 自动消失；`GitSection` 与 `BranchChip` 各持一份 toast state 与定时器 ref，卸载时清理。替换掉 `BranchChip` 原有的 `note`/`setNote` 机制（**保留** `dgp-menu-note` 静态提示行：检测中 / 检测失败属于常驻状态，不是瞬时反馈）。
- **用户价值**：不再需要「点完盯着看有没有变化」。
- **复杂度 / 优先级**：中（跨两个组件的状态收敛）/ **P0**。

### F3 · 工作区改动明细 `[已落地]`

- **目标**：在 chip 菜单里直接看到「哪些文件还没提交」。
- **涉及文件**：`src/node/git.ts`（新增 `readRepoChanges`）、`src/node/handler.ts`（新增 `GET /repo/changes`）、`src/client/index.tsx`（`ChangesList` 组件 + CSS `.dgp-changes`）。
- **实现方式**：node 侧 `git status --porcelain --untracked-files=all` 解析（含 C 风格引号/八进制路径还原、重命名取新路径），`git diff --numstat HEAD` 取增删行（无提交仓库降级 `--cached`），未跟踪文件按行数计入 added（上限 2000 行），按 path 升序、上限 500 条。client 侧渲染状态字母 + 路径 + `+N/-N` + 已暂存标记；加载中骨架屏、无改动空状态插画、未授权目录显式提示「当前目录未在授权范围内」（**不假装干净**）。
- **用户价值**：省掉一次「开终端跑 git status」；未提交风险在入口处就能看见。
- **复杂度 / 优先级**：中（新增一个只读接口 + 一个列表组件）/ **P0**。

### F4 · 默认账号 `[已落地]`

- **目标**：多账号时明确 Agent 用哪个账号。
- **涉及文件**：`src/client/index.tsx`（账号行动作 + `setDefaultAccount`）。node 侧 `store.ts` 已支持 `defaultAccountId`，**无需改动**。
- **实现方式**：账号行在「默认账号」与「设为默认」之间切换；`POST /settings {defaultAccountId}`。
- **用户价值**：消除「Agent 到底拿谁的令牌」的不确定性。
- **复杂度 / 优先级**：低 / **P1**。

### F5 · 重新授权 `[已落地]`

- **目标**：令牌过期后不用重新找平台、重填表单。
- **涉及文件**：`src/client/index.tsx`（账号行「重新授权」按钮 + `reauthTarget` 状态 + `.dgp-callout` 提示条）。
- **实现方式**：点击后自动把 provider / method 切到该账号的取值、清空令牌输入、切回账号 tab，并在连接区顶部显示行内提示条（含平台与登录名，可取消）。
- **用户价值**：恢复授权从「5 步表单」变成「1 次点击 + 粘贴新令牌」。
- **复杂度 / 优先级**：低 / **P1**。

### F6 · 一键授权当前会话仓库 `[已落地]`

- **目标**：消除「手打绝对路径」这一最易错环节。
- **涉及文件**：`src/client/index.tsx`（`scopeCurrent` 按钮 + `rememberCwd`/`recallCwd` 跨组件通道）。
- **实现方式**：composer chip 与设置分节是同 bundle 的两个 slot，宿主未提供跨 slot 传参，故用模块级变量 + `sessionStorage('dgp:cwd')` 双写做通道；设置页读到 cwd 后提供「当前会话仓库」按钮，点击即把该目录追加进 `allowedRoots`（已授权或已设为 `*` 时按钮禁用）。
- **用户价值**：授权目录从「抄路径」变成「点一下」。
- **复杂度 / 优先级**：中（需要自建跨组件通道）/ **P1**。

### F7 · 骨架屏与图形化空状态 `[已落地]`

- **目标**：加载与空态不再是纯文本。
- **涉及文件**：`src/client/index.tsx`（`Skeleton`、`EmptyState` 组件 + CSS `.dgp-skel` / `.dgp-empty`）。
- **实现方式**：骨架屏用 shimmer 渐变 + `@keyframes`，并按 `prefers-reduced-motion` 降级为静态底色；空状态用内联 SVG 线稿（文档 + 加号 + 虚线圆）+ 标题 + 次要说明。
- **用户价值**：降低布局跳动；空态从「一句话」变成「一句话 + 一张图」。
- **复杂度 / 优先级**：低 / **P2**。

### F8 · 改动列表筛选与搜索（建议，未落地）

- **目标**：改动超过 30 个文件时列表仍可用。
- **涉及文件**：`src/client/index.tsx`（`ChangesList` 顶部加过滤行）；必要时 `src/node/git.ts` 支持 `?path=` 过滤参数。
- **实现方式**：纯前端按路径子串过滤 + 状态码过滤（只看已暂存 / 只看未跟踪）；先做前端过滤，不动接口。
- **用户价值**：大仓库里快速定位目标文件。
- **复杂度 / 优先级**：低 / **P2**。

### F9 · 提交历史时间线（建议，未落地）

- **目标**：在 chip 菜单里看到最近提交，而不只看拓扑图。
- **涉及文件**：`src/client/index.tsx`（`ChangesList` 旁新增折叠区）；复用 `git_log` 的能力或新增 `GET /repo/log`。
- **实现方式**：折叠式列表，作者头像占位 + 相对时间；只做只读。
- **用户价值**：省一次「刚才谁改的」。
- **复杂度 / 优先级**：中 / **P2**。

### F10 · 授权范围可视化（建议，未落地）

- **目标**：让 `allowedRoots` 的覆盖面一眼可见。
- **涉及文件**：`src/client/index.tsx`（范围页加一枚 chip 列表，每个路径一枚可删除 chip）。
- **实现方式**：textarea 保留为高级编辑入口，旁边同步渲染 chip 列表；`*` 用一枚「全部」chip 表示。
- **用户价值**：避免「我在 textarea 里改乱了」的焦虑。
- **复杂度 / 优先级**：中 / **P3**。

---

## 三、页面与交互增强方案

### 3.1 设置页 · Git 分节

```
┌──────────────────────────────────────────────────────────────┐
│ ● Git 账号接入                     [账号][仓库范围][授权说明] │  ← 原有 head + tabs
├──────────────────────────────────────────────────────────────┤
│ ⚠ 授权提示（错误行，仅在出错时出现）                          │  ← 原有
├──────────────────────────────────────────────────────────────┤
│ ┌────────┬────────┬────────┬────────┐                        │
│ │ 账号    │ 授权目录│ 授权仓库│ 写操作 │  ← 新增统计条         │
│ │  2     │   3    │   ∞    │  关   │                        │
│ │1个已失效│ D:\work │ 全部   │需二次确认│                      │
│ └────────┴────────┴────────┴────────┘                        │
├──────────────────────────────────────────────────────────────┤
│ 已连接账号                                     ← 分组标题      │
│ ● alice  github  OAuth  已连接   [默认账号][重新授权][校验][断开]│
├──────────────────────────────────────────────────────────────┤
│ 接入新账号                                                  │
│ ┌ 重新授权提示条（点「重新授权」后出现，可取消）────────────┐  │
│ │ 正在重新授权 · github / alice                [取消]      │  │
│ └─────────────────────────────────────────────────────────┘  │
│ 平台 ▾   接入方式 [PAT | OAuth]   令牌 ▭▭▭▭  [连接]         │
└──────────────────────────────────────────────────────────────┘
```

**排版规则**

- 统计条：`grid-template-columns: repeat(auto-fit, minmax(148px, 1fr))`，`gap: 1px` + 底色画分隔线（不画每格边框，避免「四张小卡片」的廉价感）。
- 语义色**只落两处**：左侧 2px 竖色条（`::before`，`top/bottom` 各留 11/12px 内缩）与副标题文字；主数字保持 `--dgp-fg` 中性 —— 这是「宿主设置页安静感」的关键，主数字染色会让页面变成状态仪表盘。
- 数字用等宽字体 + `font-variant-numeric: tabular-nums`，避免数字跳动。

### 3.2 仓库范围页

```
授权目录
┌────────────────────────────────┐
│ D:\my-projects\plugins          │
│ D:\work                        │
└────────────────────────────────┘
[ 当前会话仓库 ]  把当前会话目录加入授权范围
                 D:\my-projects\plugins\dsh-git-panel
```

- 「当前会话仓库」按钮在已授权或已设 `*` 时禁用；点击后 toast 提示并把路径追加进 textarea（**不自动保存**，避免误改授权范围）。
- 授权策略两组开关（允许写操作 / 写操作需二次确认）保持原有勾选样式。

### 3.3 输入区 chip 菜单

```
┌────────────────────────────────────────┐
│ 当前仓库                              │
│ dsh-git-panel                          │
│ ⎇ feat/git-panel-branch-graph  ↑2 ↓1 3*│
├────────────────────────────────────────┤
│ 工作区改动                    4 个文件 │
│ [M] src/client/index.tsx      +128 -36 │
│ [A] docs/enhancement-plan.md    +412   │
│ [??] .work/tmp.log               +17   │
├────────────────────────────────────────┤
│ （分支拓扑图，原有）                    │
├────────────────────────────────────────┤
│ 刷新状态   复制路径   打开 Git 设置     │
└────────────────────────────────────────┘
```

- 改动列表在拓扑图**之上**（先给「现在有事做」的事实，再给历史），加载中用骨架屏占位，无改动时显示图形化空状态 + 「工作区干净」。
- 状态码语义色固定映射：`A` 绿 / `D` 红 / `R`·`C` 紫 / `??` 琥珀 / `M` 中性；路径用等宽字体 + `direction: rtl; text-align: left`（长路径从左侧截断，保留更有信息量的尾部）。
- 未跟踪二进制没有真实行数，显示「—」而不是编造数字。

### 3.4 toast

- 右下角固定浮层，`z-index: 1300`（高于宿主 1100 上限），`pointer-events: none` 不挡操作。
- 三态色点：成功 `--dgp-ok` / 失败 `--dgp-danger` / 信息 `--dgp-accent`，外加一圈 16% 同色柔光环。
- 入场 `transform: translateY(6px) → 0` + 淡入 180ms；`prefers-reduced-motion` 时只淡入不位移。
- **必须带 `dgp-portal` 类**：浮层挂在 `document.body` 上，已脱离 `.dgp-root`，而 `--dgp-*` 变量只在 `.dgp-root` / `.dgp-portal` 上定义 —— 漏掉这个类会让整套样式静默失效（本轮真实踩过）。

---

## 四、实施步骤（按优先级排序）

| 序 | 步骤 | 依赖 | 产出 |
| --- | --- | --- | --- |
| 1 | node 侧新增 `readRepoChanges` + `GET /repo/changes` | — | `src/node/git.ts`、`src/node/handler.ts` |
| 2 | client 侧新增 CSS 变量与五组新 class（stats / callout / empty / skel / changes / toast） | — | `src/client/index.tsx` CSS 块 |
| 3 | 新增 `Skeleton` / `EmptyState` / `Toast` / `ChangesList` 组件 | 步骤 2 | `src/client/index.tsx` |
| 4 | `GitSection` 接入统计条、默认账号、重新授权提示条 | 步骤 3 | `src/client/index.tsx` |
| 5 | `GitSection` 接入「当前会话仓库」快捷授权 + `rememberCwd`/`recallCwd` 通道 | 步骤 4 | `src/client/index.tsx` |
| 6 | `BranchChip` 接入 `/repo/changes`，并把 `note` 机制换成 toast | 步骤 1、3 | `src/client/index.tsx` |
| 7 | 回归扩容：gates 加产物断言、hardening 加 `/repo/changes` 行为回归、preview 加 4 组样张 | 步骤 1–6 | `scripts/gates/run.mjs`、`scripts/test-hardening.mjs`、`scripts/preview.mjs` |
| 8 | README 更新（门禁数字、接口表、能力表、预览图） | 步骤 7 | `README.md` |
| 9 | 本文档 + 提交 | 步骤 8 | `docs/enhancement-plan.md` |

F8 / F9 / F10 属后续排期，不在本轮范围。

---

## 五、涉及文件与改动点清单

| 文件 | 改动 |
| --- | --- |
| `src/node/git.ts` | 新增 `ChangeFile` / `RepoChanges` 接口、`decodeGitPath`（C 风格引号 + 八进制还原）、`splitStatusPath`、`normalizeNumstatPath`、`countFileLines`、`readRepoChanges(cwd)`；`MAX_CHANGE_FILES=500`、`MAX_UNTRACKED_LINES=2000` |
| `src/node/handler.ts` | 新增 `GET /repo/changes`（缺 cwd 400；未授权目录只回空壳；非仓库 `isRepo:false`） |
| `src/client/index.tsx` | `BUILD` → `dgp-v9`；新增 `--dgp-warn` 变量（浅 `#b45309` / 深 `#e9b949`）；新增 `.dgp-stats` `.dgp-stat` `.dgp-callout` `.dgp-empty` `.dgp-skel` `.dgp-changes` `.dgp-toast` CSS 块与 `data-sign="staged"` 规则；新增 `EmptyState` / `Skeleton` / `Toast` / `ChangesList` 组件、`ChangeFileView` / `RepoChangesView` 类型、`fmt()` 与 `rememberCwd()` / `recallCwd()`；`GitSection` 增 `toast` / `reauthTarget` / `currentCwd` 状态与统计条、默认账号、重新授权、当前目录快捷授权；`BranchChip` 增 `changes` / `changesLoading` / `changesError` / `toast` 状态与 `loadChanges()`，移除 `note` 机制 |
| `scripts/gates/run.mjs` | 新增 18 项产物断言（统计条、toast、骨架屏、空状态、改动列表、`defaultAccountId`、`reauthTarget`、`/repo/changes`、`dgp:cwd` 等）→ 81 项 |
| `scripts/test-hardening.mjs` | 新增「工作区改动明细」测试块（独立沙箱仓库，21 项断言：缺 cwd / 非仓库 / 未授权不泄露 / root+branch+dirty / `M` / staged / `??` / 升序）→ 133 项 |
| `scripts/preview.mjs` | 新增 `FALLBACK_CSS`（5 组新 class 兜底，置于产物 CSS **之前**）、4 组新样张（stats / changes / toast / empty，浅深各一）、`page()` 增加 `extraCss` 参数与 `TOAST_PREVIEW_CSS` |
| `README.md` | 门禁数字 63→81 / 112→133；能力表新增 7 行；接口表新增 `/repo/changes`；预览图新增 4 组 |
| `docs/enhancement-plan.md` | 本文档 |
| `docs/preview/*.png` | 新增 8 张（stats / changes / toast / empty × 浅深） |

**未改动**：`src/node/store.ts`（`defaultAccountId` 早已支持）、`src/node/tools.ts`（8 个 Agent 工具契约不变）、`src/node/vault.ts`、`src/node/providers.ts`、`src/node/paths.ts`、`src/index.ts`、`src/types.ts`。

---

## 六、验收标准

### 功能

1. 设置页 `Git` 分节顶部显示四格统计条，数字与实际状态一致（账号数、授权目录数、授权仓库数、写操作开关）；`allowedRoots` 含 `*` 时显示 `∞`。
2. 账号行显示「默认账号」徽章；点「设为默认」后 `POST /settings` 成功、徽章切换、toast 提示成功；失败时 toast 提示错误文案。
3. 点「重新授权」后 provider/method 自动切到该账号取值、令牌输入清空、连接区顶部出现可取消的提示条。
4. 仓库范围页「当前会话仓库」按钮在有 cwd 时可用，点击把该路径追加进授权目录并 toast 提示；已在范围内或已设 `*` 时按钮禁用。
5. chip 菜单打开时能列出未提交文件（状态字母 + 路径 + 增删行数 + 已暂存标记）；未授权目录显示「当前目录未在授权范围内」；无改动显示空状态；加载中显示骨架屏。
6. 所有动作反馈以 toast 呈现且 2.6 秒自动消失；关闭 chip 菜单后 toast 仍可见。
7. 既有功能不回归：账号连接 / 校验 / 断开、OAuth 设备码、分支拓扑图、初始化 Git 项目、复制路径、打开 Git 设置（落 Git 分节）全部照旧可用。

### 工程

8. `npm run typecheck` 0 错；`npm run gates` **81 项**通过；`npm run test:hardening` **133 项**通过；`npm run test:e2e` **13 项**通过（真实 GUI）。
9. 不引入任何新依赖（`package.json` 的 dependencies 不变）。
10. 浅/深两套预览图均渲染正常（`docs/preview/` 共 12 张）。

### 安全

11. `/repo/changes` 对未授权目录只回空壳（`root`/`branch` 为空、`files` 为空），不泄露路径、分支与文件名。
12. 界面、接口返回值、日志中均不出现明文令牌。

---

## 七、风险与待确认事项

### 风险

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| `git status --porcelain` 在超大仓库上偏慢 | chip 菜单打开延迟 | 只在打开菜单时请求（不轮询），`--untracked-files=all` 会放大开销；若实测卡顿，改为默认 `-unormal` + 单独统计未跟踪目录 |
| 改动列表上限 500 条无「已截断」标记 | 用户可能误以为只有 500 个改动 | 当前 `files.length` 即实际返回数，界面显示「N 个文件」，为真实值；后续可加 `truncated` 字段 |
| 未跟踪二进制的行数是字节流估算 | 增删行数不准确 | 超过 2000 行上限时界面显示「—」；二进制建议后续按 `git diff --numstat` 的 `-` 判定 |
| 增删行数是「暂存区 + 工作区合计」 | 与 `git diff` 单看一侧的数值不同 | README 已注明口径；后续可拆分 `stagedAdded` / `worktreeAdded` |
| `rememberCwd` 走 `sessionStorage` | 多标签页/多窗口下可能读到别的会话目录 | 只在「当前会话仓库」按钮旁展示完整路径供人工确认；不自动写入授权 |
| 统计条新增视觉密度 | 宿主设置页其他分节没有此元素，可能显得「重」 | 严格复用宿主 token 与度量；语义色只落在 2px 色条与副标题，主数字保持中性 |
| toast 与宿主浮层共存 | z-index 冲突或视觉重复 | `z-index:1300` 高于宿主 1100 上限；暂未发现宿主自带全局 toast |

### 待确认

1. **改动列表默认范围**：目前展示全部改动（含未跟踪）。是否需要「只看已跟踪 / 默认隐藏未跟踪」开关？
2. **默认账号语义**：现在是「Agent 侧优先使用」。是否需要在 Agent 工具返回值里显式标出当前使用的账号？
3. **`*` 通配的语义色**：统计条里把「全部授权」标成 warn 色（暗示风险），是否符合用户预期？当前实现是刻意这样设计的。
4. **仓库范围页是否需要 chip 化**（F10）：textarea 与 chip 列表双入口会不会造成编辑歧义？
5. **是否需要「授权历史」**：谁在什么时候改过授权范围（当前 `state.json` 不留历史）。

---

## 八、本轮实现说明

本轮已落地 F1–F7，F8–F10 留待后续。

**新增能力**：授权概览统计条、轻提示 toast（替换 `note` 机制）、工作区改动明细（新增 `GET /repo/changes`）、默认账号、重新授权、一键授权当前会话仓库、骨架屏与图形化空状态。

**回归基线**：`typecheck` 0 错 · `gates` 81 项 · `hardening` 133 项 · GUI 端到端 13 项 · `lib/client.js` 116.3kb · `lib/index.js` 77.1kb。

**本轮踩到的两个坑（已修）**：

1. **toast 浮层漏挂 `dgp-portal` 类** —— 浮层 `createPortal` 到 `document.body` 后脱离 `.dgp-root`，而 `--dgp-*` 变量只定义在 `.dgp-root` / `.dgp-portal` 上；漏挂类会让 `--dgp-fg` / `--dgp-line2` / `--dgp-r-sm` 全部失效（表现为无边框、无圆角、文字颜色错乱）。凡是 portal 到 body 的浮层都必须带 `dgp-portal`。
2. **预览图里的 toast 被裁 / 变淡** —— 产物 CSS 是 `position: fixed`，在窄画布里溢出；且 `@keyframes dgp-toast-in` 的首帧 `opacity: 0` 被截图引擎抓到。修法：`scripts/preview.mjs` 的 `page()` 增加 `extraCss`，预览时用 `TOAST_PREVIEW_CSS` 把浮层改静态流式排版并 `animation: none`。
