from pydantic import BaseModel
import datetime

# Placeholder Pydantic models for request/response validation

class MeetingBase(BaseModel):
    filename: str

class MeetingCreate(MeetingBase):
    pass

class Meeting(MeetingBase):
    id: str # Changed from int to str to accommodate UUIDs
    upload_time: datetime.datetime
    transcript: str | None = None
    summary: str | None = None
    languages: list[str] | None = None

    class Config:
        orm_mode = True # For SQLAlchemy compatibility if used later

class TranscriptResponse(BaseModel):
    meeting_id: int
    transcript: str

class SummaryResponse(BaseModel):
    meeting_id: int
    summary: str
