import { describe, expect, it } from 'vitest'
import { dateLong, dateShort, money, num, pct, pp, signed, spct, stopLabel, timeET } from './format.js'
import { withDb } from './api.js'
import { sortRows } from './hooks.js'

const M = '−'

describe('formatters (T30)', () => {
  it('show a dash for missing or non-finite values', () => {
    for (const f of [pct, spct, pp, num, signed, money]) {
      expect(f(null)).toBe('—')
      expect(f(undefined)).toBe('—')
      expect(f(NaN)).toBe('—')
      expect(f(Infinity)).toBe('—')
    }
  })

  it('sign changes and differences, never rates', () => {
    expect(pct(0.510809)).toBe('51.08%')
    expect(spct(0.0123)).toBe('+1.23%')
    expect(spct(-0.0123)).toBe(`${M}1.23%`)
    expect(spct(0)).toBe('+0.00%')
    expect(pp(-0.011830)).toBe(`${M}1.18pp`)
    expect(signed(155.7)).toBe('+155.70')
  })

  it('format money and prices with grouping', () => {
    expect(money(1585844.86)).toBe('$1,585,844.86')
    expect(money(1585844.86, 0)).toBe('$1,585,845')
    expect(money(-42.5)).toBe(`${M}$42.50`)
    expect(num(1234.5)).toBe('1,234.50')
  })

  it('read calendar dates without shifting the day', () => {
    expect(dateLong('2026-11-09')).toBe('Mon, Nov 9')
    expect(dateShort('2026-11-06 00:00:00')).toBe('Nov 6')
    expect(timeET('2026-11-09T12:05:55-05:00')).toBe('12:05 PM ET')
    expect(stopLabel('0.05')).toBe('5%')
  })

  it('withDb adds the EOD database only when asked, to paths with or without a query', () => {
    expect(withDb('/api/summary', 'rg')).toBe('/api/summary')
    expect(withDb('/api/summary', 'eod')).toBe('/api/summary?db=eod')
    expect(withDb('/api/equity?costBps=5', 'eod')).toBe('/api/equity?costBps=5&db=eod')
  })
})

describe('sortRows (T14)', () => {
  const rows = [
    { ticker: 'B', v: 2 }, { ticker: 'A', v: null }, { ticker: 'C', v: 1 }, { ticker: 'D', v: NaN }, { ticker: 'E', v: 3 },
  ]
  it('sorts both ways and keeps missing values at the bottom either way', () => {
    expect(sortRows(rows, { key: 'v', dir: 'desc' }).map(r => r.ticker)).toEqual(['E', 'B', 'C', 'A', 'D'])
    expect(sortRows(rows, { key: 'v', dir: 'asc' }).map(r => r.ticker)).toEqual(['C', 'B', 'E', 'A', 'D'])
  })
  it('sorts text with localeCompare', () => {
    expect(sortRows(rows, { key: 'ticker', dir: 'asc' }).map(r => r.ticker).join('')).toBe('ABCDE')
  })
})
