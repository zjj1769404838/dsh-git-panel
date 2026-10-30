# @zjj/dsh-git-panel 插件计划

> 本文件记录「需求 → 形态 → 配方 → 验证 → 安装 → 发布」全过程的决策与勾选状态，可回放、可交接。
> 项目不是由 dsh-plugin-studio 脚手架生成（从零手写后按该 skill 的合同逐项对齐），故部分阶段为「回溯补齐」。

## 阶段 ①：需求捕获

- [x] 插件名：`@zjj/dsh-git-panel`（原名 `dsh-git-panel`，因 npm 裸名与社区列表已有 3 条同名，改为 scope 化）
- [x] 一句话目标：把 Git 账号接入与受控仓库操作（查看 / 暂存 / 提交 / 拉推 / 分支 / 远程 / 建仓）提供给 DSH 桌面端用户与 Agent，写入路径受账号与仓库级权限约束。
- [x] 能力面清单：
  - HTTP 接口（node 半边，前缀 `/dsh-git-panel`）：账号与仓库、仓库状态/图/改动/分支/远程/提交/差异、暂存/取消暂存/丢弃/提交、分支新建/切换/删除/重命名、fetch/pull/push、远程增删、冲突检测、初始化与 bootstrap、**在账号下新建远程仓库**、账号级仓库权限单条写入、设置读写。
  - Agent 工具（8 个）：`git_panel_status`、`git_repo_info`、`git_branches`、`git_log`、`git_diff`、`git_remote_info`、`git_write`、`git_confirm`。
  - 输入区入口：`conversation.input.left` 的单一分支状态 chip（`⎇ main ↑2 3*`），点击开分组菜单（仓库 / 打开 / 设置）。
  - 设置页分节：`settings.section` 的 `Git` 分节（概览带 + 账号卡内联仓库权限 + 高级设置折叠区 + 连接账号弹窗）。
  - 工作台：居中模态框（左侧竖排导航：改动 / 历史 / 分支图），六个二级弹窗。
  - 初始化向导：单页表单 + 右侧实时计划预览。
  - 分支详情：时间线视图。
- [x] 目标 profile：desktop（`dsh.client.platform: web`）

## 阶段 ②：形态与分发决策

- [x] 形态：`bundle`（`dsh.bundle.patch: ./cordis.patch.yml`）+ `client`（`dsh.client.platform: web`）
- [x] 分发方式：git 源（`dsh plugin --profile <p> add github:zjj1769404838/dsh-git-panel`）；npm 未发布
- [x] 包管理器：npm（`package-lock.json` 入库；运行时零依赖，全部在 `devDependencies`）

## 阶段 ③：配方装配

- [x] `src/index.ts` 已生成（`export const name = '@zjj/dsh-git-panel'`，注册 `webServer` 路由与 Agent 工具）
- [x] `src/client/index.tsx` 已生成（`inject = ['slots','sessions','locale','shortcuts']`，注册 `settings.section` 与 `conversation.input.left`）
- [x] `inject` 已覆盖所有服务（`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-locale`）
- [x] 冒烟功能就绪（chip 三态、菜单分组、设置页、工作台、向导、分支详情均有 e2e 覆盖）
- [x] 未手改 `lib/`（全部由 `node scripts/build.mjs` 产出，且已从 `.gitignore` 放行入库）
- [x] `cordis.patch.yml` 的 `id` / `name` 与包名一致，且因 scope 前缀的 `@` 是 YAML 保留字符而**必须加引号**
- [x] client bundle 的 `external` 含 `react` / `react/jsx-runtime` / `react-dom` / `react-dom/client`
- [x] 未声明任何 `@deepseek-ai/*` 运行时依赖

## 阶段 ④：本地验证

- [x] `npm install` 通过
- [x] `npm run bundle` 通过（`lib/index.js` + `lib/client.js`）
- [x] `npm run typecheck` 通过（0 错）
- [x] `npm run gates` 通过（195 项）
- [x] `npm run test:hardening` 通过（197 项）
- [x] `npm run test:e2e` 通过（23 项，真实 GUI + 本机 Edge）
- [x] `npm run test:e2e:wb` 通过（29 项）
- [x] `npm run test:e2e:newui` 通过（19 项）
- [x] `python <skill>/scripts/verify_plugin.py .` 通过（补齐 `docs/plan.md`、`LICENSE`、`react-dom/client` 后无 FAIL）

## 阶段 ⑤：安装与浏览器冒烟

- [x] 安装成功（`dsh plugin --profile desktop add link:D:/my-projects/plugins/dsh-git-panel`，profile 里以 `@zjj/dsh-git-panel` 链接）
- [x] 启动日志无 `plugin tree failed to load`
- [x] 浏览器无 `slot entry crashed`
- [x] 冒烟功能可用（chip / 菜单 / 设置页 / 工作台 / 向导 / 分支详情均在 `http://127.0.0.1:63801` 实测通过）

## 阶段 ⑥：发布

- [x] git 仓库与 remote 就绪（`origin https://github.com/zjj1769404838/dsh-git-panel.git`）
- [x] README 使用真实安装 ref（不再写本机绝对路径）
- [x] 构建产物已入库（`.gitignore` 已移除 `lib/`）
- [ ] 从目标 ref 重装验证通过（待首次 push 后执行）
- [ ] 向 `awesome-dsh-plugin` 提 `data/plugins/zjj1769404838__dsh-git-panel.yml` 的 PR（需仓库年龄 ≥1 天）
- [ ] 打 `dsh-plugin` topic

## 备注

- **降级说明**：本项目为从零手写实现，未使用 dsh-plugin-studio 的脚手架；该 skill 的合同（package.json 字段、`cordis.patch.yml`、external、`verify_plugin.py`）已逐条对齐。
- **决策变更记录**：
  - 2026-10-30 包名由 `dsh-git-panel` 改为 `@zjj/dsh-git-panel` —— 原因：npm 裸名已被 `a792883583/dsh-git-panel` 占用，社区列表另有 `fengbinmov/dsh-git-panel` 与 `xbzbing/dsh-git-panel` 两条同名。
  - 2026-10-30 `.gitignore` 移除 `lib/` —— 原因：git 源分发要求构建产物入库，否则 clone 后装不上。
  - 2026-10-30 工作台形态由「贴右全高抽屉」改为「居中模态框」—— 原因：用户明确要求「不要抽屉，使用模态框」。
  - 2026-10-30 设置页 Git 分节整体重做（旧三 tab / 四格统计卡 / 账号行 6 按钮 / 权限 select 全废弃）—— 原因：用户要求「忘记之前的设计完全重构」。
