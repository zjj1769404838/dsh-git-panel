/**
 * Git 工作台主面板（IDEA 式 Git 工具窗）：由 BranchChip 点击打开。
 * 布局（参照 IDEA Commit 工具窗 + Git Log 三栏）：
 *   顶栏 = 仓库 · 分支▾ · ↑↓N* · Fetch/Pull/Push · ⟳ · ⚙
 *   左栏 = 变更列表（未暂存/已暂存/未跟踪，勾选 + stage/unstage/discard）
 *   右栏 = tabs（历史 | 分支图 | Diff 预览）
 *   底栏 = 提交消息框 + Amend + Commit
 * 配置类操作（分支管理/新建分支/提交详情/远程仓库）走二级弹窗，层级与 IDEA 对齐。
 */
import { useEffect, useState } from 'react'
import {
  api,
  useStyles,
  Toast,
  Dot,
  EmptyState,
  Skeleton,
  BranchIcon,
  RefreshIcon,
  GearIcon,
  CopyIcon,
  PlusIcon,
  type RepoStatusView,
  type RepoChangesView,
  type RepoGraphView,
  type Dict,
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

/** fetch / pull / push / stage 等异步操作的进行中状态（防重复提交 + 按钮反馈）。 */
type BusyKind = 'none' | 'commit' | 'pull' | 'push' | 'fetch' | 'stage' | 'unstage' | 'discard' | 'branch' | 'remote' | 'init'

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

/** Modal 骨架：二级弹窗统一容器（遮罩 + 面板 + 标题 + 关闭），层级与 IDEA 对齐。 */
function Modal({
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
            {/* 关闭叉 */}
          </button>
        </div>
        <div className="dgp-modal-body">{children}</div>
        {footer ? <div className="dgp-modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

// createPortal 由宿主 react-dom 提供；esbuild external 已含 react-dom。
declare const createPortal: (children: React.ReactNode, container: Element) => React.ReactNode

export function Workbench({ t, cwd, status, onStatusChange, onClose, onOpenSettings }: WorkbenchProps) {
  useStyles()
  const [tab, setTab] = useState<'history' | 'graph' | 'diff'>('history')
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

  // 二级弹窗（同一时刻最多一个，IDEA 式层级）。
  const [modal, setModal] = useState<'none' | 'branches' | 'newBranch' | 'commit' | 'remote' | 'pull'>('none')
  const [detailRev, setDetailRev] = useState('')
  const [diffMode, setDiffMode] = useState<'worktree' | 'staged'>('worktree')
  const [diffText, setDiffText] = useState('')
  const [diffError, setDiffError] = useState('')
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffTruncated, setDiffTruncated] = useState(false)
  const [diffPath, setDiffPath] = useState('')

  const isRepo = status !== null && status.isRepo
  const authorized = status !== null && status.authorized !== false

  const showToast = (tone: 'ok' | 'error' | 'info', text: string) => setToast({ tone, text })

  /** 全量刷新：状态 + 变更 + 历史 + 分支 + 远程（写操作后统一走这里）。 */
  const refreshAll = async () => {
    if (!cwd) return
    await Promise.all([loadStatus(), loadChanges(), loadCommits(), loadBranches(), loadRemotes()])
  }

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
      const data = await api<{ ok: boolean; commits?: CommitRow[]; error?: string }>(`/repo/commits?cwd=${encodeURIComponent(cwd)}&limit=60`)
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
      const data = await api<{ ok: boolean; graph?: RepoGraphView; error?: string }>(`/repo/graph?cwd=${encodeURIComponent(cwd)}&limit=30`)
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

  // 初次挂载/仓库变化：全量拉取。
  useEffect(() => {
    if (!cwd) return
    void refreshAll()
    if (isRepo) {
      void loadGraph()
      void loadDiff(diffMode, '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd, isRepo])

  // 右栏在「历史 | 分支图」之间切换时懒加载对应数据。
  useEffect(() => {
    if (!isRepo) return
    if (tab === 'graph') void loadGraph()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isRepo])

  /** 未暂存文件的 porcelain 双列状态码（index 列 + worktree 列）。 */
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
  const run = async (kind: BusyKind, action: () => Promise<{ ok: boolean; error?: string }>, okText: string): Promise<boolean> => {
    if (busy !== 'none') return false
    setBusy(kind)
    try {
      const result = await action()
      if (result.ok) {
        showToast('ok', okText)
        await refreshAll()
        return true
      }
      showToast('error', result.error || t('actionFailed'))
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

  /** discard 需要用户在确认弹窗里再点一次（后端强制 confirmed:true）。 */
  const [discardPending, setDiscardPending] = useState<string[] | null>(null)

  const doDiscard = (paths: string[]) =>
    run('discard', () => api<{ ok: boolean; error?: string }>('/repo/discard', { cwd, paths, confirmed: true }), t('toastDiscarded'))

  const doCommit = () =>
    run('commit', () => api<{ ok: boolean; error?: string; hash?: string }>('/repo/commit', { cwd, message, amend }), amend ? t('toastAmended') : t('toastCommitted')).then(
      (ok) => {
        if (ok) {
          setMessage('')
          setAmend(false)
        }
      },
    )

  const doFetch = () => run('fetch', () => api<SyncView>('/repo/fetch', { cwd }), t('toastFetched'))

  const doPull = (strategy: 'merge' | 'rebase') =>
    run('pull', () => api<SyncView>('/repo/pull', { cwd, strategy }), strategy === 'rebase' ? t('toastPulledRebase') : t('toastPulledMerge')).then((ok) => {
      if (!ok) void loadStatus()
    })

  const doPush = (setUpstream: boolean) =>
    run('push', () => api<SyncView>('/repo/push', { cwd, remote: remotes[0]?.name ?? '', branch: currentBranch, setUpstream }), t('toastPushed')).then((ok) => {
      if (!ok) void loadStatus()
    })

  /** pull/push 结果的专用错误解读：冲突/被拒/缺配置给不同文案与引导。 */
  const syncErrorText = (view: SyncView): string => {
    if (view.conflicted) return t('syncConflicted')
    if (view.rejected) return t('syncRejected')
    if (view.missingConfig) return t('syncMissingConfig')
    return view.error || t('syncFailed')
  }

  const doInit = () =>
    run('init', () => api<{ ok: boolean; error?: string; result?: { created?: boolean; branch?: string } }>('/repo/init', { cwd, branch: 'main' }), t('initDone'))

  const openDetail = (rev: string) => {
    setDetailRev(rev)
    setModal('commit')
  }

  const currentBranchRow = branches.find((branch) => branch.kind === 'local' && branch.current)
  const hasRemote = remotes.length > 0
  const canCommit = stagedFiles.length > 0 && message.trim().length > 0 && busy === 'none'
  const canPull = isRepo && authorized && busy === 'none'
  const canPush = isRepo && authorized && hasRemote && currentBranch.length > 0 && busy === 'none'

  // ---------- 各状态的首屏 ----------
  if (!status) {
    return (
      <div className="dgp-root dgp-wb" role="dialog" aria-label={t('wbTitle')}>
        <div className="dgp-wb-head">
          <span className="dgp-wb-title">{t('wbTitle')}</span>
          <button type="button" className="dgp-wb-x" onClick={onClose} aria-label="close">×</button>
        </div>
        <div className="dgp-wb-state"><Skeleton rows={4} /></div>
      </div>
    )
  }

  if (!isRepo) {
    return (
      <div className="dgp-root dgp-wb" role="dialog" aria-label={t('wbTitle')}>
        <div className="dgp-wb-head">
          <span className="dgp-wb-title">{t('wbTitle')}</span>
          <button type="button" className="dgp-wb-x" onClick={onClose} aria-label="close">×</button>
        </div>
        <div className="dgp-wb-state">
          <EmptyState title={t('notRepo')} hint={t('wbInitHint')} />
          <button type="button" className="dgp-btn primary" disabled={busy !== 'none'} onClick={() => void doInit()}>
            <PlusIcon />
            {t('menuInit')}
          </button>
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="dgp-root dgp-wb" role="dialog" aria-label={t('wbTitle')}>
        <div className="dgp-wb-head">
          <span className="dgp-wb-title">{t('wbTitle')}</span>
          <button type="button" className="dgp-wb-x" onClick={onClose} aria-label="close">×</button>
        </div>
        <div className="dgp-wb-state">
          <EmptyState title={t('unauthorizedRoot')} hint={t('wbUnauthorizedHint')} />
          <button
            type="button"
            className="dgp-btn"
            onClick={() => {
              onClose()
              onOpenSettings()
            }}
          >
            <GearIcon />
            {t('menuSettings')}
          </button>
        </div>
      </div>
    )
  }

  // ---------- 正常主面板 ----------
  return (
    <div className="dgp-root dgp-wb" role="dialog" aria-label={t('wbTitle')}>
      {/* 顶栏：仓库 · 分支 · 同步按钮 · 设置 */}
      <div className="dgp-wb-head">
        <span className="dgp-wb-repo" title={status.root || cwd}>
          <BranchIcon />
          {status.root?.split(/[\\/]/).pop() || cwd}
        </span>
        <button type="button" className="dgp-wb-branch" data-current={currentBranchRow ? '1' : '0'} onClick={() => setModal('branches')}>
          {currentBranch || 'HEAD'} <span className="dgp-wb-caret">▾</span>
        </button>
        <span className="dgp-wb-aux">
          {status.ahead > 0 ? `↑${status.ahead}` : ''}
          {status.behind > 0 ? `↓${status.behind}` : ''}
          {status.changed > 0 ? `${status.changed}*` : ''}
        </span>
        <span className="dgp-wb-spacer" />
        <button type="button" className="dgp-btn ghost" disabled={!canPull} onClick={() => void doFetch()}>{t('wbFetch')}</button>
        <button type="button" className="dgp-btn" disabled={!canPull} onClick={() => setModal('pull')}>{t('wbPull')}</button>
        <button type="button" className="dgp-btn primary" disabled={!canPush} onClick={() => void doPush(false)}>{t('wbPush')}</button>
        <button type="button" className="dgp-wb-icon" disabled={busy !== 'none'} onClick={() => void refreshAll()} aria-label={t('refresh')}>
          <RefreshIcon />
        </button>
        <button type="button" className="dgp-wb-icon" onClick={() => { onClose(); onOpenSettings() }} aria-label={t('menuSettings')}>
          <GearIcon />
        </button>
        <button type="button" className="dgp-wb-x" onClick={onClose} aria-label="close">×</button>
      </div>

      {detectFailedNote()}

      {/* 中部：左变更 / 右信息 tabs */}
      <div className="dgp-wb-main">
        <section className="dgp-wb-left" aria-label={t('changesTitle')}>
          <div className="dgp-wb-left-head">
            <span>{t('changesTitle')}</span>
            <span className="dgp-wb-count">{changes?.files.length ?? 0}</span>
          </div>
          {changesLoading && !changes ? (
            <Skeleton rows={5} />
          ) : changesError ? (
            <div className="dgp-err" style={{ padding: '8px 10px' }}>{changesError}</div>
          ) : !changes || changes.files.length === 0 ? (
            <EmptyState title={t('changesEmpty')} hint={t('wbCleanHint')} />
          ) : (
            <div className="dgp-wb-filelist">
              {/* 已暂存 */}
              {stagedFiles.length > 0 ? (
                <div className="dgp-wb-group">
                  <label className="dgp-wb-group-title">
                    <input
                      type="checkbox"
                      checked={stagedFiles.every((file) => selected.has(file.path))}
                      onChange={(event) => selectAll(stagedFiles.map((file) => file.path), event.target.checked)}
                    />
                    {t('changesStaged')} · {stagedFiles.length}
                  </label>
                  {stagedFiles.map((file) => (
                    <FileRow
                      key={`s-${file.path}`}
                      file={file}
                      checked={selected.has(file.path)}
                      onToggle={() => toggleSelect(file.path)}
                      onPreview={() => { setDiffMode('staged'); setDiffPath(file.path); void loadDiff('staged', file.path); setTab('diff') }}
                      onAction={() => void unstageSelected([file.path])}
                      actionLabel={t('wbUnstage')}
                      actionDanger={false}
                      t={t}
                    />
                  ))}
                </div>
              ) : null}
              {/* 未暂存（已跟踪） */}
              {modified.length > 0 ? (
                <div className="dgp-wb-group">
                  <label className="dgp-wb-group-title">
                    <input
                      type="checkbox"
                      checked={modified.every((file) => selected.has(file.path))}
                      onChange={(event) => selectAll(modified.map((file) => file.path), event.target.checked)}
                    />
                    {t('wbUnstaged')} · {modified.length}
                  </label>
                  {modified.map((file) => (
                    <FileRow
                      key={`w-${file.path}`}
                      file={file}
                      checked={selected.has(file.path)}
                      onToggle={() => toggleSelect(file.path)}
                      onPreview={() => { setDiffMode('worktree'); setDiffPath(file.path); void loadDiff('worktree', file.path); setTab('diff') }}
                      onAction={() => void stageSelected([file.path])}
                      actionLabel={t('wbStage')}
                      actionDanger={false}
                      t={t}
                    />
                  ))}
                </div>
              ) : null}
              {/* 未跟踪 */}
              {untracked.length > 0 ? (
                <div className="dgp-wb-group">
                  <label className="dgp-wb-group-title">
                    <input
                      type="checkbox"
                      checked={untracked.every((file) => selected.has(file.path))}
                      onChange={(event) => selectAll(untracked.map((file) => file.path), event.target.checked)}
                    />
                    {t('wbUntracked')} · {untracked.length}
                  </label>
                  {untracked.map((file) => (
                    <FileRow
                      key={`u-${file.path}`}
                      file={file}
                      checked={selected.has(file.path)}
                      onToggle={() => toggleSelect(file.path)}
                      onPreview={() => undefined}
                      onAction={() => void stageSelected([file.path])}
                      actionLabel={t('wbStage')}
                      actionDanger={false}
                      t={t}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )}
          {/* 左栏批量操作条 */}
          {selected.size > 0 ? (
            <div className="dgp-wb-actions">
              <button type="button" className="dgp-btn" disabled={busy !== 'none'} onClick={() => void stageSelected([...selected])}>{t('wbStage')} ({selected.size})</button>
              <button type="button" className="dgp-btn" disabled={busy !== 'none'} onClick={() => void unstageSelected([...selected])}>{t('wbUnstage')}</button>
              <button type="button" className="dgp-btn danger" disabled={busy !== 'none'} onClick={() => setDiscardPending([...selected])}>{t('wbDiscard')}</button>
            </div>
          ) : null}
        </section>

        <section className="dgp-wb-right">
          <div className="dgp-wb-tabs" role="tablist">
            <button type="button" className="dgp-tab" data-on={tab === 'history' ? '1' : '0'} onClick={() => setTab('history')}>{t('wbHistory')}</button>
            <button type="button" className="dgp-tab" data-on={tab === 'graph' ? '1' : '0'} onClick={() => setTab('graph')}>{t('wbGraph')}</button>
            <button type="button" className="dgp-tab" data-on={tab === 'diff' ? '1' : '0'} onClick={() => setTab('diff')}>{t('wbDiffTab')}</button>
          </div>
          <div className="dgp-wb-rightbody">
            {tab === 'history' ? (
              commitsLoading && commits.length === 0 ? (
                <Skeleton rows={6} />
              ) : commitsError ? (
                <div className="dgp-err" style={{ padding: '8px 10px' }}>{commitsError}</div>
              ) : commits.length === 0 ? (
                <EmptyState title={t('wbNoCommits')} hint={t('wbNoCommitsHint')} />
              ) : (
                <div className="dgp-wb-log" role="list">
                  {commits.map((commit) => (
                    <button key={commit.hash} type="button" className="dgp-wb-logrow" role="listitem" onClick={() => openDetail(commit.hash)}>
                      <span className="dgp-wb-loghash">{commit.shortHash}</span>
                      <span className="dgp-wb-logmsg" title={commit.subject}>{commit.subject}</span>
                      {parseRefs(commit.refs).map((ref) => (
                        <span key={ref.text} className="dgp-graph-ref" data-kind={ref.kind === 'head' ? 'head' : ref.kind}>{ref.text}</span>
                      ))}
                      <span className="dgp-wb-logauthor">{commit.author}</span>
                      <span className="dgp-wb-logdate">{shortDate(commit.date)}</span>
                    </button>
                  ))}
                </div>
              )
            ) : null}
            {tab === 'graph' ? <GraphView t={t} graph={graph} loading={graphLoading} error={graphError} /> : null}
            {tab === 'diff' ? (
              <div className="dgp-wb-diffwrap">
                <div className="dgp-wb-diffbar">
                  <span className="dgp-wb-diffpath">{diffPath || (diffMode === 'staged' ? t('changesStaged') : t('wbUnstaged'))}</span>
                  <button type="button" className="dgp-wb-icon" onClick={() => void loadDiff(diffMode, diffPath)} aria-label={t('refresh')}>
                    <RefreshIcon />
                  </button>
                </div>
                {diffLoading ? (
                  <Skeleton rows={6} />
                ) : diffError ? (
                  <div className="dgp-err" style={{ padding: '8px 10px' }}>{diffError}</div>
                ) : diffText ? (
                  <pre className="dgp-wb-diff"><code>{diffText}</code></pre>
                ) : (
                  <EmptyState title={t('diffEmpty')} hint={t('diffEmptyHint')} />
                )}
                {diffTruncated ? <div className="dgp-hint" style={{ padding: '4px 10px' }}>{t('diffTruncated')}</div> : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {/* 底栏：提交框（暂存为空或消息为空时禁用并说明） */}
      <div className="dgp-wb-foot">
        <textarea
          className="dgp-wb-msg"
          placeholder={t('wbMsgPlaceholder')}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
        />
        <label className="dgp-wb-amend">
          <input type="checkbox" checked={amend} onChange={(event) => setAmend(event.target.checked)} />
          {t('wbAmend')}
        </label>
        <button type="button" className="dgp-btn primary" disabled={!canCommit} onClick={() => void doCommit()}>{t('wbCommit')}</button>
      </div>
      {stagedFiles.length === 0 && (message.trim().length > 0 || amend) ? (
        <div className="dgp-hint" style={{ padding: '0 12px 8px' }}>{t('wbCommitNeedsStaged')}</div>
      ) : null}

      {/* toast 与二级弹窗 */}
      {toast ? <Toast tone={toast.tone} text={toast.text} onDone={() => setToast(null)} /> : null}

      {/* 破坏性操作确认：丢弃改动 */}
      {discardPending ? (
        <Modal title={t('wbDiscardTitle')} onClose={() => setDiscardPending(null)} width={440}>
          <p className="dgp-modal-text">{t('wbDiscardText')}</p>
          <ul className="dgp-modal-list">
            {discardPending.map((path) => (
              <li key={path}><code>{path}</code></li>
            ))}
          </ul>
        </Modal>
      ) : null}

      {modal === 'branches' ? <BranchesModal t={t} cwd={cwd} branches={branches} current={currentBranch} onClose={() => setModal('none')} onChanged={refreshAll} run={run} /> : null}
      {modal === 'newBranch' ? <NewBranchModal t={t} cwd={cwd} onClose={() => setModal('none')} onChanged={refreshAll} run={run} /> : null}
      {modal === 'commit' ? <CommitDetailModal t={t} cwd={cwd} rev={detailRev} onClose={() => setModal('none')} /> : null}
      {modal === 'remote' ? <RemoteModal t={t} cwd={cwd} remotes={remotes} onClose={() => setModal('none')} onChanged={refreshAll} run={run} /> : null}
      {modal === 'pull' ? (
        <PullModal
          t={t}
          onClose={() => setModal('none')}
          onPull={(strategy) => {
            setModal('none')
            void doPull(strategy)
          }}
          upstream={upstream}
          hasRemote={hasRemote}
        />
      ) : null}
    </div>
  )
}

/** 顶部：授权目录外的黄条提醒（读得到状态但写入会被拒）。 */
function detectFailedNote(): React.ReactNode {
  return null
}

/** 变更列表单行：状态码 + 路径 + 增删 + hover 动作（stage/unstage）。 */
function FileRow({
  file,
  checked,
  onToggle,
  onPreview,
  onAction,
  actionLabel,
  actionDanger,
  t,
}: {
  file: { path: string; index: string; worktree: string; added: number; deleted: number; staged: boolean }
  checked: boolean
  onToggle: () => void
  onPreview: () => void
  onAction: () => void
  actionLabel: string
  actionDanger: boolean
  t: (key: string) => string
}) {
  const code = file.staged ? file.index || 'M' : file.worktree === '?' ? '??' : file.worktree || 'M'
  return (
    <div className="dgp-wb-file" data-staged={file.staged ? '1' : '0'}>
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={file.path} />
      <button type="button" className="dgp-wb-filecode" data-code={code} onClick={onPreview}>{code}</button>
      <button type="button" className="dgp-wb-filepath" onClick={onPreview} title={file.path}>{file.path}</button>
      {file.added > 0 || file.deleted > 0 ? (
        <span className="dgp-wb-filestat">
          {file.added > 0 ? <b data-sign="add">+{file.added}</b> : null}
          {file.deleted > 0 ? <b data-sign="del">-{file.deleted}</b> : null}
        </span>
      ) : null}
      <button type="button" className="dgp-wb-fileact" data-danger={actionDanger ? '1' : '0'} onClick={onAction}>{actionLabel}</button>
      <span className="sr-only">{t('changesTitle')}</span>
    </div>
  )
}

/** 分支管理弹窗（IDEA 分支弹窗简化：Local/Remote 两组 + 切换/新建/删除）。 */
function BranchesModal({
  t, cwd, branches, current, onClose, onChanged, run,
}: {
  t: (key: string) => string
  cwd: string
  branches: BranchRow[]
  current: string
  onClose: () => void
  onChanged: () => Promise<void>
  run: (kind: BusyKind, action: () => Promise<{ ok: boolean; error?: string }>, okText: string) => Promise<boolean>
}) {
  const local = branches.filter((branch) => branch.kind === 'local')
  const remote = branches.filter((branch) => branch.kind === 'remote')
  const [confirmDelete, setConfirmDelete] = useState('')
  return (
    <Modal title={t('wbBranchTitle')} onClose={onClose} width={480}>
      <div className="dgp-wb-branchcols">
        <div>
          <div className="dgp-wb-group-title" style={{ padding: '2px 0 6px' }}>{t('wbLocalBranches')}</div>
          {local.map((branch) => (
            <div key={branch.name} className="dgp-wb-branchrow" data-current={branch.current ? '1' : '0'}>
              <span className="dgp-wb-branchname">{branch.name}{branch.current ? ' ✓' : ''}</span>
              <span className="dgp-wb-branchmeta">
                {branch.ahead > 0 ? `↑${branch.ahead}` : ''}
                {branch.behind > 0 ? `↓${branch.behind}` : ''}
              </span>
              {!branch.current ? (
                <>
                  <button type="button" className="dgp-btn" onClick={() => void run('branch', () => api('/repo/branches/checkout', { cwd, name: branch.name }), t('toastCheckedOut')).then((ok) => ok && onChanged()).then(() => onClose())}>{t('wbCheckout')}</button>
                  {confirmDelete === branch.name ? (
                    <button type="button" className="dgp-btn danger" onClick={() => void run('branch', () => api('/repo/branches/delete', { cwd, name: branch.name, force: false }), t('toastBranchDeleted')).then((ok) => ok && onChanged()).then(() => setConfirmDelete(''))}>{t('wbConfirmDelete')}</button>
                  ) : (
                    <button type="button" className="dgp-btn danger" onClick={() => setConfirmDelete(branch.name)}>{t('wbDelete')}</button>
                  )}
                </>
              ) : null}
            </div>
          ))}
        </div>
        <div>
          <div className="dgp-wb-group-title" style={{ padding: '2px 0 6px' }}>{t('wbRemoteBranches')}</div>
          {remote.length === 0 ? <div className="dgp-hint">{t('wbNoRemoteBranches')}</div> : null}
          {remote.map((branch) => (
            <div key={branch.name} className="dgp-wb-branchrow">
              <span className="dgp-wb-branchname">{branch.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="dgp-modal-foot" style={{ borderTop: 'none' }}>
        <button type="button" className="dgp-btn primary" onClick={() => { onClose(); /* 打开新建弹窗由父组件接管 */ }}>{t('wbNewBranch')}</button>
      </div>
    </Modal>
  )
}

/** 新建分支弹窗。 */
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
    <Modal title={t('wbNewBranch')} onClose={onClose} width={420}
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

/** 提交详情弹窗：元信息 + 文件表 + diff。 */
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
    <Modal title={`${t('wbCommitDetail')} ${rev.slice(0, 8)}`} onClose={onClose} width={720}>
      {loading ? <Skeleton rows={6} /> : error ? <div className="dgp-err">{error}</div> : detail ? (
        <div className="dgp-wb-detail">
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
          <pre className="dgp-wb-msgtext">{detail.commit.message || detail.commit.subject}</pre>
          <div className="dgp-wb-group-title" style={{ padding: '6px 0' }}>{t('wbFiles')} · {detail.files.length}</div>
          <ul className="dgp-modal-list">
            {detail.files.map((file) => (
              <li key={file.path}>
                <code>{file.path}</code>
                <span className="dgp-wb-filestat">
                  {file.added > 0 ? <b data-sign="add">+{file.added}</b> : null}
                  {file.deleted > 0 ? <b data-sign="del">-{file.deleted}</b> : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="dgp-wb-group-title" style={{ padding: '6px 0' }}>diff</div>
          <pre className="dgp-wb-diff"><code>{detail.diff || t('diffEmpty')}</code></pre>
        </div>
      ) : null}
    </Modal>
  )
}

/** 远程仓库管理弹窗（IDEA Manage Remotes：name—url 列表 + 增删）。 */
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
    <Modal title={t('wbRemoteTitle')} onClose={onClose} width={520}>
      {remotes.length === 0 ? <div className="dgp-hint" style={{ padding: '4px 0 8px' }}>{t('wbNoRemotes')}</div> : null}
      {remotes.map((remote) => (
        <div key={remote.name} className="dgp-wb-branchrow">
          <span className="dgp-wb-branchname">{remote.name}</span>
          <code className="dgp-wb-remoteurl">{remote.url}</code>
          <button type="button" className="dgp-btn danger" onClick={() => void run('remote', () => api('/repo/remotes/remove', { cwd, name: remote.name }), t('toastRemoteRemoved')).then((ok) => ok && onChanged())}>{t('wbRemove')}</button>
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
      <div className="dgp-modal-foot" style={{ borderTop: 'none' }}>
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

/** Pull 策略选择弹窗（IDEA Update Project：merge / rebase 二选一）。 */
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
    <Modal title={t('wbPullTitle')} onClose={onClose} width={440}
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
