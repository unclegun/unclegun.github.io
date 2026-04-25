/**
 * penny-stock-ranker.js
 * Frontend logic for the Penny Stock Ranker dashboard.
 */

(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────────
  let allRankings = [];
  let sortKey = "score";
  let sortDir = "desc"; // "asc" | "desc"
  let expandedTicker = null;

  // ── DOM refs ───────────────────────────────────────────────────────────
  const generatedAtEl = document.getElementById("generatedAt");
  const summaryTopEl = document.getElementById("summaryTop");
  const summaryCountEl = document.getElementById("summaryCount");
  const summaryAvgScoreEl = document.getElementById("summaryAvgScore");
  const summaryRvolEl = document.getElementById("summaryRvol");
  const filterTickerEl = document.getElementById("filterTicker");
  const filterMinScoreEl = document.getElementById("filterMinScore");
  const filterConfidenceEl = document.getElementById("filterConfidence");
  const sortByEl = document.getElementById("sortBy");
  const tableBodyEl = document.getElementById("rankingsBody");
  const tableSection = document.getElementById("tableSection");
  const emptyStateEl = document.getElementById("emptyState");

  // ── Formatters ─────────────────────────────────────────────────────────

  function fmtPrice(v) {
    if (v == null) return "—";
    return "$" + Number(v).toFixed(2);
  }

  function fmtPct(v) {
    if (v == null) return "—";
    const n = Number(v);
    const sign = n >= 0 ? "+" : "";
    return sign + n.toFixed(2) + "%";
  }

  function fmtVol(v) {
    if (v == null) return "—";
    const n = Number(v);
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return n.toLocaleString();
  }

  function fmtRvol(v) {
    if (v == null) return "—";
    return Number(v).toFixed(2) + "x";
  }

  function fmtRsi(v) {
    if (v == null) return "—";
    return Number(v).toFixed(1);
  }

  function fmtScore(v) {
    if (v == null) return "—";
    return Number(v).toFixed(1);
  }

  function pctClass(v) {
    if (v == null) return "";
    return Number(v) >= 0 ? "positive" : "negative";
  }

  // ── Confidence badge ────────────────────────────────────────────────────

  function confidenceBadge(label) {
    const map = {
      "Strong Candidate": "badge-strong",
      "Moderate Candidate": "badge-moderate",
      "Watch Only": "badge-watch",
    };
    const cls = map[label] || "badge-watch";
    return `<span class="badge-confidence ${cls}">${label}</span>`;
  }

  // ── Score bar ───────────────────────────────────────────────────────────

  function scoreBar(score) {
    const pct = Math.min(100, Math.max(0, Number(score)));
    return `
      <div class="score-cell">
        <span>${fmtScore(score)}</span>
        <div class="score-bar-wrap">
          <div class="score-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }

  // ── Rank cell ───────────────────────────────────────────────────────────

  function rankCell(rank) {
    if (rank === 1) return `<span class="rank-badge-1">1</span>`;
    return `<span>${rank}</span>`;
  }

  // ── Entry zone cell ─────────────────────────────────────────────────────

  function entryCell(entry) {
    if (!entry) return "—";
    return `${fmtPrice(entry.low)} – ${fmtPrice(entry.high)}`;
  }

  // ── Detail card HTML ────────────────────────────────────────────────────

  function buildDetailCard(item) {
    // Score breakdown
    const s = item.scores || {};
    const scoreRows = [
      ["Relative Volume", s.volume],
      ["Momentum", s.momentum],
      ["Trend", s.trend],
      ["Liquidity", s.liquidity],
      ["RSI Quality", s.rsi],
      ["Risk Adjustment", s.riskAdjustment],
    ]
      .map(([dim, pts]) => {
        const n = Number(pts);
        const cls = n < 0 ? "negative" : "";
        return `<div class="score-row">
          <span class="score-dim">${dim}</span>
          <span class="score-pts ${cls}">${n >= 0 ? "+" : ""}${n.toFixed(1)}</span>
        </div>`;
      })
      .join("");

    // Justification bullets
    const justHtml = (item.justification || [])
      .map((t) => `<li>${t}</li>`)
      .join("");

    // Warning bullets
    const warnHtml = (item.warnings || [])
      .map((t) => `<li class="warning">${t}</li>`)
      .join("");

    // Key metrics chips
    const chips = [
      { label: "SMA 5", value: fmtPrice(item.sma5) },
      { label: "SMA 20", value: fmtPrice(item.sma20) },
      { label: "Volatility", value: item.volatility != null ? (item.volatility * 100).toFixed(1) + "%" : "—" },
      { label: "5-day Chg", value: fmtPct(item.fiveDayChange), cls: pctClass(item.fiveDayChange) },
      { label: "20-day Chg", value: fmtPct(item.twentyDayChange), cls: pctClass(item.twentyDayChange) },
      { label: "Avg Volume", value: fmtVol(item.averageVolume) },
    ]
      .map(
        (c) =>
          `<div class="metric-chip">
            <span class="chip-label">${c.label}</span>
            <span class="chip-value ${c.cls || ""}">${c.value}</span>
          </div>`
      )
      .join("");

    return `
      <div class="detail-card">
        <div class="detail-grid">
          <div>
            <div class="detail-section">
              <h5>Justification</h5>
              <ul>${justHtml}${warnHtml}</ul>
            </div>
            <div class="detail-section" style="margin-top:0.9rem">
              <h5>Key Metrics</h5>
              <div class="metrics-mini">${chips}</div>
            </div>
          </div>
          <div>
            <div class="detail-section">
              <h5>Score Breakdown</h5>
              <div class="score-breakdown">${scoreRows}</div>
            </div>
            <div class="detail-section" style="margin-top:0.9rem">
              <h5>Trade Zones</h5>
              <div class="zone-chips">
                <span class="zone-chip zone-entry">
                  Entry: ${entryCell(item.entryZone)}
                </span>
                <span class="zone-chip zone-stop">
                  Stop: ${fmtPrice(item.stopLoss)}
                </span>
                <span class="zone-chip zone-target">
                  Target: ${fmtPrice(item.target)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ── Render table ────────────────────────────────────────────────────────

  function getFilteredSorted() {
    const tickerQ = (filterTickerEl.value || "").toUpperCase().trim();
    const minScore = parseFloat(filterMinScoreEl.value) || 0;
    const confFilter = filterConfidenceEl.value || "";

    let list = allRankings.filter((item) => {
      if (tickerQ && !item.ticker.toUpperCase().includes(tickerQ)) return false;
      if (item.score < minScore) return false;
      if (confFilter && item.confidence !== confFilter) return false;
      return true;
    });

    // Sort
    const key = sortByEl ? sortByEl.value : sortKey;
    const keyMap = {
      score: "score",
      relativeVolume: "relativeVolume",
      percentChange: "percentChange",
      rsi: "rsi",
      volume: "volume",
    };
    const field = keyMap[key] || "score";

    list.sort((a, b) => {
      const av = a[field] ?? -Infinity;
      const bv = b[field] ?? -Infinity;
      return sortDir === "desc" ? bv - av : av - bv;
    });

    return list;
  }

  function renderTable() {
    const list = getFilteredSorted();

    if (list.length === 0) {
      tableSection.style.display = "none";
      emptyStateEl.style.display = "block";
      return;
    }

    tableSection.style.display = "block";
    emptyStateEl.style.display = "none";

    tableBodyEl.innerHTML = list
      .map((item) => {
        const isTop = item.rank === 1;
        const isExpanded = expandedTicker === item.ticker;
        const rowCls = [isTop ? "top-ranked" : "", isExpanded ? "expanded" : ""]
          .filter(Boolean)
          .join(" ");

        const dataRow = `
          <tr class="${rowCls}" data-ticker="${item.ticker}">
            <td class="rank-cell">${rankCell(item.rank)}</td>
            <td class="ticker-cell">${item.ticker}</td>
            <td>${scoreBar(item.score)}</td>
            <td>${confidenceBadge(item.confidence)}</td>
            <td>${fmtPrice(item.latestPrice)}</td>
            <td class="${pctClass(item.percentChange)}">${fmtPct(item.percentChange)}</td>
            <td>${fmtRvol(item.relativeVolume)}</td>
            <td>${fmtRsi(item.rsi)}</td>
            <td>${entryCell(item.entryZone)}</td>
            <td>${fmtPrice(item.stopLoss)}</td>
            <td>${fmtPrice(item.target)}</td>
          </tr>`;

        const detailRow = isExpanded
          ? `<tr class="detail-row"><td colspan="11">${buildDetailCard(item)}</td></tr>`
          : "";

        return dataRow + detailRow;
      })
      .join("");

    // Attach row-click listeners
    tableBodyEl.querySelectorAll("tr[data-ticker]").forEach((row) => {
      row.addEventListener("click", () => {
        const ticker = row.getAttribute("data-ticker");
        expandedTicker = expandedTicker === ticker ? null : ticker;
        renderTable();
      });
    });
  }

  // ── Summary cards ───────────────────────────────────────────────────────

  function renderSummary() {
    if (!allRankings.length) return;

    const top = allRankings[0];
    summaryTopEl.textContent = top.ticker;

    summaryCountEl.textContent = allRankings.length;

    const avg =
      allRankings.reduce((s, r) => s + (r.score || 0), 0) / allRankings.length;
    summaryAvgScoreEl.textContent = avg.toFixed(1);

    const maxRvol = Math.max(...allRankings.map((r) => r.relativeVolume || 0));
    summaryRvolEl.textContent = maxRvol.toFixed(2) + "x";
  }

  // ── Column sort (th click) ───────────────────────────────────────────────

  function initSortHeaders() {
    document.querySelectorAll(".rankings-table th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (sortByEl) sortByEl.value = key;
        if (sortKey === key) {
          sortDir = sortDir === "desc" ? "asc" : "desc";
        } else {
          sortKey = key;
          sortDir = "desc";
        }
        // Update visual indicator
        document.querySelectorAll(".rankings-table th").forEach((h) => {
          h.classList.remove("sorted");
          const icon = h.querySelector(".sort-icon");
          if (icon) icon.textContent = "⇅";
        });
        th.classList.add("sorted");
        const icon = th.querySelector(".sort-icon");
        if (icon) icon.textContent = sortDir === "desc" ? "↓" : "↑";
        renderTable();
      });
    });
  }

  // ── Filter / sort controls ──────────────────────────────────────────────

  function initControls() {
    [filterTickerEl, filterMinScoreEl, filterConfidenceEl].forEach((el) => {
      if (el) el.addEventListener("input", renderTable);
    });
    if (sortByEl) {
      sortByEl.addEventListener("change", () => {
        sortKey = sortByEl.value;
        renderTable();
      });
    }
  }

  // ── Data fetch ──────────────────────────────────────────────────────────

  function loadData() {
    // Cache-bust with ?v=<date> so stale data isn't shown after an update
    const url = "data/penny-stock-rankings.json?v=" + new Date().toISOString().slice(0, 10);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then((data) => {
        allRankings = data.rankings || [];

        // Display generated timestamp
        if (generatedAtEl && data.generatedAt) {
          const d = new Date(data.generatedAt);
          generatedAtEl.textContent =
            "Rankings generated: " +
            d.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZoneName: "short",
            });
        }

        renderSummary();
        renderTable();
      })
      .catch((err) => {
        console.error("Failed to load rankings:", err);
        tableSection.style.display = "none";
        emptyStateEl.style.display = "block";
        emptyStateEl.innerHTML = `
          <div class="state-card">
            <div class="state-icon">⚠️</div>
            <p>Could not load ranking data. It may not have been generated yet.</p>
            <p style="font-size:0.8rem;color:var(--muted)">Run the GitHub Action or <code>generate_rankings.py</code> locally to populate data.</p>
          </div>`;
      });
  }

  // ── Init ────────────────────────────────────────────────────────────────

  initControls();
  initSortHeaders();
  loadData();
})();
