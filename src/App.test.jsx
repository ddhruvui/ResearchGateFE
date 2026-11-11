import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'
import { deferred, fixtures, mockApi } from './test/api.js'

const M = '−'
const section = id => document.getElementById(id)
const tableIn = id => within(section(id)).getByRole('table')
/** Data rows only: no header, no expanded detail row, no empty-state row. */
const rowsIn = id => within(tableIn(id)).getAllByRole('row').slice(1)
  .filter(r => !r.classList.contains('detail') && !r.querySelector('td.empty'))
const tickersIn = id => rowsIn(id).map(r => within(r).getAllByRole('link')[0].textContent)
const search = () => screen.getByRole('searchbox', { name: /search stock/i })

async function setup (overrides) {
  const api = mockApi(overrides)
  const user = userEvent.setup()
  render(<App />)
  await waitFor(() => {
    expect(rowsIn('tomorrow')).toHaveLength(151)
    expect(rowsIn('stocks')).toHaveLength(151)
    expect(rowsIn('stop-loss')).toHaveLength(6)
    expect(rowsIn('range')).toHaveLength(6)
  })
  return { api, user }
}

/** Move focus to the page itself, the way clicking empty space does. */
const blur = () => act(() => { document.activeElement?.blur() })

describe('page structure', () => {
  it('puts tomorrow first and lists every section in the section bar (T21)', async () => {
    await setup()
    const ids = [...document.querySelectorAll('main section.sec')].map(s => s.id)
    expect(ids).toEqual(['tomorrow', 'scorecard', 'returns', 'by-year', 'stocks', 'live', 'range', 'stop-loss'])
    const nav = screen.getByRole('navigation', { name: 'Dashboard sections' })
    expect(within(nav).getAllByRole('link').map(a => a.textContent))
      .toEqual(['Tomorrow', 'Scorecard', 'Returns', 'By year', 'Stocks', 'Live record', '2-week swing', 'Stop loss'])
  })

  it('jumps to a section from the section bar and marks it current (T21)', async () => {
    const { user } = await setup()
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    const nav = screen.getByRole('navigation', { name: 'Dashboard sections' })
    await user.click(within(nav).getByRole('link', { name: 'Stop loss' }))
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.contexts.at(-1)).toBe(section('stop-loss'))
    expect(within(nav).getByRole('link', { name: 'Stop loss' })).toHaveAttribute('aria-current', 'true')
  })

  it('leads the scorecard with the verdict', async () => {
    await setup()
    const s = within(section('scorecard'))
    expect(s.getByText(/Behind the free baseline by 1\.18pp/)).toBeInTheDocument()
    expect(s.getByText('51.08%', { selector: 'b' })).toBeInTheDocument()
    expect(s.getByText('Edge over baseline').closest('.tile')).toHaveTextContent(`${M}1.18pp`)
  })
})

describe('search', () => {
  it('takes letters typed anywhere and filters all three tables (T01)', async () => {
    const { user } = await setup()
    blur()
    await user.keyboard('amd')
    expect(search()).toHaveValue('AMD')
    expect(search()).toHaveFocus()
    expect(tickersIn('tomorrow')).toEqual(['AMD'])
    expect(tickersIn('stocks')).toEqual(['AMD'])
    expect(tickersIn('stop-loss')).toEqual(['AMD'])
    expect(tickersIn('range')).toEqual(['AMD'])
  })

  it('clears with Esc and with the clear button, which keeps focus (T02)', async () => {
    const { user } = await setup()
    await user.type(search(), 'nv')
    expect(rowsIn('stocks').length).toBeLessThan(151)
    await user.keyboard('{Escape}')
    expect(search()).toHaveValue('')
    expect(rowsIn('stocks')).toHaveLength(151)

    await user.type(search(), 'nv')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(search()).toHaveValue('')
    expect(search()).toHaveFocus()
    expect(rowsIn('tomorrow')).toHaveLength(151)
  })

  it('leaves keys typed into another field alone (T03)', async () => {
    const { user } = await setup()
    const other = document.createElement('input')
    document.body.appendChild(other)
    await user.click(other)
    await user.keyboard('xyz')
    expect(other).toHaveValue('xyz')
    expect(search()).toHaveValue('')
    other.remove()
  })

  it('jumps to the search with / and Ctrl+K without typing into it (T04)', async () => {
    const { user } = await setup()
    blur()
    await user.keyboard('/')
    expect(search()).toHaveFocus()
    expect(search()).toHaveValue('')
    blur()
    await user.keyboard('{Control>}k{/Control}')
    expect(search()).toHaveFocus()
    expect(search()).toHaveValue('')
  })

  it('counts matches and shows an empty state with a way out (T05)', async () => {
    const { user } = await setup()
    await user.type(search(), 'am')
    expect(screen.getByText('5 of 151')).toBeInTheDocument()
    await user.clear(search())
    await user.type(search(), 'zzz')
    expect(screen.getByText('0 of 151')).toBeInTheDocument()
    for (const id of ['tomorrow', 'stocks', 'stop-loss']) {
      expect(within(section(id)).getByText(/No stock matches/)).toBeInTheDocument()
    }
    await user.click(within(section('stocks')).getByRole('button', { name: 'Clear search' }))
    expect(search()).toHaveValue('')
    expect(rowsIn('stocks')).toHaveLength(151)
  })

  it('opens a spotlight for one stock, and only one (T06)', async () => {
    const { user } = await setup()
    await user.type(search(), 'aapl')
    const spot = screen.getByRole('region', { name: 'AAPL at a glance' })
    expect(within(spot).getByText(/\+0\.15%/)).toBeInTheDocument()
    expect(within(spot).getByText('49.66%')).toBeInTheDocument()
    expect(within(spot).getByText('$20,685.96')).toBeInTheDocument()

    await user.clear(search())
    await user.type(search(), 'am')
    expect(screen.queryByRole('region', { name: /at a glance/ })).not.toBeInTheDocument()

    await user.clear(search())
    await user.type(search(), 'crw')
    expect(screen.getByRole('region', { name: 'CRWD at a glance' })).toBeInTheDocument()
  })
})

describe('data source and loading', () => {
  it('reads ResearchGateEOD and the midrun when Midrun is on, and not after (T07)', async () => {
    const { api, user } = await setup()
    api.calls.length = 0
    await user.click(screen.getByRole('button', { name: 'Midrun' }))
    await waitFor(() => expect(within(section('tomorrow')).getByRole('heading', { level: 2 })).toHaveTextContent('Tue, Nov 10 · midrun'))
    expect(api.calls).toEqual(expect.arrayContaining([
      '/api/midrun', '/api/summary?db=eod', '/api/tickers?db=eod', '/api/strategy?db=eod', '/api/equity?costBps=0&db=eod',
    ]))
    expect(screen.getByText('Midrun: reading ResearchGateEOD')).toBeInTheDocument()
    expect(within(tableIn('tomorrow')).getByRole('button', { name: /Close Nov 6/ })).toBeInTheDocument()

    api.calls.length = 0
    await user.click(screen.getByRole('button', { name: 'Official' }))
    await waitFor(() => expect(api.calls).toContain('/api/next-session'))
    expect(api.calls).toContain('/api/summary')
    expect(api.calls.some(c => c.includes('db=eod'))).toBe(false)
  })

  it('explains a missing midrun inside its section and keeps the rest (T08)', async () => {
    const { user } = await setup({ '/api/midrun': () => ({ status: 404, body: { error: 'no midrun' } }) })
    await user.click(screen.getByRole('button', { name: 'Midrun' }))
    expect(await screen.findByText(/No midrun published yet/)).toBeInTheDocument()
    await waitFor(() => expect(within(section('scorecard')).getByText(/Behind the free baseline/)).toBeInTheDocument())
  })

  it('names the failing path and the API base when the summary fails (T09)', async () => {
    mockApi({ '/api/summary': () => ({ status: 500, body: { error: 'mongo down' } }) })
    render(<App />)
    const alert = await screen.findByText('The API did not answer')
    const box = alert.closest('[role="alert"]')
    expect(box).toHaveTextContent('/api/summary')
    expect(box).toHaveTextContent('mongo down')
    expect(box).toHaveTextContent('same origin, dev proxy')
  })

  it('keeps a failing section to itself and retries it (T10)', async () => {
    let fail = true
    mockApi({ '/api/equity': () => (fail ? { status: 500, body: { error: 'boom' } } : { status: 200, body: fixtures.equity0 }) })
    const user = userEvent.setup()
    render(<App />)
    const returns = () => within(section('returns'))
    expect(await returns().findByText(/The equity curve didn.t load/)).toBeInTheDocument()
    await waitFor(() => expect(rowsIn('stocks')).toHaveLength(151))
    expect(within(section('scorecard')).getByText(/Behind the free baseline/)).toBeInTheDocument()
    fail = false
    await user.click(returns().getByRole('button', { name: 'Try again' }))
    expect(await returns().findByText('2.33×')).toBeInTheDocument()
  })

  it('keeps the shell and headings on screen while data loads (T11)', async () => {
    const never = () => new Promise(() => {})
    mockApi({ '/api/summary': never, '/api/tickers': never, '/api/next-session': never, '/api/equity': never, '/api/strategy': never })
    render(<App />)
    expect(search()).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Dashboard sections' })).toBeInTheDocument()
    for (const name of ['Tomorrow', 'Scorecard', '$1 in each stock, following the model', 'Every stock']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThanOrEqual(4)
  })

  it('shows the stale banner after five days, not before (T12)', async () => {
    const pub = new Date(fixtures.summary.publishedAt).getTime()
    mockApi()
    vi.setSystemTime(pub + 4.9 * 864e5)
    const a = render(<App />)
    await within(a.container).findByText(/Behind the free baseline/)
    expect(within(a.container).queryByText(/Last published/)).not.toBeInTheDocument()
    a.unmount()

    vi.setSystemTime(pub + 5.1 * 864e5)
    const b = render(<App />)
    expect(await within(b.container).findByText('Last published 5 days ago')).toBeInTheDocument()
  })

  it('shows the latest cost even when an older answer arrives last (T13)', async () => {
    const slow = deferred()
    mockApi({ '/api/equity': u => (u.searchParams.get('costBps') === '0' ? slow.promise : { status: 200, body: fixtures.equity10 }) })
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(rowsIn('stocks')).toHaveLength(151))
    await user.click(within(section('returns')).getByRole('button', { name: '10 bps' }))
    expect(await within(section('returns')).findByText('1.61×')).toBeInTheDocument()
    await act(async () => { slow.resolve({ status: 200, body: fixtures.equity0 }) })
    expect(within(section('returns')).getByText('1.61×')).toBeInTheDocument()
    expect(within(section('returns')).queryByText('2.33×')).not.toBeInTheDocument()
  })
})

describe('tables', () => {
  it('sorts by a header, both ways, and announces it (T14, T15)', async () => {
    const { user } = await setup()
    const header = within(tableIn('stocks')).getByRole('button', { name: /^Ticker/ })
    await user.click(header)
    expect(header.closest('th')).toHaveAttribute('aria-sort', 'descending')
    expect(tickersIn('stocks')[0]).toBe('XOM')
    header.focus()
    await user.keyboard('{Enter}')
    expect(header.closest('th')).toHaveAttribute('aria-sort', 'ascending')
    expect(tickersIn('stocks')[0]).toBe('AAL')
    for (const id of ['tomorrow', 'stocks', 'stop-loss']) {
      const sorted = [...tableIn(id).querySelectorAll('th')].filter(th => th.getAttribute('aria-sort') !== 'none')
      expect(sorted).toHaveLength(1)
    }
  })

  it('keeps stocks without a value at the bottom in both directions (T14)', async () => {
    const { user } = await setup()
    const header = within(tableIn('stop-loss')).getByRole('button', { name: /^That day/ })
    await user.click(header)
    expect(tickersIn('stop-loss').slice(-2).sort()).toEqual(['AAL', 'NVDA'])
    await user.click(header)
    expect(tickersIn('stop-loss').slice(-2).sort()).toEqual(['AAL', 'NVDA'])
  })

  it('filters tomorrow by direction with matching counts (T16)', async () => {
    const { user } = await setup()
    const t = within(section('tomorrow'))
    expect(t.getByRole('button', { name: 'All 151' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(t.getByRole('button', { name: 'Down 36' }))
    expect(rowsIn('tomorrow')).toHaveLength(36)
    expect(rowsIn('tomorrow').every(r => r.textContent.includes('▼'))).toBe(true)
    await user.click(t.getByRole('button', { name: 'Up 115' }))
    expect(rowsIn('tomorrow')).toHaveLength(115)
  })

  it('shows only the stocks that beat the baseline (T17)', async () => {
    const { user } = await setup()
    expect(within(section('stocks')).getByText('20 of 151')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Only those that beat it' }))
    expect(rowsIn('stocks')).toHaveLength(20)
    expect(rowsIn('stocks').every(r => r.textContent.includes('+'))).toBe(true)
  })

  it('adds a live price column on request, and none on failure (T18)', async () => {
    const gate = deferred()
    const { user } = await setup({ '/api/live-price': () => gate.promise })
    const t = within(section('tomorrow'))
    await user.click(t.getByRole('button', { name: 'Get live price' }))
    expect(t.getByRole('button', { name: 'Fetching…' })).toBeDisabled()
    await act(async () => { gate.resolve({ status: 503, body: { error: 'socket closed' } }) })
    expect(await t.findByText(/Could not fetch live prices/)).toBeInTheDocument()
    expect(t.queryByRole('button', { name: /^Live/ })).not.toBeInTheDocument()

    vi.mocked(fetch).mockImplementationOnce(async () => new Response(JSON.stringify({
      fetchedAt: '2026-11-09T17:30:00Z', fromStream: 1, missing: ['MSFT'],
      quotes: { AMD: { price: 451.2, at: '2026-11-09T17:29:58Z', prevClose: 449.04, change: 2.16, changePct: 0.48, source: 'ws' } },
    }), { status: 200 }))
    await user.click(t.getByRole('button', { name: 'Get live price' }))
    expect(await t.findByRole('button', { name: /^Live/ })).toBeInTheDocument()
    expect(t.getByText('451.20')).toBeInTheDocument()
    expect(t.getByText(/no quote for MSFT/)).toBeInTheDocument()
    expect(t.getByRole('button', { name: 'Refresh price' })).toBeInTheDocument()
  })

  it('follows the stop level and loads a stock chart once (T19)', async () => {
    const { api, user } = await setup()
    const s = within(section('stop-loss'))
    await user.click(s.getByRole('button', { name: '8%' }))
    expect(s.getByText('All 151 stocks, 8% stop')).toBeInTheDocument()
    expect(tableIn('stop-loss').querySelector('th.sel')).toHaveTextContent('8% stop')
    expect(tableIn('stop-loss').querySelector('th[aria-sort="descending"]')).toHaveTextContent('8% stop')

    const open = s.getByRole('button', { name: 'Show the chart for AAPL' })
    await user.click(open)
    expect(await s.findByText('Ended at 8%')).toBeInTheDocument()
    expect(s.getByRole('button', { name: 'Hide the chart for AAPL' })).toHaveAttribute('aria-expanded', 'true')
    await user.click(s.getByRole('button', { name: 'Hide the chart for AAPL' }))
    await user.click(s.getByRole('button', { name: 'Show the chart for AAPL' }))
    expect(await s.findByText('Ended at 8%')).toBeInTheDocument()
    expect(api.calls.filter(c => c.startsWith('/api/strategy/AAPL'))).toHaveLength(1)
  })

  it('opens a ticker on Google without toggling its row (T20)', async () => {
    const { user } = await setup()
    const win = { opener: {} }
    const open = vi.spyOn(window, 'open').mockReturnValue(win)
    const s = within(section('stop-loss'))
    await user.click(s.getByRole('link', { name: 'AAPL' }))
    expect(open).toHaveBeenCalledWith('https://www.google.com/search?q=AAPL%20stock', '_blank')
    expect(win.opener).toBeNull()
    expect(s.getByRole('button', { name: 'Show the chart for AAPL' })).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('2-week swing', () => {
  const cell = (ticker, col) => {
    const row = rowsIn('range').find(r => within(r).getAllByRole('link')[0].textContent === ticker)
    const i = [...tableIn('range').querySelectorAll('thead th')].findIndex(th => th.textContent.startsWith(col))
    return row.querySelectorAll('td')[i]
  }

  it('ranks by how unusual the latest 10 sessions are, against either period (T31)', async () => {
    const { user } = await setup()
    const s = within(section('range'))
    expect(tickersIn('range')).toEqual(['NVDA', 'AMD', 'AXP', 'MRNA', 'AAPL', 'AAL'])
    expect(tableIn('range').querySelector('th[aria-sort="descending"]')).toHaveTextContent('Wider than')
    expect(s.getByRole('heading', { level: 2 })).toHaveTextContent('How far each stock swings in 2 weeks · to Nov 10')
    expect(section('range').querySelector('.sec-head p')).toHaveTextContent('2 of 6 are swinging wider than 9 in 10 of their windows in the past year')
    expect(cell('AAPL', 'Half the time')).toHaveTextContent('5.4–9.3%')
    expect(cell('AAPL', 'Latest')).toHaveTextContent('9.2%')
    expect(cell('NVDA', 'Wider than').querySelector('.pill')).toHaveTextContent('99%')

    await user.click(s.getByRole('button', { name: 'Since 2021' }))
    expect(tickersIn('range')).toEqual(['AMD', 'NVDA', 'MRNA', 'AAL', 'AXP', 'AAPL'])
    expect(cell('AAPL', 'Half the time')).toHaveTextContent('5.7–10.4%')
    expect(section('range').querySelector('.sec-head p')).toHaveTextContent('of their windows since 2021')
  })

  it('opens a stock with the likely swing in words and in numbers (T32)', async () => {
    const { user } = await setup()
    const s = within(section('range'))
    await user.click(s.getByRole('button', { name: 'Show the swing chart for AAPL' }))
    const verdict = section('range').querySelector('.range-verdict')
    expect(verdict).toHaveTextContent(
      'Half of AAPL’s 10-session windows in the past year swung 5.4–9.3% from low to high, and 9 in 10 stayed under 11.4%.')
    expect(verdict).toHaveTextContent('The latest 10 sessions (Oct 28 – Nov 10) swung 9.2%, wider than 73% of them.')
    expect(s.getByText('8 times in 10', { selector: '.tile .l' }).closest('.tile')).toHaveTextContent('4.7–11.4%')
    expect(s.getByText('Oct 28 – Nov 10', { selector: '.tile .l' }).closest('.tile')).toHaveTextContent('low 325.33 Nov 3 · high 355.38 Nov 5')

    await user.click(s.getByRole('button', { name: 'Hide the swing chart for AAPL' }))
    await user.click(s.getByRole('button', { name: 'Show the swing chart for NVDA' }))
    expect(section('range').querySelector('.range-verdict')).toHaveTextContent('swung 32.6%, the widest of them.')
  })

  it('leaves the section out when none is published, and keeps the rest (T33)', async () => {
    mockApi({ '/api/ranges': () => ({ status: 404, body: { error: 'no 2-week swing table published' } }) })
    render(<App />)
    await waitFor(() => expect(rowsIn('stop-loss')).toHaveLength(6))
    expect(section('range')).toBeNull()
    const nav = screen.getByRole('navigation', { name: 'Dashboard sections' })
    expect(within(nav).queryByRole('link', { name: '2-week swing' })).not.toBeInTheDocument()
  })

  it('shows the same table under Midrun and never asks ResearchGateEOD for it (T34)', async () => {
    const { api, user } = await setup()
    await user.click(screen.getByRole('button', { name: 'Midrun' }))
    await waitFor(() => expect(api.calls).toContain('/api/summary?db=eod'))
    expect(rowsIn('range')).toHaveLength(6)
    expect(api.calls.filter(c => c.startsWith('/api/ranges'))).toEqual(['/api/ranges'])
  })
})

describe('theme (T26)', () => {
  it('cycles Auto, Light, Dark and remembers the choice', async () => {
    const { user } = await setup()
    const btn = () => screen.getByRole('button', { name: /^Theme:/ })
    expect(btn()).toHaveAccessibleName(/Theme: Auto/)
    await user.click(btn())
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem('rg-theme')).toBe('light')
    await user.click(btn())
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await user.click(btn())
    expect(document.documentElement).not.toHaveAttribute('data-theme')
    expect(localStorage.getItem('rg-theme')).toBeNull()
  })

  it('still switches when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: /^Theme:/ }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })
})
