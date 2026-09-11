# AI Legal Contract Assistant

⚠️ **Legal Disclaimer**: This tool is an educational/demo project. It does **not** provide legal advice.
Outputs (summaries, risk flags, clause classifications) are AI-generated and may be inaccurate or incomplete.
Always consult a qualified lawyer for real legal decisions.

## What this project does
Upload a contract (PDF/DOCX) → AI pipeline extracts text → chunks + embeds it → stores in a vector DB →
lets you ask questions (RAG), get a summary, see classified clauses, flagged risks, extracted
obligations, and deadlines, and compare two contracts.

## Local development

The base setup uses a lightweight JSON/hash search fallback and does not require the C++ toolchain.
Use Python 3.12 when installing the optional ML dependencies on Windows.

```powershell
cd backend
py -3.12 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

For production-quality embeddings and ChromaDB, also install the optional stack:

```powershell
pip install -r requirements-ml.txt
```

Real LLM API keys work with either search backend.

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend uses `http://localhost:8000` by default. Set `VITE_API_URL` if the backend runs elsewhere.
The backend supports `LLM_PROVIDER=anthropic`, `gemini`, `openai`/compatible providers, or `mock`.
When `MOCK_FALLBACK=true` (the default), missing provider credentials use deterministic offline responses.

## Architecture (high level)

```
                        ┌────────────────────┐
                        │   React Frontend    │
                        │ (Upload, Chat, UI)  │
                        └──────────┬──────────┘
                                   │ REST (JSON)
                                   ▼
                        ┌────────────────────┐
                        │   FastAPI Backend   │
                        │  (routers/services) │
                        └──────────┬──────────┘
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                     ▼
     ┌────────────────┐  ┌─────────────────┐   ┌──────────────────┐
     │  PostgreSQL     │  │   ChromaDB       │   │  AI Model Layer   │
     │ (contracts,     │  │ (chunk vectors   │   │ LegalBERT/RoBERTa │
     │  clauses,       │  │  for RAG search) │   │ SentenceTransform.│
     │  obligations,   │  │                  │   │ LLM (summarize,   │
     │  deadlines)     │  │                  │   │ Q&A generation)   │
     └────────────────┘  └─────────────────┘   └──────────────────┘
```

## Request flow example (RAG Q&A)
1. User uploads `contract.pdf` → backend extracts text (PyMuPDF/python-docx)
2. Text is split into chunks → each chunk embedded (Sentence-Transformers)
3. Embeddings stored in ChromaDB, tagged with `contract_id`
4. User asks a question → question is embedded → top-k similar chunks retrieved from ChromaDB
5. Retrieved chunks + question sent to LLM → grounded answer returned with source clause references

## Folder structure

```
legal-contract-assistant/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entrypoint (Step 2)
│   │   ├── core/                # config, settings, DB connection
│   │   ├── routers/             # API endpoints (upload, qa, summary, etc.)
│   │   ├── services/            # business logic: extraction, embeddings, AI calls
│   │   ├── models/              # SQLAlchemy models / Pydantic schemas
│   │   └── utils/                # helpers
│   ├── uploads/                 # uploaded contract files (gitignored)
│   ├── chroma_db/                # persisted vector store (gitignored)
│   ├── tests/                    # backend tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/          # UploadBox, ChatPanel, RiskBadge, etc.
│   │   ├── pages/                # Dashboard, ContractView, Compare
│   │   ├── hooks/                # useContracts, useChat
│   │   ├── services/             # API client (axios/fetch wrappers)
│   │   └── types/                # TS interfaces
│   ├── package.json
│   └── tailwind.config.js
├── demo_contracts/               # sample contracts for demo (Step 13)
└── README.md
```

## Tech stack
| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Tailwind |
| Backend | Python + FastAPI |
| Relational DB | PostgreSQL (contracts, clauses, obligations, deadlines, chat history) |
| Vector DB | ChromaDB (chunk embeddings for RAG) |
| Embeddings | Sentence-Transformers (`all-MiniLM-L6-v2` to start) |
| Clause/Risk models | LegalBERT / RoBERTa (fine-tuned or zero-shot, introduced honestly at each step) |
| Generative tasks (summary, Q&A) | LLM via API (env-configured key) |
| File parsing | PyMuPDF (PDF), python-docx (DOCX) |

## Build order (this is the plan we'll follow, one step at a time)
1. Architecture + folder structure ✅ (this step)
2. Backend setup + document upload ✅
3. PDF/DOCX text extraction
4. Chunking + embeddings + ChromaDB
5. RAG Q&A
6. Contract summarization
7. Clause classification
8. Obligation + deadline extraction
9. Risk analysis
10. Contract comparison
11. React dashboard/UI ✅
12. Connect frontend + backend ✅
13. Demo data + testing
14. Final polish + README + viva explanation

## Honesty note on AI models
No model in this project is claimed to be "trained" unless we actually fine-tune it and say so
explicitly. Where we use a pretrained model (e.g. Sentence-Transformers, zero-shot LegalBERT/RoBERTa,
or an LLM API) we'll state that clearly rather than implying custom training happened.
