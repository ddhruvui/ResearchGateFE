import { useMemo, useState } from 'react'
import { fresh } from '../api.js'
import { matchesQuery, sortRows, useSort } from '../hooks.js'
import { dateLong, dateShort, num, signed, spct, timeET } from '../format.js'
import TickerLink from './TickerLink.jsx'
import { ChangePill, Disclosure, EmptyRow, Section, Segmented, Skeleton, SortHeader } from './ui.jsx'

/**
 * Tomorrow's prediction: the one call nobody knows the answer to yet. Shows the close
 * it was computed from and the level the model implies, so the number can be checked
 * against a quote screen tomorrow.
 *
 * The price column starts as **Last**: the LastPrice upload (`last`, from
 * /api/last-price), Yahoo's latest trade every 10 minutes. When it was uploaded is on
 * the page's top line (Hero) and in the column's tooltip. Pressing the button swaps it to **Live**. Each press opens a real-time
 * EODHD socket and rotates the universe through it, so it costs a few seconds and
 * real quota; it happens only when asked for, and every press re-fetches rather than
 * reusing what is already on screen. A name the press got no quote for keeps its
 * last uploaded price, greyed out.
 */
export default function NextSession ({ data, loading, midrun = false, last = null, lastError = null, query = '', onClearQuery }) {
  const [sort, onSort] = useSort({ key: 'pred', dir: 'desc' })
  const [dir, setDir] = useState('all')
  const [live, setLive] = useState(null)      // null = never asked: the column shows Last
  const [busy, setBusy] = useState(false)
  const [liveErr, setLiveErr] = useState(null)

  const rows = useMemo(() => data?.rows ?? [], [data])
  const lastPrices = useMemo(() => last?.prices ?? {}, [last])
  const hasLast = Object.keys(lastPrices).length > 0
  // Last is coloured against the official close the prediction started from.
  const baseKey = midrun ? 'officialClose' : 'lastClose'
  const baseDate = midrun ? data?.officialAsOf : data?.asOf

  async function getLive () {
    setBusy(true)
    setLiveErr(null)
    try {
      const tickers = rows.map(r => r.ticker).join(',')
      // Fresh every time: no-store on the request, and the API sends no-store back.
      setLive(await fresh(`/api/live-price?tickers=${encodeURIComponent(tickers)}`))
    } catch (e) {
      setLiveErr(e.message)
      setLive(null)                            // a failed press goes back to Last, never a half-column
    } finally {
      setBusy(false)
    }
  }

  const view = useMemo(() => {
    let out = rows.filter(r => matchesQuery(r.ticker, query))
    if (dir === 'up') out = out.filter(r => r.pred > 0)
    if (dir === 'down') out = out.filter(r => r.pred <= 0)
    // Merge the prices in so the column sorts like any other: live where it came back,
    // the last upload otherwise.
    out = out.map(r => {
      const quote = live?.quotes?.[r.ticker] ?? null
      const lastPrice = lastPrices[r.ticker] ?? null
      return { ...r, quote, lastPrice, price: quote?.price ?? lastPrice }
    })
    return sortRows(out, sort)
  }, [rows, query, dir, sort, live, lastPrices])

  const up = data?.up ?? rows.filter(r => r.pred > 0).length
  const down = data?.down ?? rows.length - up
  const title = <>Tomorrow{data?.forSession && <span className="when"> · {dateLong(data.forSession)}{midrun && ' · midrun'}</span>}</>

  if (loading) return <Section id="tomorrow" title={title} first><Skeleton lines={6} height={260} /></Section>

  if (!rows.length) {
    return (
      <Section id="tomorrow" title={title} first>
        {midrun
          ? <p className="note">No midrun published yet. Run <code>bash scripts/midrun.sh</code> in ResearchGateEOD.
              {data?.error && <><br /><span className="muted">{data.error}</span></>}</p>
          : <p className="note">No live prediction available. Run <code>RUN_MODE=predict scripts/launch.sh</code>.
              {data?.error && <><br /><span className="muted">{data.error}</span></>}</p>}
      </Section>
    )
  }

  const sub = midrun
    ? <>From IB&rsquo;s price at {data.midrunAsOf ? timeET(data.midrunAsOf) : 'the midrun'} on {dateShort(data.asOf)}, treated as the close. Not graded.</>
    : <>From the {dateShort(data.asOf)} close. A live paper trade, graded on the next run.</>
  const tools = (
    <>
      <Segmented label="Direction" value={dir} onChange={setDir} options={[
        { value: 'all', label: 'All', count: up + down },
        { value: 'up', label: 'Up', count: up },
        { value: 'down', label: 'Down', count: down },
      ]} />
      <button type="button" className="btn" onClick={getLive} disabled={busy}
              title="Fetch the current price for every name from EODHD">
        {busy ? 'Fetching…' : live ? 'Refresh price' : 'Get live price'}
      </button>
    </>
  )
  const showPrice = !!live || hasLast
  const cols = 4 + (midrun ? 1 : 0) + (showPrice ? 1 : 0)
  const uploaded = last?.uploadedAt ? new Date(last.uploadedAt).toLocaleString() : 'time unknown'
  const missingLive = live?.missing ?? []

  return (
    <Section id="tomorrow" title={title} sub={sub} tools={tools} first>
      <div className="breadth">
        <div className="breadth-bar" aria-hidden="true">
          <span className="u" style={{ flex: up }} /><span className="d" style={{ flex: down }} />
        </div>
        <span><b>{up}</b> up · <b>{down}</b> down</span>
      </div>

      {liveErr && <p className="note err" role="alert" style={{ margin: '0 0 12px' }}>Could not fetch live prices: {liveErr}</p>}
      {live && (
        <p className="note" style={{ margin: '0 0 12px' }}>
          Priced {quoteStamp(live)} · fetched {new Date(live.fetchedAt).toLocaleTimeString()}
          {' · '}{live.fromStream}/{Object.keys(live.quotes || {}).length} off the real-time tape
          {missingLive.length > 0 && ` · no quote for ${missingLive.join(', ')}`}
          {missingLive.some(t => lastPrices[t] != null) && ' (last uploaded price shown)'}
        </p>
      )}
      {!live && !hasLast && lastError && (
        <p className="note muted" style={{ margin: '0 0 12px' }}>Last prices unavailable: {lastError}</p>
      )}

      <div className="tw">
        <table className="t">
          <thead>
            <tr>
              <SortHeader sort={sort} onSort={onSort} k="ticker">Ticker</SortHeader>
              {midrun && <SortHeader sort={sort} onSort={onSort} k="officialClose" className="opt"
                                     title="Last official close, from data/ohlcv">Close {dateShort(data.officialAsOf)}</SortHeader>}
              <SortHeader sort={sort} onSort={onSort} k="lastClose" className="opt"
                          title={midrun ? "IB's price at the midrun, treated as today's close" : 'Adjusted close the prediction was computed from'}>
                {midrun ? `IB ${dateShort(data.asOf)}` : `Close ${dateShort(data.asOf)}`}
              </SortHeader>
              <SortHeader sort={sort} onSort={onSort} k="impliedClose" title="Close the model implies for the next session">Expected</SortHeader>
              {showPrice && (
                <SortHeader sort={sort} onSort={onSort} k="price"
                            title={live ? 'Latest EODHD trade print when you pressed the button' : `Latest uploaded price, ${uploaded}`}>
                  {live ? 'Live' : 'Last'}
                </SortHeader>
              )}
              <SortHeader sort={sort} onSort={onSort} k="pred" title="Predicted move from the close">Change</SortHeader>
            </tr>
          </thead>
          <tbody>
            {view.length ? view.map(r => {
              const diff = r.impliedClose - r.lastClose
              return (
                <tr key={r.ticker}>
                  <td><TickerLink ticker={r.ticker} /><span className="sub">from {num(r.lastClose)}</span></td>
                  {midrun && <td className="opt">{num(r.officialClose)}</td>}
                  <td className="opt">{num(r.lastClose)}</td>
                  <td className="strong">{num(r.impliedClose)}</td>
                  {showPrice && (live && r.quote
                    ? (
                      <td className={r.quote.change == null ? '' : r.quote.change >= 0 ? 'up-t' : 'down-t'}
                          title={quoteTitle(r.quote)}>
                        {num(r.quote.price)}
                      </td>
                    )
                    : <LastCell price={r.lastPrice} base={r[baseKey]} baseDate={baseDate} uploaded={uploaded} live={!!live} />)}
                  <td>
                    <span className="abs">{signed(diff)}</span>
                    <ChangePill value={r.pred} text={spct(r.pred)} />
                  </td>
                </tr>
              )
            }) : <EmptyRow colSpan={cols} query={query} onClear={onClearQuery} />}
          </tbody>
        </table>
      </div>

      <Disclosure>
        <p>Split- and dividend-adjusted closes. On the newest bar the adjustment factor is 1, so these
          line up with a quote screen. Expected = close × (1 + predicted return).</p>
        <p>The model&rsquo;s predicted moves average about a fifth of a real day&rsquo;s move, so these
          sit close to the last price by construction.</p>
        {midrun && <p>Made during the day, as if IB&rsquo;s price
          {data.midrunAsOf && <> at <strong>{new Date(data.midrunAsOf).toLocaleString()}</strong></>} were
          today&rsquo;s close: the official model, fed today&rsquo;s partial bar. Not graded; tonight&rsquo;s
          run makes the official prediction from the real close.</p>}
        {!live && hasLast && <p><strong>Last</strong> is the latest trade Yahoo reported when prices were
          last uploaded: every 10 minutes from Sunday 8 pm to Friday 8 pm New York time, pre-market and
          after-hours included. Colour is the move against the {baseDate ? dateShort(baseDate) : 'official'} close;
          hover a price for both. Press <strong>Get live price</strong> for EODHD&rsquo;s tape right now.</p>}
        {live && <p><strong>Live</strong> is the last trade EODHD reported at the moment you asked, taken
          from its real-time socket where a print arrived and from the REST snapshot otherwise (hover any
          price to see which, and the session it traded in). Colour is the move against the previous close.
          Outside market hours this is the most recent extended-hours or closing print. A name with no live
          quote keeps its last uploaded price, greyed out. It is a sanity check against the expected level,
          not a fill price.</p>}
      </Disclosure>
    </Section>
  )
}

/**
 * A price from the LastPrice upload. Coloured against the close the prediction started
 * from; greyed out when it stands in for a live quote that never came back.
 */
function LastCell ({ price, base, baseDate, uploaded, live }) {
  if (price == null) {
    return <td title={live ? 'No live quote and no uploaded price for this name' : 'No uploaded price for this name'}>—</td>
  }
  const chg = Number.isFinite(base) && base > 0 ? price - base : null
  const tone = live ? 'muted' : chg == null ? '' : chg >= 0 ? 'up-t' : 'down-t'
  const title = [
    live ? `No live quote: last uploaded price, ${uploaded}` : `Uploaded ${uploaded}`,
    chg != null ? `Change since the ${baseDate ? dateShort(baseDate) : 'official'} close ${signed(chg)} (${spct(chg / base)})` : null,
  ].filter(Boolean).join(' · ')
  return <td className={tone} title={title}>{num(price)}</td>
}

/** The exchange timestamp the quotes carry, which is not when we fetched them. */
const quoteStamp = live => {
  const ts = Object.values(live.quotes || {}).map(q => q.at).filter(Boolean).sort().pop()
  return ts ? new Date(ts).toLocaleString() : 'time unknown'
}

const quoteTitle = q => [
  q.at ? `Last print ${new Date(q.at).toLocaleString()}` : null,
  q.prevClose != null ? `Previous close ${num(q.prevClose)}` : null,
  q.change != null ? `Change ${signed(q.change)} (${spct(q.changePct / 100)})` : null,
  q.source === 'ws'
    ? `Real-time trade${q.marketStatus ? ` · ${q.marketStatus.replace('-', ' ')}` : ''}`
    : 'REST snapshot: no trade came over the socket in time',
].filter(Boolean).join(' · ')
