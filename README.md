# @zjjlivingfree/dsh-git-panel

DSH 桌面端 Git 面板插件（v3.18：**配置 + 轻动作型** Git chip，视觉采用 Linear 风格精致深色皮肤）。

点输入框左侧的 **Git chip**（恒显 `Git` 字样 + 分支名）→ 弹层顶部是只读状态栏（干净/改动状态点 + 分支名），中部按需展示**仓库初始化表单**（非仓库时）、**远程地址（可点击跳转）+ 最近 5 条提交**（仓库时），最底部是**「账号与授权」配置区**。面板自带三处显式动作：**初始化本地仓库并同步建远程**、**配置/显式发布 npm 包**；其余 git 动作（提交、推送、切分支、打标签…）仍交给 AI 通过 7 个 Agent 工具执行，写操作的确认权始终在你手里。

v3.2 起宿主设置页不再有 Git 分节：账号连接、写策略全部收进弹层底部的「账号与授权」折叠区（v3.3 起目录白名单已移除，本地目录不受限）。v3.15 删除了动作按钮与命令注入器、v3.16 移除了改动文件展示，面板一度退化成纯只读；v3.17 据需求反转，重新引入三处受 `allowWrite` 门控的显式动作；**v3.18 为视觉重构（设计总控 skill 驱动）**：重新设计设计令牌为 Linear 风格暗色 + 签名靛紫 accent、新增主操作实心按钮、远程地址与提交列表样式，功能与 v3.17 一致。

## 一、能做什么

| 区块 | 内容 |
|---|---|
| 状态 chip | 恒显 `Git` 文本 + 分支名；切会话/窗口聚焦时自动重测，不轮询 |
| 弹层·仓库初始化 | 非仓库时显示：默认用当前目录名建仓（可改）、可选私有，**一键建本地仓库并同步在 GitHub 建私有远程 `origin` + 自动空提交**（受 `allowWrite` 门控，不自动推送） |
| 弹层·远程与提交 | 仓库时显示：远程地址（点击跳转）+ 最近 5 条提交（hash 前 7 位 + 摘要 + 日期） |
| 弹层·npm 发布 | 读取/修改项目 `package.json` 的 `name`（填错即改），显式「发布」按钮在官方源 `npm publish`（凭据走 `~/.npmrc`，不进仓库） |
| 弹层·账号与授权 | 折叠区：GitHub 账号连接（PAT / OAuth 设备码）、**npm 发布凭据多账号（连接/切换/移除；active 同步 ~/.npmrc，~/.npmrc 既有 token 首次进卡自动收编）**、allowWrite 与 requireConfirm 两个写策略开关 |

面板自带三处受 `allowWrite` 门控的显式动作（建仓 / 改包名并发布 / 配置 npm 凭据）；其余 git 动作（提交、推送、切分支…）仍交给 AI 通过 7 个 Agent 工具执行，写操作确认权始终在你手里。

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
- 授权模型收敛为：allowWrite 总开关 + requireConfirm 两段确认（v3.15 已删除动作按钮与「直接提交」开关，AI 写操作只经 Agent 工具通道）。

## 六、v3 相对 v22 删掉了什么

工作台 5 页签（文件浏览 / Markdown·图片预览 / 提交泳道图）、GitLab·Gitea 多平台、仓库三档权限、AI 生成提交信息、初始化向导、`prismjs` 依赖（产物从 695KB 降到 ~43KB）、7 个外语包（保留 zh/en）。

**v3.15 再删**：12 个动作按钮、命令注入器（拼指令 / 塞输入框 / 代按发送按钮）、参数输入卡、「直接提交」开关、「最近提交」区块、改动数/数字徽章（chip 三色徽章、状态栏计数、文件增删行数与溢出计数）、非仓库「初始化仓库」按钮、提示气泡。HTTP 写端点整体移除——写操作唯一通道是 Agent 工具 `git_write`/`git_confirm`（`scripts/gates/run.mjs` 与 `scripts/test-hardening.mjs` 把这条锁成契约）。

旧版设计文档见 `docs/archive/`。
