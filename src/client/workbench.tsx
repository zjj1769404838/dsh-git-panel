/**
 * Git 工作台（BUILD dgp-v18，完全重写）。
 *
 * 与旧版的差别不是微调，是换形态：
 *   - 旧版是 760px 居中弹窗 + 左 44% 变更 / 右 56% 三 tab 平铺 + 底部提交框；
 *   - 新版是居中模态框（宽 min(1040px, 100vw-96px)、高 min(660px, 100vh-96px)），
 *     左侧竖排导航（改动 / 历史 / 分支图），主区一次只呈现一件事；
 *     提交区提到「改动」视图顶部，形成「先看改动 → 再提交」的单列流程。
 *   - Diff 不再占一个常驻 tab，改为点文件时弹出的预览层（看完即走，不抢主区）。
 *
 * 数据契约完全沿用既有 node 端点，不新增接口：
 *   /repo/status|changes|commits|branches|remotes|graph|diff|commit|stage|unstage|discard|fetch|pull|push|init|remotes/*
 */
import { useEffect, useState } from 'react'
import {
  api,
  useStyles,
  Toast,
  EmptyState,
  Skeleton,
  createPortal,
  BranchIcon,
  RefreshIcon,
  GearIcon,
  PlusIcon,
  type RepoStatusView,
  type RepoChangesView,
  type RepoGraphView,
} from './shared.js'
import { GraphView } from './graphview.js'

/** /repo/commits 行（node 半边 readCommits）。 */
interface CommitRow {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  subject: string
  refs: string
  parents: string[]
}

/** /repo/branches 行（node 半边 readBranches）。 */
interface BranchRow {
  name: string
  current: boolean
  head: string
  upstream: string
  ahead: number
  behind: number
  kind: 'local' | 'remote'
  tip: string
}

/** /repo/remotes 行。 */
interface RemoteRow {
  name: string
  url: string
}

/** fetch/pull/push 的结构化结果（conflicted/rejected/missingConfig 三态）。 */
interface SyncView {
  ok: boolean
  error: string
  output: string
  conflicted: boolean
  rejected: boolean
  missingConfig: boolean
}

/** 异步操作进行中状态（防重复提交 + 按钮反馈）。 */
type BusyKind = 'none' | 'commit' | 'pull' | 'push' | 'fetch' | 'stage' | 'unstage' | 'discard' | 'branch' | 'remote' | 'init'

/** 主区视图：一次只呈现一件事，靠左侧导航切换。 */
type ViewKind = 'changes' | 'history' | 'graph'

/** 二级层：同一时刻最多一层。 */
type LayerKind = 'none' | 'branches' | 'newBranch' | 'commit' | 'remote' | 'pull' | 'diff'

export interface WorkbenchProps {
  t: (key: string) => string
  cwd: string
  status: RepoStatusView | null
  onStatusChange: (status: RepoStatusView | null) => void
  onClose: () => void
  /** 打开 DSH 设置页（由 index.tsx 注入，内部走 openSettingsSection 三级降级）。 */
  onOpenSettings: () => void
}

/** 把 refs 字段（"HEAD -> main, origin/main, tag: v1"）拆成徽章列表。 */
function parseRefs(refs: string): Array<{ text: string; kind: 'head' | 'remote' | 'tag' | 'other' }> {
  if (!refs) return []
  return refs
    .split(', ')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => {
      if (item.startsWith('HEAD -> ')) return { text: item.slice('HEAD -> '.length), kind: 'head' as const }
      if (item.startsWith('tag: ')) return { text: item.slice('tag: '.length), kind: 'tag' as const }
      if (item.startsWith('origin/') || item.includes('/')) return { text: item, kind: 'remote' as const }
      return { text: item, kind: 'other' as const }
    })
}

/** 时间戳转本地短格式（iso-local 输入，只展示到分钟）。 */
function shortDate(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Modal 骨架：二级弹窗统一容器（遮罩 + 面板 + 标题 + 关闭）。设置页的连接弹窗也复用它。 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 520,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return createPortal(
    <div className="dgp-portal dgp-modal-mask" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dgp-modal" role="dialog" aria-label={title} style={{ width: `min(${width}px, calc(100vw - 48px))` }}>
        <div className="dgp-modal-head">
          <span className="dgp-modal-title">{title}</span>
          <button type="button" className="dgp-modal-x" aria-label="close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dgp-modal-body">{children}</div>
        {footer ? <div className="dgp-modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

export function Workbench({ t, cwd, status, onStatusChange, onClose, onOpenSettings }: WorkbenchProps) {
  useStyles()
  const [view, setView] = useState<ViewKind>('changes')
  const [changes, setChanges] = useState<RepoChangesView | null>(null)
  const [changesLoading, setChangesLoading] = useState(false)
  const [changesError, setChangesError] = useState('')
  const [commits, setCommits] = useState<CommitRow[]>([])
  const [commitsLoading, setCommitsLoading] = useState(false)
  const [commitsError, setCommitsError] = useState('')
  const [graph, setGraph] = useState<RepoGraphView | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState('')
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [currentBranch, setCurrentBranch] = useState('')
  const [remotes, setRemotes] = useState<RemoteRow[]>([])
  const [upstream, setUpstream] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)
  const [busy, setBusy] = useState<BusyKind>('none')
  const [toast, setToast] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null)

  const [layer, setLayer] = useState<LayerKind>('none')
  const [detailRev, setDetailRev] = useState('')
  const [diffText, setDiffText] = useState('')
  const [diffError, setDiffError] = useState('')
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffTruncated, setDiffTruncated] = useState(false)
  const [diffPath, setDiffPath] = useState('')
  const [diffMode, setDiffMode] = useState<'worktree' | 'staged'>('worktree')

  const isRepo = status !== null && status.isRepo
  const authorized = status !== null && status.authorized !== false
  const [initRemote, setInitRemote] = useState('')
  const [discardPending, setDiscardPending] = useState<string[] | null>(null)

  const showToast = (tone: 'ok' | 'error' | 'info', text: string) => setToast({ tone, text })

  const loadStatus = async () => {
    try {
      const data = await api<{ ok: boolean; status?: RepoStatusView }>(`/repo/status?cwd=${encodeURIComponent(cwd)}`)
      if (data.ok && data.status) onStatusChange(data.status)
    } catch {
      /* 状态失败不阻塞其它面板数据 */
    }
  }

  const loadChanges = async () => {
    if (!cwd || !isRepo) return
    setChangesLoading(true)
    try {
      const data = await api<{ ok: boolean; changes?: RepoChangesView; error?: string }>(`/repo/changes?cwd=${encodeURIComponent(cwd)}`)
      if (data.ok && data.changes) {
        setChanges(data.changes)
        setChangesError('')
      } else {
        setChanges(null)
        setChangesError(
          String(data.error ?? '').includes('不支持的请求方法') ? t('changesStaleNode') : data.error || t('changesFailed'),
        )
      }
    } catch (error) {
      setChanges(null)
      setChangesError((error as Error).message || t('changesFailed'))
    } finally {
      setChangesLoading(false)
    }
  }

  const loadCommits = async () => {
    if (!cwd || !isRepo) return
    setCommitsLoading(true)
    try {
      const data = await api<{ ok: boolean; commits?: CommitRow[]; error?: string }>(`/repo/commits?cwd=${encodeURIComponent(cwd)}&limit=80`)
      if (data.ok && Array.isArray(data.commits)) {
        setCommits(data.commits)
        setCommitsError('')
      } else {
        setCommits([])
        setCommitsError(data.error || '')
      }
    } catch (error) {
      setCommits([])
      setCommitsError((error as Error).message)
    } finally {
      setCommitsLoading(false)
    }
  }

  const loadBranches = async () => {
    if (!cwd || !isRepo) return
    try {
      const data = await api<{ ok: boolean; branches?: BranchRow[]; current?: string; error?: string }>(`/repo/branches?cwd=${encodeURIComponent(cwd)}`)
      if (data.ok) {
        setBranches(data.branches ?? [])
        setCurrentBranch(data.current ?? '')
      }
    } catch {
      /* 分支失败不阻塞主面板 */
    }
  }

  const loadRemotes = async () => {
    if (!cwd || !isRepo) return
    try {
      const data = await api<{ ok: boolean; remotes?: RemoteRow[]; upstream?: string }>(`/repo/remotes?cwd=${encodeURIComponent(cwd)}`)
      if (data.ok) {
        setRemotes(data.remotes ?? [])
        setUpstream(data.upstream ?? '')
      }
    } catch {
      /* 远程失败不阻塞主面板 */
    }
  }

  const loadGraph = async () => {
    if (!cwd || !isRepo) return
    setGraphLoading(true)
    try {
      const data = await api<{ ok: boolean; graph?: RepoGraphView; error?: string }>(`/repo/graph?cwd=${encodeURIComponent(cwd)}&limit=40`)
      if (data.ok && data.graph) {
        setGraph(data.graph)
        setGraphError('')
      } else {
        setGraph(null)
        setGraphError(data.error || '')
      }
    } catch (error) {
      setGraph(null)
      setGraphError((error as Error).message)
    } finally {
      setGraphLoading(false)
    }
  }

  const loadDiff = async (mode: 'worktree' | 'staged', path: string) => {
    if (!cwd || !isRepo) return
    setDiffLoading(true)
    setDiffError('')
    try {
      const params = new URLSearchParams({ cwd, mode })
      if (path) params.set('path', path)
      const data = await api<{ ok: boolean; diff?: string; truncated?: boolean; error?: string }>(`/repo/diff?${params.toString()}`)
      if (data.ok) {
        setDiffText(data.diff ?? '')
        setDiffTruncated(data.truncated === true)
      } else {
        setDiffText('')
        setDiffError(data.error || t('diffFailed'))
      }
    } catch (error) {
      setDiffText('')
      setDiffError((error as Error).message || t('diffFailed'))
    } finally {
      setDiffLoading(false)
    }
  }

  /** 全量刷新：写操作成功后统一走这里（不做定时轮询，只在打开与动作后取一次）。 */
  const refreshAll = async () => {
    if (!cwd) return
    await Promise.all([loadStatus(), loadChanges(), loadCommits(), loadBranches(), loadRemotes()])
  }

  useEffect(() => {
    if (!cwd) return
    void refreshAll()
    if (isRepo) void loadGraph()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd, isRepo])

  useEffect(() => {
    if (view === 'graph' && isRepo && !graph) void loadGraph()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, isRepo])

  // 模态框语义：Esc 关闭。仅在没开二级弹窗时接管，否则让 Modal 自己处理，
  // 避免一次 Esc 连关两层。
  useEffect(() => {
    if (layer !== 'none') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeAll()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer])

  const unstaged = (changes?.files ?? []).filter((file) => !file.staged)
  const stagedFiles = (changes?.files ?? []).filter((file) => file.staged)
  const untracked = unstaged.filter((file) => file.worktree === '?')
  const modified = unstaged.filter((file) => file.worktree !== '?')

  const toggleSelect = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const selectAll = (paths: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const path of paths) {
        if (on) next.add(path)
        else next.delete(path)
      }
      return next
    })
  }

  /** 通用写操作执行器：busy 防重复 + toast 反馈 + 成功后全量刷新。 */
  const run = async (
    kind: BusyKind,
    action: () => Promise<{ ok: boolean; error?: string; conflicted?: boolean; rejected?: boolean }>,
    okText: string,
  ): Promise<boolean> => {
    if (busy !== 'none') return false
    setBusy(kind)
    try {
      const result = await action()
      if (result.ok) {
        showToast('ok', okText)
        await refreshAll()
        return true
      }
      // 冲突 / 被拒单独给可操作的话术，其余沿用服务端错误原文。
      const friendly = result.conflicted ? t('syncConflicted') : result.rejected ? t('syncRejected') : ''
      showToast('error', friendly || result.error || t('actionFailed'))
      return false
    } catch (error) {
      showToast('error', `${t('actionFailed')}：${(error as Error).message}`)
      return false
    } finally {
      setBusy('none')
    }
  }

  const stageSelected = (paths: string[]) =>
    run('stage', () => api<{ ok: boolean; error?: string }>('/repo/stage', { cwd, paths }), t('toastStaged'))

  const unstageSelected = (paths: string[]) =>
    run('unstage', () => api<{ ok: boolean; error?: string }>('/repo/unstage', { cwd, paths }), t('toastUnstaged'))

  const doDiscard = (paths: string[]) =>
    run('discard', () => api<{ ok: boolean; error?: string }>('/repo/discard', { cwd, paths, confirmed: true }), t('toastDiscarded'))

  const doCommit = () =>
    run('commit', () => api<{ ok: boolean; error?: string; hash?: string }>('/repo/commit', { cwd, message, amend }), amend ? t('toastAmended') : t('toastCommitted')).then(
      (ok) => {
        if (ok) {
          setMessage('')
          setAmend(false)
          setSelected(new Set())
        }
      },
    )

  const doFetch = () => run('fetch', () => api<SyncView>('/repo/fetch', { cwd }), t('toastFetched'))

  // 没有上游时裸 git pull 会报 no tracking information；显式带 remote + 当前分支名，
  // 等价于 git pull <remote> <branch>，无论有没有 upstream 都能拉到同名分支。
  const doPull = (strategy: 'merge' | 'rebase') =>
    run(
      'pull',
      () => api<SyncView>('/repo/pull', { cwd, strategy, remote: remotes[0]?.name ?? '', branch: currentBranch }),
      strategy === 'rebase' ? t('toastPulledRebase') : t('toastPulledMerge'),
    ).then((ok) => {
      if (!ok) void loadStatus()
    })

  const doPush = (setUpstream: boolean) =>
    run('push', () => api<SyncView>('/repo/push', { cwd, remote: remotes[0]?.name ?? '', branch: currentBranch, setUpstream }), t('toastPushed')).then((ok) => {
      if (!ok) void loadStatus()
    })

  const doInit = () =>
    run('init', () => api<{ ok: boolean; error?: string; result?: { created?: boolean; branch?: string } }>('/repo/init', { cwd, branch: 'main' }), t('initDone'))

  /** 初始化 + 可选关联远程地址（复用既有 /repo/remotes/add，不臆造接口）。 */
  const doInitWithForm = async () => {
    const ok = await doInit()
    if (!ok) return
    const url = initRemote.trim()
    if (!url) return
    try {
      const added = await api<{ ok: boolean; error?: string }>('/repo/remotes/add', { cwd, name: 'origin', url })
      showToast(added.ok ? 'ok' : 'error', added.ok ? t('toastRemoteAdded') : added.error || t('actionFailed'))
      await refreshAll()
    } catch (error) {
      showToast('error', `${t('actionFailed')}：${(error as Error).message}`)
    }
  }

  const openDetail = (rev: string) => {
    setDetailRev(rev)
    setLayer('commit')
  }

  const openDiff = (mode: 'worktree' | 'staged', path: string) => {
    setDiffMode(mode)
    setDiffPath(path)
    setLayer('diff')
    void loadDiff(mode, path)
  }

  const currentBranchRow = branches.find((branch) => branch.kind === 'local' && branch.current)
  const hasRemote = remotes.length > 0
  const canCommit = stagedFiles.length > 0 && message.trim().length > 0 && busy === 'none'
  const canPull = isRepo && authorized && busy === 'none'
  const canPush = isRepo && authorized && hasRemote && currentBranch.length > 0 && busy === 'none'

  const closeAll = () => {
    onClose()
  }

  // ---------- 首屏：无状态 / 非仓库 / 未授权 ----------
  if (!status) {
    return (
      <>
        <div className="dgp-portal dgp-gw-mask" onMouseDown={(event) => event.target === event.currentTarget && closeAll()} />
        <div className="dgp-root dgp-gw" role="dialog" aria-label={t('wbTitle')} data-state="loading">
          <div className="dgp-gw-top">
            <span className="dgp-gw-crumb">{t('wbTitle')}</span>
            <span className="dgp-gw-spacer" />
            <button type="button" className="dgp-gw-x" onClick={closeAll} aria-label="close">×</button>
          </div>
          <div className="dgp-gw-state"><Skeleton rows={5} /></div>
        </div>
      </>
    )
  }

  if (!isRepo) {
    return (
      <>
        <div className="dgp-portal dgp-gw-mask" onMouseDown={(event) => event.target === event.currentTarget && closeAll()} />
        <div className="dgp-root dgp-gw" role="dialog" aria-label={t('wbTitle')} data-state="no-repo">
          <div className="dgp-gw-top">
            <span className="dgp-gw-crumb">{t('wbTitle')}</span>
            <span className="dgp-gw-spacer" />
            <button type="button" className="dgp-gw-x" onClick={closeAll} aria-label="close">×</button>
          </div>
          <div className="dgp-gw-state">
            <EmptyState title={t('notRepo')} hint={t('wbInitHint')} />
            <div className="dgp-gw-initform">
              <label className="dgp-field">
                <span className="dgp-label">{t('wbInitRemote')}</span>
                <input className="dgp-input" value={initRemote} onChange={(event) => setInitRemote(event.target.value)} placeholder="https://github.com/user/repo.git" />
              </label>
              <button type="button" className="dgp-btn primary" disabled={busy !== 'none'} onClick={() => void doInitWithForm()}>
                <PlusIcon />
                {t('menuInit')}
              </button>
            </div>
          </div>
          {toast ? <Toast tone={toast.tone} text={toast.text} onDone={() => setToast(null)} /> : null}
        </div>
      </>
    )
  }

  if (!authorized) {
    return (
      <>
        <div className="dgp-portal dgp-gw-mask" onMouseDown={(event) => event.target === event.currentTarget && closeAll()} />
        <div className="dgp-root dgp-gw" role="dialog" aria-label={t('wbTitle')} data-state="unauthorized">
          <div className="dgp-gw-top">
            <span className="dgp-gw-crumb">{t('wbTitle')}</span>
            <span className="dgp-gw-spacer" />
            <button type="button" className="dgp-gw-x" onClick={closeAll} aria-label="close">×</button>
          </div>
          <div className="dgp-gw-state">
            <EmptyState title={t('unauthorizedRoot')} hint={t('wbUnauthorizedHint')} />
            <button
              type="button"
              className="dgp-btn"
              onClick={() => {
                closeAll()
                onOpenSettings()
              }}
            >
              <GearIcon />
              {t('menuSettings')}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ---------- 主面板：左侧竖排导航 + 主区 ----------
  const railItems: Array<{ key: ViewKind; label: string; count: number }> = [
    { key: 'changes', label: t('wbChangesTab'), count: changes?.files.length ?? 0 },
    { key: 'history', label: t('wbHistory'), count: commits.length },
    { key: 'graph', label: t('wbGraph'), count: graph?.rows.length ?? 0 },
  ]

  return (
    <>
      <div className="dgp-portal dgp-gw-mask" onMouseDown={(event) => event.target === event.currentTarget && closeAll()} />
      <div className="dgp-root dgp-gw" role="dialog" aria-label={t('wbTitle')} data-state="ready">
        {/* 顶栏：仓库 · 分支 · 同步动作 · 关闭 */}
        <div className="dgp-gw-top">
          <span className="dgp-gw-repo" title={status.root || cwd}>
            <BranchIcon />
            {status.root?.split(/[\\/]/).pop() || cwd}
          </span>
          <button type="button" className="dgp-gw-branch" data-current={currentBranchRow ? '1' : '0'} onClick={() => setLayer('branches')}>
            {currentBranch || 'HEAD'} <span className="dgp-gw-caret">▾</span>
          </button>
          <span className="dgp-gw-aux">
            {status.ahead > 0 ? `↑${status.ahead}` : ''}
            {status.behind > 0 ? `↓${status.behind}` : ''}
            {status.changed > 0 ? `${status.changed}*` : ''}
          </span>
          <span className="dgp-gw-spacer" />
          <span className="dgp-gw-btnbar">
            <button type="button" className="dgp-btn ghost" disabled={!canPull} onClick={() => void doFetch()}>{t('wbFetch')}</button>
            <button type="button" className="dgp-btn" disabled={!canPull} onClick={() => setLayer('pull')}>{t('wbPull')}</button>
            <button type="button" className="dgp-btn primary" disabled={!canPush} onClick={() => void doPush(false)}>{t('wbPush')}</button>
          </span>
          <span className="dgp-gw-btnbar">
            <button type="button" className="dgp-btn ghost" onClick={() => setLayer('remote')}>{t('wbRemoteTitle')}</button>
            <button type="button" className="dgp-gw-icon" disabled={busy !== 'none'} onClick={() => void refreshAll()} aria-label={t('refresh')}>
              <RefreshIcon />
            </button>
            <button type="button" className="dgp-gw-icon" onClick={() => { closeAll(); onOpenSettings() }} aria-label={t('menuSettings')}>
              <GearIcon />
            </button>
          </span>
          <button type="button" className="dgp-gw-x" onClick={closeAll} aria-label="close">×</button>
        </div>

        <div className="dgp-gw-body">
          {/* 左侧竖排导航：一次只切一件事，数量徽标常驻 */}
          <nav className="dgp-gw-rail" aria-label={t('wbTitle')}>
            {railItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className="dgp-gw-railbtn"
                data-on={view === item.key ? '1' : '0'}
                onClick={() => setView(item.key)}
              >
                <span className="dgp-gw-railbtn-label">{item.label}</span>
                {item.count > 0 ? <span className="dgp-gw-railbtn-count">{item.count}</span> : null}
              </button>
            ))}
          </nav>

          <div className="dgp-gw-main">
            {/* 改动视图：提交区在顶部，列表在下方，形成单列流程 */}
            {view === 'changes' ? (
              <>
                <div className="dgp-gw-commit">
                  <textarea
                    className="dgp-gw-msg"
                    placeholder={t('wbMsgPlaceholder')}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={3}
                  />
                  <div className="dgp-gw-commitbar">
                    <label className="dgp-gw-amend">
                      <input type="checkbox" checked={amend} onChange={(event) => setAmend(event.target.checked)} />
                      {t('wbAmend')}
                    </label>
                    <span className="dgp-gw-spacer" />
                    <span className="dgp-gw-staged-count">{stagedFiles.length}</span>
                    <button type="button" className="dgp-btn primary" disabled={!canCommit} onClick={() => void doCommit()}>{t('wbCommit')}</button>
                  </div>
                  {stagedFiles.length === 0 && (message.trim().length > 0 || amend) ? (
                    <div className="dgp-hint">{t('wbCommitNeedsStaged')}</div>
                  ) : null}
                </div>

                <div className="dgp-gw-lists">
                  {changesLoading && !changes ? (
                    <Skeleton rows={6} />
                  ) : changesError ? (
                    <div className="dgp-err">{changesError}</div>
                  ) : !changes || changes.files.length === 0 ? (
                    <EmptyState title={t('changesEmpty')} hint={t('wbCleanHint')} />
                  ) : (
                    <>
                      {stagedFiles.length > 0 ? (
                        <section className="dgp-gw-group">
                          <header className="dgp-gw-grouphead">
                            <label className="dgp-gw-checkall">
                              <input
                                type="checkbox"
                                checked={stagedFiles.every((file) => selected.has(file.path))}
                                onChange={(event) => selectAll(stagedFiles.map((file) => file.path), event.target.checked)}
                              />
                              {t('changesStaged')}
                            </label>
                            <span className="dgp-gw-count">{stagedFiles.length}</span>
                            <span className="dgp-gw-spacer" />
                            <button type="button" className="dgp-gw-textbtn" disabled={busy !== 'none'} onClick={() => void unstageSelected(stagedFiles.map((file) => file.path))}>
                              {t('wbUnstage')}
                            </button>
                          </header>
                          {stagedFiles.map((file) => (
                            <ChangeRow
                              key={`s-${file.path}`}
                              file={file}
                              checked={selected.has(file.path)}
                              onToggle={() => toggleSelect(file.path)}
                              onPreview={() => openDiff('staged', file.path)}
                              onAction={() => void unstageSelected([file.path])}
                              actionLabel={t('wbUnstage')}
                              danger={false}
                            />
                          ))}
                        </section>
                      ) : null}

                      {modified.length > 0 ? (
                        <section className="dgp-gw-group">
                          <header className="dgp-gw-grouphead">
                            <label className="dgp-gw-checkall">
                              <input
                                type="checkbox"
                                checked={modified.every((file) => selected.has(file.path))}
                                onChange={(event) => selectAll(modified.map((file) => file.path), event.target.checked)}
                              />
                              {t('wbUnstaged')}
                            </label>
                            <span className="dgp-gw-count">{modified.length}</span>
                            <span className="dgp-gw-spacer" />
                            <button type="button" className="dgp-gw-textbtn" disabled={busy !== 'none'} onClick={() => void stageSelected(modified.map((file) => file.path))}>
                              {t('wbStageAll')}
                            </button>
                          </header>
                          {modified.map((file) => (
                            <ChangeRow
                              key={`w-${file.path}`}
                              file={file}
                              checked={selected.has(file.path)}
                              onToggle={() => toggleSelect(file.path)}
                              onPreview={() => openDiff('worktree', file.path)}
                              onAction={() => void stageSelected([file.path])}
                              actionLabel={t('wbStage')}
                              danger={false}
                            />
                          ))}
                        </section>
                      ) : null}

                      {untracked.length > 0 ? (
                        <section className="dgp-gw-group">
                          <header className="dgp-gw-grouphead">
                            <label className="dgp-gw-checkall">
                              <input
                                type="checkbox"
                                checked={untracked.every((file) => selected.has(file.path))}
                                onChange={(event) => selectAll(untracked.map((file) => file.path), event.target.checked)}
                              />
                              {t('wbUntracked')}
                            </label>
                            <span className="dgp-gw-count">{untracked.length}</span>
                            <span className="dgp-gw-spacer" />
                            <button type="button" className="dgp-gw-textbtn" disabled={busy !== 'none'} onClick={() => void stageSelected(untracked.map((file) => file.path))}>
                              {t('wbStageAll')}
                            </button>
                          </header>
                          {untracked.map((file) => (
                            <ChangeRow
                              key={`u-${file.path}`}
                              file={file}
                              checked={selected.has(file.path)}
                              onToggle={() => toggleSelect(file.path)}
                              onPreview={() => undefined}
                              onAction={() => void stageSelected([file.path])}
                              actionLabel={t('wbStage')}
                              danger={false}
                            />
                          ))}
                        </section>
                      ) : null}
                    </>
                  )}
                </div>

                {selected.size > 0 ? (
                  <div className="dgp-gw-batch">
                    <span className="dgp-gw-batch-count">{selected.size}</span>
                    <button type="button" className="dgp-btn" disabled={busy !== 'none'} onClick={() => void stageSelected([...selected])}>{t('wbStage')}</button>
                    <button type="button" className="dgp-btn" disabled={busy !== 'none'} onClick={() => void unstageSelected([...selected])}>{t('wbUnstage')}</button>
                    <button type="button" className="dgp-btn danger" disabled={busy !== 'none'} onClick={() => setDiscardPending([...selected])}>{t('wbDiscard')}</button>
                    <span className="dgp-gw-spacer" />
                    <button type="button" className="dgp-gw-textbtn" onClick={() => setSelected(new Set())}>{t('wbCancel')}</button>
                  </div>
                ) : null}
              </>
            ) : null}

            {/* 历史视图 */}
            {view === 'history' ? (
              <div className="dgp-gw-scroll">
                {commitsLoading && commits.length === 0 ? (
                  <Skeleton rows={8} />
                ) : commitsError ? (
                  <div className="dgp-err">{commitsError}</div>
                ) : commits.length === 0 ? (
                  <EmptyState title={t('wbNoCommits')} hint={t('wbNoCommitsHint')} />
                ) : (
                  <div className="dgp-gw-log" role="list">
                    {commits.map((commit) => (
                      <button key={commit.hash} type="button" className="dgp-gw-logrow" role="listitem" onClick={() => openDetail(commit.hash)}>
                        <span className="dgp-gw-loghash">{commit.shortHash}</span>
                        <span className="dgp-gw-logmsg" title={commit.subject}>{commit.subject}</span>
                        {parseRefs(commit.refs).map((ref) => (
                          <span key={ref.text} className="dgp-graph-ref" data-kind={ref.kind === 'head' ? 'head' : ref.kind}>{ref.text}</span>
                        ))}
                        <span className="dgp-gw-logmeta">{commit.author} · {shortDate(commit.date)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* 分支图视图 */}
            {view === 'graph' ? (
              <div className="dgp-gw-scroll">
                <GraphView t={t} graph={graph} loading={graphLoading} error={graphError} />
              </div>
            ) : null}
          </div>
        </div>

        {toast ? <Toast tone={toast.tone} text={toast.text} onDone={() => setToast(null)} /> : null}

        {discardPending ? (
          <Modal title={t('wbDiscardTitle')} onClose={() => setDiscardPending(null)} width={440}>
            <p className="dgp-modal-text">{t('wbDiscardText')}</p>
            <ul className="dgp-modal-list">
              {discardPending.map((path) => (
                <li key={path}><code>{path}</code></li>
              ))}
            </ul>
            <div className="dgp-modal-foot" style={{ borderTop: 'none', padding: '10px 0 0' }}>
              <button type="button" className="dgp-btn" onClick={() => setDiscardPending(null)}>{t('wbCancel')}</button>
              <button
                type="button"
                className="dgp-btn danger"
                disabled={busy !== 'none'}
                onClick={() => {
                  const paths = discardPending
                  setDiscardPending(null)
                  void doDiscard(paths)
                }}
              >
                {t('wbDiscard')}
              </button>
            </div>
          </Modal>
        ) : null}

        {layer === 'diff' ? (
          <Modal title={`${t('wbDiffTitle')} · ${diffPath || (diffMode === 'staged' ? t('changesStaged') : t('wbUnstaged'))}`} onClose={() => setLayer('none')} width={880}>
            {diffLoading ? <Skeleton rows={8} /> : diffError ? <div className="dgp-err">{diffError}</div> : diffText ? (
              <pre className="dgp-gw-diff"><code>{diffText}</code></pre>
            ) : (
              <EmptyState title={t('diffEmpty')} hint={t('diffEmptyHint')} />
            )}
            {diffTruncated ? <div className="dgp-hint">{t('diffTruncated')}</div> : null}
          </Modal>
        ) : null}

        {layer === 'branches' ? (
          <BranchesModal
            t={t}
            cwd={cwd}
            branches={branches}
            current={currentBranch}
            onClose={() => setLayer('none')}
            onChanged={refreshAll}
            run={run}
            onNewBranch={() => setLayer('newBranch')}
          />
        ) : null}
        {layer === 'newBranch' ? <NewBranchModal t={t} cwd={cwd} onClose={() => setLayer('none')} onChanged={refreshAll} run={run} /> : null}
        {layer === 'commit' ? <CommitDetailModal t={t} cwd={cwd} rev={detailRev} onClose={() => setLayer('none')} /> : null}
        {layer === 'remote' ? <RemoteModal t={t} cwd={cwd} remotes={remotes} onClose={() => setLayer('none')} onChanged={refreshAll} run={run} /> : null}
        {layer === 'pull' ? (
          <PullModal
            t={t}
            onClose={() => setLayer('none')}
            onPull={(strategy) => {
              setLayer('none')
              void doPull(strategy)
            }}
            upstream={upstream}
            hasRemote={hasRemote}
          />
        ) : null}
      </div>
    </>
  )
}

/** 变更单行：状态码 + 路径 + 增删 + 行内动作（stage/unstage）。 */
function ChangeRow({
  file,
  checked,
  onToggle,
  onPreview,
  onAction,
  actionLabel,
  danger,
}: {
  file: { path: string; index: string; worktree: string; added: number; deleted: number; staged: boolean }
  checked: boolean
  onToggle: () => void
  onPreview: () => void
  onAction: () => void
  actionLabel: string
  danger: boolean
}) {
  const code = file.staged ? file.index || 'M' : file.worktree === '?' ? '??' : file.worktree || 'M'
  return (
    <div className="dgp-gw-row" data-staged={file.staged ? '1' : '0'}>
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={file.path} />
      <button type="button" className="dgp-gw-code" data-code={code} onClick={onPreview}>{code}</button>
      <button type="button" className="dgp-gw-path" onClick={onPreview} title={file.path}>{file.path}</button>
      {file.added > 0 || file.deleted > 0 ? (
        <span className="dgp-gw-stat">
          {file.added > 0 ? <b data-sign="add">+{file.added}</b> : null}
          {file.deleted > 0 ? <b data-sign="del">-{file.deleted}</b> : null}
        </span>
      ) : null}
      <button type="button" className="dgp-gw-rowact" data-danger={danger ? '1' : '0'} onClick={onAction}>{actionLabel}</button>
    </div>
  )
}

/** 分支管理：本地/远程两组 + 切换/新建/删除（删除需点两次）。 */
function BranchesModal({
  t, cwd, branches, current, onClose, onChanged, run, onNewBranch,
}: {
  t: (key: string) => string
  cwd: string
  branches: BranchRow[]
  current: string
  onClose: () => void
  onChanged: () => Promise<void>
  run: (kind: BusyKind, action: () => Promise<{ ok: boolean; error?: string }>, okText: string) => Promise<boolean>
  onNewBranch: () => void
}) {
  const local = branches.filter((branch) => branch.kind === 'local')
  const remote = branches.filter((branch) => branch.kind === 'remote')
  const [confirmDelete, setConfirmDelete] = useState('')
  return (
    <Modal
      title={t('wbBranchTitle')}
      onClose={onClose}
      width={520}
      footer={<button type="button" className="dgp-btn primary" onClick={onNewBranch}>{t('wbNewBranch')}</button>}
    >
      <div className="dgp-gw-branchcols">
        <div>
          <div className="dgp-gw-secttitle">{t('wbLocalBranches')}</div>
          {local.map((branch) => (
            <div key={branch.name} className="dgp-gw-branchrow" data-current={branch.current ? '1' : '0'}>
              <span className="dgp-gw-branchname">{branch.name}{branch.current ? ' ✓' : ''}</span>
              <span className="dgp-gw-branchmeta">
                {branch.ahead > 0 ? `↑${branch.ahead}` : ''}
                {branch.behind > 0 ? `↓${branch.behind}` : ''}
              </span>
              {!branch.current ? (
                <>
                  <button type="button" className="dgp-gw-textbtn" onClick={() => void run('branch', () => api('/repo/branches/checkout', { cwd, name: branch.name }), t('toastCheckedOut')).then((ok) => ok && onChanged()).then(() => onClose())}>{t('wbCheckout')}</button>
                  {confirmDelete === branch.name ? (
                    <button type="button" className="dgp-gw-textbtn" data-danger="1" onClick={() => void run('branch', () => api('/repo/branches/delete', { cwd, name: branch.name, force: false }), t('toastBranchDeleted')).then((ok) => ok && onChanged()).then(() => setConfirmDelete(''))}>{t('wbConfirmDelete')}</button>
                  ) : (
                    <button type="button" className="dgp-gw-textbtn" data-danger="1" onClick={() => setConfirmDelete(branch.name)}>{t('wbDelete')}</button>
                  )}
                </>
              ) : null}
            </div>
          ))}
        </div>
        <div>
          <div className="dgp-gw-secttitle">{t('wbRemoteBranches')}</div>
          {remote.length === 0 ? <div className="dgp-hint">{t('wbNoRemoteBranches')}</div> : null}
          {remote.map((branch) => (
            <div key={branch.name} className="dgp-gw-branchrow">
              <span className="dgp-gw-branchname">{branch.name}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

/** 新建分支。 */
function NewBranchModal({
  t, cwd, onClose, onChanged, run,
}: {
  t: (key: string) => string
  cwd: string
  onClose: () => void
  onChanged: () => Promise<void>
  run: (kind: BusyKind, action: () => Promise<{ ok: boolean; error?: string }>, okText: string) => Promise<boolean>
}) {
  const [name, setName] = useState('')
  const [checkout, setCheckout] = useState(true)
  return (
    <Modal title={t('wbNewBranch')} onClose={onClose} width={440}
      footer={
        <>
          <button type="button" className="dgp-btn" onClick={onClose}>{t('wbCancel')}</button>
          <button
            type="button"
            className="dgp-btn primary"
            disabled={name.trim().length === 0}
            onClick={() => void run('branch', () => api('/repo/branches/create', { cwd, name: name.trim(), checkout }), t('toastBranchCreated')).then((ok) => ok && onChanged()).then(() => onClose())}
          >
            {t('wbCreate')}
          </button>
        </>
      }
    >
      <label className="dgp-field">
        <span className="dgp-label">{t('wbBranchName')}</span>
        <input className="dgp-input" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </label>
      <label className="dgp-check">
        <input type="checkbox" checked={checkout} onChange={(event) => setCheckout(event.target.checked)} />
        <span className="dgp-check-title">{t('wbCheckoutAfterCreate')}</span>
      </label>
    </Modal>
  )
}

/** 提交详情：元信息 + 文件表 + diff。 */
function CommitDetailModal({ t, cwd, rev, onClose }: { t: (key: string) => string; cwd: string; rev: string; onClose: () => void }) {
  const [detail, setDetail] = useState<{ commit: CommitRow & { message?: string }; files: Array<{ path: string; added: number; deleted: number }>; diff: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setLoading(true)
    api<{ ok: boolean; commit?: CommitRow & { message?: string }; files?: Array<{ path: string; added: number; deleted: number }>; diff?: string; error?: string }>(
      `/repo/commit?cwd=${encodeURIComponent(cwd)}&rev=${encodeURIComponent(rev)}`,
    )
      .then((data) => {
        if (!alive) return
        if (data.ok && data.commit) setDetail({ commit: data.commit, files: data.files ?? [], diff: data.diff ?? '' })
        else setError(data.error || t('wbDetailFailed'))
      })
      .catch((err: Error) => alive && setError(err.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [cwd, rev, t])
  return (
    <Modal title={`${t('wbCommitDetail')} ${rev.slice(0, 8)}`} onClose={onClose} width={760}>
      {loading ? <Skeleton rows={6} /> : error ? <div className="dgp-err">{error}</div> : detail ? (
        <div className="dgp-gw-detail">
          <dl className="dgp-kv">
            <dt>hash</dt><dd><code>{detail.commit.hash}</code></dd>
            <dt>{t('wbAuthor')}</dt><dd>{detail.commit.author} &lt;{detail.commit.email}&gt;</dd>
            <dt>{t('wbDate')}</dt><dd>{shortDate(detail.commit.date)}</dd>
            {detail.commit.refs ? (
              <>
                <dt>refs</dt>
                <dd>{detail.commit.refs}</dd>
              </>
            ) : null}
          </dl>
          <pre className="dgp-gw-msgtext">{detail.commit.message || detail.commit.subject}</pre>
          <div className="dgp-gw-secttitle">{t('wbFiles')} · {detail.files.length}</div>
          <ul className="dgp-modal-list">
            {detail.files.map((file) => (
              <li key={file.path}>
                <code>{file.path}</code>
                <span className="dgp-gw-stat">
                  {file.added > 0 ? <b data-sign="add">+{file.added}</b> : null}
                  {file.deleted > 0 ? <b data-sign="del">-{file.deleted}</b> : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="dgp-gw-secttitle">diff</div>
          <pre className="dgp-gw-diff"><code>{detail.diff || t('diffEmpty')}</code></pre>
        </div>
      ) : null}
    </Modal>
  )
}

/** 远程仓库管理：name—url 列表 + 增删。 */
function RemoteModal({
  t, cwd, remotes, onClose, onChanged, run,
}: {
  t: (key: string) => string
  cwd: string
  remotes: RemoteRow[]
  onClose: () => void
  onChanged: () => Promise<void>
  run: (kind: BusyKind, action: () => Promise<{ ok: boolean; error?: string }>, okText: string) => Promise<boolean>
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  return (
    <Modal title={t('wbRemoteTitle')} onClose={onClose} width={560}>
      {remotes.length === 0 ? <div className="dgp-hint">{t('wbNoRemotes')}</div> : null}
      {remotes.map((remote) => (
        <div key={remote.name} className="dgp-gw-branchrow">
          <span className="dgp-gw-branchname">{remote.name}</span>
          <code className="dgp-gw-remoteurl">{remote.url}</code>
          <button type="button" className="dgp-gw-textbtn" data-danger="1" onClick={() => void run('remote', () => api('/repo/remotes/remove', { cwd, name: remote.name }), t('toastRemoteRemoved')).then((ok) => ok && onChanged())}>{t('wbRemove')}</button>
        </div>
      ))}
      <div className="dgp-sep" />
      <div className="dgp-field">
        <span className="dgp-label">{t('wbRemoteName')}</span>
        <input className="dgp-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="origin" />
      </div>
      <div className="dgp-field">
        <span className="dgp-label">{t('wbRemoteUrl')}</span>
        <input className="dgp-input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/user/repo.git" />
      </div>
      <div className="dgp-modal-foot" style={{ borderTop: 'none', padding: '10px 0 0' }}>
        <button
          type="button"
          className="dgp-btn primary"
          disabled={name.trim().length === 0 || url.trim().length === 0}
          onClick={() => void run('remote', () => api('/repo/remotes/add', { cwd, name: name.trim(), url: url.trim() }), t('toastRemoteAdded')).then((ok) => { if (ok) { setName(''); setUrl(''); return onChanged() } return undefined })}
        >
          {t('wbAdd')}
        </button>
      </div>
    </Modal>
  )
}

/** Pull 策略选择：merge / rebase 二选一。 */
function PullModal({
  t, onClose, onPull, upstream, hasRemote,
}: {
  t: (key: string) => string
  onClose: () => void
  onPull: (strategy: 'merge' | 'rebase') => void
  upstream: string
  hasRemote: boolean
}) {
  return (
    <Modal title={t('wbPullTitle')} onClose={onClose} width={460}
      footer={
        <>
          <button type="button" className="dgp-btn" onClick={onClose}>{t('wbCancel')}</button>
          <button type="button" className="dgp-btn" disabled={!hasRemote} onClick={() => onPull('rebase')}>{t('wbPullRebase')}</button>
          <button type="button" className="dgp-btn primary" disabled={!hasRemote} onClick={() => onPull('merge')}>{t('wbPullMerge')}</button>
        </>
      }
    >
      {!hasRemote ? <div className="dgp-err">{t('syncMissingConfig')}</div> : null}
      <p className="dgp-modal-text">{upstream ? `${t('wbPullUpstream')}: ${upstream}` : t('wbPullNoUpstream')}</p>
      <p className="dgp-hint">{t('wbPullHint')}</p>
    </Modal>
  )
}
