Multi-Asset Portfolio Backtester
By A.M. Sultan

I'm a 10th-grade high school student building a series of quantitative finance tools in Python as a portfolio project for college applications. My goal is to become a Quantitative Developer, and this is the second project in my QuantPy series. If you want to see where this all started, Project 1 is a single-stock SMA backtester at quantbacktesterpy.vercel.app.

This project answers a harder question than Project 1 did. Instead of asking "what if I traded one stock using a simple rule?", I wanted to ask: "What if I built an actual portfolio of multiple assets, allocated my capital intelligently based on how risky each one is, and traded all of them simultaneously using a systematic strategy?"

That turns out to be a much more interesting problem to solve.

The Strategy: Risk Parity + SMA Crossover

In Project 1, I picked one stock and went either 100% in or 100% out based on a moving average signal. That works as a proof of concept, but it's not how real portfolio managers think. They almost never put everything into one asset.

For Project 2, I built what's called a Risk Parity allocation. The idea is to give each asset in the portfolio a weight that is inversely proportional to how volatile it has been recently. If Apple has been swinging wildly and Goldman Sachs has been stable, you give less weight to Apple and more to Goldman. This way, every asset contributes roughly the same amount of risk to the portfolio, rather than one volatile stock dominating everything.

I then layered my SMA crossover signal on top of that. Each asset generates its own signal independently: if its 20-day moving average is above its 50-day, the strategy is long that asset. If not, it drops to zero weight. The final portfolio weight for any asset at any given day is: the risk parity weight multiplied by whether the signal says to hold it or not.

What I Had to Learn That Was Brand New

The biggest conceptual hurdle was understanding inverse-volatility weighting. In Project 1, position sizing was trivial because there was only one asset. Here I had to figure out how to mathematically balance a basket of stocks so that the ones with higher volatility don't swamp the quieter ones.

The formula I used was straightforward once I understood it: take the rolling 20-day standard deviation of each asset's daily returns, invert it, and then normalize all the weights so they add up to 100%. In pandas, this took about four lines of code, but understanding why it works took a lot longer.

I also had to learn about portfolio turnover. When your weights change from one day to the next because the signals flip or the volatility estimates change, you are implicitly buying and selling portions of your holdings. In Project 1, transaction costs were easy: you either bought everything or sold everything. Here I had to calculate the actual change in each asset's weight each day and charge the broker fee proportionally to how much the portfolio shifted. This is a much more realistic simulation of how transaction costs actually work.

The third thing I learned was cross-asset correlation. When you hold multiple assets, one of the most important questions is whether they all crash at the same time. If everything in your portfolio is highly correlated, you haven't really diversified. I built a full correlation heatmap that shows how each pair of assets in the portfolio moves relative to each other over the entire backtest period. A correlation close to +1.0 means they move in lockstep. Close to 0 means they're independent. Negative correlation is rare in equities but means they move opposite to each other, which is useful for risk management.

The Web App Was a Big Upgrade Too

Project 1 had a working web interface, but Project 2 is meaningfully more complex. Instead of a single ticker input, the app accepts a comma-separated list of any Yahoo Finance symbols. You can backtest AAPL, MSFT, GS, and AMZN simultaneously, or swap in any other combination you want.

The results dashboard renders six separate Plotly charts: a portfolio equity curve versus the equal-weight benchmark, the cross-asset correlation heatmap I mentioned, a drawdown chart showing how far each strategy fell from its peak, a rolling 20-day annualised return comparison, a per-asset rolling volatility chart that shows which assets were riskiest at different points in time, and a full parameter optimization heatmap that grid-searches 150 different Fast MA and Slow MA combinations across the entire portfolio.

I also built proper error handling for failed ticker lookups, so if you accidentally type a symbol wrong it will tell you which one failed and proceed with the rest.

What Humbled Me This Time

I ran the backtest on a four-asset portfolio of AAPL, MSFT, GS, and AMZN from 2015 to 2025. The risk parity strategy actually performed much more consistently than the single-stock version from Project 1. The max drawdown was noticeably smaller because diversification helped cushion some of the crashes. During the 2020 COVID selloff, the equal-weight benchmark dropped significantly harder than the risk parity strategy did, because the signal correctly moved out of the more volatile names before they fell further.

But the Sharpe Ratio comparison was humbling again. Because the tech names in the portfolio had such a historic bull run from 2015 to 2025, the equal-weight benchmark still generated strong risk-adjusted returns just by sitting still. The strategy spent too much time in cash during prolonged uptrends, which ate into returns even though it provided real downside protection.

The lesson I keep learning from running these simulations is that there is no free lunch. Every strategy that protects you from the downside also costs you some upside. The question a real portfolio manager has to answer is not which strategy wins more but which risk profile they can actually live with.

What's Different About This Project vs Project 1

Project 1 was a single-stock backtester. You picked one ticker, set your moving average windows, and watched it go. It was a clean proof of concept for what backtesting is and why look-ahead bias matters.

Project 2 is a genuine multi-asset portfolio engine. The main technical differences are:

The allocation logic. Project 1 went all-in or all-out. Project 2 uses inverse-volatility risk parity to size each position dynamically based on recent volatility, which is how institutional risk management actually works.

The signal layer. Project 1 had one signal for one stock. Project 2 runs an independent SMA crossover for every asset in the portfolio simultaneously and combines the outputs into a single weight vector.

The transaction cost model. Project 1 charged a flat fee on buy and sell days. Project 2 charges proportionally based on how much the portfolio weights turned over, which is a much more accurate model.

The analytics. Project 1 showed a drawdown chart, a Sharpe bar, and a max drawdown bar. Project 2 adds a full correlation heatmap, per-asset rolling volatility, rolling returns over time, and a parameter optimization scan that works across the entire portfolio rather than just one stock.

The architecture. Project 1 was already a Flask web app, but Project 2 has a proper two-panel layout with a sticky configuration sidebar and a live results panel. It also handles multiple tickers, gracefully drops ones that fail to download, and warns the user which symbols were skipped.

What I Want to Build Next

I want to eventually add more sophisticated allocation methods, like mean-variance optimization from Modern Portfolio Theory, and test whether they actually outperform the simpler inverse-volatility approach. I also want to add a walk-forward analysis mode, where instead of backtesting the whole period at once, the engine trains on one window and tests on the next, which is a more honest way to evaluate whether a strategy would have worked in practice.

I also want to add support for rebalancing frequency, because right now the portfolio rebalances every single day. In reality, most funds rebalance monthly or quarterly, and the transaction costs look very different depending on how often you trade.
