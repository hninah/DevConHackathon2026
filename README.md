# DevConHackathon2026
# SecurePass Backend

AI-powered exam coach for the Alberta Basic Security Guard certification.

## Setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Environment Variables

Copy `.env.example` to `.env` and fill in values (or ask a teammate).

## Scripts

- `scripts/chunk_manual.py` — extract and chunk the manual PDF
- `scripts/embed_chunks.py` — generate embeddings for each chunk
- `src/rag_query.py` — query the RAG pipeline end-to-end

## Stack

- AWS Bedrock (Claude Sonnet 4.6) for tutor responses
- AWS Bedrock (Titan Embeddings v2) for vector embeddings
- Local JSON-based vector store