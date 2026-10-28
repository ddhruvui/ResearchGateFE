/** Where the API lives. Empty in dev (Vite proxies /api); the Vercel URL in prod. */
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')

export async function j (path, opts) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { accept: 'application/json' },
    ...opts,
  })
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`
    try {
      const b = await r.json()
      if (b?.error) msg = `${msg} — ${b.error}`
      if (b?.hint) msg = `${msg} (${b.hint})`
    } catch { /* not json */ }
    throw new Error(`${msg} (${API_BASE || ''}${path})`)
  }
  return r.json()
}

/**
 * `path` against the database the dashboard is showing: 'rg' (ResearchGate, the API's
 * default, so nothing is added) or 'eod' (ResearchGateEOD — the midrun toggle).
 */
export const withDb = (path, db) =>
  db === 'eod' ? `${path}${path.includes('?') ? '&' : '?'}db=eod` : path

/**
 * A read that must not be answered from anybody's cache — the browser's, a
 * proxy's, or Vercel's edge. Used for live prices, where a cached answer is
 * worse than no answer: it looks current and is not.
 */
export const fresh = path => j(path, { cache: 'no-store' })
