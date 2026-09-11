import { useEffect, useState } from "react";
import { GitCompare, Sparkles, Upload, FileText, ChevronDown } from "lucide-react";
import ComparisonResult from "../components/ComparisonResult";
import EmptyState from "../components/EmptyState";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { compareContracts, compareContractsById, getContracts } from "../services/api";
import type { ChangeItem, ContractMetadata } from "../types";

export default function ComparisonPage() {
  const [contracts, setContracts] = useState<ContractMetadata[]>([]);
  const [mode, setMode] = useState<"existing" | "upload">("existing");
  const [contractAId, setContractAId] = useState("");
  const [contractBId, setContractBId] = useState("");
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [summary, setSummary] = useState("");
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getContracts().then((items) => {
      setContracts(items);
      if (items.length >= 2) {
        setContractAId(items[0].contract_id);
        setContractBId(items[1].contract_id);
      } else if (items.length === 1) {
        setContractAId(items[0].contract_id);
        setMode("upload");
      } else {
        setMode("upload");
      }
    }).catch(() => undefined);
  }, []);

  const handleCompare = async () => {
    setError(null);
    setLoading(true);
    try {
      let result;
      if (mode === "existing") {
        if (!contractAId || !contractBId) {
          setError("Please select both contracts to compare.");
          setLoading(false);
          return;
        }
        if (contractAId === contractBId) {
          setError("Please select two different contracts to compare.");
          setLoading(false);
          return;
        }
        result = await compareContractsById(contractAId, contractBId);
      } else {
        if (!fileA || !fileB) {
          setError("Choose both contract files before comparing.");
          setLoading(false);
          return;
        }
        result = await compareContracts(fileA, fileB);
      }

      setSummary(result.ai_summary);
      setChanges(
        result.changes.map((item, index) => ({
          id: `${index}`,
          changeType: item.change_type,
          section: item.section,
          pageNumberA: item.page_number_a,
          pageNumberB: item.page_number_b,
          textA: item.text_a,
          textB: item.text_b,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to compare contracts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-medium text-ink-900">Compare two contract versions</h2>
            <p className="mt-1 text-sm text-slate-500">
              Detect modifications, additions, and deletions with AI change summaries.
            </p>
          </div>
          <div className="flex items-center rounded-lg bg-slate-100 p-1 text-xs font-medium">
            <button
              onClick={() => setMode("existing")}
              disabled={contracts.length < 2}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                mode === "existing"
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-slate-600 hover:text-ink-900 disabled:opacity-40"
              }`}
            >
              <FileText size={14} />
              Saved contracts ({contracts.length})
            </button>
            <button
              onClick={() => setMode("upload")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                mode === "upload" ? "bg-white text-ink-900 shadow-sm" : "text-slate-600 hover:text-ink-900"
              }`}
            >
              <Upload size={14} />
              Upload new files
            </button>
          </div>
        </div>

        {mode === "existing" ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Base Version (Contract A)</label>
              <div className="relative">
                <select
                  value={contractAId}
                  onChange={(e) => setContractAId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm text-ink-900 outline-none hover:border-slate-300"
                >
                  {contracts.map((c) => (
                    <option key={c.contract_id} value={c.contract_id}>
                      {c.filename} ({c.num_pages ?? "—"} pages)
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Revised Version (Contract B)</label>
              <div className="relative">
                <select
                  value={contractBId}
                  onChange={(e) => setContractBId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm text-ink-900 outline-none hover:border-slate-300"
                >
                  {contracts.map((c) => (
                    <option key={c.contract_id} value={c.contract_id}>
                      {c.filename} ({c.num_pages ?? "—"} pages)
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <button
              onClick={() => void handleCompare()}
              disabled={loading || !contractAId || !contractBId}
              className="flex items-center justify-center gap-2 rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-50"
            >
              <GitCompare size={15} />
              {loading ? "Comparing…" : "Compare"}
            </button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] items-end">
            <FilePicker label="Version A" file={fileA} onChange={setFileA} />
            <FilePicker label="Version B" file={fileB} onChange={setFileB} />
            <button
              onClick={() => void handleCompare()}
              disabled={loading || !fileA || !fileB}
              className="flex items-center justify-center gap-2 rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-50"
            >
              <GitCompare size={15} />
              {loading ? "Comparing…" : "Compare"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-risk-high/20 bg-risk-high/5 px-4 py-3 text-sm text-risk-high">
          {error}
        </div>
      )}

      {!summary && !loading ? (
        <EmptyState
          icon={GitCompare}
          title="Select two contracts to compare"
          description="Choose two contracts or upload two versions above and Counsel will highlight every modified, added, or deleted clause."
        />
      ) : (
        <>
          {summary && (
            <div className="rounded-card border border-accent-100 bg-accent-50 p-5">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-accent-600" />
                <h3 className="font-medium text-ink-900">AI change summary</h3>
              </div>
              <p className="mt-2 text-sm text-slate-700 leading-relaxed">{summary}</p>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {changes.map((change) => (
              <ComparisonResult key={change.id} change={change} />
            ))}
          </div>
          <DisclaimerBanner compact />
        </>
      )}
    </div>
  );
}

function FilePicker({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="file"
        accept=".pdf,.docx"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 cursor-pointer"
      />
      <span className="mt-1 block truncate text-xs text-slate-400">
        {file?.name ?? "No file selected"}
      </span>
    </label>
  );
}
