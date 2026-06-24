import os
import asyncio
import io
import requests
import wikipedia
import pypdf
import json
import xml.etree.ElementTree as ET
import smtplib
import secrets
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
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
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
import jwt
import bcrypt

# Load environment variables
load_dotenv()

# Configuration and Auth
from auth import (
    SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES,
    oauth2_scheme, verify_password, get_password_hash,
    create_access_token, get_current_user
)
from routers.mindmap import router as mindmap_router
from routers.exam import router as exam_router

MONGODB_URL = os.getenv("MONGODB_URL", "").strip('"').strip("'")

app = FastAPI()

# Register Routers
app.include_router(mindmap_router)
app.include_router(exam_router)

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
# MongoDB Client
import certifi
client_db = AsyncIOMotorClient(
    MONGODB_URL, 
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=5000, # 5 second timeout for easier debugging
    connectTimeoutMS=10000
)
db = client_db.study_studio
app.state.db = db

# 🔑 API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM" # Default voice 'Rachel'

# 📧 Email (SMTP) config for forgot-password
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# 🔵 Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# Initialize Clients
groq_client = Groq(api_key=GROQ_API_KEY)

# --- Original Multi-modal Functions (Untouched for consistency) ---

def _fetch_semantic_scholar(query: str, limit: int) -> list:
    ss_api_key = os.getenv("SEMANTIC_SCHOLAR_API_KEY", "")
    headers_ss = {"x-api-key": ss_api_key} if ss_api_key else {}
    try:
        url = (
            f"https://api.semanticscholar.org/graph/v1/paper/search"
            f"?query={requests.utils.quote(query)}&limit={limit}"
            f"&fields=title,authors,year,abstract,url,openAccessPdf,citationCount"
        )
        response = requests.get(url, headers=headers_ss, timeout=15)
        if response.status_code == 200:
            papers = []
            for item in response.json().get("data", []):
                title = item.get("title") or ""
                if not title:
                    continue
                papers.append({
                    "title": title,
                    "authors": [a.get("name", "") for a in item.get("authors", [])],
                    "year": item.get("year"),
                    "abstract": item.get("abstract") or "",
                    "url": item.get("url") or "",
                    "pdf": item.get("openAccessPdf", {}).get("url") if item.get("openAccessPdf") else None,
                    "citations": item.get("citationCount", 0),
                    "source": "Semantic Scholar",
                })
            return papers
        else:
            print(f"[Semantic Scholar] HTTP {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print(f"[Semantic Scholar] Failed: {e}")
    return []


def _fetch_crossref(query: str, limit: int) -> list:
    try:
        url = (
            f"https://api.crossref.org/works"
            f"?query={requests.utils.quote(query)}&rows={limit}"
            f"&select=title,author,published,abstract,URL,is-referenced-by-count"
        )
        response = requests.get(
            url,
            headers={"User-Agent": "AutoLearnAI/1.0 (mailto:autolearn@example.com)"},
            timeout=15,
        )
        if response.status_code == 200:
            papers = []
            for item in response.json().get("message", {}).get("items", []):
                title = (item.get("title") or [""])[0]
                if not title:
                    continue
                authors = [
                    f"{a.get('given', '')} {a.get('family', '')}".strip()
                    for a in item.get("author", [])
                ]
                pub = item.get("published", {}).get("date-parts", [[None]])[0]
                year = pub[0] if pub else None
                papers.append({
                    "title": title,
                    "authors": authors,
                    "year": year,
                    "abstract": item.get("abstract") or "",
                    "url": item.get("URL") or "",
                    "pdf": None,
                    "citations": item.get("is-referenced-by-count", 0),
                    "source": "CrossRef",
                })
            return papers
        else:
            print(f"[CrossRef] HTTP {response.status_code}")
    except Exception as e:
        print(f"[CrossRef] Failed: {e}")
    return []


def _fetch_arxiv(query: str, limit: int) -> list:
    try:
        arxiv_url = (
            f"https://export.arxiv.org/api/query"
            f"?search_query=all:{requests.utils.quote(query)}&start=0&max_results={limit}"
        )
        response = requests.get(arxiv_url, timeout=20)
        root = ET.fromstring(response.text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        papers = []
        for entry in root.findall("atom:entry", ns):
            title_el = entry.find("atom:title", ns)
            pub_el = entry.find("atom:published", ns)
            summary_el = entry.find("atom:summary", ns)
            id_el = entry.find("atom:id", ns)
            if title_el is None:
                continue
            papers.append({
                "title": title_el.text.strip().replace("\n", " "),
                "authors": [
                    a.find("atom:name", ns).text
                    for a in entry.findall("atom:author", ns)
                    if a.find("atom:name", ns) is not None
                ],
                "year": int(pub_el.text[:4]) if pub_el is not None else None,
                "abstract": summary_el.text.strip().replace("\n", " ") if summary_el is not None else "",
                "url": id_el.text if id_el is not None else "",
                "pdf": next(
                    (l.get("href") for l in entry.findall("atom:link", ns)
                     if l.get("title") == "pdf" or l.get("type") == "application/pdf"),
                    None,
                ),
                "citations": 0,
                "source": "arXiv",
            })
        return papers
    except Exception as e:
        print(f"[arXiv] Failed: {e}")
    return []


def get_academic_papers(query: str, limit: int = 10):
    """Kept for backward compatibility — sync wrapper."""
    ss = _fetch_semantic_scholar(query, limit)
    cr = _fetch_crossref(query, limit)
    ax = _fetch_arxiv(query, limit)
    return _merge_papers(ss, cr, ax)


def _merge_papers(*sources) -> list:
    seen: set = set()
    merged = []
    for source_list in sources:
        for p in source_list:
            key = p["title"].lower().strip()
            if key not in seen:
                seen.add(key)
                merged.append(p)
    return merged

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
async def signup(
    username: str = Form(...),
    password: str = Form(...),
    email: str = Form(...),
):
    # Check for existing username or email
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username already registered")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_obj = {
        "username": username,
        "email": email.lower().strip(),
        "password": get_password_hash(password),
        "auth_provider": "local",
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_obj)
    return {"message": "Account created successfully"}


@app.post("/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/auth/forgot-password")
async def forgot_password(email: str = Form(...)):
    user = await db.users.find_one({"email": email.lower().strip()})
    # Always return 200 so we don't leak whether an email exists
    if not user:
        return {"message": "If that email is registered, a new password has been sent."}

    # Block if SMTP is not configured
    if not SMTP_USER or not SMTP_PASSWORD:
        raise HTTPException(
            status_code=500,
            detail="Email service is not configured. Please contact the administrator."
        )

    # Generate a secure random temporary password
    alphabet = string.ascii_letters + string.digits
    temp_password = "".join(secrets.choice(alphabet) for _ in range(12))

    # Hash and save it BEFORE trying to send email
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password": get_password_hash(temp_password)}}
    )

    # Send email via SMTP
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "AutoLearn AI — Your Temporary Password"
        msg["From"] = SMTP_USER
        msg["To"] = email

        html_body = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border-radius:16px;background:#f9fafb;">
          <h2 style="color:#6366f1;margin-bottom:8px;">AutoLearn AI</h2>
          <p>Hi <strong>{user['username']}</strong>,</p>
          <p>Here is your temporary password. Please log in and change it immediately.</p>
          <div style="background:#ede9fe;border-radius:12px;padding:20px;text-align:center;font-size:22px;
                      font-weight:bold;letter-spacing:2px;color:#4f46e5;margin:24px 0;">
            {temp_password}
          </div>
          <p style="color:#6b7280;font-size:13px;">
            If you did not request this, please ignore this email.
          </p>
        </div>
        """
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, email, msg.as_string())

        print(f"[SMTP] Password reset email sent to {email}")
    except smtplib.SMTPAuthenticationError:
        print("[SMTP Error] Authentication failed — check SMTP_USER and SMTP_PASSWORD (Gmail requires an App Password)")
        raise HTTPException(
            status_code=500,
            detail="Email authentication failed. Gmail requires an App Password, not your regular password. "
                   "Go to myaccount.google.com → Security → App Passwords to generate one."
        )
    except smtplib.SMTPException as e:
        print(f"[SMTP Error] {e}")
        raise HTTPException(status_code=500, detail=f"SMTP error: {str(e)}")
    except Exception as e:
        print(f"[Email Error] {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    return {"message": "If that email is registered, a new password has been sent."}


@app.post("/auth/google")
async def google_signin(token: str = Form(...)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google Sign-In is not configured on this server.")

    try:
        idinfo = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")

    google_id = idinfo["sub"]
    email = idinfo.get("email", "").lower().strip()
    name = idinfo.get("name") or idinfo.get("given_name") or email.split("@")[0]

    # Find or create the user
    user = await db.users.find_one({"google_id": google_id})
    if not user:
        # Also check if same email exists (local account) — link it
        user = await db.users.find_one({"email": email})
        if user:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"google_id": google_id, "auth_provider": "google"}}
            )
        else:
            # Brand new user via Google
            username = name.replace(" ", "_").lower()
            # Ensure username uniqueness
            base, counter = username, 1
            while await db.users.find_one({"username": username}):
                username = f"{base}_{counter}"
                counter += 1

            user_obj = {
                "username": username,
                "email": email,
                "password": None,
                "google_id": google_id,
                "auth_provider": "google",
                "created_at": datetime.now(timezone.utc),
            }
            result = await db.users.insert_one(user_obj)
            user = await db.users.find_one({"_id": result.inserted_id})

    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer", "username": user["username"]}

@app.get("/auth/profile")
async def get_profile(username: str = Depends(get_current_user)):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "username": user["username"],
        "email": user.get("email", ""),
        "auth_provider": user.get("auth_provider", "local"),
    }


@app.put("/auth/profile")
async def update_profile(
    new_username: str = Form(None),
    new_email: str = Form(None),
    new_password: str = Form(None),
    current_password: str = Form(None),
    username: str = Depends(get_current_user),
):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates: dict = {}

    # --- Username change ---
    if new_username and new_username != username:
        if await db.users.find_one({"username": new_username}):
            raise HTTPException(status_code=400, detail="Username already taken")
        updates["username"] = new_username

    # --- Email change ---
    if new_email and new_email.lower().strip() != user.get("email", ""):
        if await db.users.find_one({"email": new_email.lower().strip()}):
            raise HTTPException(status_code=400, detail="Email already in use")
        updates["email"] = new_email.lower().strip()

    # --- Password change ---
    if new_password:
        # For local accounts, require current password verification
        if user.get("auth_provider", "local") == "local" and user.get("password"):
            if not current_password:
                raise HTTPException(status_code=400, detail="Current password is required to set a new password")
            if not verify_password(current_password, user["password"]):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
        updates["password"] = get_password_hash(new_password)

    if not updates:
        return {"message": "No changes made", "username": username}

    await db.users.update_one({"username": username}, {"$set": updates})

    # Issue a fresh token if username changed
    final_username = updates.get("username", username)
    new_token = create_access_token(data={"sub": final_username})
    return {
        "message": "Profile updated successfully",
        "username": final_username,
        "access_token": new_token,
        "token_type": "bearer",
    }



@app.get("/research/search")
async def search_research(q: str):
    # Fetch all three sources in parallel — don't wait for the slow ones sequentially
    ss_task = asyncio.to_thread(_fetch_semantic_scholar, q, 10)
    cr_task = asyncio.to_thread(_fetch_crossref, q, 10)
    ax_task = asyncio.to_thread(_fetch_arxiv, q, 10)
    ss_results, cr_results, ax_results = await asyncio.gather(ss_task, cr_task, ax_task)
    papers = _merge_papers(ss_results, cr_results, ax_results)
    return {"papers": papers}

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
            "use_speaker_boost": True
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