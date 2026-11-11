/** Display formatting. Every formatter shows "—" for a missing or non-finite value. */

export const MINUS = '−'
const ok = Number.isFinite
const sign = v => (v >= 0 ? '+' : MINUS)
const fixed = (v, dp) => v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })

/** A rate: 0.5108 → "51.08%". Never signed. */
export const pct = (v, dp = 2) => (ok(v) ? `${(v * 100).toFixed(dp)}%` : '—')

/** A change: 0.0123 → "+1.23%", −0.0123 → "−1.23%". */
export const spct = (v, dp = 2) => (ok(v) ? `${sign(v)}${Math.abs(v * 100).toFixed(dp)}%` : '—')

/** A difference of two rates, in percentage points: −0.0118 → "−1.18pp". */
export const pp = (v, dp = 2) => (ok(v) ? `${sign(v)}${Math.abs(v * 100).toFixed(dp)}pp` : '—')

/** A price or level: 1234.5 → "1,234.50". */
export const num = (v, dp = 2) => (ok(v) ? `${v < 0 ? MINUS : ''}${fixed(Math.abs(v), dp)}` : '—')

/** A signed price move: 3.2 → "+3.20". */
export const signed = (v, dp = 2) => (ok(v) ? `${sign(v)}${fixed(Math.abs(v), dp)}` : '—')

/** Dollars: 10000 → "$10,000.00". */
export const money = (v, dp = 2) => (ok(v) ? `${v < 0 ? MINUS : ''}$${fixed(Math.abs(v), dp)}` : '—')

/** A multiple: 2.3288 → "2.33×". */
export const times = (v, dp = 2) => (ok(v) ? `${v.toFixed(dp)}×` : '—')

/** "0.05" → "5%" — a stop level as people say it. */
export const stopLabel = s => `${Math.round(Number(s) * 100)}%`

// Calendar dates arrive as "YYYY-MM-DD" (sometimes with a time). Read them at noon so
// no time zone can move them to the neighbouring day.
const day = iso => new Date(`${String(iso).slice(0, 10)}T12:00:00`)
const fmtDate = opts => iso => (iso ? day(iso).toLocaleDateString('en-US', opts) : '—')
/** "Mon, Nov 9" */
export const dateLong = fmtDate({ weekday: 'short', month: 'short', day: 'numeric' })
/** "Nov 9" */
export const dateShort = fmtDate({ month: 'short', day: 'numeric' })
/** "Nov 9, 2026" */
export const dateYear = fmtDate({ month: 'short', day: 'numeric', year: 'numeric' })

/** An exchange timestamp in New York time: "12:05 PM ET". */
export const timeET = iso => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET`
}

/** A span of two rates, one percent sign: (0.06, 0.091) → "6.0–9.1%". */
export const pctSpan = (a, b, dp = 1) =>
  (ok(a) && ok(b) ? `${(a * 100).toFixed(dp)}–${(b * 100).toFixed(dp)}%` : '—')
