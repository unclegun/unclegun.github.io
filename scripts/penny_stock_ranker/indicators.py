"""
indicators.py – Technical indicator calculations.

All functions accept a pandas DataFrame with at minimum a 'close' column
(plus 'volume' for volume-based indicators) and return scalar values or
series as documented.
"""

from __future__ import annotations

import math
from typing import Optional

import pandas as pd


# ---------------------------------------------------------------------------
# Moving averages
# ---------------------------------------------------------------------------

def sma(series: pd.Series, period: int) -> Optional[float]:
    """Simple moving average over the last *period* values.  Returns None if
    there are fewer than *period* rows."""
    s = series.dropna()
    if len(s) < period:
        return None
    return float(s.tail(period).mean())


# ---------------------------------------------------------------------------
# RSI (Wilder / Cutler variant using EMA of gains/losses)
# ---------------------------------------------------------------------------

def rsi(close: pd.Series, period: int = 14) -> Optional[float]:
    """
    Relative Strength Index for the most recent bar.

    Uses Wilder's smoothing (exponential with alpha=1/period).
    Returns None if there are insufficient rows.
    """
    s = close.dropna()
    if len(s) < period + 1:
        return None

    delta = s.diff().dropna()
    gains = delta.clip(lower=0)
    losses = (-delta).clip(lower=0)

    avg_gain = gains.ewm(com=period - 1, min_periods=period).mean().iloc[-1]
    avg_loss = losses.ewm(com=period - 1, min_periods=period).mean().iloc[-1]

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


# ---------------------------------------------------------------------------
# Volatility
# ---------------------------------------------------------------------------

def daily_volatility(close: pd.Series, period: int = 20) -> Optional[float]:
    """
    Annualised daily-returns standard deviation over the last *period* bars.

    Returns a fraction (e.g. 0.12 = 12 % annualised volatility), or None.
    """
    s = close.dropna()
    if len(s) < period + 1:
        return None
    log_returns = s.pct_change().dropna().tail(period)
    if log_returns.empty:
        return None
    vol = float(log_returns.std() * math.sqrt(252))
    return round(vol, 4) if not math.isnan(vol) else None


# ---------------------------------------------------------------------------
# Volume indicators
# ---------------------------------------------------------------------------

def average_volume(volume: pd.Series, period: int = 20) -> Optional[float]:
    """Average daily volume over the last *period* trading days."""
    s = volume.dropna()
    if len(s) < period:
        return None
    return float(s.tail(period).mean())


def relative_volume(volume: pd.Series, period: int = 20) -> Optional[float]:
    """Most-recent volume divided by the average volume."""
    avg = average_volume(volume, period)
    if avg is None or avg == 0:
        return None
    latest = volume.dropna().iloc[-1]
    return round(float(latest) / avg, 2)


# ---------------------------------------------------------------------------
# Momentum / price-change helpers
# ---------------------------------------------------------------------------

def n_day_change(close: pd.Series, n: int) -> Optional[float]:
    """
    Percentage change in close price over the last *n* trading days.

    Returns None if insufficient data.
    """
    s = close.dropna()
    if len(s) < n + 1:
        return None
    prev = s.iloc[-(n + 1)]
    latest = s.iloc[-1]
    if prev == 0:
        return None
    return round(((latest - prev) / abs(prev)) * 100, 2)


# ---------------------------------------------------------------------------
# Entry / stop / target helpers
# ---------------------------------------------------------------------------

def suggested_entry(latest_price: float, sma5: Optional[float]) -> dict:
    """
    Suggest a buy-zone based on the current price and SMA5.
    """
    if sma5 and sma5 < latest_price:
        low = round(max(sma5, latest_price * 0.98), 4)
    else:
        low = round(latest_price * 0.98, 4)
    high = round(latest_price * 1.02, 4)
    return {"low": low, "high": high}


def suggested_stop(latest_price: float, volatility: Optional[float]) -> float:
    """
    Suggest a stop-loss at roughly 1× daily volatility below entry.
    Minimum 3 % below latest price.
    """
    if volatility and volatility > 0:
        # Convert annualised vol to a daily multiple (1× daily std)
        daily_move = volatility / math.sqrt(252)
        stop = round(latest_price * (1 - max(daily_move * 1.5, 0.03)), 4)
    else:
        stop = round(latest_price * 0.97, 4)
    return stop


def suggested_target(latest_price: float, volatility: Optional[float]) -> float:
    """
    Suggest a take-profit at roughly 2–3× the stop distance (2 : 1 R/R minimum).
    """
    stop = suggested_stop(latest_price, volatility)
    risk = latest_price - stop
    target = round(latest_price + risk * 2.0, 4)
    return target
