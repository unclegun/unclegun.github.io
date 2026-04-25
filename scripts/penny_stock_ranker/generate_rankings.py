"""
generate_rankings.py – Orchestrates daily penny-stock ranking generation.

Usage:
    python scripts/penny_stock_ranker/generate_rankings.py

Output:
    data/penny-stock-rankings.json          (latest rankings – overwrites)
    data/penny-stock-history/YYYY-MM-DD.json (dated snapshot – appends)

The script is designed to be run from the repository root so that relative
paths resolve correctly.  The GitHub Action sets the working directory to the
repo root automatically.

Exit codes:
    0 – success (even if no tickers qualified)
    1 – unexpected fatal error
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Allow running as both a script and as part of the package
_REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO_ROOT / "scripts"))

from penny_stock_ranker.data_sources import fetch_history
from penny_stock_ranker.indicators import (
    average_volume,
    daily_volatility,
    n_day_change,
    relative_volume,
    rsi,
    sma,
)
from penny_stock_ranker.scoring import score_ticker
from penny_stock_ranker.universe import (
    MAX_PRICE,
    MIN_AVG_VOLUME,
    MIN_PRICE,
    get_candidate_tickers,
)
from penny_stock_ranker.utils import get_logger, today_str, utc_now_iso

logger = get_logger()

# ---------------------------------------------------------------------------
# Output paths
# ---------------------------------------------------------------------------
DATA_DIR = _REPO_ROOT / "data"
RANKINGS_FILE = DATA_DIR / "penny-stock-rankings.json"
HISTORY_DIR = DATA_DIR / "penny-stock-history"


def _process_ticker(ticker: str) -> dict | None:
    """
    Fetch data for *ticker*, compute indicators and score.

    Returns a result dict or None if the ticker should be skipped.
    """
    df = fetch_history(ticker, days=60)

    if df is None or df.empty:
        logger.info("SKIP %s: no data returned", ticker)
        return None

    if len(df) < 6:
        logger.info("SKIP %s: insufficient history (%d rows)", ticker, len(df))
        return None

    close = df["close"]
    volume_series = df["volume"]

    latest_price = float(close.iloc[-1])
    prev_close = float(close.iloc[-2]) if len(close) >= 2 else None

    # Price range filter
    if not (MIN_PRICE <= latest_price <= MAX_PRICE):
        logger.info(
            "SKIP %s: price $%.4f is outside [$%.2f, $%.2f]",
            ticker, latest_price, MIN_PRICE, MAX_PRICE,
        )
        return None

    # Volume filter
    avg_vol = average_volume(volume_series, period=20)
    if avg_vol is None or avg_vol < MIN_AVG_VOLUME:
        logger.info(
            "SKIP %s: avg volume %.0f < threshold %d",
            ticker, avg_vol or 0, MIN_AVG_VOLUME,
        )
        return None

    # Latest volume
    latest_vol = float(volume_series.iloc[-1]) if not volume_series.empty else None

    # Indicators
    pct1d = n_day_change(close, 1)
    pct5d = n_day_change(close, 5)
    pct20d = n_day_change(close, 20)
    rel_vol = relative_volume(volume_series, period=20)
    rsi_val = rsi(close, period=14)
    sma5_val = sma(close, 5)
    sma20_val = sma(close, 20)
    vol_val = daily_volatility(close, period=20)

    result = score_ticker(
        ticker=ticker,
        latest_price=latest_price,
        previous_close=prev_close,
        pct1d=pct1d,
        pct5d=pct5d,
        pct20d=pct20d,
        volume=latest_vol,
        avg_volume=avg_vol,
        rel_volume=rel_vol,
        rsi_val=rsi_val,
        sma5=sma5_val,
        sma20=sma20_val,
        volatility=vol_val,
    )

    result["ticker"] = ticker
    result["companyName"] = ticker   # Free sources don't always supply names

    return result


def generate() -> None:
    tickers = get_candidate_tickers()
    logger.info("Starting ranking run for %d candidate tickers", len(tickers))

    ranked: list[dict] = []
    skipped: list[str] = []

    for ticker in tickers:
        try:
            result = _process_ticker(ticker)
            if result is not None:
                ranked.append(result)
            else:
                skipped.append(ticker)
        except Exception as exc:  # noqa: BLE001
            logger.warning("ERROR processing %s: %s – skipping", ticker, exc)
            skipped.append(ticker)

    # Sort descending by score
    ranked.sort(key=lambda x: x.get("score", 0), reverse=True)

    # Assign ranks
    for idx, item in enumerate(ranked, start=1):
        item["rank"] = idx

    logger.info(
        "Ranking complete: %d qualified, %d skipped",
        len(ranked), len(skipped),
    )
    if skipped:
        logger.info("Skipped tickers: %s", ", ".join(skipped))

    output = {
        "generatedAt": utc_now_iso(),
        "sourceNote": (
            "Generated from free delayed/public market data via Stooq / Yahoo Finance. "
            "Data may be delayed 15–60 minutes. For research and educational use only."
        ),
        "qualifiedCount": len(ranked),
        "skippedCount": len(skipped),
        "rankings": ranked,
    }

    # Write latest
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    RANKINGS_FILE.write_text(json.dumps(output, indent=2), encoding="utf-8")
    logger.info("Wrote %s", RANKINGS_FILE)

    # Write dated snapshot
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    snapshot_file = HISTORY_DIR / f"{today_str()}.json"
    snapshot_file.write_text(json.dumps(output, indent=2), encoding="utf-8")
    logger.info("Wrote snapshot %s", snapshot_file)


if __name__ == "__main__":
    try:
        generate()
    except Exception as exc:  # noqa: BLE001
        logger.error("Fatal error: %s", exc, exc_info=True)
        sys.exit(1)
