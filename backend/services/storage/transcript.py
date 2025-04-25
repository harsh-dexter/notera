# Transcript related database interaction logic using SQLAlchemy

import json
import datetime
from typing import List, Optional, Dict, Any # Added Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

# Import SQLAlchemy components and Meeting model
from ...db.database import SessionLocal, Meeting # Assuming SessionLocal will be here or imported here
# Import the session helper
from ...db.database import get_db_session

async def update_asr_result(job_id: str, transcript: str, languages: List[str]) -> Optional[Dict[str, Any]]:
    """
    Updates an existing meeting record with the transcript and detected languages using SQLAlchemy.
    Sets status to 'processing_analysis'.
    """
    db: Session = get_db_session()
    new_status = 'processing_analysis'
    # timestamp = datetime.datetime.now(datetime.timezone.utc) # Optionally update timestamp here too

    try:
        meeting = db.query(Meeting).filter(Meeting.id == job_id).first()
        if meeting:
            meeting.transcript = transcript
            meeting.languages = json.dumps(languages) # Store languages as JSON string
            meeting.status = new_status
            # meeting.upload_time = timestamp # Uncomment if you want to update time on this step
            db.commit()
            db.refresh(meeting) # Refresh the object
            print(f"Successfully updated ASR result for job_id: {job_id} with languages: {languages} and status: {new_status}")

            # Convert the updated meeting object to a dictionary
            updated_meeting_data = {c.name: getattr(meeting, c.name) for c in meeting.__table__.columns}
            try:
                updated_meeting_data['action_items'] = json.loads(updated_meeting_data.get('action_items', '[]') or '[]')
                updated_meeting_data['decisions'] = json.loads(updated_meeting_data.get('decisions', '[]') or '[]')
                updated_meeting_data['languages'] = json.loads(updated_meeting_data.get('languages', '[]') or '[]') # Already updated
            except json.JSONDecodeError:
                 updated_meeting_data['action_items'] = []
                 updated_meeting_data['decisions'] = []
                 updated_meeting_data['languages'] = [] # Should not happen here, but safe fallback
            if isinstance(updated_meeting_data.get('upload_time'), datetime.datetime):
                 updated_meeting_data['upload_time'] = updated_meeting_data['upload_time'].replace(tzinfo=datetime.timezone.utc).isoformat()

            return updated_meeting_data # Return the updated data
        else:
            print(f"No meeting found with job_id: {job_id} to update ASR result.")
            return None
    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) updating ASR result for job_id {job_id}: {e}")
        db.rollback()
        return None # Return None on error
    finally:
        db.close()

async def get_transcript(job_id: str) -> Optional[str]:
    """
    Retrieves only the transcript for a meeting using SQLAlchemy.
    Optimized to fetch only the required column.
    """
    db: Session = get_db_session()
    try:
        result = db.query(Meeting.transcript).filter(Meeting.id == job_id).first()
        if result:
            return result[0] # result is a tuple, transcript is the first element
        else:
            print(f"No meeting found with job_id: {job_id} to retrieve transcript.")
            return None
    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) fetching transcript for job_id {job_id}: {e}")
        return None
    finally:
        db.close()

# Alias for get_transcript, as they do the same thing
async def get_transcript_by_id(job_id: str) -> Optional[str]:
    """Retrieves only the transcript for a meeting. Alias for get_transcript."""
    return await get_transcript(job_id)


async def append_live_transcript_segment(meeting_id: str, segment_data: Dict[str, Any]) -> bool:
    """
    Appends a new transcript segment to the meeting's transcript JSON string.
    """
    db: Session = get_db_session()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            print(f"Meeting not found with id: {meeting_id} to append segment.")
            return False

        # Decode existing transcript JSON string, default to empty list if null/empty/invalid
        try:
            current_transcript_list = json.loads(meeting.transcript or '[]')
            if not isinstance(current_transcript_list, list):
                current_transcript_list = [] # Reset if not a list
        except json.JSONDecodeError:
            current_transcript_list = []

        # Append the new segment
        current_transcript_list.append(segment_data)

        # Encode back to JSON string and update
        meeting.transcript = json.dumps(current_transcript_list)
        db.commit()
        print(f"Appended segment to transcript for meeting: {meeting_id}")
        return True

    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) appending segment for meeting {meeting_id}: {e}")
        db.rollback()
        return False
    finally:
        db.close()
