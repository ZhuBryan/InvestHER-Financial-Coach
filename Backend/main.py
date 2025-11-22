import os
import sqlite3
import base64
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from elevenlabs.client import ElevenLabs
import financial_engine

# --- Config ---
load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Clients ---
gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
eleven_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

# --- Database ---
def init_db():
    conn = sqlite3.connect('investher.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS savings 
                 (id INTEGER PRIMARY KEY, item_name TEXT, amount REAL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db()

# --- Models ---
class CoachRequest(BaseModel):
    item_name: str
    price: float

class SavingItem(BaseModel):
    item_name: str
    amount: float

# --- Endpoints ---

@app.get("/")
def health_check():
    return {"status": "active"}

@app.post("/generate-coaching")
def generate_coaching(request: CoachRequest):
    # 1. Gemini Text Generation
    try:
        prompt = (
            f"You are 'InvestHer', a witty and persuasive financial coach. "
            f"The user is about to buy '{request.item_name}' for ${request.price}. "
            f"Write a specific, punchy 1-sentence message (max 20 words) telling them why they should save this money instead. "
            f"Explicitly mention the item name in a fun or slightly judgmental way."
        )
        
        response = gemini_client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt
        )
        ai_message = response.text.strip().replace('"', '')
    except Exception as e:
        print(f"Gemini Error: {e}")
        ai_message = "Your future self will thank you for saving this!"

    # 2. ElevenLabs Audio Generation
    audio_base64 = None
    try:
        audio_generator = eleven_client.text_to_speech.convert(
            text=ai_message,
            voice_id="21m00Tcm4TlvDq8ikWAM", # Rachel
            model_id="eleven_monolingual_v1"
        )
        audio_bytes = b"".join(audio_generator)
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
    except Exception as e:
        print(f"ElevenLabs Error: {e}")

    return {"message": ai_message, "audio": audio_base64}

@app.post("/add-savings")
def add_savings(item: SavingItem):
    conn = sqlite3.connect('investher.db')
    c = conn.cursor()
    c.execute("INSERT INTO savings (item_name, amount) VALUES (?, ?)", (item.item_name, item.amount))
    conn.commit()
    conn.close()
    return {"status": "saved"}

@app.get("/get-dashboard-data")
def get_dashboard_data():
    conn = sqlite3.connect('investher.db')
    c = conn.cursor()
    
    # Get History
    c.execute("SELECT item_name, amount, timestamp FROM savings ORDER BY id DESC")
    history = c.fetchall()
    
    # Get Total
    c.execute("SELECT SUM(amount) FROM savings")
    total_saved = c.fetchone()[0] or 0
    
    conn.close()

    # Get Projections
    projections = financial_engine.get_etf_projection("VOO", total_saved, years=20)

    return {
        "history": history,
        "total_saved": total_saved,
        "projections": projections
    }