from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, status, Path # Import Path
from fastapi.responses import JSONResponse
import shutil
import os
import uuid
import datetime
from typing import Annotated # Import Annotated
from fastapi import BackgroundTasks # Ensure BackgroundTasks is imported if not already
# Import the specific storage functions needed from the new structure
from ..services import asr, summarizer, rag_service
from ..services.storage.meeting import create_initial_meeting
from ..services.storage.transcript import update_asr_result, append_live_transcript_segment # Import new function
from ..services.storage.analysis import update_analysis_results
# Import the WebSocket manager
from ..utils.websocket_manager import manager
# Import tasks from the new location
from ..services.tasks import run_asr_task, run_analysis_task

# Define the directory to save uploads
UPLOAD_DIRECTORY = "uploads"
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a"}
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

router = APIRouter(
    prefix="/upload", # Keep prefix, change endpoint below
    tags=["upload"],
)


from fastapi import Form # Import Form

@router.post("/transcribe-chunk/{meeting_id}")
async def transcribe_chunk_endpoint(
    meeting_id: Annotated[str, Path(description="The ID of the live meeting session.")],
    chunk_index: Annotated[int, Form(description="The sequential index of the chunk (starting from 1).")],
    file: UploadFile = File(...)
):
    """
    Receives an audio chunk for a live meeting session.
    (Phase 1: Just saves the chunk temporarily, logs info)
    (Phase 2: Will transcribe and broadcast results via WebSocket)
    """
    # Validate file type if necessary (e.g., ensure it's WAV)
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext != ".wav":
         raise HTTPException(status_code=400, detail="Invalid chunk file type. Only .wav is supported for live transcription.")

    # Define a temporary directory for live chunks (could be different from bulk uploads)
    LIVE_CHUNK_DIRECTORY = "temp_live_chunks"
    os.makedirs(LIVE_CHUNK_DIRECTORY, exist_ok=True)

    # Generate a unique filename for the chunk (e.g., using timestamp or counter)
    # For simplicity, let's use meeting_id and a timestamp
    chunk_filename = f"{meeting_id}_{datetime.datetime.now().timestamp()}.wav"
    chunk_filepath = os.path.join(LIVE_CHUNK_DIRECTORY, chunk_filename)

    try:
        # Save the uploaded chunk
        with open(chunk_filepath, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        print(f"Received live chunk for meeting {meeting_id}, saved to: {chunk_filepath}")

        # --- Phase 2: Transcribe Chunk ---
        transcript_text = None
        try:
            print(f"Transcribing chunk: {chunk_filepath}")
            # Use existing ASR service - assuming it works for chunks or we adapt it later
            asr_result = await asr.transcribe_audio(chunk_filepath)
            transcript_text = asr_result.get("transcript", "").strip() # Get text, default to empty, strip whitespace
            print(f"Chunk transcription result for {meeting_id} (Index: {chunk_index}): {transcript_text}")

            if transcript_text: # Only broadcast if we got text
                # Calculate timestamps (assuming 5-second chunks)
                # TODO: Get actual chunk duration from config or constant
                chunk_duration = 5
                start_time = (chunk_index - 1) * chunk_duration
                end_time = chunk_index * chunk_duration

                # Format segment data (matching frontend TranscriptSegment structure)
                segment_data = {
                    "id": f"{meeting_id}-live-{chunk_index}", # Generate a unique ID
                    "speakerId": "live_system", # Placeholder speaker
                    "speakerName": "System Audio", # Placeholder name
                    "startTime": start_time,
                    "endTime": end_time,
                    "text": transcript_text,
                    "language": asr_result.get("languages", ["unknown"])[0] if asr_result.get("languages") else "unknown" # Get first detected language
                }

                # Broadcast via WebSocket
                await manager.broadcast({
                    "type": "transcript_update",
                    "payload": {
                        "meetingId": meeting_id,
                        "segment": segment_data
                    }
                })
                print(f"Broadcasted transcript update for meeting {meeting_id}, chunk {chunk_index}")

                # Persist the segment to the database
                await append_live_transcript_segment(meeting_id, segment_data)

        except Exception as asr_error:
            print(f"Error transcribing chunk {chunk_filepath}: {asr_error}")
            # Decide if we should raise HTTPException or just log

        finally:
            # Clean up the saved chunk file regardless of transcription success/failure
            try:
                os.remove(chunk_filepath)
                print(f"Deleted chunk file: {chunk_filepath}")
            except OSError as e:
                print(f"Error deleting chunk file {chunk_filepath}: {e}")
        # --------------------------------

        # Return success, potentially include transcript text if available
        return {
            "message": "Chunk processed.",
            "filename": chunk_filename,
            "transcript_chunk": transcript_text # Include transcribed text (can be None if failed)
        }

    except IOError as e:
        print(f"IOError saving live chunk {chunk_filename}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not save live chunk: {e}")
    except Exception as e:
        print(f"An unexpected error occurred processing live chunk: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred during chunk processing.")

# Task definitions moved to services/tasks.py


@router.post("/upload-audio")
async def upload_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Handles audio file uploads (.wav, .mp3, .m4a).
    Saves the file with a UUID filename and returns a job ID.
    """
    # Validate file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Generate UUID filename for storage, keep original for title
    job_id = str(uuid.uuid4())
    original_filename = file.filename # Get the original filename
    new_filename = f"{job_id}{file_ext}" # UUID-based filename for storage
    file_location = os.path.join(UPLOAD_DIRECTORY, new_filename)

    try:
        # Save the uploaded file
        with open(file_location, "wb+") as file_object:
              shutil.copyfileobj(file.file, file_object)
        print(f"File saved to: {file_location}")

        # --- Create Initial Meeting Record ---
        initial_meeting_data = await create_initial_meeting(job_id=job_id, filename=original_filename)
        if not initial_meeting_data:
             # If DB creation fails, maybe delete the saved file? Or handle differently.
             # For now, raise an error.
             raise HTTPException(
                 status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                 detail="Failed to create initial meeting record in database."
             )
        print(f"Initial meeting record created for job_id: {job_id}")
        # ------------------------------------

        # Add the ASR processing job to background tasks
        # Pass background_tasks instance itself to the ASR task so it can enqueue the next one
        background_tasks.add_task(run_asr_task, background_tasks, file_location, job_id)
        print(f"Added ASR background task for job_id: {job_id} with original filename: {original_filename}")

        # Return immediately with 201 Created and the initial meeting data (status: processing_asr)
        return JSONResponse(status_code=status.HTTP_201_CREATED, content=initial_meeting_data)

    except IOError as e:
        print(f"IOError saving file {new_filename}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not save the file: {e}")
    except Exception as e:
        # Log the exception in a real app
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred during file upload.")
