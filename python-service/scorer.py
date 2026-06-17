"""
scorer.py — Batch clause scoring using Groq/LLaMA.

Instead of one API call per clause (87 calls for a large contract),
we score clauses in batches — reducing API calls significantly.
"""

import os
import time
import random
import logging
from typing import List

from groq_client import chat, parse_json
from models import ExtractedClause, ScoredClause, RiskLevel

logger = logging.getLogger(__name__)

# Rate limit friendly settings
BATCH_SIZE = int(os.environ.get("SCORING_BATCH_SIZE", 3))  
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", 5))

SYSTEM = """You are a senior commercial lawyer specialising in contract risk assessment.

Score each provided contract clause for risk from the perspective of the reviewing party
(the party who did NOT draft this contract).

SCORING SCALE 1–10:
  1-2  Very low  — standard, fair, industry-normal language
  3-4  Low       — minor concerns, common in contracts
  5-6  Medium    — notable concern, warrants negotiation
  7-8  High      — significant exposure, must be changed
  9-10 Critical  — unacceptable as-is, major red flag

RISK FACTORS:
  • Asymmetry      — heavily favours one party?
  • Vagueness      — key terms undefined, giving other party discretion?
  • Exposure       — creates unlimited financial or legal liability?
  • Enforceability — legally aggressive or unusual?
  • Market norm    — worse than typical industry standards?

You will receive a JSON array of clauses. Return a JSON array of scored results
in the SAME ORDER with the SAME number of items.

Respond ONLY with a valid JSON array — no preamble, no markdown:
[
  {
    "risk_score": 7.5,
    "risk_level": "HIGH",
    "risk_reason": "2-3 sentence explanation of the risk.",
    "recommendation": "Specific counter-language or negotiation action.",
    "negotiation_leverage": "Which party has leverage and why."
  }
]"""

USER = """Party perspective: {party_perspective}

Score these {count} clauses:

{clauses_json}

Return a JSON array with exactly {count} objects in the same order."""


def _level(score: float) -> RiskLevel:
    if score <= 3.0:  return RiskLevel.LOW
    if score <= 5.5:  return RiskLevel.MEDIUM
    if score <= 7.5:  return RiskLevel.HIGH
    return RiskLevel.CRITICAL


def _fallback(clause: ExtractedClause, reason: str) -> ScoredClause:
    return ScoredClause(
        clause_text=clause.clause_text,
        clause_type=clause.clause_type,
        location_hint=clause.location_hint,
        risk_score=5.0,
        risk_level=RiskLevel.MEDIUM,
        risk_reason=reason,
        recommendation="Review manually with legal counsel.",
        negotiation_leverage="Unknown — scoring failed.",
    )


def score_batch(
    clauses: List[ExtractedClause],
    party_perspective: str,
    batch_num: int,
    total_batches: int,
) -> List[ScoredClause]:
    """Score a batch of clauses in a single API call with retry logic."""
    
    import json
    import re

    clauses_payload = [
        {
            "index": i,
            "clause_type": c.clause_type.value,
            "clause_text": c.clause_text[:300],
        }
        for i, c in enumerate(clauses)
    ]

    base_delay = 30

    for attempt in range(MAX_RETRIES):
        try:
            logger.info(
                f"Scoring batch {batch_num}/{total_batches} "
                f"({len(clauses)} clauses) — attempt {attempt + 1}/{MAX_RETRIES}"
            )

            raw = chat(
                SYSTEM,
                USER.format(
                    party_perspective=party_perspective,
                    count=len(clauses),
                    clauses_json=json.dumps(clauses_payload, indent=2),
                ),
                max_tokens=4096,
            )

            cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()

            start = cleaned.find("[")
            end   = cleaned.rfind("]")
            if start == -1 or end == -1:
                raise ValueError("No JSON array found in response")
            parsed = json.loads(cleaned[start : end + 1])

            if not isinstance(parsed, list):
                raise ValueError(f"Expected list, got {type(parsed)}")

            if len(parsed) != len(clauses):
                logger.warning(
                    f"Batch {batch_num}: expected {len(clauses)} results, "
                    f"got {len(parsed)} — padding with fallbacks"
                )
                while len(parsed) < len(clauses):
                    parsed.append({})

            results = []
            for i, (clause, scored) in enumerate(zip(clauses, parsed)):
                try:
                    raw_score  = float(scored.get("risk_score", 5.0))
                    risk_score = round(max(1.0, min(10.0, raw_score)), 1)
                    try:
                        risk_level = RiskLevel(scored.get("risk_level", "MEDIUM"))
                    except ValueError:
                        risk_level = _level(risk_score)

                    results.append(ScoredClause(
                        clause_text=clause.clause_text,
                        clause_type=clause.clause_type,
                        location_hint=clause.location_hint,
                        risk_score=risk_score,
                        risk_level=risk_level,
                        risk_reason=scored.get("risk_reason", "No reason provided."),
                        recommendation=scored.get("recommendation", "Review with legal counsel."),
                        negotiation_leverage=scored.get("negotiation_leverage", "Unknown."),
                    ))
                except Exception as e:
                    logger.warning(f"Batch {batch_num} item {i} parse error: {e}")
                    results.append(_fallback(clause, f"Parse error: {e}"))

            return results

        except Exception as e:
            error_msg = str(e)
            
            if "429" in error_msg or "rate_limit" in error_msg.lower():
                wait_match = re.search(r'Please try again in ([\d\.]+)([mhs]?)', error_msg)
                if wait_match:
                    value = float(wait_match.group(1))
                    unit = wait_match.group(2)
                    if unit == 'm':
                        wait = value * 60
                    elif unit == 'h':
                        wait = value * 3600
                    else:
                        wait = value
                    wait = min(wait, 300)
                else:
                    wait = min(base_delay * (2 ** attempt) + random.uniform(0, 10), 300)
                
                if attempt < MAX_RETRIES - 1:
                    logger.warning(f"Rate limit on batch {batch_num}. Waiting {wait:.0f}s before retry {attempt + 2}/{MAX_RETRIES}…")
                    time.sleep(wait)
                    continue
                else:
                    logger.error(f"Batch {batch_num} failed after {MAX_RETRIES} retries due to rate limits")
            else:
                if attempt < MAX_RETRIES - 1:
                    wait = min(5 * (attempt + 1), 30)
                    logger.warning(f"Batch {batch_num} attempt {attempt + 1} failed: {e}. Waiting {wait}s…")
                    time.sleep(wait)
                    continue
                else:
                    logger.error(f"Batch {batch_num} failed permanently: {e}")

    return [_fallback(c, "Batch scoring failed after multiple retries — manual review required.") for c in clauses]


def score_all_clauses(
    clauses: List[ExtractedClause],
    party_perspective: str = "reviewing party",
) -> List[ScoredClause]:
    """
    Score all clauses in batches of BATCH_SIZE.
    NO delays between batches for maximum speed.
    """
    if not clauses:
        return []

    batches = [clauses[i : i + BATCH_SIZE] for i in range(0, len(clauses), BATCH_SIZE)]
    total_batches = len(batches)

    logger.info(
        f"Scoring {len(clauses)} clauses in {total_batches} batches of {BATCH_SIZE}"
    )

    all_scored: List[ScoredClause] = []

    for i, batch in enumerate(batches):
        scored = score_batch(batch, party_perspective, i + 1, total_batches)
        all_scored.extend(scored)
        


    all_scored.sort(key=lambda c: c.risk_score, reverse=True)

    logger.info(f"Scoring complete: {len(all_scored)} clauses scored")
    return all_scored