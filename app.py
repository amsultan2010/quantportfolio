from flask import Flask, render_template, request, jsonify
import yfinance as yf
import pandas as pd
import numpy as np
import math

app = Flask(__name__)


# ============================================================
# UTILITIES
# ============================================================

def safe_float(val):
    """Convert to a JSON-safe Python float. Returns None for NaN / Inf."""
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return None


def download_prices(tickers, start_date, end_date):
    """
    Download adjusted closing prices for one or more tickers.
    Returns (prices_df, failed_tickers_list).
    """
    if len(tickers) == 1:
        raw = yf.download(tickers[0], start=start_date, end=end_date,
                          progress=False, auto_adjust=True)
        if raw.empty:
            return None, tickers[:]
        close = raw["Close"]
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]
        prices = pd.DataFrame({tickers[0]: close})
    else:
        raw = yf.download(tickers, start=start_date, end=end_date,
                          progress=False, auto_adjust=True)
        if raw.empty:
            return None, tickers[:]
        prices = raw["Close"]
        if isinstance(prices, pd.Series):
            prices = prices.to_frame(name=tickers[0])
        elif isinstance(prices.columns, pd.MultiIndex):
            prices.columns = prices.columns.get_level_values(0)

    # Identify tickers with no usable data
    failed = [c for c in prices.columns if prices[c].isna().all()]
    valid  = [c for c in prices.columns if c not in failed]
    prices = prices[valid].dropna()
    return prices, failed


def run_strategy(prices, short_window, long_window, tx_cost):
    """
    Run the risk-parity SMA crossover strategy.

    Returns:
        net_returns       – daily net strategy returns (Series)
        bench_returns     – daily equal-weight benchmark returns (Series)
        portfolio_value   – compounded equity curve, scaled to 1.0 at start (Series)
        bh_value          – benchmark equity curve, scaled to 1.0 at start (Series)
        daily_returns     – raw per-asset daily returns used for correlation / vol (DataFrame)
    """
    # ── Signal generation ──────────────────────────────────────────
    signals = pd.DataFrame(index=prices.index)
    for ticker in prices.columns:
        sma_s = prices[ticker].rolling(window=short_window).mean()
        sma_l = prices[ticker].rolling(window=long_window).mean()
        # shift(1) prevents look-ahead bias
        signals[ticker] = (sma_s > sma_l).astype(int).shift(1)
    signals = signals.dropna()

    # Align prices to the signal window
    prices_aligned = prices.loc[signals.index]

    # ── Risk parity weights ────────────────────────────────────────
    daily_returns = prices_aligned.pct_change()
    rolling_vol   = daily_returns.rolling(window=20).std()
    inverse_vol   = 1.0 / rolling_vol
    # Weights sum to 1 across assets at every timestep
    target_weights = inverse_vol.div(inverse_vol.sum(axis=1), axis=0)

    # Apply signals, then shift weights to tomorrow's returns
    active_weights = (target_weights * signals).shift(1)

    # ── Returns ───────────────────────────────────────────────────
    gross_returns = (daily_returns * active_weights).sum(axis=1)
    turnover      = active_weights.diff().abs().sum(axis=1).fillna(0)
    net_returns   = gross_returns - (turnover * tx_cost)

    bench_returns = daily_returns.mean(axis=1)

    # Compounded equity curves (base 1.0)
    portfolio_value = (1 + net_returns).cumprod()
    bh_value        = (1 + bench_returns).cumprod()

    return net_returns, bench_returns, portfolio_value, bh_value, daily_returns


def calc_metrics(returns, equity_unit):
    """
    Compute key performance metrics.

    equity_unit: Series with values expressed as a multiple of initial capital
                 (i.e. 1.0 at start → 1.5 means +50%).
    Returns: (total_return_pct, sharpe, max_dd_pct)
    """
    r = returns.dropna()
    e = equity_unit.dropna()
    if len(e) == 0 or len(r) == 0:
        return None, None, None
    total_ret_pct = safe_float((e.iloc[-1] - 1.0) * 100)
    sharpe        = safe_float((r.mean() / r.std()) * np.sqrt(252)) if r.std() != 0 else None
    peak          = e.cummax()
    drawdown      = (e - peak) / peak
    max_dd        = safe_float(drawdown.min() * 100)
    return total_ret_pct, sharpe, max_dd


# ============================================================
# ROUTES
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/backtest", methods=["POST"])
def backtest():
    req          = request.json
    tickers_raw  = req.get("tickers", "AAPL,MSFT,GS,AMZN")
    tickers      = [t.strip().upper() for t in tickers_raw.split(",") if t.strip()]
    start_date   = req.get("start_date", "2015-01-01")
    end_date     = req.get("end_date", "2025-01-01")
    short_window = int(req.get("short_window", 20))
    long_window  = int(req.get("long_window", 50))
    initial_cap  = float(req.get("initial_capital", 10000))
    tx_cost      = float(req.get("transaction_cost", 0.0001))

    if not tickers:
        return jsonify({"error": "Please enter at least one ticker."}), 400
    if short_window >= long_window:
        return jsonify({"error": "Fast MA must be smaller than Slow MA."}), 400

    try:
        prices, failed = download_prices(tickers, start_date, end_date)

        if prices is None or prices.empty:
            return jsonify({"error": "No data found. Check your ticker symbols and date range."}), 400

        available = list(prices.columns)

        net_ret, bench_ret, port_unit, bh_unit, daily_ret = run_strategy(
            prices, short_window, long_window, tx_cost
        )

        # Align to a common valid index
        common_idx  = port_unit.dropna().index.intersection(bh_unit.dropna().index)
        port_val    = (port_unit.reindex(common_idx) * initial_cap).dropna()
        bh_val      = (bh_unit.reindex(common_idx)  * initial_cap).dropna()
        net_clean   = net_ret.reindex(common_idx).dropna()
        bench_clean = bench_ret.reindex(common_idx).dropna()

        # Drawdown series (%)
        sp  = port_val.cummax()
        sd  = (port_val - sp) / sp * 100
        bhp = bh_val.cummax()
        bhd = (bh_val - bhp) / bhp * 100

        # Performance metrics
        strat_ret_pct, strat_sharpe, strat_max_dd = calc_metrics(
            net_clean, port_val / initial_cap)
        bench_ret_pct, bench_sharpe, bench_max_dd = calc_metrics(
            bench_clean, bh_val / initial_cap)

        dates = [str(d.date()) for d in port_val.index]

        # ── Correlation matrix ──────────────────────────────────
        corr      = daily_ret.corr()
        corr_data = [[safe_float(corr.loc[r, c]) for c in available] for r in available]

        # ── Rolling annualised volatility per asset (%) ─────────
        full_dr   = prices.pct_change()
        rv        = full_dr.rolling(window=20).std() * np.sqrt(252) * 100
        rv_clean  = rv.dropna()
        rv_dates  = [str(d.date()) for d in rv_clean.index]
        rv_data   = {t: [safe_float(v) for v in rv_clean[t]] for t in available}

        # ── Smoothed 20-day rolling returns for the returns chart ─
        roll_strat = net_clean.rolling(20).mean() * 252 * 100     # annualised %
        roll_bench = bench_clean.rolling(20).mean() * 252 * 100
        roll_dates = [str(d.date()) for d in roll_strat.dropna().index]
        roll_strat_vals = [safe_float(v) for v in roll_strat.dropna()]
        roll_bench_vals = [safe_float(v) for v in roll_bench.dropna()]

        return jsonify({
            "success":        True,
            "tickers":        available,
            "failed_tickers": failed,
            "short_window":   short_window,
            "long_window":    long_window,
            "dates":          dates,
            "portfolio_value":     [safe_float(v) for v in port_val],
            "buy_hold_value":      [safe_float(v) for v in bh_val],
            "strategy_drawdown":   [safe_float(v) for v in sd],
            "buy_hold_drawdown":   [safe_float(v) for v in bhd],
            "roll_strat":    roll_strat_vals,
            "roll_bench":    roll_bench_vals,
            "roll_dates":    roll_dates,
            "correlation":   corr_data,
            "rolling_vol":   rv_data,
            "rolling_vol_dates": rv_dates,
            "analytics": {
                "initial_capital":     initial_cap,
                "strategy_final":      safe_float(port_val.iloc[-1]),
                "buy_hold_final":      safe_float(bh_val.iloc[-1]),
                "strategy_return_pct": strat_ret_pct,
                "buy_hold_return_pct": bench_ret_pct,
                "strategy_max_dd":     strat_max_dd,
                "buy_hold_max_dd":     bench_max_dd,
                "strategy_sharpe":     strat_sharpe,
                "buy_hold_sharpe":     bench_sharpe,
            },
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/optimize", methods=["POST"])
def optimize():
    req         = request.json
    tickers_raw = req.get("tickers", "AAPL,MSFT,GS,AMZN")
    tickers     = [t.strip().upper() for t in tickers_raw.split(",") if t.strip()]
    start_date  = req.get("start_date", "2015-01-01")
    end_date    = req.get("end_date", "2025-01-01")
    tx_cost     = float(req.get("transaction_cost", 0.0001))

    try:
        prices, failed = download_prices(tickers, start_date, end_date)
        if prices is None or prices.empty:
            return jsonify({"error": "No data found."}), 400

        # Pre-compute risk parity weights once
        daily_returns  = prices.pct_change()
        rolling_vol    = daily_returns.rolling(window=20).std()
        inverse_vol    = 1.0 / rolling_vol
        target_weights = inverse_vol.div(inverse_vol.sum(axis=1), axis=0)

        short_windows = list(range(10, 60, 5))
        long_windows  = list(range(50, 200, 10))
        grid          = []

        for sw in short_windows:
            row = []
            for lw in long_windows:
                if sw >= lw:
                    row.append(None)
                    continue

                sma_s       = prices.rolling(window=sw).mean()
                sma_l       = prices.rolling(window=lw).mean()
                sim_sig     = (sma_s > sma_l).astype(int)
                sim_weights = (target_weights * sim_sig).shift(1)
                gross       = (daily_returns * sim_weights).sum(axis=1)
                turnover    = sim_weights.diff().abs().sum(axis=1).fillna(0)
                net         = gross - (turnover * tx_cost)

                valid = net.dropna()
                if len(valid) == 0 or valid.std() == 0:
                    sharpe = 0.0
                else:
                    s = float((valid.mean() / valid.std()) * np.sqrt(252))
                    sharpe = s if not (math.isnan(s) or math.isinf(s)) else 0.0

                row.append(sharpe)
            grid.append(row)

        return jsonify({
            "success":       True,
            "grid":          grid,
            "short_windows": short_windows,
            "long_windows":  long_windows,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5001)
