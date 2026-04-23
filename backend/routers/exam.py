import os
import json
from typing import Literal
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from groq import Groq 
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

load_dotenv()
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

router = APIRouter(prefix="/exam", tags=["exam"])

from auth import get_current_user

def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db

ExamType = Literal["practice", "timed", "adaptive", "topic", "mock"]
Difficulty = Literal["easy", "medium", "hard"]

class ExamResult(BaseModel):
    username: str
    score: str
    correct: int
    total: int
    accuracy: float
    time_taken_seconds: int
    exam_type: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class GenerateRequest(BaseModel):
    content: str = Field(..., min_length=20)
    exam_type: ExamType = "practice"
    difficulty: Difficulty = "medium"
    number_of_questions: int = Field(10, ge=1, le=30)
    topic: str | None = None


class AdaptiveNextRequest(BaseModel):
    content: str
    current_difficulty: Difficulty
    last_correct: bool
    asked_questions: list[str] = []


class AnalyticsRequest(BaseModel):
    answers: list[dict]  # [{question, topic, correct, time_taken}]
    duration_seconds: int
    title: str | None = None


DIFFICULTY_GUIDE = {
    "easy": "basic recall, definitions, simple facts",
    "medium": "application, examples, comparing concepts",
    "hard": "analysis, edge cases, multi-step reasoning, tricky distractors",
}


def _build_prompt(content: str, n: int, diff: Difficulty, topic: str | None, mock: bool) -> str:
    topic_line = f"Focus ONLY on the topic: {topic}\n" if topic else ""
    mock_note = "This is a MOCK exam: no hints, mix difficulties, realistic.\n" if mock else ""
    return f"""Generate {n} multiple-choice questions from the content.
Difficulty: {diff} ({DIFFICULTY_GUIDE[diff]}).
{topic_line}{mock_note}
Return STRICT JSON:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "why this answer is correct",
      "topic": "short topic tag",
      "difficulty": "{diff}"
    }}
  ]
}}

Content:
\"\"\"{content[:8000]}\"\"\""""


import asyncio

async def _llm_json(prompt: str) -> dict:
    def call_groq():
        return groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You output strict JSON only, no markdown."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
            response_format={"type": "json_object"},
        )
    
    resp = await asyncio.to_thread(call_groq)
    try:
        return json.loads(resp.choices[0].message.content)
    except Exception:
        raise HTTPException(500, "LLM returned invalid JSON")


@router.post("/generate")
async def generate_exam(req: GenerateRequest):
    prompt = _build_prompt(
        req.content,
        req.number_of_questions,
        req.difficulty,
        req.topic,
        mock=(req.exam_type == "mock"),
    )
    data = await _llm_json(prompt)
    questions = data.get("questions", [])
    if not questions:
        raise HTTPException(500, "No questions generated")
    return {"exam_type": req.exam_type, "difficulty": req.difficulty, "questions": questions}


@router.post("/adaptive/next")
async def adaptive_next(req: AdaptiveNextRequest):
    order = ["easy", "medium", "hard"]
    idx = order.index(req.current_difficulty)
    if req.last_correct and idx < 2:
        idx += 1
    elif not req.last_correct and idx > 0:
        idx -= 1
    new_diff: Difficulty = order[idx]  # type: ignore

    prompt = _build_prompt(req.content, 1, new_diff, None, mock=False)
    if req.asked_questions:
        prompt += f"\n\nAvoid these already-asked questions:\n" + "\n".join(req.asked_questions[-10:])
    data = await _llm_json(prompt)
    qs = data.get("questions", [])
    if not qs:
        raise HTTPException(500, "No question generated")
    return {"difficulty": new_diff, "question": qs[0]}


@router.post("/analytics")
async def analytics(
    req: AnalyticsRequest, 
    db: AsyncIOMotorDatabase = Depends(get_db),
    username: str = Depends(get_current_user)
):
    total = len(req.answers)
    if total == 0:
        return {
            "score": "0/0",
            "correct": 0,
            "total": 0,
            "accuracy": 0,
            "time_taken_seconds": req.duration_seconds,
            "weak_topics": [],
            "suggested_revision": [],
            "topic_breakdown": {},
        }
    correct = sum(1 for a in req.answers if a.get("correct"))
    accuracy = round(correct / total * 100, 1)

    topic_stats: dict[str, dict] = {}
    for a in req.answers:
        t = a.get("topic", "general")
        topic_stats.setdefault(t, {"total": 0, "correct": 0})
        topic_stats[t]["total"] += 1
        if a.get("correct"):
            topic_stats[t]["correct"] += 1

    weak = [
        t for t, s in topic_stats.items()
        if s["total"] >= 1 and (s["correct"] / s["total"]) < 0.6
    ]

    result_data = {
        "username": username,
        "title": req.title or "General Quiz",
        "score": f"{correct}/{total}",
        "correct": correct,
        "total": total,
        "accuracy": accuracy,
        "time_taken_seconds": req.duration_seconds,
        "timestamp": datetime.now(timezone.utc),
        "topic_breakdown": topic_stats,
        "weak_topics": weak
    }
    
    try:
        await db.exam_results.insert_one(result_data)
    except Exception as e:
        print(f"Failed to save exam result: {e}")

    return {
        "score": f"{correct}/{total}",
        "correct": correct,
        "total": total,
        "accuracy": accuracy,
        "time_taken_seconds": req.duration_seconds,
        "weak_topics": weak,
        "suggested_revision": weak[:3],
        "topic_breakdown": topic_stats,
    }

@router.get("/history")
async def get_exam_history(
    db: AsyncIOMotorDatabase = Depends(get_db),
    username: str = Depends(get_current_user)
):
    results = await db.exam_results.find({"username": username}).sort("timestamp", 1).to_list(100)
    for r in results:
        r["_id"] = str(r["_id"])
    return {"history": results}
