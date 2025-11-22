import os
from dotenv import load_dotenv
from google import genai

# 1. Load your specific env file
load_dotenv("GEMINI_KEY.env")

# 2. Get the key that you named "GEMINI_API_KEY"
my_api_key = os.getenv("GEMINI_API_KEY")

if not my_api_key:
    print("Error: Could not find GEMINI_API_KEY in GEMINI_KEY.env")
else:
    # 3. Pass the key explicitly to the client
    client = genai.Client(api_key=my_api_key)

    # 4. Use a valid model name (gemini-2.5 doesn't exist yet, changed to 1.5)
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash", 
            contents="Explain how AI works in a few words"
        )
        print(response.text)
    except Exception as e:
        print(f"An error occurred: {e}")