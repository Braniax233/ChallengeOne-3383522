import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity, LayoutDashboard, History, Phone, Calculator,
  LogOut, Bell, Share2, Download, Star, Plus, Database, TrendingUp, Info, ChevronLeft,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const TOP_NAV = [
  { label: "My Dashboard",      to: "/patient/dashboard", end: true  },
  { label: "My History",        to: "/patient/history",   end: true  },
  { label: "Capture Reading",   to: "/patient/capture",   end: true  },
];

const LEFT_ACTIONS = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/patient/dashboard", end: true },
  { icon: History,         label: "History",   to: "/patient/history",   end: true },
  { icon: Plus,            label: "Capture",   to: "/patient/capture",   end: true },
];

const getInitials = (name = "") =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

export default function PatientLayout() {
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
      <header className="bg-white border-b border-ink-200 flex items-center px-6 py-3 gap-6 flex-shrink-0 z-30">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-sm">
            <Activity size={18} className="text-white" />
          </div>
          <span className="font-bold text-ink-900 text-lg tracking-tight hidden sm:block">
            Vital<span className="text-teal-500">X</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-1 flex-1">
          {TOP_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive ? "bg-ink-900 text-white shadow-sm" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 flex-shrink-0">
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
                <p className="text-xs font-semibold text-ink-900 truncate max-w-[110px]">{user?.name || "Patient"}</p>
                <p className="text-[10px] text-ink-400">{user?.memberId || "Patient Portal"}</p>
              </div>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-card-hover border border-ink-100 py-2 z-50 animate-fade-in">
                <div className="px-4 py-2 border-b border-ink-100 mb-1">
                  <p className="text-sm font-semibold text-ink-900 truncate">{user?.name}</p>
                  <p className="text-xs text-ink-400 truncate">{user?.memberId}</p>
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
