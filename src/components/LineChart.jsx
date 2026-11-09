import { useMemo, useState } from 'react'
import { useWidth } from '../hooks.js'
import { dateYear } from '../format.js'

/**
 * Line chart drawn at its container's real width, so 11px labels stay 11px and the
 * box is exactly as tall as the plot — no letterboxing, no sideways scroll.
 *
 * Marks: 2px strokes, a recessive grid, a dashed reference line, and direct labels
 * at the right edge when there is room (a legend sits above every chart, so identity
 * never rests on colour alone). A crosshair and tooltip follow the pointer or a touch.
 *
 * points: [{ x: 'YYYY-MM-DD', v: [number, …] }]   series: [{ label, color, end(v) }]
 */
export default function LineChart ({ points, series, refValue, floor = 0, yFmt, tipFmt, ariaLabel, yAxisWidth = 44 }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState(null)
  const narrow = w > 0 && w < 520
  const H = narrow ? 210 : 280
  const M = { t: 10, r: narrow ? 8 : 108, b: 24, l: yAxisWidth }

  const g = useMemo(() => {
    if (!w || !points?.length) return null
    const n = points.length
    const vals = points.flatMap(p => p.v).filter(Number.isFinite)
    if (refValue != null) vals.push(refValue)
    let lo = Math.min(...vals), hi = Math.max(...vals)
    const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.1 || 1
    lo = Math.max(floor ?? -Infinity, lo - pad); hi += pad
    const plotW = w - M.l - M.r
    const x = i => M.l + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
    const y = v => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b)
    const step = niceStep((hi - lo) / (narrow ? 4 : 5))
    const ticks = []
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) ticks.push(v)
    // One label per year, skipped where it would crowd the previous one.
    const years = []
    let lastX = -Infinity
    points.forEach((p, i) => {
      const yr = String(p.x).slice(0, 4)
      if (years.length && years[years.length - 1].yr === yr) return
      const px = x(i)
      years.push({ yr, px, show: px - lastX > (narrow ? 40 : 34) })
      if (years[years.length - 1].show) lastX = px
    })
    const paths = series.map((_, j) => points
      .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v[j]).toFixed(1)}`).join(''))
    // Right-edge labels collide when two lines finish close together; nudge apart.
    const last = points[n - 1]
    const labels = series.map((s, j) => ({ j, ly: y(last.v[j]), text: s.end(last.v[j]) }))
      .sort((a, b) => a.ly - b.ly)
    for (let i = 1; i < labels.length; i++) if (labels[i].ly - labels[i - 1].ly < 15) labels[i].ly = labels[i - 1].ly + 15
    return { n, x, y, ticks, years, paths, labels, plotW }
  }, [w, points, series, refValue, floor, narrow, H, M.l, M.r, M.t, M.b])

  const pick = e => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left - M.l) / g.plotW) * (g.n - 1))
    setHover(Math.max(0, Math.min(g.n - 1, i)))
  }

  const tipLeft = hover == null ? 0 : (() => {
    const px = g.x(hover), tw = 170
    return Math.max(0, Math.min(w - tw, px + 14 + tw > w ? px - tw - 14 : px + 14))
  })()

  return (
    <div className="chart" ref={ref}>
      {g && (
        <svg viewBox={`0 0 ${w} ${H}`} height={H} role="img" aria-label={ariaLabel}
             onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
          {g.ticks.map(v => (
            <g key={v}>
              <line x1={M.l} x2={w - M.r} y1={g.y(v)} y2={g.y(v)} stroke="var(--grid)" />
              <text x={M.l - 8} y={g.y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{yFmt(v)}</text>
            </g>
          ))}
          {refValue != null && (
            <line x1={M.l} x2={w - M.r} y1={g.y(refValue)} y2={g.y(refValue)} stroke="var(--axis)" strokeDasharray="3 3" />
          )}
          {g.years.filter(t => t.show).map(t => (
            <text key={t.yr} x={t.px} y={H - 6} fontSize="11" fill="var(--ink-3)"
                  textAnchor={t.px < M.l + 12 ? 'start' : 'middle'}>{t.yr}</text>
          ))}
          {g.paths.map((d, j) => (
            <path key={j} d={d} fill="none" stroke={series[j].color} strokeWidth="2"
                  strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {!narrow && g.labels.map(l => (
            <g key={l.j}>
              <circle cx={g.x(g.n - 1)} cy={g.y(points[g.n - 1].v[l.j])} r="3.5"
                      fill={series[l.j].color} stroke="var(--surface)" strokeWidth="2" />
              <text x={w - M.r + 10} y={l.ly + 4} fontSize="12" fill="var(--ink-2)">{l.text}</text>
            </g>
          ))}
          {hover != null && (
            <g>
              <line x1={g.x(hover)} x2={g.x(hover)} y1={M.t} y2={H - M.b} stroke="var(--axis)" />
              {series.map((s, j) => (
                <circle key={j} cx={g.x(hover)} cy={g.y(points[hover].v[j])} r="4.5"
                        fill={s.color} stroke="var(--surface)" strokeWidth="2" />
              ))}
            </g>
          )}
          <rect x={M.l} y="0" width={Math.max(0, g.plotW)} height={H} fill="transparent" />
        </svg>
      )}
      {g && hover != null && (
        <div className="tip" style={{ left: tipLeft, width: 170 }}>
          <div className="h">{dateYear(points[hover].x)}</div>
          {series.map((s, j) => (
            <div className="r" key={j}>
              <span><i style={{ background: s.color }} />{s.label}</span>
              <b>{tipFmt(points[hover].v[j])}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function niceStep (raw) {
  if (!(raw > 0)) return 1
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}
