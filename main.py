# Import yfinance historical stock data
import yfinance as yf

# Import Pandas for data manipulation
import pandas as pd

# Import numpy for calculations
import numpy as np

# Import matplotlib for graphing
import matplotlib.pyplot as plt

# ==========================================
# 1. PARAMETERS & SETTINGS
# ==========================================

tickers = ['AAPL', 'MSFT', 'GS', 'AMZN']
start_date = '2015-01-01'
end_date = '2025-01-01'

initial_capital = 10000
short_window = 20
long_window = 50
transaction_cost = 0.0001  # 0.01% fee on turnover

# ==========================================
# 2. DATA LAYER
# ==========================================
# Download historical close data from Yahoo Finance
prices = yf.download(tickers, start=start_date, end=end_date)['Close']
prices = prices.dropna()

print("Data downloaded successfully!")

# ==========================================
# 3. STRATEGY LAYER
# ==========================================
signals = pd.DataFrame(index=prices.index)

# Loop through each ticker to generate moving average signals
for ticker in tickers:
    stock_price = prices[ticker]

    sma_short = stock_price.rolling(window=short_window).mean()
    sma_long = stock_price.rolling(window=long_window).mean()

    # Generate Signal (1.0 = Fast > Slow) and shift to prevent look-ahead bias
    raw_signal = sma_short > sma_long
    signals[ticker] = raw_signal.astype(int).shift(1)

signals = signals.dropna()

print("Signals calculated!")

# ==========================================
# 4. EXECUTION LAYER (RISK PARITY)
# ==========================================
# Calculate daily returns
daily_returns = prices.pct_change()

# Calculate Rolling Volatility and Inverse Volatility Weights
rolling_vol = daily_returns.rolling(window=20).std()
inverse_vol = 1 / rolling_vol

# Normalize weights so they equal 100% of the portfolio
target_weights = inverse_vol.div(inverse_vol.sum(axis=1), axis=0)

# Apply Strategy Signals
active_weights = target_weights * signals

# Shift weights sequentially to apply to tomorrow's returns
active_weights = active_weights.shift(1)

# Calculate theoretical gross portfolio returns
gross_returns = (daily_returns * active_weights).sum(axis=1)

# Apply Transaction Costs based on Turnover
turnover = active_weights.diff().abs().sum(axis=1).fillna(0)
net_returns = gross_returns - (turnover * transaction_cost)

# Calculate compounding portfolio dollar values
portfolio_value = initial_capital * (1 + net_returns).cumprod()

# Benchmark (Equal Weight)
benchmark_returns = daily_returns.mean(axis=1)
buy_hold_value = initial_capital * (1 + benchmark_returns).cumprod()

print("Execution Layer Complete!")

# ==========================================
# 5. ANALYTICS LAYER
# ==========================================
def calc_metrics(returns, equity_series):
    total_return = (equity_series.iloc[-1] / initial_capital) - 1
    annual_return = (1 + total_return) ** (252 / len(returns)) - 1
    sharpe = (returns.mean() / returns.std()) * np.sqrt(252)

    peak = equity_series.cummax()
    drawdown = (equity_series - peak) / peak
    max_dd = drawdown.min() * 100

    return total_return, annual_return, sharpe, max_dd

# Strategy vs Benchmark Metrics
port_tot, port_ann, strategy_sharpe, strategy_max_dd = calc_metrics(net_returns.dropna(), portfolio_value.dropna())
bench_tot, bench_ann, buy_hold_sharpe, buy_hold_max_dd = calc_metrics(benchmark_returns.dropna(), buy_hold_value.dropna())

# ==========================================
# 6. RESULTS DASHBOARD
# ==========================================
print("\n" + "="*45)
print("       MULTI-ASSET RESULTS SUMMARY         ")
print("="*45)
print(f"Initial Capital:          ${initial_capital:,.2f}")
print(f"Strategy Final Value:     ${portfolio_value.dropna().iloc[-1]:,.2f}")
print(f"Eq-Wgt Benchmark Final:   ${buy_hold_value.dropna().iloc[-1]:,.2f}")
print("-" * 45)
print(f"Strategy Max Drawdown:    {strategy_max_dd:.2f}%")
print(f"Benchmark Max DD:         {buy_hold_max_dd:.2f}%")
print("-" * 45)
print(f"Strategy Sharpe:          {strategy_sharpe:.2f}")
print(f"Benchmark Sharpe:         {buy_hold_sharpe:.2f}")
print("="*45 + "\n")

# ==========================================
# 7. MATPLOTLIB VISUALIZATIONS
# ==========================================
plt.style.use('dark_background')

# Create dashboard figure
plt.figure(figsize=(16, 10))

plt.subplot(2, 2, 1)
plt.plot(portfolio_value, label='Risk Parity SMA Strategy', color='orange')
plt.plot(buy_hold_value, label='Eq-Wgt Benchmark', color='green', alpha=0.7)
plt.title('Portfolio Value ($)')
plt.ylabel('Dollars')
plt.legend()

plt.subplot(2, 2, 2)
plt.plot(net_returns, label='Strategy Net Returns', color='orange')
plt.plot(benchmark_returns, label='Eq-Wgt Returns', color='green', alpha=0.4)
plt.title('Daily Returns')
plt.legend()

plt.subplot(2, 2, 3)
plt.plot(turnover, label='Turnover', color='orange')
plt.title('Daily Target Weight Turnover')
plt.ylabel('Percentage Changed')
plt.legend()

plt.subplot(2, 2, 4)
plt.plot(rolling_vol, alpha=0.8)
plt.title('Rolling Volatility (20-Day)')
plt.ylabel('Standard Deviation')

plt.tight_layout()

# ==========================================
# 8. PARAMETER OPTIMIZATION HEATMAP
# ==========================================
print("Running Multi-Asset Parameter Optimization Scan... This may take a few seconds.")

heatmap_short_windows = range(10, 60, 5)
heatmap_long_windows = range(50, 200, 10)
results_grid = np.zeros((len(heatmap_short_windows), len(heatmap_long_windows)))

# Vectorized multidimensional scan
for i, sw in enumerate(heatmap_short_windows):
    for j, lw in enumerate(heatmap_long_windows):
        
        if sw >= lw:
            results_grid[i, j] = np.nan
            continue
            
        # Fast vectorized SMA across all tickers at once
        sma_short = prices.rolling(window=sw).mean()
        sma_long = prices.rolling(window=lw).mean()
        
        # Vectorized signal generation
        sim_signals = (sma_short > sma_long).astype(int)
        
        # Apply strict risk-parity weights and shift
        sim_active_weights = (target_weights * sim_signals).shift(1)
        
        # Calculate returns with transaction costs
        sim_gross_returns = (daily_returns * sim_active_weights).sum(axis=1)
        sim_turnover = sim_active_weights.diff().abs().sum(axis=1).fillna(0)
        sim_net_returns = sim_gross_returns - (sim_turnover * transaction_cost)
        
        # Calculate resulting Sharpe
        valid_returns = sim_net_returns.dropna()
        if valid_returns.std() == 0 or len(valid_returns) == 0:
            sharpe = 0.0
        else:
            sharpe = (valid_returns.mean() / valid_returns.std()) * np.sqrt(252)
            
        results_grid[i, j] = sharpe

print("Scan Complete! Rendering UI...")

# Draw the Heatmap on a new figure
fig2, ax_heat = plt.subplots(figsize=(12, 8))
cax = ax_heat.imshow(results_grid, cmap='RdYlGn', origin='lower', aspect='auto')

ax_heat.set_xticks(np.arange(len(heatmap_long_windows)))
ax_heat.set_yticks(np.arange(len(heatmap_short_windows)))
ax_heat.set_xticklabels(heatmap_long_windows)
ax_heat.set_yticklabels(heatmap_short_windows)

ax_heat.set_xlabel("Long Window Size (Days)")
ax_heat.set_ylabel("Short Window Size (Days)")
ax_heat.set_title("Portfolio Sharpe Ratio Heatmap (Risk Parity Weighted)")

fig2.colorbar(cax, label="Sharpe Ratio (Higher = Greener = Better)")

for i in range(len(heatmap_short_windows)):
    for j in range(len(heatmap_long_windows)):
        val = results_grid[i, j]
        if not np.isnan(val):
            ax_heat.text(j, i, f"{val:.2f}", ha="center", va="center", color="black" if val > 0.8 else "white", fontsize=8)

fig2.tight_layout()
plt.show()