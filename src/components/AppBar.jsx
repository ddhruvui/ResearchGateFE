import { useEffect, useRef } from 'react'
import { Segmented } from './ui.jsx'

const THEME_NAME = { auto: 'Auto', light: 'Light', dark: 'Dark' }
const THEME_ICON = {
  auto: <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" /></svg>,
  light: <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor" /><g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" /></g></svg>,
  dark: <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" fill="currentColor" /></svg>,
}

/**
 * The page-level controls in one sticky bar: brand, the stock search, the data
 * source (the midrun switch) and the theme.
 */
export default function AppBar ({ query, onQuery, matches, total, midrun, onMidrun, theme, onTheme }) {
  return (
    <div className="bar">
      <div className="brand">
        <span className="logo" aria-hidden="true">RG</span>
        <span><b>ResearchGate</b><small>PSO + LS-SVM</small></span>
      </div>
      <StockSearch value={query} onChange={onQuery} matches={matches} total={total} />
      <div className="bar-right">
        <Segmented label="Data source" value={midrun} onChange={onMidrun} options={[
          { value: false, label: 'Official', title: 'ResearchGate: the official nightly run' },
          { value: true, label: 'Midrun', title: "Show ResearchGateEOD's results and its intraday (midrun) prediction" },
        ]} />
        <button type="button" className="icon-btn" onClick={onTheme}
                aria-label={`Theme: ${THEME_NAME[theme]}. Click to change.`} title={`Theme: ${THEME_NAME[theme]}`}>
          {THEME_ICON[theme]}
        </button>
      </div>
    </div>
  )
}

/**
 * One ticker search for the whole page. It filters every table at once and owns the
 * keyboard: any letter or digit typed while focus is not in another field lands
 * here, "/" and ⌘K / Ctrl+K jump to it, and Esc clears it.
 */
export function StockSearch ({ value, onChange, matches, total }) {
  const ref = useRef(null)

  useEffect(() => {
    // Focus on load where there is a keyboard; on a phone that would pop it open.
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    if (!coarse) ref.current?.focus({ preventScroll: true })

    const onKey = e => {
      const el = ref.current
      if (!el || e.defaultPrevented) return
      const t = e.target
      if (t === el || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault(); el.focus(); el.select(); return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '/') { e.preventDefault(); el.focus(); el.select(); return }
      if (e.key === 'Escape') { onChange(''); return }
      // Focusing during keydown lets this same keystroke type into the field.
      if (e.key.length === 1 && /[a-z0-9.-]/i.test(e.key)) el.focus({ preventScroll: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChange])

  return (
    <div className="search" role="search">
      <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M11 11l3.2 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input ref={ref} type="search" value={value} placeholder="Search a stock"
             aria-label="Search stock (filters every table)" aria-describedby="search-count"
             spellCheck={false} autoComplete="off" autoCapitalize="characters"
             onChange={e => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9.-]/g, ''))}
             onKeyDown={e => { if (e.key === 'Escape') onChange('') }} />
      <span className="search-end">
        <span className="search-count" id="search-count" aria-live="polite">
          {value ? `${matches} of ${total}` : ''}
        </span>
        {value
          ? <button type="button" className="search-clear" aria-label="Clear search"
                    onClick={() => { onChange(''); ref.current?.focus() }}>×</button>
          : <span className="kbd" aria-hidden="true">/</span>}
      </span>
    </div>
  )
}
