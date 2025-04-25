# Background task definitions, moved here to avoid circular imports

from fastapi import BackgroundTasks
import json

# Import necessary services and storage functions (adjust paths as needed)
from . import asr, summarizer, rag_service
# from .storage.meeting import get_meeting_data # Removed to break circular import
from .storage.transcript import update_asr_result
from .storage.analysis import update_analysis_results
# Import the WebSocket manager
from ..utils.websocket_manager import manager

# --- Analysis Task ---
async def run_analysis_task(job_id: str, transcript: str, transcript_segments: list):
    """
    Background task for post-ASR analysis: summarize, RAG index.
    (Moved from routers/upload.py)
    """
    print(f"[Analysis Task {job_id}] Starting analysis...")
    analysis_data = {}
    try:
        # 1. Process Transcript (Summarize, Extract Actions/Decisions)
        analysis_data = await summarizer.process_transcript(transcript)
        print(f"[Analysis Task {job_id}] Summarization complete.")

        # 2. Add Transcript Segments to Vector Store (RAG Indexing)
        if transcript_segments:
            await rag_service.add_transcript_to_store(meeting_id=job_id, transcript_segments=transcript_segments)
            print(f"[Analysis Task {job_id}] RAG indexing complete.")
        else:
            print(f"[Analysis Task {job_id}] No transcript segments found, skipping RAG indexing.")

        # 3. Update final results in Database and get updated data
        updated_meeting_data = await update_analysis_results(job_id=job_id, analysis_data=analysis_data, success=True)
        print(f"[Analysis Task {job_id}] Analysis completed successfully.")

        # 4. Broadcast final update using returned data
        if updated_meeting_data:
            await manager.broadcast({
                "type": "meeting_updated",
                "payload": updated_meeting_data
            })

    except Exception as e:
        print(f"[Analysis Task {job_id}] Error during analysis: {e}")
        # Update DB record to indicate failure status, include any partial analysis data if desired
        analysis_data['error'] = str(e) # Add error info
        failed_meeting_data = await update_analysis_results(job_id=job_id, analysis_data=analysis_data, success=False)

        # Broadcast failure update using returned data
        if failed_meeting_data:
            await manager.broadcast({
                "type": "meeting_updated",
                "payload": failed_meeting_data
            })

# --- ASR Task ---
async def run_asr_task(background_tasks: BackgroundTasks, file_path: str, job_id: str):
    """
    Background task for ASR processing. Triggers analysis task on success.
    (Moved from routers/upload.py)
    """
    print(f"[ASR Task {job_id}] Starting transcription for: {file_path}")
    transcript = ""
    transcript_segments = []
    detected_languages = [] # Initialize languages list
    try:
        # 1. Transcribe Audio and Detect Languages
        asr_result = await asr.transcribe_audio(file_path)
        transcript = asr_result.get("transcript")
        transcript_segments = asr_result.get("segments", [])
        detected_languages = asr_result.get("languages", []) # Extract languages

        if not transcript:
             # Handle transcription failure specifically
             raise ValueError("Transcription failed or returned empty result.")

        print(f"[ASR Task {job_id}] Transcription complete. Detected languages: {detected_languages}")

        # 2. Update DB with transcript, languages, set status to 'processing_analysis', and get updated data
        updated_meeting_data = await update_asr_result(job_id=job_id, transcript=transcript, languages=detected_languages)

        # 3. Broadcast ASR completion update using returned data
        if updated_meeting_data:
            await manager.broadcast({
                "type": "meeting_updated",
                "payload": updated_meeting_data
            })

        # 4. Trigger the analysis task (only if ASR update was successful)
        if updated_meeting_data: # Check if we got data back before triggering next step
            # Note: We pass the background_tasks instance from the caller if needed,
            # but run_analysis_task doesn't need it itself.
            background_tasks.add_task(run_analysis_task, job_id, transcript, transcript_segments)
            print(f"[ASR Task {job_id}] Enqueued analysis task.")
        else:
            print(f"[ASR Task {job_id}] Skipping analysis task due to ASR update failure.")

    except Exception as e:
        print(f"[ASR Task {job_id}] Error during transcription: {e}")
        # Update DB record to indicate failure status immediately
        error_data = {"error": f"ASR Error: {e}"}
        failed_meeting_data = await update_analysis_results(job_id=job_id, analysis_data=error_data, success=False)

        # Broadcast ASR failure update using returned data (which includes status and error)
        if failed_meeting_data:
            await manager.broadcast({
                "type": "meeting_updated",
                "payload": failed_meeting_data
            })
            # No need to fetch full data again here, failed_meeting_data has what we need for broadcast
            # asr_failed_data = await get_meeting_data(job_id) # Removed call
            # if asr_failed_data:
            #     await manager.broadcast({
            #         "type": "meeting_updated",
            #         "payload": asr_failed_data
            #     })
    # Optional: Clean up the uploaded file after ASR? Consider moving cleanup logic
    # finally:
    #     try:
    #         os.remove(file_path) # Need os import if uncommented
    #     except OSError as e:
    #         print(f"[ASR Task {job_id}] Error cleaning up file {file_path}: {e}")
