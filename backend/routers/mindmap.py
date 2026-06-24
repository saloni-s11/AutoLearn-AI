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
    
    prompt = f"""Generate a detailed, comprehensive concept Mind Map summarizing the content.
    The map must cover all major topics, details, and key pillars present in the text to ensure complete coverage.
    
    Return STRICT JSON:
    {{
      "topic": "Main Topic (1-3 words)",
      "nodes": [
        {{
          "title": "Core Pillar / Major Topic (2-4 words)",
          "children": [
            {{ "title": "Sub-concept / Detail (2-4 words)" }}
          ]
        }}
      ]
    }}
    
    RULES:
    1. Determine the number of core pillars dynamically based on the complexity and volume of the content. You MUST generate between 4 and 8 core pillars to ensure all key aspects are covered (do NOT generate only 3 pillars).
    2. Under each pillar, include a comprehensive set of sub-concepts or details (usually between 2 and 5 children per pillar).
    3. Ensure that labels (node titles and detail titles) remain punchy (2-4 words maximum). Do NOT include long paragraphs or descriptions.
    4. Focus on capturing actual key concepts, facts, definitions, and connections rather than generic steps.
    
    Content to summarize comprehensively:
    \"\"\"{req.content[:15000]}\"\"\""""

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