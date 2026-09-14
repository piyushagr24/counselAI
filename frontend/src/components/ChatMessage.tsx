import React, { useState } from "react";
import { Scale, User, MapPin, X, Copy, Check, FileText, RotateCcw } from "lucide-react";
import type { ChatMessageData, ChatSource } from "../types";

interface ChatMessageProps {
  message: ChatMessageData;
  onReanswer?: (message: ChatMessageData) => void;
  isBusy?: boolean;
}

// Renders inline tokens: bold, italic, code, links
function renderInline(text: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*[^*\n]+?\*|_[^_\n]+?_|`[^`\n]+?`|\[.*?\]\(.*?\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${match.index}-${token.substring(0, 5)}`;

    if (token.startsWith("***") && token.endsWith("***") && token.length >= 6) {
      parts.push(
        <strong key={key} className="font-bold text-ink-900">
          <em className="italic">{token.slice(3, -3)}</em>
        </strong>
      );
    } else if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      parts.push(
        <strong key={key} className="font-semibold text-ink-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
      parts.push(
        <em key={key} className="italic text-slate-800">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("_") && token.endsWith("_") && token.length >= 2) {
      parts.push(
        <em key={key} className="italic text-slate-800">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      parts.push(
        <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[11px] font-mono text-slate-800 border border-slate-200/60">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const linkMatch = token.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-600 underline font-medium hover:text-accent-700"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    } else {
      parts.push(token);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

// Highlight severity or specific party labels inside table cells
function renderCellContent(content: string): React.ReactNode {
  const trimmed = content.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "high" || lower === "critical") {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 shadow-2xs">
        {trimmed}
      </span>
    );
  }
  if (lower === "medium" || lower === "med") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 shadow-2xs">
        {trimmed}
      </span>
    );
  }
  if (lower === "low") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shadow-2xs">
        {trimmed}
      </span>
    );
  }
  if (lower === "low-medium" || lower === "low - medium") {
    return (
      <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200 shadow-2xs">
        {trimmed}
      </span>
    );
  }
  if (lower === "creditor") {
    return (
      <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">
        Creditor
      </span>
    );
  }
  if (lower === "borrower") {
    return (
      <span className="inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-100">
        Borrower
      </span>
    );
  }
  if (lower === "both") {
    return (
      <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200">
        Both
      </span>
    );
  }

  return renderInline(content);
}

// Detect if a raw text line is a standalone title (e.g. 'Risk Assessment Matrix')
function isStandaloneHeading(line: string, nextLine?: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 70) return false;
  if (trimmed.startsWith("#") || trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.startsWith("|") || trimmed.startsWith(">")) {
    return false;
  }
  if (/^(\d+)[\.\)]/.test(trimmed)) return false;
  if (/[.:!?]$/.test(trimmed)) return false;

  const commonTitles = [
    "risk assessment matrix",
    "key observations & recommendations",
    "key observations and recommendations",
    "summary of findings",
    "executive summary",
    "key recommendations",
    "critical risks",
    "obligations summary",
    "overview matrix",
  ];
  if (commonTitles.includes(trimmed.toLowerCase())) return true;

  // Title-cased short line followed by table or list or blank line
  const isTitleCased = /^[A-Z][a-zA-Z0-9\s&/()-]+$/.test(trimmed);
  const nextIsSpecial =
    nextLine !== undefined &&
    (nextLine.trim().startsWith("|") ||
      nextLine.trim().startsWith("-") ||
      nextLine.trim().startsWith("*") ||
      /^\d+[\.\)]/.test(nextLine.trim()));

  return isTitleCased && (nextIsSpecial || trimmed.length < 45);
}

interface TableBlock {
  type: "table";
  headers: string[];
  alignments: ("left" | "center" | "right")[];
  rows: string[][];
}

interface CodeBlock {
  type: "code";
  code: string;
}

interface HeadingBlock {
  type: "heading";
  level: number;
  text: string;
}

interface ListBlock {
  type: "list";
  ordered: boolean;
  items: { num?: string; content: string }[];
}

interface QuoteBlock {
  type: "quote";
  text: string;
}

interface ParagraphBlock {
  type: "paragraph";
  text: string;
}

interface HrBlock {
  type: "hr";
}

type Block = TableBlock | CodeBlock | HeadingBlock | ListBlock | QuoteBlock | ParagraphBlock | HrBlock;

function parseMarkdownBlocks(text: string): Block[] {
  // Preprocess: collapse blank lines that occur between table rows (| ... |)
  const rawLines = text.split("\n");
  const lines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (trimmed === "" && lines.length > 0) {
      const prev = lines[lines.length - 1].trim();
      let nextIdx = i + 1;
      while (nextIdx < rawLines.length && rawLines[nextIdx].trim() === "") {
        nextIdx++;
      }
      if (
        prev.startsWith("|") &&
        prev.endsWith("|") &&
        nextIdx < rawLines.length &&
        rawLines[nextIdx].trim().startsWith("|") &&
        rawLines[nextIdx].trim().endsWith("|")
      ) {
        // Skip blank line inside table
        continue;
      }
    }
    lines.push(line);
  }

  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Code block
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push({ type: "code", code: codeLines.join("\n") });
      continue;
    }

    // Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Table block
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 1) {
        const parseRow = (r: string) => {
          const cells = r.split("|");
          return cells.slice(1, -1).map((c) => c.trim());
        };

        const headers = parseRow(tableLines[0]);
        let alignments: ("left" | "center" | "right")[] = headers.map(() => "left");
        let dataStartIndex = 1;

        if (tableLines.length > 1 && /^\|(\s*:?-+:?\s*\|)+$/.test(tableLines[1])) {
          const alignRow = parseRow(tableLines[1]);
          alignments = alignRow.map((a) => {
            if (a.startsWith(":") && a.endsWith(":")) return "center";
            if (a.endsWith(":")) return "right";
            return "left";
          });
          dataStartIndex = 2;
        }

        const rows: string[][] = [];
        for (let r = dataStartIndex; r < tableLines.length; r++) {
          rows.push(parseRow(tableLines[r]));
        }

        blocks.push({ type: "table", headers, alignments, rows });
        continue;
      }
    }

    // Hash headings (#, ##, ###, ####)
    const hashMatch = trimmed.match(/^(#{1,4})\s+(.*)/);
    if (hashMatch) {
      blocks.push({
        type: "heading",
        level: hashMatch[1].length,
        text: hashMatch[2],
      });
      i++;
      continue;
    }

    // Standalone headings (e.g. "Risk Assessment Matrix")
    const nextLine = i + 1 < lines.length ? lines[i + 1] : undefined;
    if (isStandaloneHeading(trimmed, nextLine)) {
      blocks.push({
        type: "heading",
        level: 3,
        text: trimmed,
      });
      i++;
      continue;
    }

    // Blockquote (>)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: quoteLines.join("\n") });
      continue;
    }

    // Numbered list (supports both "1. " and "1.")
    const numMatch = trimmed.match(/^(\d+)[\.\)]\s*(.*)/);
    if (numMatch) {
      const items: { num: string; content: string }[] = [];
      while (i < lines.length) {
        const itemTrimmed = lines[i].trim();
        const m = itemTrimmed.match(/^(\d+)[\.\)]\s*(.*)/);
        if (m) {
          items.push({ num: m[1], content: m[2] });
          i++;
        } else if (itemTrimmed.startsWith("   ") || itemTrimmed.startsWith("\t")) {
          // Continuation of previous item
          if (items.length > 0) {
            items[items.length - 1].content += "\n" + itemTrimmed;
          }
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // Bulleted list (- or * or •)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      const items: { content: string }[] = [];
      while (i < lines.length) {
        const itemTrimmed = lines[i].trim();
        if (itemTrimmed.startsWith("- ") || itemTrimmed.startsWith("* ") || itemTrimmed.startsWith("• ")) {
          items.push({ content: itemTrimmed.substring(2).trim() });
          i++;
        } else if (itemTrimmed.startsWith("   ") || itemTrimmed.startsWith("\t")) {
          if (items.length > 0) {
            items[items.length - 1].content += "\n" + itemTrimmed;
          }
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    // Default: paragraph
    blocks.push({ type: "paragraph", text: trimmed });
    i++;
  }

  return blocks;
}

function FormattedContent({ text }: { text: string }) {
  const blocks = parseMarkdownBlocks(text);

  return (
    <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed text-slate-700">
      {blocks.map((block, idx) => {
        if (block.type === "hr") {
          return <hr key={idx} className="my-3 border-slate-200" />;
        }

        if (block.type === "code") {
          return (
            <pre
              key={idx}
              className="my-2.5 overflow-x-auto rounded-xl bg-slate-900 p-3.5 font-mono text-xs text-slate-100 shadow-2xs"
            >
              <code>{block.code}</code>
            </pre>
          );
        }

        if (block.type === "heading") {
          if (block.level === 1) {
            return (
              <h2 key={idx} className="pt-3 pb-1 text-base font-bold text-ink-900 border-b border-slate-200">
                {renderInline(block.text)}
              </h2>
            );
          }
          if (block.level === 2) {
            return (
              <h3 key={idx} className="pt-2 pb-0.5 text-sm font-bold text-ink-900">
                {renderInline(block.text)}
              </h3>
            );
          }
          return (
            <h4 key={idx} className="pt-2 pb-0.5 font-semibold text-ink-900 text-xs sm:text-sm">
              {renderInline(block.text)}
            </h4>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={idx}
              className="my-2 rounded-r-xl border-l-3 border-accent-600 bg-accent-50/50 px-3.5 py-2.5 text-xs italic text-slate-700 leading-relaxed"
            >
              {renderInline(block.text)}
            </blockquote>
          );
        }

        if (block.type === "list") {
          if (block.ordered) {
            return (
              <ol key={idx} className="my-2 space-y-2 pl-0.5">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-50 text-[10px] font-bold text-accent-700 border border-accent-200/70 shadow-2xs mt-0.5">
                      {item.num ?? itemIdx + 1}
                    </span>
                    <div className="flex-1 min-w-0 pt-0.5">{renderInline(item.content)}</div>
                  </li>
                ))}
              </ol>
            );
          }

          return (
            <ul key={idx} className="my-2 space-y-1.5 pl-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-600 shrink-0 mt-2" />
                  <div className="flex-1 min-w-0">{renderInline(item.content)}</div>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "table") {
          const getAlignmentClass = (align: "left" | "center" | "right") => {
            if (align === "center") return "text-center";
            if (align === "right") return "text-right";
            return "text-left";
          };

          return (
            <div
              key={idx}
              className="my-3 overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-xs max-w-full"
            >
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 font-semibold text-ink-900 border-b border-slate-200">
                  <tr>
                    {block.headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className={`px-3.5 py-2.5 font-semibold text-slate-700 uppercase tracking-wider text-[10px] whitespace-nowrap ${getAlignmentClass(
                          block.alignments[hIdx] || "left"
                        )}`}
                      >
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {block.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-slate-50/70 transition-colors even:bg-slate-50/30"
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`px-3.5 py-2.5 align-top leading-relaxed text-slate-700 ${getAlignmentClass(
                            block.alignments[cIdx] || "left"
                          )}`}
                        >
                          {renderCellContent(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Paragraph
        return (
          <p key={idx} className="leading-relaxed">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

export default function ChatMessage({ message, onReanswer, isBusy }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [selectedSource, setSelectedSource] = useState<ChatSource | null>(null);
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

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
    void navigator.clipboard.writeText(text);
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 2000);
  };

  const handleCopyMessage = () => {
    void navigator.clipboard.writeText(message.text);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
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

      <div className={`max-w-[92%] sm:max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1.5 min-w-0`}>
        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed w-full overflow-hidden ${
            isUser
              ? "bg-ink-900 text-white whitespace-pre-wrap shadow-sm rounded-tr-sm"
              : "border border-slate-200 bg-white text-slate-700 shadow-card rounded-tl-sm"
          }`}
        >
          {isUser ? message.text : <FormattedContent text={message.text} />}

          {/* AI Message Action Bar (Copy + Re-answer) */}
          {!isUser && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-ink-900 transition-colors shadow-2xs cursor-pointer"
                  title="Copy full response to clipboard"
                >
                  {copiedMessage ? (
                    <>
                      <Check size={12} className="text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {onReanswer && (
                  <button
                    type="button"
                    onClick={() => onReanswer(message)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-accent-300 hover:bg-accent-50/60 hover:text-accent-700 transition-colors shadow-2xs disabled:opacity-40 cursor-pointer"
                    title="Regenerate this response"
                  >
                    <RotateCcw size={12} className={isBusy ? "animate-spin text-accent-600" : ""} />
                    <span>Re-answer</span>
                  </button>
                )}
              </div>

              {uniqueSources.length > 0 && (
                <span className="text-[10px] text-slate-400 font-medium">
                  {uniqueSources.length} {uniqueSources.length === 1 ? "source" : "sources"} verified
                </span>
              )}
            </div>
          )}
        </div>

        {/* Citations / Sources tags */}
        {!isUser && uniqueSources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-0.5">
              Sources:
            </span>
            {uniqueSources.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedSource(s)}
                className="group flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-accent-400 hover:bg-accent-50/50 hover:text-accent-700 transition-all shadow-2xs cursor-pointer"
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
                    {copiedCitation ? (
                      <>
                        <Check size={13} className="text-emerald-600" /> Copied!
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

