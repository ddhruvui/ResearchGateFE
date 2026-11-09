import { useMemo } from 'react'
import LineChart from './LineChart.jsx'

const SERIES = [
  { label: 'Model', color: 'var(--series-1)', end: v => `${v.toFixed(2)}× model` },
  { label: 'Buy & hold', color: 'var(--series-2)', end: v => `${v.toFixed(2)}× hold` },
]

/** Growth of $1 per stock: following the model against buy and hold, rebased to 1.00×. */
export default function EquityChart ({ points }) {
  const pts = useMemo(() => (points || []).map(p => ({ x: p.date, v: [p.model, p.hold] })), [points])
  return (
    <>
      <div className="legend">
        <span><i style={{ background: 'var(--series-1)' }} />Following the model</span>
        <span><i style={{ background: 'var(--series-2)' }} />Buy &amp; hold</span>
      </div>
      <LineChart points={pts} series={SERIES} refValue={1} yAxisWidth={40}
                 yFmt={v => `${v.toFixed(1)}×`} tipFmt={v => `${v.toFixed(3)}×`}
                 ariaLabel="Growth of 1 dollar per stock, model versus buy and hold" />
    </>
  )
}
