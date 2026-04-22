import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone

# Ensure output is UTF-8 friendly
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

async def verify_full_db_access():
    load_dotenv()
    uri = os.getenv("MONGODB_URL")
    print(f"--- DB Verification Start ---")
    
    try:
        client = AsyncIOMotorClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000)
        db = client.study_studio
        
        # 1. Test Ping
        await client.admin.command('ping')
        print("[SUCCESS] Ping successful")
        
        # 2. Test Write
        test_doc = {"test": True, "timestamp": datetime.now(timezone.utc)}
        result = await db.test_connection.insert_one(test_doc)
        print(f"[SUCCESS] Write successful: {result.inserted_id}")
        
        # 3. Test Read
        found = await db.test_connection.find_one({"_id": result.inserted_id})
        if found:
            print("[SUCCESS] Read successful")
        
        # 4. Test Delete
        await db.test_connection.delete_one({"_id": result.inserted_id})
        print("[SUCCESS] Delete successful")
        
        print("--- DB Verification Complete: Everything is working! ---")
        
    except Exception as e:
        print(f"[FAILURE] DB Verification Failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(verify_full_db_access())
