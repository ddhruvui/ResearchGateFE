import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { withDb } from './api.js'
import { matchesQuery, useResource, useTheme } from './hooks.js'
import AppBar from './components/AppBar.jsx'
import SectionNav from './components/SectionNav.jsx'
import Hero from './components/Hero.jsx'
import Spotlight from './components/Spotlight.jsx'
import NextSession from './components/NextSession.jsx'
import TickerTable from './components/TickerTable.jsx'
import StopLoss, { stopKeys } from './components/StopLoss.jsx'
import { ByYear, LiveRecord, Returns, Scorecard } from './components/Sections.jsx'

/**
 * The dashboard. One page, answer first: tomorrow's call, the scorecard, then the
 * detail. The app bar and section bar stay pinned; each section loads and fails on
 * its own, so one slow or broken endpoint never blanks the page.
 *
 * The midrun switch. Off (the default, on every load): the ResearchGate database.
 * On: every panel reads the ResearchGateEOD database instead, and "Tomorrow" shows
 * its midrun, the guess made as if IB's price at the time of the midrun were today's
 * close.
 */
export default function App () {
  const [midrun, setMidrun] = useState(false)
  const db = midrun ? 'eod' : 'rg'
  const [query, setQuery] = useState('')
  const clearQuery = useCallback(() => setQuery(''), [])
  const [theme, cycleTheme] = useTheme()
  const [costBps, setCostBps] = useState(0)
  const [stopPick, setStopPick] = useState(null)

  const summary = useResource(withDb('/api/summary', db))
  const tickers = useResource(withDb('/api/tickers', db))
  // None published yet is a note in that section, not a dashboard failure.
  const next = useResource(midrun ? '/api/midrun' : '/api/next-session')
  const equity = useResource(withDb(`/api/equity?costBps=${costBps}`, db), { keep: true })
  // Optional: a run published before src.strategy existed has no stop-loss data.
  // That is not a dashboard failure, so the section simply doesn't appear.
  const strategy = useResource(withDb('/api/strategy', db))

  const stops = stopKeys(strategy.data)
  const stop = stops.includes(stopPick) ? stopPick : (stops[1] || stops[0] || null)

  // Keep the pinned header's height in a CSS variable so jumps land below it.
  const topRef = useRef(null)
  useLayoutEffect(() => {
    const el = topRef.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--top-h', `${el.offsetHeight}px`)
    set()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const universe = useMemo(() => {
    const s = new Set([
      ...(tickers.data || []).map(r => r.ticker),
      ...(next.data?.rows || []).map(r => r.ticker),
    ])
    return [...s].sort()
  }, [tickers.data, next.data])
  const matches = useMemo(() => universe.filter(t => matchesQuery(t, query)), [universe, query])
  // An exact ticker, or a search that narrows to one stock, gets the spotlight.
  const spot = query ? (universe.includes(query) ? query : matches.length === 1 ? matches[0] : null) : null

  const hasLive = summary.data?.liveOnly?.n > 0
  const hasStop = strategy.data?.rows?.length > 0
  const sections = [
    { id: 'tomorrow', label: 'Tomorrow' },
    { id: 'scorecard', label: 'Scorecard' },
    { id: 'returns', label: 'Returns' },
    { id: 'by-year', label: 'By year' },
    { id: 'stocks', label: 'Stocks' },
    ...(hasLive ? [{ id: 'live', label: 'Live record' }] : []),
    ...(hasStop ? [{ id: 'stop-loss', label: 'Stop loss' }] : []),
  ]

  return (
    <>
      <div className="top" ref={topRef}>
        <AppBar query={query} onQuery={setQuery} matches={matches.length} total={universe.length}
                midrun={midrun} onMidrun={setMidrun} theme={theme} onTheme={cycleTheme} />
        <SectionNav sections={sections} topRef={topRef} />
      </div>

      <main className="wrap">
        <Hero summary={summary.data} error={summary.error} midrun={midrun} />

        {spot && (
          <Spotlight ticker={spot} next={next.data} midrun={midrun}
                     record={tickers.data?.find(r => r.ticker === spot)}
                     strategyRow={strategy.data?.rows?.find(r => r.ticker === spot)}
                     stop={stop} startCapital={strategy.data?.startCapital} />
        )}

        <NextSession key={midrun ? 'midrun' : 'official'} data={next.error ? { rows: [], error: next.error } : next.data}
                     loading={next.loading} midrun={midrun} query={query} onClearQuery={clearQuery} />

        <Scorecard summary={summary.data} error={summary.error} onRetry={summary.retry} />
        <Returns equity={equity} costBps={costBps} onCost={setCostBps} />
        <ByYear summary={summary.data} error={summary.error} onRetry={summary.retry} />

        {tickers.error
          ? <section id="stocks" className="sec"><div className="sec-head"><h2>Every stock</h2></div>
              <div className="banner crit" role="alert"><b>The stock table didn&rsquo;t load</b>
                <p>{tickers.error} <button type="button" className="btn" onClick={tickers.retry}>Try again</button></p></div>
            </section>
          : <TickerTable rows={tickers.data} loading={tickers.loading && !tickers.data} query={query} onClearQuery={clearQuery} />}

        <LiveRecord summary={summary.data} />

        {hasStop && (
          <StopLoss key={db} data={strategy.data} db={db} sel={stop} onSel={setStopPick}
                    query={query} onClearQuery={clearQuery} />
        )}
      </main>
    </>
  )
}
