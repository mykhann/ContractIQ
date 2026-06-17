"""
database.py — SQLite persistence layer for ContractGuard.

Schema
------
scans
  id                  INTEGER PK AUTOINCREMENT
  contract_name       TEXT
  party_perspective   TEXT
  overall_risk_score  REAL
  overall_risk_level  TEXT
  clause_count        INTEGER
  red_flag_count      INTEGER
  analysis_confidence TEXT
  contract_word_count INTEGER
  report_json         TEXT        -- full ContractAnalysisReport as JSON
  created_at          TEXT        -- ISO-8601 UTC
"""

import sqlite3
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "contractguard.db"

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS scans (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_name       TEXT    NOT NULL,
    party_perspective   TEXT    NOT NULL DEFAULT 'reviewing party',
    overall_risk_score  REAL    NOT NULL,
    overall_risk_level  TEXT    NOT NULL,
    clause_count        INTEGER NOT NULL DEFAULT 0,
    red_flag_count      INTEGER NOT NULL DEFAULT 0,
    analysis_confidence TEXT    NOT NULL DEFAULT 'MEDIUM',
    contract_word_count INTEGER NOT NULL DEFAULT 0,
    report_json         TEXT    NOT NULL,
    created_at          TEXT    NOT NULL
);
"""

CREATE_INDEX = """
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans (created_at DESC);
"""


@contextmanager
def get_conn():
    """Context manager that yields a thread-safe SQLite connection."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")   # safe for concurrent reads
    conn.execute("PRAGMA foreign_keys=ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create tables on startup if they don't exist."""
    with get_conn() as conn:
        conn.execute(CREATE_TABLE)
        conn.execute(CREATE_INDEX)
    logger.info(f"SQLite database ready at {DB_PATH}")


def save_scan(report_dict: dict, party_perspective: str) -> int:
    """
    Persist a completed analysis report.
    Returns the new scan id.
    """
    now = datetime.now(timezone.utc).isoformat()

    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO scans (
                contract_name, party_perspective,
                overall_risk_score, overall_risk_level,
                clause_count, red_flag_count,
                analysis_confidence, contract_word_count,
                report_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report_dict["contract_name"],
                party_perspective,
                report_dict["overall_risk_score"],
                report_dict["overall_risk_level"],
                len(report_dict.get("clauses", [])),
                len(report_dict.get("red_flags", [])),
                report_dict.get("analysis_confidence", "MEDIUM"),
                report_dict.get("contract_word_count", 0),
                json.dumps(report_dict),
                now,
            ),
        )
        scan_id = cur.lastrowid

    logger.info(f"Saved scan id={scan_id} for '{report_dict['contract_name']}'")
    return scan_id


def get_scan(scan_id: int) -> Optional[dict]:
    """Fetch a single scan by id. Returns full report_json or None."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM scans WHERE id = ?", (scan_id,)
        ).fetchone()

    if row is None:
        return None

    data = dict(row)
    data["report"] = json.loads(data.pop("report_json"))
    return data


def list_scans(limit: int = 50, offset: int = 0) -> tuple[int, list[dict]]:
    """
    Return (total_count, list_of_scan_summaries) ordered newest first.
    Does NOT include report_json to keep the payload light.
    """
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM scans").fetchone()[0]
        rows = conn.execute(
            """
            SELECT id, contract_name, party_perspective,
                   overall_risk_score, overall_risk_level,
                   clause_count, red_flag_count,
                   analysis_confidence, contract_word_count,
                   created_at
            FROM scans
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()

    return total, [dict(r) for r in rows]


def delete_scan(scan_id: int) -> bool:
    """Delete a scan. Returns True if a row was deleted."""
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM scans WHERE id = ?", (scan_id,))
    return cur.rowcount > 0


def get_stats() -> dict:
    """Aggregate stats for the dashboard header."""
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT
                COUNT(*)                        AS total_scans,
                ROUND(AVG(overall_risk_score),1) AS avg_risk_score,
                SUM(CASE WHEN overall_risk_level = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_count,
                SUM(CASE WHEN overall_risk_level = 'HIGH'     THEN 1 ELSE 0 END) AS high_count,
                SUM(CASE WHEN overall_risk_level = 'MEDIUM'   THEN 1 ELSE 0 END) AS medium_count,
                SUM(CASE WHEN overall_risk_level = 'LOW'      THEN 1 ELSE 0 END) AS low_count
            FROM scans
            """
        ).fetchone()
    return dict(row)
