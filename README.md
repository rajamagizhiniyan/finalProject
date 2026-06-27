# AI Code Review Assistant

An AI-powered web application that gives developers instant, structured code reviews — covering bugs, security vulnerabilities, and code quality — using a full AI pipeline: RAG retrieval, structured AI output, LLM-as-judge evaluation, and observability logging.

---

## AI Features Implemented

| Course Topic | Implementation |
|---|---|
| **Prompt Engineering** | Structured system prompt with explicit JSON schema, severity levels, and injected RAG context |
| **Structured Outputs** | Claude returns a typed JSON object parsed and validated server-side before delivery |
| **RAG + Vector Store** | In-memory TF-IDF knowledge base of 20 coding guidelines; top-k retrieved and injected into prompt |
| **Evaluation** | Second Claude call (LLM-as-judge) scores the review on completeness, accuracy, and actionability |
| **Observability** | SQLite logging of every review: latency, token counts, scores, language; `/metrics` endpoint |

---

## Problem

Code reviews are slow, require expert availability, and are skipped on solo projects. Developers miss SQL injection vulnerabilities, forgotten `await` calls, hardcoded secrets, and poor patterns — issues an AI can catch in seconds.

## Solution

A web interface where developers paste code and receive a full AI review pipeline in ~10 seconds:
1. **RAG retrieval** — fetch relevant coding guidelines from a knowledge base
2. **AI review** — Claude analyzes the code with retrieved context
3. **Evaluation** — a second AI call scores the review quality
4. **Metrics logging** — all data is persisted for observability

---

## Features

- **Quality Score** — 1–10 score with color-coded ring indicator
- **Bug Detection** — severity + line number + fix suggestion
- **Security Analysis** — SQL injection, XSS, hardcoded secrets, etc.
- **Code Quality** — naming, structure, performance, maintainability
- **RAG Context Panel** — shows which knowledge base documents were retrieved
- **AI Self-Evaluation** — completeness, accuracy, and actionability scores
- **Metrics Dashboard** — live stats bar: total reviews, avg score, avg latency
- **Refactored Snippet** — improved version of the worst section
- **Multi-language** — Python, JavaScript, TypeScript, Java, Go, Rust, and more

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite |
| Backend | Python 3.11, FastAPI, Uvicorn |
| AI | Anthropic Claude (`claude-sonnet-4-6` for review, `claude-haiku-4-5` for evaluation) |
| RAG | Custom TF-IDF vector store (no external dependencies) |
| Storage | SQLite (observability) |

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone the repository
```bash
git clone https://github.com/rajamagizhiniyan/finalProject.git
cd finalProject
git checkout feature/AICodeReview
```

### 2. Set up the backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY
```

### 3. Set up the frontend
```bash
cd ../frontend
npm install
```

### 4. Run the app

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Visit **http://localhost:5173**

---

## Usage

1. Select programming language (or Auto-detect)
2. Paste code (up to 15,000 characters)
3. Optionally add context ("this is a production API handler")
4. Click **Review Code**
5. View: quality score → RAG context → bugs → security → quality → evaluation

> **Tip:** Click "Load example" for a pre-loaded buggy Python or JavaScript snippet.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/review` | Submit code — runs full AI pipeline |
| `GET` | `/metrics` | Aggregate observability metrics |
| `GET` | `/languages` | Supported languages |
| `GET` | `/` | Health check |

---

## Project Structure

```
finalProject/
├── backend/
│   ├── main.py            # FastAPI app, pipeline orchestration
│   ├── rag.py             # TF-IDF knowledge base + retrieval
│   ├── evaluator.py       # LLM-as-judge evaluation
│   ├── observability.py   # SQLite metrics logging
│   ├── data/
│   │   └── guidelines.json  # 20 coding best practice documents
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Full React UI with all panels
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## AI Pipeline Detail

```
User Code
    │
    ▼
[1] RAG Retrieval
    TF-IDF similarity search over 20 guidelines
    → top-4 documents injected into system prompt
    │
    ▼
[2] AI Review (claude-sonnet-4-6)
    Structured JSON output: bugs, security, quality, score
    │
    ▼
[3] Evaluation (claude-haiku-4-5)
    LLM-as-judge: completeness, accuracy, actionability
    │
    ▼
[4] Observability
    SQLite log: language, latency, scores, issue counts
    │
    ▼
Response to user
```

---

## Limitations & Future Improvements

- **RAG**: TF-IDF is demonstrative; production would use dense embeddings (OpenAI, Cohere) + a vector DB (Pinecone, Weaviate)
- **No file upload**: paste-only; future version supports GitHub repo URLs
- **No auth**: suitable for demo use; production needs API key management
- **Evaluation cost**: second LLM call adds ~2s; could be async/background
- **No history UI**: metrics are logged but no history browser in the frontend

---

## License

MIT
