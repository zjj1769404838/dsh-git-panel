import { useState } from 'react'
import { CopyIcon } from './shared.js'
import type { RepoGraphView, Dict } from './shared.js'

/**
 * 分支拓扑图（车道式 DAG）：独立模块，chip 菜单与 Git 工作台共用。
 * 车道宽 13px、行高 34px；颜色按车道索引取 8 色循环（车道稳定 → 颜色稳定）。
 */
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

interface GraphProps {
  t: (key: string) => string
  graph: RepoGraphView | null
  loading: boolean
  error: string
}

export function GraphView({ t, graph, loading, error }: GraphProps) {
  const [active, setActive] = useState<string>('')
  const [copied, setCopied] = useState('')

  const rows = graph?.rows ?? []
  const laneCount = Math.max(1, graph?.laneCount ?? 1)
  const width = LANE_PAD * 2 + (laneCount - 1) * LANE_W
  const height = Math.max(ROW_H, rows.length * ROW_H)
  const selected = rows.find((item) => item.hash === active) ?? null

  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(hash)
      window.setTimeout(() => setCopied(''), 1500)
    } catch {
      setCopied('')
    }
  }

  if (loading && !graph) {
    return (
      <div className="dgp-graph">
        <div className="dgp-graph-head">
          <span>{t('graphTitle')}</span>
        </div>
        <div className="dgp-graph-note">{t('graphLoading')}</div>
      </div>
    )
  }

  if (error.length > 0) {
    return (
      <div className="dgp-graph">
        <div className="dgp-graph-head">
          <span>{t('graphTitle')}</span>
        </div>
        <div className="dgp-graph-note" data-tone="error">
          {t('graphFailed')}：{error}
        </div>
      </div>
    )
  }

  if (!graph || rows.length === 0) {
    return (
      <div className="dgp-graph">
        <div className="dgp-graph-head">
          <span>{t('graphTitle')}</span>
        </div>
        <div className="dgp-graph-note">{t('graphEmpty')}</div>
      </div>
    )
  }

  return (
    <div className="dgp-graph">
      <div className="dgp-graph-head">
        <span>{t('graphTitle')}</span>
        <span className="dgp-graph-meta">
          {t('graphLanes').replace('{n}', String(laneCount))}
          {graph.truncated ? ` · ${t('graphTruncated').replace('{n}', String(rows.length))}` : ''}
        </span>
      </div>
      <div className="dgp-graph-body">
        <svg className="dgp-graph-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {/* 先画线，再画节点：节点盖在连线之上，交叉处不会糊。 */}
          {rows.map((item) =>
            item.through.map((lane) => (
              <line
                key={`t-${item.row}-${lane}`}
                className="dgp-graph-line"
                x1={laneX(lane)}
                y1={rowY(item.row)}
                x2={laneX(lane)}
                y2={rowY(item.row + 1)}
                stroke={laneColor(lane)}
              />
            )),
          )}
          {rows.map((item) =>
            item.segments.map((seg) =>
              // 同车道：垂直直落；跨车道：S 形贝塞尔。两种都用 stroke 上色，交接处不跳色。
              seg.from === seg.to ? (
                <line
                  key={`s-${item.row}-${seg.from}-${seg.to}`}
                  className="dgp-graph-line"
                  x1={laneX(seg.from)}
                  y1={rowY(item.row)}
                  x2={laneX(seg.to)}
                  y2={rowY(item.row + 1)}
                  stroke={laneColor(seg.from)}
                />
              ) : (
                <path
                  key={`s-${item.row}-${seg.from}-${seg.to}`}
                  className="dgp-graph-line"
                  d={curvePath(seg.from, seg.to, item.row)}
                  stroke={laneColor(seg.to)}
                />
              ),
            ),
          )}
          {rows.map((item) => {
            const isHead = item.refs.some((ref) => ref.kind === 'head')
            return (
              <circle
                key={`d-${item.hash}`}
                className="dgp-graph-dot"
                cx={laneX(item.lane)}
                cy={rowY(item.row)}
                r={isHead ? DOT_R + 1.4 : DOT_R}
                fill={laneColor(item.lane)}
              />
            )
          })}
          {/* HEAD 外环：与「当前分支」区分开，只用描边不填充，避免抢眼。 */}
          {rows
            .filter((item) => item.refs.some((ref) => ref.kind === 'head'))
            .map((item) => (
              <circle
                key={`h-${item.hash}`}
                cx={laneX(item.lane)}
                cy={rowY(item.row)}
                r={DOT_R + 4}
                fill="none"
                stroke={laneColor(item.lane)}
                strokeWidth="1"
                opacity="0.45"
              />
            ))}
        </svg>

        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          {rows.map((item) => {
            const isHead = item.refs.some((ref) => ref.kind === 'head')
            return (
              <div
                key={`r-${item.hash}`}
                className="dgp-graph-row"
                data-active={active === item.hash ? '1' : '0'}
                data-current={isHead ? '1' : '0'}
                title={`${item.short} · ${item.author} · ${item.date}\n${item.subject}`}
                onMouseEnter={() => setActive(item.hash)}
                onMouseLeave={() => setActive((current) => (current === item.hash ? '' : current))}
                onClick={() => setActive(item.hash)}
              >
                <span className="dgp-graph-main">
                  <span className="dgp-graph-subject">{item.subject || item.short}</span>
                  <span className="dgp-graph-sub">
                    <span className="dgp-graph-hash">{item.short}</span>
                    <span className="dgp-graph-author">
                      {item.author} · {item.date}
                    </span>
                  </span>
                </span>
                {item.refs.length > 0 ? (
                  <span className="dgp-graph-refs">
                    {item.refs.slice(0, 3).map((ref) => (
                      <span key={`${item.hash}-${ref.kind}-${ref.name}`} className="dgp-graph-ref" data-kind={ref.kind} title={ref.name}>
                        {ref.name}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {selected ? (
        <div className="dgp-graph-detail">
          <span className="dgp-graph-detail-text" title={`${selected.hash}\n${selected.subject}`}>
            {selected.short} · {selected.author} · {selected.date}
          </span>
          <button
            type="button"
            className="dgp-graph-copy"
            title={copied === selected.hash ? t('graphCopied') : t('graphCopyHash')}
            aria-label={t('graphCopyHash')}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void copyHash(selected.hash)}
          >
            <CopyIcon />
          </button>
        </div>
      ) : null}
    </div>
  )
}
