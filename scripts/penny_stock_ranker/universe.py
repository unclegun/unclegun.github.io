"""
universe.py – Manages the penny-stock candidate universe.

The list below is the default starting set.  To expand it:
  1. Add tickers to CANDIDATE_TICKERS.
  2. Re-run generate_rankings.py (or let the daily GitHub Action run it).

Criteria for inclusion:
  - Listed (NYSE / Nasdaq / NYSE American), not OTC/Pink Sheets.
  - Price range roughly $0.50 – $5.00 (enforced in scoring.py).
  - Sufficient daily volume for reliable data (≥ 100 000 shares/day typical).
  - Recent trading activity (not halted / delisted).

Feel free to remove tickers that have been acquired, delisted, or now trade
above the penny-stock price threshold.
"""

# ---------------------------------------------------------------------------
# Default candidate universe
# ---------------------------------------------------------------------------
# fmt: off
CANDIDATE_TICKERS: list[str] = [
    # Energy / Resources
    "TELL",  # Tellurian Inc.
    "CEI",   # Camber Energy
    "SOS",   # SOS Limited
    "UUUU",  # Energy Fuels
    "NR",    # Newpark Resources

    # Biotech / Pharma
    "SNDX",  # Syndax Pharmaceuticals
    "ASRT",  # Assertio Holdings
    "ACST",  # Acasti Pharma
    "IDEX",  # Ideanomics
    "NKTR",  # Nektar Therapeutics

    # Technology
    "BBAI",  # BigBear.ai
    "KULR",  # KULR Technology
    "SIFY",  # Sify Technologies
    "MVIS",  # MicroVision
    "HLIT",  # Harmonic Inc.

    # Financial / SPAC / Other
    "NRXP",  # NRx Pharmaceuticals
    "CLOV",  # Clover Health
    "RIDE",  # Lordstown Motors
    "XPEV",  # XPeng (higher-priced but included for demonstration)
    "SOLO",  # Electrameccanica Vehicles

    # Additional diversification
    "SHIP",  # Seanergy Maritime
    "ZOM",   # Zomedica Corp
    "MULN",  # Mullen Automotive
    "NKLA",  # Nikola Corporation
    "HCMC",  # Healthier Choices Management
]
# fmt: on

# ---------------------------------------------------------------------------
# Price-range filter (applied in generate_rankings.py after fetching data)
# ---------------------------------------------------------------------------
MIN_PRICE: float = 0.50   # USD
MAX_PRICE: float = 5.00   # USD
MIN_AVG_VOLUME: int = 100_000  # shares per day


def get_candidate_tickers() -> list[str]:
    """Return the full candidate ticker list (deduped, uppercased)."""
    return list(dict.fromkeys(t.upper().strip() for t in CANDIDATE_TICKERS))
