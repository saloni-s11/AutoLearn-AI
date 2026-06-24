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
    asked_questions: list[str] = []   # questions already seen — never repeat these


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


def _build_prompt(
    content: str,
    n: int,
    diff: Difficulty,
    topic: str | None,
    mock: bool,
    asked_questions: list[str] | None = None,
) -> str:
    topic_line = f"Focus ONLY on the topic: {topic}\n" if topic else ""
    mock_note = "This is a MOCK exam: no hints, mix difficulties, realistic.\n" if mock else ""

    avoid_block = ""
    if asked_questions:
        sample = asked_questions[-40:]
        avoid_block = (
            "\n\nIMPORTANT — The following questions have ALREADY been asked. "
            "Do NOT repeat them or ask anything semantically similar. "
            "Generate completely different questions covering unexplored aspects of the content:\n"
            + "\n".join(f"- {q}" for q in sample)
            + "\n"
        )

    return f"""Generate {n} multiple-choice questions from the content below.
Difficulty: {diff} ({DIFFICULTY_GUIDE[diff]}).
{topic_line}{mock_note}{avoid_block}
CRITICAL RULES:
- Each "options" array MUST contain 4 full answer strings — actual text, not letters like "A", "B", "C", "D".
- "correct" is the 0-based index (0, 1, 2, or 3) of the correct option in the array.
- Every option must be a complete, meaningful answer relevant to the question.

Return STRICT JSON matching this exact structure (replace the example values with real content):
{{
  "questions": [
    {{
      "question": "What is the primary function of mitochondria?",
      "options": [
        "To produce energy in the form of ATP",
        "To store genetic information",
        "To synthesize proteins from amino acids",
        "To regulate cell division"
      ],
      "correct": 0,
      "explanation": "Mitochondria are known as the powerhouse of the cell because they generate ATP through cellular respiration.",
      "topic": "Cell Biology",
      "difficulty": "{diff}"
    }}
  ]
}}

Content:
\"\"\"{content[:8000]}\"\"\""""


def _sanitize_questions(questions: list[dict]) -> list[dict]:
    """Remove any question where options are placeholder letters instead of real text."""
    BAD_PATTERNS = {"a", "b", "c", "d", "option a", "option b", "option c", "option d"}
    good = []
    for q in questions:
        options = q.get("options", [])
        # Flag if any option is a single letter or matches a known placeholder
        if any(str(opt).strip().lower() in BAD_PATTERNS for opt in options):
            print(f"[Exam Sanitizer] Rejected bad options in question: {q.get('question', '')[:60]}")
            continue
        # Flag if options aren't strings or are empty
        if not all(isinstance(opt, str) and len(opt.strip()) > 2 for opt in options):
            print(f"[Exam Sanitizer] Rejected malformed options: {options}")
            continue
        # Ensure exactly 4 options
        if len(options) != 4:
            print(f"[Exam Sanitizer] Rejected wrong option count ({len(options)})")
            continue
        good.append(q)
    return good


import asyncio

async def _llm_json(prompt: str) -> dict:
    def call_groq():
        return groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You output strict JSON only, no markdown."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.8,   # higher = more variety across attempts
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
        asked_questions=req.asked_questions,
    )
    data = await _llm_json(prompt)
    questions = _sanitize_questions(data.get("questions", []))

    # Retry once if sanitizer wiped everything out (LLM used placeholder letters)
    if not questions:
        print("[Exam] All questions failed sanitization — retrying with stricter prompt.")
        data = await _llm_json(prompt)
        questions = _sanitize_questions(data.get("questions", []))

    if not questions:
        raise HTTPException(500, "No valid questions generated. Please try again.")

    # Server-side dedup against previously asked questions
    asked_lower = {q.lower().strip() for q in req.asked_questions}
    fresh = [q for q in questions if q.get("question", "").lower().strip() not in asked_lower]
    if not fresh:
        fresh = questions  # edge case: all were dupes, return anyway

    return {"exam_type": req.exam_type, "difficulty": req.difficulty, "questions": fresh}


@router.post("/adaptive/next")
async def adaptive_next(req: AdaptiveNextRequest):
    order = ["easy", "medium", "hard"]
    idx = order.index(req.current_difficulty)
    if req.last_correct and idx < 2:
        idx += 1
    elif not req.last_correct and idx > 0:
        idx -= 1
    new_diff: Difficulty = order[idx]  # type: ignore

    prompt = _build_prompt(
        req.content, 1, new_diff, None, mock=False,
        asked_questions=req.asked_questions if req.asked_questions else None,
    )
    data = await _llm_json(prompt)
    qs = _sanitize_questions(data.get("questions", []))

    # Retry once if sanitizer rejected the question
    if not qs:
        data = await _llm_json(prompt)
        qs = _sanitize_questions(data.get("questions", []))

    if not qs:
        raise HTTPException(500, "No valid adaptive question generated.")
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