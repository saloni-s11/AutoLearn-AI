import os
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter(prefix="/share", tags=["share"])

class ShareCreateRequest(BaseModel):
    title: str
    data: dict

def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db

@router.post("/create")
async def create_share(req: ShareCreateRequest, request: Request):
    db = get_db(request)
    share_id = str(uuid.uuid4())
    
    shared_session = {
        "share_id": share_id,
        "title": req.title,
        "data": req.data,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.shared_sessions.insert_one(shared_session)
    
    # Generate the base URL for the frontend (adjust if needed)
    base_url = "http://localhost:8080" # Standard dev port
    return {
        "share_id": share_id,
        "share_url": f"{base_url}/shared/{share_id}"
    }

@router.get("/{share_id}")
async def get_shared_content(share_id: str, request: Request):
    db = get_db(request)
    shared = await db.shared_sessions.find_one({"share_id": share_id})
    if not shared:
        raise HTTPException(status_code=404, detail="Shared content not found")
    
    # Remove MongoDB internal ID for clean response
    shared["_id"] = str(shared["_id"])
    return shared
