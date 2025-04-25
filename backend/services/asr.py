import json # For saving language list later if needed elsewhere
import os
import whisper # Use the actual library
import torch # Whisper uses PyTorch
from typing import Dict, Any, Optional, List # Add List
import pathlib # Import pathlib for robust path handling
import numpy as np # Whisper uses numpy

WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL_NAME", "base")
ASR_DEVICE = os.getenv("ASR_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")

_whisper_model = None
try:
    print(f"Loading Whisper model '{WHISPER_MODEL_NAME}' onto device '{ASR_DEVICE}'...")
    _whisper_model = whisper.load_model(WHISPER_MODEL_NAME, device=ASR_DEVICE)
    print("Whisper model loaded successfully.")
except Exception as e:
    print(f"Error loading Whisper model '{WHISPER_MODEL_NAME}': {e}")

async def transcribe_audio(file_path: str, language: Optional[str] = None) -> Dict[str, Any]:
    """
    Transcribes the audio file using the loaded Whisper model.

    Args:
        file_path: The path to the audio file.
        language: The language code (e.g., 'en', 'zh'). Auto-detect if None.

    Returns:
        A dictionary containing:
        - transcript: The full transcribed text.
        - languages: List of detected language codes (ISO 639-1).
        - language_probabilities: Dictionary of detected languages and their probabilities.
        - segments: List of segments with timestamps (if available).
        - diarization: Placeholder.
        - timestamps: Placeholder.
    """
    if not _whisper_model:
        print("Error: Whisper model is not loaded.")
        return {
            "transcript": "Error: ASR model not available.",
            "languages": [], # Return empty list for languages
            "language_probabilities": {},
            "segments": []
            # Removed diarization and timestamps placeholders
        }

    print(f"Starting Whisper processing for: {file_path}")
    transcript = "Transcription failed."
    detected_languages: List[str] = [] # Initialize as list
    segments = []
    diarization = []
    timestamps = []
    language_probabilities: Dict[str, float] = {} # Store probabilities

    try:
        absolute_file_path = str(pathlib.Path(file_path).resolve())
        print(f"Processing audio file: {absolute_file_path}")

        # 1. Detect Language Probabilities
        try:
            # Load audio and create Mel spectrogram
            # Ensure the model is available before proceeding
            if not _whisper_model:
                 raise Exception("Whisper model not loaded.")

            audio = whisper.load_audio(absolute_file_path)
            audio = whisper.pad_or_trim(audio)
            mel = whisper.log_mel_spectrogram(audio).to(_whisper_model.device)

            # Detect language
            _, probs = _whisper_model.detect_language(mel)
            language_probabilities = probs
            print(f"Detected language probabilities: {probs}")

            # Filter languages above a threshold (e.g., 10%)
            detection_threshold = 0.10
            detected_languages = [lang for lang, prob in probs.items() if prob > detection_threshold]

            # Ensure at least the top language is included if list is empty after thresholding
            if not detected_languages and probs:
                 top_lang = max(probs, key=probs.get)
                 detected_languages.append(top_lang)
                 print(f"No language above threshold, using top language: {top_lang}")
            elif not detected_languages:
                 # If detection returned no probabilities at all
                 print("Warning: Language detection returned no probabilities.")
                 detected_languages = [] # Keep empty, let transcription try detection

            print(f"Selected languages (>{detection_threshold*100}% probability): {detected_languages}")

        except Exception as lang_detect_e:
            print(f"Warning: Language detection phase failed for {file_path}: {lang_detect_e}")
            # Fallback if detection fails - let transcription try to detect
            detected_languages = [] # Reset, let transcription try

        # 2. Perform Transcription
        # Use language=None for auto-detection during transcription
        options = whisper.DecodingOptions(
            language=None, # Let Whisper detect based on content
            fp16=(ASR_DEVICE == "cuda"),
            # without_timestamps=True, # Consider if timestamps aren't needed elsewhere
        )
        print(f"Starting transcription with options: language=None, fp16={options.fp16}")
        result = _whisper_model.transcribe(absolute_file_path, **options.__dict__)

        # Extract results
        transcript_segments = result.get("segments", [])
        # Join segments ensuring no double newlines and stripping whitespace
        transcript = "\n".join([seg["text"].strip() for seg in transcript_segments]).strip()
        segments = transcript_segments # Contains start, end, text per segment

        # If language detection failed earlier or yielded no results, use transcription's result
        if not detected_languages:
             transcription_lang = result.get("language")
             if transcription_lang:
                 detected_languages = [transcription_lang]
                 print(f"Using language detected during transcription: {transcription_lang}")
             else:
                 detected_languages = ['en'] # Final fallback
                 print("Warning: Could not detect language via detection or transcription. Defaulting to 'en'.")

        print(f"Whisper processing complete. Final detected languages: {detected_languages}")

    except Exception as e:
        print(f"Error during Whisper processing for {file_path}: {e}")
        transcript = f"Error during processing: {e}"
        # Reset other fields on error
        detected_languages = []
        segments = []
        # diarization = [] # Removed placeholder
        # timestamps = [] # Removed placeholder
        language_probabilities = {}

    return {
        "transcript": transcript,
        "languages": detected_languages, # Return list of languages
        # "language_probabilities": language_probabilities, #Optionally return probs for debugging/info
        "segments": segments
        # Removed diarization and timestamps placeholders
    }
