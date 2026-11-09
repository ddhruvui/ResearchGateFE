import { Fragment, useEffect, useMemo, useState } from 'react'
import TickerLink from './TickerLink.jsx'
import { j, withDb } from '../api.js'
import { matchesQuery, sortRows, useSort } from '../hooks.js'
import { dateShort, money, num, pct, spct, stopLabel } from '../format.js'
import StopLossChart from './StopLossChart.jsx'
import { Disclosure, EmptyRow, Section, Segmented, SortHeader, StatStrip } from './ui.jsx'

const TOKEN = { '0.02': 'var(--stop-1)', '0.05': 'var(--stop-2)', '0.08': 'var(--stop-3)' }
export const REASON = {
  target: 'hit the target',
  stop: 'stopped out',
  close: 'held to the close',
  gapped_past_target: 'no trade, gapped past the target',
}

/** The stop levels a strategy payload carries, as "0.02"-style keys. */
export const stopKeys = data => (data?.stops || []).map(s => Number(s).toFixed(2))

/**
 * The $10,000-per-stock paper trade, at three stop levels.
 *
 * The table is the accessible view of the same numbers the chart draws; the chart is
 * fetched per stock on demand because each one carries ~1,400 daily balances per
 * level and the list endpoint deliberately omits them.
 */
export default function StopLoss ({ data, db = 'rg', sel, onSel, query = '', onClearQuery }) {
  const stops = stopKeys(data)
  const stopsKey = stops.join()
  const [sort, onSort, setSort] = useSort({ key: `end_${sel}`, dir: 'desc' })
  const [open, setOpen] = useState(null)
  const [detail, setDetail] = useState({})

  useEffect(() => {                       // fetch a stock's series the first time it opens
    if (!open || detail[open]) return
    let live = true
    j(withDb(`/api/strategy/${open}`, db))
      .then(d => live && setDetail(p => ({ ...p, [open]: d })))
      .catch(e => live && setDetail(p => ({ ...p, [open]: { error: e.message } })))
    return () => { live = false }
  }, [open, detail, db])

  const pickStop = s => {
    onSel(s)
    // Sorting by a balance column follows the selected level.
    setSort(cur => (cur.key.startsWith('end_') ? { key: `end_${s}`, dir: cur.dir } : cur))
  }

  const rows = useMemo(() => sortRows((data.rows || [])
    .filter(r => matchesQuery(r.ticker, query))
    .map(r => {
      const b = r.byStop?.[sel] || {}
      return {
        ticker: r.ticker,
        maxDrawdown: b.maxDrawdown ?? null,
        last: b.last || null,
        // Date first so a ticker whose history stops early still sorts out, then the
        // outcome, which is the part that actually varies on a normal run.
        lastDate: `${b.last?.date ? String(b.last.date).slice(0, 10) : ''} ${b.last?.exit_reason || ''}`,
        lastPct: b.last?.traded ? b.last.pct_change : null,
        // One flat key per stop level so each balance column sorts on its own numbers.
        ...Object.fromEntries(stopsKey.split(',').map(s => [`end_${s}`, r.byStop?.[s]?.end ?? null])),
      }
    }), sort), [data.rows, sel, sort, query, stopsKey])

  const roll = data.rollup?.byStop?.[sel]
  const nT = data.rollup?.nTickers
  const start = data.startCapital ?? 10000
  const cols = 4 + stops.length

  return (
    <Section id="stop-loss" title="$10,000 in each stock, with a stop loss"
             sub="Take the call at the open; out at the target, the stop, or the close, whichever comes first."
             tools={<><span className="tool-label">Stop loss</span>
               <Segmented label="Stop loss" value={sel} onChange={pickStop}
                          options={stops.map(s => ({ value: s, label: stopLabel(s) }))} /></>}>
      {roll && (
        <StatStrip items={[
          { label: `All ${nT} stocks, ${stopLabel(sel)} stop`, value: money(roll.end, 0), delta: `started with ${money(data.rollup.startTotal, 0)}` },
          { label: 'Total return', value: spct(roll.totalReturn, 1),
            delta: roll.totalReturn >= 0 ? 'ahead of where it started' : 'behind where it started', tone: roll.totalReturn >= 0 ? 'pos' : 'neg' },
          { label: 'Stocks that made money', value: `${roll.winners} of ${nT}`,
            delta: `median stock ${spct(roll.medianReturn, 1)}`, tone: roll.winners > nT / 2 ? 'pos' : 'neg' },
          { label: 'Sessions stopped out', value: roll.nStopped.toLocaleString(),
            delta: `of ${roll.nTraded.toLocaleString()} traded · ${roll.nSkipped.toLocaleString()} sat out` },
        ]} />
      )}

      <div className="tw" style={{ marginTop: 14 }}>
        <table className="t">
          <thead>
            <tr>
              <SortHeader sort={sort} onSort={onSort} k="ticker">Stock</SortHeader>
              <SortHeader sort={sort} onSort={onSort} k="lastDate" className="opt opt-md" title="Sort by date, then group by how the session ended">Last session</SortHeader>
              <SortHeader sort={sort} onSort={onSort} k="lastPct" title="How the most recent traded session went, at the selected stop">That day</SortHeader>
              {stops.map(s => (
                <SortHeader key={s} sort={sort} onSort={onSort} k={`end_${s}`} className={`stopcol${s === sel ? ' sel' : ''}`}
                            title={`What ${money(start, 0)} became with a ${stopLabel(s)} stop`}>
                  <span className="swatch-sm" style={{ background: TOKEN[s] }} aria-hidden="true" />{stopLabel(s)} stop
                </SortHeader>
              ))}
              <SortHeader sort={sort} onSort={onSort} k="maxDrawdown" className="opt" title="Largest fall from a peak balance, at the selected stop">Worst dip</SortHeader>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map(r => (
              <Row key={r.ticker} r={r} sel={sel} stops={stops} start={start} cols={cols}
                   open={open === r.ticker} detail={detail[r.ticker]}
                   onToggle={() => setOpen(o => (o === r.ticker ? null : r.ticker))} />
            )) : <EmptyRow colSpan={cols} query={query} onClear={onClearQuery} />}
          </tbody>
        </table>
      </div>

      <Disclosure summary="How the paper trade works">
        <p>A second, harder question than direction: follow every call with real money and a stop loss,
          and where do you end up? Each morning you take the position the model asked for <strong>at the
          opening price</strong>, and you are out again by the closing bell: whichever comes first of the
          model&rsquo;s target price, your stop loss, or the close. When a day touches both the target and
          the stop, daily bars cannot say which came first, so the <strong>stop</strong> is taken; that keeps
          the tight stops honest rather than flattered.</p>
        <p>Every stock starts with <strong>{money(start)}</strong> and compounds on its own; part-shares are
          allowed, so the whole balance is working on every trade, and the balance is rounded down to whole
          cents. Click any stock to chart it. <strong>No trade</strong> means the session opened past the
          price the model was aiming at: the move happened overnight, before an order could be worked, so
          the money sat out. Paper trade: no commission, no borrow cost on the shorts, and every stop is
          assumed to fill exactly at its price, which real stops do not.</p>
      </Disclosure>
    </Section>
  )
}

function Row ({ r, sel, stops, start, cols, open, detail, onToggle }) {
  const L = r.last
  const traded = L?.traded
  const lastTxt = L ? `${dateShort(L.date)} · ${L.direction} · ${REASON[L.exit_reason] || L.exit_reason}` : '—'
  return (
    <Fragment>
      <tr className="clickable" onClick={onToggle}>
        <td>
          <button type="button" className="caret" aria-expanded={open}
                  aria-label={`${open ? 'Hide' : 'Show'} the chart for ${r.ticker}`}
                  onClick={e => { e.stopPropagation(); onToggle() }}>{open ? '▼' : '▶'}</button>
          <TickerLink ticker={r.ticker} />
          <span className="sub sub-md">{lastTxt}</span>
        </td>
        <td className="opt opt-md muted">{lastTxt}</td>
        <td className={!traded ? 'muted' : L.pct_change >= 0 ? 'up-t' : 'down-t'}>
          {!L ? '—' : !traded ? 'no trade' : spct(L.pct_change)}
        </td>
        {stops.map(s => {
          const v = r[`end_${s}`]
          return (
            <td key={s} className={`stopcol${s === sel ? ' sel' : ''} ${v == null ? '' : v >= start ? 'up-t' : 'down-t'}`}>
              {money(v)}
            </td>
          )
        })}
        <td className="opt down-t">{spct(r.maxDrawdown, 1)}</td>
      </tr>
      {open && (
        <tr className="detail">
          <td colSpan={cols}>
            {!detail && <p className="note" style={{ margin: 0 }}>Loading {r.ticker}…</p>}
            {detail?.error && <p className="note err" style={{ margin: 0 }}>{detail.error}</p>}
            {detail?.series && <Detail d={detail} sel={sel} start={start} />}
          </td>
        </tr>
      )}
    </Fragment>
  )
}

function Detail ({ d, sel, start }) {
  const b = d.byStop?.[sel] || {}
  const p = d.pending
  return (
    <>
      <StopLossChart series={d.series} start={start} />
      <StatStrip className="strip-gap" items={[
        { label: `Ended at ${stopLabel(sel)}`, value: money(b.end), delta: spct(b.totalReturn, 1), tone: b.totalReturn >= 0 ? 'pos' : 'neg' },
        { label: 'Days it won', value: pct(b.winRate, 1),
          delta: `${(b.nTraded || 0).toLocaleString()} traded · ${(b.nSkipped || 0).toLocaleString()} sat out` },
        { label: 'How trades ended', value: `${b.nTarget || 0} / ${b.nClose || 0} / ${b.nStopped || 0}`, delta: 'target / close / stopped' },
        { label: 'Best & worst day', value: `${spct(b.bestDay, 1)} / ${spct(b.worstDay, 1)}`, delta: `long ${b.nLong || 0} · short ${b.nShort || 0}` },
      ]} />
      {p && (
        <p className="note" style={{ marginTop: 14 }}>
          <strong>Next up ({dateShort(p.forSession)}):</strong> the model closed {dateShort(p.asOf)} at{' '}
          {num(p.lastClose)} and is aiming at <strong>{num(p.target)}</strong>, so the plan is to go{' '}
          <strong>{p.direction}</strong> with <strong>{money(p.capital?.[sel])}</strong>. If it opens past{' '}
          {num(p.target)} there is no trade.
        </p>
      )}
    </>
  )
}
