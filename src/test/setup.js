import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'

// jsdom has no layout, observers or media queries; give the app inert stand-ins.
globalThis.ResizeObserver = class { observe () {} unobserve () {} disconnect () {} }
window.matchMedia = window.matchMedia || (q => ({
  matches: false, media: q, onchange: null,
  addListener () {}, removeListener () {}, addEventListener () {}, removeEventListener () {}, dispatchEvent () { return false },
}))
Element.prototype.scrollIntoView = function () {}

beforeEach(() => {
  // The fixtures were published on Nov 7, 2026; read them as of two days later so the
  // stale-data banner stays off. Only Date is faked, so promises and waitFor still run.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-09T18:00:00Z'))
  try { localStorage.clear() } catch { /* ignore */ }
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
