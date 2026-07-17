import { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle, CheckCircle, MapPin, Clock, User, Bell,
} from "lucide-react";
import { getAlerts, resolveAlert } from "../../api/alerts";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { useWebLLMContext } from "../../context/WebLLMContext";
import { Sparkles, Loader2 } from "lucide-react";

const formatTimeAgo = (d) => {
  if (!d) return "—";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

const normalizeAlerts = (alts) =>
  alts.map((a) => ({
    ...a,
    type: a.message ?? a.type,
    memberId: a.membershipId ?? a.memberId,
    hr: a.heartRate ?? a.hr,
    location: a.gpsCoordinates ?? a.location ?? null,
    status: a.status ?? (a.resolvedAt ? "resolved" : "unresolved"),
    createdAt: a.timestamp ?? a.createdAt,
  }));

const FILTER_TABS = [
  { key: "all",      label: "All Alerts" },
  { key: "CRITICAL", label: "Critical"   },
  { key: "WARNING",  label: "Warning"    },
  { key: "resolved", label: "Resolved"   },
];

export default function Alerts() {
  const [alerts,    setAlerts]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("all");
  const [resolving, setResolving] = useState(null);
  
  const { chat, isReady } = useWebLLMContext();
  const [triageResults, setTriageResults] = useState({});
  const [analyzing, setAnalyzing] = useState(null);

  useEffect(() => {
    getAlerts()
      .then((alts) => setAlerts(normalizeAlerts(alts)))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return alerts;
    if (filter === "resolved") return alerts.filter((a) => a.status === "resolved");
    return alerts.filter(
      (a) => (a.severity || "").toUpperCase() === filter && a.status !== "resolved",
    );
  }, [alerts, filter]);

  const handleResolve = async (alertId) => {
    setResolving(alertId);
    try { await resolveAlert(alertId); } catch { /* optimistic */ }
    setAlerts((prev) =>
      prev.map((a) => (a._id === alertId ? { ...a, status: "resolved" } : a)),
    );
    setResolving(null);
  };

  const handleTriage = async (alert) => {
    if (!isReady || analyzing === alert._id) return;
    setAnalyzing(alert._id);
    try {
      const prompt = `You are a clinical AI triage assistant. Analyze this medical alert: Patient ${alert.patientName}, HR: ${alert.hr} bpm, SpO2: ${alert.spo2}%. Severity marked as ${alert.severity}. Provide a very concise 1-2 sentence triage assessment. Do not hallucinate.`;
      const response = await chat(prompt, "Triage this alert.");
      if (response) {
        setTriageResults(prev => ({ ...prev, [alert._id]: response }));
      }
    } catch (e) {
      console.error(e);
      setTriageResults(prev => ({ ...prev, [alert._id]: "Analysis failed." }));
    } finally {
      setAnalyzing(null);
    }
  };

  const counts = {
    all: alerts.length,
    CRITICAL: alerts.filter((a) => (a.severity || "").toUpperCase() === "CRITICAL" && a.status !== "resolved").length,
    WARNING:  alerts.filter((a) => (a.severity || "").toUpperCase() === "WARNING"  && a.status !== "resolved").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
  };

  if (loading) return <LoadingSpinner message="Loading alerts…" />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink-900 dark:text-gray-100 ">Alerts & Notifications</h2>
          <p className="text-xs text-ink-400 mt-0.5">
            {counts.CRITICAL + counts.WARNING} unresolved alerts
          </p>
        </div>
        {counts.CRITICAL + counts.WARNING > 0 && (
          <div className="flex items-center gap-2 bg-coral-50 border border-coral-100 text-coral-600 text-sm px-4 py-2 rounded-xl">
            <Bell size={14} className="animate-pulse" />
            <span className="font-semibold">{counts.CRITICAL + counts.WARNING} require attention</span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-ink-100 rounded-xl p-1 w-fit">
        {FILTER_TABS.map((tab) => {
          const count = tab.key === "all" ? counts.all : tab.key === "resolved" ? counts.resolved : counts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === tab.key
                  ? "bg-white dark:bg-ink-800 text-ink-900 dark:text-gray-100 shadow-sm"
                  : "text-ink-500 dark:text-gray-400 hover:text-ink-800 dark:text-gray-200"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  filter === tab.key
                    ? tab.key === "CRITICAL" ? "bg-coral-100 text-coral-600"
                    : tab.key === "WARNING"  ? "bg-amber-100 text-amber-600"
                    : "bg-ink-100 text-ink-600 dark:text-gray-300"
                    : "bg-ink-200 text-ink-500 dark:text-gray-400"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Alert cards */}
      <div className="space-y-3">
        {filtered.map((alert) => {
          const isCritical = (alert.severity || "").toUpperCase() === "CRITICAL";
          const isResolved = alert.status === "resolved";

          return (
            <div
              key={alert._id}
              className={`vx-card overflow-hidden flex transition-opacity ${
                isResolved ? "opacity-60" : ""
              }`}
            >
              {/* Severity left bar */}
              <div className={`w-1 flex-shrink-0 ${
                isResolved ? "bg-ink-300"
                : isCritical ? "bg-coral-400"
                : "bg-amber-400"
              }`} />

              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Left info */}
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl flex-shrink-0 ${
                      isResolved ? "bg-ink-100"
                      : isCritical ? "bg-coral-50"
                      : "bg-amber-50"
                    }`}>
                      <AlertTriangle
                        size={16}
                        className={isResolved ? "text-ink-400" : isCritical ? "text-coral-500" : "text-amber-500"}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-ink-800 dark:text-gray-200">{alert.type}</p>
                        <StatusBadge status={isResolved ? "RESOLVED" : alert.severity} />
                      </div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <User size={12} className="text-ink-400" />
                        <p className="text-xs text-ink-600 dark:text-gray-300 font-medium">{alert.patientName}</p>
                        <span className="text-ink-300">·</span>
                        <span className="text-xs font-mono text-ink-400">{alert.memberId}</span>
                      </div>
                      {/* Vitals */}
                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-coral-400 rounded-full" />
                          <span className="font-mono font-semibold text-ink-700">HR: {alert.hr} bpm</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-teal-400 rounded-full" />
                          <span className="font-mono font-semibold text-ink-700">SpO₂: {alert.spo2}%</span>
                        </span>
                        {alert.location && (
                          <span className="flex items-center gap-1 text-ink-400">
                            <MapPin size={11} />
                            <span>{alert.location.lat?.toFixed(4)}°, {alert.location.lng?.toFixed(4)}°</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: time + action */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 text-ink-400 text-xs">
                      <Clock size={11} />
                      <span>{formatTimeAgo(alert.createdAt)}</span>
                    </div>
                    {!isResolved && (
                      <button
                        onClick={() => handleResolve(alert._id)}
                        disabled={resolving === alert._id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                      >
                        {resolving === alert._id ? "Resolving…" : (
                          <><CheckCircle size={14} /> Resolve</>
                        )}
                      </button>
                    )}
                    {isReady && !triageResults[alert._id] && !isResolved && (
                      <button
                        onClick={() => handleTriage(alert)}
                        disabled={analyzing === alert._id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                      >
                        {analyzing === alert._id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        {analyzing === alert._id ? "Analyzing..." : "AI Triage"}
                      </button>
                    )}
                    {isResolved && (
                      <span className="flex items-center gap-1 text-xs text-teal-600 font-medium">
                        <CheckCircle size={12} /> Resolved
                      </span>
                    )}
                  </div>
                </div>

                {/* AI Triage Result */}
                {triageResults[alert._id] && (
                  <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-start gap-2">
                    <Sparkles size={14} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-0.5">AI Triage Context</p>
                      <p className="text-xs text-indigo-900 font-medium leading-relaxed">{triageResults[alert._id]}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={Bell}
          title="No alerts found"
          description={
            filter === "all"
              ? "All clear! No alerts in the system."
              : `No ${filter.toLowerCase()} alerts at this time.`
          }
        />
      )}
    </div>
  );
}
