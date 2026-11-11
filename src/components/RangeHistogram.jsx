import { useMemo, useState } from 'react'
import { useWidth } from '../hooks.js'
import { pct, pctSpan } from '../format.js'
import { niceStep } from './LineChart.jsx'

/**
 * How often a stock's 10-session swing came out at each size: one bar per bin,
 * bar height = share of all windows in the period. The bars inside the middle
 * half (25th to 75th percentile) are the accent — "where it usually lands" is the
 * one coloured thing — and a line marks the latest 10 sessions.
 *
 * The publisher stores 0.5% bins; they are merged here so a volatile stock never
 * draws more than MAX_BARS, and windows past the chart's right edge (one freak
 * fortnight can be 200%) fold into the last bar, which says "or more".
 */
const MAX_BARS = 48
const FACTORS = [1, 2, 4, 10, 20, 40]

export function histogramBins (stats, now) {
  const bw0 = stats.binWidth
  const counts = stats.counts || []
  // Wide enough for today and for the body of the history, not for one freak window.
  const body = Math.min(stats.p99 ?? stats.max ?? 0, 2 * (stats.p90 ?? 0))
  const top = Math.max((now ?? 0) * 1.08, body, 0.1)
  const raw = Math.round(Math.ceil(top * 20 - 1e-9) / 20 / bw0)          // next 5%, in stored bins
  const f = FACTORS.find(k => raw / k <= MAX_BARS) ?? FACTORS[FACTORS.length - 1]
  const nb = Math.ceil(raw / f)
  const bw = bw0 * f
  const bins = Array.from({ length: nb }, (_, i) => ({ a: i * bw, b: (i + 1) * bw, n: 0 }))
  counts.forEach((c, k) => { bins[Math.min(nb - 1, Math.floor(k / f))].n += c })
  const over = counts.slice(nb * f).some(c => c > 0)
  return { bins, D: nb * bw, bw, over }
}

const pctLabel = (v, step) => `${(v * 100).toFixed(step < 0.01 ? 1 : 0)}%`

export default function RangeHistogram ({ stats, now, ticker }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState(null)
  const narrow = w > 0 && w < 520
  const H = narrow ? 210 : 240
  const M = { t: 42, r: 12, b: 24, l: 38 }

  const g = useMemo(() => {
    if (!w || !stats?.n) return null
    const { bins, D, over } = histogramBins(stats, now)
    const n = stats.n
    const shares = bins.map(b => (b.n / n) * 100)
    const mx = Math.max(...shares, 1)
    const st = niceStep(mx / 4)
    const yMax = Math.ceil(mx / st - 1e-9) * st
    const pw = w - M.l - M.r
    const x = v => M.l + (Math.min(v, D) / D) * pw
    const y = s => M.t + (1 - s / yMax) * (H - M.t - M.b)
    const ticks = []
    for (let v = 0; v <= yMax + 1e-9; v += st) ticks.push(v)
    const xs = niceStep(D / (narrow ? 4 : 6))
    const xt = []
    for (let v = 0; v <= D + 1e-9; v += xs) xt.push(v)
    let cum = 0
    const bars = bins.map((b, i) => {
      cum += b.n
      const mid = (b.a + b.b) / 2
      return { ...b, i, share: shares[i], cum: cum / n, inMid: mid >= stats.p25 && mid <= stats.p75,
               last: i === bins.length - 1 && over }
    })
    return { bars, D, x, y, ticks, xt, xs, pw, n, slot: pw / bins.length }
  }, [w, stats, now, narrow, H, M.l, M.r, M.t, M.b])

  const pick = e => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - r.left - M.l) / g.slot)
    setHover(i >= 0 && i < g.bars.length ? i : null)
  }

  const b = g && hover != null ? g.bars[hover] : null
  const tipW = 200
  const tipLeft = b ? (() => {
    const px = g.x(b.b)
    return Math.max(0, Math.min(w - tipW, px + 12 + tipW > w ? g.x(b.a) - tipW - 12 : px + 12))
  })() : 0
  const nowX = g && now != null ? g.x(now) : null
  const flip = nowX != null && nowX > w - 110

  return (
    <div className="chart" ref={ref}>
      {g && (
        <svg viewBox={`0 0 ${w} ${H}`} height={H} role="img"
             aria-label={`How often ${ticker}'s 10-session swing came out at each size: half of all windows between ${pctSpan(stats.p25, stats.p75)}${now != null ? `, the latest ${pct(now, 1)}` : ''}`}
             onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
          {g.ticks.map(v => (
            <g key={v}>
              <line x1={M.l} x2={w - M.r} y1={g.y(v)} y2={g.y(v)} stroke="var(--grid)" />
              <text x={M.l - 8} y={g.y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{v}%</text>
            </g>
          ))}
          {g.bars.map(bar => {
            if (!bar.n) return null
            const gap = g.slot > 8 ? 2 : 1
            const x0 = g.x(bar.a) + gap / 2, bw = Math.max(1, g.slot - gap)
            const y0 = g.y(bar.share), yb = g.y(0), r = Math.min(3, bw / 2, yb - y0)
            return (
              <path key={bar.i} data-bin={bar.i}
                    d={`M${x0},${yb}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${yb}Z`}
                    fill={bar.inMid ? 'var(--accent)' : 'var(--range-rest)'}
                    opacity={hover == null || hover === bar.i ? 1 : 0.75} />
            )
          })}
          <line x1={M.l} x2={w - M.r} y1={g.y(0)} y2={g.y(0)} stroke="var(--axis)" />
          {/* The middle half, bracketed and named, so the answer is on the chart. */}
          <g stroke="var(--accent)" strokeWidth="1.5">
            <line x1={g.x(stats.p25)} x2={g.x(stats.p75)} y1={M.t - 8} y2={M.t - 8} />
            <line x1={g.x(stats.p25)} x2={g.x(stats.p25)} y1={M.t - 12} y2={M.t - 4} />
            <line x1={g.x(stats.p75)} x2={g.x(stats.p75)} y1={M.t - 12} y2={M.t - 4} />
          </g>
          <text x={(g.x(stats.p25) + g.x(stats.p75)) / 2} y={M.t - 15} textAnchor="middle" fontSize="11.5"
                fill="var(--accent-ink)">half the time · {pctSpan(stats.p25, stats.p75)}</text>
          {nowX != null && (
            <g>
              <line x1={nowX} x2={nowX} y1={6} y2={g.y(0)} stroke="var(--ink)" strokeWidth="2" />
              <text x={flip ? nowX - 6 : nowX + 6} y={14} textAnchor={flip ? 'end' : 'start'} fontSize="12"
                    fill="var(--ink)">Latest {pct(now, 1)}</text>
            </g>
          )}
          {g.xt.map(v => (
            <text key={v} x={g.x(v)} y={H - 6} fontSize="11" fill="var(--ink-3)"
                  textAnchor={v === 0 ? 'start' : v >= g.D - 1e-9 ? 'end' : 'middle'}>
              {pctLabel(v, g.xs)}{v >= g.D - 1e-9 && g.bars[g.bars.length - 1].last ? '+' : ''}
            </text>
          ))}
          <rect x={M.l} y="0" width={Math.max(0, g.pw)} height={H} fill="transparent" />
        </svg>
      )}
      {b && (
        <div className="tip" style={{ left: tipLeft, width: tipW }}>
          <div className="h">{ticker} · {b.last ? `${pct(b.a, 1)} or more` : pctSpan(b.a, b.b)}</div>
          <div className="r"><span>Windows</span><b>{b.n.toLocaleString()} of {g.n.toLocaleString()}</b></div>
          <div className="r"><span>Share</span><b>{b.share < 1 && b.share > 0 ? b.share.toFixed(1) : Math.round(b.share)}%</b></div>
          {!b.last && <div className="r"><span>All windows under {pct(b.b, 1)}</span><b>{Math.round(b.cum * 100)}%</b></div>}
        </div>
      )}
    </div>
  )
}
