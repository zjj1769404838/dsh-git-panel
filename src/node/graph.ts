import { ensureRepo, runGit } from './git.js'

/**
 * 提交 DAG 的读取与车道布局。
 *
 * 布局算法的目标：把提交按「新→旧自上而下」排成行，为每条活跃分支分配固定车道，
 * 行内只画三种图元 —— 节点、同车道竖线、跨车道 S 形转折线。
 * 一条分支跨 N 行是靠 N 个竖线段拼出来的，不存在跨行长连线，
 * 因此连线永远不会穿过中间的节点（这是避免重叠/错位最可靠的手段）。
 */

/** 单条提交记录（与 git log 输出一一对应）。 */
export interface GraphCommit {
  hash: string
  short: string
  parents: string[]
  author: string
  date: string
  subject: string
  refs: GraphRef[]
}

export interface GraphRef {
  name: string
  /** head=当前 HEAD 指向；local=本地分支；remote=远端分支；tag=标签。 */
  kind: 'head' | 'local' | 'remote' | 'tag'
}

/** 布局后的一行：带车道与连线信息，供前端直接渲染。 */
export interface GraphRow extends GraphCommit {
  row: number
  /** 节点所在车道（0 起）。 */
  lane: number
  /** 本行需要画的跨车道转折线：从 from 车道连到 to 车道。 */
  segments: Array<{ from: number; to: number }>
  /** 本行需要画的同车道竖线（等待下方提交的车道）。 */
  through: number[]
}

export interface RepoGraph {
  isRepo: boolean
  root: string
  branch: string
  head: string
  detached: boolean
  /** repo=是仓库；no-repo=目录存在但没有 .git；invalid=路径非法/不存在/不可读。 */
  reason: 'repo' | 'no-repo' | 'invalid'
  error: string
  /** 提交数超过 limit，只返回了前 limit 条。 */
  truncated: boolean
  laneCount: number
  rows: GraphRow[]
}

const FIELD_SEP = '\u001f'
const EMPTY: RepoGraph = {
  isRepo: false,
  root: '',
  branch: '',
  head: '',
  detached: false,
  reason: 'invalid',
  error: '',
  truncated: false,
  laneCount: 0,
  rows: [],
}

export const GRAPH_MIN = 5
export const GRAPH_MAX = 100
export const GRAPH_DEFAULT = 30

/** 解析 `%D` 的 ref 列表，例如 `HEAD -> main, origin/main, tag: v1.0.0`。 */
export function parseRefs(raw: string): GraphRef[] {
  const refs: GraphRef[] = []
  for (const piece of raw.split(',')) {
    const text = piece.trim()
    if (text.length === 0) continue
    if (text.startsWith('HEAD -> ')) {
      refs.push({ name: text.slice('HEAD -> '.length).trim(), kind: 'head' })
      continue
    }
    if (text === 'HEAD') {
      refs.push({ name: 'HEAD', kind: 'head' })
      continue
    }
    if (text.startsWith('tag: ')) {
      refs.push({ name: text.slice('tag: '.length).trim(), kind: 'tag' })
      continue
    }
    if (/^(origin|upstream|fork)\//.test(text) || text.includes('/')) {
      refs.push({ name: text, kind: 'remote' })
      continue
    }
    refs.push({ name: text, kind: 'local' })
  }
  return refs
}

/** 解析 `git log --pretty=format:...` 的输出（字段用 \x1f 分隔，记录用换行分隔）。 */
export function parseLog(stdout: string): GraphCommit[] {
  const commits: GraphCommit[] = []
  for (const line of stdout.split('\n')) {
    if (line.trim().length === 0) continue
    const parts = line.split(FIELD_SEP)
    if (parts.length < 7) continue
    const [hash, short, parents, author, date, decoration, ...rest] = parts
    commits.push({
      hash: (hash ?? '').trim(),
      short: (short ?? '').trim(),
      parents: (parents ?? '').trim().length > 0 ? (parents as string).trim().split(/\s+/) : [],
      author: (author ?? '').trim(),
      date: (date ?? '').trim(),
      // 标题里若混入 \x1f 会被切碎，这里拼回去，保证不丢内容。
      subject: rest.join(FIELD_SEP).trim(),
      refs: parseRefs((decoration ?? '').trim()),
    })
  }
  return commits
}

/**
 * 车道布局（纯函数，便于回归测试）。
 *
 * 规则：
 * 1. 提交若已在某车道「等待」则复用该车道，否则取最小空闲车道；
 * 2. 第一个父提交继承本行车道（主干直落，from === to 的竖直段）；
 * 3. 其余父提交若已在等待就复用其车道（画转折线汇入），否则取最小空闲车道；
 * 4. 车道被回收后立即复用，图宽不会随历史增长而无限变宽。
 */
export function layoutGraph(commits: GraphCommit[]): { rows: GraphRow[]; laneCount: number } {
  /** 车道 -> 正在等待的提交 hash（null 表示空闲）。 */
  const lanes: Array<string | null> = []
  const rows: GraphRow[] = []

  const firstFree = (): number => {
    const index = lanes.indexOf(null)
    if (index !== -1) return index
    lanes.push(null)
    return lanes.length - 1
  }

  commits.forEach((commit, row) => {
    let lane = lanes.indexOf(commit.hash)
    if (lane === -1) {
      lane = firstFree()
      lanes[lane] = commit.hash
    }

    const before = lanes.slice()
    const segments: Array<{ from: number; to: number }> = []

    // 本行消费掉这个提交，先释放车道，再按父提交重新占位。
    lanes[lane] = null

    commit.parents.forEach((parent, index) => {
      const existing = lanes.indexOf(parent)
      if (existing !== -1) {
        // 父提交已在别的车道等待：画一条转折线汇入，本车道不再占用。
        if (existing !== lane) segments.push({ from: lane, to: existing })
        return
      }
      const target = index === 0 ? lane : firstFree()
      lanes[target] = parent
      // from === to 表示「同车道直落」（主干相邻两行之间），也要记下来，
      // 否则主干上相邻节点之间没有连线，只剩孤立的点。
      segments.push({ from: lane, to: target })
    })

    // 同车道竖线：本行前后都非空的车道（本行车道自身除外）。
    const through: number[] = []
    const width = Math.max(before.length, lanes.length)
    for (let i = 0; i < width; i += 1) {
      if (i === lane) continue
      if (before[i] && lanes[i]) through.push(i)
    }

    rows.push({ ...commit, row, lane, segments, through })
  })

  // 收尾：去掉尾部连续空闲的车道，得到真实图宽。
  let laneCount = 0
  for (let i = 0; i < lanes.length; i += 1) if (lanes[i]) laneCount = i + 1
  for (const row of rows) {
    laneCount = Math.max(laneCount, row.lane + 1)
    for (const seg of row.segments) laneCount = Math.max(laneCount, seg.from + 1, seg.to + 1)
    for (const lane of row.through) laneCount = Math.max(laneCount, lane + 1)
  }

  return { rows, laneCount }
}

function clampLimit(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return GRAPH_DEFAULT
  return Math.min(GRAPH_MAX, Math.max(GRAPH_MIN, parsed))
}

/** 读取提交图。非仓库/空仓库都不是错误：分别用 reason 与空 rows 表达。 */
export async function readRepoGraph(cwd: string, limitInput?: unknown): Promise<RepoGraph> {
  const limit = clampLimit(limitInput)
  const repo = ensureRepo(cwd)
  if (!repo.ok) {
    const message = repo.error ?? '不是 Git 仓库'
    const notInitialized = /未找到 \.git/.test(message)
    return { ...EMPTY, error: message, reason: notInitialized ? 'no-repo' : 'invalid' }
  }
  const root = repo.root as string

  const branchRes = await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const headRes = await runGit(root, ['rev-parse', '--short', 'HEAD'])
  const head = headRes.ok ? headRes.stdout.trim() : ''
  const rawBranch = branchRes.ok ? branchRes.stdout.trim() : ''
  const detached = rawBranch === 'HEAD'

  const log = await runGit(root, [
    'log',
    // 只看当前分支历史：Git 工作台聚焦当前项目演进线（2026-10-29 用户要求）。
    '--date-order',
    `-n${limit + 1}`,
    '--date=short',
    `--pretty=format:%H${FIELD_SEP}%h${FIELD_SEP}%P${FIELD_SEP}%an${FIELD_SEP}%ad${FIELD_SEP}%D${FIELD_SEP}%s`,
  ])

  if (!log.ok) {
    // 空仓库（还没有任何提交）不是错误：返回空图，由前端显示「暂无提交」。
    const empty = /does not have any commits|unknown revision/i.test(`${log.stderr} ${log.error}`)
    return {
      ...EMPTY,
      isRepo: true,
      root,
      branch: detached ? '' : rawBranch,
      head,
      detached,
      reason: 'repo',
      error: empty ? '' : log.error,
    }
  }

  const parsed = parseLog(log.stdout)
  const truncated = parsed.length > limit
  const visible = truncated ? parsed.slice(0, limit) : parsed
  const { rows, laneCount } = layoutGraph(visible)

  return {
    isRepo: true,
    root,
    branch: detached ? '' : rawBranch,
    head,
    detached,
    reason: 'repo',
    error: '',
    truncated,
    laneCount,
    rows,
  }
}
