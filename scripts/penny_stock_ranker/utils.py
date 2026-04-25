"""
utils.py – Shared helpers used across the penny-stock-ranker package.
"""

from __future__ import annotations

import logging
import math
import sys
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Logger
# ---------------------------------------------------------------------------

def get_logger(name: str = "penny_stock_ranker") -> logging.Logger:
    """Return a consistently configured logger."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s  %(levelname)-8s  %(message)s",
                              datefmt="%Y-%m-%d %H:%M:%S")
        )
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger


# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------

def utc_now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string (no microseconds)."""
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def today_str() -> str:
    """Return today's date as YYYY-MM-DD (UTC)."""
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# Number helpers
# ---------------------------------------------------------------------------

def safe_round(value: float | None, digits: int = 4) -> float | None:
    """Round a float, returning None if value is None or non-finite."""
    if value is None:
        return None
    try:
        if math.isnan(value) or math.isinf(value):
            return None
        return round(float(value), digits)
    except (TypeError, ValueError):
        return None


def pct_change(new: float, old: float) -> float | None:
    """Percentage change from old to new, rounded to 2 dp."""
    if old is None or old == 0:
        return None
    return safe_round(((new - old) / abs(old)) * 100, 2)
