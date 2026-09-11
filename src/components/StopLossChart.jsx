import { useMemo, useState } from 'react'

const LEVELS = [
  { key: 'c2', label: '2% stop', token: 'var(--stop-1)' },
  { key: 'c5', label: '5% stop', token: 'var(--stop-2)' },
  { key: 'c8', label: '8% stop', token: 'var(--stop-3)' },
]

/**
 * One stock's account balance under each stop level.
 *
 * The three series are ORDINAL, not categorical — 2% < 5% < 8% — so they take a
 * single-hue ramp with monotone lightness (see --stop-* in theme.css) and the
 * reader gets the ordering from the colour itself. All three are direct-labelled
 * at the right edge as well, so identity never rests on colour alone.
 */
export default function StopLossChart ({ series, start = 10000, height = 300 }) {
  const [hover, setHover] = useState(null)
  const W = 980, H = height
  const M = { top: 16, right: 104, bottom: 30, left: 68 }

  const geom = useMemo(() => {
    if (!series?.length) return null
    const vals = series.flatMap(p => LEVELS.map(l => p[l.key])).filter(Number.isFinite)
    const lo = Math.min(...vals, start), hi = Math.max(...vals, start)
    const pad = (hi - lo) * 0.08 || 100
    const y0 = Math.max(0, lo - pad), y1 = hi + pad
    const x = i => M.left + (i / Math.max(series.length - 1, 1)) * (W - M.left - M.right)
    const y = v => M.top + (1 - (v - y0) / (y1 - y0)) * (H - M.top - M.bottom)
    const line = key => series
      .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join('')
    const ticks = []
    const step = niceStep((y1 - y0) / 5)
    for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) ticks.push(v)
    const years = []
    series.forEach((p, i) => {
      const yr = String(p.d).slice(0, 4)
      if (!years.length || years[years.length - 1].year !== yr) years.push({ year: yr, i })
    })
    return { x, y, line, ticks, years }
  }, [series, H, start])

  if (!geom) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data</div>
  const last = series[series.length - 1]
  // Right-edge labels collide when two levels finish close together; nudge them apart.
  const labels = LEVELS.map(l => ({ ...l, v: last[l.key], y: geom.y(last[l.key]) }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14
  }

  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const t = (px - M.left) / (W - M.left - M.right)
    const i = Math.round(t * (series.length - 1))
    if (i >= 0 && i < series.length) setHover({ i, clientX: e.clientX - r.left, rectW: r.width })
  }

  return (
    <div className="chart-wrap">
      <div className="legend">
        {LEVELS.map(l => (
          <span className="item" key={l.key}>
            <span className="swatch" style={{ background: l.token }} />{l.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onMouseMove={onMove}
           onMouseLeave={() => setHover(null)} style={{ display: 'block', minWidth: 620 }}
           role="img" aria-label="Account balance over time at each stop-loss level">
        {geom.ticks.map(v => (
          <g key={v}>
            <line x1={M.left} x2={W - M.right} y1={geom.y(v)} y2={geom.y(v)}
                  stroke="var(--grid)" strokeWidth="1" />
            <text x={M.left - 9} y={geom.y(v) + 4} textAnchor="end" fontSize="11"
                  fill="var(--text-muted)">{money(v)}</text>
          </g>
        ))}
        <line x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom}
              stroke="var(--axis)" strokeWidth="1" />
        {geom.years.map(({ year, i }) => (
          <text key={year} x={geom.x(i)} y={H - 10} fontSize="11" fill="var(--text-muted)"
                textAnchor="middle">{year}</text>
        ))}
        {/* the $10,000 you started with — above it you made money */}
        <line x1={M.left} x2={W - M.right} y1={geom.y(start)} y2={geom.y(start)}
              stroke="var(--axis)" strokeWidth="1" strokeDasharray="3 3" />
        {LEVELS.map(l => (
          <path key={l.key} d={geom.line(l.key)} fill="none" stroke={l.token} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {labels.map(l => (
          <text key={l.key} x={W - M.right + 8} y={l.y + 4} fontSize="11.5"
                fill="var(--text-secondary)">{money(l.v)} · {l.label.replace(' stop', '')}</text>
        ))}
        {hover && (
          <g>
            <line x1={geom.x(hover.i)} x2={geom.x(hover.i)} y1={M.top} y2={H - M.bottom}
                  stroke="var(--axis)" strokeWidth="1" />
            {LEVELS.map(l => (
              <circle key={l.key} cx={geom.x(hover.i)} cy={geom.y(series[hover.i][l.key])} r="4.5"
                      fill={l.token} stroke="var(--surface-1)" strokeWidth="2" />
            ))}
          </g>
        )}
      </svg>
      {hover && (
        <div className="tooltip" style={{
          left: Math.min(Math.max(hover.clientX + 14, 0), (hover.rectW || 900) - 190), top: 34,
        }}>
          <div className="t-date">{series[hover.i].d}</div>
          {LEVELS.map(l => (
            <div className="t-row" key={l.key}>
              <span style={{ color: l.token }}>{l.label}</span>
              <strong>{money(series[hover.i][l.key], 2)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const money = (v, dp = 0) => Number.isFinite(v)
  ? `$${v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
  : '—'

function niceStep (raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}
