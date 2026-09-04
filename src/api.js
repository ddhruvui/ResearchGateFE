/** Where the API lives. Empty in dev (Vite proxies /api); the Vercel URL in prod. */
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')

export async function j (path) {
  const r = await fetch(`${API_BASE}${path}`, { headers: { accept: 'application/json' } })
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`
    try { const b = await r.json(); if (b?.error) msg = `${msg} — ${b.error}` } catch { /* not json */ }
    throw new Error(`${msg} (${API_BASE || ''}${path})`)
  }
  return r.json()
}
