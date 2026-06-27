"""
RAG (Retrieval-Augmented Generation) module.
Retrieves relevant coding guidelines from a knowledge base using TF-IDF similarity,
then injects them into the AI prompt to ground responses in best-practice documents.
"""
import json
import math
import re
from pathlib import Path
from collections import Counter


def _tokenize(text: str) -> list[str]:
    return re.findall(r'[a-z0-9]+', text.lower())


def _compute_idf(docs: list[list[str]]) -> dict[str, float]:
    n = len(docs)
    df: dict[str, int] = {}
    for tokens in docs:
        for t in set(tokens):
            df[t] = df.get(t, 0) + 1
    return {t: math.log((n + 1) / (count + 1)) + 1 for t, count in df.items()}


def _tfidf(tokens: list[str], idf: dict[str, float]) -> dict[str, float]:
    tf = Counter(tokens)
    total = len(tokens) or 1
    return {t: (count / total) * idf.get(t, 1.0) for t, count in tf.items()}


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    common = set(a) & set(b)
    dot = sum(a[t] * b[t] for t in common)
    norm_a = math.sqrt(sum(v * v for v in a.values())) or 1
    norm_b = math.sqrt(sum(v * v for v in b.values())) or 1
    return dot / (norm_a * norm_b)


class KnowledgeBase:
    """
    In-memory TF-IDF vector store over a JSON knowledge base.
    Demonstrates RAG without requiring an external vector database.
    """

    def __init__(self, guidelines_path: str | None = None):
        if guidelines_path is None:
            guidelines_path = Path(__file__).parent / "data" / "guidelines.json"
        with open(guidelines_path) as f:
            self.documents = json.load(f)

        # Build TF-IDF index: combine content + tags for each document
        raw_texts = [
            d["content"] + " " + " ".join(d.get("tags", []))
            for d in self.documents
        ]
        self._tokenized = [_tokenize(t) for t in raw_texts]
        self._idf = _compute_idf(self._tokenized)
        self._vectors = [_tfidf(tokens, self._idf) for tokens in self._tokenized]

    def retrieve(self, query: str, top_k: int = 3) -> list[dict]:
        """Return top_k most relevant guidelines for the given query."""
        q_tokens = _tokenize(query)
        q_vec = _tfidf(q_tokens, self._idf)
        scores = [_cosine(q_vec, doc_vec) for doc_vec in self._vectors]
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
        results = []
        for i in top_indices:
            if scores[i] > 0.01:  # minimum relevance threshold
                results.append({
                    **self.documents[i],
                    "relevance_score": round(scores[i], 4),
                })
        return results

    def format_for_prompt(self, guidelines: list[dict]) -> str:
        """Format retrieved guidelines for injection into the AI prompt."""
        if not guidelines:
            return ""
        lines = ["RELEVANT CODING GUIDELINES (from knowledge base):"]
        for g in guidelines:
            lines.append(f"\n### {g['title']} [{g['category']}]")
            lines.append(g["content"])
        return "\n".join(lines)


# Singleton instance loaded at startup
_kb: KnowledgeBase | None = None


def get_knowledge_base() -> KnowledgeBase:
    global _kb
    if _kb is None:
        _kb = KnowledgeBase()
    return _kb
