"""
data_sources.py – Fetches historical price/volume data from free public sources.

Currently implemented:
  - Stooq (https://stooq.com) – returns CSV of daily OHLCV data.

To swap to a different provider, implement a new function with the same
signature as fetch_history() and update the import alias at the bottom.

Returned DataFrame columns (all lower-case):
    date      – pd.Timestamp
    open      – float
    high      – float
    low       – float
    close     – float
    volume    – float

The DataFrame is sorted ascending by date.
"""

from __future__ import annotations

import io
import time
from typing import Optional

import pandas as pd
import requests

from .utils import get_logger

logger = get_logger()

# ---------------------------------------------------------------------------
# HTTP session (shared for keep-alive)
# ---------------------------------------------------------------------------
_SESSION = requests.Session()
_SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (compatible; penny-stock-ranker/1.0; "
        "+https://github.com/unclegun/unclegun.github.io)"
    )
})

_REQUEST_TIMEOUT = 15  # seconds
_RETRY_DELAY = 2.0     # seconds between retries
_MAX_RETRIES = 2


# ---------------------------------------------------------------------------
# Stooq provider
# ---------------------------------------------------------------------------

_STOOQ_BASE = "https://stooq.com/q/d/l/"


def _fetch_stooq(ticker: str, days: int = 60) -> Optional[pd.DataFrame]:
    """
    Fetch daily OHLCV data from Stooq for a US-listed ticker.

    Stooq tickers for US stocks use the '.US' suffix, e.g. 'AAPL.US'.
    Returns None on failure.
    """
    stooq_ticker = f"{ticker.upper()}.US"
    params = {"s": stooq_ticker, "i": "d"}

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            resp = _SESSION.get(_STOOQ_BASE, params=params,
                                timeout=_REQUEST_TIMEOUT)
            if resp.status_code != 200:
                logger.warning(
                    "Stooq %s: HTTP %s (attempt %d)",
                    ticker, resp.status_code, attempt
                )
                time.sleep(_RETRY_DELAY)
                continue

            text = resp.text.strip()
            if not text or text.startswith("No data"):
                logger.warning("Stooq %s: no data returned", ticker)
                return None

            df = pd.read_csv(io.StringIO(text))

            # Normalise column names
            df.columns = [c.strip().lower() for c in df.columns]

            required = {"date", "open", "high", "low", "close", "volume"}
            if not required.issubset(df.columns):
                logger.warning(
                    "Stooq %s: unexpected columns %s", ticker, list(df.columns)
                )
                return None

            df["date"] = pd.to_datetime(df["date"], errors="coerce")
            for col in ("open", "high", "low", "close", "volume"):
                df[col] = pd.to_numeric(df[col], errors="coerce")

            df = df.dropna(subset=["date", "close"]).sort_values("date").reset_index(drop=True)

            # Keep only the requested number of recent trading days
            if len(df) > days:
                df = df.tail(days).reset_index(drop=True)

            if df.empty:
                logger.warning("Stooq %s: empty after cleaning", ticker)
                return None

            return df[["date", "open", "high", "low", "close", "volume"]]

        except requests.RequestException as exc:
            logger.warning(
                "Stooq %s: request error on attempt %d: %s", ticker, attempt, exc
            )
            time.sleep(_RETRY_DELAY)

    return None


# ---------------------------------------------------------------------------
# Yahoo Finance fallback (unofficial CSV endpoint)
# ---------------------------------------------------------------------------

def _fetch_yahoo(ticker: str, days: int = 60) -> Optional[pd.DataFrame]:
    """
    Fallback: fetch daily OHLCV via Yahoo Finance's download CSV endpoint.

    Note: This uses Yahoo's public (unofficial) CSV export and may break
    without notice.  Stooq is preferred.
    """
    end_ts = int(time.time())
    start_ts = end_ts - days * 24 * 3600

    url = (
        f"https://query1.finance.yahoo.com/v7/finance/download/{ticker.upper()}"
        f"?period1={start_ts}&period2={end_ts}&interval=1d&events=history"
    )

    try:
        resp = _SESSION.get(url, timeout=_REQUEST_TIMEOUT)
        if resp.status_code != 200:
            logger.warning("Yahoo %s: HTTP %s", ticker, resp.status_code)
            return None

        df = pd.read_csv(io.StringIO(resp.text))
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

        # Yahoo uses 'adj_close'; we alias it to 'close' when 'close' absent
        if "adj_close" in df.columns and "close" not in df.columns:
            df.rename(columns={"adj_close": "close"}, inplace=True)

        required = {"date", "close", "volume"}
        if not required.issubset(df.columns):
            logger.warning("Yahoo %s: missing columns", ticker)
            return None

        for col in ("open", "high", "low", "close", "volume"):
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.dropna(subset=["date", "close"]).sort_values("date").reset_index(drop=True)

        # Ensure all OHLCV columns exist
        for col in ("open", "high", "low"):
            if col not in df.columns:
                df[col] = df["close"]

        return df[["date", "open", "high", "low", "close", "volume"]]

    except Exception as exc:
        logger.warning("Yahoo %s: error: %s", ticker, exc)
        return None


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def fetch_history(ticker: str, days: int = 60) -> Optional[pd.DataFrame]:
    """
    Fetch historical OHLCV data for *ticker* covering approximately *days*
    recent calendar days.

    Tries Stooq first, falls back to Yahoo Finance.

    Returns a DataFrame with columns [date, open, high, low, close, volume]
    sorted ascending by date, or None if all sources fail.
    """
    df = _fetch_stooq(ticker, days)
    if df is not None and len(df) >= 5:
        return df

    logger.info("%s: Stooq failed or insufficient rows – trying Yahoo", ticker)
    df = _fetch_yahoo(ticker, days)
    if df is not None and len(df) >= 5:
        return df

    return None
