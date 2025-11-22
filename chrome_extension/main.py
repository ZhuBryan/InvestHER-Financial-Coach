import os
import sqlite3
import base64
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from elevenlabs.client import ElevenLabs
import financial_engine
from supabase_client import InvestHerDB

# --- Config ---
# Load .env from the same directory as this file
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

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
db = InvestHerDB()

# --- Database (Legacy SQLite - To be deprecated) ---
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
    description: str = ""
    user_goal: str = "Financial Freedom" # Default goal
    user_id: str = "test_user_123" # Placeholder until auth is implemented

class SavingItem(BaseModel):
    item_name: str
    amount: float
    user_id: str = "test_user_123"

# --- Endpoints ---

@app.get("/")
def health_check():
    return {"status": "active"}

@app.post("/generate-coaching")
def generate_coaching(request: CoachRequest):
    # 0. Fetch User Context from Supabase
    user_profile = db.get_user_profile(request.user_id)
    user_goals = db.get_user_goals(request.user_id)
    
    # Construct Context String
    context_str = ""
    if user_profile:
        context_str += f"User Tone Preference: {user_profile.get('tone', 'witty')}. "
        context_str += f"User Struggles: {user_profile.get('struggles', '')}. "
        context_str += f"User Motivations: {user_profile.get('motivations', '')}. "
    
    if user_goals:
        goals_list = ", ".join([g['goal'] for g in user_goals])
        context_str += f"User Goals: {goals_list}. "
    else:
        context_str += f"User Goal: {request.user_goal}. "

    # 1. Gemini Text Generation
    try:
        prompt = (
            f"You are 'InvestHer', a financial coach. "
            f"Context about the user: {context_str}"
            f"The user is about to spend ${request.price}. "
            f"Write a short, punchy 1-sentence message (max 20 words) persuading them to save this money instead. "
            f"Focus entirely on their goals found in the context. "
            f"If a specific goal is mentioned (like 'Trip to Bali' or 'Buying a House'), explicitly say how this money gets them closer to it. "
            f"If no specific goal is found, tell them this money could be growing elsewhere. "
            f"Do NOT mention the name of the item they are buying."
        )
        
        response = gemini_client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt
        )
        ai_message = response.text.strip().replace('"', '')
    except Exception as e:
        print(f"Gemini Error: {e}")
        ai_message = "Think about where else this money could go. Your future self will thank you!"

    # 2. ElevenLabs Audio Generation

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
    # Legacy SQLite
    conn = sqlite3.connect('investher.db')
    c = conn.cursor()
    c.execute("INSERT INTO savings (item_name, amount) VALUES (?, ?)", (item.item_name, item.amount))
    conn.commit()
    conn.close()

    # Supabase Logging (as a 'saved' purchase)
    db.log_purchase({
        "user_id": item.user_id,
        "total_price": item.amount,
        "products": item.item_name,
        "store": "Unknown", # Could be passed from frontend
        "category": "Savings",
        "status": "saved",
        "store_image": ""
    })

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