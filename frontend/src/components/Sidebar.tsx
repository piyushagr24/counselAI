import { NavLink, Link } from "react-router-dom";
import {
  LayoutDashboard,
  FileStack,
  Sparkles,
  GitCompare,
  Scale,
  LogOut,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/contracts", label: "Contract Vault", icon: FileStack },
  { to: "/ask-ai", label: "Ask AI", icon: Sparkles },
  { to: "/compare", label: "Compare Versions", icon: GitCompare },
];

interface SidebarProps {
  onNavClick?: () => void;
  className?: string;
}

export default function Sidebar({ onNavClick, className = "hidden md:flex" }: SidebarProps) {
  const { user, logout, openLoginModal, isAuthenticated } = useAuth();

  return (
    <aside
      className={`w-64 shrink-0 flex flex-col justify-between border-r border-slate-200/80 bg-white px-4 py-6 md:sticky md:top-0 md:h-screen overflow-y-auto ${className}`}
    >
      {/* Top Section */}
      <div className="flex flex-col">
        {/* Brand */}
        <div className="flex items-center justify-between">
          <Link to="/" onClick={onNavClick} className="flex items-center gap-2.5 px-2 group">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
              <Scale size={18} className="text-white" />
            </span>
            <div className="flex flex-col">
              <span className="font-serif text-lg font-bold tracking-tight text-ink-900">
                Counsel<span className="text-accent-600">AI</span>
              </span>
              <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase -mt-1">
                Contract Intelligence
              </span>
            </div>
          </Link>
          {onNavClick && (
            <button
              type="button"
              onClick={onNavClick}
              className="md:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="mt-8 flex flex-col gap-1.5">
          <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Workspace
          </span>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavClick}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-accent-50/90 text-accent-700 font-semibold shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-ink-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-accent-600" />
                  )}
                  <Icon
                    size={18}
                    className={`shrink-0 transition-colors duration-150 ${
                      isActive
                        ? "text-accent-600"
                        : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User profile & logout */}
      <div className="pt-4 border-t border-slate-100 mt-auto">
        {isAuthenticated && user ? (
          <div className="flex items-center justify-between rounded-xl bg-slate-50/70 p-2 border border-slate-100 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-1.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-xs font-bold text-white shadow-xs">
                {(user.name || user.email)
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink-900 leading-tight">
                  {user.name || user.email.split("@")[0]}
                </p>
                <p className="truncate text-[10px] text-slate-400 leading-tight mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                if (onNavClick) onNavClick();
              }}
              title="Sign out"
              aria-label="Sign out"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              openLoginModal();
              if (onNavClick) onNavClick();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
          >
            Sign In
          </button>
        )}
      </div>
    </aside>
  );
}
