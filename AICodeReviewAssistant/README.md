# AI Code Review Assistant

An AI-powered web application that gives developers instant, structured code reviews — covering bugs, security vulnerabilities, and code quality — using Claude by Anthropic.

---

## Problem

Code reviews are one of the most valuable practices in software engineering, but they are slow, require expert availability, and are often skipped on solo projects or early prototypes. Developers waste time on issues that could be caught instantly: SQL injection vulnerabilities, forgotten `await` calls, hardcoded secrets, and poor naming.

## Solution

A web interface where developers paste any code snippet and receive a thorough AI-powered review in seconds. The review is structured into actionable categories with line-level references, severity ratings, and suggested fixes.

---

## Features

- **Bug Detection** — Identifies runtime errors, logic flaws, and incorrect API usage with severity ratings (high / medium / low)
- **Security Analysis** — Flags vulnerabilities like SQL injection, XSS, hardcoded credentials, and missing input validation
- **Code Quality Feedback** — Reviews naming, readability, structure, performance, and maintainability
- **Strengths Callout** — Highlights what the code does well, not just what's wrong
- **Refactored Snippet** — Provides an improved version of the most critical section when applicable
- **Quality Score** — An overall 1–10 score for at-a-glance assessment
- **Multi-language Support** — Python, JavaScript, TypeScript, Java, Go, Rust, and more

---

## How AI Is Used

The backend sends the submitted code to **Claude** (`claude-sonnet-4-6`) via the Anthropic Python SDK. A carefully engineered system prompt instructs the model to return a structured JSON response with categorized issues, severity levels, line references, and fix suggestions. The backend parses and validates this JSON before returning it to the frontend.

**Key AI design decisions:**
- Structured JSON output enforced via system prompt — no free-form text to parse
- Model is given explicit severity and category schemas to follow
- Optional context field lets users guide the review (e.g., "this is a production API")
- Response is validated server-side before delivery to the client

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | React 18, Vite                    |
| Backend   | Python, FastAPI, Uvicorn          |
| AI        | Anthropic Claude (`claude-sonnet-4-6`) |
| SDK       | `anthropic` Python SDK            |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone the repository

```bash
git clone https://github.com/rajamagizhiniyan/finalproject.git
cd finalproject
```

### 2. Set up the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 3. Set up the frontend

```bash
cd ../frontend
npm install
```

### 4. Run the app

Open two terminals:

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

Visit **http://localhost:5173** in your browser.

---

## Usage

1. Select your programming language (or leave as Auto-detect)
2. Paste your code into the editor (up to 15,000 characters)
3. Optionally add context about where/how the code is used
4. Click **Review Code**
5. Review the results: bugs, security issues, quality feedback, and strengths

> **Tip:** Click "Load example" to try the app instantly with a pre-loaded buggy Python or JavaScript snippet.

---

## Project Structure

```
finalproject/
├── backend/
│   ├── main.py            # FastAPI app + AI review logic
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   ├── main.jsx       # Entry point
│   │   └── index.css      # Styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js     # Vite config with API proxy
└── README.md
```

---

## API Endpoints

| Method | Endpoint     | Description                       |
|--------|--------------|-----------------------------------|
| GET    | `/`          | Health check                      |
| GET    | `/languages` | List supported languages          |
| POST   | `/review`    | Submit code for AI review         |

**POST `/review` request body:**
```json
{
  "code": "def foo():\n    pass",
  "language": "Python",
  "context": "This is a utility function in a web API"
}
```

---

## Limitations & Future Improvements

- **No file upload** — currently paste-only; a future version would support uploading entire files or GitHub repo URLs
- **No history** — reviews are not saved; a database layer would enable review history and diff comparison
- **Rate limits** — the app is limited by Anthropic API rate limits; a queue system would improve reliability under load
- **No authentication** — suitable for local/demo use; production deployment would require API key management and user accounts
- **Context window** — very large files (>15,000 chars) are rejected; chunked analysis is a future improvement

---

## License

MIT
