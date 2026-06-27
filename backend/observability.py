"""
Observability module: logs all review requests to SQLite and exposes aggregate metrics.
Demonstrates monitoring and observability patterns for AI applications.
"""
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / "reviews.db"


def init_db():
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reviews (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp     REAL NOT NULL,
                language      TEXT NOT NULL,
                code_length   INTEGER NOT NULL,
                quality_score INTEGER,
                eval_score    INTEGER,
                bug_count     INTEGER DEFAULT 0,
                security_count INTEGER DEFAULT 0,
                quality_count  INTEGER DEFAULT 0,
                rag_docs_used  INTEGER DEFAULT 0,
                latency_ms     INTEGER,
                error          TEXT
            )
        """)


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def log_review(
    language: str,
    code_length: int,
    quality_score: int | None,
    eval_score: int | None,
    bug_count: int,
    security_count: int,
    quality_count: int,
    rag_docs_used: int,
    latency_ms: int,
    error: str | None = None,
):
    with _connect() as conn:
        conn.execute(
            """INSERT INTO reviews
               (timestamp, language, code_length, quality_score, eval_score,
                bug_count, security_count, quality_count, rag_docs_used, latency_ms, error)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (time.time(), language, code_length, quality_score, eval_score,
             bug_count, security_count, quality_count, rag_docs_used, latency_ms, error),
        )


def get_metrics() -> dict:
    with _connect() as conn:
        total = conn.execute("SELECT COUNT(*) FROM reviews WHERE error IS NULL").fetchone()[0]
        errors = conn.execute("SELECT COUNT(*) FROM reviews WHERE error IS NOT NULL").fetchone()[0]

        row = conn.execute("""
            SELECT
                ROUND(AVG(quality_score), 1)  AS avg_quality_score,
                ROUND(AVG(eval_score), 1)     AS avg_eval_score,
                ROUND(AVG(latency_ms), 0)     AS avg_latency_ms,
                ROUND(AVG(bug_count), 1)       AS avg_bugs,
                ROUND(AVG(security_count), 1)  AS avg_security,
                MIN(latency_ms)               AS min_latency_ms,
                MAX(latency_ms)               AS max_latency_ms
            FROM reviews WHERE error IS NULL
        """).fetchone()

        lang_rows = conn.execute("""
            SELECT language, COUNT(*) as count
            FROM reviews WHERE error IS NULL
            GROUP BY language ORDER BY count DESC LIMIT 5
        """).fetchall()

        recent = conn.execute("""
            SELECT timestamp, language, quality_score, eval_score, latency_ms,
                   bug_count, security_count, quality_count
            FROM reviews WHERE error IS NULL
            ORDER BY id DESC LIMIT 5
        """).fetchall()

    return {
        "total_reviews": total,
        "total_errors": errors,
        "avg_quality_score": row["avg_quality_score"],
        "avg_eval_score": row["avg_eval_score"],
        "avg_latency_ms": int(row["avg_latency_ms"] or 0),
        "min_latency_ms": row["min_latency_ms"],
        "max_latency_ms": row["max_latency_ms"],
        "avg_bugs_per_review": row["avg_bugs"],
        "avg_security_per_review": row["avg_security"],
        "top_languages": [{"language": r["language"], "count": r["count"]} for r in lang_rows],
        "recent_reviews": [dict(r) for r in recent],
    }
