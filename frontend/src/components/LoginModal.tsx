import { useState } from "react";
import { X, Mail, Lock, Eye, EyeOff, Scale, User as UserIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Button from "./ui/Button";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login, signup, isLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    try {
      if (mode === "login") {
        await login(email.trim(), password.trim());
      } else {
        await signup(email.trim(), password.trim(), name.trim() || undefined);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all">
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-ink-900 via-ink-700 to-ink-900 px-6 pt-6 pb-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-accent-400 backdrop-blur-sm">
                <Scale size={18} />
              </span>
              <div>
                <h2 className="font-serif text-lg font-semibold tracking-tight text-white">Counsel AI</h2>
                <p className="text-xs text-slate-300">Contract Intelligence Platform</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab buttons */}
          <div className="mt-5 grid grid-cols-2 rounded-lg bg-white/10 p-1 text-xs font-medium text-slate-300">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`rounded-md py-1.5 transition-colors ${
                mode === "login" ? "bg-white text-ink-900 shadow font-semibold" : "hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`rounded-md py-1.5 transition-colors ${
                mode === "signup" ? "bg-white text-ink-900 shadow font-semibold" : "hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Content form */}
        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-risk-high/20 bg-risk-high/5 px-3.5 py-2.5 text-xs text-risk-high">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <div className="relative flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-accent-600 focus-within:ring-2 focus-within:ring-accent-100 transition-all">
                  <UserIcon size={16} className="text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Work Email</label>
              <div className="relative flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-accent-600 focus-within:ring-2 focus-within:ring-accent-100 transition-all">
                <Mail size={16} className="text-slate-400 mr-2 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <div className="relative flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-accent-600 focus-within:ring-2 focus-within:ring-accent-100 transition-all">
                <Lock size={16} className="text-slate-400 mr-2 shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 ml-2"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {mode === "login" ? "Simple email & password login" : "Minimum 4 characters"}
              </p>
            </div>

            <Button
              type="submit"
              variant="accent"
              size="md"
              loading={isLoading}
              className="w-full mt-2"
            >
              {mode === "login" ? "Sign In to Counsel" : "Create Account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            By continuing, you accept Counsel's terms of service and confidential data policy.
          </p>
        </div>
      </div>
    </div>
  );
}
