import os
import asyncio
import io
import requests
import wikipedia
import pypdf
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from groq import Groq
from dotenv import load_dotenv
from googleapiclient.discovery import build
from duckduckgo_search import DDGS
from motor.motor_asyncio import AsyncIOMotorClient
import jwt
import bcrypt

# Load environment variables
load_dotenv()

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET", "study_studio_super_secret_key_123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
MONGODB_URL = os.getenv("MONGODB_URL", "").strip('"').strip("'")

app = FastAPI()

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:8081",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:8080"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔒 Security & DB Init
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# MongoDB Client
import certifi
client_db = AsyncIOMotorClient(
    MONGODB_URL, 
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=5000, # 5 second timeout for easier debugging
    connectTimeoutMS=10000
)
db = client_db.study_studio

# 🔑 API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM" # Default voice 'Rachel'

# Initialize Clients
groq_client = Groq(api_key=GROQ_API_KEY)

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

# --- Original Multi-modal Functions (Untouched for consistency) ---

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

    try:
        arxiv_url = f"http://export.arxiv.org/api/query?search_query=all:{query}&start=0&max_results={limit}"
        response = requests.get(arxiv_url, timeout=5)
        root = ET.fromstring(response.text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        papers = []
        for entry in root.findall("atom:entry", ns):
            papers.append({
                "title": entry.find("atom:title", ns).text.strip().replace("\n", " "),
                "authors": [a.find("atom:name", ns).text for a in entry.findall("atom:author", ns)],
                "year": int(entry.find("atom:published", ns).text[:4]),
                "abstract": entry.find("atom:summary", ns).text.strip().replace("\n", " "),
                "url": entry.find("atom:id", ns).text,
                "pdf": next((l.get("href") for l in entry.findall("atom:link", ns) if l.get("title") == "pdf" or l.get("type") == "application/pdf"), ""),
                "citations": 0,
                "source": "arXiv"
            })
        return papers
    except: return []

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
        results = DDGS().text(f"{topic} explained", max_results=3)
        data["links"] = [{"title": r["title"], "url": r["href"]} for r in results]
    except: pass
    return data

def get_dictionary_definitions(words: list, context_snippet: str):
    definitions = []
    # Defensive check: Ensure words is a list of strings
    clean_words = []
    for w in words:
        if isinstance(w, str): clean_words.append(w)
        elif isinstance(w, dict): clean_words.append(list(w.values())[0])

    vibe_prompt = f"Explain these terms for a student based on context: {context_snippet[:2000]}. Words: {', '.join(clean_words)}. Return JSON: {{'definitions': [{{'word': '...', 'meaning': '...'}}]}}"
    contextual_meanings = {}
    try:
        res = groq_client.chat.completions.create(model="llama-3.3-70b-versatile", messages=[{"role": "user", "content": vibe_prompt}], response_format={"type": "json_object"})
        ai_data = json.loads(res.choices[0].message.content)
        for item in ai_data.get("definitions", []):
            contextual_meanings[item["word"].strip().lower()] = item["meaning"]
    except: pass

    for word in words[:10]:
        clean_word = word.strip().lower()
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
            definitions.append({"word": word.title(), "definition": final_meaning, "phonetic": phonetic, "partOfSpeech": pos})
    return definitions

# --- Endpoints ---

@app.post("/auth/signup")
async def signup(username: str = Form(...), password: str = Form(...)):
    existing_user = await db.users.find_one({"username": username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    user_obj = {
        "username": username,
        "password": get_password_hash(password),
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user_obj)
    return {"message": "User created successfully"}

@app.post("/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/research/search")
async def search_research(q: str):
    return {"papers": get_academic_papers(q)}

@app.post("/chat")
async def chat(message: str = Form(""), context: str = Form("")):
    prompt = f"Expert tutor. Context: {context[:4000]}. Question: {message}"
    try:
        response = groq_client.chat.completions.create(model="llama-3.3-70b-versatile", messages=[{"role": "user", "content": prompt}])
        return {"response": response.choices[0].message.content}
    except Exception as e:
        print(f"Chat error: {str(e)}")
        return {"response": "Error connecting to AI brain."}

async def fetch_youtube_safe(topic):
    try:
        print(f"Fetching YouTube videos for: {topic}...")
        res = await asyncio.to_thread(get_youtube_videos, topic)
        print(f"YouTube videos fetched: {len(res)}")
        return res
    except Exception as e:
        print(f"YouTube fetch failed: {str(e)}")
        return []

async def fetch_pexels_safe(topic):
    try:
        print(f"Fetching Pexels images for: {topic}...")
        res = await asyncio.to_thread(get_pexels_images, topic)
        print(f"Pexels images fetched: {len(res)}")
        return res
    except Exception as e:
        print(f"Pexels fetch failed: {str(e)}")
        return []

async def fetch_research_safe(topic):
    try:
        print(f"Fetching research metadata for: {topic}...")
        res = await asyncio.to_thread(get_research_data, topic)
        print("Research metadata fetched.")
        return res
    except Exception as e:
        print(f"Research fetch failed: {str(e)}")
        return {"wiki": "", "links": []}

async def fetch_vocabulary_safe(terms, content):
    try:
        print(f"Fetching dictionary definitions for {len(terms)} terms...")
        res = await asyncio.to_thread(get_dictionary_definitions, terms, content)
        print(f"Dictionary definitions fetched: {len(res)}")
        return res
    except Exception as e:
        print(f"Vocabulary fetch failed: {str(e)}")
        return []

@app.get("/health/db")
async def health_db():
    try:
        await client_db.admin.command('ping')
        return {"status": "online", "message": "MongoDB is connected"}
    except Exception as e:
        return {"status": "offline", "error": str(e)}

@app.post("/learn")
async def learn(file: UploadFile = File(None), text: str = Form("")):
    print(f"--- LEARN START: {datetime.now()} ---")
    content = text
    if file:
        file_content = await file.read()
        try:
            if file.filename.lower().endswith(".pdf"):
                pdf_reader = pypdf.PdfReader(io.BytesIO(file_content))
                content += "\n" + "".join([p.extract_text() for p in pdf_reader.pages])
            elif file.filename.lower().endswith((".mp3", ".wav", ".m4a", ".webm", ".flac", ".ogg")):
                print(f"Transcribing audio: {file.filename}...")
                transcription = groq_client.audio.transcriptions.create(
                    file=(file.filename, file_content),
                    model="whisper-large-v3",
                )
                content += "\n" + transcription.text
            else:
                content += "\n" + file_content.decode("utf-8")
        except Exception as e: 
            print(f"Error decoding file: {str(e)}")
            raise HTTPException(status_code=400, detail="Error decoding file.")
    
    print(f"Content length: {len(content)} characters")

    if not content.strip(): return {"result": "Please provide content."}

    try:
        print(f"Extracting topic for content: {content[:100]}...")
        topic_res = groq_client.chat.completions.create(model="llama-3.3-70b-versatile", messages=[{"role": "user", "content": f"Extract topic (2-4 words): {content[:200]}"}])
        core_topic = topic_res.choices[0].message.content.strip().replace('"', '')
        print(f"Core Topic detected: {core_topic}")
    except Exception as e:
        print(f"Topic extraction failed: {str(e)}")
        core_topic = content[:30]

    # Generate Suite
    prompt = f"""
    Analyze the following content and generate an EXHAUSTIVE academic study suite.
    
    You MUST return a JSON object with these EXACT keys and structures:
    {{
      "notes": [
        {{ "title": "Chapter Title", "content": "Detailed explanation..." }}
      ],
      "quiz": [
        {{ 
          "question": "The question text?", 
          "options": ["Option A", "Option B", "Option C", "Option D"], 
          "correct": 0 
        }}
      ],
      "flashcards": [
        {{ "front": "Term or Question", "back": "Definition or Answer" }}
      ],
      "vocabulary_terms": ["string1", "string2"]
    }}
    
    REQUIREMENTS:
    - 7-10 detailed chapters for "notes".
    - 10-12 questions for "quiz" (index 0-3 for correct).
    - 10-15 "flashcards" for key concepts.
    - 8-10 technical words for "vocabulary_terms".
    
    Content to analyze:
    {content}
    """
    try:
        print(f"Generating full study suite from Groq...")
        # Truncate content to avoid context window issues (approx 6000 tokens)
        truncated_content = content[:20000] 
        response = groq_client.chat.completions.create(model="llama-3.3-70b-versatile", messages=[{"role": "user", "content": prompt.replace("{content}", truncated_content)}], response_format={"type": "json_object"})
        ai_data = json.loads(response.choices[0].message.content)
        print("Study suite generated successfully.")
    except Exception as e: 
        print(f"Study suite generation failed: {str(e)}")
        ai_data = {"notes": [], "quiz": [], "flashcards": [], "vocabulary_terms": []}

    # Parallelize External Data Fetching (YouTube, Pexels, Wikipedia, Dictionary)
    print("--- Parallel Enrichment Phase Starting ---")
    tasks = [
        fetch_youtube_safe(core_topic),
        fetch_pexels_safe(core_topic),
        fetch_research_safe(core_topic),
        fetch_vocabulary_safe(ai_data.get("vocabulary_terms", []), content)
    ]
    
    # Run all enrichment tasks simultaneously
    videos, images, research, vocabulary = await asyncio.gather(*tasks)
    
    print(f"--- LEARN COMPLETE: {datetime.now()} (Total Enrichment parallelized) ---")

    return {
        "result": json.dumps(ai_data),
        "videos": videos,
        "images": images,
        "research": research,
        "vocabulary": vocabulary
    }

@app.post("/tts")
async def text_to_speech(text: str = Form(...)):
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")
    
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": true
        }
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        if response.status_code != 200:
            error_detail = response.json() if response.status_code != 404 else response.text
            print(f"ELEVENLABS API ERROR [{response.status_code}]: {error_detail}")
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs Error: {error_detail}")
            
        return StreamingResponse(io.BytesIO(response.content), media_type="audio/mpeg")
    except Exception as e:
        print(f"TTS Backend Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/roadmap")
async def generate_roadmap(topic: str = Form(...), timeline: Optional[str] = Form(None)):
    timeline_context = f"The entire roadmap MUST be structured to be completed within a total duration of: {timeline}." if timeline else "Determine an appropriate and realistic total duration based on the topic's depth."
    
    prompt = f"""
    Create a professional academic roadmap to master the following topic: {topic}
    {timeline_context}
    
    You MUST return a JSON object with this EXACT structure:
    {{
      "title": "Mastering {topic}",
      "target": "A concise goal statement including the total estimated duration",
      "milestones": [
        {{
          "step": 1,
          "title": "Foundational Step",
          "description": "Clear description of core concepts to learn.",
          "time": "Est. duration for this specific step",
          "level": "Beginner"
        }}
      ]
    }}
    REQUIREMENTS:
    - Include 5-10 logical milestones.
    - If a timeline was provided ({timeline if timeline else 'None'}), ensure the sum of specific milestone times aligns with it.
    - Difficulty levels should progress (Beginner -> Intermediate -> Advanced).
    - Content should be specific and actionable.
    """
    try:
        print(f"Generating roadmap for: {topic}...")
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)
        print("Roadmap generated successfully.")
        return data
    except Exception as e:
        print(f"Roadmap generation failed: {str(e)}")
        return {
            "title": f"Path to {topic}",
            "target": "Goal not generated",
            "milestones": [{"step": 1, "title": "Error", "description": "Failed to generate roadmap", "time": "N/A", "level": "N/A"}]
        }

@app.post("/sessions/save")
async def save_session(session_data: str = Form(...), user: str = Depends(get_current_user)):
    data = json.loads(session_data)
    save_obj = {
        "username": user,
        "title": data.get("title"),
        "type": data.get("type"),
        "timestamp": data.get("timestamp"),
        "data": data.get("data"),
        "saved_at": datetime.now(timezone.utc)
    }
    await db.sessions.insert_one(save_obj)
    return {"message": "Session saved successfully"}

@app.get("/sessions/me")
async def get_my_sessions(user: str = Depends(get_current_user)):
    cursor = db.sessions.find({"username": user}).sort("saved_at", -1)
    sessions = []
    async for s in cursor:
        s["_id"] = str(s["_id"])
        sessions.append(s)
    return {"sessions": sessions}

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user: str = Depends(get_current_user)):
    from bson import ObjectId
    res = await db.sessions.delete_one({"_id": ObjectId(session_id), "username": user})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Deleted"}