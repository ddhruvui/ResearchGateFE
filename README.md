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

## Build

```sh
VITE_API_BASE=https://<your-vercel-project>.vercel.app npm run build
npm run preview      # serve dist/ locally
```

`VITE_API_BASE` is inlined at build time, so it has to be set wherever the build
runs (Render). No trailing slash.

## Deploy on Render

Either **New → Blueprint** and pick this repo (`render.yaml` describes the
site), or **New → Static Site** by hand:

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |
| Environment variable | `VITE_API_BASE` = the Vercel API URL |
| Redirect/rewrite | `/*` → `/index.html` (rewrite) |

Every push to `main` redeploys. Changing `VITE_API_BASE` needs a redeploy.

## What it shows

- **Direction accuracy vs the always-up baseline** — the edge is the number that
  matters; the accuracy alone is not.
- **Equity curve** — $1 per stock following the model vs buy & hold, with a
  trading-cost toggle (0/1/5/10 bps per switch, pre-computed by the publisher).
- **Edge by year**, the **per-stock leaderboard**, the **live track record**
  (predictions made in advance and graded the next day), and **tomorrow's
  prediction**.
- A banner if the API has not been published to in more than 5 days.

Charts are hand-rolled SVG, palette-validated in light and dark mode; the
`data-theme` toggle wins over the OS setting in both directions.
