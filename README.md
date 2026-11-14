# @zjjlivingfree/dsh-git-panel

DSH 桌面端 Git 面板插件：输入框旁常显只读 Git chip（`Git` + 分支名），点开面板查看仓库状态、远程地址、最近提交与 npm 包信息，并配置账号与授权。

## 一、能做什么

| 区块 | 内容 |
|---|---|
| 状态 chip | 恒显 `Git` + 分支名；切会话/窗口聚焦时自动重测，不轮询 |
| 仓库初始化 | 非 Git 目录时：默认用当前目录名建仓（可改、可选私有），一键建本地仓库并在 GitHub 同步创建同名远程 `origin` + 自动空提交（受 allowWrite 门控，不自动推送） |
| 远程与提交 | Git 仓库时：远程地址（点击跳转）+ 最近 5 条提交（hash 短码 + 摘要 + 日期） |
| npm 发布 | 读取/修改项目 `package.json` 的 `name`，展示可点击的 npm 包地址，显式「发布」按钮在官方源 `npm publish`（凭据走 `~/.npmrc`） |
| 账号与授权 | GitHub 账号连接（PAT / OAuth 设备码）、npm 发布凭据多账号（连接/切换/移除）、allowWrite 与 requireConfirm 两个写策略开关 |

其余 git 动作（提交、推送、切分支、打标签…）交给 AI 通过 7 个 Agent 工具执行：`git_panel_status` / `git_repo_info` / `git_branches` / `git_diff` / `git_log` / `git_write` / `git_confirm`。写操作的确认权始终在你手里。

## 二、安装与使用

桌面版由宿主独占管理（插件命令不可用），需手工登记到 `~/.dsh/profiles/desktop`：

1. `package.json` 的 `dependencies` 加 `"@zjjlivingfree/dsh-git-panel": "<版本或本地 link 路径>"`；
2. 把包名追加进 `dsh.profile.bundles`，同步两份 lock 的 importer；
3. `node_modules/@zjjlivingfree/dsh-git-panel` 指向本仓库（本地开发用 Junction），重启 DSH。

仓库已内置 `lib/` 构建产物，装完即用。卸载：删除以上声明与链接后重启。

点输入框左侧 **Git chip** 打开弹层：顶部是只读状态栏（干净/改动状态点 + 分支名），中部按需展示初始化表单或远程地址与最近提交，底部是「账号与授权」折叠区。

## 三、账号与授权

- GitHub 账号支持 **PAT** 与 **OAuth 设备码**（设备码需你自建 OAuth App 并填 Client ID；插件不内置任何第三方应用凭据）。
- npm 发布凭据支持多账号（连接/切换/移除）；校验通过后写入 `~/.npmrc`，保存后不再回显。
- 令牌加密保存在本机，界面与日志永不出现明文；git 推送/拉取走你本机 git 凭据体系（credential manager / SSH），插件不代理远端认证。
- 写操作受 allowWrite 总开关 + requireConfirm 两段确认约束；开启「写操作前需要我确认」时，`git_write` 只返回 confirmToken，AI 须经你点头再调 `git_confirm`；取消也会作废该 token。
