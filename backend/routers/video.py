import os
import re
import json
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq 
from youtube_transcript_api import YouTubeTranscriptApi

load_dotenv()

router = APIRouter(prefix="/video", tags=["video"])

# Initialize client lazily to prevent top-level crashes
def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(500, "GROQ_API_KEY not configured in backend")
    return Groq(api_key=api_key)

class SummarizeRequest(BaseModel):
    video_id: str | None = None
    url: str | None = None

def extract_video_id(url: str) -> str | None:
    if not url:
        return None
    patterns = [
        r"(?:v=|\/)([0-9A-Za-z_-]{11}).*",
        r"youtu\.be\/([0-9A-Za-z_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None

def get_transcript_sync(video_id: str) -> str:
    """Synchronous core for transcript fetching"""
    api = YouTubeTranscriptApi()
    transcript_list = api.list(video_id)
    try:
        # 1. Try native English
        transcript = transcript_list.find_transcript(["en", "en-US", "en-GB"])
    except Exception:
        try:
            # 2. Try to translate to English if possible
            first_transcript = list(transcript_list)[0]
            transcript = first_transcript.translate('en')
        except Exception:
            # 3. Fallback: Use the original language
            transcript = list(transcript_list)[0]
    
    chunks = transcript.fetch()
    return " ".join(chunk.text for chunk in chunks)

@router.post("/summarize")
async def summarize_video(req: SummarizeRequest):
    vid = req.video_id or extract_video_id(req.url or "")
    if not vid:
        raise HTTPException(400, "Provide video_id or valid URL")

    try:
        # Run blocking transcript fetch in a thread
        transcript_text = await asyncio.to_thread(get_transcript_sync, vid)
        transcript = transcript_text[:8000]  # Reduced cap to stay within TPM limits
    except Exception as e:
        print(f"Transcript Error: {e}")
        raise HTTPException(400, f"AI Summary failed: No usable transcript found. {str(e)}")

    prompt = f"""Summarize this YouTube transcript. 
IMPORTANT: The transcript might be in a foreign language (like Hindi). You MUST output the summary and key points in ENGLISH.

Return STRICT JSON only:
{{
  "summary": "2-3 paragraph concise summary in English",
  "key_points": ["point 1 in English", "point 2 in English", "..."]
}}

Transcript:
\"\"\"{transcript}\"\"\""""

    # Run blocking Groq call in a thread
    def call_groq():
        client = get_groq_client()
        return client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You output strict JSON only, no markdown."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )

    try:
        resp = await asyncio.to_thread(call_groq)
        data = json.loads(resp.choices[0].message.content)
        return {
            "video_id": vid,
            "summary": data.get("summary", ""),
            "key_points": data.get("key_points", []),
        }
    except Exception as e:
        print(f"Summary Generation Error: {e}")
        raise HTTPException(500, f"Failed to generate summary: {str(e)}")
