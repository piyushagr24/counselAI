import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, ChevronDown, Sparkles, Scale, RotateCcw, BookOpen, FileText } from "lucide-react";
import ChatMessage from "../components/ChatMessage";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { askQuestion, getContracts } from "../services/api";
import type { ChatMessageData, ContractMetadata } from "../types";
import { LoadingState } from "../components/LoadingState";

const GENERAL_SUGGESTIONS = [
  "What is an indemnification clause and why is it important?",
  "What is the difference between an NDA and a Confidentiality Agreement?",
  "Explain liquidated damages vs penalties in contract law.",
  "What are high-risk liability clauses to watch out for?",
  "How does governing law affect contract disputes?",
];

const CONTRACT_SUGGESTIONS = [
  "What is the commercial purpose of this contract?",
  "What are the high-risk clauses or liabilities?",
  "What are the key payment terms and deadlines?",
  "How can this agreement be terminated?",
  "What law governs this contract?",
];

const GENERAL_ID = "general";

export default function AskAIPage() {
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get("q");
  const urlContract = searchParams.get("contract");

  const [contracts, setContracts] = useState<ContractMetadata[]>([]);
  const [contractsLoaded, setContractsLoaded] = useState(false);
  const [selectedContract, setSelectedContract] = useState(urlContract || GENERAL_ID);
  const [conversations, setConversations] = useState<Record<string, ChatMessageData[]>>({});
  const [draft, setDraft] = useState(urlQuery || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getContracts()
      .then((items) => {
        setContracts(items);
        if (urlContract && (urlContract === GENERAL_ID || items.some((i) => i.contract_id === urlContract))) {
          setSelectedContract(urlContract);
        } else if (items.length > 0 && !urlContract) {
          setSelectedContract(items[0].contract_id);
        } else {
          setSelectedContract(GENERAL_ID);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load contracts."))
      .finally(() => setContractsLoaded(true));
  }, [urlContract]);

  useEffect(() => {
    if (urlQuery) {
      setDraft(urlQuery);
    }
  }, [urlQuery]);

  const messages = conversations[selectedContract] ?? [];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const clearChat = () => {
    setConversations((prev) => ({
      ...prev,
      [selectedContract]: [],
    }));
    setError(null);
  };

  const send = async (customPrompt?: string, customHistory?: ChatMessageData[]) => {
    const question = (customPrompt || draft).trim();
    if (!question) return;
    setDraft("");

    const userMessage: ChatMessageData = {
      id: `${Date.now()}-q`,
      role: "user",
      text: question,
    };

    const baseHistory = customHistory !== undefined ? customHistory : (conversations[selectedContract] ?? []);
    const updatedMessages = [...baseHistory, userMessage];

    setConversations((prev) => ({
      ...prev,
      [selectedContract]: updatedMessages,
    }));
    setLoading(true);
    setError(null);

    try {
      // Send up to 20 past messages for multi-turn conversational memory
      const historyPayload = baseHistory.slice(-20).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const answer = await askQuestion(selectedContract, question, historyPayload);
      const assistantMessage: ChatMessageData = {
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
      };

      setConversations((prev) => ({
        ...prev,
        [selectedContract]: [...(prev[selectedContract] ?? []), assistantMessage],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to answer question.");
    } finally {
      setLoading(false);
    }
  };

  const handleReanswer = async (assistantMsg: ChatMessageData) => {
    const currentHistory = conversations[selectedContract] ?? [];
    const idx = currentHistory.findIndex((m) => m.id === assistantMsg.id);
    if (idx <= 0) return;
    const precedingUserMsg = currentHistory[idx - 1];
    if (!precedingUserMsg || precedingUserMsg.role !== "user") return;

    // Rollback history to before this Q&A pair and re-send
    const historyBefore = currentHistory.slice(0, idx - 1);
    setConversations((prev) => ({
      ...prev,
      [selectedContract]: historyBefore,
    }));

    await send(precedingUserMsg.text, historyBefore);
  };

  const isGeneralMode = selectedContract === GENERAL_ID;
  const currentContractObj = contracts.find((c) => c.contract_id === selectedContract);
  const suggestions = isGeneralMode ? GENERAL_SUGGESTIONS : CONTRACT_SUGGESTIONS;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedContract}
              onChange={(e) => setSelectedContract(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-ink-900 outline-none shadow-sm cursor-pointer hover:border-slate-300 transition-colors"
            >
              <option value={GENERAL_ID}>⚖️ Legal AI Copilot (General Consultation)</option>
              {contracts.length > 0 && (
                <optgroup label="Uploaded Contracts">
                  {contracts.map((contract) => (
                    <option key={contract.contract_id} value={contract.contract_id}>
                      📄 {contract.filename}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          {!isGeneralMode && currentContractObj && (
            <span className="text-xs text-slate-500">
              {currentContractObj.num_pages ?? "—"} pages
            </span>
          )}

          {isGeneralMode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-700">
              <BookOpen size={11} /> General Mode
            </span>
          )}

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              title="Reset conversation memory"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors ml-2 px-2 py-1 rounded hover:bg-slate-100"
            >
              <RotateCcw size={12} /> Clear Chat
            </button>
          )}
        </div>

        <div className="max-w-md">
          <DisclaimerBanner compact />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-risk-high/20 bg-risk-high/5 px-4 py-3 text-sm text-risk-high">
          {error}
        </div>
      )}

      {!contractsLoaded && !error ? (
        <LoadingState label="Loading assistant…" />
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-600 mb-3">
                  {isGeneralMode ? <Scale size={24} /> : <FileText size={24} />}
                </span>
                <h3 className="font-medium text-ink-900">
                  {isGeneralMode ? "Legal AI Copilot" : "Contract AI Copilot"}
                </h3>
                <p className="mt-1 max-w-md text-xs text-slate-500">
                  {isGeneralMode
                    ? "Ask any legal questions, explore contractual concepts, get drafting guidance, or seek legal clarifications with multi-turn memory."
                    : "Ask specific questions about clauses, deadlines, financial exposure, or potential risks in the selected contract."}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
                  {suggestions.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => void send(prompt)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-accent-600 hover:text-accent-700 transition-colors shadow-sm text-left"
                    >
                      <Sparkles size={11} className="inline mr-1 text-accent-500 shrink-0" />
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
                  isBusy={loading}
                />
              ))
            )}
            {loading && <LoadingState label="Legal AI Copilot is thinking…" />}
            <div ref={chatBottomRef} />
          </div>

          <div className="border-t border-slate-200 p-4 bg-slate-50/50">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-accent-600 transition-colors">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void send()}
                placeholder={
                  isGeneralMode
                    ? "Ask any legal question, concept, or drafting advice…"
                    : "Ask about this contract, clauses, or legal concepts…"
                }
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
              <button
                onClick={() => void send()}
                disabled={loading || !draft.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-600 text-white hover:bg-accent-700 disabled:opacity-40 transition-opacity"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {isGeneralMode
                ? "Legal AI Copilot provides general legal guidance, contract concepts, and conversational assistance."
                : "Answers are grounded in the selected contract with clause and page citations, plus general legal explanations."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
