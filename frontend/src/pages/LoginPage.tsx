import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Scale, Mail, Lock, Eye, EyeOff, User as UserIcon, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  const { login, signup, isLoading, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect to intended target or dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

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
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white">
            <Scale size={16} />
          </span>
          <span className="font-serif text-lg font-semibold text-ink-900">Counsel</span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-ink-900 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Home
        </Link>
      </div>

      {/* Main card */}
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-ink-900 via-ink-700 to-ink-900 px-6 py-6 text-white text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-accent-400 backdrop-blur-sm mb-3">
              <Scale size={24} />
            </span>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-white">
              {mode === "login" ? "Welcome Back" : "Create an Account"}
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              {mode === "login"
                ? "Sign in to access your contract intelligence workspace"
                : "Get started with AI-powered contract analysis"}
            </p>

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

          <div className="p-6">
            {error && (
              <div className="mb-4 rounded-lg border border-risk-high/20 bg-risk-high/5 px-3.5 py-2.5 text-xs text-risk-high">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <div className="relative flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2.5 focus-within:border-accent-600 focus-within:ring-2 focus-within:ring-accent-100 transition-all">
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Email address</label>
                <div className="relative flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2.5 focus-within:border-accent-600 focus-within:ring-2 focus-within:ring-accent-100 transition-all">
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
                <div className="relative flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2.5 focus-within:border-accent-600 focus-within:ring-2 focus-within:ring-accent-100 transition-all">
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
                {mode === "signup" && (
                  <p className="mt-1 text-[11px] text-slate-400">Password must be at least 4 characters</p>
                )}
              </div>

              <Button
                type="submit"
                variant="accent"
                size="md"
                loading={isLoading}
                className="w-full mt-2"
              >
                {mode === "login" ? "Sign In" : "Register"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
