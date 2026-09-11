from typing import Optional, Literal
from pydantic import BaseModel


class Segment(BaseModel):
    index: int
    page_number: Optional[int] = None
    heading: Optional[str] = None
    text: str


class ExtractionMetadata(BaseModel):
    source_type: str
    num_pages: Optional[int] = None
    num_segments: int
    char_count: int
    word_count: int
    estimated_reading_time_mins: Optional[int] = None
    table_count: Optional[int] = 0


class ExtractionResult(BaseModel):
    full_text: str
    segments: list[Segment]
    metadata: ExtractionMetadata


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class QuestionRequest(BaseModel):
    question: str
    history: Optional[list[ChatHistoryItem]] = None


class SourceReference(BaseModel):
    page_number: Optional[int] = None
    heading: Optional[str] = None
    chunk_index: Optional[int] = None
    distance: Optional[float] = None
    text: Optional[str] = None


class AnswerResponse(BaseModel):
    answer: str
    sources: list[SourceReference]


class ContractSummary(BaseModel):
    # Executive & enriched contract fields
    title: Optional[str] = "Legal Agreement"
    executive_summary: Optional[str] = None
    contract_type: Optional[str] = None
    effective_date: Optional[str] = None
    expiration_date: Optional[str] = None
    governing_law_and_jurisdiction: Optional[str] = None
    financial_terms: Optional[str] = None
    liability_and_indemnification: Optional[str] = None
    dispute_resolution: Optional[str] = None
    confidentiality_terms: Optional[str] = None
    overall_risk_score: Optional[Literal["Low", "Medium", "High", "Critical"]] = "Low"
    key_risks_summary: list[str] = []

    # Backward-compatible fields
    contract_purpose: str = "Not specified in the contract."
    parties: list[str] = []
    duration: str = "Not specified in the contract."
    payment_terms: str = "Not specified in the contract."
    key_obligations: list[str] = []
    termination_conditions: str = "Not specified in the contract."
    important_clauses: list[str] = []


class SummaryResponse(BaseModel):
    contract_id: str
    method: str
    summary: ContractSummary


class ClauseClassification(BaseModel):
    chunk_index: int
    page_number: Optional[int] = None
    heading: Optional[str] = None
    text: str
    category: str
    confidence: float


class ClausesResponse(BaseModel):
    contract_id: str
    method: str
    clauses: list[ClauseClassification]


class Obligation(BaseModel):
    responsible_party: Optional[str] = None
    obligation: str
    deadline: Optional[str] = None
    section: Optional[str] = None
    page_number: Optional[int] = None
    category: Optional[str] = None
    priority: Optional[Literal["High", "Medium", "Standard"]] = "Standard"


class ObligationsResponse(BaseModel):
    contract_id: str
    obligations: list[Obligation]


class DateItem(BaseModel):
    description: str
    date_or_timeframe: Optional[str] = None
    page_number: Optional[int] = None


class DeadlinesSummary(BaseModel):
    contract_start_date: Optional[str] = None
    contract_end_date: Optional[str] = None
    renewal_date: Optional[str] = None
    termination_notice_period: Optional[str] = None
    payment_deadlines: list[DateItem] = []
    delivery_deadlines: list[DateItem] = []
    other_dates: list[DateItem] = []


class DeadlinesResponse(BaseModel):
    contract_id: str
    deadlines: DeadlinesSummary


class RiskFinding(BaseModel):
    title: str
    severity: Literal["Low", "Medium", "High", "Critical"]
    explanation: str
    evidence: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    recommendation: Optional[str] = None
    category: Optional[str] = None


class RiskAnalysisResponse(BaseModel):
    contract_id: str
    method: str
    risks: list[RiskFinding]


class ChangeItem(BaseModel):
    change_type: Literal["ADDED", "REMOVED", "MODIFIED"]
    section: Optional[str] = None
    page_number_a: Optional[int] = None
    page_number_b: Optional[int] = None
    text_a: Optional[str] = None
    text_b: Optional[str] = None
    similarity: Optional[float] = None


class HighlightedChange(BaseModel):
    category: str
    change_type: Literal["ADDED", "REMOVED", "MODIFIED"]
    description: str
    section: Optional[str] = None


class ComparisonResponse(BaseModel):
    contract_a_id: str
    contract_b_id: str
    changes: list[ChangeItem]
    ai_summary: str
    highlighted_changes: list[HighlightedChange]


class CompareByIdRequest(BaseModel):
    contract_a_id: str
    contract_b_id: str


class DashboardStatsResponse(BaseModel):
    total_contracts: int
    total_pages: int
    total_risks: int
    high_risk_count: int
    total_obligations: int
    total_deadlines: int


class UploadResponse(BaseModel):
    contract_id: str
    filename: str
    size_bytes: int
    status: str = "uploaded"
    extraction: ExtractionResult
    chunks_indexed: int


class ContractMetadata(BaseModel):
    contract_id: str
    filename: str
    size_bytes: int
    upload_date: str
    num_pages: Optional[int] = None
    num_segments: int
    risk_count: int = 0
    high_risk_count: int = 0
    has_summary: bool = False
    has_risks: bool = False
    has_obligations: bool = False
    has_deadlines: bool = False
    has_clauses: bool = False


class ContractDetails(ContractMetadata):
    extraction: ExtractionResult


class ErrorResponse(BaseModel):
    detail: str
