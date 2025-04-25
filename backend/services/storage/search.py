# Search related database interaction logic using SQLAlchemy

import json
import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

# Import SQLAlchemy components and Meeting model
from ...db.database import SessionLocal, Meeting # Assuming SessionLocal will be here or imported here
# Import the session helper (assuming it will be moved here)
from ...db.database import get_db_session

async def search_transcripts(query: str) -> List[Dict[str, Any]]:
    """
    Searches across meetings using SQLAlchemy FTS (if configured) or LIKE.
    """
    db: Session = get_db_session()
    results = []
    try:
        # Basic LIKE search (adapt if FTS is properly set up via SQLAlchemy events/triggers)
        search_param = f"%{query}%"
        meetings = db.query(Meeting).filter(
            (Meeting.transcript.like(search_param)) |
            (Meeting.filename.like(search_param)) |
            (Meeting.summary.like(search_param))
        ).order_by(Meeting.upload_time.desc()).all()

        for meeting in meetings:
            meeting_data = {c.name: getattr(meeting, c.name) for c in meeting.__table__.columns}
            try:
                meeting_data['action_items'] = json.loads(meeting_data.get('action_items', '[]') or '[]') # Add fallback for None
                meeting_data['decisions'] = json.loads(meeting_data.get('decisions', '[]') or '[]') # Add fallback for None
                meeting_data['languages'] = json.loads(meeting_data.get('languages', '[]') or '[]') # Decode languages JSON
            except json.JSONDecodeError:
                meeting_data['action_items'] = []
                meeting_data['decisions'] = []
                meeting_data['languages'] = [] # Default to empty list on error
            if isinstance(meeting_data.get('upload_time'), datetime.datetime):
                 # Ensure it's treated as UTC even if naive, then format with Z
                 meeting_data['upload_time'] = meeting_data['upload_time'].replace(tzinfo=datetime.timezone.utc).isoformat()
            results.append(meeting_data)
        return results
    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) searching transcripts: {e}")
        return []
    finally:
        db.close()
