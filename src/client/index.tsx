/**
 * client 半边（v3 极简化）：输入框左侧分支 chip + 点击弹层。
 * 弹层只做两件事：展示只读状态（分支/领先落后/改动文件/最近提交/账号），
 * 以及「动作按钮」——每个按钮把一条给 Agent 的自然语言指令注入输入框
 * （指令要求 AI 走 git_write / git_confirm 受控工具执行），绝不本地直接写仓库。
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

export const inject = ['slots', 'sessions', 'locale', 'shortcuts']

const BUILD = 'dgp-v3-slim'

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
      `${TOOL_PREAMBLE}在仓库 ${cwd} 用 git_write(action=add, args=["-A"]) 暂存全部改动，然后用 git_panel_status/git_repo_info 复核并简述结果。`,
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
]

const ZH: Dict = {
  entry: 'Git',
  navLabel: 'Git',
  panelTitle: 'Git 面板',
  refresh: '刷新',
  close: '关闭',
  notRepo: '当前会话目录不是 Git 仓库',
  notRepoHint: '可让 AI 初始化仓库，或在设置里把该目录加入授权范围。',
  unauthorized: '该目录不在授权范围内（设置 → Git → 本地目录）',
  branch: '分支',
  ahead: '领先',
  behind: '落后',
  changedFiles: '改动文件',
  noChanges: '工作区干净',
  recentCommits: '最近提交',
  noCommits: '还没有提交',
  actions: '动作（生成指令给 AI 执行）',
  inputHint: '可改词后再回车；指令只是发起，写操作仍受确认约束。',
  autoSubmit: '直接提交（注入后代按发送）',
  account: 'GitHub 账号',
  noAccount: '未连接账号（不影响本地 git 操作）',
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
  connect: '连接',
  cancel: '取消',
  disconnect: '断开',
  recheck: '校验',
  copied: '已复制',
  injected: '指令已放入输入框',
  injectedSubmitted: '指令已提交给 AI',
  injectFailed: '注入失败',
  detectFailed: '无法检测仓库状态',
  retry: '重新检测',
  settingsTitle: 'Git 设置（v3 精简）',
  rootsTitle: '允许操作的本地目录',
  rootsHint: '每行一个绝对路径；* 表示不限制。AI 只在这些目录（含子目录）内执行 git。',
  save: '保存',
  saved: '已保存',
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
  notRepoHint: 'Let the AI init a repo, or authorize this directory in settings.',
  unauthorized: 'Directory outside the authorized scope (Settings → Git → Local directories)',
  branch: 'Branch',
  ahead: 'ahead',
  behind: 'behind',
  changedFiles: 'Changed files',
  noChanges: 'Working tree clean',
  recentCommits: 'Recent commits',
  noCommits: 'No commits yet',
  actions: 'Actions (inject a command for the AI)',
  inputHint: 'You can edit before pressing Enter; writes stay confirm-gated.',
  autoSubmit: 'Auto submit (press send after injecting)',
  account: 'GitHub account',
  noAccount: 'No account connected (local git still works)',
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
  connect: 'Connect',
  cancel: 'Cancel',
  disconnect: 'Disconnect',
  recheck: 'Recheck',
  copied: 'Copied',
  injected: 'Command placed in the input box',
  injectedSubmitted: 'Command sent to the AI',
  injectFailed: 'Inject failed',
  detectFailed: 'Cannot detect repository status',
  retry: 'Check again',
  settingsTitle: 'Git Settings (v3 slim)',
  rootsTitle: 'Authorized local directories',
  rootsHint: 'One absolute path per line; * means no limit.',
  save: 'Save',
  saved: 'Saved',
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
  shortcuts?: { registry?: { invoke?: (id: string, context: any) => void } }
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
  const [anchor, setAnchor] = useState({ left: 0, bottom: 0 })

  const cwd = useSessionCwd(sessions, sessionId)

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
        if (data.status.isRepo && data.status.authorized) {
          const [changes, log, state] = await Promise.all([
            api<{ ok: boolean; changes?: RepoChangesView }>(`/repo/changes?cwd=${encodeURIComponent(cwd)}`).catch(() => null),
            api<{ ok: boolean; commits?: CommitRowView[] }>(`/repo/commits?cwd=${encodeURIComponent(cwd)}&limit=5`).catch(() => null),
            api<{ ok: boolean; state?: PanelState }>('/state').catch(() => null),
          ])
          setFiles(changes?.changes?.files ?? [])
          setCommits(log?.commits ?? [])
          setAccounts(state?.state?.accounts ?? [])
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
      setAnchor({ left: Math.min(rect.left, window.innerWidth - 396), bottom: window.innerHeight - rect.top + 6 })
    }
    setOpen(next)
    if (next) void reload()
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
    // 带 … 的按钮需要用户先补参数（分支名/文件/提交意图）；其余直接注入。
    if (spec.id === 'stage-all' || spec.id === 'push' || spec.id === 'pull' || spec.id === 'fetch' || spec.id === 'stash' || spec.id === 'init') {
      void runCommand(spec)
    } else {
      setPrompt(spec)
      setPromptValue('')
    }
  }

  const isRepo = status?.isRepo === true
  const authorized = status?.authorized === true

  return (
    <span className="dgp-root" ref={chipRef}>
      <button
        type="button"
        className="dgp-chip"
        title={isRepo ? `${status?.branch ?? ''}` : detectError || t('entry')}
        onClick={toggle}
        aria-expanded={open}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="5" cy="4" r="2" />
          <circle cx="5" cy="12" r="2" />
          <circle cx="11" cy="7" r="2" />
          <path d="M5 6v4M7 7h2M11 9v1a3 3 0 0 1-3 3H7" />
        </svg>
        <span className="dgp-chip-branch">
          {checking && !status ? '…' : isRepo ? status?.branch || '—' : 'Git'}
        </span>
        {isRepo && authorized && (
          <span className="dgp-chip-badge">
            {status!.ahead > 0 ? `↑${status!.ahead}` : ''}
            {status!.behind > 0 ? `↓${status!.behind}` : ''}
            {status!.changed > 0 ? ` ${status!.changed}*` : ''}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div className="dgp-panel" style={{ left: anchor.left, bottom: anchor.bottom }} onMouseLeave={() => setOpen(false)}>
            <div className="dgp-head">
              <span className="dgp-title">{t('panelTitle')}</span>
              <button type="button" className="dgp-iconbtn" title={t('refresh')} onClick={() => void reload()}>⟳</button>
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
              <button type="button" className="dgp-iconbtn" title={t('close')} onClick={() => setOpen(false)}>✕</button>
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

            {isRepo && !authorized && <div className="dgp-sect"><div className="dgp-empty">{t('unauthorized')}</div></div>}

            {isRepo && authorized && (
              <>
                <div className="dgp-sect">
                  <div className="dgp-sect-title">{t('changedFiles')} ({files.length})</div>
                  {files.length === 0 && <div className="dgp-empty">{t('noChanges')}</div>}
                  {files.slice(0, 12).map((file) => (
                    <div key={file.path} className="dgp-file" title={file.path}>
                      <span className="dgp-file-status">{file.staged ? file.worktree === 'M' ? 'MM' : 'M' : file.untracked ? '?' : file.worktree}</span>
                      <span className="dgp-file-path">{file.path}</span>
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
                  <div className="dgp-sect-title">{t('account')}</div>
                  {accounts.length === 0 && <div className="dgp-empty">{t('noAccount')}</div>}
                  {accounts.map((account) => (
                    <div key={account.id} className="dgp-account">
                      <Dot state={account.status} />
                      <span>{account.login}</span>
                      <span className="dgp-muted">{account.kind === 'oauth' ? 'OAuth' : 'PAT'}</span>
                    </div>
                  ))}
                </div>

                <div className="dgp-sect">
                  <div className="dgp-sect-title">{t('actions')}</div>
                  <div className="dgp-btnrow">
                    {COMMANDS.filter((c) => c.id !== 'init').map((command) => (
                      <button key={command.id} type="button" className="dgp-btn" onClick={() => onActionClick(command)}>
                        {t(command.labelKey)}
                      </button>
                    ))}
                  </div>
                  <div className="dgp-muted" style={{ marginTop: 6 }}>{t('inputHint')}</div>
                </div>
              </>
            )}

            {prompt && (
              <div className="dgp-sect" style={{ border: '1px solid var(--dsh-border, #666)', borderRadius: 8, padding: 8 }}>
                <div className="dgp-sect-title">{t(prompt.labelKey).replace('…', '')} · {t('askParam')}</div>
                <input
                  className="dgp-input"
                  autoFocus
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

      {toast && createPortal(<div className="dgp-toast">{toast}</div>, document.body)}
    </span>
  )
}

// ─── 设置分节：账号连接 + 目录白名单 + 写策略 ───

function GitSection({ t }: { t: (key: string) => string }) {
  useStyles()
  const [state, setState] = useState<PanelState | null>(null)
  const [rootsText, setRootsText] = useState('')
  const [saved, setSaved] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  const [method, setMethod] = useState<'pat' | 'oauth'>('pat')
  const [token, setToken] = useState('')
  const [label, setLabel] = useState('')
  const [clientId, setClientId] = useState('')
  const [busy, setBusy] = useState(false)
  const [oauthFlow, setOauthFlow] = useState<{ verificationUri: string; userCode: string } | null>(null)
  const [oauthStatus, setOauthStatus] = useState('')
  const pollRef = useRef<number | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api<{ ok: boolean; state?: PanelState }>('/state')
      if (data.ok && data.state) {
        setState(data.state)
        setRootsText(data.state.settings.allowedRoots.join('\n'))
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current)
    }
  }, [load])

  const saveSettings = async () => {
    const allowedRoots = rootsText.split('\n').map((line) => line.trim()).filter(Boolean)
    try {
      const data = await api<{ ok: boolean; state?: PanelState }>('/settings', { allowedRoots })
      if (data.ok && data.state) {
        setState(data.state)
        setSaved(true)
        window.setTimeout(() => setSaved(false), 1500)
      } else {
        setError(t('detectFailed'))
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const toggleFlag = async (key: 'allowWrite' | 'requireConfirm', value: boolean) => {
    try {
      const data = await api<{ ok: boolean; state?: PanelState }>('/settings', { [key]: value })
      if (data.ok && data.state) setState(data.state)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const connectPat = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ ok: boolean; error?: string; state?: PanelState }>('/pat/connect', { token, label })
      if (data.ok && data.state) {
        setState(data.state)
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
      setOauthStatus('waiting')
      const pollKey = data.pollKey
      pollRef.current = window.setInterval(async () => {
        try {
          const res = await api<{ ok: boolean; status?: string; account?: unknown; state?: PanelState; error?: string }>('/oauth/poll', { pollKey })
          if (res.status === 'authorized' && res.state) {
            if (pollRef.current !== null) window.clearInterval(pollRef.current)
            setState(res.state)
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
      if (data.state) setState(data.state)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const settings = state?.settings

  return (
    <div className="dgp-root dgp-section" style={{ maxWidth: 640 }}>
      <div className="dgp-head"><span className="dgp-title">{t('settingsTitle')}</span></div>
      {error && <div className="dgp-empty" role="alert">{error} <button type="button" className="dgp-iconbtn" onClick={() => setError('')}>✕</button></div>}

      <div className="dgp-sect">
        <div className="dgp-sect-title">{t('account')}</div>
        {(state?.accounts ?? []).map((account) => (
          <div key={account.id} className="dgp-account">
            <Dot state={account.status} />
            <span>{account.login}</span>
            <span className="dgp-muted">{account.kind === 'oauth' ? 'OAuth' : 'PAT'} · {account.scopes.join(' ')}</span>
            <span style={{ flex: 1 }} />
            <button type="button" className="dgp-btn" onClick={() => void accountAction('recheck', account.id)}>{t('recheck')}</button>
            <button type="button" className="dgp-btn" onClick={() => void accountAction('remove', account.id)}>{t('disconnect')}</button>
          </div>
        ))}
        {(state?.accounts ?? []).length === 0 && <div className="dgp-empty">{t('noAccount')}</div>}
        <button type="button" className="dgp-btn" style={{ marginTop: 6 }} onClick={() => setConnectOpen(!connectOpen)}>
          {t('connectAccount')}
        </button>
        {connectOpen && (
          <div style={{ marginTop: 8, border: '1px solid var(--dsh-border, #666)', borderRadius: 8, padding: 10 }}>
            <div className="dgp-btnrow" style={{ marginBottom: 8 }}>
              <button type="button" className="dgp-btn" onClick={() => setMethod('pat')} style={method === 'pat' ? { borderColor: 'var(--dsh-accent, #4a9eff)' } : undefined}>{t('methodPat')}</button>
              <button type="button" className="dgp-btn" onClick={() => setMethod('oauth')} style={method === 'oauth' ? { borderColor: 'var(--dsh-accent, #4a9eff)' } : undefined}>{t('methodOauth')}</button>
            </div>
            {method === 'pat' ? (
              <>
                <div className="dgp-sect-title">{t('tokenLabel')}</div>
                <input className="dgp-input" type="password" placeholder={t('tokenPlaceholder')} value={token} onChange={(e) => setToken(e.target.value)} />
                <div className="dgp-sect-title" style={{ marginTop: 6 }}>{t('labelLabel')}</div>
                <input className="dgp-input" value={label} onChange={(e) => setLabel(e.target.value)} />
                <div className="dgp-btnrow" style={{ marginTop: 8 }}>
                  <button type="button" className="dgp-btn" disabled={busy || token.trim().length === 0} onClick={() => void connectPat()}>{t('connect')}</button>
                  <button type="button" className="dgp-btn" onClick={() => setConnectOpen(false)}>{t('cancel')}</button>
                </div>
              </>
            ) : (
              <>
                <div className="dgp-sect-title">{t('clientIdLabel')}</div>
                <div className="dgp-muted">{t('clientIdHint')}</div>
                <input className="dgp-input" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                {oauthFlow ? (
                  <div style={{ marginTop: 8 }}>
                    <div className="dgp-muted">{t('userCode')}</div>
                    <div className="dgp-file"><a href={oauthFlow.verificationUri} target="_blank" rel="noreferrer">{oauthFlow.verificationUri}</a></div>
                    <div style={{ fontSize: 18, fontFamily: 'var(--dsh-mono, monospace)', margin: '4px 0' }}>{oauthFlow.userCode}</div>
                    <div className="dgp-muted">{oauthStatus === 'waiting' ? t('waiting') : ''}</div>
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
      </div>

      <div className="dgp-sect">
        <div className="dgp-sect-title">{t('rootsTitle')}</div>
        <div className="dgp-muted">{t('rootsHint')}</div>
        <textarea className="dgp-input" rows={4} value={rootsText} onChange={(e) => setRootsText(e.target.value)} />
        <div className="dgp-btnrow" style={{ marginTop: 6 }}>
          <button type="button" className="dgp-btn" onClick={() => void saveSettings()}>{saved ? t('saved') : t('save')}</button>
        </div>
      </div>

      <div className="dgp-sect">
        <label className="dgp-toggle">
          <input type="checkbox" checked={settings?.allowWrite === true} onChange={(e) => void toggleFlag('allowWrite', e.target.checked)} />
          {t('allowWrite')}
        </label>
        <div className="dgp-muted">{t('allowWriteHint')}</div>
        <label className="dgp-toggle" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={settings?.requireConfirm !== false} onChange={(e) => void toggleFlag('requireConfirm', e.target.checked)} />
          {t('requireConfirm')}
        </label>
        <div className="dgp-muted">{t('requireConfirmHint')}</div>
      </div>
    </div>
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

  // 1) 设置页分节（账号 / 目录白名单 / 写策略）。
  try {
    ctx.slots?.inject?.('settings.section', () => {
      try {
        return ctx.slots?.register?.(
          { name: 'settings.section', id: 'git-panel', order: 20, label: () => t('navLabel'), locale: NS, inject: () => ({ t }) },
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

  // 2) 输入框左侧 chip。
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
