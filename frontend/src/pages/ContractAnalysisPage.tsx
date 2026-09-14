import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Send,
  FileText,
  Users,
  Clock,
  Wallet,
  ListChecks,
  Gavel,
  ShieldAlert,
  Download,
  RefreshCw,
  Trash2,
  Scale,
  Calendar,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  Copy,
  Check,
  Search,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import RiskCard from "../components/RiskCard";
import ClauseCard from "../components/ClauseCard";
import DeadlineCard from "../components/DeadlineCard";
import ChatMessage from "../components/ChatMessage";
import DisclaimerBanner from "../components/DisclaimerBanner";
import EmptyState from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import Button from "../components/ui/Button";
import { exportToPdf, exportToDocx, exportToMarkdown } from "../utils/reportExporter";
import {
  askQuestion,
  deleteContract,
  getClauses,
  getContract,
  getDeadlines,
  getObligations,
  getRisks,
  getSummary,
} from "../services/api";
import type { ChatMessageData, Clause, ContractDetails, DateItem, Obligation, RiskFinding } from "../types";
import type { ApiDeadlinesResponse, ApiSummaryResponse } from "../types";

type Tab = "overview" | "summary" | "clauses" | "risks" | "obligations" | "deadlines" | "ask";

const SUGGESTED_PROMPTS = [
  "What is the commercial purpose of this contract?",
  "What are the high-risk clauses or liabilities?",
  "What are my key payment terms and deadlines?",
  "How and when can this agreement be terminated?",
  "What is the governing law and dispute venue?",
];

export default function ContractAnalysisPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [contract, setContract] = useState<ContractDetails | null>(null);
  const [summary, setSummary] = useState<ApiSummaryResponse | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [risks, setRisks] = useState<RiskFinding[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [deadlines, setDeadlines] = useState<ApiDeadlinesResponse["deadlines"] | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [draft, setDraft] = useState("");
  const [tabLoading, setTabLoading] = useState<Partial<Record<Tab, boolean>>>({});
  const [tabErrors, setTabErrors] = useState<Partial<Record<Tab, string>>>({});
  const [loadedTabs, setLoadedTabs] = useState<Partial<Record<Tab, boolean>>>({});
  const [forceLoading, setForceLoading] = useState<Partial<Record<Tab, boolean>>>({});
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportedToast, setExportedToast] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "docx" | "md" | null>(null);

  // Filter states
  const [clauseCategory, setClauseCategory] = useState("all");
  const [clauseQuery, setClauseQuery] = useState("");
  const [obligationParty, setObligationParty] = useState("all");
  const [obligationPriority, setObligationPriority] = useState("all");
  const [obligationQuery, setObligationQuery] = useState("");

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef<Set<Tab>>(new Set());
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const isTabCached = (t: Tab, details: ContractDetails | null): boolean => {
    if (!details) return false;
    if (t === "summary") return !!details.has_summary;
    if (t === "clauses") return !!details.has_clauses;
    if (t === "risks") return !!details.has_risks;
    if (t === "obligations") return !!details.has_obligations;
    if (t === "deadlines") return !!details.has_deadlines;
    return false;
  };

  const getLoadingLabel = (t: Tab): string => {
    if (forceLoading[t]) {
      if (t === "risks") return "Auditing risks & liabilities with Counsel AI…";
      if (t === "summary") return "Analyzing contract summary with Counsel AI…";
      if (t === "clauses") return "Extracting and categorizing clauses with Counsel AI…";
      if (t === "obligations") return "Extracting contract obligations with Counsel AI…";
      if (t === "deadlines") return "Extracting deadlines & dates with Counsel AI…";
      return `Analyzing ${t} with Counsel AI…`;
    }
    if (isTabCached(t, contract)) {
      return `Loading cached ${t}…`;
    }
    if (t === "risks") return "Auditing risks & liabilities with Counsel AI…";
    if (t === "summary") return "Analyzing contract summary with Counsel AI…";
    if (t === "clauses") return "Extracting and categorizing clauses with Counsel AI…";
    if (t === "obligations") return "Extracting contract obligations with Counsel AI…";
    if (t === "deadlines") return "Extracting deadlines & dates with Counsel AI…";
    return `Analyzing ${t} with Counsel AI…`;
  };

  const loading = activeTab === "ask" ? chatLoading : !!tabLoading[activeTab];
  const loadingLabel = getLoadingLabel(activeTab);

  useEffect(() => {
    if (!id) return;
    void getContract(id)
      .then((data) => {
        setContract(data);
        // Pre-fetch cached analysis immediately for the Overview tab without triggering LLM
        if (data.has_summary) {
          inFlightRef.current.add("summary");
          setTabLoading((prev) => ({ ...prev, summary: true }));
          void getSummary(id, false)
            .then((res) => {
              setSummary(res);
              setLoadedTabs((prev) => ({ ...prev, summary: true }));
            })
            .catch(() => {})
            .finally(() => {
              inFlightRef.current.delete("summary");
              setTabLoading((prev) => ({ ...prev, summary: false }));
            });
        }
        if (data.has_risks) {
          inFlightRef.current.add("risks");
          setTabLoading((prev) => ({ ...prev, risks: true }));
          void getRisks(id, false)
            .then((res) => {
              setRisks(
                (res.risks || []).map((risk, index) => ({
                  id: `${id}-${index}`,
                  title: risk.title,
                  severity: risk.severity,
                  explanation: risk.explanation,
                  evidence: risk.evidence,
                  pageNumber: risk.page_number,
                  section: risk.section,
                  recommendation: risk.recommendation,
                  category: risk.category,
                }))
              );
              setLoadedTabs((prev) => ({ ...prev, risks: true }));
            })
            .catch(() => {})
            .finally(() => {
              inFlightRef.current.delete("risks");
              setTabLoading((prev) => ({ ...prev, risks: false }));
            });
        }
        if (data.has_obligations) {
          inFlightRef.current.add("obligations");
          setTabLoading((prev) => ({ ...prev, obligations: true }));
          void getObligations(id, false)
            .then((res) => {
              setObligations(
                (res.obligations || []).map((o) => ({
                  responsibleParty: o.responsible_party,
                  obligation: o.obligation,
                  deadline: o.deadline,
                  section: o.section,
                  pageNumber: o.page_number,
                  category: o.category,
                  priority: o.priority,
                }))
              );
              setLoadedTabs((prev) => ({ ...prev, obligations: true }));
            })
            .catch(() => {})
            .finally(() => {
              inFlightRef.current.delete("obligations");
              setTabLoading((prev) => ({ ...prev, obligations: false }));
            });
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load contract."));
  }, [id]);

  const loadTabData = async (tab: Tab, force = false) => {
    if (!id || tab === "overview" || tab === "ask") return;
    if (inFlightRef.current.has(tab) && !force) return;

    inFlightRef.current.add(tab);
    setTabLoading((prev) => ({ ...prev, [tab]: true }));
    if (force) {
      setForceLoading((prev) => ({ ...prev, [tab]: true }));
    }
    setTabErrors((prev) => ({ ...prev, [tab]: undefined }));

    try {
      if (tab === "summary") {
        const res = await getSummary(id, force);
        setSummary(res);
        setContract((prev) => (prev && !prev.has_summary ? { ...prev, has_summary: true } : prev));
        setLoadedTabs((prev) => ({ ...prev, summary: true }));
      } else if (tab === "clauses") {
        const res = await getClauses(id, force);
        setClauses(
          (res.clauses || []).map((c) => ({
            chunkIndex: c.chunk_index,
            pageNumber: c.page_number,
            heading: c.heading,
            text: c.text,
            category: c.category,
            confidence: c.confidence,
          }))
        );
        setContract((prev) => (prev && !prev.has_clauses ? { ...prev, has_clauses: true } : prev));
        setLoadedTabs((prev) => ({ ...prev, clauses: true }));
      } else if (tab === "risks") {
        const res = await getRisks(id, force);
        setRisks(
          (res.risks || []).map((risk, index) => ({
            id: `${id}-${index}`,
            title: risk.title,
            severity: risk.severity,
            explanation: risk.explanation,
            evidence: risk.evidence,
            pageNumber: risk.page_number,
            section: risk.section,
            recommendation: risk.recommendation,
            category: risk.category,
          }))
        );
        setContract((prev) => (prev && !prev.has_risks ? { ...prev, has_risks: true } : prev));
        setLoadedTabs((prev) => ({ ...prev, risks: true }));
      } else if (tab === "obligations") {
        const res = await getObligations(id, force);
        setObligations(
          (res.obligations || []).map((o) => ({
            responsibleParty: o.responsible_party,
            obligation: o.obligation,
            deadline: o.deadline,
            section: o.section,
            pageNumber: o.page_number,
            category: o.category,
            priority: o.priority,
          }))
        );
        setContract((prev) => (prev && !prev.has_obligations ? { ...prev, has_obligations: true } : prev));
        setLoadedTabs((prev) => ({ ...prev, obligations: true }));
      } else if (tab === "deadlines") {
        const res = await getDeadlines(id, force);
        setDeadlines(res.deadlines);
        setContract((prev) => (prev && !prev.has_deadlines ? { ...prev, has_deadlines: true } : prev));
        setLoadedTabs((prev) => ({ ...prev, deadlines: true }));
      }
    } catch (err) {
      setTabErrors((prev) => ({
        ...prev,
        [tab]: err instanceof Error ? err.message : "Unable to load analysis.",
      }));
      setLoadedTabs((prev) => ({ ...prev, [tab]: true }));
    } finally {
      inFlightRef.current.delete(tab);
      setTabLoading((prev) => ({ ...prev, [tab]: false }));
      if (force) {
        setForceLoading((prev) => ({ ...prev, [tab]: false }));
      }
    }
  };

  useEffect(() => {
    if (!id || !contract) return;
    if (activeTab === "overview" || activeTab === "ask") return;

    if (!loadedTabs[activeTab] && !inFlightRef.current.has(activeTab)) {
      void loadTabData(activeTab, false);
    }
  }, [activeTab, id, contract?.contract_id, loadedTabs]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const sendQuestion = async (customText?: string, customHistory?: ChatMessageData[]) => {
    const question = (customText || draft).trim();
    if (!question || !id) return;
    setDraft("");

    const baseHistory = customHistory !== undefined ? customHistory : messages;
    const newMessages: ChatMessageData[] = [
      ...baseHistory,
      { id: `${Date.now()}-q`, role: "user", text: question },
    ];
    setMessages(newMessages);
    setChatLoading(true);
    setError(null);

    try {
      const historyPayload = baseHistory.slice(-20).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const answer = await askQuestion(id, question, historyPayload);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-a`,
          role: "assistant",
          text: answer.answer,
          sources: answer.sources.map((s) => ({
            pageNumber: s.page_number,
            heading: s.heading,
            chunkIndex: s.chunk_index,
            distance: s.distance,
            text: s.text ?? undefined,
          })),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to answer question.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleReanswer = async (assistantMsg: ChatMessageData) => {
    const idx = messages.findIndex((m) => m.id === assistantMsg.id);
    if (idx <= 0) return;
    const precedingUserMsg = messages[idx - 1];
    if (!precedingUserMsg || precedingUserMsg.role !== "user") return;

    // Rollback history to before this Q&A pair and re-send
    const historyBefore = messages.slice(0, idx - 1);
    setMessages(historyBefore);
    await sendQuestion(precedingUserMsg.text, historyBefore);
  };

  const handleDeleteContract = async () => {
    if (!id || !contract) return;
    if (!window.confirm(`Delete contract "${contract.filename}"? All stored vectors and analysis results will be permanently removed.`)) {
      return;
    }
    try {
      await deleteContract(id);
      navigate("/contracts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete contract.");
    }
  };

  const handleExportReport = () => {
    if (!contract) return;
    const s = summary?.summary;
    const lines = [
      `# Executive Legal Contract Report: ${s?.title || contract.filename}`,
      "",
      `* **Generated Date:** ${new Date().toLocaleString()}`,
      `* **Contract Type:** ${s?.contract_type || "Commercial Contract"}`,
      `* **Overall Risk Assessment:** ${s?.overall_risk_score || "Unrated"}`,
      `* **Effective Date:** ${s?.effective_date || "Not specified"}`,
      `* **Expiration Date:** ${s?.expiration_date || "Not specified"}`,
      `* **Governing Law:** ${s?.governing_law_and_jurisdiction || "Not specified"}`,
      `* **Pages Extracted:** ${contract.num_pages ?? 1}`,
      `* **Contract ID:** \`${contract.contract_id}\``,
      "",
      "---",
      "",
      "## 1. Executive Summary",
      s?.executive_summary || s?.contract_purpose || "No summary available yet.",
      "",
      "### Key Commercial Terms",
      `- **Parties Involved:** ${s?.parties?.length ? s.parties.join(", ") : "Not specified"}`,
      `- **Duration & Term:** ${s?.duration || "Not specified"}`,
      `- **Financial & Payment Terms:** ${s?.financial_terms || s?.payment_terms || "Not specified"}`,
      `- **Dispute Resolution:** ${s?.dispute_resolution || "Not specified"}`,
      `- **Confidentiality:** ${s?.confidentiality_terms || "Not specified"}`,
      "",
      "### Liability & Termination Safeguards",
      `- **Termination Terms:** ${s?.termination_conditions || "Not specified"}`,
      `- **Liabilities & Indemnities:** ${s?.liability_and_indemnification || "Not specified"}`,
      "",
      "---",
      "",
      `## 2. Risk Assessment Findings (${risks.length} flagged)`,
      "",
    ];

    if (risks.length === 0) {
      lines.push("No notable legal or commercial risks flagged for this contract.");
    } else {
      risks.forEach((r, idx) => {
        lines.push(`### Risk ${idx + 1}: ${r.title} [${r.severity}]`);
        if (r.category) lines.push(`* **Category:** ${r.category}`);
        lines.push(`* **Location:** Page ${r.pageNumber ?? "N/A"} | Section: ${r.section ?? "N/A"}`);
        lines.push(`* **Explanation:** ${r.explanation}`);
        if (r.recommendation) lines.push(`* **Mitigation Recommendation:** ${r.recommendation}`);
        lines.push(`* **Evidence Quote:** > "${r.evidence}"`);
        lines.push("");
      });
    }

    lines.push("---", "", `## 3. Extracted Obligations (${obligations.length} tracked)`, "");
    if (obligations.length === 0) {
      lines.push("No distinct obligations extracted.");
    } else {
      lines.push("| Party | Category | Priority | Obligation | Deadline | Page |");
      lines.push("| :--- | :--- | :--- | :--- | :--- | :--- |");
      obligations.forEach((o) => {
        lines.push(
          `| ${o.responsibleParty ?? "—"} | ${o.category ?? "General"} | ${o.priority ?? "Standard"} | ${o.obligation.replace(/\|/g, "-")} | ${o.deadline ?? "—"} | ${o.pageNumber ?? "—"} |`
        );
      });
    }

    lines.push("", "---", "", "## 4. Deadlines & Milestones", "");
    if (deadlines) {
      lines.push(`* **Start Date:** ${deadlines.contract_start_date ?? "Not specified"}`);
      lines.push(`* **End Date:** ${deadlines.contract_end_date ?? "Not specified"}`);
      lines.push(`* **Renewal Terms:** ${deadlines.renewal_date ?? "Not specified"}`);
      lines.push(`* **Termination Notice Period:** ${deadlines.termination_notice_period ?? "Not specified"}`);
      if (deadlines.payment_deadlines?.length) {
        lines.push("", "### Payment Deadlines:");
        deadlines.payment_deadlines.forEach((p) => lines.push(`- ${p.description}: ${p.date_or_timeframe ?? "N/A"}`));
      }
    } else {
      lines.push("No deadlines loaded.");
    }

    lines.push(
      "",
      "---",
      "*Legal Disclaimer: This report was synthesized by Counsel AI for informational contract review. It does not constitute formal legal counsel.*"
    );

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contract.filename.replace(/\.[^/.]+$/, "")}_Executive_Analysis.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportedToast(true);
    setTimeout(() => setExportedToast(false), 3000);
  };

  if (!contract) return <LoadingState />;

  // Clause categories
  const clauseCategories = ["all", ...Array.from(new Set(clauses.map((c) => c.category))).filter(Boolean)];
  const filteredClauses = clauses.filter((c) => {
    const matchesCat = clauseCategory === "all" || c.category === clauseCategory;
    const matchesText =
      clauseQuery === "" ||
      c.text.toLowerCase().includes(clauseQuery.toLowerCase()) ||
      (c.heading && c.heading.toLowerCase().includes(clauseQuery.toLowerCase()));
    return matchesCat && matchesText;
  });

  // Obligation filters
  const obligationParties = ["all", ...Array.from(new Set(obligations.map((o) => o.responsibleParty))).filter(Boolean) as string[]];
  const filteredObligations = obligations.filter((o) => {
    const matchesParty = obligationParty === "all" || o.responsibleParty === obligationParty;
    const matchesPriority = obligationPriority === "all" || o.priority === obligationPriority;
    const matchesQuery =
      obligationQuery === "" ||
      o.obligation.toLowerCase().includes(obligationQuery.toLowerCase()) ||
      (o.category && o.category.toLowerCase().includes(obligationQuery.toLowerCase()));
    return matchesParty && matchesPriority && matchesQuery;
  });

  const deadlinesCount = deadlines
    ? (deadlines.payment_deadlines?.length ?? 0) +
      (deadlines.delivery_deadlines?.length ?? 0) +
      (deadlines.other_dates?.length ?? 0) +
      (deadlines.contract_start_date ? 1 : 0) +
      (deadlines.contract_end_date ? 1 : 0)
    : 0;

  const tabsConfig = [
    { key: "overview" as Tab, label: "Overview", count: null },
    { key: "summary" as Tab, label: "Executive Summary", count: null },
    { key: "clauses" as Tab, label: "Clauses", count: clauses.length || null },
    { key: "risks" as Tab, label: "Risks", count: risks.length || null, alert: risks.some((r) => r.severity === "High" || r.severity === "Critical") },
    { key: "obligations" as Tab, label: "Obligations", count: obligations.length || null },
    { key: "deadlines" as Tab, label: "Deadlines", count: deadlinesCount || null },
    { key: "ask" as Tab, label: "Ask AI", count: messages.length || null },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/contracts"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-ink-900 transition-colors mb-2"
          >
            <ArrowLeft size={14} /> Back to Contracts Vault
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600 shadow-xs">
              <FileText size={22} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink-900">{contract.filename}</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={10} /> Indexed & Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {contract.num_pages ?? 1} {contract.num_pages === 1 ? "page" : "pages"} · {(contract.size_bytes / 1024).toFixed(1)} KB · Uploaded {new Date(contract.upload_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {exportedToast && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg animate-in fade-in">
              <Check size={14} /> Report Exported!
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportReport}
            leftIcon={<Download size={14} />}
            title="Export complete analysis report as Markdown"
          >
            Export Executive Report
          </Button>

          {activeTab !== "overview" && activeTab !== "ask" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadTabData(activeTab, true)}
              disabled={!!tabLoading[activeTab]}
              leftIcon={<RefreshCw size={13} className={tabLoading[activeTab] ? "animate-spin" : ""} />}
              title="Force re-analyze this section"
            >
              Re-analyze
            </Button>
          )}

          <Button
            variant="danger"
            size="sm"
            onClick={() => void handleDeleteContract()}
            leftIcon={<Trash2 size={14} />}
            title="Delete this contract"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
        {tabsConfig.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-accent-600 text-accent-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-ink-900"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  tab.alert
                    ? "bg-risk-high/10 text-risk-high"
                    : activeTab === tab.key
                    ? "bg-accent-100 text-accent-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {(tabErrors[activeTab] || error) && (
        <div className="rounded-xl border border-risk-high/20 bg-risk-high/5 px-4 py-3 text-sm text-risk-high flex items-center justify-between">
          <span>{tabErrors[activeTab] || error}</span>
          <button
            onClick={() => {
              setTabErrors((prev) => ({ ...prev, [activeTab]: undefined }));
              setError(null);
            }}
            className="text-xs font-semibold text-risk-high underline hover:no-underline ml-4 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <Overview
          contract={contract}
          summary={summary}
          risks={risks}
          obligations={obligations}
          onLoadSummary={() => setActiveTab("summary")}
        />
      )}

      {/* Tab: Summary */}
      {activeTab === "summary" && (
        summary ? (
          <div className="space-y-4">
            {tabLoading.summary && (
              <div className="flex items-center gap-2 rounded-xl bg-accent-50/80 border border-accent-200 px-4 py-2.5 text-xs text-accent-800">
                <RefreshCw size={13} className="animate-spin text-accent-600" />
                <span>Refreshing executive summary with Counsel AI…</span>
              </div>
            )}
            <SummaryView summary={summary} />
          </div>
        ) : tabLoading.summary ? (
          <LoadingState label={getLoadingLabel("summary")} />
        ) : (
          <EmptyState
            icon={FileText}
            title="No executive summary generated"
            description="Click below to analyze and generate an executive summary."
            action={
              <Button size="sm" onClick={() => void loadTabData("summary", true)}>
                Generate Summary
              </Button>
            }
          />
        )
      )}

      {/* Tab: Clauses */}
      {activeTab === "clauses" && (
        clauses.length > 0 ? (
          <div className="space-y-4">
            {tabLoading.clauses && (
              <div className="flex items-center gap-2 rounded-xl bg-accent-50/80 border border-accent-200 px-4 py-2.5 text-xs text-accent-800">
                <RefreshCw size={13} className="animate-spin text-accent-600" />
                <span>Re-extracting clauses…</span>
              </div>
            )}
            {/* Clause Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 sm:max-w-xs focus-within:border-accent-600 focus-within:bg-white">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  value={clauseQuery}
                  onChange={(e) => setClauseQuery(e.target.value)}
                  placeholder="Filter clauses by keyword…"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {clauseCategories.slice(0, 6).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setClauseCategory(cat)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      clauseCategory === cat
                        ? "bg-ink-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat === "all" ? "All Categories" : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium px-1">
              Showing {filteredClauses.length} of {clauses.length} clauses
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredClauses.length ? (
                filteredClauses.map((clause) => <ClauseCard key={clause.chunkIndex} clause={clause} />)
              ) : (
                <div className="md:col-span-2">
                  <EmptyState
                    icon={FileText}
                    title="No matching clauses"
                    description="Try adjusting your keyword search or category filter."
                  />
                </div>
              )}
            </div>
          </div>
        ) : tabLoading.clauses ? (
          <LoadingState label={getLoadingLabel("clauses")} />
        ) : (
          <EmptyState
            icon={FileText}
            title="No clauses extracted"
            description="Click below to extract and classify contract clauses."
            action={
              <Button size="sm" onClick={() => void loadTabData("clauses", true)}>
                Extract Clauses
              </Button>
            }
          />
        )
      )}

      {/* Tab: Risks */}
      {activeTab === "risks" && (
        risks.length > 0 ? (
          <div className="flex flex-col gap-4">
            {tabLoading.risks && (
              <div className="flex items-center gap-2 rounded-xl bg-accent-50/80 border border-accent-200 px-4 py-2.5 text-xs text-accent-800">
                <RefreshCw size={13} className="animate-spin text-accent-600" />
                <span>Auditing risks & liabilities with Counsel AI…</span>
              </div>
            )}
            {risks.map((risk) => <RiskCard key={risk.id} risk={risk} />)}
          </div>
        ) : tabLoading.risks ? (
          <LoadingState label={getLoadingLabel("risks")} />
        ) : tabErrors.risks ? (
          <EmptyState
            icon={ShieldAlert}
            title="Failed to load risks"
            description={tabErrors.risks}
            action={
              <Button size="sm" onClick={() => void loadTabData("risks", true)}>
                Retry Risk Analysis
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ShieldAlert}
            title="No risks detected"
            description="No notable risks were returned for this contract."
            action={
              <Button size="sm" onClick={() => void loadTabData("risks", true)}>
                Analyze Risks
              </Button>
            }
          />
        )
      )}

      {/* Tab: Obligations */}
      {activeTab === "obligations" && (
        obligations.length > 0 ? (
          <div className="space-y-4">
            {tabLoading.obligations && (
              <div className="flex items-center gap-2 rounded-xl bg-accent-50/80 border border-accent-200 px-4 py-2.5 text-xs text-accent-800">
                <RefreshCw size={13} className="animate-spin text-accent-600" />
                <span>Extracting contract obligations…</span>
              </div>
            )}
            {/* Obligation Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 sm:max-w-xs focus-within:border-accent-600 focus-within:bg-white">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  value={obligationQuery}
                  onChange={(e) => setObligationQuery(e.target.value)}
                  placeholder="Search obligations…"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={obligationParty}
                  onChange={(e) => setObligationParty(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                >
                  <option value="all">All Parties</option>
                  {obligationParties.filter((p) => p !== "all").map((party) => (
                    <option key={party} value={party}>
                      {party}
                    </option>
                  ))}
                </select>

                <select
                  value={obligationPriority}
                  onChange={(e) => setObligationPriority(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                >
                  <option value="all">All Priorities</option>
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Standard">Standard</option>
                </select>
              </div>
            </div>

            <ObligationsView obligations={filteredObligations} />
          </div>
        ) : tabLoading.obligations ? (
          <LoadingState label={getLoadingLabel("obligations")} />
        ) : (
          <EmptyState
            icon={ListChecks}
            title="No obligations found"
            description="No obligations tracked yet for this contract."
            action={
              <Button size="sm" onClick={() => void loadTabData("obligations", true)}>
                Extract Obligations
              </Button>
            }
          />
        )
      )}

      {/* Tab: Deadlines */}
      {activeTab === "deadlines" && (
        deadlines ? (
          <div className="space-y-4">
            {tabLoading.deadlines && (
              <div className="flex items-center gap-2 rounded-xl bg-accent-50/80 border border-accent-200 px-4 py-2.5 text-xs text-accent-800">
                <RefreshCw size={13} className="animate-spin text-accent-600" />
                <span>Re-extracting deadlines & dates…</span>
              </div>
            )}
            <DeadlinesView deadlines={deadlines} />
          </div>
        ) : tabLoading.deadlines ? (
          <LoadingState label={getLoadingLabel("deadlines")} />
        ) : (
          <EmptyState
            icon={Calendar}
            title="No deadlines tracked"
            description="Click below to analyze and extract dates, renewals, and deadlines."
            action={
              <Button size="sm" onClick={() => void loadTabData("deadlines", true)}>
                Extract Deadlines
              </Button>
            }
          />
        )
      )}

      {/* Tab: Ask AI */}
      {activeTab === "ask" && (
        <div className="flex h-[620px] flex-col rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent-600" />
              <span className="text-xs font-semibold text-ink-900 uppercase tracking-wider">
                Legal AI Copilot
              </span>
            </div>
            <span className="text-xs text-slate-400">Grounded strictly in {contract.filename}</span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-600 mb-3 shadow-xs">
                  <Scale size={24} />
                </span>
                <h3 className="font-serif text-base font-semibold text-ink-900">
                  Ask AI anything about this contract
                </h3>
                <p className="mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
                  Legal AI Copilot provides authoritative answers grounded directly in the document text with interactive page citations.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => void sendQuestion(prompt)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-accent-500 hover:text-accent-700 hover:bg-accent-50/50 transition-all shadow-2xs"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onReanswer={handleReanswer}
                  isBusy={chatLoading}
                />
              ))
            )}
            {chatLoading && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 animate-pulse w-fit">
                <Sparkles size={14} className="animate-spin text-accent-600" />
                <span>Legal AI Copilot is reviewing contract text…</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="border-t border-slate-200 p-4 bg-white">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 focus-within:border-accent-600 focus-within:ring-2 focus-within:ring-accent-100 transition-all">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void sendQuestion()}
                placeholder="Ask about clauses, liabilities, deadlines, or risks…"
                className="w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-slate-400"
                disabled={chatLoading}
              />
              <button
                onClick={() => void sendQuestion()}
                disabled={chatLoading || !draft.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-600 text-white hover:bg-accent-700 disabled:opacity-40 transition-all shadow-xs"
              >
                <Send size={14} />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 text-center">
              Answers are grounded in contract vectors. Click citation badges to inspect verified text excerpts.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Overview({
  contract,
  summary,
  risks,
  obligations,
  onLoadSummary,
}: {
  contract: ContractDetails;
  summary: ApiSummaryResponse | null;
  risks: RiskFinding[];
  obligations: Obligation[];
  onLoadSummary: () => void;
}) {
  const s = summary?.summary;
  const numPages = contract.num_pages ?? (contract.num_segments ? Math.max(1, Math.ceil(contract.num_segments / 5)) : 1);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <OverviewCard icon={Users} label="Document Segments" value={`${contract.num_segments} indexed`} />
      <OverviewCard icon={Clock} label="Document Length" value={`${numPages} ${numPages === 1 ? "page" : "pages"}`} />
      <OverviewCard icon={ShieldAlert} label="Risks Flagged" value={`${risks.length || (s?.key_risks_summary?.length ?? "—")} findings`} />
      <OverviewCard icon={ListChecks} label="Obligations" value={`${obligations.length || (s?.key_obligations?.length ?? "—")} tracked`} />

      <div className="sm:col-span-2 lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent-600" />
            <h3 className="font-semibold text-ink-900">Executive Overview</h3>
          </div>
          {s?.overall_risk_score && <RiskBadge severity={s.overall_risk_score} />}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          {s?.executive_summary || s?.contract_purpose || "Generate the full executive summary to review key terms, governing law, and liabilities."}
        </p>
        <button onClick={onLoadSummary} className="mt-4 text-sm font-semibold text-accent-600 hover:text-accent-700">
          View full executive summary →
        </button>
      </div>

      <div className="sm:col-span-2 lg:col-span-4">
        <DisclaimerBanner compact />
      </div>
    </div>
  );
}

function SummaryView({ summary }: { summary: ApiSummaryResponse }) {
  const val = summary.summary;
  const [copied, setCopied] = useState(false);

  const handleCopySummary = () => {
    const text = val.executive_summary || val.contract_purpose || "";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Executive Hero Banner */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent-50 px-3 py-0.5 text-xs font-semibold text-accent-700 border border-accent-100">
                {val.contract_type || "Commercial Agreement"}
              </span>
              {val.overall_risk_score && <RiskBadge severity={val.overall_risk_score} />}
            </div>
            <h2 className="mt-2 text-xl font-bold text-ink-900">{val.title || "Contract Analysis"}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={handleCopySummary}
              leftIcon={copied ? <Check size={12} className="text-risk-low" /> : <Copy size={12} />}
            >
              {copied ? "Copied!" : "Copy Synthesis"}
            </Button>

            {val.effective_date && val.effective_date !== "Not specified in the contract." && (
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
                <Calendar size={13} className="text-accent-600" />
                <span>Effective: <strong>{val.effective_date}</strong></span>
              </div>
            )}
            {val.expiration_date && val.expiration_date !== "Not specified in the contract." && (
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
                <Clock size={13} className="text-slate-400" />
                <span>Expires: <strong>{val.expiration_date}</strong></span>
              </div>
            )}
            {val.governing_law_and_jurisdiction && val.governing_law_and_jurisdiction !== "Not specified in the contract." && (
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
                <Gavel size={13} className="text-slate-400" />
                <span>Law: <strong>{val.governing_law_and_jurisdiction}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Executive Narrative */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Executive Synthesis</h4>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
            {val.executive_summary || val.contract_purpose}
          </p>
        </div>

        {/* Key Red Flags Callout */}
        {val.key_risks_summary && val.key_risks_summary.length > 0 && (
          <div className="mt-5 rounded-xl border border-risk-high/20 bg-risk-high/5 p-4">
            <div className="flex items-center gap-2 text-risk-high font-semibold text-xs uppercase tracking-wider">
              <AlertTriangle size={15} />
              <span>Key Red Flags & Exposure Identified</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-xs sm:text-sm text-slate-700">
              {val.key_risks_summary.map((risk, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-risk-high font-bold">•</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Grid of structured terms */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SummaryBlock icon={Users} title="Parties Involved">
          <ul className="space-y-1">
            {val.parties.map((party) => (
              <li key={party} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />
                <span className="font-semibold text-ink-900">{party}</span>
              </li>
            ))}
          </ul>
        </SummaryBlock>

        <SummaryBlock icon={Clock} title="Term & Duration">
          <p>{val.duration}</p>
        </SummaryBlock>

        <SummaryBlock icon={Wallet} title="Commercial & Financial Terms">
          <p>{val.financial_terms || val.payment_terms}</p>
        </SummaryBlock>

        <SummaryBlock icon={ShieldCheck} title="Confidentiality & Data Protection">
          <p>{val.confidentiality_terms || "Standard confidentiality provisions apply."}</p>
        </SummaryBlock>

        <SummaryBlock icon={Gavel} title="Termination Grounds & Notice">
          <p>{val.termination_conditions}</p>
        </SummaryBlock>

        <SummaryBlock icon={ShieldAlert} title="Liabilities & Indemnification">
          <p>{val.liability_and_indemnification || "Standard mutual liability limitations apply."}</p>
        </SummaryBlock>

        <div className="lg:col-span-2">
          <SummaryBlock icon={ListChecks} title="Key Obligations">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {val.key_obligations.map((item, index) => (
                <div key={index} className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-700">
                  <span className="font-bold text-accent-600">•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </SummaryBlock>
        </div>

        <div className="lg:col-span-2">
          <SummaryBlock icon={FileText} title="Classified Legal Clauses">
            <div className="flex flex-wrap gap-2">
              {val.important_clauses.map((item) => (
                <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 shadow-2xs">
                  {item}
                </span>
              ))}
            </div>
          </SummaryBlock>
        </div>
      </div>
    </div>
  );
}

function ObligationsView({ obligations }: { obligations: Obligation[] }) {
  if (obligations.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No obligations matching filter"
        description="Try clearing your search query or party filters."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
            <tr>
              <th className="px-4 py-3">Party</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Obligation</th>
              <th className="px-4 py-3">Deadline</th>
              <th className="px-4 py-3">Page</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {obligations.map((item, index) => (
              <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 font-semibold text-ink-900 text-xs">{item.responsibleParty ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {item.category ?? "General"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      item.priority === "High"
                        ? "bg-risk-high/10 text-risk-high"
                        : item.priority === "Medium"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.priority ?? "Standard"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-700 leading-snug">{item.obligation}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{item.deadline ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{item.pageNumber ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeadlinesView({ deadlines }: { deadlines: ApiDeadlinesResponse["deadlines"] }) {
  const items: DateItem[] = [
    { description: "Contract start date", dateOrTimeframe: deadlines.contract_start_date, pageNumber: null },
    { description: "Contract end date", dateOrTimeframe: deadlines.contract_end_date, pageNumber: null },
    { description: "Renewal terms", dateOrTimeframe: deadlines.renewal_date, pageNumber: null },
    { description: "Termination notice period", dateOrTimeframe: deadlines.termination_notice_period, pageNumber: null },
    ...[...deadlines.payment_deadlines, ...deadlines.delivery_deadlines, ...deadlines.other_dates].map((item) => ({
      description: item.description,
      dateOrTimeframe: item.date_or_timeframe,
      pageNumber: item.page_number,
    })),
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item, index) => (
        <DeadlineCard key={index} item={item} />
      ))}
    </div>
  );
}

function OverviewCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
        <Icon size={15} />
      </span>
      <p className="mt-3 text-xs text-slate-500">{label}</p>
      <p className="text-sm font-bold text-ink-900">{value}</p>
    </div>
  );
}

function SummaryBlock({ icon: Icon, title, children }: { icon: typeof Users; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-accent-600" />
        <h3 className="font-semibold text-ink-900">{title}</h3>
      </div>
      <div className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}

function RiskBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    Low: "bg-risk-low/10 text-risk-low border-risk-low/20",
    Medium: "bg-amber-100 text-amber-800 border-amber-200",
    High: "bg-risk-high/10 text-risk-high border-risk-high/20",
    Critical: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[severity] || styles.Low}`}>
      <ShieldAlert size={12} />
      {severity} Risk Profile
    </span>
  );
}
