import { API_BASE } from '../api.js'
import { dateYear } from '../format.js'

export const STALE_AFTER_DAYS = 5   // a daily run that skips a long weekend is still fine

/** "Fri, Nov 13, 11:44 AM" in the viewer's time zone. */
const stamp = d =>
  `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`

/**
 * Title, a one-line status (freshness, last-price upload, coverage, run), and any
 * page-level notice. `lastPriceAt` is when the LastPrice database was last uploaded
 * (/api/last-price), the prices behind the Last column on Tomorrow.
 */
export default function Hero ({ summary, error, midrun, lastPriceAt = null, now = Date.now() }) {
  const pub = summary?.publishedAt ? new Date(summary.publishedAt) : null
  const lp = lastPriceAt ? new Date(lastPriceAt) : null
  const ageDays = pub ? (now - pub.getTime()) / 864e5 : null
  const stale = ageDays != null && ageDays > STALE_AFTER_DAYS
  const o = summary?.overall

  return (
    <header className="hero">
      <h1>PSO + LS-SVM — did it beat the guess?</h1>
      {summary && (
        <div className="status">
          <span className={`fresh${stale ? ' stale' : ''}`} title={pub ? `Published ${pub.toLocaleString()}` : undefined}>
            {pub ? `Published ${stamp(pub)}` : 'Published: unknown'}
          </span>
          {lp && <span className="last-price" title={`Last prices uploaded ${lp.toLocaleString()}`}>Last price updated {stamp(lp)}</span>}
          <span>{o.n.toLocaleString()} graded next-session predictions</span>
          <span>{summary.nTickers} large-cap names</span>
          <span>{dateYear(summary.range.start)} → {dateYear(summary.range.end)}</span>
          <span className="muted">run <code>{summary.runId}</code> · MongoDB <code>{summary.db}</code></span>
          {midrun && <span className="src">Midrun: reading ResearchGateEOD</span>}
        </div>
      )}
      {stale && (
        <div className="banner warn" role="status">
          <b>Last published {Math.floor(ageDays)} days ago</b>
          <p>The daily run has not published since {pub.toLocaleString()}. Numbers below are correct for
            that date but may be behind the market. Source: <code>{summary.origin}</code></p>
        </div>
      )}
      {error && (
        <div className="banner crit" role="alert">
          <b>The API did not answer</b>
          <p>{error}
            <br />API base: <code>{API_BASE || '(same origin, dev proxy)'}</code>.
            If this is a fresh deploy, check <code>VITE_API_BASE</code> on Render and that the run has been
            published with <code>python3 -m src.publish_mongo</code>.</p>
        </div>
      )}
    </header>
  )
}
