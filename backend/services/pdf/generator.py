# PDF report generation orchestration logic.

import os
import asyncio
# Import specific function from the storage structure (adjust path)
from ...services.storage.meeting import get_meeting_data
# Import the formatting class and constants
from .formatter import PDFReport, MAX_ITEM_LENGTH
from typing import Optional

# Define output directory relative to this file's location might be safer
# Assuming this file is in backend/services/pdf/generator.py
# Go up two levels to backend/, then down to generated_pdfs/
PDF_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'generated_pdfs')
os.makedirs(PDF_OUTPUT_DIR, exist_ok=True)

async def create_report(job_id: str, include_transcript: bool = True) -> Optional[str]:
    """
    Generates a PDF report for the given job ID using fpdf2.

    Args:
        job_id: The ID of the meeting/job.
        include_transcript: Whether to include the full transcript in the PDF.

    Returns:
        The path to the generated PDF file, or None if generation failed.
    """
    print(f"Starting PDF report generation for job ID: {job_id}")

    # 1. Fetch meeting data using the specific function
    meeting_data = await get_meeting_data(job_id) # Updated call
    if not meeting_data:
        print(f"Error: Meeting data not found for job ID {job_id}")
        return None

    summary = meeting_data.get("summary", "No summary available.")
    action_items = meeting_data.get("action_items", [])
    decisions = meeting_data.get("decisions", [])
    key_points = meeting_data.get("key_points", [])  # New field for key points/highlights
    transcript = meeting_data.get("transcript", "No transcript available.")
    filename = meeting_data.get("filename", job_id) # Use original filename or job_id
    meeting_title = meeting_data.get("title", "Meeting Report")  # Get custom title if available

    pdf_filename = f"meeting_{job_id}_report.pdf"
    pdf_filepath = os.path.join(PDF_OUTPUT_DIR, pdf_filename) # Use updated PDF_OUTPUT_DIR path

    try:
        pdf = PDFReport() # Use imported class
        pdf.meeting_title = meeting_title
        
        # Create a cover page
        pdf.create_cover_page(job_id, filename)
        
        # Content starts on new page
        pdf.add_page()
        
        # Summary Section
        pdf.chapter_title("Executive Summary")
        pdf.chapter_body(summary)
        
        # Key Points Section (if available)
        if key_points:
            pdf.list_items(key_points, "Key Highlights")
        
        # Action Items Section
        pdf.list_items(action_items, "Action Items")

        # Decisions Section
        pdf.list_items(decisions, "Decisions Made")

        # Transcript Section (Optional)
        if include_transcript and isinstance(transcript, list) and transcript: # Check if transcript is a non-empty list
            pdf.add_page()
            pdf.chapter_title("Full Transcript")
            # Iterate through segments and format them
            for segment in transcript:
                start_time_str = pdf.format_time(segment.get('startTime', 0))
                end_time_str = pdf.format_time(segment.get('endTime', 0))
                speaker_name = segment.get('speakerName', 'Unknown Speaker')
                text = segment.get('text', '')

                # Format: [HH:MM:SS - HH:MM:SS] Speaker Name: Text
                formatted_line = f"[{start_time_str} - {end_time_str}] {speaker_name}: {text}"
                pdf.chapter_body(formatted_line) # Use chapter_body which handles sanitization and multi_cell
                pdf.ln(1) # Add a small gap between segments

        elif include_transcript and isinstance(transcript, str) and transcript: # Handle case where transcript might still be a string (fallback/old data)
             pdf.add_page()
             pdf.chapter_title("Full Transcript (Raw)")
             # Split transcript into smaller chunks to avoid rendering issues
             chunk_size = MAX_ITEM_LENGTH
             transcript_chunks = [transcript[i:i+chunk_size] for i in range(0, len(transcript), chunk_size)]
             for chunk in transcript_chunks:
                 pdf.chapter_body(chunk) # Write raw string chunks

        # Save the PDF
        pdf.output(pdf_filepath, "F")

        print(f"PDF report successfully generated: {pdf_filepath}")
        return pdf_filepath

    except Exception as e:
        import traceback
        print(f"Error generating PDF report for job {job_id}: {e}")
        print(traceback.format_exc())  # Print full traceback for better debugging
        return None
