"""
extractor.py — Clause extraction using Groq/LLaMA.

Large contracts are split into overlapping chunks so nothing is missed.
Each chunk is sent to the LLM independently; duplicate clauses (from
the overlap) are removed by fingerprinting the first 120 characters.
"""

import os
import logging
from typing import List

from groq_client import chat, parse_json
from models import ExtractedClause, ClauseType

logger = logging.getLogger(__name__)

# Reduced chunk sizes to save tokens
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", 12000))  # Was 5000
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", 200))  # Was 400

# ── Prompts ───────────────────────────────────────────────────────────────────

SYSTEM = """You are an expert contract attorney with 20+ years of experience.

Extract ALL legally significant clauses from the contract text provided.

CLAUSE TYPES:
- Payment            : fees, invoicing, late payment, auto-renewal, price escalation
- Liability          : liability caps, unlimited liability, consequential damages
- Deadline           : delivery dates, milestones, penalty clauses for delays
- Termination        : notice periods, termination for convenience/cause, lock-in
- Confidentiality    : NDA terms, data protection, disclosure restrictions
- Intellectual Property : IP ownership, work-for-hire, license grants, assignment
- Dispute Resolution : arbitration, jurisdiction, mediation requirements
- Governing Law      : which country/state law applies
- Indemnification    : who indemnifies whom and for what
- Other              : anything legally significant not covered above

RULES:
1. Extract EXACT verbatim clause text — do NOT summarise or paraphrase
2. Include the full sentence/paragraph; do not clip mid-sentence
3. Note the section number/heading if visible (e.g. "Section 4.2")
4. Focus on clauses that create risk, obligation, or liability

Respond ONLY with valid JSON — no preamble, no markdown fences:
{"clauses":[{"clause_text":"...","clause_type":"Payment","location_hint":"Section 4.2 or null"}]}"""

USER = """Extract all legally significant clauses from this section:

---
{text}
---

JSON only."""


# ── Chunking ──────────────────────────────────────────────────────────────────

def _chunk(text: str) -> List[str]:
    if len(text) <= CHUNK_SIZE:
        return [text]

    chunks, start = [], 0
    while start < len(text):
        end = start + CHUNK_SIZE
        if end >= len(text):
            chunks.append(text[start:])
            break
        # Prefer paragraph boundary, fall back to newline, then space
        for sep in ("\n\n", "\n", " "):
            bp = text.rfind(sep, start, end)
            if bp > start:
                end = bp
                break
        chunks.append(text[start:end])
        start = max(start + 1, end - CHUNK_OVERLAP)

    logger.info(f"Contract split into {len(chunks)} chunks")
    return chunks


# ── Extraction ────────────────────────────────────────────────────────────────

def _extract_chunk(chunk: str, idx: int) -> List[ExtractedClause]:
    try:
        raw    = chat(SYSTEM, USER.format(text=chunk), max_tokens=4096)
        parsed = parse_json(raw)
        clauses = []
        for item in parsed.get("clauses", []):
            try:
                ct = ClauseType(item.get("clause_type", "Other"))
            except ValueError:
                ct = ClauseType.OTHER
            try:
                clauses.append(ExtractedClause(
                    clause_text=item["clause_text"],
                    clause_type=ct,
                    location_hint=item.get("location_hint"),
                ))
            except (KeyError, ValueError) as e:
                logger.warning(f"Skipping malformed clause item: {e}")
        logger.info(f"Chunk {idx}: extracted {len(clauses)} clauses")
        return clauses
    except Exception as e:
        logger.error(f"Chunk {idx} extraction failed: {e}")
        return []


def _deduplicate(clauses: List[ExtractedClause]) -> List[ExtractedClause]:
    seen, unique = set(), []
    for c in clauses:
        fp = c.clause_text[:120].strip().lower()
        if fp not in seen:
            seen.add(fp)
            unique.append(c)
    logger.info(f"Dedup: {len(clauses)} → {len(unique)} clauses")
    return unique


def extract_all_clauses(text: str) -> List[ExtractedClause]:
    chunks = _chunk(text)
    all_clauses: List[ExtractedClause] = []
    for i, chunk in enumerate(chunks):
        # Add delay between chunks (but not before first chunk)
        if i > 0:
            delay = 15  # 15 seconds between extraction chunks
            logger.info(f"Waiting {delay}s before processing chunk {i+1}/{len(chunks)}...")
            time.sleep(delay)
        
        all_clauses.extend(_extract_chunk(chunk, i + 1))
    return _deduplicate(all_clauses)