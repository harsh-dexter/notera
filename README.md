# **<img src="https://github.com/user-attachments/assets/ed01ea11-ee10-4ff1-be70-df11a13b8fc3" alt="Notera Logo" width="22" style="vertical-align: bottom;"> Notera - AI Meeting Assistant 🎧📝🤖**


Notera is a full-stack application designed to streamline the process of analyzing audio recordings, available as both a web application and a cross-platform desktop application (via Electron). Upload audio files or record system audio directly, and the application will automatically transcribe them in near real-time (for live recordings) or after upload, generate concise summaries, extract key action items and decisions, and allow you to interactively query the transcript content.

![image](https://github.com/user-attachments/assets/773a4138-8cd8-44e4-8d7f-a3e2e9cf5add)


## ✨Features

*   **Audio Upload:** Supports various audio formats for upload.
*   **Live System Audio Recording:** Record audio directly from your system's output (e.g., online meetings, videos) using the desktop app.
*   **Automatic Transcription:** Utilizes OpenAI Whisper for accurate speech-to-text conversion. Live transcription for recorded audio.
*   **AI-Powered Analysis:** Leverages Large Language Models (LLMs) via LangChain to generate:
    *   Summaries
    *   Action Items
    *   Key Decisions
*   **Interactive Transcript Chat:** Uses Retrieval-Augmented Generation (RAG) with ChromaDB and Sentence Transformers to allow natural language querying of transcript content.
*   **Flexible LLM Providers:** Configurable to use Ollama (local) or OpenAI (cloud).
*   **Export Options:** Download analysis results in JSON, TXT, or PDF formats.
*   **Modern UI:** Built with React, Vite, TypeScript, and shadcn-ui for a clean and responsive user experience.
*   **Desktop Application:** Packaged with Electron for cross-platform desktop use (Windows, macOS, Linux).

## 🛠️Tech Stack

| Category          | Technology/Library                                      |
| :---------------- | :------------------------------------------------------ |
| **Frontend**      | React, Vite, TypeScript, Tailwind CSS, shadcn-ui        |
|                   | React Query, React Router                               |
| **Desktop App**   | Electron                                                |
| **Backend**       | FastAPI (Python)                                        |
| **AI/ML**         | OpenAI Whisper (ASR)                                    |
|                   | LangChain (LLM Orchestration)                           |
|                   | Ollama / OpenAI (Configurable LLM Providers)            |
|                   | ChromaDB (Vector Store)                                 |
|                   | HuggingFace Sentence Transformers (`all-MiniLM-L6-v2`)  |
| **Audio Recording**| SoX (via `child_process` in Electron)                   |
| **PDF Generation**| FPDF2                                                   |
| **Serving**       | Uvicorn (Development), Gunicorn (Production)            |

## 🔑Prerequisites

Ensure the following are installed on your system:

1.  **Node.js & Package Manager:** Node.js (LTS version recommended) and npm. [Install Node.js](https://nodejs.org/)
2.  **Python:** Version 3.9 or higher. [Install Python](https://www.python.org/downloads/)
3.  **pip:** Python package installer (usually included with Python).
4.  **ffmpeg:** Required by Whisper for audio processing.
    *   macOS: `brew install ffmpeg`
    *   Debian/Ubuntu: `sudo apt update && sudo apt install ffmpeg`
    *   Windows: `choco install ffmpeg` or download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH.
5.  **SoX:** Required for system audio recording in the Electron app.
    *   macOS: `brew install sox`
    *   Debian/Ubuntu: `sudo apt update && sudo apt install sox`
    *   Windows: Download from [SourceForge](https://sourceforge.net/projects/sox/files/sox/) and add to PATH or ensure the application can find the executable (currently hardcoded path in `electron/main.ts` might need adjustment).
6.  **(Windows Only) AudioDeviceCmdlets:** PowerShell module needed for listing audio devices for recording.
    *   Open PowerShell **as Administrator** and run: `Install-Module -Name AudioDeviceCmdlets -Scope CurrentUser` (approve prompts if needed).
7.  **(Optional) Ollama:** If using Ollama locally. [Install Ollama](https://ollama.com/)
    *   Pull necessary models (defaults shown, adjust based on `.env`):
        ```bash
        ollama pull deepseek-coder:1.3b-base # Default for Summarizer & RAG
        # ollama pull <your-chosen-model> # If using a different model
        ```
8.  **(Optional) Git:** For cloning the repository.

## ⚙️Setup Instructions

1.  **Clone the Repository:**
    ```bash
    git clone <YOUR_REPOSITORY_URL>
    cd notera
    ```

2.  **Install Frontend & Electron Dependencies:**
    Navigate to the project root and run:
    ```bash
    npm install
    ```

3.  **Setup Backend Environment & Dependencies:**
    *   **Create & Activate Virtual Environment (Recommended):**
        (Run these commands from the project root directory `notera`)
        ```bash
        # Create venv inside backend directory
        python -m venv backend/venv

        # Activate venv
        # Windows (Command Prompt): backend\venv\Scripts\activate.bat
        # Windows (PowerShell):   .\backend\venv\Scripts\Activate.ps1
        # macOS/Linux:            source backend/venv/bin/activate
        ```
    *   **Install Python Dependencies:**
        (Ensure your virtual environment is active, still in the project root)
        ```bash
        pip install -r backend/requirements.txt
        ```
        *Note: The Sentence Transformer embedding model (`all-MiniLM-L6-v2`) will be downloaded automatically on first use by the RAG service.*
        *GPU Users: Ensure your PyTorch version aligns with your CUDA toolkit. You might need a specific installation from the [PyTorch website](https://pytorch.org/get-started/locally/).*

4.  **Configure Backend Environment Variables:**
    *   Create a `.env` file inside the `backend` directory (`notera/backend/.env`).
    *   Copy and paste the following template, adjusting the values according to your setup. **Do not commit this file with sensitive information like API keys.**

        ```dotenv
        # backend/.env Example Configuration

        # --- ASR (Whisper) ---
        # Model size: tiny, base, small, medium, large-v3
        WHISPER_MODEL_NAME=base
        # Device: cpu or cuda (if GPU available and configured)
        ASR_DEVICE=cpu

        # --- LLM (Summarizer Service - backend/services/summarizer.py) ---
        # Provider: ollama or openai
        LLM_PROVIDER=ollama
        # Model name (ensure it's available via the provider and pulled if using Ollama)
        # Ollama examples: deepseek-coder:1.3b-base, llama3, mistral
        # OpenAI examples: gpt-3.5-turbo, gpt-4
        LLM_MODEL_NAME=deepseek-coder:1.3b-base
        # Ollama base URL (only needed if not default http://localhost:11434)
        # OLLAMA_BASE_URL=http://localhost:11434

        # --- LLM (RAG Service - backend/services/rag_service.py) ---
        # NOTE: The RAG service LLM model is currently HARDCODED in rag_service.py
        # It uses Ollama 'deepseek-coder:1.3b-base' by default, or falls back to OpenAI 'gpt-3.5-turbo'
        # if OPENAI_API_KEY is set and Ollama is unavailable.
        # The LLM_PROVIDER and LLM_MODEL_NAME variables above DO NOT affect the RAG service LLM.

        # --- OpenAI API Key (ONLY needed if using OpenAI as Summarizer OR as RAG fallback) ---
        # OPENAI_API_KEY=sk-YourSecretKeyHere
        # Optional base URL for OpenAI proxies
        # OPENAI_API_BASE=

        # --- ChromaDB (Vector Store for RAG) ---
        # Set to "true" to connect to a running ChromaDB server via HTTP
        # Defaults to "false" (uses local persistent storage in backend/vector_db/)
        CHROMA_USE_HTTP=false
        # Hostname/IP of the ChromaDB server (only used if CHROMA_USE_HTTP=true)
        CHROMA_SERVER_HOST=localhost
        # Port of the ChromaDB server (only used if CHROMA_USE_HTTP=true)
        CHROMA_SERVER_PORT=8000
        ```

5.  **ChromaDB Vector Store Setup:**
    *   **Default (Local Persistent):** If `CHROMA_USE_HTTP=false` (default), ChromaDB will automatically create and use a local database in `backend/vector_db/`. No extra steps needed. This directory is ignored by Git.
    *   **Optional (HTTP Server):**
        1.  Install ChromaDB server: `pip install chromadb`
        2.  Navigate to the `backend` directory: `cd backend`
        3.  Run the server from the `backend` directory: `chroma run --path ./vector_db --host localhost --port 8000` (adjust host/port if needed).
        4.  Update `backend/.env`: Set `CHROMA_USE_HTTP=true` and configure `CHROMA_SERVER_HOST` and `CHROMA_SERVER_PORT` (default is 8000).

## ⚡Running for Development

Run the backend and the Electron app concurrently in separate terminals.

1.  **Start Backend (FastAPI + Uvicorn):**
    *   Navigate to the project root directory (`notera`).
    *   Activate your Python virtual environment (e.g., `source backend/venv/bin/activate`).
    *   **(If using HTTP ChromaDB):** If you set `CHROMA_USE_HTTP=true` in `backend/.env`, ensure your ChromaDB server is running in a separate terminal (see ChromaDB setup step 5).
    *   Run the FastAPI server from the **root** directory:
        ```bash
        uvicorn backend.main:app --reload --port 7000
        ```
    *   API will be live at `http://localhost:7000`.
    *   API Docs (Swagger UI): `http://localhost:7000/docs`.

2.  **Build & Start Electron App:**
    *   Navigate to the project root directory (`notera`).
    *   Run:
        ```bash
        npm run electron:dev
        ```
    *   This command first builds the Electron main process code (`build:electron` script) and then starts the Electron application (`electron .`), which loads the frontend from the `dist/` directory (built previously or via `npm run build`).

## 💻Building the Desktop Application

To create distributable packages for Windows, macOS, or Linux:

1.  **Ensure Backend is Configured:** Make sure your `backend/.env` is set up correctly for the target environment (especially LLM providers, API keys if needed).
2.  **Run Build Script:**
    From the project root directory:
    ```bash
    npm run electron:build
    ```
    This command performs the following:
    *   Builds the Electron main process code (`npm run build:electron`).
    *   Builds the optimized frontend code (`vite build`).
    *   Uses `electron-builder` to package the application based on your OS and configuration in `package.json` (you might need to add specific build targets there).
3.  **Find Packages:** The distributable files (e.g., `.exe`, `.dmg`, `.AppImage`) will be located in the `release/` directory (or as configured in `package.json`).

## 🗂️Project Structure

```
notera/
├── backend/              # FastAPI Backend Source
│   ├── db/               # Database modules (database.py)
│   ├── fonts/            # (Optional) Location for bundled fonts (e.g., for PDF)
│   ├── models/           # Pydantic models (schemas.py)
│   ├── routers/          # API endpoint definitions
│   ├── services/         # Core business logic (ASR, LLM, RAG, Storage, PDF, Tasks)
│   ├── utils/            # Utility functions (websocket_manager.py)
│   ├── vector_db/        # Default local ChromaDB storage (Gitignored)
│   ├── generated_pdfs/   # Exported PDFs (Gitignored)
│   ├── uploads/          # Uploaded audio files (Gitignored)
│   ├── temp_live_chunks/ # Temporary live audio chunks (Gitignored)
│   ├── .env              # Backend environment config (Gitignored)
│   ├── .gitignore        # Backend specific gitignore
│   ├── main.py           # FastAPI application entrypoint
│   └── requirements.txt  # Python dependencies
├── dist/                 # Built frontend assets (Gitignored)
├── dist-electron/        # Built Electron main/preload scripts (Gitignored)
├── electron/             # Electron main/preload source (TypeScript)
│   ├── main.ts
│   └── preload.ts
├── public/               # Static assets served by Vite
├── release/              # Packaged Electron application builds (Gitignored)
├── src/                  # React Frontend Source
│   ├── components/       # Reusable UI components
│   ├── context/          # React Context providers (RecordingContext.tsx)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions (utils.ts)
│   ├── pages/            # Top-level page components
│   ├── services/         # API interaction layer (api.ts)
│   ├── types/            # TypeScript definitions (electron.d.ts, mic.d.ts)
│   ├── App.tsx           # Main application component & routing setup
│   ├── index.css         # Global styles & Tailwind directives
│   └── main.tsx          # Frontend application entrypoint
├── temp_recording_chunks/# Temporary SoX recording chunks (Gitignored)
├── .gitignore            # Root gitignore
├── index.html            # HTML entrypoint for Vite
├── package.json          # Frontend/Electron dependencies & scripts
├── README.md             # This file
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # Base TypeScript configuration
├── tsconfig.app.json     # TypeScript config for React app (src/)
├── tsconfig.electron.json# TypeScript config for Electron process (electron/)
└── ...                   # Other config files (Tailwind, PostCSS, ESLint)
