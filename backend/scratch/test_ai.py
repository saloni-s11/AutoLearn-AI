import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
print(f"API Key present: {bool(GROQ_API_KEY)}")

client = Groq(api_key=GROQ_API_KEY)

try:
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "Output JSON only."},
            {"role": "user", "content": "Give me a JSON object with one key 'test' and value 'success'."},
        ],
        response_format={"type": "json_object"},
    )
    print("AI Response:")
    print(resp.choices[0].message.content)
except Exception as e:
    print(f"AI Error: {e}")
