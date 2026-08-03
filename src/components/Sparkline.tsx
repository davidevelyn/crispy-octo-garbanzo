interface Props {
  values: number[]
  height?: number
  showDots?: boolean
  /** labels for first/last x positions */
  startLabel?: string
  endLabel?: string
}

/** Hand-rolled SVG line chart. No library, no drama. */
export function Sparkline({ values, height = 120, showDots = true, startLabel, endLabel }: Props) {
  if (values.length === 0) return <div className="empty">No data yet</div>
  const width = 320
  const padX = 6
  const padY = 12
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = values.length > 1 ? (width - padX * 2) / (values.length - 1) : 0
  const points = values.map((v, i) => ({
    x: padX + i * stepX,
    y: padY + (height - padY * 2) * (1 - (v - min) / span),
  }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const last = points[points.length - 1]

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height + 14}`} preserveAspectRatio="xMidYMid meet">
      <line className="grid-line" x1={padX} y1={padY} x2={width - padX} y2={padY} />
      <line className="grid-line" x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} />
      <text className="axis-label" x={padX} y={padY - 3}>{Math.round(max)}</text>
      <text className="axis-label" x={padX} y={height - padY + 11}>{Math.round(min)}</text>
      <path className="line" d={path} />
      {showDots && last && <circle className="dot" cx={last.x} cy={last.y} r={4} />}
      {startLabel && <text className="axis-label" x={padX} y={height + 10}>{startLabel}</text>}
      {endLabel && (
        <text className="axis-label" x={width - padX} y={height + 10} textAnchor="end">{endLabel}</text>
      )}
    </svg>
  )
}
