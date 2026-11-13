# @zjjlivingfree/dsh-git-panel

DSH 桌面端 Git 面板插件（v3 极简化：**状态视图 + 命令发起器**）。

点输入框左侧的 **Git chip**（恒显 `Git` 字样 + 分支名 + 状态徽章）→ 弹层顶部是状态栏（分支 / 领先落后 / 改动数一目了然），下面是**按工作流分组的动作按钮**：同步 / 改动 / 分支与标签 / 发布。每个按钮把一条组装好的自然语言指令注入宿主输入框，由 AI 经 `git_write` / `git_confirm` 受控工具执行——插件自身不再直接写仓库，写操作的确认权始终在你手里。

v3.2 起宿主设置页不再有 Git 分节：账号连接、写策略全部收进弹层底部的「账号与授权」折叠区（v3.3 起目录白名单已移除，本地目录不受限）。

## 一、能做什么

| 区块 | 内容 |
|---|---|
| 状态 chip | 恒显 `Git` 文本 + 分支名 + 语义徽章（改动数 / ↑领先 / ↓落后）；切会话/窗口聚焦时自动重测，不轮询 |
| 弹层·状态栏 | 顶部状态条：干净/改动状态点、分支名、↑领先 ↓落后与改动数 |
| 弹层·改动 | 未提交文件列表（状态字母 + 增删行数） |
| 弹层·历史 | 最近 5 条提交摘要 |
| 弹层·动作 | 按工作流分 4 组：同步（推送 / 拉取 / 抓取）、改动（暂存全部 / 提交… / 贮藏 / 丢弃改动…）、分支与标签（新建分支… / 切换分支… / 打标签…）、发布（发布 npm）；（非仓库时）初始化仓库 |
| 弹层·账号与授权 | 折叠区：GitHub 账号连接（PAT / OAuth 设备码）、**npm 发布凭据多账号（连接/切换/移除；active 同步 ~/.npmrc，~/.npmrc 既有 token 首次进卡自动收编）**、allowWrite 与 requireConfirm 两个写策略开关 |
| 直接提交 | 开关：注入后插件代按发送按钮（找不到发送按钮时自动退化为"停在输入框"并提示） |

带 `…` 的按钮先弹出参数输入（分支名 / 文件 / 提交意图 / 标签名），参数留空则指令里保留 `<占位>` 由 AI 反问。注入的指令可编辑后再回车——发起权在按钮，落锤权在你。

## 二、Agent 工具（7 个）

`git_panel_status` / `git_repo_info` / `git_branches` / `git_diff` / `git_log` / `git_write` / `git_confirm`。

- `git_write` 动作面覆盖基础 git：init / add / commit / checkout / switch / restore / reset / stash / merge / rebase / push / pull / fetch / cherry-pick / revert / tag / branch / clean。
- 开启「写操作前需要我确认」时，`git_write` 只返回 confirmToken 与摘要，AI 必须经你点头再调 `git_confirm`；取消也会作废该 token。
- 所有本地 git 命令在任何目录都可执行（v3.3 拍板：目录白名单已移除）；写操作仍受 allowWrite 总开关与 confirmToken 两段确认约束，非仓库目录会给出可读错误。
- **Git 可执行文件发现（v3.13）**：桌面端从 GUI 图标启动时可能继承不含 Git 安装目录的 PATH，导致所有 git 命令报「退出码 1：无输出」。插件会从标准环境变量（Windows 的 `ProgramFiles` / `LOCALAPPDATA` / `SystemDrive`，其他平台为常见安装前缀）推导 Git 安装位置，把确实存在的目录前置到「git 子进程」的 PATH，不改动全局配置、不硬编码任何个人路径；也支持 `DSH_GIT_PATH` / `GIT_PATH` 显式覆盖。若 Git 确实未安装，会给出可读的「找不到 git 可执行文件」提示与人工修复清单，而不再伪装成命令失败。

## 三、安装

桌面版（手工，宿主独占管理拒绝 CLI add）：在 `~/.dsh/profiles/desktop/package.json` 的 `dependencies` 加

```json
"@zjjlivingfree/dsh-git-panel": "link:D:/my-projects/plugins/dsh-git-panel"
```

并把 `"@zjjlivingfree/dsh-git-panel"` 追加进 `dsh.profile.bundles`，两份 lock（`pnpm-lock.yaml` 与 `node_modules/.pnpm/lock.yaml`）同步 importer，`node_modules/@zjjlivingfree/dsh-git-panel` 建 Junction 指向本仓库，重启 DSH。仓库已内置 `lib/` 构建产物，装完即用。

卸载：删除以上四处声明与 Junction 后重启。

## 四、开发

```bash
npm install --include=dev   # esbuild / typescript（构建期依赖，运行时零依赖）
npm run bundle              # 构建 lib/index.js + lib/client.js
npm run typecheck
npm test                    # gates（契约门禁）+ hardening（产物行为回归）
```

改 `src/` 后必须 `npm run bundle` 再跑测试：测试与宿主直接 import `lib/` 产物。

## 五、账号与安全边界

- GitHub 账号支持 **PAT** 与 **OAuth 设备码**（本插件不内置任何第三方应用凭据：设备码需你自建 OAuth App 并填 Client ID）。
- 令牌以 AES-256-GCM 加密保存在本机 `~/.dsh/git-panel/state.json`，界面与日志永不出现明文；`/state`、错误信息均只回脱敏内容。
- 账号令牌用于 GitHub REST（列仓库、校验身份）；**git 推送/拉取走你本机 git 凭据体系**（credential manager / SSH），插件不代理远端认证。
- v22 时代的「每仓库三档权限」已移除，授权模型收敛为：本地目录白名单 + allowWrite 总开关 + requireConfirm 两段确认。

## 六、v3 相对 v22 删掉了什么

工作台 5 页签（文件浏览 / Markdown·图片预览 / 提交泳道图）、GitLab·Gitea 多平台、仓库三档权限、AI 生成提交信息、初始化向导、`prismjs` 依赖（产物从 695KB 降到 ~50KB）、7 个外语包（保留 zh/en）。HTTP 写端点整体移除——写操作唯一通道是 Agent 工具 `git_write`/`git_confirm`（`scripts/gates/run.mjs` 与 `scripts/test-hardening.mjs` 把这条锁成契约）。

旧版设计文档见 `docs/archive/`。
