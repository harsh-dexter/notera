from fastapi import APIRouter, HTTPException, Depends, Body, Path, WebSocket, WebSocketDisconnect, BackgroundTasks # Import BackgroundTasks
from fastapi import status
from pydantic import BaseModel, Field
from typing import Annotated
import asyncio

# Import the connection manager
from ..utils.websocket_manager import manager

# Import the specific functions needed from the new storage structure
from ..services.storage.meeting import (
    update_meeting_title,
    delete_meeting_by_job_id,
    create_live_meeting,
    finalize_live_meeting # Import the new function
)
from ..models.schemas import Meeting

router = APIRouter(
    prefix="/meetings",
    tags=["meetings"],
)


@router.post("/create-live", status_code=status.HTTP_201_CREATED, response_model=Meeting) # Use Meeting schema
async def create_live_meeting_endpoint():
    """
    Creates a new meeting record specifically for a live recording session.
    Assigns a unique ID and sets an initial status like 'recording_live'.
    """
    try:
        # Call the storage function to create the meeting record
        # This function needs to be implemented in services/storage/meeting.py
        new_meeting = await create_live_meeting()
        if not new_meeting:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create live meeting record in database."
            )

        print(f"Created live meeting record with ID: {new_meeting.get('id')}")
        # Return the newly created meeting data (should match Meeting schema)
        return new_meeting
    except Exception as e:
        print(f"Error creating live meeting record: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An internal server error occurred: {e}"
        )


@router.post("/{meeting_id}/finalize-live", status_code=status.HTTP_200_OK)
async def finalize_live_meeting_endpoint(
    meeting_id: Annotated[str, Path(description="The unique ID of the live meeting session to finalize.")],
    background_tasks: BackgroundTasks # Inject BackgroundTasks
):
    """
    Updates the status of a live meeting from 'recording_live' to 'processing_analysis'
    and triggers the analysis background task.
    """
    # Pass background_tasks to the storage function
    success = await finalize_live_meeting(meeting_id=meeting_id, background_tasks=background_tasks)
    if not success:
        # Could be due to not finding the meeting_id, it wasn't in 'recording_live' status, or analysis task failed to enqueue
        raise HTTPException(
            status_code=404,
            detail=f"Meeting with id '{meeting_id}' not found in 'recording_live' status or finalization failed."
        )

    return {"message": f"Live meeting {meeting_id} finalized successfully."}


class UpdateTitleRequest(BaseModel):
    new_title: str = Field(..., min_length=1, description="The new title for the meeting.")


@router.put("/{job_id}/title")
async def update_meeting_title_endpoint(
    job_id: Annotated[str, Path(description="The unique job ID of the meeting to update.")],
    payload: UpdateTitleRequest = Body(...)
):
    """
    Updates the title (filename) of a specific meeting.
    """
    success = await update_meeting_title(job_id=job_id, new_title=payload.new_title) # Updated call
    if not success:
        # Could be due to not finding the job_id or a database error
        raise HTTPException(status_code=404, detail=f"Meeting with job_id '{job_id}' not found or update failed.")

    return {"message": "Meeting title updated successfully."}
@router.delete("/{job_id}", status_code=status.HTTP_200_OK)
async def delete_meeting_endpoint(
    job_id: Annotated[str, Path(description="The unique job ID of the meeting to delete.")]
):
    """
    Deletes a specific meeting and all associated data (transcript, analysis, etc.).
    """
    deleted_count = await delete_meeting_by_job_id(job_id=job_id)
    if deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Meeting with job_id '{job_id}' not found.")

    # Broadcast the deletion event
    await manager.broadcast({
        "type": "meeting_deleted",
        "payload": {"id": job_id}
    })
    print(f"Broadcasted deletion for job_id: {job_id}")

    return {"message": f"Meeting with job_id '{job_id}' deleted successfully."}


# WebSocket endpoint for real-time updates
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive, wait for client messages (optional)
            # Or just wait indefinitely if only server->client communication is needed
            # data = await websocket.receive_text()
            # print(f"Received from {websocket.client}: {data}") # Example: echo back
            # await websocket.send_text(f"Message text was: {data}")
            await asyncio.sleep(60) # Keep connection open, check state periodically
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f"Client {websocket.client} disconnected")
    except Exception as e:
        print(f"WebSocket error for {websocket.client}: {e}")
        manager.disconnect(websocket) # Ensure disconnect on other errors too


# Add other meeting-related endpoints here later
