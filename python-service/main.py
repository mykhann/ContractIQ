"""
main.py — ContractGuard FastAPI application.

Endpoints
---------
GET    /health              service health check
POST   /analyze             analyse contract text (used by n8n)
POST   /analyze/upload      analyse uploaded PDF / DOCX / TXT (used by frontend)
POST   /decode-file         base64 file → extracted text (n8n helper)
GET    /history             list past scans (paginated)
GET    /history/stats       aggregate dashboard stats
GET    /report/{scan_id}    full report for one scan
DELETE /report/{scan_id}    delete a scan
"""

import os
import base64
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv


load_dotenv()

from models import (
    ContractAnalysisRequest, AnalyzeResponse,
    HistoryResponse, ScanSummary,
)
from database import init_db, save_scan, get_scan, list_scans, delete_scan, get_stats
from extractor import extract_all_clauses
from scorer import score_all_clauses
from report_builder import build_report
from utils.pdf_parser import extract_text_from_pdf
from utils.docx_parser import extract_text_from_docx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── n8n notification (fire-and-forget) ───────────────────────────────────────

async def notify_n8n(report_dict: dict, scan_id: int, party_perspective: str):
    """
    After every successful scan, POST the full report to n8n webhook.
    Non-blocking — if n8n is down or URL not set, we just log and move on.
    """
    n8n_url = os.environ.get("N8N_WEBHOOK_URL")
    if not n8n_url:
        logger.debug("N8N_WEBHOOK_URL not set — skipping n8n notification")
        return

    payload = {
        "scan_id":             scan_id,
        "contract_name":       report_dict["contract_name"],
        "party_perspective":   party_perspective,
        "overall_risk_score":  report_dict["overall_risk_score"],
        "overall_risk_level":  report_dict["overall_risk_level"],
        "contract_summary":    report_dict["contract_summary"],
        "clause_count":        len(report_dict.get("clauses", [])),
        "red_flag_count":      len(report_dict.get("red_flags", [])),
        "top_recommendations": report_dict.get("top_recommendations", []),
        "missing_clauses":     report_dict.get("missing_clauses", []),
        "risk_breakdown":      report_dict.get("risk_breakdown", {}),
        "red_flags":           report_dict.get("red_flags", []),
        "report":              report_dict,   # full report for Google Docs
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(n8n_url, json=payload)
            logger.info(f"n8n notified for scan_id={scan_id} → HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"n8n notification failed (non-critical): {e}")


# ── Startup / shutdown ────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ContractGuard API starting…")
    if not os.environ.get("GROQ_API_KEY"):
        raise RuntimeError("GROQ_API_KEY is not set — add it to your .env file")
    init_db()
    n8n = os.environ.get("N8N_WEBHOOK_URL", "not set")
    logger.info(f"N8N_WEBHOOK_URL: {n8n}")
    yield
    logger.info("ContractGuard API shutting down")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ContractGuard API",
    description="AI-powered contract risk scanner — Groq + LLaMA 3.3 70B",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Core pipeline ─────────────────────────────────────────────────────────────

async def _run_analysis(
    contract_text: str,
    contract_name: str,
    party_perspective: str,
) -> AnalyzeResponse:
    """Extract → score → build report → save to SQLite → notify n8n."""

    if len(contract_text.strip()) < 100:
        raise HTTPException(
            status_code=400,
            detail="Contract text too short (minimum 100 characters)."
        )
    if len(contract_text) > 200_000:
        raise HTTPException(
            status_code=400,
            detail="Contract exceeds 200,000 character limit."
        )

    # Step 1 — Extract clauses
    clauses = extract_all_clauses(contract_text)
    if not clauses:
        raise HTTPException(
            status_code=422,
            detail="No legally significant clauses found in document."
        )

    #  ADD DELAY HERE - Respect rate limits between extraction and scoring
    # logger.info("Extraction complete. Waiting 1 seconds before scoring to respect rate limits...")
    # await asyncio.sleep(1) 

    # Step 2 — Score each clause
    scored = score_all_clauses(clauses, party_perspective)

    # Step 3 — Build final report
    report = build_report(
        scored_clauses=scored,
        contract_text=contract_text,
        contract_name=contract_name,
        party_perspective=party_perspective,
    )

    # Step 4 — Persist to SQLite
    scan_id = save_scan(report.model_dump(), party_perspective)
    logger.info(
        f"Scan id={scan_id} saved | "
        f"Risk: {report.overall_risk_score}/10 ({report.overall_risk_level}) | "
        f"Clauses: {len(scored)}"
    )

    # Step 5 — Notify n8n (non-blocking, won't fail the request)
    asyncio.create_task(notify_n8n(report.model_dump(), scan_id, party_perspective))

    return AnalyzeResponse(success=True, scan_id=scan_id, report=report)


# ── Routes ────────────────────────────────────────────────────────────────────
class FileUploadRequest(BaseModel):
    file_base64: str
    filename: str
    contract_name: Optional[str] = None
    party_perspective: Optional[str] = "reviewing party"
@app.post("/analyze/upload-json", response_model=AnalyzeResponse)
async def analyze_upload_json(req: FileUploadRequest):
    try:
        # Decode base64 to bytes
        raw = base64.b64decode(req.file_base64)
        name = req.contract_name or req.filename

        if req.filename.lower().endswith(".pdf"):
            text = extract_text_from_pdf(raw)
        elif req.filename.lower().endswith(".docx"):
            text = extract_text_from_docx(raw)
        elif req.filename.lower().endswith(".txt"):
            text = raw.decode("utf-8", errors="replace")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {req.filename}"
            )

        if not text:
            raise HTTPException(status_code=422, detail="Could not extract text from the file.")

        return await _run_analysis(text, name, req.party_perspective)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        return AnalyzeResponse(success=False, error=str(e))
@app.get("/")
async def root():
    return {
        "message": "ContractGuard API is running",
        "endpoints": {
            "health": "/health",
            "analyze": "/analyze",
            "analyze_upload": "/analyze/upload",
            "history": "/history",
            "stats": "/history/stats",
            "report": "/report/{scan_id}",
            "decode_file": "/decode-file"
        }
    }
@app.get("/health")
async def health():
    return {
        "status":  "ok",
        "service": "contractguard",
        "llm":     "grversatileoq/llama-3.3-70b-",
        "n8n":     bool(os.environ.get("N8N_WEBHOOK_URL")),
    }


# Text input — also triggered by n8n if needed
@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_text(req: ContractAnalysisRequest):
    try:
        return await _run_analysis(
            req.contract_text,
            req.contract_name or "Unnamed Contract",
            req.party_perspective or "reviewing party",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        return AnalyzeResponse(success=False, error=str(e))


# File upload — called by the frontend
@app.post("/analyze/upload", response_model=AnalyzeResponse)
async def analyze_upload(
    file: UploadFile = File(...),
    contract_name: Optional[str] = Form(None),
    party_perspective: Optional[str] = Form("reviewing party"),
):
    try:
        raw      = await file.read()
        filename = file.filename or "upload"
        name     = contract_name or filename

        if filename.lower().endswith(".pdf"):
            text = extract_text_from_pdf(raw)
        elif filename.lower().endswith(".docx"):
            text = extract_text_from_docx(raw)
        elif filename.lower().endswith(".txt"):
            text = raw.decode("utf-8", errors="replace")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {filename}. Use PDF, DOCX, or TXT."
            )

        if not text:
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from the uploaded file."
            )

        return await _run_analysis(text, name, party_perspective or "reviewing party")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        return AnalyzeResponse(success=False, error=str(e))


# n8n helper — decode base64 file → plain text
class FileDecodeRequest(BaseModel):
    file_base64: str
    filename: str


@app.post("/decode-file")
async def decode_file(req: FileDecodeRequest):
    try:
        raw      = base64.b64decode(req.file_base64)
        filename = req.filename.lower()

        if filename.endswith(".pdf"):
            text = extract_text_from_pdf(raw)
        elif filename.endswith(".docx"):
            text = extract_text_from_docx(raw)
        elif filename.endswith(".txt"):
            text = raw.decode("utf-8", errors="replace")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {req.filename}"
            )

        if not text:
            raise HTTPException(status_code=422, detail="No text could be extracted.")

        return {
            "success":    True,
            "text":       text,
            "char_count": len(text),
            "word_count": len(text.split()),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Decode error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# History — paginated list
@app.get("/history", response_model=HistoryResponse)
async def history(
    limit:  int = Query(default=20, ge=1,  le=100),
    offset: int = Query(default=0,  ge=0),
):
    total, scans = list_scans(limit=limit, offset=offset)
    return HistoryResponse(
        total=total,
        scans=[ScanSummary(**s) for s in scans],
    )


# Dashboard aggregate stats
@app.get("/history/stats")
async def history_stats():
    return get_stats()


# Single full report
@app.get("/report/{scan_id}")
async def get_report(scan_id: int):
    data = get_scan(scan_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Scan id={scan_id} not found.")
    return {"success": True, "scan_id": scan_id, **data}


# Delete a scan
@app.delete("/report/{scan_id}")
async def delete_report(scan_id: int):
    deleted = delete_scan(scan_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Scan id={scan_id} not found.")
    return {"success": True, "deleted_id": scan_id}


# Global error handler
@app.exception_handler(Exception)
async def global_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error."}
    )