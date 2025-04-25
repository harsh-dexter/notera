# Analysis results related database interaction logic using SQLAlchemy

import json
import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

# Import SQLAlchemy components and Meeting model
from ...db.database import SessionLocal, Meeting # Assuming SessionLocal will be here or imported here
# Import the session helper
from ...db.database import get_db_session
# Removed import of get_meeting_data to break circular dependency

async def update_analysis_results(job_id: str, analysis_data: Dict[str, Any], success: bool = True) -> Optional[Dict[str, Any]]:
    """
    Updates an existing meeting record with analysis data using SQLAlchemy.
    Sets final status ('completed' or 'failed').
    """
    db: Session = get_db_session()
    final_status = 'completed' if success else 'failed'
    # timestamp = datetime.datetime.now(datetime.timezone.utc) # Optionally update timestamp

    try:
        meeting = db.query(Meeting).filter(Meeting.id == job_id).first()
        if meeting:
            if success:
                meeting.summary = analysis_data.get('summary', '')
                meeting.action_items = json.dumps(analysis_data.get('action_items', []))
                meeting.decisions = json.dumps(analysis_data.get('decisions', []))
                # Assuming pdf_path might be set elsewhere or not applicable here
            else:
                # Optionally store error message if analysis failed
                meeting.summary = analysis_data.get('error', 'Analysis Failed') # Store error in summary
                meeting.action_items = '[]'
                meeting.decisions = '[]'

            meeting.status = final_status
            # meeting.upload_time = timestamp # Uncomment if you want to update time on this step
            db.commit()
            db.refresh(meeting) # Refresh the object to get the latest state from DB
            print(f"Successfully updated analysis results for job_id: {job_id} with status: {final_status}")

            # Convert the updated meeting object to a dictionary for broadcasting
            # This formatting logic is necessary here as we removed get_meeting_data import
            updated_meeting_data = {c.name: getattr(meeting, c.name) for c in meeting.__table__.columns}
            try:
                # Ensure JSON fields are decoded for the response/broadcast payload
                updated_meeting_data['action_items'] = json.loads(updated_meeting_data.get('action_items', '[]') or '[]')
                updated_meeting_data['decisions'] = json.loads(updated_meeting_data.get('decisions', '[]') or '[]')
                updated_meeting_data['languages'] = json.loads(updated_meeting_data.get('languages', '[]') or '[]')
            except json.JSONDecodeError:
                 # Set defaults if JSON is invalid or null
                 updated_meeting_data['action_items'] = []
                 updated_meeting_data['decisions'] = []
                 updated_meeting_data['languages'] = []
            # Format datetime to ISO string UTC
            if isinstance(updated_meeting_data.get('upload_time'), datetime.datetime):
                 updated_meeting_data['upload_time'] = updated_meeting_data['upload_time'].replace(tzinfo=datetime.timezone.utc).isoformat()

            return updated_meeting_data # Return the formatted updated data
        else:
            print(f"No meeting found with job_id: {job_id} to update analysis results.")
            return None
    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) updating analysis results for job_id {job_id}: {e}")
        db.rollback()
        return None # Return None on error
    finally:
        db.close()

async def get_summary(job_id: str) -> Optional[str]:
    """
    Retrieves only the summary for a meeting using SQLAlchemy.
    Optimized to fetch only the required column.
    """
    db: Session = get_db_session()
    try:
        result = db.query(Meeting.summary).filter(Meeting.id == job_id).first()
        if result:
            return result[0] # result is a tuple, summary is the first element
        else:
            print(f"No meeting found with job_id: {job_id} to retrieve summary.")
            return None
    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) fetching summary for job_id {job_id}: {e}")
        return None
    finally:
        db.close()
