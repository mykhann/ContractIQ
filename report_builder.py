"""
report_builder.py — Assembles the final ContractAnalysisReport.

After extraction and per-clause scoring this module:
  1. Computes weighted overall risk score
  2. Computes per-category risk breakdown
  3. Calls Groq once more for: summary, red flags, top recommendations,
     and a list of missing-but-important clauses
  4. Returns a fully populated ContractAnalysisReport
"""

import logging
from typing import List

from groq_client import chat, parse_json
from models import (
    ScoredClause, ContractAnalysisReport,
    RedFlag, RiskBreakdown, RiskLevel, ClauseType,
)

logger = logging.getLogger(__name__)

# ── Prompts ───────────────────────────────────────────────────────────────────

SYSTEM = """You are a senior contract attorney producing a final risk report.

Given a list of scored contract clauses, produce:
1. contract_summary   — 3-4 sentence plain-English summary of what the contract does and its key risks
2. top_recommendations — exactly 5 specific, actionable negotiation recommendations
3. missing_clauses    — important clauses that are ABSENT from the contract (e.g. "Limitation of Liability", "Force Majeure")
4. red_flags          — the most critical problems (max 5), each with a title, description, severity, and clause reference

Respond ONLY with valid JSON — no preamble, no markdown:
{
  "contract_summary": "...",
  "top_recommendations": ["...", "...", "...", "...", "..."],
  "missing_clauses": ["...", "..."],
  "red_flags": [
    {"title":"...","description":"...","severity":"CRITICAL","clause_reference":"Section X or null"}
  ]
}"""

USER = """Contract: {contract_name}
Reviewing party: {party_perspective}

Scored clauses (highest risk first):
{clauses_block}

Return JSON only."""


# ── Maths ─────────────────────────────────────────────────────────────────────

def _avg(scores: list, default: float = 1.0) -> float:
    return round(sum(scores) / len(scores), 1) if scores else default


def compute_breakdown(scored: List[ScoredClause]) -> RiskBreakdown:
    cat: dict = {ct: [] for ct in ClauseType}
    for c in scored:
        cat[c.clause_type].append(c.risk_score)

    return RiskBreakdown(
        payment_risk       = _avg(cat[ClauseType.PAYMENT]),
        liability_risk     = _avg(cat[ClauseType.LIABILITY] + cat[ClauseType.INDEMNIFICATION]),
        deadline_risk      = _avg(cat[ClauseType.DEADLINE]),
        termination_risk   = _avg(cat[ClauseType.TERMINATION]),
        confidentiality_risk = _avg(cat[ClauseType.CONFIDENTIALITY]),
        ip_risk            = _avg(cat[ClauseType.INTELLECTUAL_PROPERTY]),
    )


def compute_overall(scored: List[ScoredClause]) -> float:
    """Weighted mean — higher-risk clauses count more."""
    if not scored:
        return 1.0
    total_w = sum(c.risk_score for c in scored)
    if total_w == 0:
        return 1.0
    return round(min(10.0, sum(c.risk_score ** 2 for c in scored) / total_w), 1)


def level_from_score(score: float) -> RiskLevel:
    if score <= 3.0:  return RiskLevel.LOW
    if score <= 5.5:  return RiskLevel.MEDIUM
    if score <= 7.5:  return RiskLevel.HIGH
    return RiskLevel.CRITICAL


# ── LLM summary ───────────────────────────────────────────────────────────────

def _build_clauses_block(scored: List[ScoredClause]) -> str:
    lines = []
    for i, c in enumerate(scored[:20]):   # cap prompt size
        lines.append(
            f"{i+1}. [{c.clause_type.value}] {c.risk_score}/10 ({c.risk_level.value})\n"
            f"   Text: {c.clause_text[:200]}{'…' if len(c.clause_text) > 200 else ''}\n"
            f"   Risk: {c.risk_reason[:150]}"
        )
    return "\n\n".join(lines)


def generate_summary(scored: List[ScoredClause], contract_name: str, party: str) -> dict:
    for attempt in range(2):
        try:
            raw    = chat(SYSTEM, USER.format(
                contract_name=contract_name,
                party_perspective=party,
                clauses_block=_build_clauses_block(scored),
            ), max_tokens=2048)
            return parse_json(raw)
        except Exception as e:
            if attempt == 0:
                logger.warning(f"Summary attempt 1 failed: {e}")
                continue
            logger.error(f"Summary generation failed: {e}")

    return {
        "contract_summary": "Summary generation failed. Review individual clauses below.",
        "top_recommendations": ["Have a qualified lawyer review this contract before signing."],
        "missing_clauses": [],
        "red_flags": [],
    }


# ── Assembly ──────────────────────────────────────────────────────────────────

def build_report(
    scored_clauses: List[ScoredClause],
    contract_text: str,
    contract_name: str,
    party_perspective: str,
) -> ContractAnalysisReport:
    logger.info(f"Building report: '{contract_name}', {len(scored_clauses)} clauses")

    breakdown     = compute_breakdown(scored_clauses)
    overall_score = compute_overall(scored_clauses)
    overall_level = level_from_score(overall_score)
    word_count    = len(contract_text.split())
    confidence    = (
        "LOW"    if word_count < 200 or len(scored_clauses) < 2 else
        "MEDIUM" if word_count < 500 or len(scored_clauses) < 5 else
        "HIGH"
    )

    summary_data = generate_summary(scored_clauses, contract_name, party_perspective)

    red_flags = []
    for rf in summary_data.get("red_flags", []):
        try:
            red_flags.append(RedFlag(
                title=rf["title"],
                description=rf["description"],
                severity=RiskLevel(rf.get("severity", "HIGH")),
                clause_reference=rf.get("clause_reference"),
            ))
        except (KeyError, ValueError) as e:
            logger.warning(f"Skipping malformed red flag: {e}")

    return ContractAnalysisReport(
        contract_name=contract_name,
        contract_summary=summary_data.get("contract_summary", ""),
        overall_risk_score=overall_score,
        overall_risk_level=overall_level,
        risk_breakdown=breakdown,
        clauses=scored_clauses,
        red_flags=red_flags,
        top_recommendations=summary_data.get("top_recommendations", []),
        missing_clauses=summary_data.get("missing_clauses", []),
        contract_word_count=word_count,
        analysis_confidence=confidence,
    )
