/**
 * client 半边（v3.2）：输入框左侧分支 chip + 点击弹层。
 * 弹层承载全部功能：只读状态（分支/领先落后/改动文件/最近提交）、动作按钮
 * （每个按钮把一条给 Agent 的指令注入宿主输入框，AI 经 git_write/git_confirm
 * 受控执行）、以及折叠区「账号与授权」（GitHub PAT/OAuth 连接、本地目录白名单、
 * 写策略开关）。宿主设置页不再有 Git 分节（v3.2 拍板：设置全部并入面板）。
 * 「直接提交」开关打开时注入后尝试代按发送按钮。
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import {
  NS,
  api,
  useStyles,
  Dot,
  fmt,
  readPref,
  writePref,
  subscribePref,
  injectCommand,
  PREF_AUTO_SUBMIT,
  type AccountView,
  type ChangeFileView,
  type Dict,
  type PanelState,
  type RepoChangesView,
  type RepoStatusView,
  type CommitRowView,
} from './shared.js'

export const inject = ['slots', 'sessions', 'locale']

const BUILD = 'dgp-v3.13'

// ─── 指令模板（乙案：AI 统一走插件的 git_write / git_confirm 受控通道）───
const TOOL_PREAMBLE =
  '请通过本项目的 Git 面板工具执行（调用 git_write，必要时接 git_confirm 完成确认；不要用裸 shell 绕过确认）。'

interface CommandSpec {
  id: string
  labelKey: string
  build: (cwd: string, extra?: string) => string
}

const COMMANDS: CommandSpec[] = [
  {
    id: 'stage-all',
    labelKey: 'cmdStageAll',
    build: (cwd) =>
      `${TOOL_PREAMBLE}在仓库 ${cwd} 用 git_write(action=add, args=["-A"]) 暂存全部改动，然后用 git_repo_info 复核并简述结果。`,
  },
  {
    id: 'commit',
    labelKey: 'cmdCommit',
    build: (cwd, extra) =>
      `${TOOL_PREAMBLE}在仓库 ${cwd} 先 git_diff(mode=staged) 看已暂存内容，总结一条规范的提交信息${extra ? `（意图补充：${extra}）` : ''}，再 git_write(action=commit, args=["-m", "<信息>"]) 提交。若暂存区为空，先提示我。`,
  },
  {
    id: 'push',
    labelKey: 'cmdPush',
    build: (cwd) =>
      `${TOOL_PREAMBLE}在仓库 ${cwd} 先 git_repo_info 确认分支与远端；无上游则 git_write(action=push, args=["-u","origin","<当前分支>"])，否则 git_write(action=push, args=[])。认证失败时如实汇报，不要索要或回显任何令牌。`,
  },
  {
    id: 'pull',
    labelKey: 'cmdPull',
    build: (cwd) =>
      `${TOOL_PREAMBLE}在仓库 ${cwd} 执行 git_write(action=pull, args=["--rebase"])（若明显有分叉风险改用默认 merge）；出现冲突立刻停下并汇报冲突文件清单，不要自行取舍。`,
  },
  {
    id: 'fetch',
    labelKey: 'cmdFetch',
    build: (cwd) => `${TOOL_PREAMBLE}在仓库 ${cwd} 执行 git_write(action=fetch, args=["--prune"])，然后汇报各分支领先/落后变化。`,
  },
  {
    id: 'branch-create',
    labelKey: 'cmdBranchCreate',
    build: (cwd, extra) =>
      `${TOOL_PREAMBLE}在仓库 ${cwd} 用 git_write(action=branch, args=["${extra || '<新分支名>'}"]) 基于当前 HEAD 新建分支，再 git_write(action=checkout, args=["${extra || '<新分支名>'}"]) 切过去。分支名未提供时先问我。`,
  },
  {
    id: 'branch-switch',
    labelKey: 'cmdBranchSwitch',
    build: (cwd, extra) =>
      `${TOOL_PREAMBLE}在仓库 ${cwd} 用 git_write(action=checkout, args=["${extra || '<目标分支>'}"]) 切换分支；工作区不干净导致失败时先向我说明，不要强制。分支名未提供时先列出 git_branches 让我选。`,
  },
  {
    id: 'discard',
    labelKey: 'cmdDiscard',
    build: (cwd, extra) =>
      `${TOOL_PREAMBLE}这是破坏性操作：先在回复里向用户复述将丢弃的文件（${extra || '<未跟踪/已修改文件>'}），得到确认后 git_write(action=restore, args=["--","<文件>"])；未跟踪文件用 clean 前必须再次单独确认。`,
  },
  {
    id: 'stash',
    labelKey: 'cmdStash',
    build: (cwd) => `${TOOL_PREAMBLE}在仓库 ${cwd} 执行 git_write(action=stash, args=[]) 贮藏当前改动，完成后汇报贮藏内容摘要。`,
  },
  {
    id: 'tag',
    labelKey: 'cmdTag',
    build: (cwd, extra) =>
      `${TOOL_PREAMBLE}在仓库 ${cwd} 用 git_write(action=tag, args=["${extra || '<vX.Y.Z>'}"]) 打标签；标签名未提供时先问我。推不推送远端由我决定，先别自动 push tag。`,
  },
  {
    id: 'init',
    labelKey: 'cmdInit',
    build: (cwd) =>
      `${TOOL_PREAMBLE}该目录还不是仓库：请在 ${cwd} 执行 git_write(action=init, args=["-b","main"]) 初始化本地仓库，完成后汇报。远程关联等我另行指示。`,
  },
  {
    // npm 发布不走 git_write（该通道仅限 git 子命令），由 AI 经 shell 按内嵌 SOP 执行；无参数占位，点击即注入。
    // 通用性红线（v3.7 拍板）：模板面向任意 DSH 作者的任意机器，禁止内嵌任何个人路径/个人环境假设；
    // 授权模型（v3.8 拍板）：对齐 git token 模式——用户点按钮即最终授权，此后 AI 全程自主跑到终验，不再逐步请示；
    // 仅两种「需人工」前置保留 fail-closed 停止（官方源未配凭据、目标版本已占用），此时输出需用户手动补的步骤清单。
    id: 'npm-publish',
    labelKey: 'cmdNpmPublish',
    build: (cwd) =>
      `请把当前项目（${cwd}）发布到 npm。我点这个按钮就是最终授权：此后你全程自主执行到终验完成，不要逐步回来问我，除非撞上下面两种「需要我手动处理」的前置失败。这是不可逆外部写操作，禁止凭 exit 0 判定发布成功。` +
      `1) 前置检查（两种可停情况）：a. 执行 npm whoami --registry=https://registry.npmjs.org——未登录/无凭据就停止，提示用户在本面板「账号与授权 → npm」卡里粘贴 token 连接（本插件会先向官方源验证、再写入 ~/.npmrc，等同 npm login；和配 git token 同理，配好一次之后全程就归你自动跑）；用户不便用面板时可指引 npm login；不得替用户登录、不得索要 token 到聊天里、不得回显任何 token；b. 带 ?nocache= 时间戳直查 https://registry.npmjs.org/<包名>（官方源为权威，勿经镜像），若我要发的版本已存在也停止并报告（name+version 永久占用不可复用）；` +
      `2) 自动执行段：读取 package.json 的 name/version/files 核对；若仓库存在多处版本声明（lockfile、源码常量）逐处比对，不一致停止并列出差异；npm pack --dry-run 取产物清单（写入最终汇报即可，不用停下等我过目）；然后直接执行 npm publish --registry=https://registry.npmjs.org --access=public（scoped 包必须显式 --access=public；不得修改我的任何配置文件）；` +
      `3) 自主终验：PUT 返回 202 只代表 staged，禁止重发；带 ?nocache= 轮询 packument 直至该版本出现，以 packument 为权威；` +
      `4) 失败分层归因（网络→身份→配置→实现），错误码会伪装（如 404 掩盖权限/邮箱问题），归因坐实前不重试；E401/ENEEDAUTH 优先核对是否漏钉官方源或凭据失效；` +
      `5) 一次性交付完整汇报：版本号、dist-tags、发布时间戳、产物清单、退出码证据。` +
      `6) 长期提醒（不阻塞本次）：npm 官方正把发布向 CI 可信发布迁移，长期 token 通道未来可能收紧；真撞上那天按第 4 步归因并向我说清迁移选项即可。`,
  },
]

// 动作分组（v3.11 重设计）：把平铺动作按工作流分 4 组，降低认知负荷、建立层次。
interface ActionGroup {
  labelKey: string
  ids: string[]
}
const ACTION_GROUPS: ActionGroup[] = [
  { labelKey: 'groupSync', ids: ['push', 'pull', 'fetch'] },
  { labelKey: 'groupChanges', ids: ['stage-all', 'commit', 'stash', 'discard'] },
  { labelKey: 'groupBranch', ids: ['branch-create', 'branch-switch', 'tag'] },
  { labelKey: 'groupPublish', ids: ['npm-publish'] },
]

const ZH: Dict = {
  entry: 'Git',
  navLabel: 'Git',
  panelTitle: 'Git 面板',
  refresh: '刷新',
  close: '关闭',
  notRepo: '当前会话目录不是 Git 仓库',
  notRepoHint: '可让 AI 初始化仓库（下方「动作」区有对应按钮）。',
  changedFiles: '改动文件',
  noChanges: '工作区干净',
  recentCommits: '最近提交',
  noCommits: '还没有提交',
  actions: '动作（生成指令给 AI 执行）',
  groupSync: '同步',
  groupChanges: '改动',
  groupBranch: '分支与标签',
  groupPublish: '发布',
  inputHint: '可改词后再回车；指令只是发起，写操作仍受确认约束。',
  autoSubmit: '直接提交（注入后代按发送）',
  // 折叠区：账号与授权
  gear: '账号与授权',
  account: 'GitHub 账号',
  noAccount: '未连接账号（不影响本地 git 操作）',
  acctConnected: '已连接',
  acctExpired: '已失效',
  acctError: '凭据异常',
  connectAccount: '连接账号',
  methodPat: 'PAT 令牌',
  methodOauth: 'OAuth 设备码',
  tokenLabel: '访问令牌',
  tokenPlaceholder: '粘贴 PAT（保存后不再回显）',
  labelLabel: '备注名（可选）',
  clientIdLabel: 'OAuth App Client ID',
  clientIdHint: '本插件不内置任何应用凭据：需你自建 GitHub OAuth App 并填入 Client ID。',
  userCode: '浏览器打开下面的地址并输入代码完成授权',
  waiting: '等待授权…',
  npmAccount: 'npm 发布账号',
  npmNoAccount: '未配置 npm 凭据（发布按钮会提示先配置）',
  npmConnect: '连接 npm',
  npmAdd: '添加凭据',
  npmSwitch: '切换',
  npmActive: '当前',
  npmReconnect: '重新连接',
  npmError: '凭据校验失败',
  npmTokenLabel: 'npm token',
  npmTokenHint: '在 npmjs.com → Access Tokens 生成；验证通过后写入 ~/.npmrc（等同 npm login），保存后不再回显。',
  npmTokenPlaceholder: '粘贴 npm token（npm_ 或旧式长 hex 均可）',
  connect: '连接',
  cancel: '取消',
  disconnect: '断开',
  recheck: '校验',
  injected: '指令已放入输入框',
  injectedSubmitted: '指令已提交给 AI',
  injectFailed: '注入失败',
  detectFailed: '无法检测仓库状态',
  retry: '重新检测',
  allowWrite: '允许 Agent 修改仓库',
  allowWriteHint: '总开关：关闭时 git_write 一律拒绝。',
  requireConfirm: '写操作前需要我确认',
  requireConfirmHint: '开启时 git_write 返回 confirmToken，你确认后 AI 才能调 git_confirm 执行。',
  cmdStageAll: '暂存全部',
  cmdCommit: '提交…',
  cmdPush: '推送',
  cmdPull: '拉取',
  cmdFetch: '抓取',
  cmdBranchCreate: '新建分支…',
  cmdBranchSwitch: '切换分支…',
  cmdDiscard: '丢弃改动…',
  cmdStash: '贮藏',
  cmdTag: '打标签…',
  cmdInit: '初始化仓库',
  cmdNpmPublish: '发布 npm',
  askParam: '填入参数',
  commitIntent: '提交意图（可留空）',
  branchName: '分支名',
  discardFiles: '要丢弃的文件（空格分隔）',
  tagName: '标签名',
}

const EN: Dict = {
  entry: 'Git',
  navLabel: 'Git',
  panelTitle: 'Git Panel',
  refresh: 'Refresh',
  close: 'Close',
  notRepo: 'This session directory is not a Git repository',
  notRepoHint: 'Let the AI init a repo (button below).',
  changedFiles: 'Changed files',
  noChanges: 'Working tree clean',
  recentCommits: 'Recent commits',
  noCommits: 'No commits yet',
  actions: 'Actions (inject a command for the AI)',
  groupSync: 'Sync',
  groupChanges: 'Changes',
  groupBranch: 'Branch & tags',
  groupPublish: 'Publish',
  inputHint: 'You can edit before pressing Enter; writes stay confirm-gated.',
  autoSubmit: 'Auto submit (press send after injecting)',
  gear: 'Accounts & Access',
  account: 'GitHub account',
  noAccount: 'No account connected (local git still works)',
  acctConnected: 'Connected',
  acctExpired: 'Expired',
  acctError: 'Credential error',
  connectAccount: 'Connect account',
  methodPat: 'PAT token',
  methodOauth: 'OAuth device flow',
  tokenLabel: 'Access token',
  tokenPlaceholder: 'Paste PAT (never shown again after save)',
  labelLabel: 'Label (optional)',
  clientIdLabel: 'OAuth App Client ID',
  clientIdHint: 'No third-party app credential is bundled: create your own GitHub OAuth App and paste its Client ID.',
  userCode: 'Open the URL below in a browser and enter the code',
  waiting: 'Waiting for authorization…',
  npmAccount: 'npm publishing accounts',
  npmNoAccount: 'No npm credential (the publish button will tell you to set one up)',
  npmConnect: 'Connect npm',
  npmAdd: 'Add credential',
  npmSwitch: 'Switch',
  npmActive: 'Active',
  npmReconnect: 'Reconnect',
  npmError: 'Credential check failed',
  npmTokenLabel: 'npm token',
  npmTokenHint: 'Create one at npmjs.com → Access Tokens; after verification it is written to ~/.npmrc (same as npm login) and never shown again.',
  npmTokenPlaceholder: 'Paste npm token (npm_ or legacy long hex)',
  connect: 'Connect',
  cancel: 'Cancel',
  disconnect: 'Disconnect',
  recheck: 'Recheck',
  injected: 'Command placed in the input box',
  injectedSubmitted: 'Command sent to the AI',
  injectFailed: 'Inject failed',
  detectFailed: 'Cannot detect repository status',
  retry: 'Check again',
  allowWrite: 'Allow the agent to modify repositories',
  allowWriteHint: 'Master switch: git_write refuses when off.',
  requireConfirm: 'Ask me before every write',
  requireConfirmHint: 'git_write returns a confirmToken you must approve via git_confirm.',
  cmdStageAll: 'Stage all',
  cmdCommit: 'Commit…',
  cmdPush: 'Push',
  cmdPull: 'Pull',
  cmdFetch: 'Fetch',
  cmdBranchCreate: 'New branch…',
  cmdBranchSwitch: 'Switch branch…',
  cmdDiscard: 'Discard…',
  cmdStash: 'Stash',
  cmdTag: 'Tag…',
  cmdInit: 'Init repo',
  cmdNpmPublish: 'Publish to npm',
  askParam: 'Fill parameter',
  commitIntent: 'Commit intent (optional)',
  branchName: 'Branch name',
  discardFiles: 'Files to discard (space separated)',
  tagName: 'Tag name',
}

interface SessionsService {
  list?: {
    subscribe?: (listener: () => void) => () => void
    getSnapshot?: () => { byId?: Record<string, { cwd?: string }> }
  }
}

interface ClientContext {
  slots?: {
    inject?: (name: string, factory: () => any) => void
    register?: (options: any, component: any) => any
  }
  locale?: {
    register?: (namespace: string, dicts: Record<string, Dict>) => void
    bind?: (namespace: string) => (key: string) => string
  }
  sessions?: SessionsService
  get?: (name: string) => any
  logger?: { info?: (msg: string) => void; warn?: (msg: string) => void; error?: (msg: string) => void }
  effect?: (fn: () => void, label?: string) => void
}

function useSessionCwd(sessions: SessionsService | undefined, sessionId: string): string {
  const subscribe = useMemo(
    () => (listener: () => void) => {
      try {
        const list = sessions?.list
        return typeof list?.subscribe === 'function' ? list.subscribe(listener) : () => {}
      } catch {
        return () => {}
      }
    },
    [sessions],
  )
  const get = useCallback(() => {
    try {
      if (!sessionId || !sessions) return ''
      const value = sessions.list?.getSnapshot?.()?.byId?.[sessionId]?.cwd
      return typeof value === 'string' ? value : ''
    } catch {
      return ''
    }
  }, [sessionId, sessions])
  return useSyncExternalStore(subscribe, get, () => '')
}

// ─── 折叠区：账号与授权（原设置页分节全部内容并入面板）───

function GearSection({ t, accounts, onAccounts }: { t: (key: string) => string; accounts: AccountView[]; onAccounts: (next: AccountView[]) => void }) {
  const [flags, setFlags] = useState<{ allowWrite: boolean; requireConfirm: boolean } | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [method, setMethod] = useState<'pat' | 'oauth'>('pat')
  const [token, setToken] = useState('')
  const [label, setLabel] = useState('')
  const [clientId, setClientId] = useState('')
  const [busy, setBusy] = useState(false)
  const [oauthFlow, setOauthFlow] = useState<{ verificationUri: string; userCode: string } | null>(null)
  const [error, setError] = useState('')
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current)
    }
  }, [])

  // 首次展开时拉一次 state；之后账号变更由父级同步进来。
  const ensureLoaded = useCallback(async () => {
    if (flags !== null) return
    try {
      const data = await api<{ ok: boolean; state?: PanelState }>('/state')
      if (data.ok && data.state) {
        setFlags({ allowWrite: data.state.settings.allowWrite, requireConfirm: data.state.settings.requireConfirm })
        onAccounts(data.state.accounts)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }, [flags, onAccounts])

  const applySettings = async (patch: Record<string, unknown>) => {
    try {
      const data = await api<{ ok: boolean; state?: PanelState; error?: string }>('/settings', patch)
      if (data.ok && data.state) {
        onAccounts(data.state.accounts)
        if (data.state.settings) setFlags({ allowWrite: data.state.settings.allowWrite, requireConfirm: data.state.settings.requireConfirm })
        return data.state
      }
      setError(data.error ?? t('detectFailed'))
    } catch (err) {
      setError((err as Error).message)
    }
    return null
  }

  const toggleFlag = async (key: 'allowWrite' | 'requireConfirm', value: boolean) => {
    await applySettings({ [key]: value })
  }

  const connectPat = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ ok: boolean; error?: string; state?: PanelState }>('/pat/connect', { token, label })
      if (data.ok && data.state) {
        onAccounts(data.state.accounts)
        setConnectOpen(false)
        setToken('')
      } else {
        setError(data.error ?? t('injectFailed'))
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const startOauth = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{
        ok: boolean
        error?: string
        pollKey?: string
        flow?: { userCode: string; verificationUri: string }
      }>('/oauth/start', { clientId })
      if (!data.ok || !data.pollKey || !data.flow) {
        setError(data.error ?? t('detectFailed'))
        return
      }
      setOauthFlow({ userCode: data.flow.userCode, verificationUri: data.flow.verificationUri })
      const pollKey = data.pollKey
      pollRef.current = window.setInterval(async () => {
        try {
          const res = await api<{ ok: boolean; status?: string; state?: PanelState; error?: string }>('/oauth/poll', { pollKey })
          if (res.status === 'authorized' && res.state) {
            if (pollRef.current !== null) window.clearInterval(pollRef.current)
            onAccounts(res.state.accounts)
            setConnectOpen(false)
            setOauthFlow(null)
          } else if (res.status === 'denied' || res.status === 'expired' || res.status === 'error') {
            if (pollRef.current !== null) window.clearInterval(pollRef.current)
            setError(res.error ?? t('injectFailed'))
            setOauthFlow(null)
          }
        } catch {
          /* 网络抖动：下一轮再试 */
        }
      }, 4000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const accountAction = async (action: 'remove' | 'recheck', id: string) => {
    try {
      const data = await api<{ ok: boolean; state?: PanelState }>(`/accounts/${action}`, { id })
      if (data.state) onAccounts(data.state.accounts)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="dgp-sect" onPointerEnter={() => void ensureLoaded()}>
      <details
        onToggle={(e) => {
          if ((e.target as HTMLDetailsElement).open) void ensureLoaded()
        }}
      >
        <summary className="dgp-sect-title" style={{ cursor: 'pointer' }}>{t('gear')}</summary>
        {error && <div className="dgp-empty" role="alert">{error} <button type="button" className="dgp-iconbtn" aria-label={t('close')} onClick={() => setError('')}><CloseGlyph /></button></div>}

        <div className="dgp-sect-title" style={{ marginTop: 6 }}>{t('account')}</div>
        {accounts.map((account) => (
          <div key={account.id} className="dgp-account">
            <Dot state={account.status} />
            <span className="dgp-acct-login" title={account.login}>{account.login}</span>
            <span className="dgp-muted">{account.kind === 'oauth' ? 'OAuth' : 'PAT'} · {t(account.status === 'expired' ? 'acctExpired' : account.status === 'error' ? 'acctError' : 'acctConnected')}</span>
            <span className="dgp-spacer" />
            <button type="button" className="dgp-btn" onClick={() => void accountAction('recheck', account.id)}>{t('recheck')}</button>
            <button type="button" className="dgp-btn" onClick={() => void accountAction('remove', account.id)}>{t('disconnect')}</button>
          </div>
        ))}
        {accounts.length === 0 && <div className="dgp-empty">{t('noAccount')}</div>}
        <button type="button" className="dgp-btn" style={{ marginTop: 6 }} onClick={() => setConnectOpen(!connectOpen)}>{t('connectAccount')}</button>
        {connectOpen && (
          <div className="dgp-card">
            <div className="dgp-btnrow" style={{ marginBottom: 8 }}>
              <button type="button" className="dgp-btn" onClick={() => setMethod('pat')} style={method === 'pat' ? { borderColor: 'var(--dsh-accent, #4a9eff)' } : undefined}>{t('methodPat')}</button>
              <button type="button" className="dgp-btn" onClick={() => setMethod('oauth')} style={method === 'oauth' ? { borderColor: 'var(--dsh-accent, #4a9eff)' } : undefined}>{t('methodOauth')}</button>
            </div>
            {method === 'pat' ? (
              <>
                <div className="dgp-sect-title">{t('tokenLabel')}</div>
                <input className="dgp-input" type="password" autoComplete="off" aria-label={t('tokenLabel')} placeholder={t('tokenPlaceholder')} value={token} onChange={(e) => setToken(e.target.value)} />
                <div className="dgp-sect-title" style={{ marginTop: 6 }}>{t('labelLabel')}</div>
                <input className="dgp-input" aria-label={t('labelLabel')} value={label} onChange={(e) => setLabel(e.target.value)} />
                <div className="dgp-btnrow" style={{ marginTop: 8 }}>
                  <button type="button" className="dgp-btn" disabled={busy || token.trim().length === 0} onClick={() => void connectPat()}>{t('connect')}</button>
                  <button type="button" className="dgp-btn" onClick={() => setConnectOpen(false)}>{t('cancel')}</button>
                </div>
              </>
            ) : (
              <>
                <div className="dgp-sect-title">{t('clientIdLabel')}</div>
                <div className="dgp-muted">{t('clientIdHint')}</div>
                <input className="dgp-input" aria-label={t('clientIdLabel')} value={clientId} onChange={(e) => setClientId(e.target.value)} />
                {oauthFlow ? (
                  <div style={{ marginTop: 8 }}>
                    <div className="dgp-muted">{t('userCode')}</div>
                    <div className="dgp-file"><a href={oauthFlow.verificationUri} target="_blank" rel="noreferrer">{oauthFlow.verificationUri}</a></div>
                    <div className="dgp-code">{oauthFlow.userCode}</div>
                    <div className="dgp-muted">{t('waiting')}</div>
                  </div>
                ) : (
                  <div className="dgp-btnrow" style={{ marginTop: 8 }}>
                    <button type="button" className="dgp-btn" disabled={busy || clientId.trim().length === 0} onClick={() => void startOauth()}>{t('connect')}</button>
                    <button type="button" className="dgp-btn" onClick={() => setConnectOpen(false)}>{t('cancel')}</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <NpmCard t={t} />

        <div style={{ marginTop: 8 }}>
          <label className="dgp-toggle">
            <input type="checkbox" checked={flags?.allowWrite === true} disabled={flags === null} onChange={(e) => void toggleFlag('allowWrite', e.target.checked)} />
            {t('allowWrite')}
          </label>
          <label className="dgp-toggle" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={flags?.requireConfirm !== false} disabled={flags === null} onChange={(e) => void toggleFlag('requireConfirm', e.target.checked)} />
            {t('requireConfirm')}
          </label>
        </div>
      </details>
    </div>
  )
}

// ─── npm 凭据卡（v3.10 多账号 + 切换）：像连 GitHub 账号一样连 npm ───
// 表里可存多个 npm token（node 侧密文），active 账号由 node 同步写入 ~/.npmrc 供 npm publish 使用。
// 首次读状态时 node 会把 ~/.npmrc 里既有的官方源 token 惰性收编为首个账号（v3.9/手动 npm login 不断档）。

interface NpmAccountRow {
  id: string
  login: string
  masked: string
  active: boolean
  state: 'connected' | 'error' | 'saved'
  error: string
}

interface NpmStatusView {
  accounts: NpmAccountRow[]
  activeState: 'connected' | 'error'
  activeError: string
  npmrcConfigured: boolean
}

function NpmCard({ t }: { t: (key: string) => string }) {
  const [view, setView] = useState<NpmStatusView | null>(null)
  const [token, setToken] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api<{ ok: boolean; npm?: NpmStatusView }>('/npm/status', {})
      if (data.ok && data.npm) setView(data.npm)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const connect = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ ok: boolean; login?: string; error?: string }>('/npm/connect', { token })
      if (data.ok) {
        setOpen(false)
        setToken('')
        await load()
      } else {
        setError(data.error ?? t('injectFailed'))
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const switchTo = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ ok: boolean; error?: string }>('/npm/switch', { id })
      if (!data.ok) setError(data.error ?? t('injectFailed'))
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ ok: boolean; error?: string }>('/npm/remove', { id })
      if (!data.ok) setError(data.error ?? t('injectFailed'))
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const rows = view?.accounts ?? []

  return (
    <div className="dgp-sect">
      <div className="dgp-sect-title">{t('npmAccount')}</div>
      {error && <div className="dgp-empty" role="alert">{error}</div>}
      {rows.map((row) => (
        <div key={row.id} className="dgp-account">
          <Dot state={row.active ? row.state === 'error' ? 'error' : 'connected' : 'connected'} />
          <span className="dgp-acct-login" title={row.login}>{row.login}</span>
          <span className="dgp-muted">{row.active ? t('npmActive') : row.state === 'error' && row.error ? row.error : row.masked}</span>
          <span className="dgp-spacer" />
          {!row.active && (
            <button type="button" className="dgp-btn" disabled={busy} onClick={() => void switchTo(row.id)}>{t('npmSwitch')}</button>
          )}
          <button type="button" className="dgp-btn dgp-btn-danger" disabled={busy} onClick={() => void remove(row.id)}>{t('disconnect')}</button>
        </div>
      ))}
      {rows.length === 0 && <div className="dgp-empty">{t('npmNoAccount')}</div>}
      {rows.length > 0 && view?.activeState === 'error' && (
        <div className="dgp-muted">{t('npmError')}: {view.activeError}</div>
      )}
      {!open && (
        <button type="button" className="dgp-btn" style={{ marginTop: 6 }} onClick={() => setOpen(true)}>
          {rows.length === 0 ? t('npmConnect') : t('npmAdd')}
        </button>
      )}
      {open && (
        <div className="dgp-card">
          <div className="dgp-sect-title">{t('npmTokenLabel')}</div>
          <div className="dgp-muted">{t('npmTokenHint')}</div>
          <input className="dgp-input" type="password" autoComplete="off" aria-label={t('npmTokenLabel')} placeholder={t('npmTokenPlaceholder')} value={token} onChange={(e) => setToken(e.target.value)} />
          <div className="dgp-btnrow" style={{ marginTop: 8 }}>
            <button type="button" className="dgp-btn" disabled={busy || token.trim().length === 0} onClick={() => void connect()}>{t('connect')}</button>
            <button type="button" className="dgp-btn" onClick={() => setOpen(false)}>{t('cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 面板头图标（同一 stroke/weight 的绘制 SVG，替代 Unicode 字符）───

function RefreshGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
      <path d="M13.5 1.5v3h-3" />
    </svg>
  )
}

function CloseGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

// ─── chip + 弹层 ───

function BranchChip({ t, sessionId, sessions }: { t: (key: string) => string; sessionId: string; sessions?: SessionsService }) {
  useStyles()
  const [status, setStatus] = useState<RepoStatusView | null>(null)
  const [files, setFiles] = useState<ChangeFileView[]>([])
  const [commits, setCommits] = useState<CommitRowView[]>([])
  const [accounts, setAccounts] = useState<AccountView[]>([])
  const [detectError, setDetectError] = useState('')
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [toast, setToast] = useState<string>('')
  const [autoSubmit, setAutoSubmit] = useState(() => readPref(PREF_AUTO_SUBMIT, '0') === '1')
  const [prompt, setPrompt] = useState<CommandSpec | null>(null)
  const [promptValue, setPromptValue] = useState('')
  const toastTimer = useRef<number | null>(null)
  const chipRef = useRef<HTMLSpanElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState({ left: 0, bottom: 0 })

  const cwd = useSessionCwd(sessions, sessionId)

  // Escape 关面板/退参数行（键盘可达性）。
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (prompt) {
        setPrompt(null)
        e.stopPropagation()
      } else {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, prompt])

  useEffect(() => {
    const stop = subscribePref(() => setAutoSubmit(readPref(PREF_AUTO_SUBMIT, '0') === '1'))
    return stop
  }, [])

  const showToast = useCallback((text: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    setToast(text)
    toastTimer.current = window.setTimeout(() => setToast(''), 2400)
  }, [])

  const reload = useCallback(async () => {
    if (!cwd) {
      setStatus(null)
      setFiles([])
      setCommits([])
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
        if (data.status.isRepo) {
          const [changes, log, state] = await Promise.all([
            api<{ ok: boolean; changes?: RepoChangesView }>(`/repo/changes?cwd=${encodeURIComponent(cwd)}`).catch(() => null),
            api<{ ok: boolean; commits?: CommitRowView[] }>(`/repo/commits?cwd=${encodeURIComponent(cwd)}&limit=5`).catch(() => null),
            api<{ ok: boolean; state?: PanelState }>('/state').catch(() => null),
          ])
          setFiles(changes?.changes?.files ?? [])
          setCommits(log?.commits ?? [])
          if (state?.state?.accounts) setAccounts(state.state.accounts)
        } else {
          setFiles([])
          setCommits([])
        }
      } else {
        setStatus(null)
        setDetectError(data.error || t('detectFailed'))
      }
    } catch (error) {
      setStatus(null)
      setDetectError((error as Error).message || t('detectFailed'))
    } finally {
      setChecking(false)
    }
  }, [cwd, t])

  // 策略同旧版：cwd 变化 / 窗口聚焦 / 打开面板时刷新，不做轮询。
  useEffect(() => {
    setStatus(null)
    setDetectError('')
    if (!cwd) return
    let alive = true
    const load = () => {
      if (alive && document.visibilityState !== 'hidden') void reload()
    }
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      window.removeEventListener('focus', onFocus)
    }
  }, [cwd, reload])

  const toggle = () => {
    const next = !open
    if (next && chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect()
      setAnchor({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 392)), bottom: window.innerHeight - rect.top + 6 })
    }
    setOpen(next)
    if (next) {
      void reload()
      // 面板 portal 在 body 末尾：打开即把焦点移入，Tab 顺序才不绕全页（P1-5 审计）。
      requestAnimationFrame(() => panelRef.current?.focus())
    } else {
      chipRef.current?.focus()
    }
  }

  const runCommand = useCallback(
    async (spec: CommandSpec, extra?: string) => {
      if (!cwd) return
      const text = spec.build(cwd, extra)
      const result = await injectCommand(text, autoSubmit)
      if (result.ok) {
        showToast(result.submitted ? t('injectedSubmitted') : t('injected'))
        setOpen(false)
      } else {
        showToast(`${t('injectFailed')}：${result.error ?? ''}`)
      }
    },
    [cwd, autoSubmit, t, showToast],
  )

  const onActionClick = (spec: CommandSpec) => {
    if (['stage-all', 'push', 'pull', 'fetch', 'stash', 'init', 'npm-publish'].includes(spec.id)) {
      void runCommand(spec)
    } else {
      setPrompt(spec)
      setPromptValue('')
    }
  }

  const isRepo = status?.isRepo === true
  const branchLabel = isRepo
    ? status!.detached
      ? `HEAD @ ${status!.head.slice(0, 7)}`
      : status!.branch || '—'
    : '—'

  // 参数行出现时滚动到底部，防止被 GearSection 展开挤出视口（P1-6）。
  useEffect(() => {
    if (prompt && panelRef.current) panelRef.current.scrollTop = panelRef.current.scrollHeight
  }, [prompt])

  return (
    <span className="dgp-root" ref={chipRef}>
      <button
        type="button"
        className="dgp-chip"
        title={isRepo ? `Git · ${branchLabel}` : detectError || t('entry')}
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? 'dgp-panel' : undefined}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="5" cy="4" r="2" />
          <circle cx="5" cy="12" r="2" />
          <circle cx="11" cy="7" r="2" />
          <path d="M5 6v4M7 7h2M11 9v1a3 3 0 0 1-3 3H7" />
        </svg>
        <span className="dgp-chip-label">Git</span>
        <span className="dgp-chip-sep" aria-hidden="true">·</span>
        <span className="dgp-chip-branch">
          {checking && !status ? '…' : branchLabel}
        </span>
        {isRepo && (
          <span className="dgp-chip-badge">
            {status!.changed > 0 && <span className="dgp-badge dgp-badge-warn">{status!.changed}*</span>}
            {status!.ahead > 0 && <span className="dgp-badge dgp-badge-ok">↑{status!.ahead}</span>}
            {status!.behind > 0 && <span className="dgp-badge dgp-badge-info">↓{status!.behind}</span>}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id="dgp-panel"
            tabIndex={-1}
            role="dialog"
            aria-label={t('panelTitle')}
            className="dgp-panel"
            style={{ left: anchor.left, bottom: anchor.bottom }}
            onMouseLeave={() => {
              // 折叠区里有输入焦点时不因鼠标离开关闭（避免填一半令牌就掉面板）。
              const active = document.activeElement
              if (active && panelRef.current?.contains(active)) return
              setOpen(false)
            }}
          >
            <div className="dgp-head">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="5" cy="4" r="2" /><circle cx="5" cy="12" r="2" /><circle cx="11" cy="7" r="2" />
                <path d="M5 6v4M7 7h2M11 9v1a3 3 0 0 1-3 3H7" />
              </svg>
              <span className="dgp-title">{t('panelTitle')}</span>
              <span className="dgp-spacer" />
              <button type="button" className="dgp-iconbtn" title={t('refresh')} aria-label={t('refresh')} onClick={() => void reload()}><RefreshGlyph /></button>
              <button type="button" className="dgp-iconbtn" title={t('close')} aria-label={t('close')} onClick={() => setOpen(false)}><CloseGlyph /></button>
            </div>
            {isRepo && (
              <div className="dgp-statusbar">
                <span className="dgp-status-dot" data-state={status!.changed > 0 ? 'dirty' : 'clean'} role="img" aria-label={status!.changed > 0 ? t('changedFiles') : t('noChanges')} />
                <span className="dgp-status-branch" title={branchLabel}>{branchLabel}</span>
                <span className="dgp-status-meta">
                  {status!.ahead > 0 ? `↑${status!.ahead} ` : ''}{status!.behind > 0 ? `↓${status!.behind} ` : ''}{status!.changed > 0 ? `${status!.changed}*` : t('noChanges')}
                </span>
              </div>
            )}
            <div className="dgp-toolbar">
              <label className="dgp-toggle" title={t('autoSubmit')}>
                <input
                  type="checkbox"
                  checked={autoSubmit}
                  onChange={(e) => {
                    setAutoSubmit(e.target.checked)
                    writePref(PREF_AUTO_SUBMIT, e.target.checked ? '1' : '0')
                  }}
                />
                {t('autoSubmit')}
              </label>
            </div>

            {detectError && !isRepo && (
              <div className="dgp-sect">
                <div className="dgp-empty">{detectError} <button type="button" className="dgp-btn" onClick={() => void reload()}>{t('retry')}</button></div>
              </div>
            )}

            {!isRepo && !detectError && cwd && (
              <div className="dgp-sect">
                <div className="dgp-empty">{t('notRepo')}</div>
                <div className="dgp-muted">{t('notRepoHint')}</div>
                <div className="dgp-btnrow" style={{ marginTop: 6 }}>
                  <button type="button" className="dgp-btn" onClick={() => onActionClick(COMMANDS.find((c) => c.id === 'init')!)}>{t('cmdInit')}</button>
                </div>
              </div>
            )}

            {isRepo && (
              <>
                <div className="dgp-sect">
                  <div className="dgp-sect-title">{t('changedFiles')} ({files.length})</div>
                  {files.length === 0 && <div className="dgp-empty">{t('noChanges')}</div>}
                  {files.slice(0, 12).map((file) => (
                    <div key={file.path} className="dgp-file" title={file.path}>
                      <span className="dgp-file-status">{file.staged ? file.worktree === 'M' ? 'MM' : 'M' : file.untracked ? '?' : file.worktree}</span>
                      <span className="dgp-file-path">{file.path.length > 48 ? '…' + file.path.slice(-47) : file.path}</span>
                      <span className="dgp-file-stat">{file.added > 0 ? `+${file.added}` : ''}{file.deleted > 0 ? ` -${file.deleted}` : ''}</span>
                    </div>
                  ))}
                  {files.length > 12 && <div className="dgp-muted">…{files.length - 12}</div>}
                </div>

                <div className="dgp-sect">
                  <div className="dgp-sect-title">{t('recentCommits')}</div>
                  {commits.length === 0 && <div className="dgp-empty">{t('noCommits')}</div>}
                  {commits.map((commit) => (
                    <div key={commit.hash} className="dgp-row-line" title={`${commit.subject} (${commit.author}, ${commit.date})`}>
                      <span className="dgp-hash">{commit.hash}</span>
                      {commit.subject}
                    </div>
                  ))}
                </div>

                <div className="dgp-sect">
                  <div className="dgp-sect-title">{t('actions')}</div>
                  {ACTION_GROUPS.map((group) => (
                    <div key={group.labelKey} className="dgp-btn-group">
                      <div className="dgp-group-label">{t(group.labelKey)}</div>
                      <div className="dgp-btnrow">
                        {group.ids.map((id) => {
                          const command = COMMANDS.find((c) => c.id === id)!
                          let cls = 'dgp-btn'
                          if (id === 'push') cls += ' dgp-btn-primary'
                          if (id === 'npm-publish') cls += ' dgp-btn-accent'
                          if (id === 'discard') cls += ' dgp-btn-danger'
                          return (
                            <button key={id} type="button" className={cls} onClick={() => onActionClick(command)}>
                              {t(command.labelKey)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="dgp-muted" style={{ marginTop: 10 }}>{t('inputHint')}</div>
                </div>
              </>
            )}

            <GearSection t={t} accounts={accounts} onAccounts={setAccounts} />

            {prompt && (
              <div className="dgp-sect dgp-card">
                <div className="dgp-sect-title">{t(prompt.labelKey).replace('…', '')} · {t('askParam')}</div>
                <input
                  className="dgp-input"
                  autoFocus
                  aria-label={t(prompt.labelKey).replace('…', '')}
                  placeholder={
                    prompt.id === 'commit' ? t('commitIntent')
                      : prompt.id === 'discard' ? t('discardFiles')
                        : prompt.id === 'tag' ? t('tagName')
                          : t('branchName')
                  }
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const spec = prompt
                      setPrompt(null)
                      void runCommand(spec, promptValue.trim() || undefined)
                    } else if (e.key === 'Escape') {
                      setPrompt(null)
                    }
                  }}
                />
                <div className="dgp-btnrow" style={{ marginTop: 6 }}>
                  <button type="button" className="dgp-btn" onClick={() => { const spec = prompt; setPrompt(null); void runCommand(spec, promptValue.trim() || undefined) }}>OK</button>
                  <button type="button" className="dgp-btn" onClick={() => setPrompt(null)}>{t('cancel')}</button>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}

      {toast && createPortal(<div className="dgp-toast" role="status">{toast}</div>, document.body)}
    </span>
  )
}

export function apply(ctx: ClientContext): void {
  let t: (key: string) => string = (key: string) => ZH[key] ?? EN[key] ?? key
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

  // v3.2 拍板：不注册 settings.section —— 全部设置并入 chip 弹层的「账号与授权」折叠区。
  // 输入框左侧 chip。
  try {
    ctx.slots?.inject?.('conversation.input.left', () => {
      try {
        return ctx.slots?.register?.(
          {
            name: 'conversation.input.left',
            id: 'dsh-git-panel-branch',
            order: 30,
            locale: NS,
            inject: (sessionId: string) => ({ t, sessionId, sessions }),
          },
          BranchChip,
        )
      } catch (error) {
        ctx.logger?.error?.(`[${NS}] 入口注册失败：${String(error)}`)
        return undefined
      }
    })
    ctx.logger?.info?.(`[${NS}] 分支 chip 已注册（${BUILD}）`)
  } catch (error) {
    ctx.logger?.error?.(`[${NS}] conversation.input.left 注入失败：${String(error)}`)
  }
}

// 保留导出名便于门禁脚本静态引用。
export { fmt }
