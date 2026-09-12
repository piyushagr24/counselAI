import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileStack,
  ShieldAlert,
  CalendarClock,
  ListChecks,
  ArrowRight,
  Sparkles,
  Plus,
  Search,
  X,
  Scale,
  RefreshCw,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  Send,
  AlertCircle,
} from "lucide-react";
import StatCard from "../components/StatCard";
import UploadZone from "../components/UploadZone";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import { getContracts, getDashboardStats, uploadContract } from "../services/api";
import type { ContractMetadata, DashboardStats } from "../types";

const SUGGESTED_LEGAL_PROMPTS = [
  "Show all contracts with uncapped indemnification",
  "What are the upcoming termination notice deadlines?",
  "Which agreements contain automatic renewal clauses?",
  "Summarize payment penalty & late fee terms",
  "Are there non-compete or exclusivity restrictions?",
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [contracts, setContracts] = useState<ContractMetadata[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // In-dashboard upload modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Filter & Search
  const [contractQuery, setContractQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [trackerTab, setTrackerTab] = useState<"deadlines" | "obligations">("deadlines");

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const [contractsData, statsData] = await Promise.all([
        getContracts().catch(() => []),
        getDashboardStats().catch(() => null),
      ]);
      setContracts(contractsData);
      setStats(statsData);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const userName = user?.name ? user.name.split(" ")[0] : "Counsel";

  // Filter recent contracts
  const filteredContracts = useMemo(() => {
    const q = contractQuery.trim().toLowerCase();
    if (!q) return contracts.slice(0, 5);
    return contracts.filter((c) => c.filename.toLowerCase().includes(q)).slice(0, 5);
  }, [contracts, contractQuery]);

  // Total pages
  const totalPages = useMemo(() => {
    if (stats?.total_pages) return stats.total_pages;
    return contracts.reduce((acc, c) => acc + (c.num_pages || 1), 0);
  }, [stats, contracts]);

  // Risk breakdown
  const criticalRisks = stats?.critical_risk_count ?? 0;
  const highRisks = stats?.high_risk_count ? Math.max(0, stats.high_risk_count - criticalRisks) : 0;
  const mediumRisks = stats?.medium_risk_count ?? 0;
  const lowRisks = stats?.low_risk_count ?? 0;
  const totalRisksCount = stats?.total_risks ?? (criticalRisks + highRisks + mediumRisks + lowRisks);

  // Portfolio Health Score calculation
  const portfolioHealth = useMemo(() => {
    if (contracts.length === 0) {
      return { score: 100, label: "Vault Empty", color: "text-slate-500", bg: "bg-slate-100", border: "border-slate-200" };
    }
    const severeCount = criticalRisks + highRisks;
    if (severeCount === 0) {
      return { score: 96, label: "Healthy Posture", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
    }
    if (severeCount <= 3) {
      return { score: 78, label: "Moderate Risk", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" };
    }
    return { score: 48, label: "Action Required", color: "text-risk-high", bg: "bg-risk-high/10", border: "border-risk-high/30" };
  }, [contracts.length, criticalRisks, highRisks]);

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    navigate(`/ask-ai?q=${encodeURIComponent(aiPrompt.trim())}`);
  };

  const handleChipClick = (prompt: string) => {
    navigate(`/ask-ai?q=${encodeURIComponent(prompt)}`);
  };

  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadContract(file);
      setIsUploadModalOpen(false);
      await loadData();
      navigate(`/contracts/${uploaded.contract_id}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload and analyze contract.");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Executive Welcome & Action Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink-900 font-serif">
              {greeting}, {userName}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${portfolioHealth.bg} ${portfolioHealth.color} border ${portfolioHealth.border}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {portfolioHealth.label}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Portfolio intelligence overview across {contracts.length} active agreements with {stats?.high_risk_count ?? 0} high/critical risk flags.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-ink-900 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh dashboard metrics"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin text-accent-600" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            to="/compare"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Scale size={14} className="text-slate-500" />
            <span>Compare</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-xs font-medium text-white hover:bg-ink-700 transition-colors shadow-sm"
          >
            <Plus size={15} />
            <span>Upload Contract</span>
          </button>
        </div>
      </div>

      {/* Enhanced KPI Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Contracts Analyzed"
          value={stats ? stats.total_contracts : contracts.length}
          icon={FileStack}
          hint={`${totalPages} total pages indexed in vault`}
        />
        <StatCard
          label="High-Risk Findings"
          value={stats ? stats.high_risk_count : 0}
          icon={ShieldAlert}
          tone={(stats?.high_risk_count ?? 0) > 0 ? "warning" : "default"}
          hint={
            criticalRisks > 0
              ? `${criticalRisks} critical · ${highRisks} high risk`
              : (stats?.high_risk_count ?? 0) > 0
              ? "Requires counsel review"
              : "No high risk flags detected"
          }
        />
        <StatCard
          label="Tracked Deadlines"
          value={stats ? stats.total_deadlines : 0}
          icon={CalendarClock}
          hint="Renewals, notices & payment terms"
        />
        <StatCard
          label="Active Obligations"
          value={stats ? stats.total_obligations : 0}
          icon={ListChecks}
          hint="Compliance & delivery commitments"
        />
      </div>

      {/* Interactive AI Copilot Quick Launcher */}
      <div className="rounded-2xl border border-accent-100 bg-gradient-to-r from-accent-50/70 via-white to-slate-50 p-5 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-600 text-white shadow-sm">
                <Sparkles size={15} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink-900">Ask Counsel AI Copilot</h3>
                <p className="text-xs text-slate-500">
                  Instant grounded legal answers synthesized across your contract repository
                </p>
              </div>
            </div>
            <Link
              to="/ask-ai"
              className="hidden sm:flex items-center gap-1 text-xs font-semibold text-accent-600 hover:text-accent-700"
            >
              Open Legal Chat <ArrowRight size={13} />
            </Link>
          </div>

          <form onSubmit={handleAiSubmit} className="relative mt-1">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Do we have uncapped liability in our Northwind contract? or List all renewal notice terms..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-24 text-sm text-ink-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-accent-600 focus:ring-2 focus:ring-accent-100"
            />
            <button
              type="submit"
              disabled={!aiPrompt.trim()}
              className="absolute right-2 top-2 flex items-center gap-1.5 rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-700 disabled:opacity-40"
            >
              <span>Ask</span>
              <Send size={12} />
            </button>
          </form>

          {/* Quick Legal Prompt Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-medium text-slate-400">Suggested queries:</span>
            {SUGGESTED_LEGAL_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleChipClick(prompt)}
                className="rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 shadow-xs text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Two-Column Intelligence Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2/3 width): Recent Contracts & Milestones Tracker */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Recent Contracts Vault */}
          <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-accent-600" />
                <h2 className="font-semibold text-ink-900">Recent Contracts</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {contracts.length}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={contractQuery}
                    onChange={(e) => setContractQuery(e.target.value)}
                    placeholder="Filter contracts…"
                    className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-ink-900 outline-none placeholder:text-slate-400 focus:border-accent-600 focus:bg-white focus:ring-1 focus:ring-accent-100 w-36 sm:w-48"
                  />
                  {contractQuery && (
                    <button
                      onClick={() => setContractQuery("")}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <Link
                  to="/contracts"
                  className="flex items-center gap-1 text-xs font-medium text-accent-600 hover:text-accent-700 shrink-0"
                >
                  View all <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* Contract List */}
            <div className="mt-4 flex flex-col divide-y divide-slate-100">
              {filteredContracts.length > 0 ? (
                filteredContracts.map((contract) => (
                  <div
                    key={contract.contract_id}
                    className="group flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-slate-50/80 rounded-lg px-2"
                  >
                    <Link
                      to={`/contracts/${contract.contract_id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-accent-50 group-hover:text-accent-600 transition-colors">
                        <FileText size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-ink-900 group-hover:text-accent-600 transition-colors">
                          {contract.filename}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {contract.num_pages ?? "—"} pages · Uploaded {new Date(contract.upload_date).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>

                    <div className="flex shrink-0 items-center gap-2.5 ml-12 sm:ml-0">
                      {(contract.high_risk_count ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-risk-high/10 px-2 py-0.5 text-[11px] font-medium text-risk-high border border-risk-high/20">
                          <AlertTriangle size={11} />
                          {contract.high_risk_count} critical/high
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={11} />
                          Clean
                        </span>
                      )}

                      <Link
                        to={`/ask-ai?contract=${contract.contract_id}`}
                        title="Ask AI about this contract"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-accent-50 hover:text-accent-600 transition-colors"
                      >
                        <MessageSquare size={15} />
                      </Link>

                      <Link
                        to={`/contracts/${contract.contract_id}`}
                        className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        <span>Analyze</span>
                        <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm font-medium text-slate-600">No contracts found</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {contractQuery ? "Try a different search query" : "Upload your first contract to begin analysis"}
                  </p>
                  {!contractQuery && (
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-ink-700"
                    >
                      <Plus size={13} /> Upload Now
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Deadlines & Priority Obligations Tracker */}
          <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTrackerTab("deadlines")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    trackerTab === "deadlines"
                      ? "bg-accent-50 text-accent-700 border border-accent-200"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <CalendarClock size={14} />
                  <span>Upcoming Deadlines</span>
                  {stats && stats.total_deadlines > 0 && (
                    <span className="rounded-full bg-white px-1.5 py-0.2 text-[10px] font-bold text-accent-700 shadow-xs">
                      {stats.total_deadlines}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setTrackerTab("obligations")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    trackerTab === "obligations"
                      ? "bg-accent-50 text-accent-700 border border-accent-200"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <ListChecks size={14} />
                  <span>Key Obligations</span>
                  {stats && stats.total_obligations > 0 && (
                    <span className="rounded-full bg-white px-1.5 py-0.2 text-[10px] font-bold text-accent-700 shadow-xs">
                      {stats.total_obligations}
                    </span>
                  )}
                </button>
              </div>

              <Link
                to="/contracts"
                className="text-xs font-medium text-accent-600 hover:text-accent-700 flex items-center gap-1"
              >
                Inspect Details <ArrowRight size={13} />
              </Link>
            </div>

            <div className="mt-4">
              {trackerTab === "deadlines" ? (
                /* Deadlines Feed */
                stats?.upcoming_deadlines && stats.upcoming_deadlines.length > 0 ? (
                  <div className="flex flex-col divide-y divide-slate-100">
                    {stats.upcoming_deadlines.slice(0, 5).map((dl, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-3 py-3 hover:bg-slate-50/50 rounded-lg px-1.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                            <Clock size={14} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-xs font-semibold text-ink-900">{dl.description}</p>
                              {dl.category && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600">
                                  {dl.category}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-accent-700 font-medium mt-0.5">
                              {dl.date_or_timeframe || "Per contract schedule"}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              From: {dl.contract_filename} {dl.page_number ? `· Page ${dl.page_number}` : ""}
                            </p>
                          </div>
                        </div>

                        <Link
                          to={`/contracts/${dl.contract_id}`}
                          className="shrink-0 text-[11px] font-medium text-slate-500 hover:text-accent-600 flex items-center gap-0.5 pt-0.5"
                        >
                          View <ChevronRight size={12} />
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    <CalendarClock size={24} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700">No deadline milestones extracted yet</p>
                    <p className="text-slate-400 mt-1 max-w-sm mx-auto">
                      Deadlines and renewal notice windows are automatically populated once you inspect any contract analysis.
                    </p>
                  </div>
                )
              ) : (
                /* Obligations Feed */
                stats?.recent_obligations && stats.recent_obligations.length > 0 ? (
                  <div className="flex flex-col divide-y divide-slate-100">
                    {stats.recent_obligations.slice(0, 5).map((ob, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-3 py-3 hover:bg-slate-50/50 rounded-lg px-1.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <ListChecks size={14} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {ob.responsible_party && (
                                <span className="rounded bg-ink-900/5 px-1.5 py-0.2 text-[10px] font-semibold text-ink-900 border border-ink-900/10">
                                  {ob.responsible_party}
                                </span>
                              )}
                              {ob.priority && (
                                <span
                                  className={`rounded px-1.5 py-0.2 text-[10px] font-medium ${
                                    ob.priority === "High"
                                      ? "bg-risk-high/10 text-risk-high"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {ob.priority} Priority
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-ink-900 mt-1 leading-snug">{ob.obligation}</p>
                            {ob.deadline && (
                              <p className="text-[11px] text-accent-700 mt-0.5 font-medium">Due: {ob.deadline}</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              From: {ob.contract_filename} {ob.page_number ? `· Page ${ob.page_number}` : ""}
                            </p>
                          </div>
                        </div>

                        <Link
                          to={`/contracts/${ob.contract_id}`}
                          className="shrink-0 text-[11px] font-medium text-slate-500 hover:text-accent-600 flex items-center gap-0.5 pt-0.5"
                        >
                          View <ChevronRight size={12} />
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    <ListChecks size={24} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700">No contractual obligations indexed yet</p>
                    <p className="text-slate-400 mt-1 max-w-sm mx-auto">
                      Obligations and party compliance commitments are mapped upon opening contract analysis.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1/3 width): Risk & Compliance Posture + Legal Toolkit */}
        <div className="flex flex-col gap-6">
          {/* Risk & Compliance Posture Card */}
          <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-risk-high" />
                <h2 className="font-semibold text-ink-900">Risk Posture</h2>
              </div>
              <span className="text-xs font-bold text-ink-900">{totalRisksCount} flags</span>
            </div>

            {/* Visual Risk Breakdown Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span>Severity Distribution</span>
                <span className="font-semibold text-ink-900">
                  {criticalRisks + highRisks} High Priority
                </span>
              </div>

              {/* Stacked Bar */}
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                {totalRisksCount > 0 ? (
                  <>
                    {criticalRisks > 0 && (
                      <div
                        style={{ width: `${(criticalRisks / totalRisksCount) * 100}%` }}
                        className="bg-risk-critical h-full"
                        title={`Critical: ${criticalRisks}`}
                      />
                    )}
                    {highRisks > 0 && (
                      <div
                        style={{ width: `${(highRisks / totalRisksCount) * 100}%` }}
                        className="bg-risk-high h-full"
                        title={`High: ${highRisks}`}
                      />
                    )}
                    {mediumRisks > 0 && (
                      <div
                        style={{ width: `${(mediumRisks / totalRisksCount) * 100}%` }}
                        className="bg-risk-medium h-full"
                        title={`Medium: ${mediumRisks}`}
                      />
                    )}
                    {lowRisks > 0 && (
                      <div
                        style={{ width: `${(lowRisks / totalRisksCount) * 100}%` }}
                        className="bg-risk-low h-full"
                        title={`Low: ${lowRisks}`}
                      />
                    )}
                  </>
                ) : (
                  <div className="w-full bg-emerald-500 h-full opacity-80" />
                )}
              </div>

              {/* Legend with exact numbers */}
              <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-risk-critical" />
                  <span>Critical: <strong>{criticalRisks}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-risk-high" />
                  <span>High: <strong>{highRisks}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-risk-medium" />
                  <span>Medium: <strong>{mediumRisks}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-risk-low" />
                  <span>Low: <strong>{lowRisks}</strong></span>
                </div>
              </div>
            </div>

            {/* Top Risk Alerts Feed */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-ink-900 uppercase tracking-wider">
                  Top Priority Risks
                </span>
                <Link to="/contracts" className="text-[11px] font-medium text-accent-600 hover:text-accent-700">
                  View all
                </Link>
              </div>

              {stats?.recent_risks && stats.recent_risks.length > 0 ? (
                <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {stats.recent_risks.slice(0, 4).map((risk, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 text-xs transition-colors hover:border-accent-200 hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                            risk.severity === "Critical"
                              ? "bg-risk-critical text-white"
                              : risk.severity === "High"
                              ? "bg-risk-high text-white"
                              : "bg-risk-medium text-white"
                          }`}
                        >
                          {risk.severity}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {risk.contract_filename}
                        </span>
                      </div>
                      <p className="mt-1.5 font-semibold text-ink-900 leading-snug">{risk.title}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 leading-normal">
                        {risk.explanation}
                      </p>
                      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
                        <span>{risk.section ? `Sec: ${risk.section}` : risk.page_number ? `Page ${risk.page_number}` : ""}</span>
                        <Link
                          to={`/contracts/${risk.contract_id}`}
                          className="font-medium text-accent-600 hover:underline"
                        >
                          Inspect Clause →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
                  <ShieldCheck size={20} className="mx-auto text-emerald-600 mb-1" />
                  <p className="font-medium text-ink-900">No Critical Risks Flagged</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Open any contract in the vault to generate detailed clause-level risk findings.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <Link
                to="/contracts"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-100 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <span>Browse Full Contract Vault</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          </div>

          {/* Quick Legal Toolkit Shortcuts */}
          <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="text-xs font-semibold text-ink-900 uppercase tracking-wider mb-3">
              Legal Productivity Suite
            </h3>
            <div className="flex flex-col gap-2">
              <Link
                to="/compare"
                className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5 transition-colors hover:border-accent-200 hover:bg-accent-50/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                  <Scale size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-900">Contract Comparison</p>
                  <p className="text-[10px] text-slate-500">Side-by-side diff & AI redline summary</p>
                </div>
              </Link>

              <Link
                to="/ask-ai"
                className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5 transition-colors hover:border-accent-200 hover:bg-accent-50/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Sparkles size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-900">Legal Assistant Q&A</p>
                  <p className="text-[10px] text-slate-500">Query your contracts with citations</p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 p-2.5 text-left transition-colors hover:border-accent-300 hover:bg-slate-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-900/5 text-ink-900">
                  <Plus size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-900">Upload New Agreement</p>
                  <p className="text-[10px] text-slate-500">Extract clauses, risks, and dates</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* In-Dashboard Quick Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white">
                  <Plus size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-ink-900">Upload & Analyze Contract</h3>
                  <p className="text-xs text-slate-500">PDF or DOCX format (up to 15MB)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isUploading && setIsUploadModalOpen(false)}
                disabled={isUploading}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {uploadError && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-risk-high/20 bg-risk-high/5 p-3 text-xs text-risk-high">
                <AlertCircle size={14} className="shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="mt-4">
              <UploadZone onFileSelected={handleUploadFile} disabled={isUploading} />
            </div>

            {isUploading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-accent-600">
                <RefreshCw size={14} className="animate-spin" />
                <span>Ingesting, segmenting and extracting clauses…</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
