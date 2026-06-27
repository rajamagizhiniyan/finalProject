"""
AI Code Review Assistant — Backend
Integrates: prompt engineering, structured outputs, RAG, evaluation, and observability.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic
import os
import time
import json
from dotenv import load_dotenv

from rag import get_knowledge_base
from evaluator import evaluate_review
from observability import init_db, log_review, get_metrics

load_dotenv()

app = FastAPI(title="AI Code Review Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SUPPORTED_LANGUAGES = [
    "Auto-detect", "Python", "JavaScript", "TypeScript", "Java",
    "C", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "SQL", "Other"
]

# ── Prompt Engineering: carefully structured system prompt ─────────────────────
BASE_SYSTEM_PROMPT = """You are an expert code reviewer with deep knowledge of software engineering best practices, security vulnerabilities, and clean code principles.

When reviewing code, analyze it thoroughly and respond ONLY with a valid JSON object in this exact structure:
{
  "summary": "One paragraph summarizing the code's purpose and overall quality",
  "score": <integer 1-10 representing overall code quality>,
  "bugs": [
    {"severity": "high|medium|low", "line": "<line number or range or 'N/A'>", "description": "<clear description of the bug>", "suggestion": "<how to fix it>"}
  ],
  "security": [
    {"severity": "high|medium|low", "line": "<line number or range or 'N/A'>", "description": "<security issue>", "suggestion": "<how to fix it>"}
  ],
  "quality": [
    {"category": "<naming|readability|structure|performance|maintainability>", "line": "<line number or range or 'N/A'>", "description": "<quality issue>", "suggestion": "<improvement>"}
  ],
  "positives": ["<something the code does well>"],
  "refactored_snippet": "<optional: a short improved version of the most critical section, or null if no critical fix needed>"
}

Be specific with line numbers when possible. If there are no issues in a category, return an empty array. Be constructive and educational.
Pay special attention to the RELEVANT CODING GUIDELINES provided — they contain authoritative best practices to use when identifying and explaining issues."""


@app.on_event("startup")
def startup():
    init_db()
    get_knowledge_base()  # warm up TF-IDF index


# ── Request / Response models ──────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    code: str
    language: str = "Auto-detect"
    context: str = ""


class EvaluationResult(BaseModel):
    score: int
    completeness: int
    accuracy: int
    actionability: int
    verdict: str
    missed_issues: list
    false_positives: list
    summary: str


class RAGDocument(BaseModel):
    id: str
    title: str
    category: str
    relevance_score: float


class ReviewResponse(BaseModel):
    summary: str
    score: int
    bugs: list
    security: list
    quality: list
    positives: list
    refactored_snippet: str | None
    language_detected: str
    rag_documents: list[RAGDocument]
    evaluation: EvaluationResult
    latency_ms: int


# ── Main review endpoint ────────────────────────────────────────────────────────

@app.post("/review", response_model=ReviewResponse)
def review_code(request: ReviewRequest):
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")
    if len(request.code) > 15000:
        raise HTTPException(status_code=400, detail="Code too long. Maximum 15,000 characters.")

    start = time.time()

    # ── Step 1: RAG — retrieve relevant guidelines ────────────────────────────
    kb = get_knowledge_base()
    rag_query = f"{request.language} {request.code[:500]}"
    retrieved = kb.retrieve(rag_query, top_k=4)
    rag_context = kb.format_for_prompt(retrieved)

    # ── Step 2: Prompt Engineering — inject RAG context into system prompt ────
    system_prompt = BASE_SYSTEM_PROMPT
    if rag_context:
        system_prompt += f"\n\n{rag_context}"

    lang_tag = request.language.lower() if request.language != "Auto-detect" else ""
    user_message = f"""Please review the following {request.language} code:

```{lang_tag}
{request.code}
```
{f'Additional context: {request.context}' if request.context.strip() else ''}

Provide a thorough code review as JSON."""

    # ── Step 3: Structured Output — AI review ────────────────────────────────
    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip().rstrip("```").strip()
        data = json.loads(raw)

    except json.JSONDecodeError as e:
        log_review(request.language, len(request.code), None, None, 0, 0, 0,
                   len(retrieved), int((time.time() - start) * 1000), str(e))
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid API key. Set ANTHROPIC_API_KEY in backend/.env")
    except anthropic.APIError as e:
        log_review(request.language, len(request.code), None, None, 0, 0, 0,
                   len(retrieved), int((time.time() - start) * 1000), str(e))
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    # ── Step 4: Evaluation — LLM-as-judge ────────────────────────────────────
    eval_result = evaluate_review(client, request.code, request.language, data)

    latency_ms = int((time.time() - start) * 1000)

    # ── Step 5: Observability — log metrics ──────────────────────────────────
    log_review(
        language=request.language,
        code_length=len(request.code),
        quality_score=int(data.get("score", 0)),
        eval_score=eval_result.get("score", 0),
        bug_count=len(data.get("bugs", [])),
        security_count=len(data.get("security", [])),
        quality_count=len(data.get("quality", [])),
        rag_docs_used=len(retrieved),
        latency_ms=latency_ms,
    )

    return ReviewResponse(
        summary=data.get("summary", ""),
        score=int(data.get("score", 5)),
        bugs=data.get("bugs", []),
        security=data.get("security", []),
        quality=data.get("quality", []),
        positives=data.get("positives", []),
        refactored_snippet=data.get("refactored_snippet"),
        language_detected=request.language,
        rag_documents=[
            RAGDocument(
                id=d["id"],
                title=d["title"],
                category=d["category"],
                relevance_score=d["relevance_score"],
            )
            for d in retrieved
        ],
        evaluation=EvaluationResult(**eval_result),
        latency_ms=latency_ms,
    )


# ── Observability metrics endpoint ─────────────────────────────────────────────

@app.get("/metrics")
def metrics():
    return get_metrics()


@app.get("/")
def root():
    return {"status": "ok", "service": "AI Code Review Assistant"}


@app.get("/languages")
def get_languages():
    return {"languages": SUPPORTED_LANGUAGES}
