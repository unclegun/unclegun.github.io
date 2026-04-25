# unclegun.github.io

Root homepage is the Stratastack site imported from `unclegun/stratastack-site`.

## Homepage source of truth

- Root homepage file: `/index.html`
- Imported Stratastack assets: `/stratastack/style.css` and `/stratastack/stratastack_logo.png`

## How to update Stratastack homepage

1. Pull latest from `https://github.com/unclegun/stratastack-site`.
2. Copy updated static files into this repo:
	- homepage markup into `/index.html`
	- static assets into `/stratastack/`
3. Normalize all references for root hosting on `unclegun.github.io`:
	- use root-relative paths (for example `/stratastack/style.css`)
	- remove repo/subpath assumptions such as `/stratastack-site/...`
4. Verify homepage has no links to legacy pages in this repository.

---

## Penny Stock Ranker

A daily data-driven penny-stock purchase candidate dashboard hosted at
`/penny-stock-ranker.html`.

### What it does

Generates a ranked list of US-listed penny stocks ($0.50–$5.00) based on a
transparent, deterministic scoring model.  Each candidate is scored on:

- **Relative volume** (30 pts) – unusual trading interest
- **Momentum** (25 pts) – 1-, 5-, and 20-day price changes
- **Trend strength** (20 pts) – price vs. SMA5 / SMA20
- **Liquidity** (15 pts) – sufficient average daily volume
- **RSI quality** (10 pts) – healthy momentum zone without overbought extremes
- **Risk/volatility adjustment** (–25 to +5 pts) – penalises extreme volatility
  and large one-day spikes

The dashboard shows rankings, score breakdowns, data-backed justification,
and suggested entry / stop / target zones.

> **For research and educational use only.  Not financial advice.**

### How daily ranking works

A GitHub Actions workflow (`.github/workflows/penny-stock-rankings.yml`) runs
every weekday at 08:30 UTC (before US market open) and:

1. Fetches free public OHLCV data for each ticker in the candidate universe
   via **Stooq** (with a **Yahoo Finance** fallback).
2. Computes technical indicators (RSI, SMA, volatility, relative volume, etc.).
3. Scores and ranks every qualifying ticker.
4. Writes `data/penny-stock-rankings.json` (latest) and
   `data/penny-stock-history/YYYY-MM-DD.json` (snapshot).
5. Commits and pushes the updated data back to `main`.

The frontend at `penny-stock-ranker.html` fetches and renders the JSON
entirely client-side – no server required.

### How to run locally

```bash
# From the repository root
pip install requests pandas
python scripts/penny_stock_ranker/generate_rankings.py
```

Output is written to `data/penny-stock-rankings.json`.

### How to edit the ticker universe

Open `scripts/penny_stock_ranker/universe.py` and edit the
`CANDIDATE_TICKERS` list.  Comments in that file explain the inclusion criteria.

Price-range and minimum-volume filters are also configurable in that file:

```python
MIN_PRICE: float = 0.50   # USD
MAX_PRICE: float = 5.00   # USD
MIN_AVG_VOLUME: int = 100_000
```

### How GitHub Actions updates rankings

The workflow file is `.github/workflows/penny-stock-rankings.yml`.
It can also be triggered manually via **Actions → Penny Stock Rankings →
Run workflow**.

### How to deploy with GitHub Pages

The repo is already configured for GitHub Pages.  No additional deployment
steps are needed – pushing `penny-stock-rankings.json` (via the Action or
manually) will make the dashboard update automatically on the next page load.

### Data sources

All data is free and public:

- **Stooq** (`stooq.com`) – primary OHLCV CSV source
- **Yahoo Finance** (unofficial CSV download) – fallback

No paid APIs, no broker accounts, and no OpenAI API are used.  Data may be
delayed by 15–60 minutes.  The source is noted in the JSON output and on the
dashboard.