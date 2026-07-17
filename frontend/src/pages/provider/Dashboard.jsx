import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Users, Activity, AlertCircle, Clock,
  ArrowRight, CheckCircle, Heart, Wifi,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllReadings } from '../../api/readings';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '../../api/firebase';
import LoadingSpinner from '../../components/LoadingSpinner';

// ── Style maps ────────────────────────────────────────────────────────────────
const STATUS_DOT = { NORMAL: 'bg-teal-500', WARNING: 'bg-amber-500', CRITICAL: 'bg-coral-500' };
const STATUS_BADGE = {
  NORMAL:   'text-teal-700 bg-teal-50 border-teal-200',
  WARNING:  'text-amber-700 bg-amber-50 border-amber-200',
  CRITICAL: 'text-coral-600 bg-coral-50 border-coral-200',
};

const formatTime = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const timeAgo = (ts) => {
  if (!ts) return '—';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
};

export default function ProviderDashboard() {
  const navigate = useNavigate();
  const { user }  = useAuth();

  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [stats,    setStats]    = useState({ seen: 0, captured: 0, alerts: 0 });
  const [liveData, setLiveData] = useState(null);

  // ── Live sensor (RTDB /vitals/latest) ────────────────────────────────────
  useEffect(() => {
    const vitalsRef = ref(rtdb, 'vitals/latest');
    const unsub = onValue(vitalsRef, (snap) => {
      if (snap.exists()) setLiveData(snap.val());
    });
    return () => off(vitalsRef);
  }, []);

  // ── Load today's readings from RTDB ──────────────────────────────────────
  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    getAllReadings(100)
      .then((all) => {
        // Filter to today's only
        const today = all.filter((r) => (r.timestamp || 0) >= todayStart.getTime());

        // Build activity rows
        const rows = today.map((r) => ({
          id:       r._id,
          patient:  r.patientName || 'Patient',
          patientId: r.patientId,
          memberId: r.memberId   || '—',
          result:   r.status     || 'NORMAL',
          spo2:     r.spo2       || 0,
          hr:       r.heartRate  || 0,
          time:     r.timestamp,
        }));

        setActivity(rows);
        setStats({
          seen:     new Set(rows.map((r) => r.patientId)).size,
          captured: rows.length,
          alerts:   rows.filter((r) => r.result !== 'NORMAL').length,
        });
      })
      .catch(() => {
        setActivity([]);
        setStats({ seen: 0, captured: 0, alerts: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard…" />;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Welcome header ──────────────────────────────────────────────── */}
      <div className="vx-card bg-ink-900 p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-ink-400 text-sm mb-1">Good {greeting()},</p>
            <h2 className="text-xl font-bold">{user?.name || 'Healthcare Provider'}</h2>
            <p className="text-ink-400 text-sm mt-1">
              {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button onClick={() => navigate('/provider/capture')}
            className="flex items-center gap-2.5 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-teal-500/20">
            <Camera size={18} /> Capture New Reading <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Live sensor card ────────────────────────────────────────────── */}
      {liveData && (
        <div className="vx-card p-5 border-teal-200 bg-teal-50/50">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse flex-shrink-0" />
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Live Sensor — /vitals/latest</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 sm:gap-8">
            <div>
              <p className="text-xs text-ink-500 dark:text-gray-400">Heart Rate</p>
              <p className="text-2xl font-bold text-ink-900 dark:text-gray-100 ">{liveData.heartRate} <span className="text-sm font-normal text-ink-400">bpm</span></p>
            </div>
            <div>
              <p className="text-xs text-ink-500 dark:text-gray-400">SpO₂</p>
              <p className="text-2xl font-bold text-ink-900 dark:text-gray-100 ">{liveData.spo2}<span className="text-sm font-normal text-ink-400">%</span></p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-ink-400">Last update</p>
              <p className="text-xs font-mono text-ink-600 dark:text-gray-300">Just now</p>
              <button onClick={() => navigate('/provider/capture')}
                className="mt-2 text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1 ml-auto">
                Link to patient <ArrowRight size={11} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Patients Seen', value: stats.seen,     icon: Users,         color: 'text-teal-600',  bg: 'bg-teal-50'  },
          { label: 'Readings Today', value: stats.captured, icon: Activity,      color: 'text-blue-600',  bg: 'bg-blue-50'  },
          { label: 'Alerts',         value: stats.alerts,   icon: AlertCircle,   color: 'text-coral-500', bg: 'bg-coral-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="vx-card p-5">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-bold text-ink-900 dark:text-gray-100 ">{value}</p>
            <p className="text-xs text-ink-500 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => navigate('/provider/capture')}
          className="vx-card p-6 text-left hover:border-teal-300 transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-3 group-hover:bg-teal-100 transition-colors">
            <Camera size={20} className="text-teal-600" />
          </div>
          <h3 className="text-sm font-bold text-ink-900 dark:text-gray-100 mb-1">Capture New Reading</h3>
          <p className="text-xs text-ink-500 dark:text-gray-400">Identify patient and record SpO₂ & HR from device</p>
          <div className="flex items-center gap-1 mt-3 text-teal-500 text-xs font-semibold">
            Start now <ArrowRight size={12} />
          </div>
        </button>

        <button onClick={() => navigate('/provider/patients')}
          className="vx-card p-6 text-left hover:border-teal-300 transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-ink-50 flex items-center justify-center mb-3 group-hover:bg-ink-100 transition-colors">
            <Users size={20} className="text-ink-600 dark:text-gray-300" />
          </div>
          <h3 className="text-sm font-bold text-ink-900 dark:text-gray-100 mb-1">Find Patient</h3>
          <p className="text-xs text-ink-500 dark:text-gray-400">Search by name or membership ID</p>
          <div className="flex items-center gap-1 mt-3 text-ink-500 dark:text-gray-400 text-xs font-semibold">
            Browse records <ArrowRight size={12} />
          </div>
        </button>
      </div>

      {/* ── Today's activity ─────────────────────────────────────────────── */}
      <div className="vx-card">
        <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink-900 dark:text-gray-100 ">Today's Activity</h3>
            <p className="text-xs text-ink-400 mt-0.5">{activity.length} reading{activity.length !== 1 ? 's' : ''} captured</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            <Clock size={12} />
            {new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </div>
        </div>

        <div className="divide-y divide-ink-50">
          {activity.map((item) => {
            const status = (item.result || 'NORMAL').toUpperCase();
            return (
              <div key={item.id} className="px-6 py-4 flex items-center gap-4 hover:bg-ink-50/40 transition-colors">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[status] ?? 'bg-ink-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800 dark:text-gray-200 truncate">{item.patient}</p>
                  <p className="text-xs text-ink-400 font-mono">{item.memberId}</p>
                </div>
                <div className="text-xs text-ink-600 dark:text-gray-300 hidden sm:flex items-center gap-4">
                  <span>HR: <strong>{item.hr}</strong></span>
                  <span>SpO₂: <strong>{item.spo2}%</strong></span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[status] ?? STATUS_BADGE.NORMAL}`}>
                  {status}
                </span>
                <div className="flex items-center gap-1 text-ink-400 text-xs flex-shrink-0">
                  <Clock size={11} /> {formatTime(item.time)}
                </div>
                {status === 'NORMAL'
                  ? <CheckCircle size={14} className="text-teal-500 flex-shrink-0" />
                  : <AlertCircle size={14} className={`flex-shrink-0 ${status === 'CRITICAL' ? 'text-coral-500' : 'text-amber-500'}`} />
                }
              </div>
            );
          })}

          {activity.length === 0 && (
            <div className="px-6 py-12 text-center">
              <Camera size={32} className="text-ink-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-ink-500 dark:text-gray-400">No readings captured today</p>
              <button onClick={() => navigate('/provider/capture')}
                className="mt-3 text-xs text-teal-500 hover:text-teal-600 font-medium">
                Capture first reading →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
