import google.generativeai as genai
import sys

# Get API key from the provide code in main.py
api_key = "AIzaSyARbAIyRttPARWHc8h-ylYHJWmffvYKH2E"
genai.configure(api_key=api_key)

try:
    print("Listing available models...")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"Model: {m.name}, Methods: {m.supported_generation_methods}")
except Exception as e:
    print(f"Error: {e}")
