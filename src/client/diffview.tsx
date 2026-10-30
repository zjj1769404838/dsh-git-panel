/**
 * 差异视图（dgp-v19）。
 *
 * 相比 dgp-v18 的 `<pre>{diffText}</pre>`，这里补齐了评审时真正会用到的六件事：
 *   1. 行号（旧/新两侧独立编号，新增行左侧留空、删除行右侧留空）；
 *   2. 就地查找（Ctrl/⌘+F 聚焦，Enter/Shift+Enter 在命中之间跳转，Esc 退出查找）；
 *   3. 并排 / 统一两种呈现，选择写进 localStorage（下次打开沿用）；
 *   4. 词级高亮：把成对的 -/+ 行按 token 求公共前后缀，只标出真正变化的中段；
 *   5. 未变更块折叠：上下文超过 6 行就折起来，点一下展开，避免大 diff 淹没重点；
 *   6. 语法高亮：可选开关，同样记忆；无 grammar 的语言自动回退纯文本。
 *
 * 解析与配对是纯函数（parseDiff / buildSplit / diffSegments / foldRows），组件只负责
 * 呈现与交互，这样门禁与单测都能直接对函数断言，不必起 DOM。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useStyles, PREF_DIFF_LAYOUT, PREF_HIGHLIGHT, readPref, writePref, type DiffLayout,
} from './shared.js'
import { hasGrammar, highlight } from './highlight.js'

/** 统一 diff 的一行。 */
export interface DiffRow {
  kind: 'meta' | 'hunk' | 'ctx' | 'add' | 'del'
  /** 去掉行首标记后的正文。 */
  text: string
  /** 旧文件行号（add 行为 null）。 */
  oldNo: number | null
  /** 新文件行号（del 行为 null）。 */
  newNo: number | null
}

/** 并排视图的一行：左右各一格（可为空）。 */
export interface SplitPair {
  left: DiffRow | null
  right: DiffRow | null
}

/** 折叠阈值：连续上下文超过这么多行才折，短块折了反而更难读。 */
const FOLD_MIN = 6
/** 折叠后仍保留在两侧的上下文行数（让人看清 diff 落在哪个函数里）。 */
const FOLD_KEEP = 3

/** 解析 `git diff` 的统一输出。无法识别的行按 meta 处理，不丢内容。 */
export function parseDiff(text: string): DiffRow[] {
  const rows: DiffRow[] = []
  let oldNo = 0
  let newNo = 0
  for (const raw of text.split('\n')) {
    if (raw.startsWith('@@')) {
      // @@ -a,b +c,d @@ 语境行：解析出两侧起始行号，供后续逐行递增。
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(raw)
      if (match) {
        oldNo = Number(match[1])
        newNo = Number(match[2])
      }
      rows.push({ kind: 'hunk', text: raw, oldNo: null, newNo: null })
      continue
    }
    if (raw.startsWith('diff --git') || raw.startsWith('index ') || raw.startsWith('--- ') || raw.startsWith('+++ ')
      || raw.startsWith('new file') || raw.startsWith('deleted file') || raw.startsWith('similarity index')
      || raw.startsWith('rename ') || raw.startsWith('old mode') || raw.startsWith('new mode')
      || raw.startsWith('Binary files') || raw.startsWith('\\ No newline')) {
      rows.push({ kind: 'meta', text: raw, oldNo: null, newNo: null })
      continue
    }
    if (raw.startsWith('+')) {
      rows.push({ kind: 'add', text: raw.slice(1), oldNo: null, newNo })
      newNo += 1
      continue
    }
    if (raw.startsWith('-')) {
      rows.push({ kind: 'del', text: raw.slice(1), oldNo, newNo: null })
      oldNo += 1
      continue
    }
    if (raw.startsWith(' ') || raw.length === 0) {
      rows.push({ kind: 'ctx', text: raw.slice(1), oldNo, newNo })
      oldNo += 1
      newNo += 1
      continue
    }
    rows.push({ kind: 'meta', text: raw, oldNo: null, newNo: null })
  }
  // 去掉尾部由 split 造成的空 ctx 行。
  while (rows.length > 0 && rows[rows.length - 1].kind === 'ctx' && rows[rows.length - 1].text === '') rows.pop()
  return rows
}

/**
 * 统一行 → 并排配对。
 * 规则：同一 hunk 内连续的 del 块与紧随的 add 块按序配对，多出来的一侧留空；
 * ctx 行两侧共用；meta/hunk 行跨两列（渲染时整行铺满）。
 */
export function buildSplit(rows: DiffRow[]): SplitPair[] {
  const pairs: SplitPair[] = []
  let index = 0
  while (index < rows.length) {
    const row = rows[index]
    if (row.kind === 'del' || row.kind === 'add') {
      const dels: DiffRow[] = []
      const adds: DiffRow[] = []
      while (index < rows.length && rows[index].kind === 'del') { dels.push(rows[index]); index += 1 }
      while (index < rows.length && rows[index].kind === 'add') { adds.push(rows[index]); index += 1 }
      const span = Math.max(dels.length, adds.length)
      for (let offset = 0; offset < span; offset += 1) {
        pairs.push({ left: dels[offset] ?? null, right: adds[offset] ?? null })
      }
      continue
    }
    pairs.push({ left: row, right: row })
    index += 1
  }
  return pairs
}

/** token 化：标识符 / 空白 / 单个符号。词级比较按 token 而不是字符，避免半词乱标。 */
function tokenize(value: string): string[] {
  return value.match(/[A-Za-z0-9_$]+|\s+|[^A-Za-z0-9_$\s]/gu) ?? []
}

/** 词级变化区间：以字符计的「公共前缀长度」与「变化中段长度」。 */
export interface WordSpan {
  aPre: number
  aMid: number
  bPre: number
  bMid: number
}

const NO_SPAN: WordSpan = { aPre: 0, aMid: 0, bPre: 0, bMid: 0 }

/** 成对行的公共前后缀（按 token 计），返回以字符计的中段区间。 */
export function diffSegments(a: string, b: string): WordSpan {
  const at = tokenize(a)
  const bt = tokenize(b)
  let pre = 0
  while (pre < at.length && pre < bt.length && at[pre] === bt[pre]) pre += 1
  let suf = 0
  while (suf < at.length - pre && suf < bt.length - pre && at[at.length - 1 - suf] === bt[bt.length - 1 - suf]) suf += 1
  return {
    aPre: at.slice(0, pre).join('').length,
    aMid: at.slice(pre, at.length - suf).join('').length,
    bPre: bt.slice(0, pre).join('').length,
    bMid: bt.slice(pre, bt.length - suf).join('').length,
  }
}

/** 一行里的片段：命中查找 / 词级变化各自带标记，互不覆盖。 */
interface Segment {
  text: string
  /** 0 = 无命中，1 = 命中但非当前项，2 = 当前命中项。 */
  hit: 0 | 1 | 2
  word: '' | 'add' | 'del'
}

/** 把一行的正文切成片段（先按词级中段切，再按查找命中切）。 */
function segmentize(text: string, span: WordSpan, role: 'left' | 'right', query: string): Segment[] {
  const wordStart = role === 'left' ? span.aPre : span.bPre
  const wordLen = role === 'left' ? span.aMid : span.bMid
  const word: '' | 'add' | 'del' = role === 'left' ? 'del' : 'add'
  const wordRange = wordLen > 0 ? [{ start: wordStart, end: wordStart + wordLen }] : []
  const lower = text.toLowerCase()
  const needle = query.toLowerCase()
  const hits: Array<{ start: number; end: number }> = []
  if (needle.length > 0) {
    let from = 0
    while (from <= lower.length) {
      const at = lower.indexOf(needle, from)
      if (at < 0) break
      hits.push({ start: at, end: at + needle.length })
      from = at + Math.max(1, needle.length)
    }
  }
  // 收集所有切点，逐段判定归属。
  const cuts = new Set<number>([0, text.length])
  for (const item of [...wordRange, ...hits]) {
    cuts.add(Math.max(0, Math.min(text.length, item.start)))
    cuts.add(Math.max(0, Math.min(text.length, item.end)))
  }
  const points = [...cuts].sort((x, y) => x - y)
  const segments: Segment[] = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i]
    const end = points[i + 1]
    if (end <= start) continue
    const inWord = wordRange.some((item) => start >= item.start && end <= item.end)
    const hitIndex = hits.findIndex((item) => start >= item.start && end <= item.end)
    segments.push({
      text: text.slice(start, end),
      hit: hitIndex < 0 ? 0 : hitIndex === 0 ? 2 : 1,
      word: inWord ? word : '',
    })
  }
  return segments.length > 0 ? segments : [{ text, hit: 0, word: '' }]
}

/** 折叠块：连续上下文超过 FOLD_MIN 时，把中段收成一个可点击的占位行。 */
type DisplayRow =
  | { type: 'pair'; pair: SplitPair; index: number }
  | { type: 'fold'; hidden: number; key: string }

/** 生成带折叠的显示行序列。 */
export function foldRows(pairs: SplitPair[], expanded: Set<string>): DisplayRow[] {
  const out: DisplayRow[] = []
  let index = 0
  while (index < pairs.length) {
    const pair = pairs[index]
    const isCtx = pair.left?.kind === 'ctx' && pair.right?.kind === 'ctx'
    if (!isCtx) {
      out.push({ type: 'pair', pair, index })
      index += 1
      continue
    }
    let end = index
    while (end < pairs.length && pairs[end].left?.kind === 'ctx' && pairs[end].right?.kind === 'ctx') end += 1
    const run = end - index
    const key = `fold-${index}`
    if (run > FOLD_MIN && !expanded.has(key)) {
      for (let cursor = index; cursor < index + FOLD_KEEP; cursor += 1) out.push({ type: 'pair', pair: pairs[cursor], index: cursor })
      out.push({ type: 'fold', hidden: run - FOLD_KEEP * 2, key })
      for (let cursor = end - FOLD_KEEP; cursor < end; cursor += 1) out.push({ type: 'pair', pair: pairs[cursor], index: cursor })
    } else {
      for (let cursor = index; cursor < end; cursor += 1) out.push({ type: 'pair', pair: pairs[cursor], index: cursor })
    }
    index = end
  }
  return out
}

/** 显示行的 kind，驱动 CSS 上色。 */
function pairKind(pair: SplitPair): 'ctx' | 'hunk' | 'meta' | 'chg' | 'add' | 'del' {
  if (pair.left?.kind === 'hunk' || pair.right?.kind === 'hunk') return 'hunk'
  if (pair.left?.kind === 'meta' || pair.right?.kind === 'meta') return 'meta'
  if (pair.left?.kind === 'ctx' && pair.right?.kind === 'ctx') return 'ctx'
  if (pair.left?.kind === 'del' && pair.right?.kind === 'add') return 'chg'
  return pair.right?.kind === 'add' ? 'add' : 'del'
}

/**
 * 差异面板（不含 Modal 外壳，由调用方决定放弹窗还是页内）。
 * `lang` 由 node 侧 `langOf()` 给出；给了且 Prism 有 grammar 才启用语法高亮。
 */
export function DiffView({
  t, text, truncated, lang = '',
}: {
  t: (key: string) => string
  text: string
  truncated?: boolean
  lang?: string
}) {
  useStyles()
  const [layout, setLayout] = useState<DiffLayout>(() => {
    const saved = readPref(PREF_DIFF_LAYOUT, 'split')
    return saved === 'unified' || saved === 'before' || saved === 'after' ? saved : 'split'
  })
  const [highlightOn, setHighlightOn] = useState<boolean>(() => readPref(PREF_HIGHLIGHT, '1') !== '0')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const findRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const rows = useMemo(() => parseDiff(text), [text])
  const pairs = useMemo(() => buildSplit(rows), [rows])
  const display = useMemo(() => foldRows(pairs, expanded), [pairs, expanded])

  // 词级区间按「显示行」预先算好：并排视图左 del 配右 add，统一视图 add 行配上一个 del 行。
  const spans = useMemo(() => {
    const out: WordSpan[] = []
    let pendingDel: string | null = null
    for (const item of display) {
      if (item.type === 'fold') { out.push(NO_SPAN); pendingDel = null; continue }
      const { left, right } = item.pair
      if (left?.kind === 'del' && right?.kind === 'add') {
        out.push(diffSegments(left.text, right.text))
        pendingDel = null
        continue
      }
      if (right?.kind === 'add' && left?.kind !== 'del') {
        out.push(pendingDel === null ? NO_SPAN : diffSegments(pendingDel, right.text))
        pendingDel = null
        continue
      }
      if (left?.kind === 'del') { pendingDel = left.text; out.push(NO_SPAN); continue }
      out.push(NO_SPAN)
      pendingDel = null
    }
    return out
  }, [display])

  // 命中统计：按「显示行」计数，与视觉上的高亮一致（同一行多次出现算一个跳转点）。
  const hitRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length === 0) return [] as number[]
    const found: number[] = []
    display.forEach((item, position) => {
      if (item.type !== 'pair') return
      const haystack = `${item.pair.left?.text ?? ''}\u0000${item.pair.right?.text ?? ''}`.toLowerCase()
      if (haystack.includes(needle)) found.push(position)
    })
    return found
  }, [display, query])

  const jump = (step: number) => {
    if (hitRows.length === 0) return
    setActive((prev) => (prev + step + hitRows.length) % hitRows.length)
  }

  // Ctrl/⌘+F 聚焦查找框；Esc 先清查找再交给外层（外层只在 layer==='none' 时接管）。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'f') {
        event.preventDefault()
        event.stopPropagation()
        findRef.current?.focus()
        findRef.current?.select()
        return
      }
      if (key === 'f3') {
        event.preventDefault()
        event.stopPropagation()
        setActive((prev) => (hitRows.length === 0 ? 0 : (prev + (event.shiftKey ? -1 : 1) + hitRows.length) % hitRows.length))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [hitRows.length])

  const activeRow = hitRows.length > 0 ? hitRows[Math.min(active, hitRows.length - 1)] : -1

  // 当前命中行滚进视野。
  useEffect(() => {
    if (activeRow < 0) return
    const target = bodyRef.current?.querySelector<HTMLElement>('[data-hitrow="1"]')
    target?.scrollIntoView({ block: 'center' })
  }, [activeRow, layout, expanded])

  const pickLayout = (next: DiffLayout) => {
    setLayout(next)
    writePref(PREF_DIFF_LAYOUT, next)
  }
  const toggleHighlight = () => {
    const next = !highlightOn
    setHighlightOn(next)
    writePref(PREF_HIGHLIGHT, next ? '1' : '0')
  }

  /** 渲染一格：有命中/词级标记时走纯文本片段，否则走语法高亮。 */
  const renderCell = (row: DiffRow | null, role: 'left' | 'right', span: WordSpan) => {
    if (!row) {
      return (
        <div className="dgp-dv-side" data-role={role}>
          <span className="dgp-dv-no" /><span className="dgp-dv-sign" /><span className="dgp-dv-code" />
        </div>
      )
    }
    const no = role === 'left' ? row.oldNo : row.newNo
    const sign = row.kind === 'add' ? '+' : row.kind === 'del' ? '-' : row.kind === 'ctx' ? ' ' : '·'
    const segments = segmentize(row.text, span, role, query.trim())
    const plain = segments.every((segment) => segment.hit === 0 && segment.word === '')
    if (plain && highlightOn && lang !== '' && hasGrammar(lang)) {
      const html = highlight(row.text, lang)
      if (html !== '') {
        return (
          <div className="dgp-dv-side" data-role={role}>
            <span className="dgp-dv-no">{no ?? ''}</span>
            <span className="dgp-dv-sign">{sign}</span>
            <span className="dgp-dv-code" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        )
      }
    }
    return (
      <div className="dgp-dv-side" data-role={role}>
        <span className="dgp-dv-no">{no ?? ''}</span>
        <span className="dgp-dv-sign">{sign}</span>
        <span className="dgp-dv-code">
          {segments.map((segment, offset) => {
            if (segment.hit === 0 && segment.word === '') return <span key={offset}>{segment.text}</span>
            return (
              <span
                key={offset}
                className={segment.word === '' ? 'dgp-dv-hit' : 'dgp-dv-word'}
                data-hit={segment.hit === 0 ? undefined : segment.hit === 2 ? '2' : '1'}
                data-w={segment.word === '' ? undefined : segment.word}
              >
                {segment.text}
              </span>
            )
          })}
        </span>
      </div>
    )
  }

  return (
    <div className="dgp-dv">
      <div className="dgp-dv-bar">
        <span className="dgp-seg" role="group" aria-label={t('diffLayout')}>
          <button type="button" data-on={layout === 'unified' ? '1' : '0'} onClick={() => pickLayout('unified')}>{t('diffUnified')}</button>
          <button type="button" data-on={layout === 'split' ? '1' : '0'} onClick={() => pickLayout('split')}>{t('diffSplit')}</button>
          <button type="button" data-on={layout === 'before' ? '1' : '0'} onClick={() => pickLayout('before')}>{t('diffBefore')}</button>
          <button type="button" data-on={layout === 'after' ? '1' : '0'} onClick={() => pickLayout('after')}>{t('diffAfter')}</button>
        </span>
        <span className="dgp-dv-find">
          <input
            ref={findRef}
            className="dgp-input"
            type="search"
            value={query}
            placeholder={t('diffFindPlaceholder')}
            aria-label={t('diffFind')}
            onChange={(event) => { setQuery(event.target.value); setActive(0) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); jump(event.shiftKey ? -1 : 1) }
              if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setQuery(''); findRef.current?.blur() }
            }}
          />
          <span className="dgp-dv-findcount" data-empty={query.trim() !== '' && hitRows.length === 0 ? '1' : '0'}>
            {query.trim() === '' ? '' : `${hitRows.length === 0 ? 0 : Math.min(active + 1, hitRows.length)}/${hitRows.length}`}
          </span>
        </span>
        <button type="button" className="dgp-btn ghost" data-on={highlightOn ? '1' : '0'} onClick={toggleHighlight} aria-pressed={highlightOn}>
          {t('diffHighlight')}
        </button>
      </div>

      <div className="dgp-dv-body" ref={bodyRef}>
        {rows.length === 0 ? (
          <div className="dgp-dv-empty">{t('diffEmpty')}</div>
        ) : (
          <div className="dgp-dv-table" data-layout={layout}>
            {display.map((item, position) => {
              if (item.type === 'fold') {
                return (
                  <button
                    key={item.key}
                    type="button"
                    className="dgp-dv-row"
                    data-kind="fold"
                    onClick={() => setExpanded((prev) => new Set(prev).add(item.key))}
                  >
                    <span className="dgp-dv-code">{`⋯ ${item.hidden} ${t('diffFoldHint')}`}</span>
                  </button>
                )
              }
              const kind = pairKind(item.pair)
              const hitHere = position === activeRow
              const span = spans[position] ?? NO_SPAN
              if (layout === 'before' || layout === 'after') {
                // 变更前 / 变更后：只保留同一侧，另一侧不存在的行整体跳过。
                const solo = layout === 'before' ? item.pair.left : item.pair.right
                if (!solo) return null
                return (
                  <div key={`o-${item.index}`} className="dgp-dv-row" data-kind={kind} data-hitrow={hitHere ? '1' : '0'}>
                    {renderCell(solo, layout === 'before' ? 'left' : 'right', span)}
                  </div>
                )
              }
              if (layout === 'unified') {
                // 统一视图：成对的删/增拆成两行按原序排，其余单行铺满。
                if (item.pair.left?.kind === 'del' && item.pair.right?.kind === 'add') {
                  return (
                    <div key={`u-${item.index}`} className="dgp-dv-row" data-kind="chg" data-hitrow={hitHere ? '1' : '0'}>
                      <div className="dgp-dv-row" data-kind="del">{renderCell(item.pair.left, 'left', span)}</div>
                      <div className="dgp-dv-row" data-kind="add">{renderCell(item.pair.right, 'right', span)}</div>
                    </div>
                  )
                }
                const row = item.pair.left ?? item.pair.right
                return (
                  <div key={`u-${item.index}`} className="dgp-dv-row" data-kind={kind} data-hitrow={hitHere ? '1' : '0'}>
                    {renderCell(row, 'left', span)}
                  </div>
                )
              }
              return (
                <div key={`s-${item.index}`} className="dgp-dv-row" data-kind={kind} data-hitrow={hitHere ? '1' : '0'}>
                  {renderCell(item.pair.left, 'left', span)}
                  {renderCell(item.pair.right, 'right', span)}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {truncated ? <div className="dgp-hint">{t('diffTruncated')}</div> : null}
    </div>
  )
}
