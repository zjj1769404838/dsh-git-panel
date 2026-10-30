# 设置内 Git 页面与功能 · 审核报告与重构记录

- 审核日期：2026-10-30
- 范围：DSH 设置页 `settings.section` → `Git`（`GitSection` / `AccountRepoList`），及其依赖的 node 侧 `handler.ts` / `store.ts` / `providers.ts` / `git-ops.ts`
- 方法：`code-review` 技能七维清单（正确性 / AI 幻觉与静默降级 / 性能 / 冗余与可维护性 / 安全 / 产品过度工程 / 可验证可回滚），全程以源码与实测输出为证据
- 约束：保留「设置」「Git」专有名词与既有逻辑，不新增臆造需求

---

## 一、不符合项清单（审核发现）

严重度：P0 = 可绕过权限/数据错误；P1 = 行为不正确或丢数据；P2 = 体验与一致性；P3 = 可维护性

### P0-1　GitLab 子组仓库的权限键被截断，档位可被绕过

- 位置：`src/node/store.ts` `normalizeRepo()`（原 `const [owner, repo] = parts`）
- 现象：`normalizeRepo('group/subgroup/repo')` → `group/subgroup`；`normalizeRepo('https://gitlab.com/a/b/c.git')` → `a/b`
- 影响：GitLab 子组（`group/subgroup/repo`）是常态结构。键被折成 `group/subgroup` 后，**同一子组下所有仓库共享一条权限记录**——把 `repo-a` 设成 `none`，`repo-b` 跟着变 `none`；反过来把 `repo-a` 设成 `full`，`repo-b` 也被放行。权限档位在这条路径上形同虚设。
- 关联：`providers.ts` 的 `mapAccountRepo()` 对 GitLab 用 `path_with_namespace`（可 3+ 段）作为 `fullName`，`git-ops.ts` 的 `parseRemoteRepo()` 也走同一 `normalizeRepo` —— 写入键与校验键一起被截断，错得很一致，所以测试没暴露。

### P1-2　权限保存走「整表覆盖」，连点或多窗口会丢更新

- 位置：`src/client/index.tsx` `saveRepoPermission()`（原 1643-1657）
- 现象：每次改一个仓库的档位，都把**整张 `repoPermissions` 表**`POST /settings` 覆盖上去；无 in-flight 锁、无乐观更新、失败只弹一个 toast。
- 影响：快速连改两个仓库 → 第二个请求带的是改第一个之前读到的旧表，第一个改动被抹掉；两个窗口同时改不同仓库，后写者覆盖前写者。用户看到下拉框停在 A，落盘却是 B。

### P1-3　仓库列表只取第一页，超过上限静默截断

- 位置：`src/node/providers.ts` `accountReposEndpoint()` / `listAccountRepos()`
- 现象：GitHub `per_page=100`、GitLab `per_page=100`、Gitea `limit=50`，**全部只发一次请求**，无 `page` 参数、无截断标记。
- 影响：账号下有 100+ 仓库时，列表**看起来正常**但少了一大截，界面无任何提示。用户找不到某个仓库，只会以为插件坏了（静默降级，属于七维里的「AI 幻觉式静默」同类）。

### P1-4　权限判定在 node 与 client 各写一遍，任一侧改动即漂移

- 位置：`src/node/store.ts` `repoPermission()` 与 `src/client/index.tsx` `currentPermission()`（原 1631-1640）
- 现象：两侧各自实现「有表 → 表内未列出默认 `full`；无表 → 回退全局 `allowedRepos`」。
- 影响：`full` 这个默认值在两边各写一次。任何一侧调整（比如改成默认 `none`）都会让**界面显示与真实闸门不一致**——界面说「完整」，实际写操作 403，或者反过来界面显示「无权限」实际能推。

### P2-5　统计条「授权仓库」与账号级权限表完全脱节

- 位置：`src/client/index.tsx` 统计条（原 1920-1957）
- 现象：这一格只数全局 `allowedRepos`。
- 影响：用户已经把 12 个仓库按账号授权好了，统计条仍显示 `0`。数字与页面下方列表直接矛盾，是「看一眼就觉得没生效」的来源之一。

### P2-6　账号行 6 个同级按钮，危险操作与常规操作混排

- 位置：`src/client/index.tsx` 账号行（原 1976-2073）
- 现象：查看仓库 / 设为默认 / 编辑账号 / 重新授权 / 校验 / 断开，六个同权重 ghost/danger 按钮排成一行。
- 影响：①「编辑账号」与「重新授权」是**同一个动作**（都只是回填连接表单 + 清空令牌），两个按钮并存违反单入口原则；②「断开」紧邻「校验」，误点代价高。

### P2-7　全局 `allowedRepos` 与账号级权限表语义重叠且无说明

- 位置：`src/client/index.tsx` 仓库范围 tab（原 2157-2233）
- 现象：同一个页面里既有全局 `allowedRepos` 文本框，又有每账号的仓库权限表，两者都能影响「能不能写」，但没有任何文案说明谁优先。
- 影响：用户不知道该改哪一个；改错地方后行为不符合预期。

### P3-8　仓库列表缓存无失效策略

- 位置：`src/client/index.tsx` `toggleAccountRepos()`（原 1618-1628）
- 现象：每次展开都全量重拉；收起不清缓存；账号被删/重新授权（id 变化）后，`accountRepos` 里仍留着旧 id 的键。
- 影响：无效请求多；极端情况下旧 id 的缓存被新账号行命中（同 id 复用场景），展示过期列表。

---

## 二、重构（按清单逐项落地）

### 2.1　P0-1 仓库键保留全部路径段

`src/node/store.ts`

- `normalizeRepo()` 改为：段数 ≥2 时 `parts.join('/')` **全部保留**，每段校验 `/^[\w.-]+$/`，任一段不合法整体判非法。
- URL 前缀剥离正则改为 `/^[a-z][a-z0-9+.-]*:\/\/[^/]+\//i`（原先只剥 `https?://`）。
- 源码注释写明原因：只取前两段会把 `group/subgroup/repo` 折成 `group/subgroup`，权限串到别的仓库。

### 2.2　P1-2 单条权限写入端点 + 乐观更新

`src/node/handler.ts` 新增 `POST /repo/permission`：

- 请求 `{accountId, repo, permission}`；缺参 400、档位非法 400、账号不存在 404
- 只调 `store.setRepoPermission()` 改一格，返回 `{ok, repo, permission, state}`
- `POST /settings` 的 `repoPermissions` 分支保留（批量导入用），界面不再走它

`src/client/index.tsx`

- `saveRepoPermission()` 改调新端点，加**乐观更新**（先改本地 `permOverride`）+ **失败回滚**（清掉 override，回到服务端值）+ `finally` 清 in-flight 锁
- 新增 `permSaving` 状态与 `permissionSaving()` 查询；保存中该行 `data-saving="1"`、下拉 `disabled`、显示「保存中…」

### 2.3　P1-3 分页拉取 + 截断可见

`src/node/providers.ts`

- 新增 `REPO_PAGE_SIZE = 100`、`REPO_MAX_PAGES = 5`（500 仓库封顶）
- `accountReposEndpoint(provider, base, page = 1)` 三平台统一带 `page`
- `listAccountRepos()` 改循环：首页失败才整体失败；后续页失败 → `truncated:true` 且保留已取到的结果；满页且到上限 → `truncated:true`；不满一页 → 结束

`src/node/handler.ts` / `src/client/index.tsx`

- `GET /account/repos` 顶层返回 `truncated`，每项仓库带 `permission`
- 列表底部在 `truncated` 时显示「仓库较多，仅显示前 N 个」

### 2.4　P1-4 权限判定只留一个事实源

- `GET /account/repos` 直接回每仓库的 `permission: store.repoPermission(accountId, fullName)`，node 侧是唯一事实源
- `AccountRepoView` 加 `permission?`；client 的 `currentPermission()` 改为「先看乐观 override → 再看服务端返回的 `permission` → 兜底 `full`」，**不再复刻 node 的判定逻辑**

### 2.5　P2-5 统计条并入账号级权限

- `repoCount = allowAllRepos ? Infinity : repos.length + perAccountEntries`
- `perAccountEntries` = 所有账号权限表里显式列出的条目数之和（`*` 计为无限）
- 三处渲染统一改用 `repoCount`，副标题注明「含各账号已授权仓库」

### 2.6　P2-6 账号行合并入口 + 危险操作分隔

- **删除独立的「重新授权」按钮**：它与「编辑账号」是同一动作，合并后一个按钮完成「切平台 / 切接入方式 / 回填 host 与 apiBase / 清空令牌 / 显示提示条」
- 危险操作（断开）前插入 `<span className="dgp-line-sep" aria-hidden="true" />` 竖线分隔
- 新增 CSS：`.dgp-line-sep`（1px 竖线）、`.dgp-repo[data-saving="1"]`（保存中降透明度）

### 2.7　P2-7 说明两种范围的优先关系

- 仓库范围 tab 的 `allowedRepos` 文本域下新增说明：这是**全局兜底**，账号级权限表优先；只有账号没有权限表（老账号）时才走这里

### 2.8　P3-8 缓存策略

- `toggleAccountRepos()`：收起时清掉该账号的 `permOverride` 前缀键；展开时若缓存 <30 秒且不在 loading/error 状态则直接复用，不重拉

---

## 三、验证（增量重构阶段，BUILD dgp-v15）

| 项目 | 结果 |
| --- | --- |
| `npm run typecheck` | 0 错误 |
| `npm run bundle` | `lib/index.js` 134.1kb / `lib/client.js` 227.3kb |
| `npm run gates` | **165 项通过**（原 152 项，新增 13 项：11 条重构断言 + 2 条 providers 分页/截断） |
| `npm run test:hardening` | **194 项通过**（原 186 项，新增 8 项：单条权限端点 400/400/404/成功/不丢其它条目/落到目标仓库/子组键保留三段/不折叠成组名） |
| `npm run test:e2e` | 13 项通过 |
| `npm run test:e2e:wb -- <url>` | 27 项通过 |
| `npm run test:e2e:newui -- <url>` | 19 项通过 |

---

## 四、第二阶段：完全重做页面（BUILD `dgp-v16`，2026-10-30）

第一阶段是在既有结构上逐条修缺陷；用户随后明确要求「忘记之前的设计，完全重构，不是把原来的调整」。因此页面本身被整体重写，只保留数据契约与权限语义。

### 4.1　被丢弃的旧结构（连同缺陷一起消失）

| 旧结构 | 问题 | 新结构 |
| --- | --- | --- |
| 三个 tab（账号 / 仓库范围 / 授权说明） | 改一次权限要跨 tab 找地方；「授权说明」是静态文本却占一整页 | **单页纵向流**：概览带 → 账号卡 → 高级设置（折叠）→ 授权说明（卡片，附在底部） |
| 四格统计卡 `.dgp-stats` | 卡片体积大、数字与副标题抢注意力，且「授权仓库」原本只数全局白名单 | **概览带 `.dgp-overview`**：一行四段 + 分隔线，右侧挂「高级设置」开关 |
| 账号行 6 个同级按钮（查看仓库 / 默认 / 编辑 / 重新授权 / 校验 / 断开） | 主次不分，危险操作与常规操作混排 | 账号卡头部：身份 + 状态徽章 + 默认徽标/设为默认 + 「编辑账号」「校验」+ 竖线 + 「断开」 |
| 「查看仓库」折叠开关 `.dgp-repo-toggle` | 多一次点击才能看到仓库，且展开状态要单独记 | **仓库列表直接内联在账号卡里**，打开设置即自动拉取 |
| 权限用 `<select>` `.dgp-perm-select` | 下拉展开前看不到有哪些档位，选中值易与真实状态脱节 | **三档分段控件 `.dgp-perm-seg`**：完整 / 只读 / 无权限同时可见，点一下即提交 |
| 连接表单常驻页面 | 没连接需求时也占一大片，且与账号列表争夺注意力 | **「连接账号」Modal 弹窗**（复用 `workbench.tsx` 的 `Modal`），编辑账号复用同一弹窗并预填 |
| `allowedRepos` / `allowedRoots` 与账号权限同页平铺 | 两套语义混在一起，用户分不清哪个生效 | 收进**高级设置折叠区 `.dgp-adv`**，默认收起；`allowedRepos` 下方明确标注「全局兜底」语义 |

### 4.2　新结构

- 文件拆分：新 `src/client/settings.tsx` 承载 `GitSection` / `AccountCard` / `RepoRow` / `ConnectModal` / `AdvancedPanel`；`index.tsx` 只留 chip、初始化向导、分支详情弹窗与注册；视图类型搬到 `shared.tsx`。
- 仓库工具行 `.dgp-repos-toolbar`：搜索框（按 `owner/repo` 过滤）+ 权限筛选分段（全部 / 完整 / 只读 / 无权限）+ 计数「共 n / m 个仓库」+ 刷新。
- 保留第一阶段的全部数据层修复（单条 `POST /repo/permission`、node 侧唯一权限事实源、分页 + `truncated`、子组键保留全部路径段）。

### 4.3　第二阶段验证

| 项目 | 结果 |
| --- | --- |
| `npm run typecheck` | 0 错误 |
| `npm run bundle` | `lib/index.js` 134.1kb / `lib/client.js` 227.9kb |
| `npm run gates` | **174 项通过**（+9：新结构断言 + 动态拼接字典键兜底） |
| `npm run test:hardening` | **194 项通过** |
| `npm run test:e2e` | **23 项通过**（+10：新结构在位 + 旧结构逐项为 0） |
| `npm run test:e2e:wb` | 27 项通过 |
| `npm run test:e2e:newui` | 19 项通过 |

截图：`scripts/shot-settings.mjs` 会自动清掉宿主引导浮层（dsh-auto-memory 向导、dsh-purge 用户须知）再出图。

---

## 五、第三阶段：chip 后置页面完全重做（BUILD `dgp-v17` → `dgp-v18`，2026-10-30）

第二阶段只重做了「设置」里的 Git 分节；chip 点击后打开的**工作台、初始化页、当前分支详情**仍是旧设计。用户要求这三页同样「忘记旧设计、完全重做」，于是再做一轮，数据契约与端点调用一律不动。

### 5.1　被丢弃的旧结构

| 旧结构 | 问题 | 新结构 |
| --- | --- | --- |
| 工作台 `.dgp-wb`：760px 居中弹窗、`max-height:min(600px,80vh)` | 屏幕中部悬浮一块小窗，仓库内容多时纵向挤成一团，与宿主界面抢焦点 | **居中模态框 `.dgp-gw`**：`position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(1040px,calc(100vw - 96px));height:min(660px,calc(100vh - 96px))`，圆角 + 四边边框 + 0.18s 微缩放淡入（`prefers-reduced-motion` 关闭） |
| 左右 44% / 56% 双栏（左改动、右三 tab） | 两侧都在争宽度，改动列表被压到 44%，提交框又被挤到最底部 | **左窄竖排导航 `.dgp-gw-rail`（改动 / 历史 / 分支图）+ 右主区**，一次只渲染一个视图，主区拿到全部剩余宽度 |
| 提交框固定在整块面板底部 `.dgp-wb-foot` | 改动多时要滚到最底才能提交，且与列表分离 | 提交框上移到**改动视图顶部** `.dgp-gw-commit`（暂存区 → 写信息 → 提交 → 已暂存计数），符合「先看暂存再提交」 |
| Diff 占一个常驻 tab | 不选文件时该 tab 是空的，占了 1/3 导航位 | Diff 降级为**按需弹层**（`layer==='diff'`，标题「差异预览」），点某行才出现 |
| 初始化向导 5 步 stepper（`initStep` 0→4） | 每步都要点「下一步」，且确认清单要单独占一步才看得到 | **单页表单 + 右侧实时计划 `.dgp-iw`**：左侧一次填完（账号 / 远程 / 分支与首次提交），右侧 `position:sticky` 常驻显示将执行的动作清单与就绪状态，提交后就地变执行结果 |
| 分支详情 `.dgp-commitrow` 平铺列表 | 看不出提交的先后关系与「当前 HEAD」 | **时间线 `.dgp-tl`**：左侧竖线 + 圆点节点，首条节点用 accent 色加光晕；每行 = 提交信息 / 短哈希 / 作者 / 时间 |
| chip 菜单 5 项平铺 | 仓库操作与「打开目录」混在一起 | **分组菜单**：`仓库` 组（Git 工作台 / 刷新状态 / 当前分支详情）、`打开` 组（打开项目目录），设置独立一行且任何状态可达 |
| chip 每 15 秒 `setInterval` 轮询 `/repo/status` | 空闲时也在打接口，且状态最多滞后 15 秒 | **事件驱动**：cwd 变化、窗口获焦、页面重新可见、打开菜单四个时机才请求；工作台/初始化页关闭后再刷一次 |
| 死代码：`laneColor/laneX/rowY/curvePath`（与 `graphview.tsx` 重复）、`detectFailedNote()`（永远 return null） | 读代码时误以为还有第二条渲染路径 | 全部删除 |

### 5.2　新文件划分

- `src/client/workbench.tsx`：居中模态框式工作台 + 6 个二级弹窗（分支 / 新建分支 / 提交详情 / 远程 / Pull / Diff）+ `Modal`。
- `src/client/onboard.tsx`（新）：`InitWizard`（单页表单 + 实时计划）与 `BranchDetailModal`（时间线）。
- `src/client/index.tsx`：只留 chip 与注册（2044 → 1484 行）。
- `src/client/shared.tsx`：`.dgp-wb-*` / `.dgp-steps` / `.dgp-commitrow*` 全部换成 `.dgp-gw-*` / `.dgp-iw*` / `.dgp-tl*` / `.dgp-menu-group`。

### 5.3　第三阶段验证

| 项目 | 结果 |
| --- | --- |
| `npm run typecheck` | 0 错误 |
| `npm run bundle` | `lib/client.js` 232.5kb |
| `npm run gates` | **183 项通过**（+9：模态框结构 / 竖排导航 / 旧 `dgp-wb` 为 0 / 非贴右抽屉 / 单页向导 / 时间线 / 分组菜单） |
| `npm run test:hardening` | **194 项通过** |
| `npm run test:e2e` | **23 项通过** |
| `npm run test:e2e:wb` | **29 项通过**（选择器全部迁到 `.dgp-gw*`，+2 几何/样式断言确认居中模态框形态，提交详情改为先切「历史」再点行） |
| `npm run test:e2e:newui` | **19 项通过**（时间线 `.dgp-tl-item`） |

### 5.4　本轮踩到的坑

- **按行区间替换 CSS 时连带删掉了 `.dgp-modal-*` 整组**，弹窗失去 `position:fixed` 遮罩与居中 → e2e 读到 `top:900 left:0` 溢出视口。修法：替换后必须 `grep -c` 校验关键类名仍在，并从 `git show HEAD:src/client/shared.tsx` 取回原样式补上。
- gates 断言不能写 `!includes('initStep')`——字典键 `initStepAccount/initStepRemote/initStepBranch/initStepsTitle` 会误伤，必须收紧成 `setInitStep` / `initStep:`。
- `dgp-v16` 在 gates 里出现 4 次（2 处断言 + 2 处描述文本），`str.replace(a,b,N)` 前先 `assert s.count(a)==N`，否则断言失败。
- 工作台 e2e 里直接点 `.dgp-gw-commit, .dgp-gw-logrow, .dgp-gw-row` 会先命中改动行，提交详情弹窗根本打不开 → 必须先点竖排导航的「历史」再点日志行。
