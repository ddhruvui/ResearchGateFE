import { useMemo, useState } from 'react'
import { matchesQuery, sortRows, useSort } from '../hooks.js'
import { pct, pp } from '../format.js'
import TickerLink from './TickerLink.jsx'
import { Disclosure, EmptyRow, Section, Skeleton, SortHeader } from './ui.jsx'

/** Every stock's track record. A table, not a chart: 150 names is past every chart's
 *  series ceiling, and identity here never depends on colour. */
export default function TickerTable ({ rows, loading, query = '', onClearQuery }) {
  const [sort, onSort] = useSort({ key: 'edge', dir: 'desc' })
  const [onlyBeat, setOnlyBeat] = useState(false)
  const list = useMemo(() => rows || [], [rows])

  const view = useMemo(() => sortRows(
    list.filter(r => matchesQuery(r.ticker, query) && (!onlyBeat || r.edge > 0)), sort,
  ), [list, sort, query, onlyBeat])

  const beat = list.filter(r => r.edge > 0).length
  const maxEdge = Math.max(0.0001, ...list.map(r => Math.abs(r.edge)))

  if (loading) return <Section id="stocks" title="Every stock"><Skeleton lines={8} height={300} /></Section>

  return (
    <Section id="stocks" title="Every stock"
             sub={<><b>{beat} of {list.length}</b> beat the always-up baseline.</>}
             tools={<button type="button" className="btn" aria-pressed={onlyBeat} onClick={() => setOnlyBeat(v => !v)}>
               Only those that beat it</button>}>
      <div className="tw">
        <table className="t">
          <thead>
            <tr>
              <SortHeader sort={sort} onSort={onSort} k="ticker">Ticker</SortHeader>
              <SortHeader sort={sort} onSort={onSort} k="n" className="opt" title="Graded next-session calls for this stock">Predictions</SortHeader>
              <SortHeader sort={sort} onSort={onSort} k="accuracy" title="How often the model called up vs down correctly">Direction accuracy</SortHeader>
              <SortHeader sort={sort} onSort={onSort} k="baseline" className="opt" title='How often simply saying "up" every day would have been right'>Always-up baseline</SortHeader>
              <SortHeader sort={sort} onSort={onSort} k="edge" title="Direction accuracy minus the baseline. Above zero means the model added something">Edge</SortHeader>
              <SortHeader sort={sort} onSort={onSort} k="mseRatio" className="opt" title="Model squared error over that of predicting zero. Below 1 is better than no-change">Error vs no-change</SortHeader>
            </tr>
          </thead>
          <tbody>
            {view.length ? view.map(r => {
              const w = (Math.abs(r.edge) / maxEdge) * 50
              return (
                <tr key={r.ticker}>
                  <td><TickerLink ticker={r.ticker} /><span className="sub">always-up {pct(r.baseline)}</span></td>
                  <td className="opt">{r.n.toLocaleString()}</td>
                  <td>{pct(r.accuracy)}</td>
                  <td className="opt">{pct(r.baseline)}</td>
                  <td className={r.edge >= 0 ? 'up-t' : 'down-t'}>
                    {pp(r.edge)}
                    <span className="ebar" aria-hidden="true">
                      <span style={r.edge >= 0
                        ? { left: '50%', width: `${w}%`, background: 'var(--pos)' }
                        : { left: `${50 - w}%`, width: `${w}%`, background: 'var(--neg)' }} />
                    </span>
                  </td>
                  <td className={`opt ${r.mseRatio <= 1 ? 'up-t' : 'down-t'}`}>{r.mseRatio.toFixed(3)}×</td>
                </tr>
              )
            }) : <EmptyRow colSpan={6} query={query} onClear={onClearQuery} />}
          </tbody>
        </table>
      </div>
      <Disclosure summary="What the columns mean">
        <p><strong>Direction accuracy</strong> is how often that stock&rsquo;s up/down call was right.
          Compare it with the <strong>always-up baseline</strong> beside it, the free alternative for that
          same stock; <strong>edge</strong> is the difference.</p>
        <p><strong>Error vs no-change</strong> is the model&rsquo;s squared error over that of predicting
          zero. Below 1 is better than no change. Click any header to sort; hover a header for what it means.</p>
      </Disclosure>
    </Section>
  )
}
