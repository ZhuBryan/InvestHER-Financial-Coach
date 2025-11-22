import yfinance as yf

def get_etf_projection(ticker_symbol="VOO", investment_amount=0, years=10):
    """
    Calculates future value based on historical ETF data.
    Falls back to 8% if API fails.
    """
    try:
        # Fetch data (Last 5 years)
        ticker = yf.Ticker(ticker_symbol)
        hist = ticker.history(period="5y")
        
        start_price = hist['Close'].iloc[0]
        end_price = hist['Close'].iloc[-1]
        
        # Calculate CAGR (Compound Annual Growth Rate)
        avg_annual_return = (end_price / start_price) ** (1/5) - 1
    except:
        # Fallback safe rate
        avg_annual_return = 0.08 

    projection_data = []
    cash_data = []
    current_value = investment_amount
    
    for year in range(years + 1):
        projection_data.append(round(current_value, 2))
        cash_data.append(round(investment_amount, 2))
        current_value = current_value * (1 + avg_annual_return)

    return {
        "ticker": ticker_symbol,
        "annual_return_rate": round(avg_annual_return * 100, 2),
        "graph_data": {
            "labels": [f"Year {i}" for i in range(years + 1)],
            "invested_line": projection_data,
            "cash_line": cash_data
        }
    }