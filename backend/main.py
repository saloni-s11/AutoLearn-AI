import os
import asyncio
import io
import requests
import wikipedia
import pypdf
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from groq import AsyncGroq
from dotenv import load_dotenv
from googleapiclient.discovery import build
from ddgs import DDGS
from motor.motor_asyncio import AsyncIOMotorClient
import jwt
import bcrypt
import certifi

# Load environment variables
load_dotenv()

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET", "study_studio_super_secret_key_123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
MONGODB_URL = os.getenv("MONGODB_URL", "").strip('"').strip("'")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")

app = FastAPI()

# ✅ STEP 2: CORS Middleware (Immediate application after app init)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:8081", "http://localhost:8082", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔒 Security & DB Init
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

client_db = AsyncIOMotorClient(
    MONGODB_URL, 
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=10000
)
db = client_db.study_studio

# Initialize AI Client
groq_client = AsyncGroq(api_key=GROQ_API_KEY)

# --- DB Connection Validation ---
@app.on_event("startup")
async def startup_db_client():
    try:
        # Ping the database to verify Atlas connection
        await db.command("ping")
        print("✅ Successfully connected to MongoDB Atlas")
    except Exception as e:
        print(f"❌ MongoDB Atlas Connection Failed: {e}")
        # We don't raise an exception here to let the server start, 
        # but the log will tell us if it's the culprit.

# --- Auth Helpers ---
def verify_password(plain_password, hashed_password):
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# --- Health Check ---
@app.get("/health")
async def health():
    return {"status": "ok"}

# --- Global Exception Handler ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"🔥 ERROR in {request.url.path}: {exc}")
    traceback.print_exc()
    return HTTPException(status_code=500, detail=str(exc))

# --- Enrichment Helpers ---

def get_academic_papers(query: str, limit: int = 10):
    try:
        url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={query}&limit={limit}&fields=title,authors,year,abstract,url,openAccessPdf,citationCount"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            papers = []
            for item in data.get("data", []):
                papers.append({
                    "title": item.get("title"),
                    "authors": [a.get("name") for a in item.get("authors", [])],
                    "year": item.get("year"),
                    "abstract": item.get("abstract"),
                    "url": item.get("url"),
                    "pdf": item.get("openAccessPdf", {}).get("url") if item.get("openAccessPdf") else None,
                    "citations": item.get("citationCount", 0),
                    "source": "Semantic Scholar"
                })
            if papers: return papers
    except: pass
    return []

def get_youtube_videos(topic: str, limit: int = 3):
    if not YOUTUBE_API_KEY: return []
    try:
        youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
        request = youtube.search().list(q=f"{topic} educational tutorial", part="snippet", maxResults=limit, type="video")
        response = request.execute()
        return [{"id": item["id"]["videoId"], "title": item["snippet"]["title"], "thumbnail": item["snippet"]["thumbnails"]["medium"]["url"]} for item in response.get("items", [])]
    except: return []

def get_pexels_images(topic: str, limit: int = 4):
    if not PEXELS_API_KEY: return []
    try:
        headers = {"Authorization": PEXELS_API_KEY}
        url = f"https://api.pexels.com/v1/search?query={topic}&per_page={limit}"
        response = requests.get(url, headers=headers)
        return [{"url": img["src"]["large"], "alt": img["alt"]} for img in response.json().get("photos", [])]
    except: return []

def get_research_data(topic: str):
    data = {"wiki": "", "links": []}
    try: data["wiki"] = wikipedia.summary(topic, sentences=3, auto_suggest=False)
    except: pass
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(f"{topic} explained", max_results=3))
        data["links"] = [{"title": r["title"], "url": r["href"]} for r in results]
    except Exception as e:
        print(f"DDG Search Error: {e}")
    return data

async def get_dictionary_definitions(words: list, context_snippet: str):
    definitions = []
    # Normalize words to a list of strings
    normalized_words = []
    for w in words:
        if isinstance(w, str):
            normalized_words.append(w)
        elif isinstance(w, dict) and w:
            # Safely extract word from dict
            word_val = w.get("word") or w.get("term") or list(w.values())[0]
            normalized_words.append(str(word_val))
        elif w:
            normalized_words.append(str(w))

    if not normalized_words:
        return []

    vibe_prompt = f"Explain these terms for a student based on context: {context_snippet[:2000]}. Words: {', '.join(normalized_words)}. Return JSON: {{'definitions': [{{'word': '...', 'meaning': '...'}}]}}"
    contextual_meanings = {}
    try:
        res = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile", 
            messages=[{"role": "user", "content": vibe_prompt}], 
            response_format={"type": "json_object"}
        )
        ai_data = json.loads(res.choices[0].message.content)
        for item in ai_data.get("definitions", []):
            word_key = str(item.get("word", "")).strip().lower()
            if word_key:
                contextual_meanings[word_key] = item.get("meaning", "")
    except: pass

    for word_str in normalized_words[:10]:
        clean_word = str(word_str).strip().lower()
        final_meaning = contextual_meanings.get(clean_word, "")
        phonetic, pos = "", "Technical Term"
        try:
            url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{clean_word}"
            response = requests.get(url, timeout=2)
            if response.status_code == 200:
                data = response.json()[0]
                if not final_meaning or len(clean_word) > 5:
                    final_meaning = data["meanings"][0]["definitions"][0]["definition"]
                phonetic = data.get("phonetic", "")
                pos = data["meanings"][0]["partOfSpeech"].title()
        except: pass
        
        if final_meaning and "not found" not in final_meaning.lower():
            definitions.append({"word": word_str.title() if isinstance(word_str, str) else str(word_str).title(), "definition": final_meaning, "phonetic": phonetic, "partOfSpeech": pos})
    return definitions

# --- Safe Wrappers ---

async def fetch_youtube_safe(topic):
    return await asyncio.to_thread(get_youtube_videos, topic)

async def fetch_pexels_safe(topic):
    return await asyncio.to_thread(get_pexels_images, topic)

async def fetch_research_safe(topic):
    return await asyncio.to_thread(get_research_data, topic)

async def fetch_vocabulary_safe(terms, content):
    return await get_dictionary_definitions(terms, content)

# --- Authentication Endpoints ---

@app.post("/auth/signup")
async def signup(username: str = Form(...), password: str = Form(...)):
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username taken")
    await db.users.insert_one({"username": username, "password": get_password_hash(password)})
    return {"message": "Success"}

@app.post("/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    return {"access_token": create_access_token({"sub": user["username"]}), "token_type": "bearer"}

# --- Learning Endpoints ---

@app.post("/learn")
async def learn(file: UploadFile = File(None), text: str = Form("")):
    content = text
    if file:
        file_content = await file.read()
        if file.filename.lower().endswith(".pdf"):
            pdf_reader = pypdf.PdfReader(io.BytesIO(file_content))
            # Safely handle None returns from extract_text()
            extracted_text = "".join([p.extract_text() or "" for p in pdf_reader.pages])
            content += "\n" + extracted_text
        else:
            try:
                content += "\n" + file_content.decode("utf-8")
            except Exception as e:
                print(f"⚠️ Could not decode file {file.filename}: {e}")
                content += f"\n[Binary File: {file.filename}]"
    
    if not content.strip(): 
        print("⚠️ No content extracted from file/text")
        return {"error": "No content"}

    print(f"📄 Processing content (length: {len(content)})")

    try:
        topic_res = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile", 
            messages=[{"role": "user", "content": f"Extract topic (2-4 words): {content[:500]}"}]
        )
        core_topic = topic_res.choices[0].message.content.strip().replace('"', '')
    except Exception as e:
        print(f"⚠️ Topic extraction failed: {e}")
        core_topic = "General Study"
    
    print(f"🎯 Core Topic: {core_topic}")

    prompt = f"Create an extensive, professional study suite for: {core_topic}. \nReturn ONLY a valid JSON object with these keys: \n'notes' (array of {{title, content}} where each content block is a detailed, multi-paragraph explanation with technical depth and examples), \n'quiz' (EXACTLY 10 questions: 5 Easy, 5 Hard. Format: {{question, options, correct, level, sub_topic}} where 'correct' is the INTEGER INDEX (0-3) of the right option), \n'flashcards' (array of {{front, back}}), \n'vocabulary_terms' (array of strings). \nContext: {content[:8000]}"
    
    try:
        response = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile", 
            messages=[{"role": "user", "content": prompt}], 
            response_format={"type": "json_object"}
        )
        raw_content = response.choices[0].message.content
        print(f"🤖 Raw AI Response Received (Length: {len(raw_content)})")
        
        # --- SELF-HEALING JSON REPAIR ---
        # Fix common AI typos found in logs (e.g., "options([" -> "options": [)
        clean_content = raw_content.replace('"options(["', '"options": [').replace('"options([', '"options": [')
        
        try:
            ai_data = json.loads(clean_content)
        except json.JSONDecodeError:
            # Try basic regex cleaning if standard parse fails
            import re
            json_match = re.search(r'\{.*\}', clean_content, re.DOTALL)
            if json_match:
                ai_data = json.loads(json_match.group())
            else:
                raise
                
    except Exception as e:
        print(f"❌ AI Generation/Parse Failed: {e}")
        ai_data = {
            "notes": [{"title": "Optimization Required", "content": "The AI response was slightly malformed. Please try a shorter text or a different topic."}],
            "quiz": [],
            "flashcards": [],
            "vocabulary_terms": []
        }

    print(f"🤖 AI Data Keys: {list(ai_data.keys())}")

    videos, images, research, vocabulary = await asyncio.gather(
        fetch_youtube_safe(core_topic),
        fetch_pexels_safe(core_topic),
        fetch_research_safe(core_topic),
        fetch_vocabulary_safe(ai_data.get("vocabulary_terms", []), content)
    )
    print(f"✨ Enrichment complete: {len(videos)} vids, {len(images)} imgs")

    return {
        "result": json.dumps(ai_data),
        "videos": videos,
        "images": images,
        "research": research,
        "vocabulary": vocabulary
    }

# --- Topical Roadmap Endpoint ---
@app.post("/generate-topical-roadmap")
async def generate_topical_roadmap(topic: str = Form(...), user: str = Depends(get_current_user)):
    try:
        print(f"🗺️ Generating Topical Roadmap for: {topic}")
        prompt = f"Create a 5-step learning roadmap for: {topic}. Return ONLY JSON: {{'title': '', 'steps': [{{'id': 1, 'title': '', 'description': '', 'type': 'core/prerequisite'}}]}}"
        
        res = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile", 
            messages=[{"role": "user", "content": prompt}], 
            response_format={"type": "json_object"}
        )
        return json.loads(res.choices[0].message.content)
    except Exception as e:
        print(f"❌ Roadmap Generation Failed: {e}")
        return {"error": str(e)}

# --- Research Search Endpoint ---
@app.get("/research/search")
async def research_search(q: str):
    try:
        print(f"🔍 Academic Search for: {q}")
        papers = get_academic_papers(q, limit=10)
        return {"papers": papers}
    except Exception as e:
        print(f"❌ Research Search Failed: {e}")
        return {"papers": []}

# --- STEP 2.3: Evaluation Engine ---

@app.post("/evaluation/submit")
async def submit_evaluation(request: Request, user: str = Depends(get_current_user)):
    try:
        body = await request.json()
        results = body.get("results", [])
        topic = body.get("topic", "Unknown")
        
        # Calculate accuracy per level
        levels = {1: {"correct": 0, "total": 0, "gaps": []}, 2: {"correct": 0, "total": 0}, 3: {"correct": 0, "total": 0}}
        
        for res in results:
            raw_lvl = res.get("level", 1)
            # Robustly handle string levels like "easy", "medium", etc.
            if isinstance(raw_lvl, str):
                raw_lvl_lower = raw_lvl.lower()
                if "easy" in raw_lvl_lower: lvl = 1
                elif "medium" in raw_lvl_lower: lvl = 2
                elif "hard" in raw_lvl_lower: lvl = 3
                else:
                    try: lvl = int(raw_lvl)
                    except: lvl = 1
            else:
                try: lvl = int(raw_lvl)
                except: lvl = 1

            if lvl not in levels: levels[lvl] = {"correct": 0, "total": 0}
            levels[lvl]["total"] += 1
            if res.get("selected") == res.get("correct"):
                levels[lvl]["correct"] += 1
            elif lvl == 1:
                levels[lvl]["gaps"].append(res.get("sub_topic", "General"))

        scores = {str(l): (float(v["correct"])/v["total"] if v["total"] > 0 else 0.0) for l, v in levels.items()}
        gaps = levels[1]["gaps"]
        
        # AI Summary
        analysis_prompt = f"Analyze results for '{topic}': {json.dumps(scores)}. Gaps: {json.dumps(gaps)}. Return a professional 2-sentence mental capacity summary."
        res = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile", 
            messages=[{"role": "user", "content": analysis_prompt}]
        )
        summary = res.choices[0].message.content.strip()

        return {
            "summary": summary,
            "scores": scores,
            "gaps": gaps,
            "topic": topic
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- STEP 2.4: Roadmap Engine ---

@app.post("/roadmap/generate")
async def generate_roadmap_audit(request: Request, user: str = Depends(get_current_user)):
    try:
        body = await request.json()
        summary = body.get("summary", "")
        scores = body.get("scores", {})
        gaps = body.get("gaps", [])
        topic = body.get("topic", "Unknown")
        
        # Pacing Logic
        avg_score = sum(float(v) for v in scores.values()) / len(scores) if scores else 0
        pacing = "Accelerated" if avg_score > 0.8 else "Scaffolded"
        
        prompt = f"""
        Create a Personalized Mastery Roadmap for '{topic}'.
        Context Summary: {summary}
        Current Performance: {json.dumps(scores)}
        Pacing: {pacing}
        
        REQUIREMENT: For each gap in {json.dumps(gaps)}, add at least 2 specific prerequisite steps at the beginning of the roadmap.
        
        Return JSON with:
        {{
          "title": "Mastery Roadmap: {topic}",
          "pacing": "{pacing}",
          "steps": [
            {{ "title": "Step Name", "description": "Description", "type": "prerequisite" | "core" | "milestone", "icon": "Book" | "Zap" | "Target" }}
          ]
        }}
        """
        response = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile", 
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Session Management ---

@app.post("/sessions/save")
async def save_session(session_data: str = Form(...), user: str = Depends(get_current_user)):
    data = json.loads(session_data)
    await db.sessions.insert_one({"username": user, **data, "saved_at": datetime.now(timezone.utc)})
    return {"message": "Saved"}

@app.get("/sessions/me")
async def get_my_sessions(user: str = Depends(get_current_user)):
    cursor = db.sessions.find({"username": user}).sort("saved_at", -1)
    sessions = []
    async for s in cursor:
        s["_id"] = str(s["_id"])
        sessions.append(s)
    return {"sessions": sessions}