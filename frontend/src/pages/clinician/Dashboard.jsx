import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Heart, AlertCircle, Monitor, Wifi, WifiOff,
  ArrowUpRight, TrendingUp, Activity, Clock, Eye, Search,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getAllPatients } from "../../api/patients";
import { useAuth } from "../../context/AuthContext";
import StatusBadge from "../../components/StatusBadge";
import SparklineChart from "../../components/SparklineChart";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import {
  MOCK_PATIENTS, MOCK_ALERTS, MOCK_DASHBOARD_STATS, getLiveOverviewData,
} from "../../api/mockData";

// ── Helpers ────────────────────────────────────────────────────────────────────
const getInitials = (name = "") =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "??";

const formatTimeAgo = (date) => {
  if (!date) return "—";
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

const generateLiveData = () =>
  Array.from({ length: 20 }, (_, i) => {
    const t = new Date(Date.now() - (19 - i) * 3 * 60 * 1000);
    return {
      time: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      hr:   62 + Math.floor(Math.random() * 28),
      spo2: 94 + Math.floor(Math.random() * 5),
    };
  });

const HR_SPARK   = [72, 75, 71, 78, 74, 72, 76, 73, 71, 74];
const SPO2_SPARK = [98, 97, 98, 99, 97, 98, 98, 97, 99, 98];

// Trends and appointments will be derived dynamically in the component.

const charBadge = (c) => {
  if (c === "Critical")
    return <span className="badge-coral">Critical</span>;
  if (c === "Warning")
    return <span className="bg-amber-50 text-amber-600 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">Warning</span>;
  return <span className="badge-teal">Normal</span>;
};

// ── Custom chart tooltip ───────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-900 text-white text-xs px-3 py-2 rounded-xl shadow-lg">
      <p className="font-medium mb-1 text-ink-300">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.stroke }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ── Normalizers ────────────────────────────────────────────────────────────────
const normalizePts = (pts) =>
  pts.map((p) => ({
    ...p,
    memberId: p.membershipId ?? p.memberId,
    status:   p.latestReading?.status ?? p.status,
    updatedAt: p.latestReading?.timestamp ?? p.updatedAt,
    latestReading: p.latestReading
      ? { hr: p.latestReading.heartRate ?? p.latestReading.hr, spo2: p.latestReading.spo2 }
      : null,
  }));

// ── Week calendar helper ───────────────────────────────────────────────────────
const getWeekDays = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: d.getDate(), isToday: d.toDateString() === today.toDateString(), isWeekend: i >= 5 };
  });
};
const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Component ──────────────────────────────────────────────────────────────────
export default function ClinicianDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patients,  setPatients]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [chartData, setChartData] = useState([]);
  const [stats,     setStats]     = useState({ total: 0, normal: 0, warning: 0, critical: 0, live: 0 });
  const weekDays = getWeekDays();

  useEffect(() => {
    (async () => {
      try {
        const pats = await getAllPatients();
        setPatients(pats);
        setStats({
          total:    pats.length,
          normal:   pats.filter((p) => (p.status || "").toUpperCase() === "NORMAL").length,
          warning:  pats.filter((p) => (p.status || "").toUpperCase() === "WARNING").length,
          critical: pats.filter((p) => (p.status || "").toUpperCase() === "CRITICAL").length,
          live:     pats.filter((p) => p.latestReading).length, // approximate live
        });
        setChartData(generateLiveData());
      } catch {
        setPatients([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const derivedTrends = [
    { disease: "Critical Anomalies", characteristic: "Critical", patients: stats.critical, recoveries: 0 },
    { disease: "Elevated Risks",     characteristic: "Warning",  patients: stats.warning,  recoveries: 0 },
    { disease: "Stable Vitals",      characteristic: "Normal",   patients: stats.normal,   recoveries: 0 },
  ];

  const derivedAppointments = patients
    .filter(p => (p.status || "").toUpperCase() === "WARNING" || (p.status || "").toUpperCase() === "CRITICAL")
    .slice(0, 3)
    .map((p, i) => ({ time: `${10 + i}:00 AM`, patient: p.name, type: "Follow-up Review" }));
    
  if (derivedAppointments.length === 0 && patients.length > 0) {
    derivedAppointments.push({ time: "09:00 AM", patient: patients[0].name, type: "Routine Check-up" });
  }

  if (loading) return <LoadingSpinner message="Loading dashboard…" />;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Statistical Summary ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold text-ink-900 mb-4">Statistical Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* Total Patients */}
          <div className="vx-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">Number of patients</p>
                <select className="mt-1 text-xs text-ink-600 border border-ink-200 rounded-lg px-2 py-0.5 bg-transparent">
                  <option>Week</option><option>Month</option><option>Year</option>
                </select>
              </div>
              <button className="teal-circle-btn"><ArrowUpRight size={16} /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-400 flex items-center gap-1.5">
                    <Users size={11} /> Adult Patients
                  </p>
                  <p className="text-2xl font-bold text-ink-900 mt-0.5">{stats.normal + stats.warning}</p>
                </div>
                <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-ink-200 text-ink-400 hover:border-teal-300 transition-colors text-xs">⤢</button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-400 flex items-center gap-1.5">
                    <Users size={11} /> Critical
                  </p>
                  <p className="text-2xl font-bold text-ink-900 mt-0.5">{stats.critical}</p>
                </div>
                <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-ink-200 text-ink-400 hover:border-teal-300 transition-colors text-xs">⤢</button>
              </div>
            </div>
          </div>

          {/* Live Sensor / Daily Readings */}
          <div className="vx-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">Daily Readings</p>
                <select className="mt-1 text-xs text-ink-600 border border-ink-200 rounded-lg px-2 py-0.5 bg-transparent">
                  <option>Week</option><option>Month</option>
                </select>
              </div>
              <button className="teal-circle-btn"><ArrowUpRight size={16} /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-400 flex items-center gap-1.5">
                    <Heart size={11} /> Normal Readings
                  </p>
                  <p className="text-2xl font-bold text-ink-900 mt-0.5">{stats.normal}</p>
                </div>
                <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-ink-200 text-ink-400 hover:border-teal-300 transition-colors text-xs">⤢</button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-400 flex items-center gap-1.5">
                    <AlertCircle size={11} /> Warnings
                  </p>
                  <p className="text-2xl font-bold text-ink-900 mt-0.5">{stats.warning}</p>
                </div>
                <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-ink-200 text-ink-400 hover:border-teal-300 transition-colors text-xs">⤢</button>
              </div>
            </div>
          </div>

          {/* Monitoring Status */}
          <div className="vx-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">Monitoring Status</p>
                <select className="mt-1 text-xs text-ink-600 border border-ink-200 rounded-lg px-2 py-0.5 bg-transparent">
                  <option>Live</option><option>Day</option>
                </select>
              </div>
              <button className="teal-circle-btn"><ArrowUpRight size={16} /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-400 flex items-center gap-1.5">
                    <Wifi size={11} /> Devices Online
                  </p>
                  <p className="text-2xl font-bold text-ink-900 mt-0.5">{stats.live}</p>
                </div>
                <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-ink-200 text-ink-400 hover:border-teal-300 transition-colors text-xs">⤢</button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-400 flex items-center gap-1.5">
                    <WifiOff size={11} /> Offline
                  </p>
                  <p className="text-2xl font-bold text-ink-900 mt-0.5">{stats.total - stats.live}</p>
                </div>
                <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-ink-200 text-ink-400 hover:border-teal-300 transition-colors text-xs">⤢</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom 2-column grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Health Trends Table */}
        <div className="vx-card">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-900">Health Trends</h3>
            <div className="flex items-center gap-2">
              <button className="icon-btn w-7 h-7"><Search size={13} /></button>
              <button className="flex items-center gap-1 text-xs text-ink-600 border border-ink-200 rounded-lg px-2 py-1 hover:border-teal-300 transition-colors">
                Dec 24 <span className="text-[10px]">▾</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  {["Condition", "Status", "Patients", "Recoveries"].map((h) => (
                    <th key={h} className="text-xs font-medium text-ink-400 px-5 py-3 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {derivedTrends.map((row) => (
                  <tr key={row.disease} className="hover:bg-ink-50/50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-ink-800">{row.disease}</td>
                    <td className="px-5 py-3">{charBadge(row.characteristic)}</td>
                    <td className="px-5 py-3 text-sm text-ink-700">{row.patients}</td>
                    <td className="px-5 py-3 text-sm text-ink-700">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Patient Schedule / Recent Patients */}
        <div className="vx-card">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-900">Patient Schedule</h3>
            <div className="flex items-center gap-2">
              <button className="icon-btn w-7 h-7"><Search size={13} /></button>
              <button className="flex items-center gap-1 text-xs text-ink-600 border border-ink-200 rounded-lg px-2 py-1 hover:border-teal-300 transition-colors">
                Dec 24 <span className="text-[10px]">▾</span>
              </button>
            </div>
          </div>

          {/* Week calendar row */}
          <div className="px-5 py-3 border-b border-ink-50">
            <div className="grid grid-cols-7 gap-1">
              {WEEK_LABELS.map((lbl, i) => (
                <div key={lbl} className="text-center">
                  <p className="text-[10px] text-ink-400 mb-1">{lbl}</p>
                  <div
                    className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                      weekDays[i]?.isToday
                        ? "bg-teal-500 text-white shadow-sm"
                        : weekDays[i]?.isWeekend
                        ? "bg-coral-50 text-coral-500"
                        : "text-ink-700 hover:bg-ink-100"
                    }`}
                  >
                    {weekDays[i]?.date}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Appointments */}
          <div className="divide-y divide-ink-50">
            {derivedAppointments.length > 0 ? (
              derivedAppointments.map((appt, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-ink-50/50 transition-colors">
                  <span className="text-xs font-mono font-bold text-teal-600 w-20 flex-shrink-0">
                    {appt.time}
                  </span>
                  <div className="flex-1 min-w-0 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">
                    <p className="text-xs font-semibold text-ink-800 truncate">{appt.patient}</p>
                    <p className="text-[11px] text-ink-500">{appt.type}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-ink-400 text-xs">No appointments scheduled</div>
            )}
          </div>

          {/* Clinician row */}
          <div className="px-5 py-3 border-t border-ink-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {getInitials("Dr. Admin")}
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-800">Clinician</p>
              <p className="text-[11px] text-ink-400">{user?.name || "Your account"}</p>
            </div>
            <div className="ml-auto flex -space-x-1">
              {patients.slice(0, 4).map((p) => (
                <div key={p._id} className="w-6 h-6 rounded-full bg-teal-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-teal-700">
                  {getInitials(p.name)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Patients Table ────────────────────────────────────────────── */}
      <div className="vx-card">
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink-900">Recent Patients</h3>
          <button
            onClick={() => navigate("/clinician/patients")}
            className="text-xs text-teal-500 hover:text-teal-700 font-medium flex items-center gap-1"
          >
            View all <ArrowUpRight size={12} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px]">
            <thead>
              <tr>
                {["Patient", "Status", "Heart Rate", "SpO₂", "Last Updated", ""].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-ink-400 px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {patients.slice(0, 6).map((patient) => (
                <tr
                  key={patient._id}
                  className="hover:bg-teal-50/30 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/clinician/patients/${patient._id}`)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
                        {getInitials(patient.name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink-800">{patient.name}</p>
                        <p className="text-xs text-ink-400 font-mono">{patient.memberId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={patient.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="w-16 h-7">
                      <SparklineChart data={HR_SPARK} color="#F45D52" />
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          (patient.latestReading?.spo2 ?? 98) >= 95
                            ? "bg-teal-500"
                            : (patient.latestReading?.spo2 ?? 98) >= 90
                            ? "bg-amber-500"
                            : "bg-coral-500"
                        }`}
                      />
                      <span className="text-sm font-medium text-ink-700">
                        {patient.latestReading?.spo2 ?? "—"}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-ink-400">
                      <Clock size={11} />
                      <span className="text-xs">{formatTimeAgo(patient.updatedAt)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/clinician/patients/${patient._id}`); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-ink-200 text-ink-400 hover:border-teal-300 hover:text-teal-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {patients.length === 0 && <EmptyState icon={Users} title="No patients yet" description="Patient records will appear here once added." />}
        </div>
      </div>

      {/* ── Live Overview Chart ──────────────────────────────────────────────── */}
      <div className="vx-card">
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink-900">Live Overview</h3>
            <p className="text-xs text-ink-400 mt-0.5">Real-time HR & SpO₂ — last 60 min</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-400">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-coral-400 inline-block rounded" /> Heart Rate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-teal-500 inline-block rounded" /> SpO₂
            </span>
          </div>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#B0B4BF" }} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: "#E4E6EB" }} />
              <YAxis yAxisId="left"  domain={[40, 150]} tick={{ fontSize: 10, fill: "#B0B4BF" }} tickLine={false} axisLine={false} width={28} />
              <YAxis yAxisId="right" orientation="right" domain={[85, 102]} tick={{ fontSize: 10, fill: "#B0B4BF" }} tickLine={false} axisLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Line yAxisId="left"  type="monotone" dataKey="hr"   stroke="#F45D52" name="Heart Rate" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line yAxisId="right" type="monotone" dataKey="spo2" stroke="#3AA49E" name="SpO₂"       dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
