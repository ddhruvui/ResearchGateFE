import { dateLong, dateShort, money, num, pct, pp, spct, stopLabel } from '../format.js'
import { REASON } from './StopLoss.jsx'
import { StatStrip } from './ui.jsx'

/**
 * Everything about one stock in one card: shown when the search lands on a single
 * ticker. Tomorrow's call, its direction record, and what $10,000 became at the
 * selected stop level.
 */
export default function Spotlight ({ ticker, next, midrun, record, strategyRow, stop, startCapital = 10000 }) {
  const n = next?.rows?.find(r => r.ticker === ticker)
  const b = strategyRow?.byStop?.[stop]
  const L = b?.last
  const ret = b?.end != null ? b.end / startCapital - 1 : null
  const google = `https://www.google.com/search?q=${encodeURIComponent(`${ticker} stock`)}`

  return (
    <section className="spot" aria-label={`${ticker} at a glance`}>
      <div className="spot-head">
        <div><small>Stock</small><h2>{ticker}</h2></div>
        <a className="btn" href={google} target="_blank" rel="noopener noreferrer">Open on Google ↗</a>
      </div>
      <StatStrip cols={3} items={[
        {
          label: `${midrun ? 'Midrun call' : 'Call'} for ${next?.forSession ? dateLong(next.forSession) : 'next session'}`,
          value: n ? <span className={n.pred > 0 ? 'up-t' : 'down-t'}>{n.pred > 0 ? '▲' : '▼'} {spct(n.pred)}</span> : '—',
          delta: n ? `${num(n.lastClose)} → ${num(n.impliedClose)}` : 'No prediction for this stock',
        },
        {
          label: 'Direction accuracy',
          value: record ? pct(record.accuracy) : '—',
          delta: record ? <>always-up {pct(record.baseline)} · edge <span className={record.edge >= 0 ? 'up-t' : 'down-t'}>{pp(record.edge)}</span></> : 'No track record',
        },
        {
          label: `$10,000 with a ${stop ? stopLabel(stop) : ''} stop`,
          value: b ? money(b.end) : '—',
          delta: b ? <><span className={ret >= 0 ? 'up-t' : 'down-t'}>{spct(ret, 1)}</span>
            {L && ` · ${dateShort(L.date)}: ${L.direction}, ${REASON[L.exit_reason] || L.exit_reason}`}</> : 'No stop-loss data',
        },
      ]} />
    </section>
  )
}
