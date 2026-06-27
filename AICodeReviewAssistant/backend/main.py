from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic
import os
from dotenv import load_dotenv

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
    "Python", "JavaScript", "TypeScript", "Java", "C", "C++", "C#",
    "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "SQL", "Other"
]

SYSTEM_PROMPT = """You are an expert code reviewer with deep knowledge of software engineering best practices, security vulnerabilities, and clean code principles.

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

Be specific with line numbers when possible. If there are no issues in a category, return an empty array. Be constructive and educational."""


class ReviewRequest(BaseModel):
    code: str
    language: str = "Auto-detect"
    context: str = ""


class ReviewResponse(BaseModel):
    summary: str
    score: int
    bugs: list
    security: list
    quality: list
    positives: list
    refactored_snippet: str | None
    language_detected: str


@app.get("/")
def root():
    return {"status": "ok", "service": "AI Code Review Assistant"}


@app.get("/languages")
def get_languages():
    return {"languages": SUPPORTED_LANGUAGES}


@app.post("/review", response_model=ReviewResponse)
def review_code(request: ReviewRequest):
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")

    if len(request.code) > 15000:
        raise HTTPException(status_code=400, detail="Code too long. Maximum 15,000 characters.")

    user_message = f"""Please review the following {request.language} code:

```{request.language.lower() if request.language != 'Auto-detect' else ''}
{request.code}
```
{f'Additional context: {request.context}' if request.context.strip() else ''}

Provide a thorough code review as JSON."""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        import json
        raw = message.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip().rstrip("```").strip()

        data = json.loads(raw)

        return ReviewResponse(
            summary=data.get("summary", ""),
            score=int(data.get("score", 5)),
            bugs=data.get("bugs", []),
            security=data.get("security", []),
            quality=data.get("quality", []),
            positives=data.get("positives", []),
            refactored_snippet=data.get("refactored_snippet"),
            language_detected=request.language,
        )

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid API key. Set ANTHROPIC_API_KEY in backend/.env")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")
