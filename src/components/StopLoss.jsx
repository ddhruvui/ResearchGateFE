import { useEffect, useMemo, useState } from 'react'
import { j } from '../api.js'
import StatTile from './StatTile.jsx'
import StopLossChart from './StopLossChart.jsx'

const TOKEN = { '0.02': 'var(--stop-1)', '0.05': 'var(--stop-2)', '0.08': 'var(--stop-3)' }
const REASON = {
  target: 'hit the target',
  stop: 'stopped out',
  close: 'held to the close',
  gapped_past_target: 'no trade — gapped past the target',
}

/**
 * The $10,000-per-stock paper trade, at three stop levels.
 *
 * The table is the accessible view of the same numbers the chart draws; the
 * chart is fetched per stock on demand because each one carries ~1,400 daily
 * balances per level and the list endpoint deliberately omits them.
 */
export default function StopLoss ({ data }) {
  const stops = (data.stops || []).map(s => s.toFixed(2))
  const [sel, setSel] = useState(stops[1] || stops[0])
  const [sort, setSort] = useState({ key: 'end', dir: 'desc' })
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [detail, setDetail] = useState({})

  useEffect(() => {                       // fetch a stock's series the first time it opens
    if (!open || detail[open]) return
    let live = true
    j(`/api/strategy/${open}`)
      .then(d => live && setDetail(p => ({ ...p, [open]: d })))
      .catch(e => live && setDetail(p => ({ ...p, [open]: { error: e.message } })))
    return () => { live = false }
  }, [open, detail])

  const rows = useMemo(() => {
    const f = q.trim().toUpperCase()
    const out = (data.rows || [])
      .filter(r => !f || r.ticker.includes(f))
      .map(r => {
        const b = r.byStop?.[sel] || {}
        return {
          ticker: r.ticker,
          end: b.end ?? 0,
          totalReturn: b.totalReturn ?? 0,
          winRate: b.winRate,
          nStopped: b.nStopped ?? 0,
          maxDrawdown: b.maxDrawdown ?? 0,
          last: b.last || null,
          lastPct: b.last?.traded ? b.last.pct_change : null,
          pending: r.pending || null,
          ends: Object.fromEntries(stops.map(s => [s, r.byStop?.[s]?.end ?? null])),
        }
      })
    const { key, dir } = sort
    return out.sort((a, b) => (dir === 'asc' ? 1 : -1) *
      (typeof a[key] === 'string' ? a[key].localeCompare(b[key]) : (a[key] ?? 0) - (b[key] ?? 0)))
  }, [data.rows, sel, sort, q, stops])

  const roll = data.rollup?.byStop?.[sel]
  const start = data.startCapital ?? 10000
  const th = (key, label, title) => (
    <th title={title || 'Click to sort'}
        onClick={() => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}>
      {label}{sort.key === key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )

  return (
    <>
      <div className="controls">
        <label>Stop loss</label>
        {stops.map(s => (
          <button key={s} className="seg" aria-pressed={sel === s} onClick={() => setSel(s)}>
            {(Number(s) * 100).toFixed(0)}%
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter ticker…"
               style={{
                 font: 'inherit', fontSize: 13, padding: '6px 10px', borderRadius: 7,
                 border: '1px solid var(--border)', background: 'transparent',
                 color: 'var(--text-primary)', width: 130,
               }} />
      </div>

      {roll && (
        <div className="kpis" style={{ marginBottom: 18 }}>
          <StatTile label={`All ${data.rollup.nTickers} stocks, ${(Number(sel) * 100).toFixed(0)}% stop`}
                    value={money(roll.end)}
                    delta={`started with ${money(data.rollup.startTotal)}`} />
          <StatTile label="Total return" value={pct(roll.totalReturn)}
                    delta={roll.totalReturn >= 0 ? 'ahead of where it started' : 'behind where it started'}
                    tone={roll.totalReturn >= 0 ? 'pos' : 'neg'} />
          <StatTile label="Stocks that made money"
                    value={`${roll.winners} of ${data.rollup.nTickers}`}
                    delta={`median stock ${pct(roll.medianReturn)}`}
                    tone={roll.winners > data.rollup.nTickers / 2 ? 'pos' : 'neg'} />
          <StatTile label="Sessions stopped out" value={roll.nStopped.toLocaleString()}
                    delta={`of ${roll.nTraded.toLocaleString()} traded · ${roll.nSkipped.toLocaleString()} sat out`} />
        </div>
      )}

      <div className="scroll">
        <table>
          <thead>
            <tr>
              {th('ticker', 'Stock')}
              <th title="The most recent session this stock traded, and how it ended">Last session</th>
              {th('lastPct', 'That day', 'How the most recent traded session went')}
              {stops.map(s => (
                <th key={s} onClick={() => setSel(s)}
                    style={{
                      cursor: 'pointer',
                      color: sel === s ? 'var(--text-primary)' : undefined,
                      fontWeight: sel === s ? 640 : undefined,
                    }}
                    title={`What $${start.toLocaleString()} became with a ${(Number(s) * 100).toFixed(0)}% stop`}>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                    background: TOKEN[s], marginRight: 6, verticalAlign: 'middle',
                  }} />
                  {(Number(s) * 100).toFixed(0)}% stop
                </th>
              ))}
              {th('maxDrawdown', 'Worst dip', 'Largest fall from a peak balance, at the selected stop')}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <Row key={r.ticker} r={r} sel={sel} stops={stops} start={start}
                   open={open === r.ticker} detail={detail[r.ticker]}
                   onToggle={() => setOpen(o => (o === r.ticker ? null : r.ticker))} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="note" style={{ margin: '12px 0 0' }}>
        Every stock starts with <strong>{money(start)}</strong> and compounds on its own; part-shares
        are allowed, so the whole balance is working on every trade, and the balance is rounded down
        to whole cents. Click any stock to chart it. <strong>No trade</strong> means the session
        opened past the price the model was aiming at — the move happened overnight, before an order
        could be worked, so the money sat out. Paper trade: no commission, no borrow cost on the
        shorts, and every stop is assumed to fill exactly at its price, which real stops do not.
      </p>
    </>
  )
}

function Row ({ r, sel, stops, start, open, detail, onToggle }) {
  const L = r.last
  const traded = L?.traded
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td style={{ fontWeight: 560 }}>
          <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{open ? '▾' : '▸'}</span>
          {r.ticker}
        </td>
        <td style={{ color: 'var(--text-secondary)' }}>
          {L ? `${L.date?.slice(0, 10)} · ${L.direction} · ${REASON[L.exit_reason] || L.exit_reason}` : '—'}
        </td>
        <td className={!traded ? '' : L.pct_change >= 0 ? 'pos' : 'neg'}>
          {!L ? '—' : !traded ? <span style={{ color: 'var(--text-muted)' }}>no trade</span>
            : `${L.pct_change >= 0 ? '+' : ''}${(L.pct_change * 100).toFixed(2)}%`}
        </td>
        {stops.map(s => (
          <td key={s} style={{ fontWeight: sel === s ? 640 : 400 }}
              className={r.ends[s] == null ? '' : r.ends[s] >= start ? 'pos' : 'neg'}>
            {money(r.ends[s])}
          </td>
        ))}
        <td className="neg">{pct(r.maxDrawdown)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4 + stops.length} style={{ background: 'var(--plane)', padding: '16px 14px' }}>
            {!detail && <p className="note" style={{ margin: 0 }}>Loading {r.ticker}…</p>}
            {detail?.error && (
              <p className="note" style={{ margin: 0, color: 'var(--critical)' }}>{detail.error}</p>
            )}
            {detail?.series && <Detail d={detail} sel={sel} start={start} />}
          </td>
        </tr>
      )}
    </>
  )
}

function Detail ({ d, sel, start }) {
  const b = d.byStop?.[sel] || {}
  const p = d.pending
  return (
    <>
      <StopLossChart series={d.series} start={start} />
      <div className="kpis" style={{ marginTop: 16, marginBottom: 0 }}>
        <StatTile label={`Ended at ${(Number(sel) * 100).toFixed(0)}%`} value={money(b.end)}
                  delta={pct(b.totalReturn)} tone={b.totalReturn >= 0 ? 'pos' : 'neg'} />
        <StatTile label="Days it won" value={rate(b.winRate)}
                  delta={`${(b.nTraded || 0).toLocaleString()} traded · ${(b.nSkipped || 0).toLocaleString()} sat out`} />
        <StatTile label="How trades ended"
                  value={`${b.nTarget || 0} / ${b.nClose || 0} / ${b.nStopped || 0}`}
                  delta="target / close / stopped" />
        <StatTile label="Best & worst day"
                  value={`${pct(b.bestDay, 1)} / ${pct(b.worstDay, 1)}`}
                  delta={`long ${b.nLong || 0} · short ${b.nShort || 0}`} />
      </div>
      {p && (
        <p className="note" style={{ margin: '14px 0 0' }}>
          <strong>Next up ({p.forSession}):</strong> the model closed {p.asOf} at{' '}
          {p.lastClose?.toFixed(2)} and is aiming at <strong>{p.target?.toFixed(2)}</strong>, so the
          plan is to go <strong>{p.direction}</strong> with{' '}
          <strong>{money(p.capital?.[sel])}</strong>. If it opens past{' '}
          {p.target?.toFixed(2)} there is no trade.
        </p>
      )}
    </>
  )
}

const money = v => Number.isFinite(v)
  ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : '—'
/** A rate is not a change, so it never carries a +/- sign. */
const rate = v => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—')
const pct = (v, dp = 1) => Number.isFinite(v)
  ? `${v >= 0 ? '+' : ''}${(v * 100).toFixed(dp)}%`
  : '—'
