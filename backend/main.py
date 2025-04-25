# Load environment variables first!
import os
from pathlib import Path
from dotenv import load_dotenv

# Explicitly load .env from the directory containing main.py
dotenv_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=dotenv_path)
print(f"Attempting to load .env from: {dotenv_path}") # Debug print
print(f"CHROMA_USE_HTTP after load: {os.getenv('CHROMA_USE_HTTP')}") # Debug print

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from .db.database import create_db_and_tables, setup_fts, engine # Import the function, FTS setup, and engine

# Define directories relative to main.py location
PDF_OUTPUT_DIR = "generated_pdfs" # Should match pdf_generator.py
STATIC_DIR_NAME = "static" # URL path prefix
PDF_STATIC_PATH = os.path.join(STATIC_DIR_NAME, "pdfs") # URL path: /static/pdfs/

# Ensure the PDF output directory exists (though pdf_generator should also do this)
os.makedirs(PDF_OUTPUT_DIR, exist_ok=True)


app = FastAPI(
    title="Fluent Note Taker AI Backend",
    description="API for uploading audio, processing transcripts, and generating reports.",
    version="0.1.0",
    docs_url="/docs", # Default Swagger UI path
    redoc_url="/redoc" # Alternative API docs
)


# This should be called once on startup
create_db_and_tables()
print("Database tables checked/created.")
# Setup FTS table and triggers after main tables are created
# setup_fts(engine) # Temporarily disabled for debugging DB corruption issue



# Allow requests from typical frontend development ports/origins
# and Electron's file:// origin.
# In production, restrict origins more tightly if needed.
origins = ["*"] # Allow all origins for simplicity with Electron

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)


# Serve files from the 'generated_pdfs' directory under the '/static/pdfs' URL path
# Example: A file at generated_pdfs/meeting_abc.pdf will be accessible at http://localhost:8000/static/pdfs/meeting_abc.pdf
# Note: The FileResponse in transcript.py handles direct downloads,
# mounting is useful if you want to link directly to the files from the frontend.
app.mount(f"/{PDF_STATIC_PATH}", StaticFiles(directory=PDF_OUTPUT_DIR), name="static_pdfs")


@app.get("/")
async def read_root():
    return {"message": "Welcome to the Fluent Note Taker AI Backend"}

# Include routers
from .routers import upload, transcript, chat, meetings # Import routers AFTER env vars are loaded
app.include_router(upload.router)
app.include_router(transcript.router)
app.include_router(chat.router) # Include the chat router
app.include_router(meetings.router) # Registered meetings router
