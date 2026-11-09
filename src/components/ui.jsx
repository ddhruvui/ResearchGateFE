/** Small shared pieces every section is built from. */

/** A dashboard section: heading, optional one-line subtitle, controls on the right. */
export function Section ({ id, title, sub, tools, first = false, children }) {
  return (
    <section id={id} className={`sec${first ? ' first' : ''}`} aria-labelledby={`${id}-h`}>
      <header className="sec-head">
        <div>
          <h2 id={`${id}-h`}>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {tools && <div className="tools">{tools}</div>}
      </header>
      {children}
    </section>
  )
}

/** One choice out of a few, as a row of buttons. */
export function Segmented ({ label, options, value, onChange }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value}
                title={o.title} onClick={() => onChange(o.value)}>
          {o.label}{o.count != null && <> <span className="n">{o.count}</span></>}
        </button>
      ))}
    </div>
  )
}

/** Several numbers read as one object. `cols` is fixed so a row never orphans. */
export function StatStrip ({ items, cols = items.length, className = '' }) {
  return (
    <div className={`strip ${cols === 3 ? 'three' : ''} ${className}`} style={{ '--cols': cols }}>
      {items.map(t => (
        <div className="tile" key={t.label}>
          <span className="l">{t.label}</span>
          <span className="v">{t.value}</span>
          {t.delta && <span className={`d ${t.tone || ''}`}>{t.delta}</span>}
        </div>
      ))}
    </div>
  )
}

/** Method and background text, closed until asked for. */
export function Disclosure ({ summary = 'How this is calculated', children }) {
  return (
    <details className="more">
      <summary>{summary}</summary>
      <div className="more-body">{children}</div>
    </details>
  )
}

/**
 * A sortable column header. The button makes it reachable by keyboard; aria-sort
 * tells assistive tech which column is sorted and which way.
 */
export function SortHeader ({ sort, onSort, k, children, title, className = '' }) {
  const on = sort.key === k
  const state = on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
  return (
    <th className={className} aria-sort={state}>
      <button type="button" className="sort" title={title ? `${title}. Click to sort.` : 'Click to sort'}
              onClick={() => onSort(k)}>
        {children}
        <span className="sort-ic" aria-hidden="true">{on ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}

/** Shown in place of rows when the search or a filter leaves nothing. */
export function EmptyRow ({ colSpan, query, onClear }) {
  return (
    <tr>
      <td className="empty" colSpan={colSpan}>
        {query
          ? <>No stock matches <b className="mono">{query}</b>
              <button type="button" className="btn" onClick={onClear}>Clear search</button></>
          : 'Nothing to show with this filter.'}
      </td>
    </tr>
  )
}

/** Up/down as a pill: arrow, sign and percent together, so colour is never alone. */
export function ChangePill ({ value, text }) {
  const up = value > 0
  return (
    <span className={`chg ${up ? 'up' : 'down'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>{text}
    </span>
  )
}

/** Placeholder while a section's numbers load; the section heading stays put. */
export function Skeleton ({ lines = 4, height }) {
  return (
    <div className="sk-block" aria-busy="true" aria-label="Loading" style={height ? { minHeight: height } : undefined}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="sk" style={{ width: `${[60, 100, 85, 70, 92][i % 5]}%` }} />
      ))}
    </div>
  )
}

/** A failure that belongs to one section, with a way to try again. */
export function SectionError ({ what, error, onRetry }) {
  return (
    <div className="banner crit" role="alert">
      <b>{what} didn&rsquo;t load</b>
      <p>{error}{' '}{onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}</p>
    </div>
  )
}
