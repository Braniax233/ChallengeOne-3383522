/**
 * ClinicianLayout.jsx
 * Redesigned layout matching the inspiration:
 *  - Top horizontal navigation bar (logo + nav pill tabs + user info)
 *  - Thin left icon sidebar (action shortcuts)
 *  - Right notifications panel
 *  - Main content area (white cards on gray surface)
 */
import { useState, useEffect, useRef } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  Users,
  Bell,
  FileText,
  Settings,
  LogOut,
  Search,
  Share2,
  Download,
  Star,
  Plus,
  Database,
  TrendingUp,
  Info,
  Volume2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Heart,
  Monitor,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { getLatestVitals } from "../api/vitals";

const TOP_NAV = [
  { label: "Dashboard", to: "/clinician/dashboard", end: true },
  { label: "Patients",  to: "/clinician/patients",  end: false },
  { label: "Alerts",    to: "/clinician/alerts",    end: true, badge: true },
  { label: "Reports",   to: "/clinician/reports",   end: true },
  { label: "Settings",  to: "/clinician/settings",  end: true },
];

const LEFT_ACTIONS = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/clinician/dashboard", end: true },
  { icon: Users,           label: "Patients",  to: "/clinician/patients",  end: false },
  { icon: AlertTriangle,   label: "Alerts",    to: "/clinician/alerts",    end: true },
  { icon: FileText,        label: "Reports",   to: "/clinician/reports",   end: true },
  { icon: Settings,        label: "Settings",  to: "/clinician/settings",  end: true },
];

const getInitials = (name = "") =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

const formatTimeAgo = (date) => {
  if (!date) return "—";
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

export default function ClinicianLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [alertsCount, setAlertsCount]     = useState(0);
  const [recentAlerts, setRecentAlerts]   = useState([]);
  const [showUserMenu, setShowUserMenu]   = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [liveVitals, setLiveVitals]       = useState(null);
  const [sensorOnline, setSensorOnline]   = useState(false);
  const menuRef = useRef(null);
  const pollRef = useRef(null);

  // Fetch alert count + recent alerts for the right panel
  useEffect(() => {
    api.get("/alerts?isResolved=false")
      .then((res) => {
        const data = res.data?.alerts ?? [];
        setAlertsCount(data.length);
        setRecentAlerts(data.slice(0, 4));
      })
      .catch(() => {});
  }, [location.pathname]);

  // Live sensor polling
  useEffect(() => {
    const poll = async () => {
      try {
        const data = await getLatestVitals();
        setLiveVitals(data);
        setSensorOnline(true);
      } catch {
        setSensorOnline(false);
      }
    };
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim())
      navigate(`/clinician/patients?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      {/* ── TOP NAVIGATION BAR ──────────────────────────────────────────────── */}
      <header className="bg-white/80 dark:bg-ink-900/80 backdrop-blur-md border-b border-gray-100 dark:border-ink-700 flex items-center px-6 py-3 gap-6 flex-shrink-0 z-30">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-blue-600 flex items-center justify-center shadow-sm">
            <Activity size={18} className="text-white" />
          </div>
          <span className="font-bold text-gray-800 dark:text-gray-100 text-lg tracking-tight">
            Vital<span className="text-brand">X</span> <span className="text-sm font-normal text-gray-500 dark:text-gray-400">Clinician</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-1 flex-1">
          {TOP_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive ? "bg-brand text-white shadow-md" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-ink-800 hover:text-gray-800 dark:hover:text-gray-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {item.badge && alertsCount > 0 && (
                    <span className={`text-[10px] font-bold rounded-full px-1.5 py-px leading-none ${isActive ? "bg-coral-400 text-white" : "bg-coral-100 text-coral-500"}`}>
                      {alertsCount > 99 ? "99+" : alertsCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right: search + bell + user */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Search */}
          <form onSubmit={handleSearch} className="relative hidden lg:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients…"
              className="pl-8 pr-4 py-2 text-sm border border-ink-200 rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 w-48 transition"
            />
          </form>

          {/* Bell */}
          <button
            onClick={() => navigate("/clinician/alerts")}
            className="relative icon-btn"
            aria-label="Alerts"
          >
            <Bell size={17} />
            {alertsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-coral-400 rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* User */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-ink-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {getInitials(user?.name)}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-ink-900 leading-none truncate max-w-[110px]">
                  {user?.name || "Clinician"}
                </p>
                <p className="text-[10px] text-ink-400 mt-0.5 capitalize">Clinician</p>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-2xl shadow-card-hover border border-ink-100 py-2 z-50 animate-fade-in">
                <div className="px-4 py-2 border-b border-ink-100 mb-1">
                  <p className="text-sm font-semibold text-ink-900 truncate">{user?.name}</p>
                  <p className="text-xs text-ink-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); navigate("/clinician/settings"); }}
                  className="w-full text-left px-4 py-2 text-sm text-ink-700 hover:bg-ink-50 transition-colors"
                >
                  ⚙ Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-coral-500 hover:bg-coral-50 transition-colors flex items-center gap-2"
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── BODY ROW ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative pb-16 md:pb-0">
        {/* ── LEFT ICON SIDEBAR (Hidden on mobile) ─────────────────────────────────────────────── */}
        <aside className="hidden md:flex w-14 bg-surface border-r border-ink-200 flex-col items-center py-4 gap-2 flex-shrink-0 overflow-y-auto scrollbar-hide">
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

          {/* Bottom: sensor dot */}
          <div className="mt-auto">
            <div
              className={`w-9 h-9 flex items-center justify-center rounded-full ${
                sensorOnline ? "bg-teal-50 text-teal-500" : "bg-ink-100 text-ink-400"
              }`}
              title={sensorOnline ? "Sensor Online" : "Sensor Offline"}
            >
              {sensorOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="p-6">
            <Outlet />
          </div>
        </main>

        {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
        <aside className="w-72 bg-white border-l border-ink-200 flex flex-col overflow-y-auto scrollbar-hide flex-shrink-0 hidden lg:flex">
          {/* Live Sensor */}
          <div className="p-4 border-b border-ink-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-ink-900">Live Sensor</p>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  sensorOnline
                    ? "bg-teal-50 text-teal-600"
                    : "bg-ink-100 text-ink-500"
                }`}
              >
                {sensorOnline ? "● Online" : "○ Offline"}
              </span>
            </div>

            {liveVitals ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-3 bg-coral-50 rounded-xl border border-coral-100">
                  <Heart size={13} className="text-coral-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-ink-900">{liveVitals.heartRate}</p>
                  <p className="text-[10px] text-ink-400">bpm</p>
                </div>
                <div className="text-center p-3 bg-teal-50 rounded-xl border border-teal-100">
                  <Monitor size={13} className="text-teal-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-ink-900">{liveVitals.spo2}</p>
                  <p className="text-[10px] text-ink-400">SpO₂ %</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-400 text-center py-2">No active reading</p>
            )}
          </div>

          {/* Recent Alerts Panel */}
          <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-ink-900">Recent Alerts</p>
              <button
                onClick={() => navigate("/clinician/alerts")}
                className="text-xs text-teal-500 hover:text-teal-700 font-medium"
              >
                View all
              </button>
            </div>

            {/* Urgent banner */}
            {recentAlerts.some((a) => a.severity === "CRITICAL") && (
              <div className="flex items-start gap-2.5 bg-coral-50 border border-coral-100 rounded-xl p-3 mb-3">
                <div className="w-6 h-6 rounded-lg bg-coral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle size={12} className="text-coral-500" />
                </div>
                <p className="text-xs text-ink-700 flex-1 leading-relaxed">
                  Critical alert requires immediate attention
                </p>
                <button
                  onClick={() => navigate("/clinician/alerts")}
                  className="text-[10px] font-bold bg-ink-900 text-white px-2 py-1 rounded-lg flex-shrink-0 hover:bg-ink-800 transition-colors"
                >
                  Review
                </button>
              </div>
            )}

            <div className="space-y-2">
              {recentAlerts.map((alert) => {
                const isCritical = alert.severity?.toUpperCase() === "CRITICAL";
                const patientName =
                  alert.patientId?.name ?? alert.patientName ?? "Unknown";
                return (
                  <button
                    key={alert._id}
                    onClick={() => navigate("/clinician/alerts")}
                    className="w-full text-left flex items-start gap-2.5 p-3 rounded-xl hover:bg-ink-50 transition-colors group"
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isCritical ? "bg-coral-100" : "bg-amber-100"
                      }`}
                    >
                      <AlertTriangle
                        size={12}
                        className={isCritical ? "text-coral-500" : "text-amber-500"}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-ink-800 truncate">
                        {patientName}
                      </p>
                      <p className="text-[11px] text-ink-500 truncate mt-0.5">
                        {alert.message ?? alert.type ?? "Alert"}
                      </p>
                      <p className="text-[10px] text-ink-400 mt-0.5">
                        {formatTimeAgo(alert.timestamp ?? alert.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        isCritical
                          ? "bg-coral-50 text-coral-500"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {isCritical ? "Critical" : "Warning"}
                    </span>
                  </button>
                );
              })}

              {recentAlerts.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-xs text-ink-400">No active alerts</p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="p-4 border-t border-ink-100">
            <button
              onClick={() => navigate("/clinician/patients")}
              className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors shadow-sm"
            >
              <Plus size={15} />
              Add Patient
            </button>
          </div>
        </aside>

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
              <div className="relative">
                <a.icon size={22} />
                {a.label === "Alerts" && alertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-coral-400 rounded-full ring-2 ring-white" />
                )}
              </div>
              <span className="text-[10px] font-medium mt-1">{a.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
