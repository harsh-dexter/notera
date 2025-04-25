# Meeting related database interaction logic using SQLAlchemy

import json
import datetime
import uuid # Import uuid for generating IDs
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

# Import SQLAlchemy components and Meeting model
from ...db.database import Meeting # Assuming SessionLocal will be here or imported here
# Import the session helper (assuming it will be moved here)
from ...db.database import get_db_session
# Import ChromaDB client from RAG service
from ..rag_service import client as vector_db_client
# Import the WebSocket manager
from fastapi import BackgroundTasks # Import BackgroundTasks
from ...utils.websocket_manager import manager
# Import the analysis task function from its new location
from ..tasks import run_analysis_task


async def create_live_meeting() -> Optional[Dict[str, Any]]:
    """
    Creates a meeting record for a new live recording session.
    Generates a unique ID and sets status to 'recording_live'.
    """
    db: Session = get_db_session()
    job_id = str(uuid.uuid4()) # Generate a new ID for the live session
    timestamp = datetime.datetime.now(datetime.timezone.utc)
    status = 'recording_live' # New status for live sessions
    # Generate a default filename based on timestamp
    filename = f"Live Recording {timestamp.strftime('%Y-%m-%d %H:%M')}"

    try:
        new_meeting = Meeting(
            id=job_id,
            filename=filename,
            upload_time=timestamp,
            status=status,
            transcript='', # Start with empty transcript
            summary='',    # Start with empty summary
            action_items='[]', # Start with empty JSON array
            decisions='[]',    # Start with empty JSON array
            languages='[]',    # Start with empty languages
            pdf_path=None
        )
        db.add(new_meeting)
        db.commit()
        db.refresh(new_meeting)
        print(f"Successfully created live meeting record for job_id: {job_id}")

        # Format the created record for response and broadcast
        formatted_upload_time = timestamp.isoformat() # Already UTC
        meeting_dict = {
            "id": new_meeting.id,
            "filename": new_meeting.filename,
            "upload_time": formatted_upload_time,
            "status": new_meeting.status,
            "transcript": new_meeting.transcript,
            "summary": new_meeting.summary,
            "action_items": json.loads(new_meeting.action_items),
            "decisions": json.loads(new_meeting.decisions),
            "languages": json.loads(new_meeting.languages),
            "pdf_path": new_meeting.pdf_path,
        }

        # Broadcast the new meeting data
        await manager.broadcast({
            "type": "meeting_created",
            "payload": meeting_dict
        })
        print(f"Broadcasted creation for live meeting: {job_id}")
        return meeting_dict

    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) creating live meeting for job_id {job_id}: {e}")
        db.rollback()
        return None
    finally:
        db.close()

async def create_initial_meeting(job_id: str, filename: str) -> Optional[Dict[str, Any]]:
    """
    Creates an initial meeting record using SQLAlchemy.
    """
    db: Session = get_db_session()
    timestamp = datetime.datetime.now(datetime.timezone.utc) # Use timezone-aware UTC time
    status = 'processing_asr'
    try:
        new_meeting = Meeting(
            id=job_id,
            filename=filename,
            upload_time=timestamp,
            status=status,
            transcript='',
            summary='',
            action_items='[]',
            decisions='[]',
            pdf_path=None
        )
        db.add(new_meeting)
        db.commit()
        db.refresh(new_meeting) # Refresh to get the committed state
        print(f"Successfully created initial meeting record for job_id: {job_id}")
        # Return the created record as a dictionary
        formatted_upload_time = None
        if isinstance(new_meeting.upload_time, datetime.datetime):
             formatted_upload_time = new_meeting.upload_time.replace(tzinfo=datetime.timezone.utc).isoformat()
        return {
            "id": new_meeting.id,
            "filename": new_meeting.filename,
            "upload_time": formatted_upload_time, # Send UTC ISO string with Z
            "status": new_meeting.status,
            "transcript": new_meeting.transcript,
            "summary": new_meeting.summary,
            "action_items": json.loads(new_meeting.action_items), # Decode JSON
            "decisions": json.loads(new_meeting.decisions), # Decode JSON
            "pdf_path": new_meeting.pdf_path,
            # Ensure languages is included, defaulting to empty list if not present or None
            "languages": json.loads(new_meeting.languages or '[]')
        }
        # Broadcast the new meeting data
        await manager.broadcast({
            "type": "meeting_created",
            "payload": meeting_dict # Use the dict we just created
        })
        return meeting_dict # Return the dict
    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) creating initial meeting for job_id {job_id}: {e}")
        db.rollback()
        return None
    finally:
        db.close()

async def delete_meeting_by_job_id(job_id: str) -> int:
    """
    Deletes a meeting record by its job_id from both SQLAlchemy and the vector store.
    Returns the number of records deleted from the main DB (0 or 1).
    """
    db: Session = get_db_session()
    deleted_count = 0
    try:
        # 1. Delete from main database (SQLAlchemy)
        deleted_count = db.query(Meeting).filter(Meeting.id == job_id).delete()
        db.commit()

        if deleted_count > 0:
            print(f"Successfully deleted meeting record from main DB for job_id: {job_id}")

            # 2. Delete from vector database (ChromaDB)
            collection_name = f"meeting_{job_id.replace('-', '_')}"
            try:
                print(f"Attempting to delete vector collection: {collection_name}")
                vector_db_client.delete_collection(name=collection_name)
                print(f"Successfully deleted vector collection: {collection_name}")
            except Exception as vector_e:
                # Log error but don't necessarily fail the whole operation if main DB delete succeeded
                # The collection might not exist if embedding failed earlier.
                print(f"⚠️ Warning: Could not delete vector collection '{collection_name}': {vector_e}")
                # Consider if this should raise an exception or just log. Logging for now.

        else:
            print(f"No meeting found with job_id: {job_id} in main DB to delete.")

        return deleted_count # Return count from main DB deletion

    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) deleting meeting for job_id {job_id}: {e}")
        db.rollback()
        return 0 # Indicate failure or no deletion due to error
    finally:
        db.close()

async def update_meeting_title(job_id: str, new_title: str) -> bool:
    """
    Updates the filename (title) for a specific meeting using SQLAlchemy.
    """
    db: Session = get_db_session()
    try:
        result = db.query(Meeting).filter(Meeting.id == job_id).update({"filename": new_title})
        db.commit()
        if result > 0:
            print(f"Successfully updated title for job_id: {job_id}")
            return True
        else:
            print(f"No meeting found with job_id: {job_id} to update title.")
            return False
    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) updating title for job_id {job_id}: {e}")
        db.rollback()
        return False
    finally:
        db.close()

async def get_meeting_data(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves all stored data for a given job_id using SQLAlchemy.
    """
    db: Session = get_db_session()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == job_id).first()
        if meeting:
            # Convert Meeting object to dictionary
            meeting_data = {c.name: getattr(meeting, c.name) for c in meeting.__table__.columns}
            # Decode JSON strings
            try:
                meeting_data['action_items'] = json.loads(meeting_data.get('action_items', '[]') or '[]')
                meeting_data['decisions'] = json.loads(meeting_data.get('decisions', '[]') or '[]')
                meeting_data['languages'] = json.loads(meeting_data.get('languages', '[]') or '[]')
                # Also parse the transcript field if it contains valid JSON list
                raw_transcript = meeting_data.get('transcript')
                if raw_transcript and isinstance(raw_transcript, str):
                    try:
                        parsed_transcript = json.loads(raw_transcript)
                        if isinstance(parsed_transcript, list):
                            meeting_data['transcript'] = parsed_transcript # Replace string with parsed list
                        else:
                            # If JSON is not a list, keep original string (or handle as error)
                            print(f"Warning: Parsed transcript for {job_id} is not a list. Keeping raw string.")
                            meeting_data['transcript'] = raw_transcript # Keep original string
                    except json.JSONDecodeError:
                        # If not valid JSON, assume it's plain text and keep original string
                        print(f"Warning: Transcript for {job_id} is not valid JSON. Keeping raw string.")
                        meeting_data['transcript'] = raw_transcript
                elif not raw_transcript:
                     meeting_data['transcript'] = [] # Default to empty list if transcript is null/empty

            except json.JSONDecodeError as json_err:
                 print(f"JSON Decode Error processing meeting data for {job_id}: {json_err}")
                 # Set defaults for all potentially JSON fields on error
                 meeting_data['action_items'] = []
                 meeting_data['decisions'] = []
                 meeting_data['languages'] = []
                 meeting_data['transcript'] = [] # Default transcript to empty list on error too
            # Format datetime
            if isinstance(meeting_data.get('upload_time'), datetime.datetime):
                 # Ensure it's treated as UTC even if naive, then format with Z
                 meeting_data['upload_time'] = meeting_data['upload_time'].replace(tzinfo=datetime.timezone.utc).isoformat()
            return meeting_data
        else:
            return None
    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) fetching data for job_id {job_id}: {e}")
        return None
    finally: # Ensure this aligns with the 'try' block above
        db.close()

async def finalize_live_meeting(meeting_id: str, background_tasks: BackgroundTasks) -> bool:
    """
    Updates the status of a live meeting to 'processing_analysis' and queues the analysis task.
    """
    db: Session = get_db_session()
    new_status = 'processing_analysis'
    meeting = None # Define meeting variable outside try block

    try:
        # Fetch the meeting first to get the transcript
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.status == 'recording_live').first()

        if not meeting:
            print(f"No meeting found with id: {meeting_id} and status 'recording_live' to finalize.")
            return False

        # Update status
        meeting.status = new_status
        db.commit()
        db.refresh(meeting) # Refresh to get the updated status in the object
        print(f"Successfully updated live meeting status: {meeting_id}, status set to {new_status}.")

        # Prepare data for analysis task
        transcript_json = meeting.transcript or '[]'
        try:
            transcript_segments = json.loads(transcript_json)
            if not isinstance(transcript_segments, list):
                transcript_segments = []
        except json.JSONDecodeError:
            transcript_segments = []

        # Reconstruct full transcript text
        full_transcript_text = " ".join([seg.get('text', '') for seg in transcript_segments])

        # Enqueue the analysis task
        background_tasks.add_task(run_analysis_task, meeting_id, full_transcript_text, transcript_segments)
        print(f"Enqueued analysis task for finalized live meeting: {meeting_id}")

        # Broadcast the status update
        updated_meeting_data = await get_meeting_data(meeting_id) # Fetch updated data again
        if updated_meeting_data:
             await manager.broadcast({
                 "type": "meeting_updated",
                 "payload": updated_meeting_data
             })
        return True

    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) finalizing live meeting {meeting_id}: {e}")
        db.rollback()
        return False
    finally:
        db.close()

async def get_all_meeting_data() -> List[Dict[str, Any]]:
    """
    Retrieves all meeting records using SQLAlchemy.
    """
    db: Session = get_db_session()
    results = []
    try:
        meetings = db.query(Meeting).order_by(Meeting.upload_time.desc()).all()
        for meeting in meetings:
            meeting_data = {c.name: getattr(meeting, c.name) for c in meeting.__table__.columns}
            try:
                meeting_data['action_items'] = json.loads(meeting_data.get('action_items', '[]') or '[]')
                meeting_data['decisions'] = json.loads(meeting_data.get('decisions', '[]') or '[]')
                meeting_data['languages'] = json.loads(meeting_data.get('languages', '[]') or '[]') # Decode languages JSON
            except json.JSONDecodeError:
                meeting_data['action_items'] = []
                meeting_data['decisions'] = []
                meeting_data['languages'] = []
            # Format datetime
            formatted_time = None
            raw_time = meeting_data.get('upload_time')
            if isinstance(raw_time, datetime.datetime):
                 # Ensure it's treated as UTC even if naive, then format with Z
                 formatted_time = raw_time.replace(tzinfo=datetime.timezone.utc).isoformat()
                 meeting_data['upload_time'] = formatted_time # Update dict with formatted string
            results.append(meeting_data)
        return results
    except SQLAlchemyError as e:
        print(f"Database error (SQLAlchemy) fetching all meeting data: {e}")
        return []
    finally:
        db.close()
