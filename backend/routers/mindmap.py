import os
import json
import asyncio
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
router = APIRouter(prefix="/mindmap", tags=["mindmap"])
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class MindMapRequest(BaseModel):
    content: str

@router.post("/generate")
async def generate_mindmap(req: MindMapRequest):
    if not req.content:
        raise HTTPException(400, "No content provided for mind map generation")
    
    prompt = f"""Generate a COMPACT visual summary (Mind Map).
    Return STRICT JSON:
    {{
      "topic": "Main Topic (1-3 words)",
      "nodes": [
        {{
          "title": "Core Pillar (2-4 words)",
          "children": [
            {{ "title": "Detail (2-4 words)" }}
          ]
        }}
      ]
    }}
    
    MINIMALIST RULES:
    1. Max 3 pillars total.
    2. Max 2 children per pillar.
    3. Maximum depth of 3.
    4. Labels MUST be 2-4 words only. No descriptions.
    
    Content:
    {req.content[:6000]}"""

    try:
        def call_groq():
            return groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are a visual learning expert. Output strict JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
                response_format={"type": "json_object"},
            )

        resp = await asyncio.to_thread(call_groq)
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        print(f"MindMap Error: {e}")
        raise HTTPException(500, f"Failed to generate mind map: {str(e)}")
