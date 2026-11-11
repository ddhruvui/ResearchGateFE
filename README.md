# ResearchGate dashboard (frontend)

React + Vite static site that renders the PSO + LS-SVM outcome: **did the model
beat the free alternative?** — in accuracy terms and, more importantly, in money.
Deployed on **Render** as a static site. It reads everything from the
[ResearchGateBE](https://github.com/ddhruvui/ResearchGateBE) API on Vercel,
which in turn reads what the pipeline published to MongoDB.

## Run locally

```sh
npm install
npm run dev          # http://localhost:5273, /api proxied to localhost:8891
```

Run ResearchGateBE locally at the same time (`npm run dev` there), or point the
proxy elsewhere with `VITE_PROXY_TARGET=https://<api-host> npm run dev`.

## Test

```sh
npm test             # Vitest + Testing Library, once
npm run test:watch   # re-run on save
```

The tests render the whole app in jsdom against fixtures cut from a real API
snapshot (`src/test/fixtures`), with `fetch` mocked, so no API needs to be running.
They cover the global search and spotlight, the Midrun switch, per-section loading
and errors, the stale banner, sorting and filters, live prices, the stop-loss
table, the 2-week swing table and the theme control.

## Build

```sh
VITE_API_BASE=https://research-gate-be.vercel.app npm run build
npm run preview      # serve dist/ locally
```

`VITE_API_BASE` is inlined at build time, so it has to be set wherever the build
runs (Render). No trailing slash.

## Deploy on Render

Live at `https://researchgatefe.onrender.com`, over the API at
`https://research-gate-be.vercel.app`. Either **New → Blueprint** and
pick this repo (`render.yaml` describes the site, API URL included), or
**New → Static Site** by hand:

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |
| Environment variable | `VITE_API_BASE` = `https://research-gate-be.vercel.app` |
| Redirect/rewrite | `/*` → `/index.html` (rewrite) |

Every push to `main` redeploys. Changing `VITE_API_BASE` needs a redeploy.

## What it shows

One page, answer first, with the app bar (search, Official/Midrun, theme) and a
section bar pinned to the top:

- **Tomorrow's prediction** — every stock's call for the next session, with an
  opt-in live price column.
- **Scorecard** — the verdict as a sentence, then direction accuracy vs the
  always-up baseline. The edge is the number that matters; the accuracy alone is not.
- **Returns** — $1 per stock following the model vs buy & hold, with a
  trading-cost toggle (0/1/5/10 bps per switch, pre-computed by the publisher).
- **Edge by year**, the **per-stock table**, the **live track record**
  (predictions made in advance and graded the next day), and the **$10,000
  stop-loss paper trade** with a chart per stock.
- **How far each stock swings in 2 weeks** — every stock's latest 10-session
  high-to-low against every 10-session window in its own past year (or since
  2021): a box-and-whisker strip per row on one shared scale, sorted by how
  unusual the latest window is, and a histogram per stock that names the likely
  swing in words. It comes from the price bars alone (`/api/ranges`), so it is
  the same under Midrun, and the section is simply absent until it is published.
- **Search** — type a ticker anywhere (or press `/` or ⌘K); every table filters,
  and a single match opens a spotlight card with that stock's call, record and
  stop-loss result.
- A banner if the API has not been published to in more than 5 days. Each
  section loads and fails on its own.

Charts are hand-rolled SVG drawn at their container's real width,
palette-validated in light and dark mode; the Auto/Light/Dark control wins over
the OS setting in both directions and is remembered per browser.
