import { useState, useEffect, useRef } from "react";
import {
  Heart,
  Activity,
  AlertCircle,
  Phone,
  MapPin,
  Calculator,
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff,
  Plus,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { getReadings, classifyReading } from "../../api/readings";
import { getPatient } from "../../api/patients";
import { ref, onValue, off, update, push, remove } from "firebase/database";
import { rtdb } from "../../api/firebase";
import StatusBadge from "../../components/StatusBadge";
import SparklineChart from "../../components/SparklineChart";
import LoadingSpinner from "../../components/LoadingSpinner";
import AIAssistant from "../../components/AIAssistant";
import { useAuth } from "../../context/AuthContext";
import { MOCK_PATIENTS, MOCK_READINGS, getChartData } from "../../api/mockData";

// ── Helpers ────────────────────────────────────────────────────────────────────
const calcBMI = (weight, height) => {
  if (!weight || !height) return null;
  const bmi = weight / (height / 100) ** 2;
  return {
    value: bmi.toFixed(1),
    label:
      bmi < 18.5
        ? "Underweight"
        : bmi < 25
          ? "Normal"
          : bmi < 30
            ? "Overweight"
            : "Obese",
    color:
      bmi < 18.5
        ? "text-blue-600"
        : bmi < 25
          ? "text-green-600"
          : bmi < 30
            ? "text-amber-600"
            : "text-red-600",
    bg:
      bmi < 18.5
        ? "bg-blue-50"
        : bmi < 25
          ? "bg-green-50"
          : bmi < 30
            ? "bg-amber-50"
            : "bg-red-50",
    border:
      bmi < 18.5
        ? "border-blue-200"
        : bmi < 25
          ? "border-green-200"
          : bmi < 30
            ? "border-amber-200"
            : "border-red-200",
  };
};

const STATUS_BANNER = {
  NORMAL: {
    bg: "bg-green-50  border-green-200",
    text: "text-green-700",
    icon: null,
    msg: "Your vital signs are within the normal range. Keep up the healthy lifestyle!",
  },
  WARNING: {
    bg: "bg-amber-50  border-amber-200",
    text: "text-amber-700",
    icon: AlertCircle,
    msg: "Some readings need attention. Please contact your healthcare provider soon.",
  },
  CRITICAL: {
    bg: "bg-red-50    border-red-300",
    text: "text-red-700",
    icon: AlertCircle,
    msg: "Critical reading detected. Seek immediate medical attention.",
  },
};

const MOCK_CONTACTS = [
  {
    name: "Dr. Sarah Adams",
    role: "Primary Clinician",
    phone: "+1 (555) 123-4567",
  },
  { name: "Mary Smith", role: "Emergency Contact", phone: "+1 (555) 765-4321" },
];

const generateHistory = () =>
  Array.from({ length: 12 }, (_, i) => ({
    time: new Date(Date.now() - (11 - i) * 15 * 60000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    spo2: 94 + Math.floor(Math.random() * 5),
    hr: 68 + Math.floor(Math.random() * 20),
  }));

export default function PatientDashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [patient,  setPatient]  = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [history,  setHistory]  = useState(() => generateHistory());

  // Live sensor from RTDB /vitals/latest
  const [liveVitals,   setLiveVitals]   = useState(null);
  const [sensorOnline, setSensorOnline] = useState(false);

  // BMI calculator state
  const [bmiWeight, setBmiWeight] = useState("");
  const [bmiHeight, setBmiHeight] = useState("");
  const [bmiResult, setBmiResult] = useState(null);
  const [savingBmi, setSavingBmi] = useState(false);

  // Location sharing
  const [locConsent, setLocConsent] = useState(false);
  const [savingLoc, setSavingLoc]   = useState(false);

  // Emergency contacts
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", role: "", phone: "" });
  const [savingContact, setSavingContact] = useState(false);

  // ── Listen to /vitals/latest in RTDB for live sensor data ──────────────────
  useEffect(() => {
    const vitalsRef = ref(rtdb, 'vitals/latest');
    const unsub = onValue(vitalsRef, (snap) => {
      if (snap.exists()) {
        setLiveVitals(snap.val());
        setSensorOnline(true);
      } else {
        setSensorOnline(false);
      }
    }, () => setSensorOnline(false));
    return () => off(vitalsRef);
  }, []);

  // ── Load patient profile + historical readings from RTDB ────────────────────
  useEffect(() => {
    if (!user) return;

    const profile = {
      _id:       user.uid,
      name:      user.name      || 'Patient',
      email:     user.email,
      memberId:  user.memberId  || '—',
      gender:    user.gender    || '—',
      dob:       user.dob       || null,
      phone:     user.phone     || '—',
      status:    'NORMAL',
      latestReading: null,
      emergencyContacts: [],
    };
    setPatient(profile);
    setLocConsent(false);

    // Fetch full profile from RTDB to get BMI, Location, Contacts
    getPatient(user.uid).then(dbProfile => {
      if (dbProfile) {
        setPatient(prev => ({ ...prev, ...dbProfile }));
        setLocConsent(dbProfile.location?.enabled || false);
        if (dbProfile.bmi) {
           setBmiWeight(dbProfile.bmi.weight || "");
           setBmiHeight(dbProfile.bmi.height || "");
           setBmiResult(calcBMI(dbProfile.bmi.weight, dbProfile.bmi.height));
        }
      }
    });

    // Load readings from RTDB /readings/{uid}
    getReadings(user.uid, 20)
      .then((rds) => {
        setReadings(rds);
        if (rds.length > 0) {
          const latest = rds[0];
          setPatient((prev) => ({
            ...prev,
            status: latest.status || classifyReading(latest.spo2, latest.heartRate),
            latestReading: { hr: latest.heartRate, spo2: latest.spo2 },
          }));
          // Build chart history from readings
          const hist = [...rds].reverse().map((r) => ({
            time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            spo2: r.spo2,
            hr:   r.heartRate,
          }));
          setHistory(hist.length > 0 ? hist : generateHistory());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const latestHr = patient?.latestReading?.hr ?? 72;
  const latestSpo2 = patient?.latestReading?.spo2 ?? 98;
  const status = (patient?.status ?? "NORMAL").toUpperCase();
  const banner = STATUS_BANNER[status] ?? STATUS_BANNER.NORMAL;
  const BannerIcon = banner.icon;

  const hrData = history.map((h) => h.hr);
  const spo2Data = history.map((h) => h.spo2);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleLocationToggle = async () => {
    const newState = !locConsent;
    if (newState) {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
      }
      setSavingLoc(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            await update(ref(rtdb, `users/${user.uid}/location`), {
              enabled: true,
              lat: latitude,
              lng: longitude,
              updatedAt: Date.now()
            });
            setLocConsent(true);
          } catch (e) {
            alert("Failed to save location");
          }
          setSavingLoc(false);
        },
        (error) => {
          alert("Unable to retrieve your location. Please check browser permissions.");
          setSavingLoc(false);
        }
      );
    } else {
      setSavingLoc(true);
      try {
        await update(ref(rtdb, `users/${user.uid}/location`), { enabled: false });
        setLocConsent(false);
      } catch (e) {
        alert("Failed to disable location");
      }
      setSavingLoc(false);
    }
  };

  const handleCalculateBMI = async () => {
    if (!bmiWeight || !bmiHeight) return;
    const result = calcBMI(bmiWeight, bmiHeight);
    setBmiResult(result);
    setSavingBmi(true);
    try {
      await update(ref(rtdb, `users/${user.uid}/bmi`), {
        weight: bmiWeight,
        height: bmiHeight,
        value: result.value
      });
    } catch { /* silent */ }
    setSavingBmi(false);
  };

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.phone) return;
    setSavingContact(true);
    try {
      const newRef = push(ref(rtdb, `users/${user.uid}/emergencyContacts`));
      await update(newRef, newContact);
      
      const newContactWithId = { ...newContact, _id: newRef.key };
      setPatient(prev => ({
        ...prev,
        emergencyContacts: { ...(prev.emergencyContacts || {}), [newRef.key]: newContactWithId }
      }));
      
      setNewContact({ name: "", role: "", phone: "" });
      setShowAddContact(false);
    } catch (e) {
      alert("Failed to add contact");
    }
    setSavingContact(false);
  };
  
  const handleRemoveContact = async (id) => {
    try {
      await remove(ref(rtdb, `users/${user.uid}/emergencyContacts/${id}`));
      setPatient(prev => {
        const updated = { ...(prev.emergencyContacts || {}) };
        delete updated[id];
        return { ...prev, emergencyContacts: updated };
      });
    } catch { /* silent */ }
  };

  if (loading) return <LoadingSpinner message="Loading your dashboard…" />;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-white dark:bg-ink-800 border border-gray-100 dark:border-ink-700 shadow-sm rounded-2xl p-6 text-gray-800 dark:text-gray-100">
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-0.5">
          {new Date().toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h2 className="text-xl font-bold">
          Hello, {patient?.name || user?.name || "Patient"}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Membership ID:{" "}
          <span className="font-mono text-gray-700 dark:text-gray-300">
            {patient?.memberId || user?.memberId || "—"}
          </span>
        </p>
      </div>

      {/* Status banner */}
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border ${banner.bg}`}
      >
        {BannerIcon && (
          <BannerIcon
            size={18}
            className={`${banner.text} flex-shrink-0 mt-0.5`}
          />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={status} size="md" />
            <span className={`text-sm font-bold ${banner.text}`}>{status}</span>
          </div>
          <p className={`text-sm ${banner.text}`}>{banner.msg}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main column ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Vital cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* SpO2 */}
            <div className="bg-white dark:bg-ink-800 rounded-xl border border-gray-100 dark:border-ink-700 shadow-sm p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Activity size={14} className="text-brand" />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    SpO2
                  </span>
                </div>
                <StatusBadge status={status} />
              </div>
              <div className="flex items-end gap-1 mb-3">
                <p className="text-4xl font-bold text-gray-800 dark:text-gray-100 ">{latestSpo2}</p>
                <p className="text-lg text-gray-500 dark:text-gray-400 mb-1">%</p>
              </div>
              <div className="h-12">
                <SparklineChart data={spo2Data} color="#3b82f6" tooltip />
              </div>
            </div>

            {/* HR */}
            <div className="bg-white dark:bg-ink-800 rounded-xl border border-gray-100 dark:border-ink-700 shadow-sm p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-red-100 rounded-lg">
                    <Heart size={14} className="text-red-500" />
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Heart Rate
                  </span>
                </div>
                <StatusBadge status={status} />
              </div>
              <div className="flex items-end gap-1 mb-3">
                <p className="text-4xl font-bold text-gray-800 dark:text-gray-100 ">{latestHr}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">bpm</p>
              </div>
              <div className="h-12">
                <SparklineChart data={hrData} color="#ef4444" tooltip />
              </div>
            </div>
          </div>

          {/* Sparkline history chart */}
          <div className="bg-white dark:bg-ink-800 rounded-xl border border-gray-100 dark:border-ink-700 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-ink-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 ">
                Recent Activity
              </h3>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-red-400 inline-block rounded" />{" "}
                  HR
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-brand inline-block rounded" />{" "}
                  SpO2
                </span>
              </div>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart
                  data={history}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    interval="preserveStartEnd"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    domain={[40, 150]}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[85, 102]}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="hr"
                    stroke="#ef4444"
                    name="HR"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="spo2"
                    stroke="#3b82f6"
                    name="SpO2"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* BMI Calculator */}
          <div className="bg-white dark:bg-ink-800 rounded-xl border border-gray-100 dark:border-ink-700 shadow-sm p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-violet-100 rounded-lg">
                <Calculator size={14} className="text-violet-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 ">
                BMI Calculator
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  value={bmiWeight}
                  onChange={(e) => {
                    setBmiWeight(e.target.value);
                    setBmiResult(null);
                  }}
                  placeholder="e.g. 70"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-ink-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  value={bmiHeight}
                  onChange={(e) => {
                    setBmiHeight(e.target.value);
                    setBmiResult(null);
                  }}
                  placeholder="e.g. 175"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-ink-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>
            </div>

            <button
              onClick={handleCalculateBMI}
              disabled={!bmiWeight || !bmiHeight || savingBmi}
              className="w-full py-2 bg-gradient-to-r from-violet-500 to-violet-600 shadow-md text-white text-sm font-semibold rounded-lg hover:from-violet-600 hover:to-violet-700 hover:shadow-lg transition-all duration-300 disabled:opacity-40 mb-3 flex items-center justify-center gap-2"
            >
              {savingBmi ? <LoadingSpinner size="14px" /> : null}
              {savingBmi ? "Saving..." : "Calculate & Save BMI"}
            </button>

            {bmiResult && (
              <div
                className={`p-4 rounded-xl border text-center ${bmiResult.bg} ${bmiResult.border}`}
              >
                <p className={`text-3xl font-bold ${bmiResult.color}`}>
                  {bmiResult.value}
                </p>
                <p className={`text-sm font-semibold mt-1 ${bmiResult.color}`}>
                  {bmiResult.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {bmiResult.label === "Normal"
                    ? "✓ Healthy weight range"
                    : bmiResult.label === "Underweight"
                      ? "Consider consulting your doctor."
                      : bmiResult.label === "Overweight"
                        ? "Diet and exercise recommended."
                        : "Medical advice recommended."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* AI Assistant */}
          <AIAssistant 
            vitals={{ 
              hr: latestHr, 
              spo2: latestSpo2, 
              bmi: bmiResult?.value 
            }} 
          />

          {/* Emergency contacts */}
          <div className="bg-white dark:bg-ink-800 rounded-xl border border-gray-100 dark:border-ink-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-100 rounded-lg">
                  <Phone size={14} className="text-red-500" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 ">
                  Emergency Contacts
                </h3>
              </div>
              <button onClick={() => setShowAddContact(!showAddContact)} className="icon-btn w-6 h-6 text-brand hover:bg-brand/10 bg-brand/5 rounded-full">
                <Plus size={14} />
              </button>
            </div>
            
            {showAddContact && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-ink-900 border border-gray-100 dark:border-ink-700 rounded-xl space-y-2">
                <input placeholder="Name" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:border-brand" />
                <input placeholder="Role (e.g. Spouse)" value={newContact.role} onChange={e => setNewContact({...newContact, role: e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:border-brand" />
                <input placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:border-brand" />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setShowAddContact(false)} className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 rounded-lg">Cancel</button>
                  <button onClick={handleAddContact} disabled={savingContact} className="px-3 py-1 text-xs bg-brand text-white hover:bg-brand-600 rounded-lg">Save</button>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              {Object.entries(patient?.emergencyContacts || {}).length > 0 ? (
                Object.entries(patient.emergencyContacts).map(([id, c]) => (
                  <div
                    key={id}
                    className="p-3 bg-gray-50 dark:bg-ink-900 rounded-xl border border-gray-100 dark:border-ink-700 relative group"
                  >
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 ">
                      {c.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.role}</p>
                    <a
                      href={`tel:${c.phone}`}
                      className="text-xs text-brand hover:underline font-medium mt-0.5 flex items-center gap-1"
                    >
                      <Phone size={11} /> {c.phone}
                    </a>
                    <button onClick={() => handleRemoveContact(id)} className="absolute top-3 right-3 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus size={14} className="rotate-45" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">No emergency contacts added.</p>
              )}
            </div>
          </div>

          {/* Location sharing */}
          <div className="bg-white dark:bg-ink-800 rounded-xl border border-gray-100 dark:border-ink-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg">
                  <MapPin size={14} className="text-green-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 ">
                  Location Sharing
                </h3>
              </div>
              <button
                onClick={handleLocationToggle}
                disabled={savingLoc}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${locConsent ? "bg-brand" : "bg-gray-200"} disabled:opacity-60`}
                role="switch"
                aria-checked={locConsent}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white dark:bg-ink-800 shadow transition-transform ${locConsent ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {locConsent
                ? "Your location is being shared with your care team for emergency use."
                : "Enable to share your location with your care team in emergencies."}
            </p>
          </div>

          {/* Quick vitals summary */}
          <div className="bg-white dark:bg-ink-800 rounded-xl border border-gray-100 dark:border-ink-700 shadow-sm p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
              Vitals Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">SpO2</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-gray-100 dark:bg-ink-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${latestSpo2}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    {latestSpo2}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Heart Rate</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-gray-100 dark:bg-ink-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{
                        width: `${Math.min((latestHr / 120) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    {latestHr} bpm
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
