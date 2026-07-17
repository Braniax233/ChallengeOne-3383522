/**
 * ProviderLayout — redesigned to match the new clinical light theme.
 */
import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Activity, LayoutDashboard, Camera, Users,
  LogOut, Bell, Share2, Download, Star, Plus, Database, TrendingUp, Info, ChevronLeft,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const TOP_NAV = [
  { label: "Dashboard",       to: "/provider/dashboard", end: true  },
  { label: "Capture Reading", to: "/provider/capture",   end: true  },
  { label: "Patients",        to: "/provider/patients",  end: false },
];

const LEFT_ACTIONS = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/provider/dashboard", end: true },
  { icon: Plus,            label: "Capture",   to: "/provider/capture",   end: true },
  { icon: Users,           label: "Patients",  to: "/provider/patients",  end: false },
];

const getInitials = (name = "") =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

export default function ProviderLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      {/* Top nav */}
      <header className="bg-white/80 dark:bg-ink-900/80 backdrop-blur-md border-b border-gray-100 dark:border-ink-700 flex items-center px-6 py-3 gap-6 flex-shrink-0 z-30">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-blue-600 flex items-center justify-center shadow-sm">
            <Activity size={18} className="text-white" />
          </div>
          <span className="font-bold text-gray-800 dark:text-gray-100 text-lg tracking-tight">
            Vital<span className="text-brand">X</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-1 flex-1">
          {TOP_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive ? "bg-brand text-white shadow-md" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-ink-800 hover:text-gray-800 dark:hover:text-gray-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
          <button className="icon-btn" aria-label="Alerts"><Bell size={17} /></button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-ink-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold">
                {getInitials(user?.name)}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-ink-900 truncate max-w-[110px]">{user?.name || "Provider"}</p>
                <p className="text-[10px] text-ink-400">Provider</p>
              </div>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-card-hover border border-ink-100 py-2 z-50 animate-fade-in">
                <div className="px-4 py-2 border-b border-ink-100 mb-1">
                  <p className="text-sm font-semibold text-ink-900 truncate">{user?.name}</p>
                  <p className="text-xs text-ink-400 truncate">{user?.email}</p>
                </div>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-coral-500 hover:bg-coral-50 flex items-center gap-2">
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative pb-16 md:pb-0">
        {/* Left icon sidebar */}
        <aside className="hidden md:flex w-14 bg-surface border-r border-ink-200 flex-col items-center py-4 gap-2 flex-shrink-0">
          {LEFT_ACTIONS.map((a) => (
            <NavLink
              key={a.to}
              to={a.to}
              end={a.end}
              title={a.label}
              className={({ isActive }) =>
                `p-2.5 rounded-xl transition-colors ${
                  isActive ? "bg-teal-100 text-teal-600" : "text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                }`
              }
            >
              <a.icon size={20} />
            </NavLink>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="p-6"><Outlet /></div>
        </main>

        {/* ── MOBILE BOTTOM NAV ──────────────────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-ink-200 flex items-center justify-around px-2 py-2 z-40 pb-safe">
          {LEFT_ACTIONS.map((a) => (
            <NavLink
              key={a.to}
              to={a.to}
              end={a.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${
                  isActive ? "text-teal-600" : "text-ink-500 hover:text-ink-900"
                }`
              }
            >
              <a.icon size={22} />
              <span className="text-[10px] font-medium mt-1">{a.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
