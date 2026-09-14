"""RAG pipeline for contract Q&A.

Answers are grounded in retrieved contract chunks and high-level contract metadata.
Supports conversational context across multi-turn interactions.
"""
import json
import os
from typing import List, Dict, Any, Optional

from app.core.config import settings
from app.services.vector_store import query_chunks
from app.services.llm_client import generate_answer

FALLBACK = "I could not find this information in the uploaded contract."

SYSTEM_PROMPT = (
    "You are Counsel, an elite AI legal contract assistant and legal reasoning advisor.\n"
    "Your objective is to provide authoritative, accurate, clear, and actionable assistance to legal professionals and business users.\n\n"
    "Core Instructions:\n"
    "1. CONTRACT-SPECIFIC QUERIES:\n"
    "   - When the user asks about the uploaded agreement, ground your answers in the provided <contract_reference> (excerpts and overview).\n"
    "   - Always cite specific sections, page numbers (e.g. 'Page 2'), and clause headings when referencing document provisions. Never cite excerpt or chunk numbers as page numbers.\n"
    "   - If the user asks a specific factual question about the uploaded document (e.g. specific dates, prices, parties, or special rights) and that information is genuinely NOT contained in the reference excerpts or overview, clearly state that the provided document does not mention or specify this detail (do not hallucinate terms).\n"
    "2. CONVERSATIONAL MEMORY & FOLLOW-UPS:\n"
    "   - Thoroughly utilize <conversation_history> to understand multi-turn dialogue context.\n"
    "   - If the user asks a follow-up (e.g., 'explain what you just said in simpler terms', 'what about the second party?', 'summarize what we discussed', 'draft a clause based on that', 'who represents them?'), synthesize your answer directly from the conversation history and reference context.\n"
    "   - Never claim you lack information simply because a follow-up refers to earlier dialogue turns instead of repeating the full contract name.\n"
    "3. GENERAL LEGAL & CONCEPTUAL QUERIES:\n"
    "   - If the user asks general legal questions, terminology explanations, legal doctrines, industry best practices, or drafting guidance (e.g., 'What is an indemnification clause?', 'Explain NDA vs MSA', 'What are standard governing law clauses?'):\n"
    "     Provide a comprehensive, professional explanation drawing on your legal expertise. If contract excerpts are present, you may also optionally note how that concept relates to or appears in the contract.\n"
    "   - NEVER reply that you lack information on general legal concepts or conversational inquiries.\n"
    "4. GENERAL ASSISTANCE & GREETINGS:\n"
    "   - If the user greets you or asks about your capabilities, respond helpfully and professionally as Counsel, explaining how you can assist with contract review, clause analysis, risk assessment, and legal questions.\n"
    "5. FORMATTING:\n"
    "   - Use clean Markdown formatting, bullet points, bold key legal terms, and clear headings where helpful."
)

DEFAULT_TOP_K = 6


def _load_contract_summary_context(contract_id: str) -> str:
    """Load cached high-level summary if available to ground broad questions."""
    if not contract_id or contract_id.lower() in {"general", "none", "all"}:
        return ""
    path = os.path.join(settings.upload_dir, f"{contract_id}_summary.json")
    if not os.path.exists(path):
        return ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            s = data.get("summary", {})
            return (
                f"[Contract Overview]\n"
                f"Title: {s.get('title') or 'N/A'}\n"
                f"Parties: {', '.join(s.get('parties') or [])}\n"
                f"Purpose: {s.get('contract_purpose') or 'N/A'}\n"
                f"Effective Date: {s.get('effective_date') or 'N/A'}\n"
                f"Term: {s.get('duration') or 'N/A'}\n"
                f"Governing Law: {s.get('governing_law_and_jurisdiction') or 'N/A'}\n"
                f"Key Obligations: {'; '.join(s.get('key_obligations') or [])}\n"
            )
    except Exception:
        return ""


def _build_context(chunks: List[Dict[str, Any]], summary_context: str = "") -> str:
    parts = []
    if summary_context:
        parts.append(summary_context)

    for i, c in enumerate(chunks, start=1):
        p_num = c.get("page_number") or 1
        page_str = f"Page {p_num}"
        heading_str = f" · {c['heading']}" if c.get("heading") else ""
        parts.append(f"[Excerpt {i} | {page_str}{heading_str}]\n{c['text']}")
    return "\n\n".join(parts)


def _build_retrieval_query(question: str, history: Optional[List[Dict[str, str]]]) -> str:
    """Augment retrieval query with recent context if the question is a conversational follow-up."""
    if not history:
        return question

    follow_up_triggers = {
        "that", "this", "it", "they", "them", "these", "those", "above", "mentioned",
        "earlier", "simpler", "more", "why", "second", "first", "party", "clause",
        "late", "penalty", "fees", "what about", "explain", "summarize", "rephrase"
    }
    q_lower = question.lower()
    words = set(q_lower.split())

    if len(words) < 7 or any(trigger in q_lower for trigger in follow_up_triggers):
        for turn in reversed(history):
            if turn.get("role") == "user":
                prev_text = turn.get("content", "").strip()
                if prev_text and prev_text.lower() != q_lower:
                    # Combine the question with previous user query terms for vector lookup
                    return f"{question} {prev_text}"
    return question


def answer_question(
    contract_id: Optional[str],
    question: str,
    top_k: int = DEFAULT_TOP_K,
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    is_general_mode = not contract_id or contract_id.lower() in {"general", "none", "all"}

    chunks: List[Dict[str, Any]] = []
    summary_ctx = ""

    if not is_general_mode:
        summary_ctx = _load_contract_summary_context(contract_id)
        chunks = query_chunks(question, contract_id=contract_id, top_k=top_k)

        # Contextual query expansion for follow-up questions
        augmented_query = _build_retrieval_query(question, history)
        if augmented_query != question:
            extra_chunks = query_chunks(augmented_query, contract_id=contract_id, top_k=top_k)
            seen_indices = {c.get("chunk_index") for c in chunks if c.get("chunk_index") is not None}
            for ec in extra_chunks:
                c_idx = ec.get("chunk_index")
                if c_idx is None or c_idx not in seen_indices:
                    chunks.append(ec)
                    if c_idx is not None:
                        seen_indices.add(c_idx)

    # Build conversation history
    history_str = ""
    if history:
        turns = []
        for turn in history[-20:]:  # last 20 messages (up to 10 full turns) for rich context
            role = "User" if turn.get("role") == "user" else "Assistant"
            turns.append(f"{role}: {turn.get('content', '')}")
        history_str = "<conversation_history>\n" + "\n".join(turns) + "\n</conversation_history>\n\n"

    # Build reference context
    context = _build_context(chunks, summary_ctx) if (chunks or summary_ctx) else ""
    context_tag = f"<contract_reference>\n{context}\n</contract_reference>\n\n" if context else ""

    user_prompt = (
        f"{history_str}"
        f"{context_tag}"
        f"<user_question>\n{question}\n</user_question>"
    )

    answer = generate_answer(SYSTEM_PROMPT, user_prompt, max_tokens=1000)

    # If the answer explicitly indicates that info wasn't in the contract, sources are empty
    not_found = (
        answer.strip().rstrip(".").lower() == FALLBACK.rstrip(".").lower()
        or not chunks
    )

    sources = [] if not_found else [
        {
            "page_number": c.get("page_number") or 1,
            "heading": c.get("heading"),
            "chunk_index": c.get("chunk_index"),
            "distance": c.get("distance"),
            "text": c.get("text"),
        }
        for c in chunks
    ]

    return {"answer": answer, "sources": sources}

