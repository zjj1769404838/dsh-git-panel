# Git 工作台重做设计（IDEA 式主面板 + 二级弹窗）

> 任务来源：用户 2026-10-29 指令——现有 Git 按钮（⎇ chip）打开的小菜单不符合需求，参考 IntelliJ IDEA 的 Git 工具窗口与常用 Git 流程重做。
> 参考依据：JetBrains 官方文档（commit-and-push / manage-branches / sync-with-a-remote-repository / log-tab / resolve-conflicts / undo-changes / set-up-a-git-repository，2026.2）；调研全文见会话记录。用户提供的参考截图仅用于二级弹窗层级（视觉细节不可读时按 IDEA 文档结构实现）。

## 1. 现状盘点（改代码前的对照基线）

### node 半边（`src/node/`）
| 模块 | 已有能力 |
| --- | --- |
| `handler.ts` | 路由前缀 `/dsh-git-panel`；GET `/health /state /providers /repo/status /repo/graph /repo/changes`；POST `/repo/init /pat/connect /oauth/start /oauth/poll /accounts/remove /accounts/recheck /settings`。POST 全部过同源校验 + 256KiB body 上限；错误统一 `{ok:false,error}`。 |
| `git.ts` | `runGit`（execFile 参数数组防注入、READ_ONLY/WRITE 白名单、危险选项拦截、30s 超时、输出 clip 400K）；`ensureRepo`；`readRepoStatus`（ahead/behind/changed、reason: repo/no-repo/invalid）；`readRepoChanges`（porcelain v1 + numstat，`ChangeFile{path,index,worktree,added,deleted,staged}`）；`initRepo`（幂等）；`readRepoGraph`。 |
| `tools.ts` | Agent 工具 8 个；`git_write` 白名单动作 add/commit/checkout/switch/restore/stash/tag（**不含 pull/push**）+ requireConfirm→confirmToken→git_confirm 二次确认。 |
| `store.ts` | `isRootAllowed` 目录授权闸门；`allowWrite`/`requireConfirm` 设置；凭据 AES-256-GCM。 |

### client 半边（`src/client/index.tsx`，2610 行）
- `BranchChip`（`conversation.input.left`，order 30）：15s 轮询 status；点开 portal 小菜单（图 + 改动明细 + 初始化/刷新/复制路径/设置）。
- `GitSection`（`settings.section` 三 tab：账号/仓库范围/授权说明）。
- `ChangesList` / `GraphView`（车道图）/ `Toast` / 样式 `dgp-*` 变量体系 / i18n ZH+EN 两套。

## 2. IDEA 交互 → 本面板映射（10 条设计原则落地）

| IDEA 原则 | 本面板落地 |
| --- | --- |
| Commit 是核心动作 | 主面板左下常驻提交区：消息框 + `Commit` / `Commit▾→Commit and Push` |
| 变更列表优先 | 左栏「未暂存 / 已暂存 / 未跟踪」三分组，行内 stage/unstage/discard/查看 diff |
| 分支操作聚合单一弹窗 | 「分支管理」二级弹窗（Local/Remote 分组 + 搜索 + 行内操作 + 新建/删除/重命名） |
| 写操作前必预览 diff | commit 前右侧显示暂存 diff；push 弹窗列出待推送 commits；discard 弹 diff 确认 |
| 粒度可勾选 | 文件级勾选（v1）；行级部分暂存列为缺口 |
| destructive 显式确认 | discard/reset hard/force push 删除分支 均走确认弹窗（红色警示 + 影响清单） |
| 上下文右键菜单 | 历史行 hover ⋯：查看详情 / 复制 hash / Revert / Reset to here |
| 默认值智能 | remote 默认 origin、pull 分支默认 upstream、消息历史复用 localStorage |
| 自动化但可见 | 面板打开自动 fetch status/changes/branches/log；结果 toast + 行内错误态 |
| 安全分级 | push 的 force 藏在 ▾ 次级菜单且用 `--force-with-lease` |

## 3. 页面结构

### 3.1 主面板（Workbench，portal 到 body，约 760×540，替代原小菜单）
```
┌ 顶栏: ⎇ 仓库根 · 分支▾(→分支弹窗) [↑A ↓B N*]   Fetch Pull Push▾  ⟳  ⚙ ┐
├───────────────┬──────────────────────────────────────────┤
│ 变更(左栏)     │ 右栏 Tabs: 历史 | 分支图 | Diff 预览        │
│ 未暂存 (n)     │  历史: hash 作者 日期 信息(分支badge)       │
│  ☐ M a.ts +12-3│    行 hover ⋯ → 详情/复制/Revert/Reset     │
│ 已暂存 (m)     │  分支图: 复用 GraphView 车道图              │
│  ☑ M b.ts     │  Diff: 当前选中文件/暂存区 diff（着色行）    │
│ 未跟踪 (k)     │                                           │
│  ☐ ? new.ts   │                                           │
├───────────────┴──────────────────────────────────────────┤
│ Commit message (textarea, ↑历史▾)  ☐Amend   [Commit ▾][Commit+Push] │
└──────────────────────────────────────────────────────────┘
```
四态：**未初始化**（大按钮「初始化仓库」+说明）/ **检测失败**（错误 + 重试）/ **未授权**（提示去设置页授权，只读信息不给写按钮）/ **正常**。空仓库（无提交）：commit 可用、pull/push/历史显示引导文案。无远程：push/pull 按钮点击弹「配置远程仓库」弹窗。

### 3.2 二级弹窗（modal，portal，Esc 关闭，主按钮右下）
| 弹窗 | 内容（IDEA 对应） |
| --- | --- |
| 分支管理 | 全局组(新建/Fetch)；搜索框；Local（当前★高亮、ahead/behind 徽章、hover ⋯: 切换/重命名/删除）/ Remote（checkout 到本地）；Manage Remotes 入口 |
| 新建分支 | 名称输入（校验合法字符）+ 基点(默认当前) + ☑创建后立即切换 |
| 提交详情 | hash/作者/日期/完整消息 + 文件列表(numstat) + 点文件看 diff（`GET /repo/commit`） |
| Push | remote▾ + target(默认 upstream，可改) + 待推送 commit 勾选列表 + ☑tags + Push / ▾Force push(→确认) |
| Pull | remote▾ + branch▾(默认 tracked) + 策略 ○merge ○rebase；冲突→冲突处理弹窗 |
| 冲突处理 | 冲突文件列表 + 每文件 Accept Yours / Accept Theirs / 留待手动；[Abort merge]；手动解决后可再 Commit |
| 远程仓库 | name—url 列表 + 增/删（IDEA Manage Remotes） |
| Reset to here | 目标 commit + ○Soft ○Mixed ○Hard（Hard 红色警示）+ 确认 |

## 4. 接口缺口清单（现有接口不支持的操作 → 新增端点）

| 缺口 | 新增端点（`/dsh-git-panel` 下） | 复用的安全基线 |
| --- | --- | --- |
| 暂存/取消暂存 | POST `/repo/stage` `/repo/unstage` | 同源校验 + isRootAllowed + allowWrite |
| 丢弃改动(危险) | POST `/repo/discard`（body 带 `confirmed:true` 才执行） | 同上 + client 二次确认弹窗 |
| 提交 | POST `/repo/commit`（message 必填非空；amend 可选） | 同上；空提交信息/无暂存内容 400 |
| 历史列表 | GET `/repo/commits?cwd&limit&offset` | 只读 + isRootAllowed（未授权 fail-closed） |
| 提交详情 | GET `/repo/commit?cwd&rev`（show --numstat -m） | 只读 + 同上 |
| 文件/暂存 diff | GET `/repo/diff?cwd&mode=worktree\|staged\|commit&path&rev` | 只读 + 同上，输出 clip |
| 分支列表/新建/切换/删除/重命名 | GET `/repo/branches`；POST `/repo/branches/create /checkout /delete /rename` | 只读/写分级；dirty 时 checkout 先校验（拒绝可覆盖改动，不静默 stash） |
| pull/push/fetch | POST `/repo/pull /push /fetch`（pull 带 merge/rebase；push 带 setUpstream/force-with-lease） | 写操作 + allowWrite；未配 remote 返回可理解错误引导 |
| 远程列表/增删 | GET `/repo/remotes`；POST `/repo/remotes/add /remove` | 写操作 + allowWrite |
| 冲突清单 | 复用 status porcelain `U` 状态 + pull 返回体检测（`CONFLICT` 关键字→`conflicted:true`） | — |

不做（列入缺口说明，不做假按钮）：行级部分暂存（chunk 勾选）、三向合并编辑器、stash 管理 UI、cherry-pick/interactive rebase、多仓库批量操作。Agent 的 8 个工具与 confirmToken 闸门不动。

## 5. 实现拆分

| 文件 | 改动 |
| --- | --- |
| `src/node/git-ops.ts`（新） | 分支/暂存/提交/历史/详情/diff/远端/pull/push/fetch 的函数层（全部走 `runGit` + `ensureRepo`） |
| `src/node/handler.ts`（改） | 挂载第 4 节端点；写端点统一 `requireWrite(deps, req, res, cwd)` 闸门（同源→授权→allowWrite） |
| `src/client/workbench.tsx`（新） | Workbench 主面板 + 8 个弹窗 + diff 着色 + i18n 补键 |
| `src/client/index.tsx`（改） | chip 点击改开 Workbench；`ChangesList`/`GraphView` 导出复用；原菜单保留「打开 Git 设置/复制路径」移入面板 |
| `scripts/gates/run.mjs`、`scripts/test-hardening.mjs`、`scripts/e2e-settings.mjs` | 新增断言：端点存在/闸门行为/面板渲染 |

## 6. 验收映射

- 点 chip → 主面板（非菜单）；未初始化 → 初始化引导；可 init/stage/commit/pull/push/切分支。
- 分支管理/提交详情/远程配置/推送设置走二级弹窗，层级对齐 IDEA（modal 覆盖面板，Esc 可关）。
- 所有按钮有反馈（busy 态 + toast）；非法操作前置校验（空消息/无暂存/无远程/无上游/未授权）；异步防重复提交。
- 回归：tsc 0 错、gates/hardening 扩容后全绿、e2e 13 项 + 新面板断言全过。
- 不推送远端/不建 PR（用户硬约束）。


---

## 7. 落地结果（2026-10-29 实现完成，本节为准）

### 实现文件
- 新增 `src/node/git-ops.ts`：命令层（validBranchName/readBranches/createBranch/checkoutBranch/deleteBranch/renameBranch/stagePaths/unstagePaths/discardPaths/commitStaged/readCommits/readCommitDetail/readDiff/readRemotes/addRemote/removeRemote/fetchRepo/pullRepo/pushRepo/classifySync/hasMergeConflicts），全部经 runGit 白名单；git.ts 白名单补 for-each-ref（只读）与 clean（写，仅供 discard 未跟踪文件清理）。
- src/node/handler.ts：新增 16 个端点（GET /repo/branches|remotes|commits|commit|diff；POST /repo/stage|unstage|discard|commit|branches/create|checkout|delete|rename|pull|push|fetch|remotes/add|remotes/remove|conflicts），统一 requireWrite/requireRead 闸门，discard 强制 confirmed:true 否则 400。
- 新增 src/client/shared.tsx：api/routeUrl/视图类型/全套 .dgp-* CSS（含工作台与 modal）/通用组件（Toast、EmptyState、Skeleton、图标）。
- 新增 src/client/graphview.tsx：GraphView 车道拓扑图（chip 菜单与工作台共用）。
- 新增 src/client/workbench.tsx：Workbench 主面板（顶栏/左变更列表三组带勾选/右 tabs 历史|分支图|Diff/底栏提交框+Amend）+ 5 个二级弹窗（分支管理/提交详情/Pull 策略/远程仓库管理/丢弃确认）+ 四态首屏（骨架/未初始化/未授权/正常）。
- src/client/index.tsx：chip 菜单新增「Git 工作台」主入口（data-primary），挂载 Workbench；BUILD 升 dgp-v10；ZH/EN i18n 补约 70 键；client 从单文件拆出 shared/graphview/workbench 三模块。
- 新增 scripts/e2e-workbench.mjs（npm run test:e2e:wb）：chip→菜单→工作台→面板结构 9 项断言。

### 交互要点（对照 IDEA）
- Commit 消息为空或暂存区为空 → Commit 禁用 + wbCommitNeedsStaged 提示（后端 commitStaged 亦做 diff --cached --quiet 校验）。
- 所有写操作 busy 防重复；成功 toast + 全量刷新（status/changes/commits/branches/remotes）。
- push 缺 remote → missingConfig 引导远程弹窗；push 被拒 → 提示先 Pull；pull 冲突 → conflicted 提示；--force 一律走 --force-with-lease。
- 未初始化不显示 commit/pull/push；空仓库历史空态；无远程给远程引导。
- 丢弃改动两段确认（前端确认弹窗 + 后端 confirmed:true 强制）。

### 不做（后续按需求追加）
行级部分暂存（git add -p）、三向合并编辑器、stash UI、cherry-pick、多仓库切换。

### 回归基线（落地后）
tsc 0 错 · gates 122 项（新增 21 项工作台断言：端点存在/git-ops 导出/confirmed 强制/force-with-lease/三态同步反馈/四态首屏）· hardening 166 项（新增 33 项：临时仓跑 stage/commit/branches/discard/路径逃逸/未授权 fail-closed/missingConfig 全链路）· e2e-settings 11 项 · e2e-workbench 9 项 · lib/client.js 174.9kb · lib/index.js 110.3kb。
