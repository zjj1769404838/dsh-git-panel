import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import {
  NS,
  api,
  routeUrl,
  useStyles,
  Dot,
  BranchIcon,
  RefreshIcon,
  CopyIcon,
  GearIcon,
  PlusIcon,
  EmptyState,
  Skeleton,
  Toast,
  fmt,
  type Dict,
  type RepoStatusView,
  type RepoChangesView,
  type RepoGraphView,
} from './shared.js'
import { GraphView } from './graphview.js'
import { Workbench } from './workbench.js'

/** 服务短名（不是 package.json 里的全名）。 */
export const inject = ['slots', 'sessions', 'locale', 'shortcuts']

const BUILD = 'dgp-v11'

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
  accountLabel: '账号备注名（可选）',
  accountLabelHint: '同一平台多个账号时用于区分，如「工作」「个人」',
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
  scopeGrantAll: '授权全部仓库',
  scopeGrantAllHint: '等同于在下方填 *（不限制）。之后可随时回来收窄范围。',
  scopeDiscoverTitle: '检测到的仓库',
  scopeDiscoverEmpty: '授权根目录下暂未扫描到 Git 仓库（保存授权目录后点「重新扫描」）',
  scopeDiscoverNoRemote: '无远程',
  scopeDiscoverUse: '加入授权',
  scopeDiscoverReload: '重新扫描',
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
  currentRepo: '当前仓库',
  notRepo: '当前会话目录不是 Git 仓库',
  menuInit: '初始化 Git 项目',
  menuInitHint: '只创建 .git 目录，不会删除或覆盖现有文件',
  menuSettings: '打开 Git 设置',
  menuOpenDir: '打开项目目录',
  toastOpened: '已在文件管理器中打开项目目录',
  openFailed: '打开项目目录失败',
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
  /* ---- 授权概览（统计条） ---- */
  statsTitle: '授权概览',
  statsAccounts: '账号',
  statsAccountsHint: '{n} 个已连接',
  statsAccountsHintMixed: '{n} 个已连接 · {m} 个异常',
  statsAccountsHintNone: '尚未连接',
  statsRoots: '授权目录',
  statsRootsHint: '{n} 个本地目录',
  statsRootsHintAll: '不限制目录',
  statsRootsHintNone: '未授权任何目录',
  statsRepos: '授权仓库',
  statsReposHint: '{n} 个远端仓库',
  statsReposHintAll: '全部仓库',
  statsReposHintNone: '未授权任何仓库',
  statsWrite: '写操作',
  statsWriteOn: '已允许',
  statsWriteOff: '已关闭',
  statsWriteHintOn: '需二次确认',
  statsWriteHintOff: 'Agent 只读',
  /* ---- 账号卡片增强 ---- */
  setDefault: '设为默认',
  isDefault: '默认账号',
  reauthHint: '用新的令牌覆盖当前账号',
  /* ---- 工作区改动 ---- */
  changesTitle: '工作区改动',
  changesCount: '{n} 个文件',
  changesEmpty: '工作区干净，没有未提交改动',
  changesLoading: '正在读取改动…',
  changesFailed: '读取改动失败',
  changesStaleNode: '插件服务端是旧版本（DSH 的 node 半边不热重载），重启 DSH 桌面端后恢复',
  changesUnauthorized: '当前目录未在授权范围内',
  changesStaged: '已暂存',
  /* ---- 轻提示 ---- */
  toastSaved: '已保存仓库范围',
  toastCopied: '已复制到剪贴板',
  toastCopiedFailed: '复制失败，请手动复制',
  toastDefault: '已设为默认账号',
  toastRecheck: '账号校验完成',
  /* ---- Git 工作台（IDEA 式主面板） ---- */
  wbTitle: 'Git 工作台',
  wbOpenHint: '打开完整 Git 操作面板（变更 / 提交 / 拉取 / 推送 / 分支 / 历史）',
  wbFetch: 'Fetch',
  wbPull: 'Pull',
  wbPush: 'Push',
  wbUnstaged: '未暂存',
  wbUntracked: '未跟踪',
  wbStage: '暂存',
  wbUnstage: '取消暂存',
  wbDiscard: '丢弃',
  wbHistory: '历史',
  wbGraph: '分支图',
  wbDiffTab: 'Diff',
  wbMsgPlaceholder: '提交信息（必填）',
  wbAmend: '修补上次提交',
  wbCommit: '提交',
  wbCommitNeedsStaged: '暂存区为空：请先在左侧勾选文件并暂存，再填写提交信息',
  wbCleanHint: '没有可提交的改动。编辑文件后会出现在这里。',
  wbInitHint: '此目录还不是 Git 仓库。初始化后即可在这里暂存、提交与查看历史。',
  wbInitName: '仓库名',
  wbInitRemote: '远程仓库地址（可选，留空则仅本地初始化）',
  wbUnauthorizedHint: '该目录不在「仓库范围」授权内。把目录加入授权后即可操作。',
  wbNoCommits: '仓库还没有提交',
  wbNoCommitsHint: '完成首次提交后，历史会显示在这里。',
  wbBranchTitle: '分支管理',
  wbLocalBranches: '本地分支',
  wbRemoteBranches: '远程分支',
  wbNoRemoteBranches: '尚无远程分支（先 fetch 或推送）',
  wbNewBranch: '新建分支',
  wbBranchName: '分支名',
  wbCheckoutAfterCreate: '创建后立即切换',
  wbCreate: '创建',
  wbCheckout: '切换',
  wbDelete: '删除',
  wbConfirmDelete: '确认删除',
  wbCommitDetail: '提交详情',
  wbDetailFailed: '读取提交详情失败',
  wbAuthor: '作者',
  wbDate: '日期',
  wbFiles: '变更文件',
  wbRemoteTitle: '远程仓库',
  wbNoRemotes: '还没有配置远程仓库。添加后才能 Push / Pull。',
  wbRemoteName: '名称',
  wbRemoteUrl: 'URL（https:// 或 git@）',
  wbAdd: '添加',
  wbRemove: '移除',
  wbPullTitle: '拉取（Pull）',
  wbPullMerge: '合并（merge）',
  wbPullRebase: '变基（rebase）',
  wbPullUpstream: '将拉取自',
  wbPullNoUpstream: '当前分支没有上游，Pull 会按远程同名分支拉取',
  wbPullHint: '合并把远程提交并入当前分支并产生合并提交；变基把本地提交挪到远程之后，历史更线性。',
  wbDiscardTitle: '丢弃未提交改动',
  wbDiscardText: '以下文件的改动将被永久丢弃（未跟踪文件会被删除），此操作不可撤销：',
  /* ---- 工作台 toast ---- */
  toastStaged: '已暂存所选文件',
  toastUnstaged: '已取消暂存',
  toastDiscarded: '已丢弃所选改动',
  toastCommitted: '提交成功',
  toastAmended: '已修补上次提交',
  toastFetched: 'Fetch 完成',
  toastPulledMerge: 'Pull（merge）完成',
  toastPulledRebase: 'Pull（rebase）完成',
  toastPushed: 'Push 完成',
  toastCheckedOut: '已切换分支',
  toastBranchDeleted: '分支已删除',
  toastBranchCreated: '分支已创建',
  toastRemoteAdded: '远程仓库已添加',
  toastRemoteRemoved: '远程仓库已移除',
  /* ---- 工作台错误与状态 ---- */
  actionFailed: '操作失败',
  syncFailed: '同步失败',
  syncConflicted: '产生合并冲突：请解决冲突后重新提交（可用命令行或 IDE 处理）',
  syncRejected: '推送被拒绝：远端有新提交，请先 Pull 再 Push',
  syncMissingConfig: '未配置远程仓库或上游分支：点分支名打开分支管理，或到设置页配置远程',
  diffFailed: '读取 diff 失败',
  diffEmpty: '没有差异',
  diffEmptyHint: '该文件当前没有未提交改动，或已全部暂存。',
  diffTruncated: 'diff 过长已截断，完整内容请用命令行查看',
  /* ---- 刷新 ---- */
  loadingLabel: '正在加载…',
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
  accountLabel: 'Account label (optional)',
  accountLabelHint: 'Distinguish multiple accounts on the same host, e.g. work / personal',
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
  scopeGrantAll: 'Authorize all repositories',
  scopeGrantAllHint: 'Equivalent to * below (no limit). You can narrow the scope any time.',
  scopeDiscoverTitle: 'Discovered repositories',
  scopeDiscoverEmpty: 'No Git repositories found under authorized roots yet (save roots, then rescan)',
  scopeDiscoverNoRemote: 'no remote',
  scopeDiscoverUse: 'Authorize',
  scopeDiscoverReload: 'Rescan',
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
  currentRepo: 'Current repository',
  notRepo: 'The current session directory is not a Git repository',
  menuInit: 'Initialize Git project',
  menuInitHint: 'Creates only the .git directory; existing files are kept as-is',
  menuSettings: 'Open Git settings',
  menuOpenDir: 'Open project folder',
  toastOpened: 'Project folder opened in file manager',
  openFailed: 'Failed to open project folder',
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
  /* ---- Authorization overview ---- */
  statsTitle: 'Authorization overview',
  statsAccounts: 'Accounts',
  statsAccountsHint: '{n} connected',
  statsAccountsHintMixed: '{n} connected · {m} unhealthy',
  statsAccountsHintNone: 'none connected yet',
  statsRoots: 'Directories',
  statsRootsHint: '{n} local directories',
  statsRootsHintAll: 'any directory',
  statsRootsHintNone: 'no directory allowed',
  statsRepos: 'Repositories',
  statsReposHint: '{n} remote repositories',
  statsReposHintAll: 'all repositories',
  statsReposHintNone: 'no repository allowed',
  statsWrite: 'Writes',
  statsWriteOn: 'Allowed',
  statsWriteOff: 'Disabled',
  statsWriteHintOn: 'confirmation required',
  statsWriteHintOff: 'agent is read-only',
  /* ---- Account cards ---- */
  setDefault: 'Set as default',
  isDefault: 'Default account',
  reauthHint: 'Replace this account with a new token',
  /* ---- Workspace changes ---- */
  changesTitle: 'Workspace changes',
  changesCount: '{n} files',
  changesEmpty: 'Working tree is clean — no uncommitted changes',
  changesLoading: 'Reading changes…',
  changesFailed: 'Failed to read changes',
  changesStaleNode: 'Plugin backend is stale (DSH node side does not hot-reload) — restart the DSH desktop app to fix',
  changesUnauthorized: 'Current directory is outside the authorized scope',
  changesStaged: 'staged',
  /* ---- Toasts ---- */
  toastSaved: 'Scope saved',
  toastCopied: 'Copied to clipboard',
  toastCopiedFailed: 'Copy failed — copy it manually',
  toastDefault: 'Default account updated',
  toastRecheck: 'Account verification finished',
  /* ---- Misc ---- */
  /* ---- Git 工作台（IDEA 式主面板） ---- */
  wbTitle: 'Git Workbench',
  wbOpenHint: 'Open the full Git panel (changes / commit / pull / push / branches / history)',
  wbFetch: 'Fetch',
  wbPull: 'Pull',
  wbPush: 'Push',
  wbUnstaged: 'Unstaged',
  wbUntracked: 'Untracked',
  wbStage: 'Stage',
  wbUnstage: 'Unstage',
  wbDiscard: 'Discard',
  wbHistory: 'History',
  wbGraph: 'Graph',
  wbDiffTab: 'Diff',
  wbMsgPlaceholder: 'Commit message (required)',
  wbAmend: 'Amend last commit',
  wbCommit: 'Commit',
  wbCommitNeedsStaged: 'Nothing staged: tick files on the left and stage them, then write a commit message',
  wbCleanHint: 'No changes to commit. Edited files will appear here.',
  wbInitHint: 'This directory is not a Git repository yet. Initialize it to stage, commit and browse history here.',
  wbInitName: 'Repository name',
  wbInitRemote: 'Remote URL (optional, leave empty for local only)',
  wbUnauthorizedHint: 'This directory is not in the authorized scope. Add it in Settings → Git → Scope.',
  wbNoCommits: 'No commits yet',
  wbNoCommitsHint: 'History will appear here after the first commit.',
  wbBranchTitle: 'Manage branches',
  wbLocalBranches: 'Local',
  wbRemoteBranches: 'Remote',
  wbNoRemoteBranches: 'No remote branches yet (fetch or push first)',
  wbNewBranch: 'New branch',
  wbBranchName: 'Branch name',
  wbCheckoutAfterCreate: 'Check out after create',
  wbCreate: 'Create',
  wbCheckout: 'Check out',
  wbDelete: 'Delete',
  wbConfirmDelete: 'Confirm delete',
  wbCommitDetail: 'Commit',
  wbDetailFailed: 'Failed to load commit detail',
  wbAuthor: 'Author',
  wbDate: 'Date',
  wbFiles: 'Files',
  wbRemoteTitle: 'Manage remotes',
  wbNoRemotes: 'No remotes configured yet. Add one to enable Push / Pull.',
  wbRemoteName: 'Name',
  wbRemoteUrl: 'URL (https:// or git@)',
  wbAdd: 'Add',
  wbRemove: 'Remove',
  wbPullTitle: 'Pull',
  wbPullMerge: 'Merge',
  wbPullRebase: 'Rebase',
  wbPullUpstream: 'Pulling from',
  wbPullNoUpstream: 'Current branch has no upstream; Pull will use the same-named remote branch',
  wbPullHint: 'Merge folds remote commits into this branch with a merge commit; rebase moves local commits after remote ones for a linear history.',
  wbDiscardTitle: 'Discard uncommitted changes',
  wbDiscardText: 'Changes in the following files will be permanently discarded (untracked files deleted). This cannot be undone:',
  toastStaged: 'Files staged',
  toastUnstaged: 'Unstaged',
  toastDiscarded: 'Changes discarded',
  toastCommitted: 'Committed',
  toastAmended: 'Last commit amended',
  toastFetched: 'Fetch done',
  toastPulledMerge: 'Pull (merge) done',
  toastPulledRebase: 'Pull (rebase) done',
  toastPushed: 'Push done',
  toastCheckedOut: 'Branch switched',
  toastBranchDeleted: 'Branch deleted',
  toastBranchCreated: 'Branch created',
  toastRemoteAdded: 'Remote added',
  toastRemoteRemoved: 'Remote removed',
  actionFailed: 'Action failed',
  syncFailed: 'Sync failed',
  syncConflicted: 'Merge conflicts: resolve them and commit again (CLI or IDE)',
  syncRejected: 'Push rejected: remote has new commits. Pull first, then push',
  syncMissingConfig: 'No remote or upstream configured: click the branch name to manage branches, or configure remotes in Settings',
  diffFailed: 'Failed to load diff',
  diffEmpty: 'No differences',
  diffEmptyHint: 'This file has no uncommitted changes, or everything is staged.',
  diffTruncated: 'Diff is truncated; view the full output in a terminal',
  loadingLabel: 'Loading…',
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

/**
 * 工作区改动明细：把「哪些文件还没提交」压缩成一列状态字母 + 路径 + 增删行数。
 * 状态字母沿用 git porcelain 的两列语义（A 新增 / M 修改 / D 删除 / R 重命名 / C 复制 / U 冲突 / ? 未跟踪），
 * 未跟踪二进制没有真实行数，此时显示「—」而不是编造一个数字。
 */
function ChangesList({
  t,
  changes,
  loading,
  error,
}: {
  t: (key: string) => string
  changes: RepoChangesView | null
  loading: boolean
  error: string
}) {
  if (loading) {
    return (
      <div className="dgp-changes">
        <div className="dgp-changes-head">
          <span>{t('changesTitle')}</span>
        </div>
        <Skeleton rows={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="dgp-changes">
        <div className="dgp-changes-head">
          <span>{t('changesTitle')}</span>
        </div>
        <div className="dgp-changes-note" data-tone="error">
          {t('changesFailed')}：{error}
        </div>
      </div>
    )
  }

  // 未授权目录时 node 只回空壳（root/branch 为空），这里明确告诉用户「在范围外」而不是假装干净。
  if (!changes || !changes.root) {
    return (
      <div className="dgp-changes">
        <div className="dgp-changes-head">
          <span>{t('changesTitle')}</span>
        </div>
        <div className="dgp-changes-note">{t('changesUnauthorized')}</div>
      </div>
    )
  }

  const files = changes.files ?? []
  if (files.length === 0) {
    return (
      <div className="dgp-changes">
        <div className="dgp-changes-head">
          <span>{t('changesTitle')}</span>
          <span className="dgp-changes-count">{fmt(t('changesCount'), { n: 0 })}</span>
        </div>
        <div className="dgp-changes-note">{t('changesEmpty')}</div>
      </div>
    )
  }

  return (
    <div className="dgp-changes">
      <div className="dgp-changes-head">
        <span>{t('changesTitle')}</span>
        <span className="dgp-changes-count">{fmt(t('changesCount'), { n: files.length })}</span>
      </div>
      {files.map((file) => {
        const staged = file.index && file.index !== ' ' && file.index !== '??'
        const worktree = file.worktree && file.worktree !== ' ' ? file.worktree : '??'
        const code = worktree === '??' ? '??' : worktree
        // node 侧对未跟踪二进制只能给出字节流估算，超过上限即视为不可计数。
        const addedText = file.added > 2000 ? '—' : file.added > 0 ? `+${file.added}` : ''
        const deletedText = file.deleted > 0 ? `-${file.deleted}` : ''
        return (
          <div className="dgp-change" key={file.path} title={file.path}>
            <span className="dgp-change-code" data-code={code}>
              {code}
            </span>
            <span className="dgp-change-path">{file.path}</span>
            {staged ? <span className="dgp-change-stat" data-sign="staged">{t('changesStaged')}</span> : null}
            {addedText ? (
              <span className="dgp-change-stat" data-sign="add">
                {addedText}
              </span>
            ) : null}
            {deletedText ? (
              <span className="dgp-change-stat" data-sign="del">
                {deletedText}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** 设置面板在 DOM 里的稳定锚点（宿主 SettingsPanel 上写死）。 */
const SETTINGS_PANEL_SELECTOR = '[data-shortcut-modal="settings"]'

/**
 * 设置入口按钮的候选选择器。
 * 宿主 SettingsRoot 的 trigger 恒带 `aria-haspopup="dialog"`；`aria-keyshortcuts`
 * 只在快捷键目录里有 settings.open 这一行时才渲染，所以不能只依赖后者。
 */
const SETTINGS_TRIGGER_SELECTORS = [
  'button[aria-haspopup="dialog"][aria-keyshortcuts]',
  'button[aria-haspopup="dialog"]',
]

/** 按可见文案认设置按钮（宿主 locale 可能给中文或英文）。 */
const SETTINGS_TRIGGER_LABEL = /设置|設定|Settings|Preferences/i

/**
 * 必须排除的按钮：这些也是 `aria-haspopup="dialog"`，但打开的是别的浮层。
 * `[data-team-action]` 是 Agent Teams 的「智能体团队」触发按钮（同 asar 包
 * `dsh-experimental-client-ui-agent-team`），它的 aria-label 恰是「智能体团队」。
 */
const SETTINGS_TRIGGER_EXCLUDE = '[data-team-action],[data-team-panel],[aria-label*="团队"],[aria-label*="Team"]'

/**
 * 宿主账号菜单按钮（`dsh-client-ui-settings-account` 的 AccountMenu）。
 * 它无条件占用 `settings.launcher` slot，导致宿主的设置按钮 fallback 不渲染，
 * 真正的设置入口是这个账号菜单里的「设置」项。
 */
const ACCOUNT_MENU_SELECTORS = ['button[aria-haspopup="menu"]', 'button[aria-haspopup="true"]']

/** 账号菜单按钮的文案（中文/英文两种宿主 locale）。 */
const ACCOUNT_MENU_LABEL = /账号菜单|账户菜单|帐号菜单|Account\s*Menu|Account/i

/** 账号菜单里「设置」菜单项的文案前缀（后面常跟着快捷键提示，如「设置 Ctrl+Alt+,」）。 */
const SETTINGS_MENU_ITEM_LABEL = /^(设置|設定|Settings|Preferences)/i

function isSettingsOpen(): boolean {
  return document.querySelector(SETTINGS_PANEL_SELECTOR) !== null
}

/**
 * 找到宿主的设置入口按钮。
 *
 * 只认**文案匹配**的按钮，绝不退化成「随便拿第一个 aria-haspopup 按钮」：
 * 宿主把设置入口渲染在 `settings.launcher` slot 的 fallback 里，一旦该 slot
 * 被 `dsh-client-ui-settings-account` 的账号菜单占用，真正的设置按钮就根本
 * 不在 DOM 里，此时页面上其余 `aria-haspopup="dialog"` 按钮全是别的浮层
 * （智能体团队 / 插件市场 / 定时任务 …），点错会把无关面板打开。
 * 已展开的也不收（再点会把它关掉）。
 */
function findSettingsTrigger(): HTMLButtonElement | undefined {
  for (const selector of SETTINGS_TRIGGER_SELECTORS) {
    const nodes = Array.from(document.querySelectorAll<HTMLButtonElement>(selector))
    const labeled = nodes.find((node) => {
      if (node.disabled) return false
      if (node.getAttribute('aria-expanded') === 'true') return false
      if (node.closest(SETTINGS_TRIGGER_EXCLUDE) !== null) return false
      const name = node.getAttribute('aria-label') ?? node.textContent ?? ''
      return SETTINGS_TRIGGER_LABEL.test(name)
    })
    if (labeled !== undefined) return labeled
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

/**
 * 找到宿主账号菜单按钮（打开账号菜单的浮层触发器）。
 */
function findAccountMenuTrigger(): HTMLButtonElement | undefined {
  for (const selector of ACCOUNT_MENU_SELECTORS) {
    const nodes = Array.from(document.querySelectorAll<HTMLButtonElement>(selector))
    const matched = nodes.find((node) => {
      if (node.disabled) return false
      const name = node.getAttribute('aria-label') ?? node.textContent ?? ''
      return ACCOUNT_MENU_LABEL.test(name)
    })
    if (matched !== undefined) return matched
  }
  return undefined
}

/**
 * 走宿主真实路径打开设置页：账号菜单 → 「设置」菜单项。
 *
 * 宿主的设置按钮只是 `settings.launcher` slot 的 fallback，而
 * `dsh-client-ui-settings-account` 的 AccountMenu 无条件占用该 slot，
 * 于是设置按钮根本不在 DOM 里；唯一稳定可点的真入口是账号菜单里的「设置」项
 * （菜单项文案形如「设置  Ctrl+Alt+,」，后面跟着快捷键提示）。
 *
 * 返回 true 表示设置面板已打开。
 */
async function openSettingsViaAccountMenu(): Promise<boolean> {
  const trigger = findAccountMenuTrigger()
  if (trigger === undefined) return false
  if (trigger.getAttribute('aria-expanded') === 'true') {
    // 菜单已经开着，直接找菜单项。
  } else {
    trigger.click()
    await nextFrame()
    await nextFrame()
  }
  const menus = Array.from(document.querySelectorAll<HTMLElement>('[role="menu"]'))
  for (const menu of menus) {
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"],button'))
    const target = items.find((item) => {
      const text = (item.textContent ?? '').trim()
      return SETTINGS_MENU_ITEM_LABEL.test(text)
    })
    if (target === undefined) continue
    target.click()
    await nextFrame()
    await nextFrame()
    if (isSettingsOpen()) return true
  }
  return isSettingsOpen()
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
 * 1) 宿主账号菜单 → 「设置」菜单项（宿主真入口，最稳）；
 * 2) 点宿主自己的设置触发按钮（走宿主 onClick；部分构建里它确实在 DOM）；
 * 3) `shortcuts.registry.invoke('settings.open', ...)`（原生菜单走的同一条路，不校验 isTrusted）；
 * 4) 兜底派发 keydown（Web 端 runtime 无原生桥接，这条路有效）。
 */
async function openSettingsSection(
  ctx?: { shortcuts?: { registry?: { invoke?: (id: string, context: any) => void } } },
  sectionLabel?: string,
): Promise<void> {
  if (!isSettingsOpen()) {
    // 1) 宿主账号菜单里的「设置」。
    const viaMenu = await openSettingsViaAccountMenu()
    if (!viaMenu) {
      // 2) 点宿主的设置触发按钮。
      const trigger = findSettingsTrigger()
      if (trigger !== undefined) {
        const opened = await attempt(() => trigger.click())
        if (!opened) await openSettingsFallback(ctx)
      } else {
        await openSettingsFallback(ctx)
      }
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
  //    宿主按运行端注册两套绑定：desktop:* 是 Comma+primary（Ctrl+,），
  //    web:* 是 Comma+primary+alt（Ctrl+Alt+,）；两种都要试。
  const variants: Array<{ ctrlKey: boolean; altKey: boolean }> = [
    { ctrlKey: true, altKey: false },
    { ctrlKey: true, altKey: true },
  ]
  for (const variant of variants) {
    // Windows 上 primary = control，不能同时置 metaKey，否则 bindingKey 匹配不上。
    const opened = await attempt(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: ',',
          code: 'Comma',
          ctrlKey: variant.ctrlKey,
          altKey: variant.altKey,
          bubbles: true,
          cancelable: true,
        }),
      )
    })
    if (opened) return
  }
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
  const [accountLabel, setAccountLabel] = useState('')
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
  const [toast, setToast] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null)
  /** 正在重新授权的账号（provider+login）；非空时连接表单上方显示提示。 */
  const [reauthTarget, setReauthTarget] = useState<{ provider: string; login: string } | null>(null)
  /** 「检测到的仓库」：授权根下扫描出的本地仓库（含 remotes）。进入 scope tab 时拉取。 */
  const [discovered, setDiscovered] = useState<Array<{ root: string; name: string; branch: string; remotes: string[] }>>([])
  const [discovering, setDiscovering] = useState(false)

  const timerRef = useRef<number | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const showToast = useCallback((tone: 'ok' | 'error' | 'info', text: string) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    setToast({ tone, text })
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  /** 拉取「检测到的仓库」：/repo/discover 扫描授权根（远程 remotes 一并返回）。 */
  const loadDiscovered = useCallback(async () => {
    setDiscovering(true)
    try {
      const data = await api<{ ok: boolean; repos?: Array<{ root: string; name: string; branch: string; remotes: string[] }> }>('/repo/discover')
      setDiscovered(data.ok && Array.isArray(data.repos) ? data.repos : [])
    } catch {
      setDiscovered([])
    } finally {
      setDiscovering(false)
    }
  }, [])

  // 进入 scope tab 时扫描一次。
  useEffect(() => {
    if (tab !== 'scope') return
    void loadDiscovered()
  }, [tab, loadDiscovered])

  /** 把检测到的仓库根加入授权目录文本框（去重，追加一行）。 */
  const addRoot = useCallback((root: string) => {
    setRootsText((prev) => {
      const crlf = String.fromCharCode(13) + String.fromCharCode(10)
      const lines = prev.split(new RegExp(crlf + '|' + String.fromCharCode(10))).map((line) => line.trim()).filter(Boolean)
      if (lines.includes(root)) return prev
      lines.push(root)
      return lines.join(String.fromCharCode(10))
    })
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

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
      const data = await api<any>('/pat/connect', { provider, token, host, apiBase, label: accountLabel.trim() })
      if (!data.ok) {
        setError(data.error ?? '连接失败')
        return
      }
      setToken('')
      setFlowMsg('')
      if (data.state) applyState(data.state)
      showToast('ok', t('toastSaved'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      showToast('error', err instanceof Error ? err.message : String(err))
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
      if (!data.ok && data.error) {
        setError(data.error)
        showToast('error', data.error)
      } else {
        showToast('ok', t('toastSaved'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      showToast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const recheck = async (id: string) => {
    setBusy(true)
    try {
      const data = await api<any>('/accounts/recheck', { id })
      if (data.state) applyState(data.state)
      if (!data.ok && data.error) {
        setError(data.error)
        showToast('error', data.error)
      } else {
        setError('')
        showToast('ok', t('toastRecheck'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      showToast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  /** 设为默认账号：Agent 侧多账号时优先使用它。 */
  const setDefaultAccount = async (id: string) => {
    setBusy(true)
    try {
      const data = await api<any>('/settings', { defaultAccountId: id })
      if (data.state) applyState(data.state)
      if (data.ok) {
        showToast('ok', t('toastDefault'))
      } else {
        setError(data.error ?? '')
        showToast('error', data.error ?? t('errLoad'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      showToast('error', err instanceof Error ? err.message : String(err))
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
      if (data.ok) {
        setSavedTick((value) => value + 1)
        showToast('ok', t('toastSaved'))
      } else {
        setError(data.error ?? '')
        showToast('error', data.error ?? t('errLoad'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      showToast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const currentProvider = useMemo(() => providers.find((item) => item.id === provider), [providers, provider])
  const accounts = state?.accounts ?? []
  const primaryState = accounts.find((item) => item.status === 'connected')?.status ?? accounts[0]?.status

  // 统计条：把「授权到什么程度」压缩成一眼可读的四格，避免用户逐行读表单。
  const settings = state?.settings
  const connectedCount = accounts.filter((item) => item.status === 'connected').length
  const unhealthyCount = accounts.filter((item) => item.status !== 'connected').length
  const roots = settings?.allowedRoots ?? []
  const repos = settings?.allowedRepos ?? []
  const allowAllRoots = roots.includes('*')
  const allowAllRepos = repos.includes('*')
  const defaultAccountId = settings?.defaultAccountId ?? ''

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

      {/* 授权概览：四个数字把「授权到什么程度」一次说清，避免用户逐行读表单。 */}
      <div className="dgp-stats" role="group" aria-label={t('statsTitle')}>
        <div className="dgp-stat" data-tone={unhealthyCount > 0 ? 'warn' : connectedCount > 0 ? 'ok' : 'neutral'}>
          <span className="dgp-stat-label">{t('statsAccounts')}</span>
          <span className="dgp-stat-value">{accounts.length}</span>
          <span className="dgp-stat-hint">
            {accounts.length === 0
              ? t('statsAccountsHintNone')
              : unhealthyCount > 0
                ? fmt(t('statsAccountsHintMixed'), { n: connectedCount, m: unhealthyCount })
                : fmt(t('statsAccountsHint'), { n: connectedCount })}
          </span>
        </div>
        <div className="dgp-stat" data-tone={allowAllRoots ? 'warn' : roots.length > 0 ? 'ok' : 'neutral'}>
          <span className="dgp-stat-label">{t('statsRoots')}</span>
          <span className="dgp-stat-value">{allowAllRoots ? '∞' : roots.length}</span>
          <span className="dgp-stat-hint">
            {allowAllRoots ? t('statsRootsHintAll') : roots.length > 0 ? fmt(t('statsRootsHint'), { n: roots.length }) : t('statsRootsHintNone')}
          </span>
        </div>
        <div className="dgp-stat" data-tone={allowAllRepos ? 'warn' : repos.length > 0 ? 'ok' : 'neutral'}>
          <span className="dgp-stat-label">{t('statsRepos')}</span>
          <span className="dgp-stat-value">{allowAllRepos ? '∞' : repos.length}</span>
          <span className="dgp-stat-hint">
            {allowAllRepos ? t('statsReposHintAll') : repos.length > 0 ? fmt(t('statsReposHint'), { n: repos.length }) : t('statsReposHintNone')}
          </span>
        </div>
        <div className="dgp-stat" data-tone={settings?.allowWrite ? 'warn' : 'ok'}>
          <span className="dgp-stat-label">{t('statsWrite')}</span>
          <span className="dgp-stat-value">{settings?.allowWrite ? t('statsWriteOn') : t('statsWriteOff')}</span>
          <span className="dgp-stat-hint">{settings?.allowWrite ? t('statsWriteHintOn') : t('statsWriteHintOff')}</span>
        </div>
      </div>

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
                    {defaultAccountId === account.id ? (
                      <span className="dgp-badge" data-tone="mono">
                        {t('isDefault')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="dgp-btn ghost"
                        disabled={busy}
                        onClick={() => void setDefaultAccount(account.id)}
                      >
                        {t('setDefault')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="dgp-btn ghost"
                      disabled={busy}
                      title={t('reauthHint')}
                      onClick={() => {
                        setProvider(account.provider)
                        setMethod(account.kind === 'oauth' ? 'oauth' : 'pat')
                        setReauthTarget({ provider: account.provider, login: account.login || '' })
                        setToken('')
                        setTab('accounts')
                      }}
                    >
                      {t('reauth')}
                    </button>
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

            {reauthTarget ? (
              <div className="dgp-callout">
                <span className="dgp-callout-text">
                  {t('reauthHint')} · {reauthTarget.provider}
                  {reauthTarget.login ? ` / ${reauthTarget.login}` : ''}
                </span>
                <button type="button" className="dgp-btn ghost" onClick={() => setReauthTarget(null)}>
                  {t('cancel')}
                </button>
              </div>
            ) : null}

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
              <label className="dgp-label">{t('accountLabel')}</label>
              <input className="dgp-input" value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} placeholder={t('accountLabelHint')} />
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
          <ScopeDiscover
            t={t}
            repos={discovered}
            loading={discovering}
            onReload={() => void loadDiscovered()}
            onUse={(root) => addRoot(root)}
          />
          <div className="dgp-line" style={{ padding: '9px 0' }}>
            <div className="dgp-line-main">
              <span className="dgp-name">{t('scopeGrantAll')}</span>
              <span className="dgp-hint" style={{ marginTop: 2 }}>{t('scopeGrantAllHint')}</span>
            </div>
            <div className="dgp-line-side">
              <button type="button" className="dgp-btn" onClick={() => { setRootsText('*'); setReposText('*') }}>{t('scopeGrantAll')}</button>
            </div>
          </div>
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

      {toast ? <Toast tone={toast.tone} text={toast.text} onDone={() => setToast(null)} /> : null}
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

function BranchChip({ t, sessionId, sessions, shortcuts }: ChipProps) {
  useStyles()
  const [status, setStatus] = useState<RepoStatusView | null>(null)
  const [graph, setGraph] = useState<RepoGraphView | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState('')
  const [detectError, setDetectError] = useState('')
  const [checking, setChecking] = useState(false)
  const [open, setOpen] = useState(false)
  const [workbench, setWorkbench] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null)
  const [changes, setChanges] = useState<RepoChangesView | null>(null)
  const [changesLoading, setChangesLoading] = useState(false)
  const [changesError, setChangesError] = useState('')
  const toastTimerRef = useRef<number | null>(null)
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

  /** 工作区改动：只读明细，用于在 chip 菜单里一眼看到「哪些文件还没提交」。 */
  const loadChanges = useCallback(async (): Promise<void> => {
    if (!cwd) {
      setChanges(null)
      setChangesError('')
      return
    }
    setChangesLoading(true)
    try {
      const data = await api<{ ok: boolean; changes?: RepoChangesView; error?: string }>(
        `/repo/changes?cwd=${encodeURIComponent(cwd)}`,
      )
      if (data.ok && data.changes) {
        setChanges(data.changes)
        setChangesError('')
      } else {
        setChanges(null)
        // 405 = 运行中的 node 半边还是旧产物（node 侧不热重载），给出可操作的提示而不是干巴巴的失败。
        setChangesError(
          String(data.error ?? '').includes('不支持的请求方法')
            ? t('changesStaleNode')
            : data.error || t('changesFailed'),
        )
      }
    } catch (error) {
      setChanges(null)
      setChangesError((error as Error).message || t('changesFailed'))
    } finally {
      setChangesLoading(false)
    }
  }, [cwd, t])

  /** 轻提示：操作结果用 toast 反馈，不再往菜单里塞文字行。 */
  const showToast = useCallback((tone: 'ok' | 'error' | 'info', text: string) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    setToast({ tone, text })
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    setStatus(null)
    setDetectError('')
    setGraph(null)
    setGraphError('')
    setChanges(null)
    setChangesError('')
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

  // 改动明细只在确认是仓库后拉取；与提交图解耦，互不拖累。
  useEffect(() => {
    if (!cwd) {
      setChanges(null)
      setChangesError('')
      return
    }
    if (!status || !status.isRepo) return
    void loadChanges()
  }, [cwd, status?.isRepo, loadChanges])

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
      // 每次打开菜单都重新检测，避免用上一次的结果（尤其切换项目后）。
      void reload()
      // 已确认是仓库时同时刷新提交图与改动明细（切项目后也要跟着换）。
      if (status?.isRepo) {
        void loadGraph()
        void loadChanges()
      }
    }
    setOpen(next)
  }

  const runInit = async () => {
    setBusy(true)
    showToast('info', t('initRunning'))
    try {
      const data = await api<{ ok: boolean; error?: string; result?: { created?: boolean; branch?: string } }>('/repo/init', {
        cwd,
        branch: 'main',
      })
      if (data.ok) {
        const branch = data.result?.branch ? ' · ' + data.result.branch : ''
        // created=false 说明这里本来就有仓库（并发/已被别处初始化），不能说成「刚初始化」。
        showToast('ok', data.result?.created === false ? `${t('alreadyRepo')}${branch}` : `${t('initDone')}${branch}`)
        await reload()
      } else {
        showToast('error', data.error || t('initFailed'))
        // 失败后重查一次，避免界面停留在过期状态（例如目录已被别人初始化）。
        await reload()
      }
    } catch (error) {
      showToast('error', `${t('initFailed')}：${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  /** 打开项目目录（系统文件管理器）：走后端 /repo/open，替代原「复制目录路径」。 */
  const openDir = async () => {
    try {
      const data = await api<{ ok: boolean; error?: string }>(`/repo/open?cwd=${encodeURIComponent(cwd)}`)
      if (data.ok) showToast('ok', t('toastOpened'))
      else showToast('error', data.error || t('openFailed'))
    } catch (error) {
      showToast('error', `${t('openFailed')}：${(error as Error).message}`)
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

      {/* toast 放在菜单 portal 之外：菜单关闭后提示仍要留下。 */}
      {toast ? <Toast tone={toast.tone} text={toast.text} onDone={() => setToast(null)} /> : null}

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

          {/* 工作区改动明细：让用户不进终端也知道「现在到底改了什么」。 */}
          {isRepo ? (
            <>
              <span className="dgp-menu-sep" />
              <ChangesList t={t} changes={changes} loading={changesLoading} error={changesError} />
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

          {/* 打开 Git 工作台主面板（IDEA 式）：chip 的主行动。 */}
          <button
            type="button"
            className="dgp-menu-item"
            role="menuitem"
            data-primary="1"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpen(false)
              setWorkbench(true)
            }}
          >
            <BranchIcon />
            <span className="dgp-menu-item-main">
              <span className="dgp-menu-item-title">{t('wbTitle')}</span>
              <span className="dgp-menu-item-hint">{t('wbOpenHint')}</span>
            </span>
          </button>

          <button type="button" className="dgp-menu-item" role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); void openDir() }}>
            <FolderIcon />
            <span className="dgp-menu-item-main">
              <span className="dgp-menu-item-title">{t('menuOpenDir')}</span>
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
            </span>,
            document.body,
          )
        : null}

      {/* Git 工作台主面板（IDEA 式）：由 chip 打开，独立浮层 */}
      {workbench ? (
        <Workbench
          t={t}
          cwd={cwd}
          status={status}
          onStatusChange={(next) => setStatus(next)}
          onClose={() => {
            setWorkbench(false)
            void reload()
          }}
          onOpenSettings={() => void openSettingsSection({ shortcuts }, t('navLabel'))}
        />
      ) : null}
    </span>
  )
}


/** 仓库范围页「检测到的仓库」：列出授权根下扫描到的仓库，一键填入授权目录。 */
function ScopeDiscover({
  t,
  repos,
  loading,
  onReload,
  onUse,
}: {
  t: (key: string) => string
  repos: Array<{ root: string; name: string; branch: string; remotes: string[] }>
  loading: boolean
  onReload: () => void
  onUse: (root: string) => void
}) {
  return (
    <div className="dgp-group">
      <div className="dgp-group-title">{t('scopeDiscoverTitle')}</div>
      {loading ? (
        <Skeleton rows={2} />
      ) : repos.length === 0 ? (
        <div className="dgp-hint" style={{ padding: '2px 0 6px' }}>{t('scopeDiscoverEmpty')}</div>
      ) : (
        repos.map((repo) => (
          <div key={repo.root} className="dgp-line" style={{ padding: '9px 0' }}>
            <div className="dgp-line-main">
              <span className="dgp-name">{repo.name}</span>
              <span className="dgp-meta">
                <code>{repo.root}</code>
                {repo.branch ? <span>· {repo.branch}</span> : null}
                {repo.remotes.length > 0 ? <span>· {repo.remotes.join(', ')}</span> : <span>· {t('scopeDiscoverNoRemote')}</span>}
              </span>
            </div>
            <div className="dgp-line-side">
              <button type="button" className="dgp-btn" onClick={() => onUse(repo.root)}>{t('scopeDiscoverUse')}</button>
            </div>
          </div>
        ))
      )}
      <div className="dgp-line-side" style={{ paddingTop: 6 }}>
        <button type="button" className="dgp-btn ghost" onClick={onReload}>
          <RefreshIcon />
          {t('scopeDiscoverReload')}
        </button>
      </div>
    </div>
  )
}

function FolderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.8 4.5A1.5 1.5 0 0 1 3.3 3h3l1.5 1.7h4.9A1.5 1.5 0 0 1 14.2 6.2v5.3a1.5 1.5 0 0 1-1.5 1.5H3.3a1.5 1.5 0 0 1-1.5-1.5V4.5Z" />
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
  // 已在 exports.inject 声明 'shortcuts'，正常情况下 ctx.shortcuts 直接可用；
  // 仍保留 ctx.get 软取兜底，宿主降级时不至于整块崩掉。
  const shortcuts =
    (typeof ctx.get === 'function' ? ctx.get('shortcuts') : undefined) ?? ctx.shortcuts

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
