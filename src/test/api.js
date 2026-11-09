import { vi } from 'vitest'
import summary from './fixtures/summary.json'
import tickers from './fixtures/tickers.json'
import nextSession from './fixtures/next-session.json'
import midrun from './fixtures/midrun.json'
import equity0 from './fixtures/equity-0.json'
import equity10 from './fixtures/equity-10.json'
import strategy from './fixtures/strategy.json'
import strategyAAPL from './fixtures/strategy-AAPL.json'

export const fixtures = { summary, tickers, nextSession, midrun, equity0, equity10, strategy, strategyAAPL }

const ok = body => ({ status: 200, body })
const eod = (u, body) => (u.searchParams.get('db') === 'eod' ? { ...body, db: 'ResearchGateEOD' } : body)

/** Default answers, keyed by path. A handler gets the request URL. */
const ROUTES = {
  '/api/summary': u => ok(eod(u, summary)),
  '/api/tickers': () => ok(tickers),
  '/api/next-session': () => ok(nextSession),
  '/api/midrun': () => ok(midrun),
  '/api/equity': u => ok(u.searchParams.get('costBps') === '10' ? equity10 : equity0),
  '/api/strategy': () => ok(strategy),
  '/api/strategy/AAPL': () => ok(strategyAAPL),
  '/api/live-price': () => ok({
    fetchedAt: '2026-11-09T17:30:00Z', fromStream: 2, missing: [],
    quotes: {
      AMD: { price: 451.2, at: '2026-11-09T17:29:58Z', prevClose: 449.04, change: 2.16, changePct: 0.48, source: 'ws', marketStatus: 'open' },
      AAPL: { price: 340.1, at: '2026-11-09T17:29:59Z', prevClose: 342.37, change: -2.27, changePct: -0.66, source: 'rest' },
    },
  }),
}

/** A reply that only arrives when you call resolve(). */
export function deferred () {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

/**
 * Mock fetch with the fixture API. `overrides` replaces handlers by path; a handler
 * may return { status, body } or a promise of one. `calls` records every request as
 * "path?query".
 */
export function mockApi (overrides = {}) {
  const routes = { ...ROUTES, ...overrides }
  const calls = []
  const fetchMock = vi.fn(async url => {
    const u = new URL(url, 'http://test.local')
    calls.push(`${u.pathname}${u.search}`)
    const handler = routes[u.pathname]
    const { status = 200, body = {} } = handler ? await handler(u) : { status: 404, body: { error: 'not found' } }
    return new Response(JSON.stringify(body), {
      status, statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Internal Server Error',
      headers: { 'content-type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock, routes }
}
