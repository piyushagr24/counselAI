import type {
  Contract,
  ContractSummary,
  Clause,
  RiskFinding,
  Obligation,
  DeadlinesSummary,
  ChatMessageData,
  ChangeItem,
} from "../types";

export const mockContracts: Contract[] = [
  {
    id: "c1",
    filename: "MSA_Northwind_Supply_2026.pdf",
    uploadDate: "2026-08-28",
    pages: 14,
    status: "ready",
    riskCount: 6,
    highRiskCount: 2,
  },
  {
    id: "c2",
    filename: "Consulting_Agreement_Vega_Labs.docx",
    uploadDate: "2026-08-24",
    pages: 8,
    status: "ready",
    riskCount: 3,
    highRiskCount: 1,
  },
  {
    id: "c3",
    filename: "NDA_Meridian_Partners.pdf",
    uploadDate: "2026-08-20",
    pages: 4,
    status: "ready",
    riskCount: 1,
    highRiskCount: 0,
  },
  {
    id: "c4",
    filename: "Lease_Renewal_Draft_v3.docx",
    uploadDate: "2026-08-30",
    pages: 11,
    status: "processing",
    riskCount: 0,
    highRiskCount: 0,
  },
];

export const mockSummary: ContractSummary = {
  contractPurpose:
    "Establishes a master supply agreement under which Northwind Supply Co. will manufacture and deliver components to the Client on an ongoing purchase-order basis.",
  parties: ["Northwind Supply Co. (\"Supplier\")", "Aster Manufacturing Inc. (\"Client\")"],
  duration: "24 months from the effective date, auto-renewing for successive 12-month terms unless either party gives 60 days' notice.",
  paymentTerms: "Net 30 from invoice date, with a 1.5% monthly late fee on overdue balances.",
  keyObligations: [
    "Supplier maintains ISO 9001 certification throughout the term.",
    "Client provides rolling 90-day demand forecasts.",
    "Supplier delivers within 15 business days of purchase order confirmation.",
  ],
  terminationConditions: "Either party may terminate for uncured material breach after a 30-day cure period, or for convenience with 90 days' written notice.",
  importantClauses: ["Limitation of Liability", "Indemnification", "Confidentiality", "Governing Law — Delaware"],
};

export const mockClauses: Clause[] = [
  { chunkIndex: 2, pageNumber: 3, heading: null, text: "Each party agrees to hold the other's confidential information in strict confidence and not disclose it to any third party without prior written consent.", category: "Confidentiality", confidence: 0.97 },
  { chunkIndex: 6, pageNumber: 11, heading: null, text: "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.", category: "Governing Law", confidence: 0.96 },
  { chunkIndex: 4, pageNumber: 6, heading: null, text: "Client may terminate this Agreement at any time, for any reason, upon fifteen (15) days' written notice. Supplier may only terminate for uncured material breach.", category: "Termination", confidence: 0.95 },
  { chunkIndex: 1, pageNumber: 2, heading: null, text: "Client shall pay all undisputed invoices within thirty (30) days of receipt. Amounts unpaid after the due date accrue interest at 1.5% per month.", category: "Payment", confidence: 0.93 },
  { chunkIndex: 3, pageNumber: 5, heading: null, text: "Supplier shall indemnify, defend, and hold harmless Client from any and all claims, damages, and liabilities arising from Supplier's performance under this Agreement, without limitation.", category: "Indemnification", confidence: 0.91 },
  { chunkIndex: 5, pageNumber: 9, heading: null, text: "All intellectual property developed by Supplier in the course of performing services shall be the sole and exclusive property of Client.", category: "Intellectual Property", confidence: 0.89 },
  { chunkIndex: 0, pageNumber: 1, heading: null, text: "This Master Supply Agreement (\"Agreement\") is entered into between Northwind Supply Co. and Aster Manufacturing Inc.", category: "Other", confidence: 0.4 },
];

export const mockRisks: RiskFinding[] = [
  {
    id: "r1",
    title: "One-sided termination rights",
    severity: "High",
    explanation: "Client can terminate for any reason with only 15 days' notice, while Supplier can only terminate for uncured material breach — creating a significant imbalance in exit rights.",
    evidence: "Client may terminate this Agreement at any time, for any reason, upon fifteen (15) days' written notice. Supplier may only terminate for uncured material breach.",
    pageNumber: 6,
    section: "Termination",
  },
  {
    id: "r2",
    title: "Broad indemnification",
    severity: "Critical",
    explanation: "The indemnification obligation on Supplier is uncapped and covers \"any and all\" claims, with no carve-outs for Client's own negligence.",
    evidence: "Supplier shall indemnify, defend, and hold harmless Client from any and all claims, damages, and liabilities arising from Supplier's performance under this Agreement, without limitation.",
    pageNumber: 5,
    section: "Indemnification",
  },
  {
    id: "r3",
    title: "Unfavorable IP ownership",
    severity: "Medium",
    explanation: "All IP developed during performance transfers to Client outright, with no license-back for Supplier's pre-existing tools or methods.",
    evidence: "All intellectual property developed by Supplier in the course of performing services shall be the sole and exclusive property of Client.",
    pageNumber: 9,
    section: "Intellectual Property",
  },
  {
    id: "r4",
    title: "Unusual notice period",
    severity: "Low",
    explanation: "The 15-day termination notice for Client is shorter than the 30-day industry norm, giving Supplier little time to plan for the loss of the contract.",
    evidence: "...upon fifteen (15) days' written notice.",
    pageNumber: 6,
    section: "Termination",
  },
];

export const mockObligations: Obligation[] = [
  { responsibleParty: "Supplier", obligation: "Deliver products", deadline: "Within 15 business days of purchase order confirmation", section: null, pageNumber: 4 },
  { responsibleParty: "Supplier", obligation: "Maintain ISO 9001 certification", deadline: "Throughout the term", section: null, pageNumber: 3 },
  { responsibleParty: "Client", obligation: "Provide rolling demand forecasts", deadline: "Every 90 days", section: null, pageNumber: 4 },
  { responsibleParty: "Client", obligation: "Pay undisputed invoices", deadline: "Within 30 days of receipt", section: "Payment", pageNumber: 2 },
  { responsibleParty: "Supplier", obligation: "Indemnify Client for performance-related claims", deadline: null, section: "Indemnification", pageNumber: 5 },
];

export const mockDeadlines: DeadlinesSummary = {
  contractStartDate: "March 1, 2026",
  contractEndDate: "February 28, 2028",
  renewalDate: "Auto-renews for 12-month terms unless notice is given 60 days prior to expiration",
  terminationNoticePeriod: "15 days (Client) / 30-day cure period (Supplier)",
  paymentDeadlines: [{ description: "Standard invoice payment", dateOrTimeframe: "Net 30", pageNumber: 2 }],
  deliveryDeadlines: [{ description: "Product delivery after PO confirmation", dateOrTimeframe: "15 business days", pageNumber: 4 }],
  otherDates: [{ description: "Demand forecast submission", dateOrTimeframe: "Every 90 days", pageNumber: 4 }],
};

export const mockChatMessages: ChatMessageData[] = [
  { id: "m1", role: "user", text: "How many days' notice does the Client need to terminate this agreement?" },
  {
    id: "m2",
    role: "assistant",
    text: "The Client may terminate the Agreement for any reason with 15 days' written notice. The Supplier, by contrast, may only terminate for an uncured material breach.",
    sources: [{ pageNumber: 6, heading: "Termination" }],
  },
  { id: "m3", role: "user", text: "Is there a cap on Supplier's indemnification liability?" },
  {
    id: "m4",
    role: "assistant",
    text: "No. The indemnification clause states Supplier will indemnify Client from any and all claims and liabilities \"without limitation,\" meaning there is no stated cap.",
    sources: [{ pageNumber: 5, heading: "Indemnification" }],
  },
];

export const mockChanges: ChangeItem[] = [
  {
    id: "ch1",
    changeType: "MODIFIED",
    section: "Payment",
    pageNumberA: 2,
    pageNumberB: 2,
    textA: "Client shall pay all undisputed invoices within fifteen (15) days of receipt.",
    textB: "Client shall pay all undisputed invoices within thirty (30) days of receipt.",
  },
  {
    id: "ch2",
    changeType: "ADDED",
    section: "Data Protection",
    pageNumberA: null,
    pageNumberB: 7,
    textA: null,
    textB: "Supplier shall implement industry-standard safeguards for any personal data processed under this Agreement.",
  },
  {
    id: "ch3",
    changeType: "REMOVED",
    section: "Exclusivity",
    pageNumberA: 6,
    pageNumberB: null,
    textA: "Client agrees to source components exclusively from Supplier for the duration of this Agreement.",
    textB: null,
  },
];

export const mockAiChangeSummary =
  "The revised agreement extends the Client's payment window from 15 to 30 days, adds a new data-protection clause covering personal data handling, and removes the exclusivity commitment — meaning Client is no longer required to source exclusively from Supplier.";
