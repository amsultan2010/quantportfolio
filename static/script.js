/* ============================================================
   QuantPortfolioPy — Frontend Logic
   ============================================================ */


// ================================================================
// BACKGROUND CANVAS
// Smooth sine-wave chart lines + drifting crosshair markers + dot grid
// (distinctly different from Project 1's jagged squiggles + particle network)
// ================================================================
(function initBgCanvas() {
  const canvas = document.getElementById("bg-canvas");
  const ctx    = canvas.getContext("2d");
  let waveLines = [], crosshairs = [], rafId;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = document.body.scrollHeight;
  }

  // Smooth sinusoidal chart lines
  function makeWaves() {
    waveLines = [];
    const count = 6 + Math.floor(canvas.width / 280);
    for (let i = 0; i < count; i++) {
      const isOrange = Math.random() < 0.38;
      waveLines.push({
        baseY:     0.05 * canvas.height + Math.random() * 0.9 * canvas.height,
        amplitude: 18 + Math.random() * 55,
        // Use two overlapping sine waves for a more organic chart-like curve
        freq1:     0.0025 + Math.random() * 0.005,
        freq2:     0.007  + Math.random() * 0.01,
        phase:     Math.random() * Math.PI * 2,
        speed:     0.004  + Math.random() * 0.007,
        opacity:   0.07   + Math.random() * 0.14,
        isOrange,
      });
    }
  }

  // Drifting crosshair / plus-sign markers
  function makeCrosshairs() {
    crosshairs = [];
    const n = 28 + Math.floor((canvas.width * canvas.height) / 35000);
    for (let i = 0; i < n; i++) {
      const isOrange = Math.random() < 0.4;
      crosshairs.push({
        x:       Math.random() * canvas.width,
        y:       Math.random() * canvas.height,
        vx:      (Math.random() - 0.5) * 0.18,
        vy:      (Math.random() - 0.5) * 0.18,
        size:    5 + Math.random() * 9,
        opacity: 0.07 + Math.random() * 0.18,
        isOrange,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Faint dot grid (gives a "graph paper" feel, absent in P1)
    ctx.fillStyle = "rgba(34, 197, 94, 0.025)";
    const gs = 65;
    for (let x = 0; x < canvas.width; x += gs) {
      for (let y = 0; y < canvas.height; y += gs) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Smooth wave lines
    waveLines.forEach(wl => {
      wl.phase += wl.speed;
      const rgb = wl.isOrange ? "249,115,22" : "34,197,94";

      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 3) {
        // Compound sine: gives an organic, slightly irregular chart look
        const y = wl.baseY
          + wl.amplitude * 0.7 * Math.sin(wl.freq1 * x + wl.phase)
          + wl.amplitude * 0.3 * Math.sin(wl.freq2 * x + wl.phase * 1.3);
        if (x === 0) ctx.moveTo(x, y);
        else         ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${rgb}, ${wl.opacity})`;
      ctx.lineWidth   = 1.3;
      ctx.stroke();
    });

    // 3. Crosshair markers (+ shapes)
    crosshairs.forEach(ch => {
      const rgb = ch.isOrange ? "249,115,22" : "34,197,94";
      ctx.strokeStyle = `rgba(${rgb}, ${ch.opacity})`;
      ctx.lineWidth   = 0.85;

      // Horizontal arm
      ctx.beginPath();
      ctx.moveTo(ch.x - ch.size, ch.y);
      ctx.lineTo(ch.x + ch.size, ch.y);
      ctx.stroke();

      // Vertical arm
      ctx.beginPath();
      ctx.moveTo(ch.x, ch.y - ch.size);
      ctx.lineTo(ch.x, ch.y + ch.size);
      ctx.stroke();

      // Tiny centre dot
      ctx.beginPath();
      ctx.arc(ch.x, ch.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, ${ch.opacity * 0.8})`;
      ctx.fill();

      ch.x += ch.vx; ch.y += ch.vy;
      if (ch.x < -20 || ch.x > canvas.width  + 20) ch.vx *= -1;
      if (ch.y < -20 || ch.y > canvas.height + 20) ch.vy *= -1;
    });

    rafId = requestAnimationFrame(draw);
  }

  resize(); makeWaves(); makeCrosshairs(); draw();

  let resizeTimer;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      cancelAnimationFrame(rafId);
      resize(); makeWaves(); makeCrosshairs(); draw();
    }, 250);
  }

  window.addEventListener("resize", handleResize);
  new ResizeObserver(handleResize).observe(document.body);
})();


// ================================================================
// PLOTLY THEME
// ================================================================
const STRAT_COLOR  = "#22C55E";   // emerald green
const BENCH_COLOR  = "#F97316";   // warm orange
const STRAT_FILL   = "rgba(34, 197, 94, 0.07)";
const BENCH_FILL   = "rgba(249, 115, 22, 0.07)";

// Per-asset colour palette for multi-line charts
const TICKER_PALETTE = [
  "#22C55E", "#F97316", "#38BDF8", "#E879F9",
  "#FBBF24", "#34D399", "#F472B6", "#A78BFA",
];

const BASE_LAYOUT = {
  paper_bgcolor: "transparent",
  plot_bgcolor:  "transparent",
  font:  { family: "Inter, sans-serif", color: "#90A890", size: 12 },
  margin: { t: 10, r: 20, b: 50, l: 68 },
  xaxis: {
    gridcolor:     "#141F14",
    linecolor:     "#1C2A1C",
    zerolinecolor: "#1E301E",
    tickfont: { size: 11, color: "#3D5A3D" },
    automargin: true,
  },
  yaxis: {
    gridcolor:     "#141F14",
    linecolor:     "#1C2A1C",
    zerolinecolor: "#1E301E",
    tickfont: { size: 11, color: "#3D5A3D" },
    automargin: true,
  },
  legend: {
    bgcolor:     "rgba(16, 22, 16, 0.95)",
    bordercolor: "#1C2A1C",
    borderwidth: 1,
    font: { size: 11, color: "#90A890" },
  },
  hovermode: "x unified",
  hoverlabel: {
    bgcolor:     "#101610",
    bordercolor: "#2A3E2A",
    font: { size: 12, color: "#E4EDE4", family: "Inter, sans-serif" },
  },
};

const PLOTLY_CONFIG = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d", "toggleSpikelines"],
  displaylogo: false,
  toImageButtonOptions: { format: "png", scale: 2, width: 1400, height: 700 },
};


// ================================================================
// STATE
// ================================================================
let currentParams = null;


// ================================================================
// SLIDERS — live display + fill
// ================================================================
function initSliders() {
  [
    { slider: "short-window", disp: "short-display" },
    { slider: "long-window",  disp: "long-display"  },
  ].forEach(({ slider, disp }) => {
    const el   = document.getElementById(slider);
    const disp_el = document.getElementById(disp);

    function update() {
      const min = parseFloat(el.min), max = parseFloat(el.max), val = parseFloat(el.value);
      const pct = ((val - min) / (max - min)) * 100;
      el.style.background =
        `linear-gradient(to right, #22C55E 0%, #22C55E ${pct}%, #1C2A1C ${pct}%, #1C2A1C 100%)`;
      disp_el.textContent = val;
    }

    el.addEventListener("input", update);
    update();
  });
}

initSliders();


// ================================================================
// RUN BACKTEST
// ================================================================
document.getElementById("run-btn").addEventListener("click", runBacktest);

document.querySelectorAll(".config-sidebar input").forEach(el =>
  el.addEventListener("keydown", e => { if (e.key === "Enter") runBacktest(); })
);

async function runBacktest() {
  const tickersRaw = document.getElementById("tickers").value.trim();
  const startDate  = document.getElementById("start-date").value;
  const endDate    = document.getElementById("end-date").value;
  const capital    = parseFloat(document.getElementById("initial-capital").value);
  const shortW     = parseInt(document.getElementById("short-window").value, 10);
  const longW      = parseInt(document.getElementById("long-window").value, 10);
  const txCost     = parseFloat(document.getElementById("tx-cost").value) / 100;

  if (!tickersRaw)                              return showError("Please enter at least one ticker.");
  if (!startDate || !endDate)                   return showError("Please set start and end dates.");
  if (new Date(startDate) >= new Date(endDate)) return showError("Start date must be before end date.");
  if (shortW >= longW)                          return showError("Fast MA must be smaller than Slow MA.");
  if (capital <= 0 || isNaN(capital))           return showError("Starting capital must be positive.");

  currentParams = { tickers: tickersRaw, start_date: startDate, end_date: endDate,
                    initial_capital: capital, short_window: shortW, long_window: longW,
                    transaction_cost: txCost };

  hideError();
  showLoading("Running portfolio simulation…", "Downloading data · Computing risk parity weights");
  document.getElementById("heatmap-section").classList.add("hidden");
  document.getElementById("optimal-banner").classList.add("hidden");

  try {
    const res  = await fetch("/api/backtest", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentParams),
    });
    const data = await res.json();
    if (!res.ok || data.error) return showError(data.error || "Backtest failed.");
    if (data.failed_tickers && data.failed_tickers.length > 0)
      showWarn(`No data for: ${data.failed_tickers.join(", ")}. Proceeding with available assets.`);
    renderResults(data);
  } catch (_) {
    showError("Network error — make sure the server is running.");
  } finally {
    hideLoading();
  }
}


// ================================================================
// RENDER RESULTS
// ================================================================
function renderResults(data) {
  const a = data.analytics;

  document.getElementById("results-title").textContent =
    `Portfolio — ${data.tickers.join(", ")}`;
  document.getElementById("results-subtitle").textContent =
    `SMA${data.short_window} / SMA${data.long_window}  ·  risk parity  ·  ${currentParams.start_date} → ${currentParams.end_date}`;
  document.getElementById("chart-capital").textContent =
    a.initial_capital.toLocaleString("en-US");

  // Ticker badges
  document.getElementById("ticker-badges").innerHTML =
    data.tickers.map(t => `<span class="ticker-badge">${t}</span>`).join("");

  // Show results
  document.getElementById("empty-state").classList.add("hidden");
  document.getElementById("results-content").classList.remove("hidden");
  document.getElementById("sidebar-legend").classList.remove("hidden");

  // Enable optimize button
  document.getElementById("optimize-btn").disabled = false;

  // Fill stat strip
  animCount("stat-strat-final", a.strategy_final,
    v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  animCount("stat-bh-final", a.buy_hold_final,
    v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  setDelta("stat-strat-return", a.strategy_return_pct,
    v => (v >= 0 ? "+" : "") + v.toFixed(2) + "% total return");
  setDelta("stat-bh-return", a.buy_hold_return_pct,
    v => (v >= 0 ? "+" : "") + v.toFixed(2) + "% total return");

  document.getElementById("stat-strat-sharpe").textContent =
    a.strategy_sharpe != null ? a.strategy_sharpe.toFixed(2) : "—";
  document.getElementById("stat-bh-sharpe").textContent =
    a.buy_hold_sharpe != null ? a.buy_hold_sharpe.toFixed(2) : "—";
  document.getElementById("stat-strat-dd").textContent =
    a.strategy_max_dd != null ? a.strategy_max_dd.toFixed(2) + "%" : "—";
  document.getElementById("stat-bh-dd").textContent =
    a.buy_hold_max_dd != null ? a.buy_hold_max_dd.toFixed(2) + "%" : "—";

  // Render charts with a short delay so DOM is painted
  setTimeout(() => {
    renderEquityChart(data);
    renderCorrelationChart(data);
    renderDrawdownChart(data);
    renderReturnsChart(data);
    renderVolatilityChart(data);
  }, 50);

  setTimeout(() =>
    document.getElementById("results-content").scrollIntoView({ behavior: "smooth", block: "start" }),
  120);
}


// ================================================================
// CHART 1 — Equity Curve
// ================================================================
function renderEquityChart(data) {
  Plotly.newPlot("chart-equity", [
    { x: data.dates, y: data.portfolio_value,
      name: `SMA${data.short_window}/${data.long_window} Risk Parity`,
      type: "scatter", mode: "lines",
      line: { color: STRAT_COLOR, width: 2.5 },
      fill: "tozeroy", fillcolor: STRAT_FILL },
    { x: data.dates, y: data.buy_hold_value,
      name: "Equal-Weight Benchmark",
      type: "scatter", mode: "lines",
      line: { color: BENCH_COLOR, width: 2, dash: "dot" } },
  ], {
    ...BASE_LAYOUT,
    margin: { t: 10, r: 20, b: 55, l: 85 },
    yaxis:  { ...BASE_LAYOUT.yaxis, tickprefix: "$", tickformat: ",.0f" },
    height: 380,
  }, PLOTLY_CONFIG);
}


// ================================================================
// CHART 2 — Correlation Heatmap
// ================================================================
function renderCorrelationChart(data) {
  if (data.tickers.length <= 1) {
    document.getElementById("corr-card").classList.add("hidden");
    return;
  }

  const annotations = [];
  data.correlation.forEach((row, i) => {
    row.forEach((val, j) => {
      if (val === null) return;
      const norm  = (val + 1) / 2;
      const light = norm > 0.6 || norm < 0.4;
      annotations.push({
        x: data.tickers[j], y: data.tickers[i],
        text: val.toFixed(2), showarrow: false,
        font: { size: 12, color: light ? "#0A0F0A" : "#E4EDE4",
                family: "JetBrains Mono, monospace" },
      });
    });
  });

  const n      = data.tickers.length;
  const cellH  = Math.max(60, Math.min(90, 360 / n));
  const height = Math.max(280, n * cellH + 60);

  Plotly.newPlot("chart-correlation", [{
    z: data.correlation, x: data.tickers, y: data.tickers,
    type: "heatmap", zmin: -1, zmax: 1,
    colorscale: [
      [0.00, "#7C2D12"], [0.25, "#F97316"],
      [0.50, "#0C110C"],
      [0.75, "#22C55E"], [1.00, "#14532D"],
    ],
    colorbar: {
      title:        { text: "Correlation", font: { size: 11, color: "#567056" }, side: "right" },
      tickfont:     { size: 10, color: "#567056" },
      thickness: 14, outlinewidth: 0,
    },
    hovertemplate: "<b>%{y}</b> vs <b>%{x}</b><br>r = %{z:.3f}<extra></extra>",
    xgap: 3, ygap: 3,
  }], {
    ...BASE_LAYOUT, annotations,
    margin: { t: 10, r: 80, b: 60, l: 60 },
    xaxis: { ...BASE_LAYOUT.xaxis, fixedrange: true, tickfont: { size: 12, color: "#90A890" } },
    yaxis: { ...BASE_LAYOUT.yaxis, fixedrange: true, tickfont: { size: 12, color: "#90A890" }, autorange: "reversed" },
    height,
  }, { ...PLOTLY_CONFIG, displayModeBar: false });
}


// ================================================================
// CHART 3 — Drawdown
// ================================================================
function renderDrawdownChart(data) {
  Plotly.newPlot("chart-drawdown", [
    { x: data.dates, y: data.strategy_drawdown,
      name: "Risk Parity Strategy", type: "scatter", mode: "lines",
      line: { color: STRAT_COLOR, width: 1.8 },
      fill: "tozeroy", fillcolor: STRAT_FILL },
    { x: data.dates, y: data.buy_hold_drawdown,
      name: "Equal-Weight Benchmark", type: "scatter", mode: "lines",
      line: { color: BENCH_COLOR, width: 1.8 },
      fill: "tozeroy", fillcolor: BENCH_FILL },
  ], {
    ...BASE_LAYOUT,
    yaxis: { ...BASE_LAYOUT.yaxis, ticksuffix: "%" },
    height: 320,
  }, PLOTLY_CONFIG);
}


// ================================================================
// CHART 4 — Rolling 20-Day Annualised Returns
// ================================================================
function renderReturnsChart(data) {
  Plotly.newPlot("chart-returns", [
    { x: data.roll_dates, y: data.roll_strat,
      name: "Risk Parity Strategy", type: "scatter", mode: "lines",
      line: { color: STRAT_COLOR, width: 1.8 },
      fill: "tozeroy", fillcolor: STRAT_FILL },
    { x: data.roll_dates, y: data.roll_bench,
      name: "Equal-Weight Benchmark", type: "scatter", mode: "lines",
      line: { color: BENCH_COLOR, width: 1.8 },
      fill: "tozeroy", fillcolor: BENCH_FILL },
  ], {
    ...BASE_LAYOUT,
    yaxis: { ...BASE_LAYOUT.yaxis, ticksuffix: "%" },
    height: 320,
    shapes: [{
      type: "line",
      x0: data.roll_dates[0], x1: data.roll_dates[data.roll_dates.length - 1],
      y0: 0, y1: 0,
      line: { color: "rgba(144, 168, 144, 0.25)", width: 1, dash: "dot" },
    }],
  }, PLOTLY_CONFIG);
}


// ================================================================
// CHART 5 — Rolling Volatility per Asset
// ================================================================
function renderVolatilityChart(data) {
  const traces = data.tickers.map((t, i) => ({
    x: data.rolling_vol_dates, y: data.rolling_vol[t],
    name: t, type: "scatter", mode: "lines",
    line: { color: TICKER_PALETTE[i % TICKER_PALETTE.length], width: 1.6 },
    hovertemplate: `<b>${t}</b><br>%{x}<br>Vol: %{y:.2f}%<extra></extra>`,
  }));

  Plotly.newPlot("chart-volatility", traces, {
    ...BASE_LAYOUT,
    yaxis:     { ...BASE_LAYOUT.yaxis, ticksuffix: "%" },
    hovermode: "closest",
    height:    320,
  }, PLOTLY_CONFIG);
}


// ================================================================
// PARAMETER OPTIMIZATION
// ================================================================
document.getElementById("optimize-btn").addEventListener("click", runOptimize);

async function runOptimize() {
  if (!currentParams) return showError("Run a backtest first.");
  showLoading("Scanning 150 parameter combinations…",
              "Testing every Fast / Slow MA pair across your portfolio");

  try {
    const res  = await fetch("/api/optimize", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tickers:          currentParams.tickers,
        start_date:       currentParams.start_date,
        end_date:         currentParams.end_date,
        transaction_cost: currentParams.transaction_cost,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) return showError(data.error || "Optimization failed.");
    renderHeatmap(data);
  } catch (_) {
    showError("Network error during parameter scan.");
  } finally {
    hideLoading();
  }
}


// ================================================================
// CHART 6 — Sharpe Ratio Heatmap
// ================================================================
function renderHeatmap(data) {
  let bestVal = -Infinity, bestSW = null, bestLW = null;
  data.grid.forEach((row, i) => row.forEach((val, j) => {
    if (val !== null && val > bestVal) { bestVal = val; bestSW = data.short_windows[i]; bestLW = data.long_windows[j]; }
  }));

  const allVals = data.grid.flat().filter(v => v !== null);
  const zMin = Math.min(...allVals), zMax = Math.max(...allVals), zRange = zMax - zMin || 1;

  const annotations = [];
  data.grid.forEach((row, i) => row.forEach((val, j) => {
    if (val === null) return;
    const norm      = (val - zMin) / zRange;
    const textColor = (norm < 0.28 || norm > 0.72) ? "#FFFFFF" : "#0A0F0A";
    const isBest    = (data.short_windows[i] === bestSW && data.long_windows[j] === bestLW);
    annotations.push({
      x: data.long_windows[j], y: data.short_windows[i],
      text: isBest ? `<b>${val.toFixed(2)}</b>` : val.toFixed(2),
      font: { size: 9, color: textColor, family: "JetBrains Mono, monospace" },
      showarrow: false, xref: "x", yref: "y",
    });
  }));

  if (bestSW !== null) {
    annotations.push({
      x: bestLW, y: bestSW, text: "★",
      font: { size: 13, color: "#FBBF24" },
      showarrow: false, xanchor: "left", yanchor: "bottom", xshift: 18, yshift: 10,
    });
  }

  document.getElementById("heatmap-sub").textContent =
    `${currentParams.tickers}  ·  ${currentParams.start_date} → ${currentParams.end_date}  ·  Risk Parity Weighted`;

  const heatSec = document.getElementById("heatmap-section");
  heatSec.classList.remove("hidden");

  Plotly.newPlot("chart-heatmap", [{
    z: data.grid, x: data.long_windows, y: data.short_windows,
    type: "heatmap", zmin: zMin, zmax: zMax,
    colorscale: [
      [0.00, "#431407"], [0.18, "#9A3412"],
      [0.35, "#F97316"], [0.50, "#94A890"],
      [0.65, "#22C55E"], [0.82, "#15803D"],
      [1.00, "#14532D"],
    ],
    colorbar: {
      title:        { text: "Sharpe Ratio", font: { size: 11, color: "#567056" }, side: "right" },
      tickfont:     { size: 10, color: "#567056" },
      thickness: 15, len: 0.85, outlinewidth: 0,
    },
    hoverongaps: false,
    hovertemplate: "<b>Fast MA:</b> %{y}d<br><b>Slow MA:</b> %{x}d<br><b>Sharpe:</b> %{z:.3f}<extra></extra>",
    zsmooth: false, showscale: true, xgap: 2, ygap: 2,
  }], {
    paper_bgcolor: "transparent",
    plot_bgcolor:  "rgba(12, 17, 12, 0.75)",
    font:  { family: "Inter, sans-serif", color: "#90A890", size: 12 },
    annotations,
    xaxis: {
      title:      { text: "Slow MA Window (Days)", font: { size: 12, color: "#567056" }, standoff: 12 },
      tickfont:   { size: 11, color: "#567056" },
      gridcolor: "transparent", linecolor: "#1C2A1C",
      tickvals: data.long_windows, ticktext: data.long_windows.map(String), fixedrange: true,
    },
    yaxis: {
      title:      { text: "Fast MA Window (Days)", font: { size: 12, color: "#567056" }, standoff: 12 },
      tickfont:   { size: 11, color: "#567056" },
      gridcolor: "transparent", linecolor: "#1C2A1C",
      tickvals: data.short_windows, ticktext: data.short_windows.map(String), fixedrange: true,
    },
    height: 560,
    margin: { t: 24, r: 90, b: 72, l: 80 },
    hovermode: "closest",
    hoverlabel: { bgcolor: "#101610", bordercolor: "#1C2A1C",
                  font: { size: 13, color: "#E4EDE4", family: "Inter, sans-serif" } },
  }, { ...PLOTLY_CONFIG, responsive: true });

  if (bestSW !== null) {
    document.getElementById("optimal-text").textContent =
      `Fast MA = ${bestSW}d  ·  Slow MA = ${bestLW}d  →  Sharpe = ${bestVal.toFixed(3)}`;
    document.getElementById("optimal-banner").classList.remove("hidden");
  }

  setTimeout(() => heatSec.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
}


// ================================================================
// HELPERS
// ================================================================
function animCount(id, to, fmt, duration = 900) {
  if (to == null) return;
  const el = document.getElementById(id), start = performance.now();
  (function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(to * e);
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}

function setDelta(id, val, fmt) {
  const el = document.getElementById(id);
  el.textContent = val != null ? fmt(val) : "—";
  el.className   = "strip-delta " + (val != null ? (val >= 0 ? "c-pos" : "c-neg") : "");
}

function showLoading(msg, sub = "") {
  document.getElementById("loading-text").textContent = msg;
  document.getElementById("loading-sub").textContent  = sub;
  document.getElementById("loading-overlay").classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loading-overlay").classList.add("hidden");
}

function showError(msg) {
  hideLoading();
  document.getElementById("error-message").textContent = msg;
  document.getElementById("error-banner").classList.remove("hidden");
  setTimeout(() => document.getElementById("error-banner").classList.add("hidden"), 8000);
}

function showWarn(msg) {
  document.getElementById("warn-message").textContent = msg;
  document.getElementById("warn-banner").classList.remove("hidden");
  setTimeout(() => document.getElementById("warn-banner").classList.add("hidden"), 10000);
}

function hideError() {
  document.getElementById("error-banner").classList.add("hidden");
  document.getElementById("warn-banner").classList.add("hidden");
}
