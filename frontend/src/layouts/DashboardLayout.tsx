import { useState, useRef, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  LogOut,
  ChevronDown,
  Menu,
  Clock,
  Sparkles,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { getContracts } from "../services/api";
import type { ContractMetadata } from "../types";

const titles: Record<string, string> = {
  "/dashboard": "Overview",
  "/contracts": "Contracts",
  "/ask-ai": "Ask AI",
  "/compare": "Compare Contracts",
};

interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: "risk" | "success" | "deadline";
  contractId?: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, openLoginModal, isAuthenticated } = useAuth();

  const [contracts, setContracts] = useState<ContractMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const title =
    titles[location.pathname] ??
    (location.pathname.startsWith("/contracts/") ? "Contract Analysis" : "Counsel");

  useEffect(() => {
    void getContracts()
      .then(setContracts)
      .catch(() => {});
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchMatches = searchQuery.trim()
    ? contracts.filter((c) =>
        c.filename.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelectContract = (contractId: string) => {
    setSearchQuery("");
    setIsSearchOpen(false);
    navigate(`/contracts/${contractId}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchMatches.length > 0) {
      handleSelectContract(searchMatches[0].contract_id);
    } else if (searchQuery.trim()) {
      navigate(`/contracts`);
      setIsSearchOpen(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar for Desktop */}
      <Sidebar />

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative flex w-64 flex-col bg-white h-full shadow-2xl z-10">
            <Sidebar onNavClick={() => setMobileSidebarOpen(false)} className="flex border-r-0 w-full h-full" />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Interactive Top Header Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 py-3.5 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-ink-900">{title}</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Interactive Search Bar */}
            <div className="relative" ref={searchRef}>
              <form
                onSubmit={handleSearchSubmit}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition-all focus-within:border-accent-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-accent-100 w-44 sm:w-64"
              >
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Search contracts…"
                  className="w-full bg-transparent text-xs text-ink-900 outline-none placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </form>

              {/* Search Dropdown Results */}
              {isSearchOpen && searchQuery.trim() && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-1">
                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Contract Results ({searchMatches.length})
                  </div>
                  {searchMatches.length > 0 ? (
                    <div className="mt-1 max-h-60 overflow-y-auto divide-y divide-slate-50">
                      {searchMatches.map((contract) => (
                        <button
                          key={contract.contract_id}
                          type="button"
                          onClick={() => handleSelectContract(contract.contract_id)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-accent-50 transition-colors"
                        >
                          <FileText size={15} className="text-accent-600 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-ink-900">{contract.filename}</p>
                            <p className="text-[10px] text-slate-400">
                              {contract.num_pages ?? 1} {contract.num_pages === 1 ? "page" : "pages"} · {new Date(contract.upload_date).toLocaleDateString()}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-400">
                      No matching contracts found.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clickable Notification Bell with Popover */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-ink-900 transition-colors"
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-risk-high text-[10px] font-bold text-white shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl z-50 animate-in fade-in slide-in-from-top-1 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                    <span className="text-xs font-semibold text-ink-900">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[11px] font-medium text-accent-600 hover:text-accent-700"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.map((item) => (
                      <div
                        key={item.id}
                        className={`flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${
                          !item.read ? "bg-accent-50/30" : ""
                        }`}
                      >
                        <span className="mt-0.5 shrink-0">
                          {item.type === "risk" && <AlertTriangle size={15} className="text-risk-high" />}
                          {item.type === "success" && <CheckCircle2 size={15} className="text-risk-low" />}
                          {item.type === "deadline" && <Clock size={15} className="text-accent-600" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-ink-900">{item.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500 leading-snug">{item.desc}</p>
                          <span className="mt-1 block text-[10px] text-slate-400">{item.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Clickable Avatar with User Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 p-1 hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-accent-100"
                aria-label="User profile menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-xs font-bold text-white shadow-sm">
                  {getInitials(user?.name, user?.email)}
                </span>
                <ChevronDown size={14} className="text-slate-400 mr-1 hidden sm:block" />
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50/70 rounded-lg border border-slate-100">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-xs font-bold text-white shadow-xs">
                      {getInitials(user?.name, user?.email)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink-900 truncate">
                        {user?.name || user?.email?.split("@")[0] || "User"}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{user?.email || ""}</p>
                    </div>
                  </div>

                  <div className="mt-2 pt-1 border-t border-slate-100">
                    {isAuthenticated ? (
                      <button
                        onClick={() => {
                          logout();
                          setIsProfileOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <LogOut size={15} />
                        Sign Out
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          openLoginModal();
                          setIsProfileOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-accent-600 hover:bg-accent-50 transition-colors"
                      >
                        <Sparkles size={15} />
                        Sign In / Switch User
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
