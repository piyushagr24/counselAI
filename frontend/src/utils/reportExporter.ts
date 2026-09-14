import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
} from "docx";
import type { ApiDeadlinesResponse, ApiSummaryResponse, ContractDetails, Obligation, RiskFinding } from "../types";

export interface ExportReportData {
  contract: ContractDetails;
  summary: ApiSummaryResponse | null;
  risks: RiskFinding[];
  obligations: Obligation[];
  deadlines: ApiDeadlinesResponse["deadlines"] | null;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------------------
// 1. PDF Exporter (jsPDF + autoTable)
// ----------------------------------------------------------------------------
export async function exportToPdf(data: ExportReportData): Promise<void> {
  const { contract, summary, risks, obligations, deadlines } = data;
  const s = summary?.summary;
  const baseName = sanitizeFilename(contract.filename);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = margin;

  // Header Bar
  doc.setFillColor(15, 23, 42); // slate-900 / ink-900
  doc.rect(margin, currentY, pageWidth - margin * 2, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("COUNSEL AI — EXECUTIVE LEGAL REPORT", margin + 6, currentY + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `Contract: ${contract.filename}   |   Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    margin + 6,
    currentY + 16
  );

  currentY += 28;

  // Metadata Table
  const metaBody = [
    [
      { content: "Contract Title", styles: { fontStyle: "bold" as const } },
      s?.title || contract.filename,
      { content: "Overall Risk Score", styles: { fontStyle: "bold" as const } },
      s?.overall_risk_score || "Unrated",
    ],
    [
      { content: "Contract Type", styles: { fontStyle: "bold" as const } },
      s?.contract_type || "Commercial Contract",
      { content: "Effective Date", styles: { fontStyle: "bold" as const } },
      s?.effective_date || "Not specified",
    ],
    [
      { content: "Governing Law", styles: { fontStyle: "bold" as const } },
      s?.governing_law_and_jurisdiction || "Not specified",
      { content: "Expiration Date", styles: { fontStyle: "bold" as const } },
      s?.expiration_date || "Not specified",
    ],
    [
      { content: "Pages Extracted", styles: { fontStyle: "bold" as const } },
      `${contract.num_pages ?? 1} pages (${(contract.size_bytes / 1024).toFixed(1)} KB)`,
      { content: "Contract ID", styles: { fontStyle: "bold" as const } },
      contract.contract_id,
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: metaBody,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 32, fillColor: [248, 250, 252] },
      1: { cellWidth: 58 },
      2: { cellWidth: 36, fillColor: [248, 250, 252] },
      3: { cellWidth: 56 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 8;

  // Section 1: Executive Summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("1. Executive Summary & Core Terms", margin, currentY);
  currentY += 4;

  const execSummaryText = s?.executive_summary || s?.contract_purpose || "No executive summary loaded.";
  const splitExec = doc.splitTextToSize(execSummaryText, pageWidth - margin * 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(splitExec, margin, currentY);
  currentY += splitExec.length * 4.2 + 4;

  // Commercial Terms Grid
  const commercialData = [
    ["Parties Involved", s?.parties?.length ? s.parties.join(", ") : "Not specified"],
    ["Duration & Term", s?.duration || "Not specified"],
    ["Financial & Payment Terms", s?.financial_terms || s?.payment_terms || "Not specified"],
    ["Dispute Resolution", s?.dispute_resolution || "Not specified"],
    ["Confidentiality Terms", s?.confidentiality_terms || "Not specified"],
    ["Termination Conditions", s?.termination_conditions || "Not specified"],
    ["Liabilities & Indemnification", s?.liability_and_indemnification || "Not specified"],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [["Commercial Safeguard / Clause", "Provision Summary"]],
    body: commercialData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { cellWidth: 132 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 8;

  // Section 2: Risk Assessment Findings
  if (currentY > pageHeight - 40) {
    doc.addPage();
    currentY = margin + 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. Risk Assessment Findings (${risks.length} flagged)`, margin, currentY);
  currentY += 4;

  if (risks.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("No notable legal or commercial risks flagged for this contract.", margin, currentY);
    currentY += 8;
  } else {
    const riskRows = risks.map((r, idx) => {
      const location = `Page ${r.pageNumber ?? "—"}${r.section ? ` · Sec: ${r.section}` : ""}`;
      const details = `${r.explanation}\n\n• Recommendation: ${r.recommendation ?? "Review standard protective terms."}\n• Quote: "${r.evidence}"`;
      return [(idx + 1).toString(), r.title, r.severity, location, details];
    });

    autoTable(doc, {
      startY: currentY,
      head: [["#", "Risk Finding", "Severity", "Location", "Analysis & Recommendation"]],
      body: riskRows,
      theme: "grid",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 36, fontStyle: "bold" },
        2: { cellWidth: 20, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 26 },
        4: { cellWidth: 92 },
      },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 2) {
          const val = String(hookData.cell.raw).toLowerCase();
          if (val === "critical") {
            hookData.cell.styles.textColor = [220, 38, 38];
          } else if (val === "high") {
            hookData.cell.styles.textColor = [234, 88, 12];
          } else if (val === "medium") {
            hookData.cell.styles.textColor = [217, 119, 6];
          } else if (val === "low") {
            hookData.cell.styles.textColor = [22, 163, 74];
          }
        }
      },
      margin: { left: margin, right: margin },
    });

    currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 8;
  }

  // Section 3: Extracted Obligations
  if (currentY > pageHeight - 40) {
    doc.addPage();
    currentY = margin + 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`3. Extracted Contract Obligations (${obligations.length} tracked)`, margin, currentY);
  currentY += 4;

  if (obligations.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("No distinct obligations extracted.", margin, currentY);
    currentY += 8;
  } else {
    const obligationRows = obligations.map((o) => [
      o.responsibleParty ?? "Not specified",
      o.category ?? "General",
      o.priority ?? "Standard",
      o.obligation,
      o.deadline ?? "—",
      o.pageNumber ? `p. ${o.pageNumber}` : "—",
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Party", "Category", "Priority", "Obligation", "Deadline", "Page"]],
      body: obligationRows,
      theme: "grid",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: "bold" },
        1: { cellWidth: 24 },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 78 },
        4: { cellWidth: 20 },
        5: { cellWidth: 10, halign: "center" },
      },
      margin: { left: margin, right: margin },
    });

    currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 8;
  }

  // Section 4: Deadlines & Milestones
  if (currentY > pageHeight - 40) {
    doc.addPage();
    currentY = margin + 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("4. Deadlines & Milestones", margin, currentY);
  currentY += 4;

  const datesList: Array<[string, string]> = [
    ["Contract Start Date", deadlines?.contract_start_date ?? "Not specified"],
    ["Contract End Date", deadlines?.contract_end_date ?? "Not specified"],
    ["Renewal Notice / Terms", deadlines?.renewal_date ?? "Not specified"],
    ["Termination Notice Period", deadlines?.termination_notice_period ?? "Not specified"],
  ];

  if (deadlines?.payment_deadlines?.length) {
    deadlines.payment_deadlines.forEach((p) => {
      datesList.push([`Payment: ${p.description}`, p.date_or_timeframe ?? "N/A"]);
    });
  }

  autoTable(doc, {
    startY: currentY,
    head: [["Milestone / Event", "Date or Timeframe"]],
    body: datesList,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "bold" },
      1: { cellWidth: 112 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 10;

  // Add Page Footers & Legal Disclaimer across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      "Counsel AI Executive Review — For informational purposes only; does not constitute legal counsel.",
      margin,
      pageHeight - 8
    );

    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 15, pageHeight - 8);
  }

  doc.save(`${baseName}_Executive_Analysis.pdf`);
}

// ----------------------------------------------------------------------------
// 2. DOCX Exporter (docx library)
// ----------------------------------------------------------------------------
export async function exportToDocx(data: ExportReportData): Promise<void> {
  const { contract, summary, risks, obligations, deadlines } = data;
  const s = summary?.summary;
  const baseName = sanitizeFilename(contract.filename);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch = 1440 twips
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Counsel AI | Executive Legal Contract Report",
                    size: 16,
                    color: "64748B",
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Counsel AI Report · Confidential & Informational · Page ",
                    size: 16,
                    color: "94A3B8",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: "94A3B8",
                  }),
                  new TextRun({
                    text: " of ",
                    size: 16,
                    color: "94A3B8",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: "94A3B8",
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          // Document Title
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: `Executive Legal Contract Report: ${s?.title || contract.filename}`,
                bold: true,
                size: 32,
                color: "0F172A",
              }),
            ],
            spacing: { after: 120 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `Synthesized on ${new Date().toLocaleString()} · Counsel AI Contract Intelligence`,
                italics: true,
                size: 18,
                color: "475569",
              }),
            ],
            spacing: { after: 300 },
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createTableCell("Contract Type", true, 25),
                  createTableCell(s?.contract_type || "Commercial Contract", false, 25),
                  createTableCell("Overall Risk Score", true, 25),
                  createTableCell(s?.overall_risk_score || "Unrated", false, 25),
                ],
              }),
              new TableRow({
                children: [
                  createTableCell("Effective Date", true, 25),
                  createTableCell(s?.effective_date || "Not specified", false, 25),
                  createTableCell("Expiration Date", true, 25),
                  createTableCell(s?.expiration_date || "Not specified", false, 25),
                ],
              }),
              new TableRow({
                children: [
                  createTableCell("Governing Law", true, 25),
                  createTableCell(s?.governing_law_and_jurisdiction || "Not specified", false, 25),
                  createTableCell("Contract Pages", true, 25),
                  createTableCell(`${contract.num_pages ?? 1} pages (${(contract.size_bytes / 1024).toFixed(1)} KB)`, false, 25),
                ],
              }),
              new TableRow({
                children: [
                  createTableCell("Contract ID", true, 25),
                  createTableCell(contract.contract_id, false, 75, 3),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 300 } }),

          // Section 1: Executive Summary
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: "1. Executive Summary & Core Transaction",
                bold: true,
                size: 24,
                color: "0F172A",
              }),
            ],
            spacing: { before: 200, after: 140 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: s?.executive_summary || s?.contract_purpose || "No executive summary available.",
                size: 20,
                color: "334155",
              }),
            ],
            spacing: { after: 200 },
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [
              new TextRun({
                text: "Key Commercial Terms & Safeguards",
                bold: true,
                size: 20,
                color: "1E293B",
              }),
            ],
            spacing: { before: 160, after: 100 },
          }),

          createBulletPoint("Parties Involved", s?.parties?.length ? s.parties.join(", ") : "Not specified"),
          createBulletPoint("Duration & Term", s?.duration || "Not specified"),
          createBulletPoint("Financial & Payment Terms", s?.financial_terms || s?.payment_terms || "Not specified"),
          createBulletPoint("Dispute Resolution", s?.dispute_resolution || "Not specified"),
          createBulletPoint("Confidentiality", s?.confidentiality_terms || "Not specified"),
          createBulletPoint("Termination Terms", s?.termination_conditions || "Not specified"),
          createBulletPoint("Liabilities & Indemnities", s?.liability_and_indemnification || "Not specified"),

          new Paragraph({ spacing: { before: 300 } }),

          // Section 2: Risk Assessment Findings
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: `2. Risk Assessment Findings (${risks.length} flagged)`,
                bold: true,
                size: 24,
                color: "0F172A",
              }),
            ],
            spacing: { before: 240, after: 140 },
          }),

          ...(risks.length === 0
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "No notable legal or commercial risks flagged for this contract.",
                      italics: true,
                      size: 20,
                      color: "64748B",
                    }),
                  ],
                  spacing: { after: 200 },
                }),
              ]
            : [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      tableHeader: true,
                      children: [
                        createTableHeaderCell("#", 6),
                        createTableHeaderCell("Risk Title", 24),
                        createTableHeaderCell("Severity", 14),
                        createTableHeaderCell("Location", 16),
                        createTableHeaderCell("Analysis & Recommendation", 40),
                      ],
                    }),
                    ...risks.map((r, idx) =>
                      new TableRow({
                        children: [
                          createTableCell(`${idx + 1}`, false, 6, 1, "CENTER"),
                          createTableCell(r.title, true, 24),
                          createTableCell(
                            r.severity,
                            true,
                            14,
                            1,
                            "CENTER",
                            r.severity === "Critical" || r.severity === "High"
                              ? "DC2626"
                              : r.severity === "Medium"
                              ? "D97706"
                              : "16A34A"
                          ),
                          createTableCell(
                            `Page ${r.pageNumber ?? "—"}${r.section ? `\nSec: ${r.section}` : ""}`,
                            false,
                            16
                          ),
                          createTableCell(
                            `${r.explanation}\n\nRecommendation: ${r.recommendation ?? "Review standard terms."}\n\nQuote: "${r.evidence}"`,
                            false,
                            40
                          ),
                        ],
                      })
                    ),
                  ],
                }),
              ]),

          new Paragraph({ spacing: { before: 300 } }),

          // Section 3: Extracted Obligations
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: `3. Extracted Contract Obligations (${obligations.length} tracked)`,
                bold: true,
                size: 24,
                color: "0F172A",
              }),
            ],
            spacing: { before: 240, after: 140 },
          }),

          ...(obligations.length === 0
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "No distinct obligations extracted.",
                      italics: true,
                      size: 20,
                      color: "64748B",
                    }),
                  ],
                  spacing: { after: 200 },
                }),
              ]
            : [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      tableHeader: true,
                      children: [
                        createTableHeaderCell("Party", 20),
                        createTableHeaderCell("Category", 15),
                        createTableHeaderCell("Priority", 12),
                        createTableHeaderCell("Obligation", 38),
                        createTableHeaderCell("Deadline", 15),
                      ],
                    }),
                    ...obligations.map((o) =>
                      new TableRow({
                        children: [
                          createTableCell(o.responsibleParty ?? "Not specified", true, 20),
                          createTableCell(o.category ?? "General", false, 15),
                          createTableCell(o.priority ?? "Standard", false, 12, 1, "CENTER"),
                          createTableCell(o.obligation, false, 38),
                          createTableCell(o.deadline ?? "—", false, 15),
                        ],
                      })
                    ),
                  ],
                }),
              ]),

          new Paragraph({ spacing: { before: 300 } }),

          // Section 4: Deadlines & Milestones
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: "4. Deadlines & Milestones",
                bold: true,
                size: 24,
                color: "0F172A",
              }),
            ],
            spacing: { before: 240, after: 140 },
          }),

          createBulletPoint("Contract Start Date", deadlines?.contract_start_date ?? "Not specified"),
          createBulletPoint("Contract End Date", deadlines?.contract_end_date ?? "Not specified"),
          createBulletPoint("Renewal Terms / Notice", deadlines?.renewal_date ?? "Not specified"),
          createBulletPoint("Termination Notice Period", deadlines?.termination_notice_period ?? "Not specified"),

          ...(deadlines?.payment_deadlines?.length
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Payment Deadlines & Milestones:",
                      bold: true,
                      size: 20,
                      color: "1E293B",
                    }),
                  ],
                  spacing: { before: 160, after: 80 },
                }),
                ...deadlines.payment_deadlines.map((p) =>
                  createBulletPoint(p.description, p.date_or_timeframe ?? "N/A")
                ),
              ]
            : []),

          new Paragraph({ spacing: { before: 400 } }),

          // Disclaimer
          new Paragraph({
            children: [
              new TextRun({
                text: "Legal Disclaimer: This report was synthesized by Counsel AI for informational contract review and risk triage. It does not constitute formal legal counsel or create an attorney-client relationship.",
                italics: true,
                size: 16,
                color: "64748B",
              }),
            ],
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${baseName}_Executive_Analysis.docx`);
}

// ----------------------------------------------------------------------------
// 3. Markdown Exporter (Preserved as option)
// ----------------------------------------------------------------------------
export function exportToMarkdown(data: ExportReportData): void {
  const { contract, summary, risks, obligations, deadlines } = data;
  const s = summary?.summary;
  const baseName = sanitizeFilename(contract.filename);

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
  downloadBlob(blob, `${baseName}_Executive_Analysis.md`);
}

// ----------------------------------------------------------------------------
// Helper Builders for DOCX
// ----------------------------------------------------------------------------
function createBulletPoint(label: string, value: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 19, color: "1E293B" }),
      new TextRun({ text: value, size: 19, color: "334155" }),
    ],
    spacing: { after: 60 },
  });
}

function createTableHeaderCell(text: string, widthPercent: number): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: "0F172A" },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}

function createTableCell(
  text: string,
  isBold = false,
  widthPercent = 25,
  colSpan = 1,
  align: "LEFT" | "CENTER" | "RIGHT" = "LEFT",
  textColor = "334155"
): TableCell {
  const alignment =
    align === "CENTER"
      ? AlignmentType.CENTER
      : align === "RIGHT"
      ? AlignmentType.RIGHT
      : AlignmentType.LEFT;

  const lines = text.split("\n");
  const paragraphs = lines.map(
    (line) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line,
            bold: isBold,
            size: 18,
            color: textColor,
          }),
        ],
        alignment,
        spacing: { after: 40 },
      })
  );

  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    columnSpan: colSpan,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
    },
    children: paragraphs.length > 0 ? paragraphs : [new Paragraph({})],
  });
}
