import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileStack, ShieldAlert, CalendarClock, ListChecks, ArrowRight, Sparkles } from "lucide-react";
import StatCard from "../components/StatCard";
import ContractCard from "../components/ContractCard";
import { getContracts, getDashboardStats } from "../services/api";
import type { Contract, ContractMetadata, DashboardStats } from "../types";
import { LoadingState } from "../components/LoadingState";

export default function DashboardPage() {
  const [contracts, setContracts] = useState<ContractMetadata[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getContracts().then(setContracts).catch(() => []),
      getDashboardStats().then(setStats).catch(() => null),
    ]).finally(() => setLoading(false));
  }, []);

  const display: Contract[] = contracts.map((item) => ({
    id: item.contract_id,
    filename: item.filename,
    uploadDate: new Date(item.upload_date).toLocaleDateString(),
    pages: item.num_pages ?? 0,
    status: "ready",
    riskCount: item.risk_count ?? 0,
    highRiskCount: item.high_risk_count ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contracts analyzed" value={stats ? stats.total_contracts : contracts.length} icon={FileStack} />
        <StatCard
          label="High-risk clauses"
          value={stats ? stats.high_risk_count : (loading ? "…" : 0)}
          icon={ShieldAlert}
          tone="warning"
        />
        <StatCard
          label="Upcoming deadlines"
          value={stats ? stats.total_deadlines : (loading ? "…" : 0)}
          icon={CalendarClock}
        />
        <StatCard
          label="Open obligations"
          value={stats ? stats.total_obligations : (loading ? "…" : 0)}
          icon={ListChecks}
        />
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-card border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-ink-900">Recent contracts</h2>
              <Link to="/contracts" className="flex items-center gap-1 text-sm font-medium text-accent-600 hover:text-accent-700">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {display.slice(0, 4).map((contract) => (
                <ContractCard key={contract.id} contract={contract} />
              ))}
              {!display.length && (
                <p className="text-sm text-slate-500">No contracts uploaded yet.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-card border border-slate-200 bg-white p-5 shadow-card">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-accent-600" />
                <h2 className="font-medium text-ink-900">Risk & Compliance Posture</h2>
              </div>
              {stats && stats.total_risks > 0 ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-risk-high/5 p-3 text-sm text-risk-high border border-risk-high/20">
                    <p className="font-medium">{stats.high_risk_count} Critical or High Risks</p>
                    <p className="text-xs text-slate-600 mt-1">Requires immediate legal counsel review.</p>
                  </div>
                  <p className="text-sm text-slate-600">
                    {stats.total_risks} total risk flags detected across your contracts.
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Open any contract analysis to calculate grounded risk findings, obligations, and deadlines.
                </p>
              )}
            </div>
            <div className="mt-6 border-t border-slate-100 pt-4">
              <Link
                to="/contracts"
                className="block text-center rounded-lg bg-slate-50 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Inspect Contracts →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
