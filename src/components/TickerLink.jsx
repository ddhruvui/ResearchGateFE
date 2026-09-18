/**
 * A ticker that opens Google's results for that symbol in a new tab — the
 * quickest route from a row in this dashboard to a quote screen, a chart and
 * the day's news about the name.
 */
export default function TickerLink ({ ticker }) {
  const href = `https://www.google.com/search?q=${encodeURIComponent(`${ticker} stock`)}`

  /**
   * `target="_blank"` on its own is not enough: an embedded or sandboxed copy
   * of the dashboard can strip it and navigate in place, which throws the
   * reader out of the page they were reading. Opening the window explicitly on
   * the click forces the new tab. The anchor keeps its own target/rel as the
   * fallback for when a popup blocker refuses the handle, and so that
   * middle-click, ⌘-click and "open in new tab" all still behave normally.
   */
  const onClick = e => {
    // The stop-loss table's rows toggle their chart open on click.
    e.stopPropagation()
    // Let the browser's own modifier handling win — never hijack those.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const w = window.open(href, '_blank')
    if (!w) return                 // blocked: fall through to target="_blank"
    w.opener = null                // sever the handle back to this page
    e.preventDefault()
  }

  return (
    <a className="tkr" href={href}
       target="_blank" rel="noopener noreferrer"
       title={`Look up ${ticker} on Google — opens in a new tab`}
       onClick={onClick}>
      {ticker}
    </a>
  )
}
