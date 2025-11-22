from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import finance_engine # Your ETF logic file

app = FastAPI()

# CRITICAL: Allow both the extension and dashboard to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Setup (Simple SQLite) ---
def init_db():
    conn = sqlite3.connect('investher.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS savings 
                 (id INTEGER PRIMARY KEY, item_name TEXT, amount REAL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db()

# --- Data Models ---
class SavingItem(BaseModel):
    item_name: str
    amount: float

# --- Endpoints ---

# 1. Extension hits this to SAVE money
@app.post("/add-savings")
def add_savings(item: SavingItem):
    conn = sqlite3.connect('investher.db')
    c = conn.cursor()
    c.execute("INSERT INTO savings (item_name, amount) VALUES (?, ?)", (item.item_name, item.amount))
    conn.commit()
    conn.close()
    return {"message": "Saved!"}

# 2. Dashboard hits this to GET history
@app.get("/get-history")
def get_history():
    conn = sqlite3.connect('investher.db')
    c = conn.cursor()
    # Get all items
    c.execute("SELECT item_name, amount, timestamp FROM savings")
    data = c.fetchall()
    conn.close()
    return data

# 3. Dashboard hits this for ETF MATH
@app.get("/get-projections")
def get_projections():
    # Calculate total saved so far
    conn = sqlite3.connect('investher.db')
    c = conn.cursor()
    c.execute("SELECT SUM(amount) FROM savings")
    total = c.fetchone()[0] or 0 # Handle None if empty
    conn.close()
    
    # Run your math engine on the total
    return finance_engine.get_etf_projection("VOO", total, years=20)