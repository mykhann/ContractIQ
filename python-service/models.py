from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ClauseType(str, Enum):
    PAYMENT = "Payment"
    LIABILITY = "Liability"
    DEADLINE = "Deadline"
    TERMINATION = "Termination"
    CONFIDENTIALITY = "Confidentiality"
    INTELLECTUAL_PROPERTY = "Intellectual Property"
    DISPUTE_RESOLUTION = "Dispute Resolution"
    GOVERNING_LAW = "Governing Law"
    INDEMNIFICATION = "Indemnification"
    OTHER = "Other"


class ExtractedClause(BaseModel):
    clause_text: str
    clause_type: ClauseType
    location_hint: Optional[str] = None


class ScoredClause(BaseModel):
    clause_text: str
    clause_type: ClauseType
    location_hint: Optional[str] = None
    risk_score: float = Field(..., ge=1.0, le=10.0)
    risk_level: RiskLevel
    risk_reason: str
    recommendation: str
    negotiation_leverage: str


class ContractAnalysisRequest(BaseModel):
    contract_text: str
    contract_name: Optional[str] = "Unnamed Contract"
    party_perspective: Optional[str] = "reviewing party"


class RedFlag(BaseModel):
    title: str
    description: str
    severity: RiskLevel
    clause_reference: Optional[str] = None


class RiskBreakdown(BaseModel):
    payment_risk: float = Field(..., ge=0.0, le=10.0)
    liability_risk: float = Field(..., ge=0.0, le=10.0)
    deadline_risk: float = Field(..., ge=0.0, le=10.0)
    termination_risk: float = Field(..., ge=0.0, le=10.0)
    confidentiality_risk: float = Field(..., ge=0.0, le=10.0)
    ip_risk: float = Field(..., ge=0.0, le=10.0)


class ContractAnalysisReport(BaseModel):
    contract_name: str
    contract_summary: str
    overall_risk_score: float = Field(..., ge=0.0, le=10.0)
    overall_risk_level: RiskLevel
    risk_breakdown: RiskBreakdown
    clauses: List[ScoredClause]
    red_flags: List[RedFlag]
    top_recommendations: List[str]
    missing_clauses: List[str]
    contract_word_count: int
    analysis_confidence: str


class AnalyzeResponse(BaseModel):
    success: bool
    scan_id: Optional[int] = None
    report: Optional[ContractAnalysisReport] = None
    error: Optional[str] = None


class ScanSummary(BaseModel):
    id: int
    contract_name: str
    overall_risk_score: float
    overall_risk_level: RiskLevel
    clause_count: int
    red_flag_count: int
    party_perspective: str
    analysis_confidence: str
    contract_word_count: int
    created_at: str


class HistoryResponse(BaseModel):
    total: int
    scans: List[ScanSummary]
