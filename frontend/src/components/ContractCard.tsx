import { FileText, ChevronRight, Loader2, Trash2 } from "lucide-react";
import type { Contract } from "../types";
import { Link } from "react-router-dom";

const statusStyles: Record<Contract["status"], string> = {
  ready: "bg-risk-low/10 text-risk-low",
  processing: "bg-accent-50 text-accent-600",
  uploaded: "bg-slate-100 text-slate-500",
};

const statusLabel: Record<Contract["status"], string> = {
  ready: "Ready",
  processing: "Processing",
  uploaded: "Uploaded",
};

export default function ContractCard({
  contract,
  onDelete,
}: {
  contract: Contract;
  onDelete?: (id: string, event: React.MouseEvent) => void;
}) {
  return (
    <Link
      to={`/contracts/${contract.id}`}
      className="group flex items-center justify-between gap-4 rounded-card border border-slate-200 bg-white p-4 shadow-card transition-colors hover:border-accent-200 hover:shadow-sm"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 group-hover:bg-accent-50 group-hover:text-accent-600 transition-colors">
          <FileText size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-ink-900">{contract.filename}</p>
          <p className="text-xs text-slate-500">
            {contract.pages} pages · Uploaded {contract.uploadDate}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {contract.status === "ready" && contract.highRiskCount > 0 && (
          <span className="rounded-full bg-risk-high/10 px-2 py-0.5 text-xs font-medium text-risk-high">
            {contract.highRiskCount} critical/high risk
          </span>
        )}
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[contract.status]}`}
        >
          {contract.status === "processing" && <Loader2 size={12} className="animate-spin" />}
          {statusLabel[contract.status]}
        </span>
        {onDelete && (
          <button
            type="button"
            title="Delete contract"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(contract.id, e);
            }}
            className="rounded p-1.5 text-slate-400 opacity-80 hover:bg-risk-high/10 hover:text-risk-high transition-colors"
          >
            <Trash2 size={16} />
          </button>
        )}
        <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
    </Link>
  );
}
