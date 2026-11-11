import { describe, expect, it } from 'vitest'
import { histogramBins } from './components/RangeHistogram.jsx'
import { rankText, tableScale } from './components/Ranges.jsx'
import { pctSpan } from './format.js'

const stats = (counts, extra = {}) => ({
  binWidth: 0.005, counts, n: counts.reduce((s, c) => s + c, 0),
  p25: 0.02, p75: 0.04, p90: 0.05, p99: 0.08, max: 0.1, ...extra,
})

describe('2-week swing helpers (T35)', () => {
  it('keeps the stored 0.5% bins when they fit, up to the next 5% past the body', () => {
    const counts = Array.from({ length: 20 }, () => 1)          // 0% .. 10%
    const h = histogramBins(stats(counts), 0.03)
    expect(h.bw).toBeCloseTo(0.005)
    expect(h.D).toBeCloseTo(0.1)
    expect(h.bins).toHaveLength(20)
    expect(h.bins.reduce((s, b) => s + b.n, 0)).toBe(20)
    expect(h.over).toBe(false)
  })

  it('merges bins for a volatile stock and folds a freak window into the last bar', () => {
    const counts = Array(460).fill(0)
    counts.forEach((_, k) => { if (k < 120) counts[k] = 2 })     // body: 0-60%
    counts[458] = 1                                              // one 229% fortnight
    const h = histogramBins(stats(counts, { p25: 0.15, p75: 0.37, p90: 0.47, p99: 2.0, max: 2.29 }), 0.39)
    expect(h.bins.length).toBeLessThanOrEqual(48)
    expect(h.D).toBeLessThan(1)                                  // the body, not the outlier
    expect(h.over).toBe(true)
    expect(h.bins.reduce((s, b) => s + b.n, 0)).toBe(241)        // nothing dropped
    expect(h.bins.at(-1).n).toBeGreaterThanOrEqual(1)
  })

  it('always leaves room for the latest window', () => {
    const h = histogramBins(stats(Array(20).fill(1)), 0.31)
    expect(h.D).toBeGreaterThanOrEqual(0.31 * 1.08)
  })

  it('picks the table scale that holds most stocks', () => {
    const rows = n => Array.from({ length: 20 }, (_, i) => ({ p90: i < n ? 0.5 : 0.1, now: 0.05 }))
    expect(tableScale(rows(0))).toBe(0.2)
    expect(tableScale(rows(2))).toBe(0.2)          // a few wide names overflow instead
    expect(tableScale(rows(6))).toBe(0.6)
    expect(tableScale([])).toBe(0.3)
  })

  it('words the rank both ways and names the widest', () => {
    expect(rankText({ below: 0.973, max: 0.5 }, 0.2)).toBe('wider than 97% of them')
    expect(rankText({ below: 0.996, max: 0.5 }, 0.2)).toBe('wider than 99% of them')
    expect(rankText({ below: 0.2, max: 0.5 }, 0.05)).toBe('narrower than 80% of them')
    expect(rankText({ below: 0.996, max: 0.32612 }, 0.32612)).toBe('the widest of them')
    expect(rankText({ below: null }, 0.1)).toBeNull()
  })

  it('formats a span with one percent sign', () => {
    expect(pctSpan(0.054088, 0.093231)).toBe('5.4–9.3%')
    expect(pctSpan(null, 0.1)).toBe('—')
  })
})
