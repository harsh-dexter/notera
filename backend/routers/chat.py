from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from ..services import rag_service # Import the RAG service

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)

class ChatQueryRequest(BaseModel):
    meeting_id: str
    query: str

class ChatQueryResponse(BaseModel):
    meeting_id: str
    query: str
    answer: str

@router.post("/query", response_model=ChatQueryResponse)
async def handle_chat_query(request: ChatQueryRequest):
    """
    Handles a user query for a specific meeting transcript using RAG.
    """
    if not request.meeting_id or not request.query:
        raise HTTPException(status_code=400, detail="Meeting ID and query are required.")

    try:
        answer = await rag_service.query_transcript(request.meeting_id, request.query)
        return ChatQueryResponse(
            meeting_id=request.meeting_id,
            query=request.query,
            answer=answer
        )
    except Exception as e:
        # Log the specific error in a real application
        print(f"Error processing chat query for meeting {request.meeting_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to process chat query.")
