import { NavLink, Link } from "react-router-dom";
import { LayoutDashboard, FileStack, MessagesSquare, GitCompare, Scale, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/contracts", label: "Contracts Vault", icon: FileStack },
  { to: "/ask-ai", label: "Counsel Q&A", icon: MessagesSquare },
  { to: "/compare", label: "Compare Versions", icon: GitCompare },
];

interface SidebarProps {
  onNavClick?: () => void;
  className?: string;
}

export default function Sidebar({ onNavClick, className = "hidden md:flex" }: SidebarProps) {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <aside className={`w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 ${className}`}>
      {/* Brand */}
      <Link to="/" onClick={onNavClick} className="flex items-center gap-2.5 px-2 group">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
          <Scale size={18} className="text-accent-400" />
        </span>
        <div className="flex flex-col">
          <span className="font-serif text-lg font-bold tracking-tight text-ink-900">Counsel</span>
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase -mt-0.5">Enterprise AI</span>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="mt-8 flex flex-1 flex-col gap-1.5">
        <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Navigation</span>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-accent-50 text-accent-700 font-semibold shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-ink-900"
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Security Badge */}
      <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
        <div className="flex items-center gap-2 font-medium text-ink-900">
          <ShieldCheck size={14} className="text-risk-low" />
          <span>Confidentiality Mode</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
          Zero retention. Chunks indexed locally via ChromaDB.
        </p>
      </div>

      {/* User info & logout */}
      {isAuthenticated && user && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 px-1">
          <div className="min-w-0 flex-1 pr-2">
            <p className="truncate text-xs font-semibold text-ink-900">{user.name || "Jane Doe"}</p>
            <p className="truncate text-[10px] text-slate-400">{user.email}</p>
          </div>
          <button
            onClick={() => {
              logout();
              if (onNavClick) onNavClick();
            }}
            title="Sign out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-risk-high/10 hover:text-risk-high transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      )}
    </aside>
  );
}
