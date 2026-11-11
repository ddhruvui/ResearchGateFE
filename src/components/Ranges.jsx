import { Fragment, useMemo, useState } from 'react'
import TickerLink from './TickerLink.jsx'
import RangeHistogram from './RangeHistogram.jsx'
import { matchesQuery, sortRows, useSort } from '../hooks.js'
import { dateShort, dateYear, num, pct, pctSpan } from '../format.js'
import { Disclosure, EmptyRow, Section, Segmented, SortHeader, StatStrip } from './ui.jsx'

export const PERIODS = [
  { value: '1y', label: 'Past year' },
  { value: 'all', label: 'Since 2021' },
]

/** Shared scale for the table's strips: the smallest of these that holds most rows. */
const SCALES = [0.2, 0.3, 0.4, 0.6]

export function tableScale (rows) {
  const v = rows.map(r => Math.max(r.p90 ?? 0, r.now ?? 0)).filter(x => x > 0).sort((a, b) => a - b)
  if (!v.length) return SCALES[1]
  const q85 = v[Math.min(v.length - 1, Math.floor(v.length * 0.85))]
  return SCALES.find(s => s >= q85) ?? SCALES[SCALES.length - 1]
}

/** "wider than 97% of them", "narrower than 80%", or "the widest of them". */
export function rankText (s, now) {
  if (s?.below == null || now == null) return null
  if (s.max != null && now >= s.max - 1e-9) return 'the widest of them'
  return s.below >= 0.5
    ? `wider than ${Math.min(99, Math.round(s.below * 100))}% of them`
    : `narrower than ${Math.min(99, Math.round((1 - s.below) * 100))}% of them`
}

const periodWords = (period, s, start) => {
  if (period === '1y') return 'in the past year'
  return s?.since && s.since > start ? `since ${dateYear(s.since)}` : 'since 2021'
}

/**
 * The 2-week swing: for every stock, how far it moved from its lowest low to its
 * highest high over the last 10 sessions, against how far it usually moves.
 *
 * The question it answers is "what swing should I expect?", which is a question
 * about a distribution, so the per-stock view is a histogram of every past window,
 * not a line over time. The table row is that histogram squeezed flat.
 */
export default function Ranges ({ data, query = '', onClearQuery }) {
  const [period, setPeriod] = useState('1y')
  const [sort, onSort] = useSort({ key: 'below', dir: 'desc' })
  const [open, setOpen] = useState(null)
  const start = data.periods?.all?.since || '2021-01-04'

  const all = useMemo(() => (data.rows || []).map(r => {
    const s = r.periods?.[period] || null
    const now = r.now?.range ?? null
    return {
      ticker: r.ticker, src: r, s, now, stale: !!r.stale, lastBar: r.lastBar, note: r.note,
      p10: s?.p10 ?? null, p25: s?.p25 ?? null, typical: s?.p50 ?? null, p75: s?.p75 ?? null,
      p90: s?.p90 ?? null, below: now != null ? (s?.below ?? null) : null,
    }
  }), [data.rows, period])

  const D = useMemo(() => tableScale(all), [all])
  const view = useMemo(() => sortRows(all.filter(r => matchesQuery(r.ticker, query)), sort), [all, query, sort])
  const wide = all.filter(r => r.below != null && r.below >= 0.9).length
  const counted = all.filter(r => r.below != null).length
  const X = v => `${Math.min(100, (v / D) * 100)}%`

  const tools = <>
    <span className="tool-label">Compared with</span>
    <Segmented label="Compare the latest 10 sessions with" value={period} onChange={setPeriod} options={PERIODS} />
  </>

  return (
    <Section id="range" title={<>How far each stock swings in 2 weeks{data.asOf && <span className="when"> · to {dateShort(data.asOf)}</span>}</>}
             sub={<>Highest high to lowest low over 10 sessions, against every 10-session window in the stock&rsquo;s own
               history. <b>{wide} of {counted}</b> are swinging wider than 9 in 10 of their windows {period === '1y' ? 'in the past year' : 'since 2021'}.</>}
             tools={tools}>
      <div className="legend">
        <span><i className="sq" style={{ background: 'var(--accent)' }} />Half the time</span>
        <span><i style={{ background: 'var(--range-rest)' }} />8 times in 10</span>
        <span><i className="dot" style={{ background: 'var(--ink)' }} />Latest 10 sessions</span>
      </div>
      <div className="tw">
        <table className="t">
          <thead>
            <tr>
              <SortHeader sort={sort} onSort={onSort} k="ticker">Stock</SortHeader>
              <th className="plain swingcol" title={`Shared scale, 0 to ${Math.round(D * 100)}%; a pointer at the edge means wider than that`}>
                2-week swing
                <div className="swing-scale" aria-hidden="true">
                  <span style={{ left: 0 }}>0%</span><span style={{ left: '50%' }}>{Math.round(D * 50)}%</span>
                  <span style={{ left: '100%' }}>{Math.round(D * 100)}%</span>
                </div>
              </th>
              <SortHeader sort={sort} onSort={onSort} k="now" title="Highest high to lowest low over the latest 10 sessions">Latest</SortHeader>
              <SortHeader sort={sort} onSort={onSort} k="typical" className="opt"
                          title="The middle half of the stock's 10-session windows in the period (25th to 75th percentile); sorts by the typical one">Half the time</SortHeader>
              <SortHeader sort={sort} onSort={onSort} k="below"
                          title="Share of the period's 10-session windows that were narrower than the latest one">Wider than</SortHeader>
            </tr>
          </thead>
          <tbody>
            {view.length ? view.map(r => (
              <Row key={r.ticker} r={r} X={X} D={D} open={open === r.ticker} period={period} start={start}
                   onToggle={() => setOpen(o => (o === r.ticker ? null : r.ticker))} />
            )) : <EmptyRow colSpan={5} query={query} onClear={onClearQuery} />}
          </tbody>
        </table>
      </div>
      <Disclosure>
        <p>A stock&rsquo;s <strong>2-week swing</strong> is its highest high divided by its lowest low over 10
          trading sessions, minus one: how far it travelled from the bottom of the fortnight to the top. Prices
          are split-adjusted, so a split inside the window is not counted as a move.</p>
        <p>Every session ends a new 10-session window, so each stock has one window per day: about 252 in a year
          and about 1,470 since 2021. The <strong>blue part</strong> is where the middle half of them landed and the
          thin grey line where 8 in 10 did; the dot is the latest 10 sessions. <strong>Wider than</strong> is the
          share of the stock&rsquo;s windows that were narrower than the latest one.</p>
        <p>Neighbouring windows share 9 of their 10 sessions, so a year of windows holds only about 25 separate
          fortnights; the edges of a one-year picture rest on a handful of them. And it describes the past, not
          the next two weeks: an earnings date inside the coming window can make it far wider than usual.</p>
      </Disclosure>
    </Section>
  )
}

function Row ({ r, X, D, open, period, start, onToggle }) {
  const has = r.now != null && r.s
  const p = r.below
  const rank = p == null ? '—'
    : p >= 0.9 ? <span className="pill acc">{Math.min(99, Math.round(p * 100))}%</span>
      : <span className={p <= 0.1 ? 'muted' : undefined}>{Math.round(p * 100)}%</span>
  const half = pctSpan(r.p25, r.p75)
  return (
    <Fragment>
      <tr className={has ? 'clickable' : undefined} onClick={has ? onToggle : undefined}>
        <td>
          {has
            ? <button type="button" className="caret" aria-expanded={open}
                      aria-label={`${open ? 'Hide' : 'Show'} the swing chart for ${r.ticker}`}
                      onClick={e => { e.stopPropagation(); onToggle() }}>{open ? '▼' : '▶'}</button>
            : <span className="caret" aria-hidden="true" />}
          <TickerLink ticker={r.ticker} />
          {r.stale && <span className="late" title="This stock's bars end before the rest of the universe's">bars end {dateShort(r.lastBar)}</span>}
          {has && <span className="sub">usually {half}</span>}
        </td>
        <td className="swingcol">
          {has
            ? <div className="swing" title={`8 in 10: ${pctSpan(r.p10, r.p90)} · half: ${half} · typical ${pct(r.typical, 1)} · latest ${pct(r.now, 1)}`}>
                <i className="wk" style={{ left: X(r.p10), width: `calc(${X(r.p90)} - ${X(r.p10)})` }} />
                <i className="bo" style={{ left: X(r.p25), width: `calc(${X(r.p75)} - ${X(r.p25)})` }} />
                <i className="md" style={{ left: X(r.typical) }} />
                <i className={`nw${r.now > D ? ' over' : ''}`} style={{ left: X(r.now) }} />
              </div>
            : <span className="muted">{r.note || 'no history'}</span>}
        </td>
        <td className={has ? 'strong' : 'muted'}>{has ? pct(r.now, 1) : '—'}</td>
        <td className="opt">{has ? half : '—'}</td>
        <td>{rank}</td>
      </tr>
      {open && has && (
        <tr className="detail">
          <td colSpan={5}><Detail r={r} period={period} start={start} /></td>
        </tr>
      )}
    </Fragment>
  )
}

function Detail ({ r, period, start }) {
  const s = r.s
  const n = r.src.now
  const when = periodWords(period, s, start)
  const rank = rankText(s, r.now)
  return (
    <>
      <p className="range-verdict">
        Half of <b>{r.ticker}</b>&rsquo;s 10-session windows {when} swung <b>{pctSpan(s.p25, s.p75)}</b> from
        low to high, and 9 in 10 stayed under <b>{pct(s.p90, 1)}</b>. The latest 10 sessions
        ({dateShort(n.from)} – {dateShort(n.date)}) swung <b>{pct(r.now, 1)}</b>{rank ? `, ${rank}` : ''}.
      </p>
      <div className="panel">
        <div className="legend">
          <span><i className="sq" style={{ background: 'var(--accent)' }} />Half the time</span>
          <span><i className="sq" style={{ background: 'var(--range-rest)' }} />The rest</span>
          <span><i style={{ width: 2, height: 12, background: 'var(--ink)' }} />Latest 10 sessions</span>
          <span className="muted">Bar height: share of all {s.n.toLocaleString()} windows</span>
        </div>
        <RangeHistogram stats={s} now={r.now} ticker={r.ticker} />
      </div>
      <StatStrip className="strip-gap" items={[
        { label: 'Typical swing', value: pct(s.p50, 1), delta: `the median window ${when}` },
        { label: 'Half the time', value: pctSpan(s.p25, s.p75), delta: '25th to 75th percentile' },
        { label: '8 times in 10', value: pctSpan(s.p10, s.p90), delta: '10th to 90th percentile' },
        { label: `${dateShort(n.from)} – ${dateShort(n.date)}`, value: pct(r.now, 1),
          delta: `low ${num(n.low)} ${dateShort(n.lowDate)} · high ${num(n.high)} ${dateShort(n.highDate)}` },
      ]} />
      <p className="note">{s.n.toLocaleString()} windows ending {dateYear(s.since)} to {dateYear(s.until)}; the widest
        was {pct(s.max, 1)}, ending {dateYear(s.maxDate)}.</p>
    </>
  )
}
