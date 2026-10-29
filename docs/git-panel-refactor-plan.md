# Git 插件重构改造方案（v13）

> 本文档先于代码落地写定，作为本轮重构（m07484）的实现契约与验收依据。

## 0. 现状结论（基于实测代码）

### 0.1 已有能力（保留，不重写）
- **连接层**：`src/node/providers.ts` 覆盖 GitHub / GitLab / Gitea 三家，支持 OAuth 设备码流程与 PAT 两种方式；PAT 接入时走 `verifyToken` 校验身份。
- **凭据层**：`src/node/vault.ts` AES-256-GCM；`PanelStore.snapshot()` 对外一律把 `secret` 置空，日志走 `redact()`。
- **Git 操作层**：`src/node/git.ts`（命令白名单 + 危险参数拦截 + 超时 + 输出裁剪）、`src/node/git-ops.ts`（37 个读写函数，覆盖分支 / 提交 / 差异 / 远程 / 同步 / 冲突）。
- **Agent 工具层**：`src/node/tools.ts` 8 个工具（`git_panel_status` / `git_repo_info` / `git_branches` / `git_diff` / `git_log` / `git_remote_info` / `git_write` / `git_confirm`），写操作强制二次确认（confirmToken，5 分钟 TTL）。
- **HTTP 层**：`src/node/handler.ts` 34 个端点，读端点 fail-closed（`requireRead`），写端点统一 `requireWrite`。
- **界面层**：`src/client/index.tsx` 的 `GitSection`（DSH 设置页 `settings.section`，三 tab）、`BranchChip`（输入框下方左侧 `conversation.input.left`）、`workbench.tsx` 的 Git 工作台与二级弹窗、`shared.tsx` 的 152 个 `.dgp-*` 样式类与通用小组件。

### 0.2 六个明确缺口（对应用户四块需求）
| # | 缺口 | 证据 |
|---|---|---|
| G1 | 没有「账号 → 该账号下所有远程仓库」的列举能力 | `providers.ts` 只有单仓库 `fetchRepo`；全仓唯一列表是本地扫描 `discoverRepos` |
| G2 | 权限模型是全局扁平的 `allowedRepos`，没有 per-account / per-repo 维度 | `store.ts` `Settings.allowedRepos: string[]` |
| G3 | 写路径完全绕过 `allowedRepos`：目录在 `allowedRoots` 内就能 push 到任意远端 | `/repo/push`、`/repo/fetch`、`/repo/pull`、`/repo/remotes/add` 只过 `requireWrite` |
| G4 | 初始化只有 `git init -b`，没有「选账号 → 选远程 → 选分支 → 执行」的流程 | `initRepo`（git.ts:440-461）、`/repo/init`（handler.ts:601） |
| G5 | chip 菜单入口不分状态：未初始化时也会露出工作台等不可用入口；没有「当前分支详情（含分支名）」按钮 | `BranchChip` 菜单 7 项恒定渲染 |
| G6 | 提交记录弹窗只在工作台二级弹窗里，chip 侧没有独立入口；提交四项字段（信息/标识/作者/时间）虽已具备但没在分支维度暴露 | `workbench.tsx:663-685` 已渲染四项，缺按 `ref` 的分支维度入口 |

## 1. 数据模型扩展（向后兼容）

`Settings` 增加可选字段：

```ts
repoPermissions?: Record<accountId, Record<repoKey, 'full' | 'read' | 'none'>>
```

- `repoKey` 复用 `normalizeRepo` 的 `owner/repo` 键空间。
- 语义：该账号**存在**权限表时，表内未列出的仓库默认 `full`（新账号/新仓库默认完整权限）；表内显式 `none` 表示拒绝。
- 该账号**不存在**权限表时（旧数据），沿用全局 `allowedRepos` 兼容语义（命中或 `*` → `full`，否则 `none`）。
- `load()` 归一化：内层 key 走 `normalizeRepo`，value 只接受 `full|read|none`（其它值降级 `none`）；外层只保留仍存在的账号 id。
- `allowedRepos` / `allowedRoots` / `allowWrite` / `requireConfirm` / `defaultAccountId` 全部保持原语义，不动。

新增 store 方法：`repoPermission(accountId, repo)` / `setRepoPermission(accountId, repo, perm)` / `isRepoAllowedFor(accountId, repo)` / `isRepoWritableFor(accountId, repo)`。

## 2. node 半边改造

### 2.1 远程 URL → 仓库标识
新增 `parseRemoteRepo(url): string | null`，支持 `https://host/owner/repo(.git)`、`http://`、`git@host:owner/repo(.git)`、`ssh://git@host/owner/repo(.git)`，返回规范化 `owner/repo`。

### 2.2 列举账号远程仓库
`providers.ts` 新增：
- `AccountRepoInfo { fullName, name, owner, url, private, defaultBranch }`
- `accountReposEndpoint(provider, base): string`（纯函数，便于门禁与测试）
- `listAccountRepos(provider, token, apiBase?, host?): Promise<{ ok, repos, error? }>`
  - GitHub `GET {base}/user/repos?per_page=100&affiliation=owner,collaborator,organization_member`
  - GitLab `GET {base}/api/v4/projects?membership=true&per_page=100`
  - Gitea `GET {base}/user/repos?limit=50`
  - 失败一律返回可读中文 error，不抛异常、不回显 token。

### 2.3 新端点
- `GET /account/repos?accountId=` → `{ ok, repos[] }` 或 `{ ok:false, error }`。
- `POST /repo/bootstrap`：body `{ cwd, accountId, remoteMode:'existing'|'new', repoFullName?, remoteUrl?, branchMode:'existing'|'new', branchName?, initialCommitMessage? }`；执行顺序 = `requireWrite` → 账号校验 → 解析远程 → **远程归属授权校验（fail-closed）** → `git init -b` → 添加/校验 `origin` → 切换或创建分支 → 可选首次提交；返回 `{ ok, root, branch, remoteName, remoteUrl, steps[], error? }`，`steps` 为中文短句记录每一步。
- `GET /repo/commits?cwd=&ref=`：`readCommits` 增加可选 `ref` 参数，按分支取日志（`git log <ref>`），格式串保持不变。

### 2.4 闸门收紧（补 G3）
- `/repo/fetch`、`/repo/pull`、`/repo/push`、`/repo/remotes/add`：解析目标 remote 的 URL → `parseRemoteRepo` → 账号级 `isRepoWritableFor` 校验，不通过 403 `目标远程仓库 <key> 未授权写入`；URL 解析不出仓库标识（本地路径 remote 等）时放行但记一条 warn。
- `/repo/init` 改为统一走 `requireWrite`。

## 3. client 半边改造

### 3.1 设置页（`GitSection`）
- 账号卡片新增「查看仓库」入口 → 展开该账号下的远程仓库列表：每行显示 `fullName`、公开/私有、默认分支、**当前权限状态**、**权限切换控件**（完整 / 只读 / 无权限，直接可见可改，不藏二级弹窗）。
- 权限读写走 `POST /settings`，body 增加 `repoPermissions`；新增账号默认建空表 = 默认完整权限。
- 编辑账号复用现有连接表单回填（provider / host / apiBase / method / login）。

### 3.2 chip 入口按状态分流
- 未初始化：只显示【初始化】+ （检测失败时）重试，**不出现**分支详情 / 工作台。
- 已设置：【设置入口】【工作目录入口】【当前分支详情】+ 刷新。
- 四个入口文案各自唯一 i18n 键（ZH/EN 同步）：`menuSettings`（设置入口）、`menuOpenDir`（工作目录入口）、`menuInit`（初始化）、`branchDetail`（当前分支详情）。

### 3.3 分步初始化向导（复用 `Modal`）
1. 选账号 → 2. 选/建远程仓库 → 3. 选/建分支名 → 4. 确认（列出将执行的动作）→ 5. 结果。
- 失败页展示 node 返回的具体原因，并提供【返回上一步】回到出错那一步。
- 每步 loading 态；未选完不能进入下一步；【上一步】/【下一步】/【取消】齐备。
- 列举失败时降级为手填 `owner/repo` 或远程 URL，并明确说明原因。

### 3.4 当前分支详情弹窗
- chip 所在行展示【当前分支详情】按钮，**按钮内容含当前分支名**（`⎇ <branch>`）。
- 点击 → 页面中央弹窗（复用 `Modal`，portal 到 body；宽度 `min(720px, 100vw - 48px)`，body 可滚动，小窗口不溢出）。
- 内容：当前分支提交记录，每条展示 **提交信息 / 提交标识 / 提交作者 / 提交时间** 四项（字段来自 `CommitRow.subject/shortHash/author/date`）。
- 数据源：`GET /repo/commits?cwd=&ref=<branch>`；空仓库给空态，加载中给骨架屏，出错给可读中文。
- 关闭方式：右上角 ×（`aria-label="close"`）+ 底部关闭按钮 + 点遮罩 + Escape。

## 4. 边界声明（不臆造接口）
- 远程仓库列举依赖平台 API：GitHub / GitLab / Gitea 均有对应端点；自建 GitLab/Gitea 走 `apiBase` 推断；若账号令牌缺少仓库列举所需 scope（PAT 未勾 `repo`），列举会失败 → 界面降级为手填并说明原因。
- 「新建远程仓库」指**在远端平台创建仓库**，插件不做平台侧建仓（避免臆造接口），向导中该选项只提供「填写已有远程地址」，新建分支同理在本地完成。
- 首次提交只在本地创建，不推送。

## 5. 验收
- `npm run typecheck` 0 错；`npm run bundle` 成功。
- `npm run gates`：新增「账号仓库端点 / bootstrap 端点 / per-repo 权限结构 / parseRemoteRepo / listAccountRepos / 远端写端点归属校验 / /repo/init 走 requireWrite」等断言。
- `npm run test:hardening`：新增「未授权远程仓库不可 push」等行为回归。
- `node scripts/e2e-settings.mjs <GUI_URL>` / `node scripts/e2e-workbench.mjs <GUI_URL>`：新增向导与分支详情弹窗的真机断言。
- BUILD 常量推进到 `dgp-v13`。
