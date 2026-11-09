import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { j } from './api.js'

/**
 * One API read. `path` null means "don't fetch". A response that arrives after the
 * path has changed is dropped, so quick switches (cost, Midrun) never show a stale
 * answer. With `keep`, the previous data stays on screen while the next loads.
 */
export function useResource (path, { keep = false } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!path) { setState({ data: null, error: null, loading: false }); return }
    let live = true
    setState(s => ({ data: keep ? s.data : null, error: null, loading: true }))
    j(path)
      .then(data => live && setState({ data, error: null, loading: false }))
      .catch(e => live && setState({ data: null, error: e.message, loading: false }))
    return () => { live = false }
  }, [path, attempt, keep])

  const retry = useCallback(() => setAttempt(a => a + 1), [])
  return { ...state, retry }
}

/** The rendered width of an element, kept current as it resizes. */
export function useWidth () {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** Auto / Light / Dark. Auto follows the system and stores nothing. */
const THEMES = ['auto', 'light', 'dark']
const THEME_KEY = 'rg-theme'
function readTheme () {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return THEMES.includes(t) ? t : 'auto'
  } catch { return 'auto' }
}
export function useTheme () {
  const [theme, setTheme] = useState(readTheme)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      if (theme === 'auto') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, theme)
    } catch { /* private window or blocked storage: the choice lasts this visit */ }
  }, [theme])
  const cycle = useCallback(() => setTheme(t => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]), [])
  return [theme, cycle]
}

/** Column sort state: clicking a column sorts it descending, clicking again flips it. */
export function useSort (initial) {
  const [sort, setSort] = useState(initial)
  const toggle = useCallback(key => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' })), [])
  return [sort, toggle, setSort]
}

const missing = v => v == null || (typeof v === 'number' && !Number.isFinite(v))

/**
 * Sort rows by one column. Rows without a value sink to the bottom in both
 * directions, never interleaved, and fall back to ticker order among themselves.
 */
export function sortRows (rows, { key, dir }, get = (r, k) => r[k]) {
  const sg = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = get(a, key), y = get(b, key)
    if (missing(x) && missing(y)) return a.ticker.localeCompare(b.ticker)
    if (missing(x)) return 1
    if (missing(y)) return -1
    return sg * (typeof x === 'string' ? x.localeCompare(y) : x - y)
  })
}

export const matchesQuery = (ticker, query) => !query || ticker.includes(query)
