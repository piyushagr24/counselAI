import { useState } from "react";
import { Scale, User, MapPin, X, Copy, Check, ExternalLink, FileText } from "lucide-react";
import type { ChatMessageData, ChatSource } from "../types";

function FormattedContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        // Header ###
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="font-semibold text-ink-900 pt-1 text-sm">
              {renderInline(trimmed.substring(4))}
            </h4>
          );
        }

        // Bullet point
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const content = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-accent-600 font-bold shrink-0">•</span>
              <span>{renderInline(content)}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-accent-600 font-semibold text-xs shrink-0">{numMatch[1]}.</span>
              <span>{renderInline(numMatch[2])}</span>
            </div>
          );
        }

        return <p key={idx}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-ink-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={match.index} className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-800">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

export default function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === "user";
  const [selectedSource, setSelectedSource] = useState<ChatSource | null>(null);
  const [copied, setCopied] = useState(false);

  // Deduplicate sources by pageNumber + heading
  const uniqueSources: ChatSource[] = [];
  if (message.sources && message.sources.length > 0) {
    const seen = new Set<string>();
    for (const src of message.sources) {
      const key = `${src.pageNumber ?? ""}_${src.heading ?? ""}_${src.chunkIndex ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueSources.push(src);
      }
    }
  }

  const formatSourceLabel = (s: ChatSource) => {
    const hasPage = s.pageNumber !== null && s.pageNumber !== undefined;
    const hasHeading = s.heading && s.heading.trim().length > 0;

    if (hasPage && hasHeading) {
      return `p.${s.pageNumber} · ${s.heading}`;
    }
    if (hasPage) {
      return `Page ${s.pageNumber}`;
    }
    if (hasHeading) {
      return s.heading;
    }
    return `Clause Excerpt`;
  };

  const handleCopyCitation = (source: ChatSource) => {
    const text = source.text
      ? `"${source.text}" (Contract citation: ${formatSourceLabel(source)})`
      : `Contract citation: ${formatSourceLabel(source)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-xs ${
          isUser ? "bg-ink-900 text-white" : "bg-accent-50 text-accent-600 border border-accent-100"
        }`}
      >
        {isUser ? <User size={14} /> : <Scale size={14} />}
      </span>

      <div className={`max-w-[85%] sm:max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-ink-900 text-white whitespace-pre-wrap shadow-sm rounded-tr-sm"
              : "border border-slate-200 bg-white text-slate-700 shadow-card rounded-tl-sm"
          }`}
        >
          {isUser ? message.text : <FormattedContent text={message.text} />}
        </div>

        {/* Citations / Sources tags */}
        {!isUser && uniqueSources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-0.5">
              Sources:
            </span>
            {uniqueSources.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedSource(s)}
                className="group flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-accent-400 hover:bg-accent-50/50 hover:text-accent-700 transition-all shadow-2xs"
                title="Click to view verified contract citation"
              >
                <MapPin size={11} className="text-accent-600 group-hover:scale-110 transition-transform" />
                <span className="max-w-[160px] truncate">{formatSourceLabel(s)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Source Citation Modal / Inspector */}
        {selectedSource && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-ink-900/40 backdrop-blur-xs"
              onClick={() => setSelectedSource(null)}
            />
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 z-50">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-accent-600" />
                  <span className="text-xs font-semibold text-ink-900">Verified Document Citation</span>
                </div>
                <button
                  onClick={() => setSelectedSource(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedSource.pageNumber && (
                    <span className="rounded-md bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-700 border border-accent-100">
                      Page {selectedSource.pageNumber}
                    </span>
                  )}
                  {selectedSource.heading && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {selectedSource.heading}
                    </span>
                  )}
                  {selectedSource.chunkIndex !== null && selectedSource.chunkIndex !== undefined && (
                    <span className="text-[11px] text-slate-400">
                      Segment #{selectedSource.chunkIndex + 1}
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Original Contract Excerpt:
                  </p>
                  <blockquote className="text-xs text-slate-700 leading-relaxed italic border-l-2 border-accent-600 pl-3">
                    {selectedSource.text
                      ? `"${selectedSource.text}"`
                      : `The response was retrieved and synthesized from Page ${selectedSource.pageNumber ?? "N/A"}${selectedSource.heading ? ` (${selectedSource.heading})` : ""}.`}
                  </blockquote>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleCopyCitation(selectedSource)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    {copied ? (
                      <>
                        <Check size={13} className="text-risk-low" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Copy Citation
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedSource(null)}
                    className="rounded-lg bg-ink-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-ink-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
