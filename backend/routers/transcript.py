from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse, PlainTextResponse # Added PlainTextResponse
# Import specific functions from the new storage modules and pdf generator module
from ..services.pdf.generator import create_report # Updated PDF import
from ..services.storage.meeting import get_all_meeting_data, get_meeting_data
# Import get_transcript for optimized retrieval
from ..services.storage.transcript import get_transcript
from ..services.storage.search import search_transcripts
import json # For potential pretty printing in JSON export

router = APIRouter(
    # Prefix can remain /transcript or be changed, e.g., /meetings
    prefix="/meetings",
    tags=["meetings"], # Renamed tag for clarity
)

# Add endpoint to list all meetings
@router.get("/")
async def list_all_meetings():
    """ 
    Retrieves a list of all processed meetings from the database.
    Note: This might become slow with many meetings; consider pagination.
    """
    # Need a new function in storage.py to get all meetings
    all_meetings = await get_all_meeting_data() # Updated call
    return JSONResponse(content=all_meetings)


@router.get("/summary/{job_id}")
async def get_summary_details(job_id: str):
    """
    Retrieves the summary, action items, and decisions for a given job ID.
    """
    meeting_data = await get_meeting_data(job_id) # Updated call
    if not meeting_data:
        raise HTTPException(status_code=404, detail=f"Meeting data not found for job ID: {job_id}")

    # Return the full meeting data object, as the frontend now expects it
    # FastAPI will automatically serialize the dictionary (including status, filename, timestamp etc.)
    return JSONResponse(content=meeting_data)


@router.get("/transcript/{job_id}")
async def get_full_transcript(job_id: str):
    """
    Retrieves the full transcript for a given job ID.
    """
    # Use the optimized function to get only the transcript
    transcript_text = await get_transcript(job_id) # Optimized call
    if transcript_text is None: # Check for None explicitly, as empty string is valid
        # We might want to check if the meeting exists at all for a 404 vs just no transcript
        meeting_exists_check = await get_meeting_data(job_id)
        if not meeting_exists_check:
            raise HTTPException(status_code=404, detail=f"Meeting not found for job ID: {job_id}")
        else:
             # Meeting exists, but transcript might be empty or null in DB
             transcript_text = "" # Return empty string if meeting exists but transcript doesn't

    return JSONResponse(content={
        "job_id": job_id,
        "transcript": transcript_text
    })

# Note: Implemented as a global search, not per-ID search.
@router.get("/search/")
async def search_meeting_transcripts(query: str = Query(..., min_length=1)):
    """
    Searches across all transcripts using the provided query.
    Returns a list of matching meeting records.
    """
    if not query:
        raise HTTPException(status_code=400, detail="Search query cannot be empty.")

    search_results = await search_transcripts(query) # Updated call

    if not search_results:
        return JSONResponse(content={"message": "No matching transcripts found.", "results": []})

    # Ensure each result has a filename field
    for result in search_results:
        if 'filename' not in result or not result['filename']:
            result['filename'] = result.get('job_id', 'Unknown File')

    return JSONResponse(content={"query": query, "results": search_results})


@router.get("/pdf/{job_id}", response_class=FileResponse)
async def get_pdf_report(job_id: str, include_transcript: bool = Query(True, description="Include full transcript in PDF")):
    """
    Generates and returns a downloadable PDF report for the given job ID.
    """
    pdf_filepath = await create_report(job_id, include_transcript=include_transcript) # Updated call

    if not pdf_filepath:
        # This could be because the job_id wasn't found or PDF generation failed
        # Check if data exists first for a more specific error
        meeting_data = await get_meeting_data(job_id) # Updated call
        if not meeting_data:
            raise HTTPException(status_code=404, detail=f"Meeting data not found for job ID: {job_id}")
        else:
            raise HTTPException(status_code=500, detail=f"Could not generate PDF report for job ID: {job_id}")

    # Return the generated file as a response
    return FileResponse(
        path=pdf_filepath,
        media_type='application/pdf',
        filename=f"meeting_{job_id}_report.pdf" # Suggests filename to browser
    )


@router.get("/json/{job_id}", response_class=JSONResponse)
async def get_json_export(job_id: str):
    """
    Returns all meeting data (transcript, summary, actions, decisions) as a JSON object.
    """
    meeting_data = await get_meeting_data(job_id) # Updated call
    if not meeting_data:
        raise HTTPException(status_code=404, detail=f"Meeting data not found for job ID: {job_id}")

    # Return the raw dictionary, FastAPI handles JSON serialization
    return JSONResponse(content=meeting_data)


@router.get("/txt/{job_id}", response_class=PlainTextResponse)
async def get_txt_export(job_id: str):
    """
    Returns key meeting data (summary, actions, decisions, transcript) as a plain text file.
    """
    meeting_data = await get_meeting_data(job_id) # Updated call
    if not meeting_data:
        raise HTTPException(status_code=404, detail=f"Meeting data not found for job ID: {job_id}")

    # Format the data into a simple text string
    output_lines = []
    output_lines.append(f"Meeting Report - Job ID: {job_id}")
    output_lines.append(f"Original File: {meeting_data.get('filename', 'N/A')}")
    output_lines.append(f"Timestamp: {meeting_data.get('timestamp', 'N/A')}")
    output_lines.append("\n" + "="*20 + " SUMMARY " + "="*20 + "\n")
    output_lines.append(meeting_data.get('summary', 'No summary available.'))

    action_items = meeting_data.get('action_items', [])
    if action_items:
        output_lines.append("\n" + "="*20 + " ACTION ITEMS " + "="*20 + "\n")
        for item in action_items:
            output_lines.append(f"- {item}")

    decisions = meeting_data.get('decisions', [])
    if decisions:
        output_lines.append("\n" + "="*20 + " DECISIONS " + "="*20 + "\n")
        for item in decisions:
            output_lines.append(f"- {item}")

    output_lines.append("\n" + "="*20 + " TRANSCRIPT " + "="*20 + "\n")
    output_lines.append(meeting_data.get('transcript', 'No transcript available.'))

    output_text = "\n".join(output_lines)

    # Return as plain text, potentially suggest filename for download
    headers = {'Content-Disposition': f'attachment; filename="meeting_{job_id}_report.txt"'}
    return PlainTextResponse(content=output_text, headers=headers)
