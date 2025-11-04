# **<img src="https://github.com/user-attachments/assets/ed01ea11-ee10-4ff1-be70-df11a13b8fc3" alt="Notera Logo" width="22" style="vertical-align: bottom;"> Notera - AI Meeting Assistant 🎧📝🤖**

Notera is a full-stack AI meeting assistant that records, transcribes, and analyzes audio. It's available as a web app for file uploads and a cross-platform desktop app (via Electron) for live system audio recording. Notera provides transcripts, summaries, action items, and an interactive chat to query meeting content.

![image](https://github.com/user-attachments/assets/773a4138-8cd8-44e4-8d7f-a3e2e9cf5add)

## ✨ Features

*   **Audio Upload:** Process existing audio files in various formats.
*   **Live System Audio Recording:** (Desktop App Only) Record online meetings or any system audio output directly.
*   **Near Real-Time Transcription:** Uses OpenAI Whisper for highly accurate speech-to-text.
*   **AI-Powered Analysis:** Generates summaries, action items, and key decisions using LLMs.
*   **Interactive Transcript Chat:** Ask questions about your meeting content using a RAG-based chat interface.
*   **Flexible LLM Support:** Easily configure to use local models via Ollama or cloud models via OpenAI.
*   **Export Options:** Download meeting analysis as JSON, TXT, or PDF.

## 🛠️ Tech Stack

| Category | Technology/Library |
| :--- | :--- |
| **Frontend** | React, Vite, TypeScript, Tailwind CSS, shadcn-ui |
| **Desktop App** | Electron |
| **Backend** | FastAPI (Python) |
| **AI/ML** | OpenAI Whisper, LangChain, Ollama/OpenAI, ChromaDB |
| **Audio Recording**| Python (`soundcard`, `soundfile`) |
| **PDF Generation**| FPDF2 |

---

## 🚀 Getting Started

### 1. Prerequisites

Ensure the following are installed on your system:

1.  **Node.js & npm:** LTS version recommended. [Install Node.js](https://nodejs.org/)
2.  **Python:** Version 3.9 or higher. [Install Python](https://www.python.org/)
3.  **ffmpeg:** A crucial dependency for audio processing.
    *   **macOS:** `brew install ffmpeg`
    *   **Debian/Ubuntu:** `sudo apt update && sudo apt install ffmpeg`
    *   **Windows:** `choco install ffmpeg` or download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to your system's PATH.
4.  **(Optional) Ollama:** If you plan to use local LLMs. [Install Ollama](https://ollama.com/)

### 2. Setup and Installation

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/harsh-dexter/notera.git
    cd notera
    ```

2.  **Install Frontend Dependencies:**
    ```bash
    npm install
    ```

3.  **Setup Backend Environment:**
    *   Create and activate a Python virtual environment:
        ```bash
        python -m venv backend/venv
        source backend/venv/bin/activate  # On Windows, use: backend\venv\Scripts\activate
        ```
    *   Install Python dependencies:
        ```bash
        pip install -r backend/requirements.txt
        ```

### 3. Configuration

1.  **Configure Backend:**
    *   In the `backend` directory, create a file named `.env` (`notera/backend/.env`).
    *   Copy the example below into your `.env` file and adjust the values for your setup.

    ```dotenv
    # backend/.env Example Configuration

    # --- ASR (Whisper) ---
    # Model size: tiny, base, small, medium, large-v3
    WHISPER_MODEL_NAME=base
    # Device: cpu or cuda (if GPU available)
    ASR_DEVICE=cpu

    # --- LLM Configuration ---
    # Provider: ollama or openai
    LLM_PROVIDER=ollama
    # Model name (ensure it's pulled if using Ollama)
    LLM_MODEL_NAME=deepseek-coder:1.3b-base

    # --- OpenAI API Key (only needed if LLM_PROVIDER is set to openai) ---
    # OPENAI_API_KEY=sk-YourSecretKeyHere
    ```

2.  **(Optional) Pull Ollama Models:**
    If using Ollama, pull the models you specified in your `.env` file.
    ```bash
    ollama pull deepseek-coder:1.3b-base
    ```

3.  **ChromaDB Vector Store Setup:**
    *   **Default (Local Persistent):** The application defaults to using a local database in `backend/vector_db/`. No extra steps are needed.
    *   **Optional (HTTP Server):** To run ChromaDB as a separate server, follow the official ChromaDB documentation. You will need to update the configuration in `backend/services/rag_service.py` to point to your server instance.

---

## ⚡ Running for Development

Run the backend and the Electron app concurrently in separate terminals from the project root (`notera/`).

1.  **Terminal 1: Start Backend**
    ```bash
    # Activate virtual environment
    source backend/venv/bin/activate

    # Start the FastAPI server
    uvicorn backend.main:app --reload --port 7000
    ```
    The API will be live at `http://localhost:7000`.

2.  **Terminal 2: Start Electron App**
    ```bash
    npm run electron:dev
    ```

---

## 💻 Building the Desktop Application

To create distributable packages for your operating system:

```bash
# From the project root
npm run electron:build
```
The packaged application will be available in the `release/` directory.

---

## 🗂️ Project Structure
```
notera/
├── backend/              # FastAPI Backend Source
│   ├── db/
│   ├── models/
│   ├── routers/
│   ├── services/         # Core business logic (ASR, LLM, RAG, etc.)
│   ├── vector_db/        # Default local ChromaDB storage (Gitignored)
│   ├── .env              # Backend environment config (Gitignored)
│   ├── main.py           # FastAPI application entrypoint
│   └── requirements.txt
├── dist-electron/        # Built Electron main/preload scripts (Gitignored)
├── electron/             # Electron main/preload source (TypeScript)
│   ├── main.ts
│   ├── preload.ts
│   └── record_soundcard.py # Python script for audio recording
├── release/              # Packaged Electron application builds (Gitignored)
├── src/                  # React Frontend Source
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── pages/
│   ├── services/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── .gitignore
├── package.json          # Frontend/Electron dependencies & scripts
└── README.md             # This file
