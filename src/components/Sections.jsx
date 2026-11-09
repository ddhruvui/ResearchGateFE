import { MINUS, pct, pp, spct, times } from '../format.js'
import EquityChart from './EquityChart.jsx'
import YearEdgeChart from './YearEdgeChart.jsx'
import { Disclosure, Section, SectionError, Segmented, Skeleton, StatStrip } from './ui.jsx'

export const COSTS = [0, 1, 5, 10]

/** Scorecard: the verdict first, as a sentence, then the four numbers behind it. */
export function Scorecard ({ summary, error, onRetry }) {
  if (error) return <Section id="scorecard" title="Scorecard"><SectionError what="The scorecard" error={error} onRetry={onRetry} /></Section>
  if (!summary) return <Section id="scorecard" title="Scorecard"><Skeleton lines={4} height={180} /></Section>
  const o = summary.overall
  const beats = o.edge_vs_always_up > 0
  const mse = o.mse_model / o.mse_zero_baseline
  return (
    <Section id="scorecard" title="Scorecard"
             sub={`${o.n.toLocaleString()} graded next-session calls across ${summary.nTickers} stocks.`}>
      <div className="verdict">
        <p>The model calls direction right <b>{pct(o.direction_accuracy)}</b> of the time.
          Saying &ldquo;up&rdquo; every day is right <b>{pct(o.baseline_always_up)}</b> of the time.</p>
        <span className={`pill ${beats ? 'pos' : 'neg'}`}>
          {beats ? '▲ Ahead of' : '▼ Behind'} the free baseline by {Math.abs(o.edge_vs_always_up * 100).toFixed(2)}pp
        </span>
      </div>
      <StatStrip items={[
        { label: 'Direction accuracy', value: pct(o.direction_accuracy),
          delta: <>vs coin flip 50.00% · <span style={{ whiteSpace: 'nowrap' }}>p = {Number(o.p_value_vs_coin).toExponential(1).replace('-', MINUS)}</span></>,
          tone: 'pos' },
        { label: 'Always-up baseline', value: pct(o.baseline_always_up), delta: 'the free alternative' },
        { label: 'Edge over baseline', value: pp(o.edge_vs_always_up),
          delta: beats ? 'model wins' : 'model loses', tone: beats ? 'pos' : 'neg' },
        { label: 'Error vs predicting zero', value: `${mse.toFixed(3)}×`,
          delta: mse <= 1 ? 'better than no-change' : 'worse than no-change', tone: mse <= 1 ? 'pos' : 'neg' },
      ]} />
      <Disclosure summary="Reading this">
        <p>The model beats a coin flip with an overwhelming p-value, and that is the wrong benchmark.
          Stocks drift up, so predicting &ldquo;up&rdquo; every day earns <strong>{pct(o.baseline_always_up)}</strong> for
          free, and the model reaches <strong>{pct(o.direction_accuracy)}</strong>, leaving it{' '}
          <strong className={beats ? 'up-t' : 'down-t'}>{pp(o.edge_vs_always_up)}</strong>{' '}
          {beats ? 'ahead of' : 'behind'} the free alternative.</p>
        <p>Its squared error is <strong>{mse.toFixed(3)}×</strong> that of simply predicting no change.
          The equity curve below says the same thing in money.</p>
      </Disclosure>
    </Section>
  )
}

/** $1 per stock: following the model against buy and hold, at a chosen trading cost. */
export function Returns ({ equity, costBps, onCost }) {
  const st = equity.data?.stats
  const tools = <>
    <span className="tool-label">Cost per switch</span>
    <Segmented label="Trading cost per switch" value={costBps} onChange={onCost}
               options={COSTS.map(c => ({ value: c, label: c === 0 ? 'None' : `${c} bps` }))} />
  </>
  const ahead = st && st.modelFinal >= st.holdFinal
  return (
    <Section id="returns" title="$1 in each stock, following the model"
             sub="Hold on days it predicts up, cash otherwise, against buy and hold." tools={tools}>
      {equity.error && !equity.data
        ? <SectionError what="The equity curve" error={equity.error} onRetry={equity.retry} />
        : !equity.data
          ? <Skeleton lines={6} height={300} />
          : (
            <>
              <div className={`panel${equity.loading ? ' busy' : ''}`} aria-busy={equity.loading}>
                <EquityChart points={equity.data.points} />
              </div>
              <StatStrip className="strip-gap" items={[
                { label: 'Model, final', value: times(st.modelFinal), delta: `${(st.modelCagr * 100).toFixed(1)}% a year` },
                { label: 'Buy & hold, final', value: times(st.holdFinal), delta: `${(st.holdCagr * 100).toFixed(1)}% a year` },
                { label: 'Model vs hold', value: spct(st.modelFinal / st.holdFinal - 1, 1),
                  delta: ahead ? 'ahead' : 'behind', tone: ahead ? 'pos' : 'neg' },
                { label: 'Switches per stock', value: Math.round(st.tradesPerTicker).toLocaleString(), delta: 'each one pays the cost above' },
              ]} />
            </>
          )}
      <Disclosure>
        <p>Hold the share on days the model predicts up; sit in cash otherwise. Equal weight across every
          name, rebased to 1.00×. Buy &amp; hold is the same dollar left invested throughout: it is what the
          always-up baseline looks like as money.</p>
      </Disclosure>
    </Section>
  )
}

/** Edge over the baseline, split by calendar year. */
export function ByYear ({ summary, error, onRetry }) {
  return (
    <Section id="by-year" title="Edge over the always-up baseline, by year"
             sub={'Above zero means the model beat saying "up" every day that year.'}>
      {error ? <SectionError what="The yearly split" error={error} onRetry={onRetry} />
        : !summary ? <Skeleton lines={5} height={230} />
          : <div className="panel"><YearEdgeChart rows={summary.byYear} /></div>}
      <Disclosure summary="Why by year">
        <p>Above zero means the model called direction better than simply saying &ldquo;up&rdquo; every day.
          A pooled average can hide a model that only works in calm markets, so it is split by year.</p>
      </Disclosure>
    </Section>
  )
}

/** Only the calls made in advance and graded the next day. */
export function LiveRecord ({ summary }) {
  const L = summary?.liveOnly
  if (!(L?.n > 0)) return null
  const ahead = L.edge_vs_always_up > 0
  return (
    <Section id="live" title="Live track record"
             sub={<>Only predictions the model actually made in advance and had graded the next day:{' '}
               <b>{L.n.toLocaleString()}</b> of {(summary.bySource?.backtest || 0).toLocaleString()} replayed rows.
               This is the honest forward record; the replay above is a rehearsal.</>}>
      <StatStrip cols={3} items={[
        { label: 'Live direction accuracy', value: pct(L.direction_accuracy), delta: `${L.n.toLocaleString()} graded live` },
        { label: 'Always-up baseline', value: pct(L.baseline_always_up), delta: 'same days, free alternative' },
        { label: 'Live edge', value: pp(L.edge_vs_always_up), delta: ahead ? 'ahead' : 'behind', tone: ahead ? 'pos' : 'neg' },
      ]} />
    </Section>
  )
}
