import type { GraphRowView } from './shared.js'

/**
 * 车道图元（纯 SVG）：历史列表每行左侧贴一条泳道（dgp-v20 起合并了原先独立的「分支图」视图）。
 *
 * 布局算法在 node 半边（`src/node/graph.ts`）完成，这里只负责画：
 * 行高 34px、车道宽 13px；颜色按车道索引取 8 色循环（车道稳定 → 颜色稳定）。
 * 一条分支跨 N 行是靠 N 个竖线段拼出来的，不存在跨行长连线，
 * 因此连线永远不会穿过中间的节点。
 *
 * 只导出两个：`laneWidth()` 给调用方算左侧留空，`LaneColumn` 画整列。
 * 整列只渲染一个 SVG（不是每行一个），否则每行都要重算路径，滚动时还会抖。
 */
export const LANE_W = 13
export const ROW_H = 34
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

/** 车道列占用的宽度（历史视图据此给每行预留左侧空位）。 */
export function laneWidth(laneCount: number): number {
  const lanes = Math.max(1, laneCount)
  return LANE_PAD * 2 + (lanes - 1) * LANE_W
}

interface LaneProps {
  /** 图行；row 必须是它在「被渲染列表」里的行号（历史列表按 row 重排后传入）。 */
  rows: Array<{
    row: number
    lane: number
    segments: Array<{ from: number; to: number }>
    through: number[]
    refs: Array<{ kind: string }>
    hash: string
  }>
  laneCount: number
  /** 总行数：决定 SVG 高度，保证最后一行也有完整的半行留白。 */
  count: number
}

/**
 * 左侧车道列（纯 SVG，不含右侧文字）：分支图与历史视图共用同一套绘制口径，
 * 避免两处画法在跨行转折处对不齐。
 */
export function LaneColumn({ rows, laneCount, count }: LaneProps) {
  const width = laneWidth(laneCount)
  const height = Math.max(ROW_H, count * ROW_H)
  const visible = rows.filter((item) => item.row >= 0 && item.row < count)
  return (
    <svg className="dgp-graph-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {/* 先画线，再画节点：节点盖在连线之上，交叉处不会糊。 */}
      {visible.map((item) =>
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
      {visible.map((item) =>
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
      {visible.map((item) => {
        const isHead = item.refs.some((ref) => ref.kind === 'head')
        return (
          <circle
            key={`d-${item.row}-${item.hash}`}
            className="dgp-graph-dot"
            cx={laneX(item.lane)}
            cy={rowY(item.row)}
            r={isHead ? DOT_R + 1.4 : DOT_R}
            fill={laneColor(item.lane)}
          />
        )
      })}
      {/* HEAD 外环：与「当前分支」区分开，只用描边不填充，避免抢眼。 */}
      {visible
        .filter((item) => item.refs.some((ref) => ref.kind === 'head'))
        .map((item) => (
          <circle
            key={`h-${item.row}-${item.hash}`}
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
  )
}
