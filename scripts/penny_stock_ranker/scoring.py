"""
scoring.py – Deterministic scoring model for penny-stock candidates.

Scoring breakdown (max raw score ≈ 100 before risk adjustment):
  Relative volume  : 0 – 30 pts
  Momentum         : 0 – 25 pts
  Trend strength   : 0 – 20 pts
  Liquidity        : 0 – 15 pts
  RSI quality      : 0 – 10 pts
  Risk adjustment  : –25 to +5 pts

Final score is capped to [0, 100].
"""

from __future__ import annotations

import math
from typing import Optional


# ---------------------------------------------------------------------------
# Sub-score helpers
# ---------------------------------------------------------------------------

def _score_relative_volume(rv: Optional[float]) -> tuple[float, list[str], list[str]]:
    """30 pts max.  Rewards unusually high volume."""
    justification: list[str] = []
    warnings: list[str] = []
    if rv is None:
        warnings.append("Volume data unavailable; volume score set to 0.")
        return 0.0, justification, warnings
    if rv >= 4.0:
        pts = 30.0
        justification.append(
            f"Relative volume is {rv:.2f}x average, indicating very strong market interest."
        )
    elif rv >= 2.5:
        pts = 22.0
        justification.append(
            f"Relative volume is {rv:.2f}x average, indicating above-average market activity."
        )
    elif rv >= 1.5:
        pts = 14.0
        justification.append(
            f"Relative volume is {rv:.2f}x average; moderate elevated interest."
        )
    elif rv >= 1.0:
        pts = 7.0
    else:
        pts = max(0.0, rv * 7.0)
        warnings.append(
            f"Volume ({rv:.2f}x avg) is below average; liquidity may be limited."
        )
    return pts, justification, warnings


def _score_momentum(
    pct1d: Optional[float],
    pct5d: Optional[float],
    pct20d: Optional[float],
) -> tuple[float, list[str], list[str]]:
    """25 pts max.  Rewards consistent positive momentum."""
    justification: list[str] = []
    warnings: list[str] = []
    pts = 0.0

    # 1-day: up to 8 pts
    if pct1d is None:
        warnings.append("1-day price change unavailable.")
    elif pct1d >= 5:
        pts += 8.0
        justification.append(
            f"Strong single-day price gain of +{pct1d:.1f}%."
        )
    elif pct1d >= 2:
        pts += 5.0
        justification.append(f"Positive 1-day price move of +{pct1d:.1f}%.")
    elif pct1d >= 0:
        pts += 2.0
    else:
        # Penalise negative day slightly
        pts += max(-4.0, pct1d * 0.4)

    # 5-day: up to 9 pts
    if pct5d is None:
        warnings.append("5-day price change unavailable.")
    elif pct5d >= 10:
        pts += 9.0
        justification.append(
            f"Strong 5-day momentum of +{pct5d:.1f}%."
        )
    elif pct5d >= 5:
        pts += 6.0
        justification.append(f"Positive 5-day price trend of +{pct5d:.1f}%.")
    elif pct5d >= 0:
        pts += 2.0
    else:
        pts += max(-4.0, pct5d * 0.3)

    # 20-day: up to 8 pts
    if pct20d is None:
        warnings.append("20-day price change unavailable.")
    elif pct20d >= 20:
        pts += 8.0
        justification.append(
            f"Sustained 20-day uptrend of +{pct20d:.1f}%."
        )
    elif pct20d >= 10:
        pts += 5.0
        justification.append(f"Positive 20-day trend of +{pct20d:.1f}%.")
    elif pct20d >= 0:
        pts += 2.0
    else:
        pts += max(-5.0, pct20d * 0.25)

    if pct5d and pct5d > 0 and pct20d and pct20d > 0:
        justification.append("Short-term and 20-day momentum are both positive.")

    return max(pts, 0.0), justification, warnings


def _score_trend(
    price: float,
    sma5: Optional[float],
    sma20: Optional[float],
) -> tuple[float, list[str], list[str]]:
    """20 pts max.  Rewards price above moving averages (bullish alignment)."""
    justification: list[str] = []
    warnings: list[str] = []
    pts = 0.0

    above5 = sma5 is not None and price > sma5
    above20 = sma20 is not None and price > sma20

    if above5 and above20:
        pts = 20.0
        justification.append(
            "Price is trading above both the 5-day and 20-day moving averages."
        )
    elif above5:
        pts = 12.0
        justification.append("Price is above the 5-day moving average.")
    elif above20:
        pts = 8.0
        justification.append("Price is above the 20-day moving average.")
    else:
        if sma5 is None and sma20 is None:
            warnings.append("Moving averages unavailable; trend score set to 0.")
        else:
            warnings.append("Price is below key moving averages; trend is not bullish.")

    # Bonus: SMA5 > SMA20 (short-term MA above long-term MA = golden-cross alignment)
    if sma5 is not None and sma20 is not None and sma5 > sma20:
        pts = min(pts + 3.0, 20.0)
        justification.append("5-day MA is above 20-day MA (bullish alignment).")

    return pts, justification, warnings


def _score_liquidity(avg_vol: Optional[float]) -> tuple[float, list[str], list[str]]:
    """15 pts max.  Rewards sufficient average daily volume."""
    justification: list[str] = []
    warnings: list[str] = []
    if avg_vol is None or avg_vol <= 0:
        warnings.append("Average volume data unavailable; liquidity score set to 0.")
        return 0.0, justification, warnings
    if avg_vol >= 5_000_000:
        pts = 15.0
    elif avg_vol >= 1_000_000:
        pts = 11.0
    elif avg_vol >= 500_000:
        pts = 7.0
    elif avg_vol >= 100_000:
        pts = 4.0
    else:
        pts = 0.0
        warnings.append(
            f"Average volume ({avg_vol:,.0f} shares) is very low; "
            "wide spreads and slippage risk are elevated."
        )
    if pts > 0:
        justification.append(
            f"Average daily volume is {avg_vol:,.0f} shares, indicating adequate liquidity."
        )
    return pts, justification, warnings


def _score_rsi(rsi_val: Optional[float]) -> tuple[float, list[str], list[str]]:
    """10 pts max.  Rewards RSI in momentum-positive but not overbought zone."""
    justification: list[str] = []
    warnings: list[str] = []
    if rsi_val is None:
        warnings.append("RSI unavailable; RSI score set to 0.")
        return 0.0, justification, warnings
    if 50 <= rsi_val <= 70:
        pts = 10.0
        justification.append(
            f"RSI of {rsi_val:.1f} is in a healthy momentum zone (50–70)."
        )
    elif 40 <= rsi_val < 50:
        pts = 6.0
        justification.append(f"RSI of {rsi_val:.1f} shows mild bullish momentum building.")
    elif 70 < rsi_val <= 80:
        pts = 4.0
        justification.append(
            f"RSI is elevated at {rsi_val:.1f} but not yet in extreme overbought territory."
        )
    elif rsi_val > 80:
        pts = 0.0
        warnings.append(
            f"RSI is {rsi_val:.1f} – significantly overbought; risk of near-term pullback."
        )
    else:
        pts = 2.0  # oversold – possible reversal setup but not primary signal
    return pts, justification, warnings


def _risk_adjustment(
    volatility: Optional[float],
    pct1d: Optional[float],
) -> tuple[float, list[str], list[str]]:
    """
    –25 to +5 pts.

    Penalises extreme volatility and single-session price spikes that may
    signal a blow-off top rather than a genuine trend.
    """
    justification: list[str] = []
    warnings: list[str] = []
    adj = 0.0

    if volatility is not None:
        if volatility > 1.5:
            adj -= 25.0
            warnings.append(
                f"Annualised volatility is extremely high ({volatility:.0%}), "
                "suggesting highly speculative behaviour."
            )
        elif volatility > 1.0:
            adj -= 15.0
            warnings.append(
                f"High annualised volatility ({volatility:.0%}); risk is elevated."
            )
        elif volatility > 0.60:
            adj -= 8.0
            warnings.append(
                f"Above-average volatility ({volatility:.0%}); position-size carefully."
            )
        elif volatility > 0.30:
            adj -= 2.0
        else:
            adj += 2.0
            justification.append(
                "Volatility is moderate and consistent with a controlled move."
            )

    # Penalise if today's move is very large (>15 %) – may be one-day spike
    if pct1d is not None and pct1d > 15:
        adj -= 10.0
        warnings.append(
            f"Single-session move of +{pct1d:.1f}% is very large; "
            "chasing a spike carries elevated reversal risk."
        )

    adj = max(-25.0, min(adj, 5.0))
    return adj, justification, warnings


# ---------------------------------------------------------------------------
# Confidence label
# ---------------------------------------------------------------------------

def confidence_label(score: float) -> str:
    if score >= 70:
        return "Strong Candidate"
    if score >= 45:
        return "Moderate Candidate"
    return "Watch Only"


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def score_ticker(
    ticker: str,
    latest_price: float,
    previous_close: Optional[float],
    pct1d: Optional[float],
    pct5d: Optional[float],
    pct20d: Optional[float],
    volume: Optional[float],
    avg_volume: Optional[float],
    rel_volume: Optional[float],
    rsi_val: Optional[float],
    sma5: Optional[float],
    sma20: Optional[float],
    volatility: Optional[float],
) -> dict:
    """
    Compute a deterministic score for a ticker and return a rich dict
    suitable for direct JSON serialisation.
    """
    justification: list[str] = []
    warnings: list[str] = []

    v_pts, v_just, v_warn = _score_relative_volume(rel_volume)
    m_pts, m_just, m_warn = _score_momentum(pct1d, pct5d, pct20d)
    t_pts, t_just, t_warn = _score_trend(latest_price, sma5, sma20)
    l_pts, l_just, l_warn = _score_liquidity(avg_volume)
    r_pts, r_just, r_warn = _score_rsi(rsi_val)
    adj_pts, adj_just, adj_warn = _risk_adjustment(volatility, pct1d)

    justification.extend(v_just + m_just + t_just + l_just + r_just + adj_just)
    warnings.extend(v_warn + m_warn + t_warn + l_warn + r_warn + adj_warn)

    # Always add data-freshness note
    warnings.append("Free data may be delayed by 15–60 minutes.")

    raw = v_pts + m_pts + t_pts + l_pts + r_pts + adj_pts
    total = round(max(0.0, min(100.0, raw)), 1)

    from .indicators import suggested_entry, suggested_stop, suggested_target
    entry = suggested_entry(latest_price, sma5)
    stop = suggested_stop(latest_price, volatility)
    target = suggested_target(latest_price, volatility)

    def _r(v, d=4):
        if v is None:
            return None
        try:
            if math.isnan(v):
                return None
        except TypeError:
            return None
        return round(v, d)

    return {
        "score": total,
        "confidence": confidence_label(total),
        "scores": {
            "volume": round(v_pts, 1),
            "momentum": round(m_pts, 1),
            "trend": round(t_pts, 1),
            "liquidity": round(l_pts, 1),
            "rsi": round(r_pts, 1),
            "riskAdjustment": round(adj_pts, 1),
            "total": total,
        },
        "latestPrice": _r(latest_price, 4),
        "previousClose": _r(previous_close, 4),
        "percentChange": _r(pct1d, 2),
        "fiveDayChange": _r(pct5d, 2),
        "twentyDayChange": _r(pct20d, 2),
        "volume": int(volume) if volume is not None else None,
        "averageVolume": int(avg_volume) if avg_volume is not None else None,
        "relativeVolume": _r(rel_volume, 2),
        "rsi": _r(rsi_val, 2),
        "sma5": _r(sma5, 4),
        "sma20": _r(sma20, 4),
        "volatility": _r(volatility, 4),
        "entryZone": entry,
        "stopLoss": _r(stop, 4),
        "target": _r(target, 4),
        "justification": justification,
        "warnings": warnings,
    }
