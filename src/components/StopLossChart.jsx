import { useMemo } from 'react'
import LineChart from './LineChart.jsx'
import { money } from '../format.js'

/**
 * One stock's account balance under each stop level.
 *
 * The three series are ORDINAL, not categorical (2% < 5% < 8%), so they take a
 * single-hue ramp with monotone lightness (see --stop-* in theme.css) and the
 * reader gets the ordering from the colour itself. All three are direct-labelled
 * at the right edge as well, so identity never rests on colour alone.
 */
const LEVELS = [
  { key: 'c2', label: '2% stop', color: 'var(--stop-1)', end: v => `${money(v, 0)} · 2%` },
  { key: 'c5', label: '5% stop', color: 'var(--stop-2)', end: v => `${money(v, 0)} · 5%` },
  { key: 'c8', label: '8% stop', color: 'var(--stop-3)', end: v => `${money(v, 0)} · 8%` },
]

export default function StopLossChart ({ series, start = 10000 }) {
  const pts = useMemo(() => (series || []).map(p => ({ x: p.d, v: LEVELS.map(l => p[l.key]) })), [series])
  if (!pts.length) return <p className="note">No balance history for this stock.</p>
  return (
    <>
      <div className="legend">
        {LEVELS.map(l => <span key={l.key}><i style={{ background: l.color }} />{l.label}</span>)}
      </div>
      <LineChart points={pts} series={LEVELS} refValue={start} yAxisWidth={60}
                 yFmt={v => money(v, 0)} tipFmt={v => money(v)}
                 ariaLabel="Account balance over time at each stop-loss level" />
    </>
  )
}
