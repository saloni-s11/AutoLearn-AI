import google.generativeai as genai

genai.configure(api_key="AIzaSyARbAIyRttPARWHc8h-ylYHJWmffvYKH2E")

with open("models_list.txt", "w") as f:
    for m in genai.list_models():
        f.write(f"{m.name}\n")
