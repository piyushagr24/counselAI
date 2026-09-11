export type RiskSeverity = "Low" | "Medium" | "High" | "Critical";
export type ChangeType = "ADDED" | "REMOVED" | "MODIFIED";
export type ContractStatus = "uploaded" | "processing" | "ready";

export interface Contract {
  id: string;
  filename: string;
  uploadDate: string;
  pages: number;
  status: ContractStatus;
  riskCount: number;
  highRiskCount: number;
}

export interface ContractSummary {
  title?: string;
  executiveSummary?: string;
  contractType?: string;
  contractPurpose: string;
  parties: string[];
  effectiveDate?: string;
  expirationDate?: string;
  duration: string;
  financialTerms?: string;
  paymentTerms: string;
  governingLawAndJurisdiction?: string;
  liabilityAndIndemnification?: string;
  disputeResolution?: string;
  confidentialityTerms?: string;
  overallRiskScore?: RiskSeverity;
  keyRisksSummary?: string[];
  keyObligations: string[];
  terminationConditions: string;
  importantClauses: string[];
}

export interface Clause {
  chunkIndex: number;
  pageNumber: number | null;
  heading: string | null;
  text: string;
  category: string;
  confidence: number;
}

export interface RiskFinding {
  id: string;
  title: string;
  severity: RiskSeverity;
  explanation: string;
  evidence: string;
  pageNumber: number | null;
  section: string | null;
  recommendation?: string;
  category?: string;
}

export interface Obligation {
  responsibleParty: string | null;
  obligation: string;
  deadline: string | null;
  section: string | null;
  pageNumber: number | null;
  category?: string;
  priority?: "High" | "Medium" | "Standard";
}

export interface DateItem {
  description: string;
  dateOrTimeframe: string | null;
  pageNumber: number | null;
}

export interface DeadlinesSummary {
  contractStartDate: string | null;
  contractEndDate: string | null;
  renewalDate: string | null;
  terminationNoticePeriod: string | null;
  paymentDeadlines: DateItem[];
  deliveryDeadlines: DateItem[];
  otherDates: DateItem[];
}

export interface ChatSource {
  pageNumber: number | null;
  heading: string | null;
  chunkIndex?: number | null;
  distance?: number | null;
  text?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  avatar?: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
}

export interface ChangeItem {
  id: string;
  changeType: ChangeType;
  section: string | null;
  pageNumberA: number | null;
  pageNumberB: number | null;
  textA: string | null;
  textB: string | null;
}

export interface ApiSegment {
  index: number;
  page_number: number | null;
  heading: string | null;
  text: string;
}

export interface ApiExtractionMetadata {
  source_type: string;
  num_pages: number | null;
  num_segments: number;
  char_count: number;
  word_count: number;
  estimated_reading_time_mins?: number;
  table_count?: number;
}

export interface ApiExtractionResult {
  full_text: string;
  segments: ApiSegment[];
  metadata: ApiExtractionMetadata;
}

export interface ContractMetadata {
  contract_id: string;
  filename: string;
  size_bytes: number;
  upload_date: string;
  num_pages: number | null;
  num_segments: number;
  risk_count?: number;
  high_risk_count?: number;
  has_summary?: boolean;
  has_risks?: boolean;
  has_obligations?: boolean;
  has_deadlines?: boolean;
  has_clauses?: boolean;
}

export interface DashboardStats {
  total_contracts: number;
  total_pages: number;
  total_risks: number;
  high_risk_count: number;
  total_obligations: number;
  total_deadlines: number;
}

export interface ContractDetails extends ContractMetadata {
  extraction: ApiExtractionResult;
}

export interface UploadResponse extends ContractDetails {
  status: string;
  chunks_indexed: number;
}

export interface ApiSummaryResponse {
  contract_id: string;
  method: string;
  summary: {
    title?: string;
    executive_summary?: string;
    contract_type?: string;
    contract_purpose: string;
    parties: string[];
    effective_date?: string;
    expiration_date?: string;
    duration: string;
    financial_terms?: string;
    payment_terms: string;
    governing_law_and_jurisdiction?: string;
    liability_and_indemnification?: string;
    dispute_resolution?: string;
    confidentiality_terms?: string;
    overall_risk_score?: RiskSeverity;
    key_risks_summary?: string[];
    key_obligations: string[];
    termination_conditions: string;
    important_clauses: string[];
  };
}

export interface ApiClausesResponse {
  contract_id: string;
  method: string;
  clauses: Array<{
    chunk_index: number;
    page_number: number | null;
    heading: string | null;
    text: string;
    category: string;
    confidence: number;
  }>;
}

export interface ApiRiskResponse {
  contract_id: string;
  method: string;
  risks: Array<{
    title: string;
    severity: RiskSeverity;
    explanation: string;
    evidence: string;
    page_number: number | null;
    section: string | null;
    recommendation?: string;
    category?: string;
  }>;
}

export interface ApiObligationsResponse {
  contract_id: string;
  obligations: Array<{
    responsible_party: string | null;
    obligation: string;
    deadline: string | null;
    section: string | null;
    page_number: number | null;
    category?: string;
    priority?: "High" | "Medium" | "Standard";
  }>;
}

export interface ApiDeadlinesResponse {
  contract_id: string;
  deadlines: {
    contract_start_date: string | null;
    contract_end_date: string | null;
    renewal_date: string | null;
    termination_notice_period: string | null;
    payment_deadlines: Array<{ description: string; date_or_timeframe: string | null; page_number: number | null }>;
    delivery_deadlines: Array<{ description: string; date_or_timeframe: string | null; page_number: number | null }>;
    other_dates: Array<{ description: string; date_or_timeframe: string | null; page_number: number | null }>;
  };
}

export interface ApiAnswerResponse {
  answer: string;
  sources: Array<{
    page_number: number | null;
    heading: string | null;
    chunk_index: number | null;
    distance: number | null;
    text?: string | null;
  }>;
}

export interface ApiComparisonResponse {
  contract_a_id: string;
  contract_b_id: string;
  changes: Array<{
    change_type: ChangeType;
    section: string | null;
    page_number_a: number | null;
    page_number_b: number | null;
    text_a: string | null;
    text_b: string | null;
    similarity: number | null;
  }>;
  ai_summary: string;
  highlighted_changes: Array<{
    category: string;
    change_type: ChangeType;
    description: string;
    section: string | null;
    page_number: number | null;
  }>;
}
