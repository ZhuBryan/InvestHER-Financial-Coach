import streamlit as st
import requests
import pandas as pd
import plotly.express as px

API_URL = "http://localhost:8000"

st.set_page_config(page_title="InvestHer Dashboard", page_icon="💸", layout="wide")

# Custom CSS
st.markdown("""
<style>
    .main {background-color: #F5F5F5;}
    h1 {color: #6C63FF;}
</style>
""", unsafe_allow_html=True)

st.title("InvestHer Dashboard 🚀")

# Fetch Data
try:
    res = requests.get(f"{API_URL}/get-dashboard-data")
    data = res.json()
except:
    st.error("Backend not connected. Run 'uvicorn main:app --reload'")
    st.stop()

# Metrics
col1, col2, col3 = st.columns(3)
col1.metric("Total Saved", f"${data['total_saved']:,.2f}")
col2.metric("Projected Value (20y)", f"${data['projections']['graph_data']['invested_line'][-1]:,.2f}")
col3.metric("Growth Rate", f"{data['projections']['annual_return_rate']}%")

# Graph
st.subheader("📈 The Power of Compound Interest")
graph_data = data['projections']['graph_data']
df_chart = pd.DataFrame({
    "Year": graph_data['labels'],
    "Invested (VOO)": graph_data['invested_line'],
    "Cash Savings": graph_data['cash_line']
})
fig = px.line(df_chart, x="Year", y=["Invested (VOO)", "Cash Savings"], 
              color_discrete_map={"Invested (VOO)": "#6C63FF", "Cash Savings": "#ccc"})
st.plotly_chart(fig, use_container_width=True)

# History Table
st.subheader("🛒 Impulse Buys Prevented")
history = data['history']
if history:
    df_hist = pd.DataFrame(history, columns=["Item", "Amount", "Date"])
    st.dataframe(df_hist, use_container_width=True)
else:
    st.info("No savings yet. Go use the Chrome Extension!")