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
from pydantic import BaseModel

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from groq import Groq
from dotenv import load_dotenv
from googleapiclient.discovery import build
from duckduckgo_search import DDGS
from motor.motor_asyncio import AsyncIOMotorClient
import jwt
import bcrypt

# ✅ LOAD ENV FIRST
load_dotenv()

# ✅ CREATE APP FIRST
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ OPTIONAL ROOT (prevents 404 confusion)
@app.get("/")
def root():
    return {"message": "AutoLearn AI Backend Running 🚀"}

# ✅ NOW import routers
from routers import exam, video, voice, share, mindmap

# ✅ INCLUDE ROUTERS AFTER app is created
app.include_router(exam.router)
app.include_router(video.router)
app.include_router(voice.router)
app.include_router(share.router)
app.include_router(mindmap.router)

from auth import get_current_user, create_access_token, verify_password, get_password_hash, oauth2_scheme
MONGODB_URL = os.getenv("MONGODB_URL", "").strip('"').strip("'")

# --- Auth Routes ---
@app.post("/auth/signup")
async def signup(username: str = Form(...), password: str = Form(...)):
    # Check if user exists
    existing_user = await db.users.find_one({"username": username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_password = get_password_hash(password)
    new_user = {
        "username": username,
        "password": hashed_password,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(new_user)
    return {"message": "User created successfully"}

@app.post("/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"username": form_data.username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

# MongoDB Client
import certifi
client_db = AsyncIOMotorClient(
    MONGODB_URL, 
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=10000
)
db = client_db.study_studio
app.state.db = db

# API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")

groq_client = Groq(api_key=GROQ_API_KEY)

# --- Auth Helpers ---
# --- Auth Helpers (Moved to auth.py) ---

# --- Functions (unchanged) ---
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
    except:
        return []

# --- Session Models ---
class SessionModel(BaseModel):
    id: str
    title: str
    type: str
    timestamp: str
    data: dict

# --- Learning Endpoints ---
@app.post("/learn")
async def generate_learning_content(
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    try:
        print(f"DEBUG: Learning endpoint hit with text={bool(text)}, file={bool(file)}")
        content = ""
        if text:
            content = text
        if file:
            file_content = await file.read()
            if file.filename.endswith(".pdf"):
                import io
                import pypdf
                pdf_reader = pypdf.PdfReader(io.BytesIO(file_content))
                for page in pdf_reader.pages:
                    content += page.extract_text() + "\n"
            else:
                content += file_content.decode("utf-8", errors="ignore")

        if not content:
            raise HTTPException(400, "No content provided")

        # 1. Generate Core Learning Content
        prompt = f"""Analyze the following content and provide a comprehensive learning suite.
        Return STRICT JSON:
        {{
          "notes": [
            {{"title": "Section Title", "content": "Detailed explanatory text"}}
          ],
          "quiz": [
            {{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}}
          ],
          "flashcards": [
            {{"q": "...", "a": "..."}}
          ],
          "vocabulary": [
            {{"word": "...", "definition": "..."}}
          ],
          "main_concept": "The primary topic name for further research"
        }}
        
        Content:
        {content[:10000]}"""

        # 1. Generate Core Learning Content
        def call_groq():
            return groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are an elite academic tutor. Output strict JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
                response_format={"type": "json_object"},
            )

        resp = await asyncio.to_thread(call_groq)
        
        learning_data = json.loads(resp.choices[0].message.content)
        main_concept = learning_data.get("main_concept", "learning")

        # 2. Search for related videos (YouTube)
        videos = []
        try:
            def call_youtube():
                youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
                request = youtube.search().list(
                    q=main_concept,
                    part="snippet",
                    maxResults=3,
                    type="video"
                )
                return request.execute()

            yt_resp = await asyncio.to_thread(call_youtube)
            for item in yt_resp.get("items", []):
                videos.append({
                    "id": item["id"]["videoId"],
                    "title": item["snippet"]["title"],
                    "thumbnail": item["snippet"]["thumbnails"]["medium"]["url"]
                })
        except Exception as e:
            print(f"YouTube error: {e}")

        # 3. Search for research papers & Wikipedia
        wiki_summary = ""
        try:
            wiki_summary = wikipedia.summary(main_concept, sentences=3)
        except:
            pass
        
        papers = get_academic_papers(main_concept, limit=3)
        research_links = [{"title": p["title"], "url": p["url"]} for p in papers]

        # 4. Search for images (DuckDuckGo)
        def call_ddgs():
            images = []
            try:
                with DDGS() as ddgs:
                    ddgs_results = ddgs.images(main_concept, max_results=5)
                    for r in ddgs_results:
                        images.append({"url": r["image"], "alt": main_concept})
            except Exception as e:
                print(f"Image search error: {e}")
            return images

        images = await asyncio.to_thread(call_ddgs)

        result_obj = {
            "notes": learning_data.get("notes", []),
            "quiz": learning_data.get("quiz", []),
            "flashcards": learning_data.get("flashcards", [])
        }

        return {
            "result": json.dumps(result_obj),
            "vocabulary": learning_data.get("vocabulary", []),
            "videos": videos,
            "research": {
                "wiki": wiki_summary,
                "links": research_links
            },
            "images": images
        }
    except Exception as e:
        print(f"CRITICAL ERROR in /learn: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Backend Error: {str(e)}")

# --- Session Endpoints ---
@app.get("/sessions/me")
async def get_my_sessions(username: str = Depends(get_current_user)):
    try:
        user_sessions = await db.sessions.find({"username": username}).sort("created_at", -1).to_list(100)
        for s in user_sessions:
            s["_id"] = str(s["_id"])
        return {"sessions": user_sessions}
    except Exception as e:
        print(f"Database error in get_my_sessions: {e}")
        return {"sessions": [], "error": "Database temporarily unavailable"}

@app.post("/sessions/save")
async def save_session(
    session_data: str = Form(...),
    username: str = Depends(get_current_user)
):
    try:
        data = json.loads(session_data)
        session_doc = {
            "username": username,
            "title": data.get("title", "Untitled Session"),
            "type": data.get("type", "General"),
            "timestamp": data.get("timestamp", datetime.now().isoformat()),
            "data": data.get("data", {}),
            "created_at": datetime.now(timezone.utc)
        }
        result = await db.sessions.insert_one(session_doc)
        return {"message": "Session saved", "id": str(result.inserted_id)}
    except Exception as e:
        print(f"Error saving session: {e}")
        raise HTTPException(500, f"Failed to save session: {str(e)}")

@app.post("/chat")
async def chat_tutor(
    message: str = Form(...),
    context: str = Form("")
):
    try:
        prompt = f"""You are an elite academic tutor.
        Context from study materials:
        {context}
        
        User question: {message}
        
        Provide a concise, helpful, and accurate response based on the context."""
        
        def call_groq():
            return groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7
            )
            
        resp = await asyncio.to_thread(call_groq)
        return {"response": resp.choices[0].message.content}
    except Exception as e:
        raise HTTPException(500, f"Chat error: {str(e)}")

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str, username: str = Depends(get_current_user)):
    from bson import ObjectId
    try:
        result = await db.sessions.delete_one({"_id": ObjectId(session_id), "username": username})
        if result.deleted_count == 0:
            raise HTTPException(404, "Session not found")
        return {"message": "Session deleted"}
    except:
        raise HTTPException(400, "Invalid session ID")