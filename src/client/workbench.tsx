/**
 * Git 工作台（BUILD dgp-v19）。
 *
 * 形态沿用 dgp-v18 的居中模态框 + 左侧竖排导航，v19 在其上补齐六件事：
 *   - 差异视图换成 DiffView：行号 / Ctrl+F 就地查找 / 并排-统一（记忆）/ 词级高亮 / 未变更块折叠 / 语法高亮；
 *   - 历史视图加关键词搜索（服务端 git --grep）与「加载更多」（offset 分页）；
 *   - 新增「文件」视图（懒加载目录树 + 预览）、「标签」视图（建/删/推）、「贮藏」视图（存/取/应用/删除）；
 *   - 提交框加「AI 生成」按钮（走宿主模型服务，只读仓库内容，结果落进输入框由用户确认）；
 *   - 顶栏仓库名变下拉，可在已发现的本地仓库间切换（切换只影响本工作台，不改会话 cwd）。
 *
 * dgp-v20：取消独立「分支图」视图，历史列表左侧直接贴泳道（数据仍取自 /repo/graph，
 * 按 hash 与提交对齐），导航收敛为 5 项；列表/泳道可切并记忆。
 *
 * 数据契约：node 端点 /repo/status|changes|commits|branches|remotes|graph|diff|commit|stage|unstage|discard|
 * fetch|pull|push|init|remotes/*|tags|stash|tree|file|discover|suggest-message。
 */
import { useEffect, useMemo, useState } from 'react'
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
  type GraphRowView,
  type StashView,
  type TagView,
  readPref,
  writePref,
  PREF_GRAPH_LANES,
  PREF_GRAPH_LIMIT,
  PREF_AI_MODEL,
} from './shared.js'
import { LaneColumn, laneWidth } from './graphview.js'
import { DiffView } from './diffview.js'
import { FileBrowser } from './filebrowser.js'

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
type BusyKind =
  | 'none'
  | 'commit'
  | 'pull'
  | 'push'
  | 'fetch'
  | 'stage'
  | 'unstage'
  | 'discard'
  | 'branch'
  | 'remote'
  | 'init'
  | 'tag'
  | 'stash'
  | 'suggest'

/** 主区视图：一次只呈现一件事，靠左侧导航切换。 */
type ViewKind = 'changes' | 'history' | 'files' | 'tags' | 'stash'

/** 二级层：同一时刻最多一层。 */
type LayerKind = 'none' | 'branches' | 'newBranch' | 'commit' | 'remote' | 'pull' | 'diff'

/** /repo/discover 行（node 半边 discoverRepos）。 */
interface RepoRow {
  root: string
  name: string
  branch: string
  remotes: string[]
}

/** 提交历史每页条数（配合「加载更多」按 offset 翻页）。 */
const COMMIT_PAGE = 80

/** 扩展名 → 高亮语言标识（与 node 侧 files.ts 的 langOf 同一套键，供 DiffView 用）。 */
const LANG_BY_EXT: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  sql: 'sql',
  diff: 'diff',
  patch: 'diff',
}

/** 从 diff 的文件路径推语言标识（取不到返回空串，DiffView 会退回纯文本）。 */
function langOfPath(path: string): string {
  if (!path) return ''
  const name = path.split(/[\\/]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  return LANG_BY_EXT[name.slice(dot + 1).toLowerCase()] ?? ''
}

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

  // 历史视图：关键词（服务端 git --grep）+ 分页（offset 累加，翻得到旧提交）。
  const [commitQuery, setCommitQuery] = useState('')
  const [commitSearch, setCommitSearch] = useState('')
  const [commitsMore, setCommitsMore] = useState(false)
  const [commitsExhausted, setCommitsExhausted] = useState(false)
  // 历史列表是否画左侧泳道（默认开，与对标插件「历史即图」一致）。
  const [showLane, setShowLane] = useState(() => readPref(PREF_GRAPH_LANES, '1') !== '0')

  // 标签 / 贮藏 / 仓库切换 / AI 生成。
  const [tags, setTags] = useState<TagView[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [tagsError, setTagsError] = useState('')
  const [stashes, setStashes] = useState<StashView[]>([])
  const [stashesLoading, setStashesLoading] = useState(false)
  const [stashesError, setStashesError] = useState('')
  const [repos, setRepos] = useState<RepoRow[]>([])
  const [repoMenu, setRepoMenu] = useState(false)
  const [activeRoot, setActiveRoot] = useState('')
  const [suggesting, setSuggesting] = useState(false)

  /** 当前操作的仓库根：默认跟随会话 dir，用户在下拉里切换后以切换值为准。 */
  const dir = activeRoot || cwd

  const toggleLane = (next: boolean) => {
    setShowLane(next)
    writePref(PREF_GRAPH_LANES, next ? '1' : '0')
    if (next && isRepo && !graph) void loadGraph()
  }

  /**
   * 历史列表的泳道数据：/repo/graph 给的是「当前分支可达提交」的行号与车道，
   * 历史列表可能是搜索过滤后的子集，所以按 hash 取车道、按列表下标重排 row。
   * 列表里出现图里没有的提交（搜索命中别的分支）时补一条只有节点的空行，保证不错位。
   */
  const laneRows: GraphRowView[] = (() => {
    if (!showLane) return []
    const byHash = new Map<string, GraphRowView>()
    for (const row of graph?.rows ?? []) byHash.set(row.hash, row)
    return commits.map((commit, index) => {
      const hit = byHash.get(commit.hash)
      if (hit) return { ...hit, row: index }
      return {
        hash: commit.hash,
        short: commit.shortHash,
        parents: commit.parents,
        author: commit.author,
        date: commit.date,
        subject: commit.subject,
        refs: parseRefs(commit.refs).map((ref) => ({ name: ref.text, kind: ref.kind === 'other' ? 'local' : ref.kind })),
        row: index,
        lane: 0,
        segments: [],
        through: [],
      }
    })
  })()
  const laneCount = Math.max(1, graph?.laneCount ?? 1)

  const showToast = (tone: 'ok' | 'error' | 'info', text: string) => setToast({ tone, text })

  const loadStatus = async () => {
    try {
      const data = await api<{ ok: boolean; status?: RepoStatusView }>(`/repo/status?cwd=${encodeURIComponent(dir)}`)
      if (data.ok && data.status) onStatusChange(data.status)
    } catch {
      /* 状态失败不阻塞其它面板数据 */
    }
  }

  const loadChanges = async () => {
    if (!dir || !isRepo) return
    setChangesLoading(true)
    try {
      const data = await api<{ ok: boolean; changes?: RepoChangesView; error?: string }>(`/repo/changes?cwd=${encodeURIComponent(dir)}`)
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

  /**
   * 提交历史：`offset` 为 0 时整体替换（首屏 / 搜索词变化），否则追加（加载更多）。
   * 搜索走服务端 git --grep，前端全量过滤会让「加载更多」永远翻不到旧提交。
   */
  const loadCommits = async (search = commitSearch, offset = 0) => {
    if (!dir || !isRepo) return
    const appending = offset > 0
    if (appending) setCommitsMore(true)
    else setCommitsLoading(true)
    try {
      const params = new URLSearchParams({ cwd: dir, limit: String(COMMIT_PAGE), offset: String(offset) })
      if (search.trim()) params.set('search', search.trim())
      const data = await api<{ ok: boolean; commits?: CommitRow[]; truncated?: boolean; error?: string }>(
        `/repo/commits?${params.toString()}`,
      )
      if (data.ok && Array.isArray(data.commits)) {
        const rows = data.commits
        setCommits((prev) => (appending ? [...prev, ...rows] : rows))
        // 服务端 truncated=false 表示已经取到末尾，前端不再显示「加载更多」。
        setCommitsExhausted(data.truncated === false && rows.length < COMMIT_PAGE)
        setCommitsError('')
      } else {
        if (!appending) setCommits([])
        setCommitsError(data.error || '')
      }
    } catch (error) {
      if (!appending) setCommits([])
      setCommitsError((error as Error).message)
    } finally {
      setCommitsLoading(false)
      setCommitsMore(false)
    }
  }

  const loadBranches = async () => {
    if (!dir || !isRepo) return
    try {
      const data = await api<{ ok: boolean; branches?: BranchRow[]; current?: string; error?: string }>(`/repo/branches?cwd=${encodeURIComponent(dir)}`)
      if (data.ok) {
        setBranches(data.branches ?? [])
        setCurrentBranch(data.current ?? '')
      }
    } catch {
      /* 分支失败不阻塞主面板 */
    }
  }

  const loadRemotes = async () => {
    if (!dir || !isRepo) return
    try {
      const data = await api<{ ok: boolean; remotes?: RemoteRow[]; upstream?: string }>(`/repo/remotes?cwd=${encodeURIComponent(dir)}`)
      if (data.ok) {
        setRemotes(data.remotes ?? [])
        setUpstream(data.upstream ?? '')
      }
    } catch {
      /* 远程失败不阻塞主面板 */
    }
  }

  const loadGraph = async () => {
    if (!dir || !isRepo) return
    setGraphLoading(true)
    try {
      // 行数走偏好（20~200），后端会再夹到 5..100；历史泳道与提交列表对齐靠它一次拉够。
      const want = Number.parseInt(readPref(PREF_GRAPH_LIMIT, '60'), 10)
      const limit = Number.isFinite(want) ? Math.min(100, Math.max(20, want)) : 60
      const data = await api<{ ok: boolean; graph?: RepoGraphView; error?: string }>(`/repo/graph?cwd=${encodeURIComponent(dir)}&limit=${limit}`)
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

  const loadTags = async () => {
    if (!dir || !isRepo) return
    setTagsLoading(true)
    try {
      const data = await api<{ ok: boolean; tags?: TagView[]; error?: string }>(`/repo/tags?cwd=${encodeURIComponent(dir)}`)
      if (data.ok && Array.isArray(data.tags)) {
        setTags(data.tags)
        setTagsError('')
      } else {
        setTags([])
        setTagsError(data.error || '')
      }
    } catch (error) {
      setTags([])
      setTagsError((error as Error).message)
    } finally {
      setTagsLoading(false)
    }
  }

  const loadStashes = async () => {
    if (!dir || !isRepo) return
    setStashesLoading(true)
    try {
      const data = await api<{ ok: boolean; stashes?: StashView[]; error?: string }>(`/repo/stash?cwd=${encodeURIComponent(dir)}`)
      if (data.ok && Array.isArray(data.stashes)) {
        setStashes(data.stashes)
        setStashesError('')
      } else {
        setStashes([])
        setStashesError(data.error || '')
      }
    } catch (error) {
      setStashes([])
      setStashesError((error as Error).message)
    } finally {
      setStashesLoading(false)
    }
  }

  /** 仓库列表：只扫已授权根（`*` 根跳过，不扫全机），失败静默——下拉退回只显示当前仓库。 */
  const loadRepos = async () => {
    try {
      const data = await api<{ ok: boolean; repos?: RepoRow[] }>('/repo/discover')
      if (data.ok && Array.isArray(data.repos)) setRepos(data.repos)
    } catch {
      /* 仓库扫描失败不阻塞工作台 */
    }
  }

  const loadDiff = async (mode: 'worktree' | 'staged', path: string) => {
    if (!dir || !isRepo) return
    setDiffLoading(true)
    setDiffError('')
    try {
      const params = new URLSearchParams({ cwd: dir, mode })
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
    if (!dir) return
    await Promise.all([loadStatus(), loadChanges(), loadCommits(), loadBranches(), loadRemotes()])
  }

  useEffect(() => {
    if (!dir) return
    void refreshAll()
    if (isRepo) void loadGraph()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir, isRepo])

  // 仓库列表只在打开工作台时取一次（扫描本地授权根，不随视图切换重复扫盘）。
  useEffect(() => {
    void loadRepos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (view === 'history' && isRepo && showLane && !graph) void loadGraph()
    if (view === 'tags' && isRepo && tags.length === 0 && !tagsLoading) void loadTags()
    if (view === 'stash' && isRepo && stashes.length === 0 && !stashesLoading) void loadStashes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, isRepo, showLane])

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
  /** 改动汇总：整仓一次算清，避免用户逐个文件心算。 */
  const changeSummary = (() => {
    const files = changes?.files ?? []
    let added = 0
    let deleted = 0
    for (const file of files) {
      added += Number.isFinite(file.added) ? file.added : 0
      deleted += Number.isFinite(file.deleted) ? file.deleted : 0
    }
    return { files: files.length, added, deleted, staged: files.filter((file) => file.staged).length }
  })()
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
    run('stage', () => api<{ ok: boolean; error?: string }>('/repo/stage', { cwd: dir, paths }), t('toastStaged'))

  const unstageSelected = (paths: string[]) =>
    run('unstage', () => api<{ ok: boolean; error?: string }>('/repo/unstage', { cwd: dir, paths }), t('toastUnstaged'))

  const doDiscard = (paths: string[]) =>
    run('discard', () => api<{ ok: boolean; error?: string }>('/repo/discard', { cwd: dir, paths, confirmed: true }), t('toastDiscarded'))

  const doCommit = () =>
    run('commit', () => api<{ ok: boolean; error?: string; hash?: string }>('/repo/commit', { cwd: dir, message, amend }), amend ? t('toastAmended') : t('toastCommitted')).then(
      (ok) => {
        if (ok) {
          setMessage('')
          setAmend(false)
          setSelected(new Set())
        }
      },
    )

  const doFetch = () => run('fetch', () => api<SyncView>('/repo/fetch', { cwd: dir }), t('toastFetched'))

  // 没有上游时裸 git pull 会报 no tracking information；显式带 remote + 当前分支名，
  // 等价于 git pull <remote> <branch>，无论有没有 upstream 都能拉到同名分支。
  const doPull = (strategy: 'merge' | 'rebase') =>
    run(
      'pull',
      () => api<SyncView>('/repo/pull', { cwd: dir, strategy, remote: remotes[0]?.name ?? '', branch: currentBranch }),
      strategy === 'rebase' ? t('toastPulledRebase') : t('toastPulledMerge'),
    ).then((ok) => {
      if (!ok) void loadStatus()
    })

  const doPush = (setUpstream: boolean) =>
    run('push', () => api<SyncView>('/repo/push', { cwd: dir, remote: remotes[0]?.name ?? '', branch: currentBranch, setUpstream }), t('toastPushed')).then((ok) => {
      if (!ok) void loadStatus()
    })

  const doInit = () =>
    run('init', () => api<{ ok: boolean; error?: string; result?: { created?: boolean; branch?: string } }>('/repo/init', { cwd: dir, branch: 'main' }), t('initDone'))

  /** 初始化 + 可选关联远程地址（复用既有 /repo/remotes/add，不臆造接口）。 */
  const doInitWithForm = async () => {
    const ok = await doInit()
    if (!ok) return
    const url = initRemote.trim()
    if (!url) return
    try {
      const added = await api<{ ok: boolean; error?: string }>('/repo/remotes/add', { cwd: dir, name: 'origin', url })
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

  /** 切换仓库：只改本工作台的 dir，不动会话 cwd；切换后整体重取（含图与标签贮藏）。 */
  const switchRepo = (next: string) => {
    setRepoMenu(false)
    if (!next || next === dir) return
    setActiveRoot(next)
    setCommits([])
    setCommitsExhausted(false)
    setTags([])
    setStashes([])
    setGraph(null)
    setChanges(null)
    setSelected(new Set())
    setMessage('')
  }

  /** 提交信息搜索：回车 / 按钮触发，回到第一页重取。 */
  const submitCommitSearch = () => {
    setCommitSearch(commitQuery.trim())
    setCommitsExhausted(false)
    void loadCommits(commitQuery.trim(), 0)
  }

  /** 加载更多：按已取条数当 offset 追加。 */
  const loadMoreCommits = () => {
    if (commitsMore) return
    void loadCommits(commitSearch, commits.length)
  }

  /**
   * AI 生成提交信息：只读仓库内容（服务端不落盘），结果填进输入框由用户确认。
   * 模型服务缺失 / 无默认模型时按服务端错误原文提示，不静默失败。
   */
  const doSuggest = async () => {
    if (suggesting) return
    setSuggesting(true)
    try {
      const data = await api<{ ok: boolean; message?: string; error?: string; source?: string }>('/repo/suggest-message', {
        cwd: dir,
        hint: message.trim(),
        // 空串表示跟随会话默认（服务端据此决定是否回落）。
        model: readPref(PREF_AI_MODEL, ''),
      })
      if (data.ok && data.message) {
        setMessage(data.message)
        showToast('ok', t('toastSuggested'))
      } else {
        showToast('error', data.error || t('suggestFailed'))
      }
    } catch (error) {
      showToast('error', `${t('suggestFailed')}：${(error as Error).message}`)
    } finally {
      setSuggesting(false)
    }
  }

  const doTagCreate = (name: string, message: string) =>
    run('tag', () => api<{ ok: boolean; error?: string }>('/repo/tags/create', { cwd: dir, name, message }), t('toastTagCreated')).then(
      (ok) => ok && loadTags(),
    )

  const doTagDelete = (name: string) =>
    run('tag', () => api<{ ok: boolean; error?: string }>('/repo/tags/delete', { cwd: dir, name }), t('toastTagDeleted')).then(
      (ok) => ok && loadTags(),
    )

  const doTagPush = (name: string) =>
    run('tag', () => api<{ ok: boolean; error?: string }>('/repo/tags/push', { cwd: dir, name, remote: remotes[0]?.name ?? '' }), t('toastTagPushed')).then(
      (ok) => ok && loadTags(),
    )

  const doStashSave = (text: string, includeUntracked: boolean) =>
    run('stash', () => api<{ ok: boolean; error?: string }>('/repo/stash/save', { cwd: dir, message: text, includeUntracked }), t('toastStashed')).then(
      (ok) => ok && loadStashes(),
    )

  const doStashAction = (action: 'pop' | 'apply' | 'drop', index: number) =>
    run(
      'stash',
      () => api<{ ok: boolean; error?: string }>('/repo/stash/action', { cwd: dir, action, index }),
      action === 'drop' ? t('toastStashDropped') : action === 'pop' ? t('toastStashPopped') : t('toastStashApplied'),
    ).then((ok) => ok && loadStashes())

  const currentBranchRow = branches.find((branch) => branch.kind === 'local' && branch.current)
  const hasRemote = remotes.length > 0
  const canCommit = stagedFiles.length > 0 && message.trim().length > 0 && busy === 'none'
  const canPull = isRepo && authorized && busy === 'none'
  const canPush = isRepo && authorized && hasRemote && currentBranch.length > 0 && busy === 'none'
  // 没有上游时，Push 顺带建立跟踪并把分支发布到远端（等价 git push -u <remote> <branch>）。
  const needsPublish = canPush && upstream.length === 0

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

    { key: 'files', label: t('wbFilesTab'), count: 0 },
    { key: 'tags', label: t('wbTagsTab'), count: tags.length },
    { key: 'stash', label: t('wbStashTab'), count: stashes.length },
  ]

  // 仓库下拉候选：已发现的本地仓库，当前仓库补在最前（扫描不到时至少能显示自己）。
  const repoOptions: RepoRow[] = (() => {
    const list = repos.slice()
    if (!list.some((item) => item.root.toLowerCase() === dir.toLowerCase())) {
      list.unshift({ root: dir, name: status?.root?.split(/[\\/]/).pop() || dir, branch: currentBranch, remotes: [] })
    }
    return list
  })()

  return (
    <>
      <div className="dgp-portal dgp-gw-mask" onMouseDown={(event) => event.target === event.currentTarget && closeAll()} />
      <div className="dgp-root dgp-gw" role="dialog" aria-label={t('wbTitle')} data-state="ready">
        {/* 顶栏：仓库（可切） · 分支 · 同步动作 · 关闭 */}
        <div className="dgp-gw-top">
          <button
            type="button"
            className="dgp-gw-repo"
            title={status.root || dir}
            aria-haspopup="menu"
            aria-expanded={repoMenu}
            onClick={() => setRepoMenu((prev) => !prev)}
          >
            <BranchIcon />
            {status.root?.split(/[\\/]/).pop() || dir}
            {repoOptions.length > 1 ? <span className="dgp-gw-caret">▾</span> : null}
          </button>
          {repoMenu ? (
            createPortal(
              <div className="dgp-portal dgp-repomenu" role="menu" aria-label={t('wbSwitchRepo')}>
                <div className="dgp-repomenu-head">{t('wbSwitchRepo')}</div>
                {repoOptions.map((item) => (
                  <button
                    key={item.root}
                    type="button"
                    role="menuitem"
                    className="dgp-repomenu-row"
                    data-on={item.root.toLowerCase() === dir.toLowerCase() ? '1' : '0'}
                    title={item.root}
                    onClick={() => switchRepo(item.root)}
                  >
                    <span className="dgp-repomenu-name">{item.name}</span>
                    <span className="dgp-repomenu-meta">{item.branch || 'HEAD'}</span>
                  </button>
                ))}
                <div className="dgp-repomenu-foot">{t('wbSwitchRepoHint')}</div>
              </div>,
              document.body,
            )
          ) : null}
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
            <button
              type="button"
              className="dgp-btn primary"
              data-publish={needsPublish ? '1' : '0'}
              disabled={!canPush}
              title={needsPublish ? t('wbPublishHint') : undefined}
              onClick={() => void doPush(needsPublish)}
            >
              {needsPublish ? t('wbPublish') : t('wbPush')}
            </button>
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
                <div className="dgp-gw-summary" role="group" aria-label={t('wbSummary')}>
                  <span className="dgp-gw-summary-item">
                    <span className="dgp-gw-summary-label">{t('wbSummaryFiles')}</span>
                    <b>{changeSummary.files}</b>
                  </span>
                  <span className="dgp-gw-summary-item" data-sign="add">
                    <span className="dgp-gw-summary-label">{t('wbSummaryAdded')}</span>
                    <b>+{changeSummary.added}</b>
                  </span>
                  <span className="dgp-gw-summary-item" data-sign="del">
                    <span className="dgp-gw-summary-label">{t('wbSummaryDeleted')}</span>
                    <b>-{changeSummary.deleted}</b>
                  </span>
                  <span className="dgp-gw-summary-item">
                    <span className="dgp-gw-summary-label">{t('wbSummaryStaged')}</span>
                    <b>{changeSummary.staged}</b>
                  </span>
                </div>

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
                    <button
                      type="button"
                      className="dgp-gw-textbtn"
                      disabled={suggesting || busy !== 'none'}
                      onClick={() => void doSuggest()}
                      title={t('wbSuggestHint')}
                    >
                      {suggesting ? t('wbSuggesting') : t('wbSuggest')}
                    </button>
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

            {/* 历史视图：关键词搜索（服务端 --grep）+ 加载更多 */}
            {view === 'history' ? (
              <>
                <div className="dgp-gw-searchbar">
                  <input
                    className="dgp-input dgp-gw-search"
                    placeholder={t('wbSearchCommit')}
                    value={commitQuery}
                    onChange={(event) => setCommitQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submitCommitSearch()
                      if (event.key === 'Escape') setCommitQuery('')
                    }}
                  />
                  <button type="button" className="dgp-btn" onClick={submitCommitSearch}>{t('wbSearch')}</button>
                  {commitSearch ? (
                    <button
                      type="button"
                      className="dgp-gw-textbtn"
                      onClick={() => {
                        setCommitQuery('')
                        setCommitSearch('')
                        void loadCommits('', 0)
                      }}
                    >
                      {t('wbSearchClear')}
                    </button>
                  ) : null}
                  {/* 列表 / 泳道两档：泳道把分支拓扑贴在每行左侧，省掉一个独立视图。 */}
                  <span className="dgp-seg" role="group" aria-label={t('wbHistoryStyle')}>
                    <button type="button" data-on={showLane ? '1' : '0'} onClick={() => toggleLane(false)}>{t('wbHistoryList')}</button>
                    <button type="button" data-on={showLane ? '0' : '1'} onClick={() => toggleLane(true)}>{t('wbHistoryLane')}</button>
                  </span>
                </div>
                <div className="dgp-gw-scroll">
                  {commitsLoading && commits.length === 0 ? (
                    <Skeleton rows={8} />
                  ) : commitsError ? (
                    <div className="dgp-err">{commitsError}</div>
                  ) : commits.length === 0 ? (
                    <EmptyState title={commitSearch ? t('wbSearchEmpty') : t('wbNoCommits')} hint={commitSearch ? t('wbSearchEmptyHint') : t('wbNoCommitsHint')} />
                  ) : (
                    <>
                      <div className="dgp-gw-logview">
                        {showLane ? (
                          <div className="dgp-gw-lanecell" title={graphError || t('wbHistoryLaneHint')}>
                            <LaneColumn rows={laneRows} laneCount={laneCount} count={commits.length} />
                          </div>
                        ) : null}
                        <div className="dgp-gw-log" role="list">
                          {commits.map((commit) => (
                            <button key={commit.hash} type="button" className="dgp-gw-logrow" data-lane={showLane ? '1' : '0'} role="listitem" onClick={() => openDetail(commit.hash)}>
                              <span className="dgp-gw-loghash">{commit.shortHash}</span>
                              <span className="dgp-gw-logmsg" title={commit.subject}>{commit.subject}</span>
                              {parseRefs(commit.refs).map((ref) => (
                                <span key={ref.text} className="dgp-graph-ref" data-kind={ref.kind === 'head' ? 'head' : ref.kind}>{ref.text}</span>
                              ))}
                              <span className="dgp-gw-logmeta">{commit.author} · {shortDate(commit.date)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      {commitsExhausted ? (
                        <div className="dgp-hint">{t('wbNoMoreCommits')}</div>
                      ) : (
                        <div className="dgp-gw-more">
                          <button type="button" className="dgp-btn" disabled={commitsMore} onClick={loadMoreCommits}>
                            {commitsMore ? t('wbLoadingMore') : t('wbLoadMore')}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : null}

            {/* 文件视图：懒加载目录树 + 预览（只读，走 /repo/tree 与 /repo/file） */}
            {view === 'files' ? <FileBrowser t={t} cwd={dir} /> : null}

            {/* 标签视图：列表 + 新建 + 推送 + 删除（删除需点两次） */}
            {view === 'tags' ? (
              <TagsPanel
                t={t}
                tags={tags}
                loading={tagsLoading}
                error={tagsError}
                busy={busy !== 'none'}
                hasRemote={hasRemote}
                onCreate={doTagCreate}
                onDelete={doTagDelete}
                onPush={doTagPush}
                onRefresh={loadTags}
              />
            ) : null}

            {/* 贮藏视图：列表 + 保存 + pop/apply/drop */}
            {view === 'stash' ? (
              <StashPanel
                t={t}
                stashes={stashes}
                loading={stashesLoading}
                error={stashesError}
                busy={busy !== 'none'}
                onSave={doStashSave}
                onAction={doStashAction}
                onRefresh={loadStashes}
              />
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
          <Modal title={`${t('wbDiffTitle')} · ${diffPath || (diffMode === 'staged' ? t('changesStaged') : t('wbUnstaged'))}`} onClose={() => setLayer('none')} width={1040}>
            {diffLoading ? <Skeleton rows={8} /> : diffError ? <div className="dgp-err">{diffError}</div> : diffText ? (
              <DiffView t={t} text={diffText} truncated={diffTruncated} lang={langOfPath(diffPath)} />
            ) : (
              <EmptyState title={t('diffEmpty')} hint={t('diffEmptyHint')} />
            )}
            {diffTruncated ? <div className="dgp-hint">{t('diffTruncated')}</div> : null}
          </Modal>
        ) : null}

        {layer === 'branches' ? (
          <BranchesModal
            t={t}
            cwd={dir}
            branches={branches}
            current={currentBranch}
            onClose={() => setLayer('none')}
            onChanged={refreshAll}
            run={run}
            onNewBranch={() => setLayer('newBranch')}
          />
        ) : null}
        {layer === 'newBranch' ? <NewBranchModal t={t} cwd={dir} onClose={() => setLayer('none')} onChanged={refreshAll} run={run} /> : null}
        {layer === 'commit' ? <CommitDetailModal t={t} cwd={dir} rev={detailRev} onClose={() => setLayer('none')} onChanged={refreshAll} /> : null}
        {layer === 'remote' ? <RemoteModal t={t} cwd={dir} remotes={remotes} onClose={() => setLayer('none')} onChanged={refreshAll} run={run} /> : null}
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

/** 标签面板：列表（含附注标记）+ 新建（可选附注信息）+ 推送 + 删除（点两次确认）。 */
function TagsPanel({
  t, tags, loading, error, busy, hasRemote, onCreate, onDelete, onPush, onRefresh,
}: {
  t: (key: string) => string
  tags: TagView[]
  loading: boolean
  error: string
  busy: boolean
  hasRemote: boolean
  onCreate: (name: string, message: string) => Promise<unknown>
  onDelete: (name: string) => Promise<unknown>
  onPush: (name: string) => Promise<unknown>
  onRefresh: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [tagNote, setTagNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState('')
  const create = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    void onCreate(trimmed, tagNote.trim()).then(() => {
      setName('')
      setTagNote('')
    })
  }
  return (
    <>
      <div className="dgp-gw-searchbar">
        <input className="dgp-input dgp-gw-search" placeholder={t('wbTagName')} value={name} onChange={(event) => setName(event.target.value)} />
        <input className="dgp-input dgp-gw-search" placeholder={t('wbTagNote')} value={tagNote} onChange={(event) => setTagNote(event.target.value)} />
        <button type="button" className="dgp-btn primary" disabled={busy || name.trim().length === 0} onClick={create}>
          {t('wbTagCreate')}
        </button>
        <button type="button" className="dgp-gw-textbtn" disabled={busy} onClick={() => void onRefresh()}>{t('refresh')}</button>
      </div>
      <div className="dgp-gw-scroll">
        {loading && tags.length === 0 ? (
          <Skeleton rows={6} />
        ) : error ? (
          <div className="dgp-err">{error}</div>
        ) : tags.length === 0 ? (
          <EmptyState title={t('wbNoTags')} hint={t('wbNoTagsHint')} />
        ) : (
          <div className="dgp-gw-log" role="list">
            {tags.map((tag) => (
              <div key={tag.name} className="dgp-gw-logrow" role="listitem" data-tag={tag.annotated ? '1' : '0'}>
                <span className="dgp-gw-loghash">{tag.hash}</span>
                <span className="dgp-gw-logmsg" title={tag.subject}>{tag.name}</span>
                {tag.annotated ? <span className="dgp-graph-ref" data-kind="tag">{t('wbTagAnnotated')}</span> : null}
                <span className="dgp-gw-logmeta">{shortDate(tag.date)}</span>
                <button type="button" className="dgp-gw-textbtn" disabled={busy || !hasRemote} onClick={() => void onPush(tag.name)}>{t('wbTagPush')}</button>
                {confirmDelete === tag.name ? (
                  <button
                    type="button"
                    className="dgp-gw-textbtn"
                    data-danger="1"
                    disabled={busy}
                    onClick={() => {
                      setConfirmDelete('')
                      void onDelete(tag.name)
                    }}
                  >
                    {t('wbConfirmDelete')}
                  </button>
                ) : (
                  <button type="button" className="dgp-gw-textbtn" data-danger="1" onClick={() => setConfirmDelete(tag.name)}>{t('wbDelete')}</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

/** 贮藏面板：列表（含分支与说明）+ 保存（可选说明、可选包含未跟踪）+ pop/apply/drop。 */
function StashPanel({
  t, stashes, loading, error, busy, onSave, onAction, onRefresh,
}: {
  t: (key: string) => string
  stashes: StashView[]
  loading: boolean
  error: string
  busy: boolean
  onSave: (message: string, includeUntracked: boolean) => Promise<unknown>
  onAction: (action: 'pop' | 'apply' | 'drop', index: number) => Promise<unknown>
  onRefresh: () => Promise<void>
}) {
  const [stashNote, setStashNote] = useState('')
  const [withUntracked, setWithUntracked] = useState(true)
  return (
    <>
      <div className="dgp-gw-searchbar">
        <input
          className="dgp-input dgp-gw-search"
          placeholder={t('wbStashNote')}
          value={stashNote}
          onChange={(event) => setStashNote(event.target.value)}
        />
        <label className="dgp-gw-amend">
          <input type="checkbox" checked={withUntracked} onChange={(event) => setWithUntracked(event.target.checked)} />
          {t('wbStashUntracked')}
        </label>
        <button
          type="button"
          className="dgp-btn primary"
          disabled={busy}
          onClick={() => void onSave(stashNote.trim(), withUntracked).then(() => setStashNote(''))}
        >
          {t('wbStashSave')}
        </button>
        <button type="button" className="dgp-gw-textbtn" disabled={busy} onClick={() => void onRefresh()}>{t('refresh')}</button>
      </div>
      <div className="dgp-gw-scroll">
        {loading && stashes.length === 0 ? (
          <Skeleton rows={5} />
        ) : error ? (
          <div className="dgp-err">{error}</div>
        ) : stashes.length === 0 ? (
          <EmptyState title={t('wbNoStashes')} hint={t('wbNoStashesHint')} />
        ) : (
          <div className="dgp-gw-log" role="list">
            {stashes.map((item) => (
              <div key={item.ref} className="dgp-gw-logrow" role="listitem">
                <span className="dgp-gw-loghash">{item.ref}</span>
                <span className="dgp-gw-logmsg" title={item.subject}>{item.subject || t('wbStashNoSubject')}</span>
                {item.branch ? <span className="dgp-graph-ref" data-kind="head">{item.branch}</span> : null}
                <button type="button" className="dgp-gw-textbtn" disabled={busy} onClick={() => void onAction('pop', item.index)}>{t('wbStashPop')}</button>
                <button type="button" className="dgp-gw-textbtn" disabled={busy} onClick={() => void onAction('apply', item.index)}>{t('wbStashApply')}</button>
                <button type="button" className="dgp-gw-textbtn" data-danger="1" disabled={busy} onClick={() => void onAction('drop', item.index)}>{t('wbStashDrop')}</button>
              </div>
            ))}
          </div>
        )}
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
function CommitDetailModal({
  t, cwd, rev, onClose, onChanged,
}: {
  t: (key: string) => string
  cwd: string
  rev: string
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [detail, setDetail] = useState<{ commit: CommitRow & { message?: string }; files: Array<{ path: string; added: number; deleted: number }>; diff: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  /** 回退/撤销的在途锁与二次确认态：hard 会丢改动，必须先点一次确认。 */
  const [acting, setActing] = useState('')
  const [confirmHard, setConfirmHard] = useState(false)
  const [actNote, setActNote] = useState('')
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

  /** 回退/撤销共用：成功后关闭弹窗并让工作台整体刷新（分支、历史、改动都变了）。 */
  const submit = async (kind: 'reset-soft' | 'reset-mixed' | 'reset-hard' | 'revert') => {
    if (acting !== '') return
    setActing(kind)
    setActNote('')
    try {
      const body = kind === 'revert'
        ? { cwd, rev }
        : { cwd, rev, mode: kind === 'reset-soft' ? 'soft' : kind === 'reset-hard' ? 'hard' : 'mixed' }
      const result = await api<{ ok: boolean; error?: string }>(kind === 'revert' ? '/repo/revert' : '/repo/reset', body)
      if (!result.ok) {
        setActNote(result.error || t('wbActFailed'))
        return
      }
      onClose()
      await onChanged()
    } catch (failure) {
      setActNote(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setActing('')
    }
  }

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
          <DiffView t={t} text={detail.diff} lang={langOfPath(detail.files[0]?.path ?? '')} />
          {actNote !== '' ? <div className="dgp-err">{actNote}</div> : null}
          <div className="dgp-modal-foot" style={{ borderTop: 'none', padding: '12px 0 0', flexWrap: 'wrap', gap: 6 }}>
            <button type="button" className="dgp-btn" disabled={acting !== ''} onClick={() => void submit('reset-soft')}>{t('wbResetSoft')}</button>
            <button type="button" className="dgp-btn" disabled={acting !== ''} onClick={() => void submit('reset-mixed')}>{t('wbResetMixed')}</button>
            <button
              type="button"
              className="dgp-btn"
              data-danger={confirmHard ? '1' : '0'}
              disabled={acting !== ''}
              onClick={() => { if (!confirmHard) { setConfirmHard(true); return } void submit('reset-hard') }}
            >
              {confirmHard ? t('wbResetHardConfirm') : t('wbResetHard')}
            </button>
            <button type="button" className="dgp-btn primary" disabled={acting !== ''} onClick={() => void submit('revert')}>{t('wbRevert')}</button>
          </div>
          <div className="dgp-hint">{t('wbActHint')}</div>
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
