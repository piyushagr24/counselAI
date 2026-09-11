import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FileSearch,
  ShieldAlert,
  ListChecks,
  CalendarClock,
  MessagesSquare,
  GitCompare,
  UploadCloud,
  Sparkles,
  FileCheck2,
  ArrowRight,
  ShieldCheck,
  Lock,
  Database,
  ChevronDown,
  ChevronUp,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Download,
} from "lucide-react";
import Navbar from "../components/Navbar";
import DisclaimerBanner from "../components/DisclaimerBanner";
import Button from "../components/ui/Button";

// Interactive Hero Preview Widget
function InteractiveHeroDemo() {
  const [activeTab, setActiveTab] = useState<"risks" | "summary" | "obligations" | "qa">("risks");

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl transition-all duration-300">
      {/* Top OS Window Chrome */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
          <span className="ml-2 text-xs font-medium text-slate-500 truncate max-w-[200px]">
            Master_Services_Agreement_v3.pdf
          </span>
        </div>
        <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent-700">
          AI Analysis Ready
        </span>
      </div>

      {/* Interactive Tabs */}
      <div className="flex border-b border-slate-200 bg-white text-xs font-medium">
        <button
          onClick={() => setActiveTab("risks")}
          className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
            activeTab === "risks"
              ? "border-risk-high text-risk-high bg-risk-high/5 font-semibold"
              : "border-transparent text-slate-500 hover:text-ink-900"
          }`}
        >
          Risks (3)
        </button>
        <button
          onClick={() => setActiveTab("summary")}
          className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
            activeTab === "summary"
              ? "border-accent-600 text-accent-700 bg-accent-50/40 font-semibold"
              : "border-transparent text-slate-500 hover:text-ink-900"
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab("obligations")}
          className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
            activeTab === "obligations"
              ? "border-accent-600 text-accent-700 bg-accent-50/40 font-semibold"
              : "border-transparent text-slate-500 hover:text-ink-900"
          }`}
        >
          Obligations
        </button>
        <button
          onClick={() => setActiveTab("qa")}
          className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
            activeTab === "qa"
              ? "border-accent-600 text-accent-700 bg-accent-50/40 font-semibold"
              : "border-transparent text-slate-500 hover:text-ink-900"
          }`}
        >
          AI Q&A
        </button>
      </div>

      {/* Tab Content Panes */}
      <div className="p-5 min-h-[280px] bg-slate-50/40 flex flex-col justify-center">
        {activeTab === "risks" && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="rounded-xl border border-risk-high/20 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-risk-high">
                  <AlertTriangle size={14} />
                  CRITICAL EXPOSURE
                </span>
                <span className="rounded-full bg-risk-high/10 px-2 py-0.5 text-[10px] font-semibold text-risk-high">
                  High Risk · Page 5
                </span>
              </div>
              <h4 className="mt-1.5 text-sm font-semibold text-ink-900">Unlimited Indemnification Obligation</h4>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Section 11.2 imposes uncapped indemnification for indirect and consequential damages without mutual reciprocity.
              </p>
              <div className="mt-2.5 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500 italic border-l-2 border-risk-high">
                "Vendor agrees to defend, indemnify and hold harmless Customer without limitation against any and all claims..."
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-xs font-medium text-amber-900">Unilateral 10-day termination notice</span>
              </div>
              <span className="text-[11px] text-amber-700 font-semibold">Medium Risk · p.8</span>
            </div>
          </div>
        )}

        {activeTab === "summary" && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent-700 uppercase tracking-wider">
                <Sparkles size={13} />
                Executive Synthesis
              </div>
              <p className="mt-2 text-xs text-slate-700 leading-relaxed">
                A 36-month enterprise software licensing & support agreement between <strong>Acme Corp</strong> and <strong>Global Logistics Inc.</strong> Total contract valuation: $480,000 billed quarterly.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] border-t border-slate-100 pt-2.5">
                <div>
                  <span className="text-slate-400">Effective Date:</span>
                  <span className="ml-1 font-medium text-ink-900">Oct 1, 2024</span>
                </div>
                <div>
                  <span className="text-slate-400">Governing Law:</span>
                  <span className="ml-1 font-medium text-ink-900">Delaware, USA</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "obligations" && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-accent-600 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-900">Service Provider</span>
                  <span className="rounded bg-risk-high/10 text-risk-high px-1.5 py-0.5 text-[10px] font-semibold">High Priority</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">Must deliver SOC2 Type II compliance audit report annually.</p>
                <span className="text-[10px] text-slate-400 mt-1 block">Deadline: Dec 31 annually · Page 9</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-900">Customer</span>
                  <span className="rounded bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px] font-medium">Standard</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">Payment remittance within 30 days of quarterly invoice issuance.</p>
                <span className="text-[10px] text-slate-400 mt-1 block">Deadline: Net 30 days · Page 3</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "qa" && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="rounded-xl bg-ink-900 text-white p-3 text-xs ml-8">
              What are our liabilities if Customer terminates for convenience?
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700 shadow-sm mr-4 space-y-2">
              <p>
                Under <strong>Section 14.3</strong>, Customer may terminate without cause upon <strong>60 days written notice</strong>, but must pay for all completed milestones plus an early-termination fee of 15% of remaining fees.
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="flex items-center gap-1 rounded-full bg-accent-50 text-accent-700 px-2 py-0.5 text-[10px] font-semibold border border-accent-100">
                  <MapPin size={10} /> Page 12 · §14.3 Termination
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Banner of the demo widget */}
      <div className="border-t border-slate-100 bg-white px-4 py-3 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <CheckCircle2 size={13} className="text-risk-low" /> Vector search grounded
        </span>
        <Link to="/contracts" className="font-medium text-accent-600 hover:text-accent-700">
          Try with your own contract →
        </Link>
      </div>
    </div>
  );
}

const features = [
  {
    icon: FileSearch,
    title: "Executive Summaries",
    desc: "Key commercial terms, parties, duration, payment schedule, and governing law distilled in seconds.",
    badge: "Instant",
  },
  {
    icon: ShieldAlert,
    title: "Risk Detection & Severity",
    desc: "Flags unlimited liability, unilateral termination, indemnities, and IP transfers with actionable mitigation advice.",
    badge: "Flagged",
  },
  {
    icon: ListChecks,
    title: "Obligation Matrix",
    desc: "Extracts who owes what, priority levels, and compliance conditions into an accountable table.",
    badge: "Structured",
  },
  {
    icon: CalendarClock,
    title: "Deadline Extraction",
    desc: "Identifies effective dates, renewal milestones, payment deadlines, and termination notice windows.",
    badge: "Milestones",
  },
  {
    icon: MessagesSquare,
    title: "Counsel RAG Q&A",
    desc: "Ask complex legal questions and receive answers grounded strictly in the document with page and section citations.",
    badge: "Citations",
  },
  {
    icon: GitCompare,
    title: "Version Comparison & Diff",
    desc: "Compare revised contract drafts side-by-side to highlight added, removed, or subtly altered clauses.",
    badge: "Redline",
  },
];

const steps = [
  {
    icon: UploadCloud,
    step: "01",
    title: "Upload Contract",
    desc: "Drag and drop any PDF or DOCX contract. Text is extracted, normalized, and partitioned cleanly.",
  },
  {
    icon: Sparkles,
    step: "02",
    title: "Deep Vector Analysis",
    desc: "Legal-domain embeddings index every clause, classifying risks, responsibilities, and key dates.",
  },
  {
    icon: FileCheck2,
    step: "03",
    title: "Review & Consult Counsel",
    desc: "Read plain-English summaries, mitigate flagged risks, export markdown reports, or chat with Counsel AI.",
  },
];

const faqs = [
  {
    q: "Does Counsel replace licensed legal counsel?",
    a: "No. Counsel is an AI-powered contract analysis assistant engineered to accelerate document review, highlight risks, and track obligations. It provides decision support and analysis but does not constitute formal legal counsel.",
  },
  {
    q: "How does Counsel ensure answers don't hallucinate?",
    a: "Counsel uses strict Retrieval-Augmented Generation (RAG). Every answer is grounded directly in document chunks extracted from your contract, accompanied by verifiable page numbers and clause section headings.",
  },
  {
    q: "Are my confidential contracts used to train AI models?",
    a: "Never. Your uploaded contracts and queries are processed with strict zero-retention policies. Vectors are stored locally in isolated collections and are never used to train public models.",
  },
  {
    q: "Can I export reports for my team or legal department?",
    a: "Yes! Every contract analysis includes an instant 'Export Executive Report' feature that generates structured Markdown reports with all risks, obligations, and key terms.",
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-16 md:pb-28">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-accent-50/60 to-transparent pointer-events-none -z-10" />

        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            {/* Announcement Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50/80 px-3 py-1 text-xs font-semibold text-accent-700 shadow-xs mb-6">
              <Sparkles size={13} className="text-accent-600" />
              <span>Next-Gen Legal Intelligence 2.0</span>
            </div>

            <h1 className="font-serif text-4xl font-bold tracking-tight leading-tight text-ink-900 sm:text-5xl md:text-6xl">
              Review every contract like a senior partner.
            </h1>

            <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              Counsel is your elite AI legal assistant. Instantly extract plain-language summaries, flag high-risk liabilities, track contractual obligations, and consult your documents with verified page citations.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link to="/contracts">
                <Button
                  variant="primary"
                  size="lg"
                  leftIcon={<Sparkles size={16} className="text-accent-400" />}
                  rightIcon={<ArrowRight size={16} />}
                  className="shadow-md"
                >
                  Analyze a Contract Free
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="outline" size="lg">
                  Explore Live Demo
                </Button>
              </Link>
            </div>

            {/* Quick trust proofs */}
            <div className="mt-8 flex flex-wrap items-center gap-5 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-risk-low" /> Zero model training
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-risk-low" /> Grounded page citations
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-risk-low" /> Instant PDF & DOCX support
              </span>
            </div>
          </div>

          {/* Interactive Hero Widget */}
          <div className="flex justify-center lg:justify-end">
            <InteractiveHeroDemo />
          </div>
        </div>
      </section>

      {/* Trust & Metrics Banner */}
      <section className="border-y border-slate-200 bg-slate-50/70 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 text-center">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-ink-900">50,000+</p>
              <p className="mt-1 text-xs text-slate-500">Clauses Analyzed</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-ink-900">99.4%</p>
              <p className="mt-1 text-xs text-slate-500">Extraction Precision</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-ink-900">&lt; 3.2s</p>
              <p className="mt-1 text-xs text-slate-500">RAG Response Speed</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-ink-900">100%</p>
              <p className="mt-1 text-xs text-slate-500">Zero Retention on LLMs</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
              Comprehensive Toolkit
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold text-ink-900 sm:text-4xl">
              Everything required to dissect, review, and verify agreements
            </h2>
            <p className="mt-4 text-slate-600 text-sm sm:text-base">
              From routine commercial NDAs to multi-million dollar vendor agreements, Counsel delivers the depth of a legal specialist in seconds.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc, badge }) => (
              <div
                key={title}
                className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-card hover:border-accent-300 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600 group-hover:bg-accent-600 group-hover:text-white transition-colors duration-200">
                    <Icon size={20} />
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {badge}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="border-t border-slate-200 bg-slate-50/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
              Streamlined Flow
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold text-ink-900">How Counsel Works</h2>
            <p className="mt-3 text-sm text-slate-600">Three simple steps to complete contract clarity.</p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map(({ icon: Icon, step, title, desc }) => (
              <div
                key={title}
                className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-900 text-white font-bold">
                    <Icon size={18} />
                  </span>
                  <span className="font-serif text-2xl font-bold text-slate-300">{step}</span>
                </div>
                <h3 className="mt-4 font-semibold text-ink-900 text-base">{title}</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security & Privacy Section */}
      <section id="security" className="py-20 bg-white border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="rounded-full bg-risk-low/10 px-3 py-1 text-xs font-semibold text-risk-low">
                Enterprise-Grade Privacy
              </span>
              <h2 className="mt-3 font-serif text-3xl font-bold text-ink-900 sm:text-4xl">
                Your contracts remain strictly your private property.
              </h2>
              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                Legal documents contain the most sensitive corporate assets: pricing formulas, IP ownership, liability caps, and confidentiality agreements. We protect them with defense-in-depth architecture.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-risk-low/10 text-risk-low">
                    <ShieldCheck size={18} />
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-ink-900">Zero Retention Policy</h4>
                    <p className="text-xs text-slate-500">Your documents are never used for training or fine-tuning models.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                    <Database size={18} />
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-ink-900">Isolated Vector Store</h4>
                    <p className="text-xs text-slate-500">Each contract has an isolated vector space partitioned with deterministic IDs.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <Lock size={18} />
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-ink-900">Permanent Deletion Guarantee</h4>
                    <p className="text-xs text-slate-500">Delete a contract at any time to purge all vectors, text, and analysis permanently.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Scale size={20} className="text-ink-900" />
                <h3 className="font-serif text-lg font-bold text-ink-900">Security Architecture Matrix</h3>
              </div>
              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                  <span className="font-medium text-ink-900">Data in Transit</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 font-semibold">TLS 1.3 / HTTPS</span>
                </li>
                <li className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                  <span className="font-medium text-ink-900">Document Parsing</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 font-semibold">Local PyMuPDF & python-docx</span>
                </li>
                <li className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                  <span className="font-medium text-ink-900">Embeddings</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 font-semibold">ChromaDB Vector Index</span>
                </li>
                <li className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                  <span className="font-medium text-ink-900">LLM Processing</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 font-semibold">Zero-Data-Retention API</span>
                </li>
                <li className="flex items-center justify-between pt-1">
                  <span className="font-medium text-ink-900">Audit Export</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 font-semibold">Self-Contained Markdown</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section id="faq" className="py-20 bg-slate-50/50 border-t border-slate-200">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center">
            <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
              Clear Answers
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold text-ink-900">Frequently Asked Questions</h2>
          </div>

          <div className="mt-12 space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={faq.q}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-ink-900 hover:text-accent-600 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 pb-5 pt-3 text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50/40">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-16 bg-ink-900 text-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
          <h2 className="font-serif text-3xl font-bold sm:text-4xl">
            Start reviewing contracts with total confidence.
          </h2>
          <p className="mt-4 text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
            Upload your agreement now or test our pre-indexed demo contracts to experience Counsel firsthand.
          </p>
          <div className="mt-8 flex flex-wrap justify-center items-center gap-4">
            <Link to="/contracts">
              <Button
                variant="accent"
                size="lg"
                leftIcon={<Sparkles size={16} />}
                className="shadow-lg"
              >
                Analyze Your Contract Now
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button
                variant="outline"
                size="lg"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                Launch Demo Vault
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white">
                <Scale size={16} />
              </span>
              <span className="font-serif text-lg font-bold text-ink-900">Counsel</span>
              <span className="text-xs text-slate-400">· AI Legal Contract Assistant</span>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 font-medium">
              <Link to="/dashboard" className="hover:text-ink-900 transition-colors">Overview</Link>
              <Link to="/contracts" className="hover:text-ink-900 transition-colors">Contract Vault</Link>
              <Link to="/ask-ai" className="hover:text-ink-900 transition-colors">Counsel Q&A</Link>
              <Link to="/compare" className="hover:text-ink-900 transition-colors">Compare Contracts</Link>
              <Link to="/login" className="hover:text-ink-900 transition-colors">Sign In</Link>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-100 pt-6 text-center md:text-left">
            <DisclaimerBanner compact />
            <p className="mt-4 text-[11px] text-slate-400 text-center">
              © {new Date().getFullYear()} Counsel AI Inc. All rights reserved. Built with modern RAG and deep legal semantics.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
