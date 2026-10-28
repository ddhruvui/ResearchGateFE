import { useMemo, useState } from 'react'
import { fresh } from '../api.js'
import TickerLink from './TickerLink.jsx'

/**
 * Live paper-trade output: the one prediction nobody knows the answer to yet.
 * Shows the close it was computed from and the level the model implies, so the
 * number can be checked against a quote screen tomorrow.
 *
 * The price column is opt-in. Each press opens a real-time EODHD socket and
 * rotates the universe through it, so it costs a few seconds and real quota;
 * an always-on quote would also be wrong more often than right, since the
 * panel is usually read long after the print it would show. So it appears
 * only once asked for, and every press re-fetches rather than reusing what is
 * already on screen.
 */
export default function NextSession ({ data, midrun = false }) {
  const [sort, setSort] = useState({ key: 'pred', dir: 'desc' })
  const [q, setQ] = useState('')
  const [dir, setDir] = useState('all')
  const [live, setLive] = useState(null)      // null = never asked = no column
  const [busy, setBusy] = useState(false)
  const [liveErr, setLiveErr] = useState(null)

  const rows = data?.rows ?? []

  async function getLive () {
    setBusy(true)
    setLiveErr(null)
    try {
      const tickers = rows.map(r => r.ticker).join(',')
      // Fresh every time: no-store on the request, and the API sends no-store back.
      setLive(await fresh(`/api/live-price?tickers=${encodeURIComponent(tickers)}`))
    } catch (e) {
      setLiveErr(e.message)
      setLive(null)                            // a failed press leaves no half-column
    } finally {
      setBusy(false)
    }
  }

  const view = useMemo(() => {
    const f = q.trim().toUpperCase()
    let out = rows.filter(r => !f || r.ticker.includes(f))
    if (dir === 'up') out = out.filter(r => r.pred > 0)
    if (dir === 'down') out = out.filter(r => r.pred <= 0)
    // Merge the quote in so the column sorts like any other.
    out = out.map(r => ({ ...r, quote: live?.quotes?.[r.ticker] ?? null }))
    const { key, dir: d } = sort
    const sign = d === 'asc' ? 1 : -1
    return [...out].sort((a, b) => {
      const av = key === 'livePrice' ? a.quote?.price : a[key]
      const bv = key === 'livePrice' ? b.quote?.price : b[key]
      // Names without a quote sort to the bottom either way, never interleaved.
      if (av == null && bv == null) return a.ticker.localeCompare(b.ticker)
      if (av == null) return 1
      if (bv == null) return -1
      return sign * (typeof av === 'string' ? av.localeCompare(bv) : av - bv)
    })
  }, [rows, q, dir, sort, live])

  if (!rows.length) {
    if (midrun) {
      return <p className="note" style={{ margin: 0 }}>
        No midrun published yet — run <code>bash scripts/midrun.sh</code> in ResearchGateEOD.
        {data?.error && <><br /><span style={{ color: 'var(--text-muted)' }}>{data.error}</span></>}
      </p>
    }
    return <p className="note" style={{ margin: 0 }}>
      No live prediction available — run <code>RUN_MODE=predict scripts/launch.sh</code>.
    </p>
  }

  const th = (key, label, title) => (
    <th title={title || 'Click to sort'}
        onClick={() => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}>
      {label}{sort.key === key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )

  return (
    <>
      <div className="controls">
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {midrun ? 'IB price on' : 'Close of'} <strong style={{ color: 'var(--text-primary)' }}>{data.asOf}</strong>
          {midrun && data.midrunAsOf && ` (${new Date(data.midrunAsOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`} →
          expected for <strong style={{ color: 'var(--text-primary)' }}>{data.forSession}</strong>
          {' · '}<strong style={{ color: 'var(--text-primary)' }}>{data.up}</strong> up
          {' / '}<strong style={{ color: 'var(--text-primary)' }}>{data.down}</strong> down
        </span>
        <span style={{ flex: 1 }} />
        <button className="seg" onClick={getLive} disabled={busy}
                title="Fetch the current price for every name from EODHD">
          {busy ? 'Fetching…' : live ? 'Refresh price' : 'Get live price'}
        </button>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter ticker…"
               style={{
                 font: 'inherit', fontSize: 13, padding: '6px 10px', borderRadius: 7,
                 border: '1px solid var(--border)', background: 'transparent',
                 color: 'var(--text-primary)', width: 130,
               }} />
        {['all', 'up', 'down'].map(d => (
          <button key={d} className="seg" aria-pressed={dir === d} onClick={() => setDir(d)}>{d}</button>
        ))}
      </div>

      {liveErr && (
        <p className="note" style={{ margin: '0 0 12px', color: 'var(--critical)' }}>
          Could not fetch live prices — {liveErr}
        </p>
      )}
      {live && (
        <p className="note" style={{ margin: '0 0 12px' }}>
          Priced {quoteStamp(live)} · fetched {new Date(live.fetchedAt).toLocaleTimeString()}
          {' · '}{live.fromStream}/{Object.keys(live.quotes || {}).length} off the real-time tape
          {live.missing?.length > 0 && ` · no quote for ${live.missing.join(', ')}`}
        </p>
      )}

      <div className="scroll">
        <table>
          <thead>
            <tr>
              {th('ticker', 'Ticker')}
              {midrun && th('officialClose', `Close ${data.officialAsOf}`, 'Last official close, from data/ohlcv')}
              {th('lastClose', midrun ? `IB ${data.asOf}` : `Close ${data.asOf}`,
                  midrun ? "IB's price at the midrun, treated as today's close"
                         : 'Adjusted close the prediction was computed from')}
              {th('impliedClose', 'Expected', 'Close the model implies for the next session')}
              {live && th('livePrice', 'Live', 'Latest EODHD trade print when you pressed the button')}
              {th('pred', 'Change')}
              <th style={{ textAlign: 'center' }}>Call</th>
            </tr>
          </thead>
          <tbody>
            {view.map(r => {
              const diff = r.impliedClose - r.lastClose
              const up = r.pred > 0
              return (
                <tr key={r.ticker}>
                  <td style={{ fontWeight: 560 }}><TickerLink ticker={r.ticker} /></td>
                  {midrun && <td>{fmt(r.officialClose)}</td>}
                  <td>{fmt(r.lastClose)}</td>
                  <td style={{ fontWeight: 560 }}>{fmt(r.impliedClose)}</td>
                  {live && (
                    <td className={r.quote?.change == null ? '' : r.quote.change >= 0 ? 'pos' : 'neg'}
                        title={r.quote ? quoteTitle(r.quote) : 'No quote returned for this name'}>
                      {r.quote ? fmt(r.quote.price) : '—'}
                    </td>
                  )}
                  <td className={up ? 'pos' : 'neg'}>
                    {up ? '+' : ''}{fmt(diff)} ({up ? '+' : ''}{(r.pred * 100).toFixed(2)}%)
                  </td>
                  <td style={{ textAlign: 'center', color: up ? 'var(--good)' : 'var(--critical)' }}>
                    {up ? '▲ UP' : '▼ DOWN'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ margin: '12px 0 0' }}>
        Split- and dividend-adjusted closes. On the newest bar the adjustment factor is 1,
        so these line up with a quote screen. Expected = close × (1 + predicted return); the
        model&rsquo;s predicted moves average about a fifth of a real day&rsquo;s move, so these
        sit close to the last price by construction.
        {live && <> <strong>Live</strong> is the last trade EODHD reported at the moment you
        asked — taken from its real-time socket where a print arrived, and from the REST
        snapshot otherwise (hover any price to see which, and the session it traded in).
        Colour is the move against the previous close. Outside market hours this is simply
        the most recent extended-hours or closing print. It is a sanity check against the
        expected level, not a fill price.</>}
      </p>
    </>
  )
}

const fmt = v => Number.isFinite(v)
  ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '—'

/** The exchange timestamp the quotes carry, which is not when we fetched them. */
const quoteStamp = live => {
  const ts = Object.values(live.quotes || {}).map(q => q.at).filter(Boolean).sort().pop()
  return ts ? new Date(ts).toLocaleString() : 'time unknown'
}

const quoteTitle = q => [
  q.at ? `Last print ${new Date(q.at).toLocaleString()}` : null,
  q.prevClose != null ? `Previous close ${fmt(q.prevClose)}` : null,
  q.change != null ? `Change ${q.change >= 0 ? '+' : ''}${fmt(q.change)} (${q.changePct >= 0 ? '+' : ''}${Number(q.changePct).toFixed(2)}%)` : null,
  q.source === 'ws'
    ? `Real-time trade${q.marketStatus ? ` · ${q.marketStatus.replace('-', ' ')}` : ''}`
    : 'REST snapshot — no trade came over the socket in time',
].filter(Boolean).join(' · ')
