import yfinance as yf
import numpy as np

def get_etf_projection(ticker_symbol, investment_amount, years=10):
    """
    Fetches historical data to calculate average annual return,
    then projects future value.
    """
    try:
        # 1. Get Data (Last 5 years to determine average growth)
        ticker = yf.Ticker(ticker_symbol)
        hist = ticker.history(period="5y")
        
        # Calculate basic annual return (CAGR)
        # (Ending Value / Beginning Value) ^ (1/n) - 1
        start_price = hist['Close'].iloc[0]
        end_price = hist['Close'].iloc[-1]
        avg_annual_return = (end_price / start_price) ** (1/5) - 1
    except:
        # Fallback if API fails: Use 8% (0.08) as a safe historical average
        avg_annual_return = 0.08

    # 2. Create Projection Data Points for the Graph
    # We want a list of values for Year 0, Year 1, ... Year 10
    projection_data = []
    savings_data = [] # Just keeping cash in a sock (0% growth)
    
    current_value = investment_amount
    
    for year in range(years + 1):
        projection_data.append(round(current_value, 2))
        savings_data.append(round(investment_amount, 2)) # Cash doesn't grow
        
        # Compound the money for the next loop
        current_value = current_value * (1 + avg_annual_return)

    return {
        "ticker": ticker_symbol,
        "annual_return_rate": round(avg_annual_return * 100, 2), # e.g., 8.5%
        "graph_data": {
            "labels": [f"Year {i}" for i in range(years + 1)],
            "invested_line": projection_data,
            "cash_line": savings_data
        }
    }