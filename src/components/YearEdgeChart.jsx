import { useState } from 'react'
import { useWidth } from '../hooks.js'
import { pct, pp } from '../format.js'
import { niceStep } from './LineChart.jsx'

/**
 * Diverging bars: edge over the always-up baseline, per year, drawn at the
 * container's real width. Polarity is the job, so the palette's diverging pair
 * (blue ↔ red) is used with a neutral zero line. Every bar carries its value, and
 * each year has a tooltip with the accuracy and baseline behind it.
 */
export default function YearEdgeChart ({ rows }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState(null)
  if (!rows?.length) return null
  const narrow = w > 0 && w < 520
  const H = narrow ? 200 : 230
  const M = { t: 22, r: 8, b: 26, l: 48 }
  // Fit the scale to the data, always including zero, with room on each side of it
  // for the value labels. A symmetric scale left half the chart empty in a run that
  // is mostly below the baseline.
  const edges = rows.map(r => r.edge)
  const span = Math.max(...edges.map(Math.abs)) || 0.01
  const hi = Math.max(0, ...edges) + span * 0.22
  const lo = Math.min(0, ...edges) - span * 0.22
  const band = (w - M.l - M.r) / rows.length
  const bw = Math.min(64, band * 0.6)
  const x = i => M.l + (i + 0.5) * band
  const y = v => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b)
  const zero = y(0)
  const step = niceStep(span / 2)
  const ticks = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) if (Math.abs(v) > step / 2) ticks.push(v)
  const tipW = 180

  return (
    <>
      <div className="legend">
        <span><i className="sq" style={{ background: 'var(--pos)' }} />Beat the baseline</span>
        <span><i className="sq" style={{ background: 'var(--neg)' }} />Lost to the baseline</span>
      </div>
      <div className="chart" ref={ref}>
        {w > 0 && (
          <svg viewBox={`0 0 ${w} ${H}`} height={H} role="img" aria-label="Edge over the always-up baseline by year"
               onPointerLeave={() => setHover(null)}>
            {ticks.map(v => (
              <g key={v}>
                <line x1={M.l} x2={w - M.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
                <text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{pp(v, 1)}</text>
              </g>
            ))}
            <text x={M.l - 8} y={zero + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">0</text>
            {rows.map((r, i) => {
              const top = r.edge >= 0 ? y(r.edge) : zero
              const h = Math.max(2, Math.abs(zero - y(r.edge)))
              return (
                <g key={r.year} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                  <rect x={x(i) - band / 2} y="0" width={band} height={H} fill="transparent" />
                  <rect x={x(i) - bw / 2} y={top} width={bw} height={h} rx="4"
                        fill={r.edge >= 0 ? 'var(--pos)' : 'var(--neg)'} />
                  <text x={x(i)} y={r.edge >= 0 ? top - 6 : top + h + 14} textAnchor="middle"
                        fontSize="11.5" fill="var(--ink-2)">{pp(r.edge)}</text>
                  <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--ink-2)">{r.year}</text>
                </g>
              )
            })}
            <line x1={M.l} x2={w - M.r} y1={zero} y2={zero} stroke="var(--axis)" strokeWidth="1.5" />
          </svg>
        )}
        {hover != null && w > 0 && (
          <div className="tip" style={{ left: Math.max(0, Math.min(w - tipW, x(hover) - tipW / 2)), width: tipW }}>
            <div className="h">{rows[hover].year} · {rows[hover].n.toLocaleString()} predictions</div>
            <div className="r"><span>Model</span><b>{pct(rows[hover].accuracy)}</b></div>
            <div className="r"><span>Always-up</span><b>{pct(rows[hover].baseline)}</b></div>
            <div className="r"><span>Edge</span>
              <b className={rows[hover].edge >= 0 ? 'up-t' : 'down-t'}>{pp(rows[hover].edge)}</b></div>
          </div>
        )}
      </div>
    </>
  )
}
