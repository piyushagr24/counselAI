import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Scale, Sparkles, Menu, X, LogIn, LogOut, ChevronDown, User as UserIcon, LayoutDashboard, FileText } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Button from "./ui/Button";

export default function Navbar() {
  const { user, isAuthenticated, logout, openLoginModal } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavClick = (hash: string) => {
    setMobileMenuOpen(false);
    if (location.pathname !== "/") {
      navigate(`/${hash}`);
    } else {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return "JD";
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
            <Scale size={18} className="text-accent-400" />
          </span>
          <div className="flex flex-col">
            <span className="font-serif text-lg font-bold tracking-tight text-ink-900">Counsel</span>
            <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase -mt-1">AI Contract Review</span>
          </div>
        </Link>

        {/* Center public nav links */}
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <button
            onClick={() => handleNavClick("#features")}
            className="transition-colors hover:text-ink-900 text-sm font-medium"
          >
            Features
          </button>
          <button
            onClick={() => handleNavClick("#how-it-works")}
            className="transition-colors hover:text-ink-900 text-sm font-medium"
          >
            How it works
          </button>
          <button
            onClick={() => handleNavClick("#security")}
            className="transition-colors hover:text-ink-900 text-sm font-medium"
          >
            Security & Privacy
          </button>
          <button
            onClick={() => handleNavClick("#faq")}
            className="transition-colors hover:text-ink-900 text-sm font-medium"
          >
            FAQ
          </button>
        </nav>

        {/* Right CTA / Auth buttons */}
        <div className="hidden items-center gap-2.5 sm:flex">
          {isAuthenticated && user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
                  {getInitials(user.name, user.email)}
                </span>
                <span className="max-w-[120px] truncate">{user.name || user.email.split("@")[0]}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in slide-in-from-top-1 z-50">
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="text-xs font-semibold text-ink-900">{user.name || "Counsel User"}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    {user.role && (
                      <span className="mt-1 inline-block rounded bg-accent-50 px-1.5 py-0.5 text-[10px] font-medium text-accent-700">
                        {user.role}
                      </span>
                    )}
                  </div>

                  <div className="py-1">
                    <Link
                      to="/dashboard"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <LayoutDashboard size={14} className="text-slate-400" />
                      Dashboard
                    </Link>
                    <Link
                      to="/contracts"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <FileText size={14} className="text-slate-400" />
                      My Contracts
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={() => {
                        logout();
                        setProfileDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-risk-high hover:bg-risk-high/5 transition-colors"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={openLoginModal}
              leftIcon={<LogIn size={14} />}
            >
              Sign In
            </Button>
          )}

          <Link to="/dashboard">
            <Button variant="outline" size="sm">
              Try Demo
            </Button>
          </Link>

          <Link to="/contracts">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Sparkles size={13} className="text-accent-400" />}
            >
              Analyze Contract
            </Button>
          </Link>
        </div>

        {/* Mobile menu toggle button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 sm:hidden transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-200 bg-white px-5 py-4 sm:hidden animate-in fade-in slide-in-from-top-2">
          <nav className="flex flex-col gap-2.5 text-sm font-medium text-slate-700">
            <button
              onClick={() => handleNavClick("#features")}
              className="text-left py-1 hover:text-ink-900"
            >
              Features
            </button>
            <button
              onClick={() => handleNavClick("#how-it-works")}
              className="text-left py-1 hover:text-ink-900"
            >
              How it works
            </button>
            <button
              onClick={() => handleNavClick("#security")}
              className="text-left py-1 hover:text-ink-900"
            >
              Security & Privacy
            </button>
            <button
              onClick={() => handleNavClick("#faq")}
              className="text-left py-1 hover:text-ink-900"
            >
              FAQ
            </button>
          </nav>

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3">
            {isAuthenticated && user ? (
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-xs text-white">
                    {getInitials(user.name, user.email)}
                  </span>
                  <div className="text-xs">
                    <p className="font-semibold text-ink-900">{user.name || user.email}</p>
                    <p className="text-slate-400">{user.role || "User"}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="text-xs text-risk-high hover:underline"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openLoginModal();
                }}
                leftIcon={<LogIn size={14} />}
                className="w-full justify-center"
              >
                Sign In
              </Button>
            )}

            <div className="grid grid-cols-2 gap-2 mt-1">
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="secondary" size="sm" className="w-full justify-center">
                  Try Demo
                </Button>
              </Link>
              <Link to="/contracts" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="sm" className="w-full justify-center">
                  Analyze
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
