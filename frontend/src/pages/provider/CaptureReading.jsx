import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, User, CheckCircle, AlertCircle, Heart, Activity,
  ChevronRight, RotateCcw, MessageSquare, Wifi, Plus, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useVitalsListener from '../../hooks/useVitalsListener';
import { saveReading, classifyReading } from '../../api/readings';
import { ref, get } from 'firebase/database';
import { rtdb } from '../../api/firebase';

// ── Helpers ────────────────────────────────────────────────────────────────────
const calcBMI = (w, h) => {
  if (!w || !h || h <= 0) return null;
  const v = parseFloat(w) / (parseFloat(h) / 100) ** 2;
  const cls = v < 18.5 ? { label: 'Underweight', color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-200' }
            : v < 25   ? { label: 'Normal',      color: 'text-teal-600',  bg: 'bg-teal-50',  border: 'border-teal-200' }
            : v < 30   ? { label: 'Overweight',   color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' }
            :             { label: 'Obese',        color: 'text-coral-500', bg: 'bg-coral-50', border: 'border-coral-200' };
  return { value: v.toFixed(1), ...cls };
};

const STATUS_STYLES = {
  NORMAL:   { card: 'bg-teal-50 border-teal-300',  badge: 'bg-teal-500 text-white',  icon: CheckCircle, action: 'Continue regular monitoring.' },
  WARNING:  { card: 'bg-amber-50 border-amber-300', badge: 'bg-amber-500 text-white', icon: AlertCircle, action: 'Notify assigned clinician for review.' },
  CRITICAL: { card: 'bg-coral-50 border-coral-300', badge: 'bg-coral-500 text-white', icon: AlertCircle, action: 'Immediate medical attention required.' },
};

const getInitials = (n = '') => n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??';

// ── Step bar ───────────────────────────────────────────────────────────────────
function StepBar({ current }) {
  const steps = ['Identify Patient', 'BMI Entry', 'Capture Reading', 'Result'];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                done ? 'bg-teal-500 text-white' : active ? 'bg-teal-500 text-white ring-4 ring-teal-200' : 'bg-ink-100 text-ink-400'
              }`}>
                {done ? <CheckCircle size={16} /> : idx}
              </div>
              <p className={`text-[10px] mt-1 font-medium whitespace-nowrap ${active ? 'text-teal-600' : done ? 'text-teal-500' : 'text-ink-400'}`}>
                {label}
              </p>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 mt-[-12px] transition-colors ${idx < current ? 'bg-teal-400' : 'bg-ink-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CaptureReading() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { latestReading, waiting, startListening, stopListening } = useVitalsListener();

  const [step, setStep]             = useState(1);
  const [query, setQuery]           = useState('');
  const [searching, setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [patient, setPatient]       = useState(null);
  
  // New patient state
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: '', memberId: '', email: '', dob: '', gender: 'Male' });
  const [addingPatient, setAddingPatient] = useState(false);

  const [weight, setWeight]         = useState('');
  const [height, setHeight]         = useState('');
  const [bmi, setBmi]               = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [spo2, setSpo2]             = useState('');
  const [hr, setHr]                 = useState('');
  const [reading, setReading]       = useState(null);
  const [note, setNote]             = useState('');
  const [noteSaved, setNoteSaved]   = useState(false);
  const [saving, setSaving]         = useState(false);

  // ── When device data arrives, create the reading ──────────────────────────
  useEffect(() => {
    if (!latestReading || !patient) return;
    const status = classifyReading(latestReading.spo2, latestReading.heartRate);
    const r = {
      spo2:      latestReading.spo2,
      hr:        latestReading.heartRate,
      status,
      timestamp: new Date(),
    };
    setReading(r);
    stopListening();

    // Save to RTDB
    (async () => {
      setSaving(true);
      try {
        await saveReading(patient._id || patient.uid, {
          spo2:       r.spo2,
          heartRate:  r.hr,
          status:     r.status,
          bmi:        bmi?.value || null,
          weight:     weight || null,
          height:     height || null,
          capturedBy: user?.uid || 'provider',
          captureContext: 'clinical',
        });
      } catch { /* silent */ }
      setSaving(false);
    })();

    setStep(4);
  }, [latestReading]);

  // ── Patient search (looks in RTDB /users for patients) ────────────────────
  const searchPatient = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    setPatient(null);

    try {
      const snap = await get(ref(rtdb, 'users'));
      let results = [];
      if (snap.exists()) {
        const q = query.trim().toLowerCase();
        snap.forEach((child) => {
          const u = child.val();
          if (u.role === 'patient') {
            const matchId = u.memberId && u.memberId.toLowerCase().includes(q);
            const matchName = u.name && u.name.toLowerCase().includes(q);
            if (matchId || matchName) {
              const age = u.dob ? Math.floor((Date.now() - new Date(u.dob).getTime()) / (365.25 * 24 * 3600000)) : null;
              results.push({ _id: child.key, ...u, age });
            }
          }
        });
      }

      if (results.length > 0) {
        if (results.length === 1) {
          setPatient(results[0]);
        } else {
          setSearchResults(results);
        }
      } else {
        setSearchError('No patients found matching that name or ID.');
      }
    } catch {
      setSearchError('Could not search patients. Check your connection.');
    } finally {
      setSearching(false);
    }
  };

  // ── Add new patient inline ────────────────────────────────────────────────
  const handleAddPatient = async () => {
    if (!newPatient.name.trim() || !newPatient.memberId.trim()) {
      setSearchError('Name and Membership ID are required.');
      return;
    }
    setAddingPatient(true);
    setSearchError('');
    try {
      const { push: fbPush, set: fbSet } = await import('firebase/database');
      const newRef = fbPush(ref(rtdb, 'users'));
      const profile = {
        name: newPatient.name.trim(),
        memberId: newPatient.memberId.trim().toUpperCase(),
        email: newPatient.email.trim(),
        gender: newPatient.gender,
        dob: newPatient.dob,
        role: 'patient',
        createdAt: Date.now(),
        isActive: true,
      };
      await fbSet(newRef, profile);
      
      const age = profile.dob ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 24 * 3600000)) : null;
      setPatient({ _id: newRef.key, uid: newRef.key, ...profile, age });
      setShowAddPatient(false);
      setNewPatient({ name: '', memberId: '', email: '', dob: '', gender: 'Male' });
      setSearchResults([]);
      setQuery('');
    } catch {
      setSearchError('Failed to add new patient.');
    } finally {
      setAddingPatient(false);
    }
  };

  // ── Manual submit ─────────────────────────────────────────────────────────
  const handleManualSubmit = async () => {
    if (!spo2 || !hr || !patient) return;
    const status = classifyReading(spo2, hr);
    const r = { spo2: parseFloat(spo2), hr: parseFloat(hr), status, timestamp: new Date() };
    setReading(r);

    setSaving(true);
    try {
      await saveReading(patient._id || patient.uid, {
        spo2:       r.spo2,
        heartRate:  r.hr,
        status:     r.status,
        bmi:        bmi?.value || null,
        weight:     weight || null,
        height:     height || null,
        capturedBy: user?.uid || 'provider',
        captureContext: 'clinical',
      });
    } catch { /* silent */ }
    setSaving(false);
    setStep(4);
  };

  // ── Save note ─────────────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!note.trim() || !patient) return;
    // Save note to /notes/{patientId}/{pushId}
    try {
      const { push: fbPush, set: fbSet } = await import('firebase/database');
      const noteRef = fbPush(ref(rtdb, `notes/${patient._id || patient.uid}`));
      await fbSet(noteRef, {
        content: note,
        tags: ['Provider Visit'],
        authorId: user?.uid || 'provider',
        authorName: user?.name || 'Provider',
        timestamp: Date.now(),
      });
    } catch { /* silent */ }
    setNoteSaved(true);
  };

  const reset = () => {
    stopListening();
    setStep(1); setQuery(''); setPatient(null);
    setWeight(''); setHeight(''); setBmi(null);
    setManualMode(false); setSpo2(''); setHr('');
    setReading(null); setNote(''); setNoteSaved(false);
  };

  const resultStyle = reading ? (STATUS_STYLES[reading.status] ?? STATUS_STYLES.NORMAL) : null;
  const inputCls = 'w-full px-3 py-2.5 text-sm border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400';

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <StepBar current={step} />

      {/* ── STEP 1: Identify Patient ──────────────────────────────────────── */}
      {step === 1 && (
        <div className="vx-card p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-ink-900 dark:text-gray-100 mb-1">Identify Patient</h2>
            <p className="text-sm text-ink-500 dark:text-gray-400">Enter the patient's membership ID or email address.</p>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                type="text" value={query}
                onChange={(e) => { setQuery(e.target.value); setSearchError(''); setSearchResults([]); setPatient(null); }}
                onKeyDown={(e) => e.key === 'Enter' && searchPatient()}
                placeholder="Search by Membership ID or Name..."
                className={`${inputCls} pl-9`}
                disabled={showAddPatient}
              />
            </div>
            <button onClick={searchPatient} disabled={searching || !query.trim() || showAddPatient}
              className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
              {searching ? '…' : 'Search'}
            </button>
          </div>

          {!showAddPatient && !patient && searchResults.length === 0 && (
            <div className="text-right">
              <button onClick={() => setShowAddPatient(true)}
                className="text-teal-600 hover:text-teal-700 text-sm font-semibold flex items-center gap-1 ml-auto">
                <Plus size={14} /> Add New Patient
              </button>
            </div>
          )}

          {searchError && (
            <div className="flex items-center gap-2 text-coral-500 text-xs bg-coral-50 border border-coral-100 px-3 py-2 rounded-xl">
              <AlertCircle size={13} /> {searchError}
            </div>
          )}

          {/* Search Results List */}
          {searchResults.length > 0 && !patient && (
            <div className="border border-ink-200 rounded-xl divide-y divide-ink-100 overflow-hidden">
              <div className="px-4 py-2 bg-ink-50 text-xs font-semibold text-ink-500 dark:text-gray-400">Select a Patient ({searchResults.length} found)</div>
              {searchResults.map((p) => (
                <button key={p._id} onClick={() => { setPatient(p); setSearchResults([]); }}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-teal-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs">
                    {getInitials(p.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-ink-800 dark:text-gray-200 text-sm">{p.name}</p>
                    <p className="text-xs text-ink-500 dark:text-gray-400 font-mono">{p.memberId} {p.age ? `· ${p.age} yrs` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Inline Add Patient Form */}
          {showAddPatient && (
            <div className="p-5 bg-ink-50 border border-ink-200 rounded-xl space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-900 dark:text-gray-100 ">Add New Patient</h3>
                <button onClick={() => setShowAddPatient(false)} className="text-ink-400 hover:text-ink-600 dark:text-gray-300">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1">Full Name *</label>
                  <input value={newPatient.name} onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    className={inputCls} placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1">Membership ID *</label>
                  <input value={newPatient.memberId} onChange={(e) => setNewPatient({ ...newPatient, memberId: e.target.value })}
                    className={inputCls} placeholder="e.g. VX-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1">Email</label>
                  <input value={newPatient.email} onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                    className={inputCls} placeholder="Optional" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={handleAddPatient} disabled={addingPatient || !newPatient.name || !newPatient.memberId}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                  {addingPatient ? 'Saving...' : 'Save & Select Patient'}
                </button>
              </div>
            </div>
          )}

          {/* Selected Patient */}
          {patient && !showAddPatient && (
            <div className="flex items-center gap-4 p-4 bg-teal-50 border border-teal-200 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-teal-200 flex items-center justify-center text-teal-700 font-bold text-sm flex-shrink-0">
                {getInitials(patient.name)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-ink-800 dark:text-gray-200">{patient.name}</p>
                <p className="text-xs text-ink-500 dark:text-gray-400 font-mono">
                  {patient.memberId || patient.email} {patient.age ? `· ${patient.age} yrs` : ''} {patient.gender ? `· ${patient.gender}` : ''}
                </p>
              </div>
              <button onClick={() => { setPatient(null); setQuery(''); }}
                className="text-teal-600 hover:text-teal-800 text-xs font-semibold px-2 py-1 bg-teal-100 rounded-lg transition-colors">
                Change
              </button>
              <CheckCircle size={20} className="text-teal-500 flex-shrink-0 ml-1" />
            </div>
          )}

          <div className="flex justify-end">
            <button disabled={!patient} onClick={() => setStep(2)}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
              Continue <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: BMI Entry ─────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="vx-card p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-ink-900 dark:text-gray-100 mb-1">BMI Entry <span className="text-ink-400 font-normal text-sm">(optional)</span></h2>
            <p className="text-sm text-ink-500 dark:text-gray-400">Record patient's weight and height to calculate BMI.</p>
          </div>

          {patient && (
            <div className="flex items-center gap-3 p-3 bg-ink-50 rounded-xl border border-ink-100">
              <User size={16} className="text-ink-400" />
              <p className="text-sm font-medium text-ink-700">{patient.name} · {patient.memberId || patient.email}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1.5">Weight (kg)</label>
              <input type="number" value={weight} onChange={(e) => { setWeight(e.target.value); setBmi(null); }}
                placeholder="e.g. 75" min="10" max="300" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1.5">Height (cm)</label>
              <input type="number" value={height} onChange={(e) => { setHeight(e.target.value); setBmi(null); }}
                placeholder="e.g. 175" min="50" max="250" className={inputCls} />
            </div>
          </div>

          <button onClick={() => setBmi(calcBMI(weight, height))} disabled={!weight || !height}
            className="w-full py-2.5 bg-ink-100 hover:bg-ink-200 text-ink-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
            Calculate BMI
          </button>

          {bmi && (
            <div className={`p-4 rounded-xl border text-center ${bmi.bg} ${bmi.border}`}>
              <p className={`text-3xl font-bold ${bmi.color}`}>{bmi.value}</p>
              <p className={`text-sm font-semibold mt-1 ${bmi.color}`}>{bmi.label}</p>
              <p className="text-xs text-ink-500 dark:text-gray-400 mt-1">{weight}kg / {height}cm</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className="flex-1 py-2.5 rounded-xl border border-ink-200 text-sm text-ink-600 dark:text-gray-300 hover:bg-ink-50 transition-colors">
              Back
            </button>
            <button onClick={() => setStep(3)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold rounded-xl transition-colors">
              Continue <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Capture Reading ───────────────────────────────────────── */}
      {step === 3 && (
        <div className="vx-card bg-ink-900 p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-white mb-1">Reading Capture</h2>
            <p className="text-ink-400 text-sm">
              {manualMode ? 'Enter readings manually below.' : waiting ? 'Waiting for device data…' : 'Press the button below, then reset the sensor device.'}
            </p>
          </div>

          {!manualMode && (
            <>
              {/* Sensor animation */}
              <div className="flex flex-col items-center py-6">
                <div className={`relative w-28 h-28 rounded-full flex items-center justify-center ${
                  waiting ? 'bg-teal-500/20 animate-pulse' : 'bg-ink-800'
                } border-4 ${waiting ? 'border-teal-400' : 'border-ink-700'} transition-all`}>
                  {waiting ? (
                    <Wifi size={40} className="text-teal-400 animate-pulse" />
                  ) : (
                    <Heart size={40} className="text-ink-500 dark:text-gray-400" />
                  )}
                </div>

                {waiting ? (
                  <div className="mt-4 text-center">
                    <p className="text-white font-semibold">Listening for device…</p>
                    <p className="text-ink-400 text-xs mt-1">Press RESET on the ESP8266 and place finger on sensor</p>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-ping" />
                      <span className="text-teal-400 text-xs font-medium">Waiting for data…</span>
                    </div>
                  </div>
                ) : (
                  <button onClick={startListening}
                    className="mt-6 px-8 py-3 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-teal-500/30">
                    Start Listening for Sensor
                  </button>
                )}
              </div>

              <div className="text-center">
                <button onClick={() => setManualMode(true)}
                  className="text-ink-400 hover:text-white text-xs underline transition-colors">
                  Enter readings manually instead
                </button>
              </div>
            </>
          )}

          {manualMode && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-300 mb-1.5">
                    <Activity size={12} className="inline mr-1" /> SpO₂ (%)
                  </label>
                  <input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)}
                    placeholder="e.g. 97" min="70" max="100"
                    className="w-full px-3 py-2.5 text-sm bg-ink-800 border border-ink-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-ink-500 dark:text-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-300 mb-1.5">
                    <Heart size={12} className="inline mr-1" /> Heart Rate (bpm)
                  </label>
                  <input type="number" value={hr} onChange={(e) => setHr(e.target.value)}
                    placeholder="e.g. 72" min="30" max="250"
                    className="w-full px-3 py-2.5 text-sm bg-ink-800 border border-ink-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-ink-500 dark:text-gray-400" />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setManualMode(false)}
                  className="px-4 py-2.5 rounded-xl border border-ink-700 text-ink-300 text-sm hover:bg-ink-800 transition-colors">
                  Use Sensor
                </button>
                <button onClick={handleManualSubmit} disabled={!spo2 || !hr || saving}
                  className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                  {saving ? 'Saving…' : 'Submit Reading'}
                </button>
              </div>
            </div>
          )}

          <button onClick={() => { stopListening(); setStep(2); }}
            className="text-ink-500 dark:text-gray-400 hover:text-ink-300 text-xs transition-colors w-full text-center">
            ← Back to BMI entry
          </button>
        </div>
      )}

      {/* ── STEP 4: Result ────────────────────────────────────────────────── */}
      {step === 4 && reading && resultStyle && (
        <div className="space-y-4 animate-fade-in">
          <div className={`rounded-2xl border-2 p-8 text-center ${resultStyle.card}`}>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-bold mb-4 ${resultStyle.badge}`}>
              <resultStyle.icon size={16} /> {reading.status}
            </div>

            <div className="grid grid-cols-2 gap-6 mb-4">
              <div>
                <p className="text-4xl font-bold text-ink-900 dark:text-gray-100 ">{reading.spo2}%</p>
                <p className="text-sm text-ink-500 dark:text-gray-400 mt-1">SpO₂ — Oxygen Saturation</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-ink-900 dark:text-gray-100 ">{reading.hr}</p>
                <p className="text-sm text-ink-500 dark:text-gray-400 mt-1">Heart Rate (bpm)</p>
              </div>
            </div>

            {bmi && <p className="text-sm text-ink-600 dark:text-gray-300 mb-2">BMI: <strong>{bmi.value}</strong> — {bmi.label}</p>}
            <p className="text-sm font-medium text-ink-700 bg-white dark:bg-ink-800 /60 rounded-xl px-4 py-2 inline-block">{resultStyle.action}</p>
          </div>

          {reading.status === 'CRITICAL' && (
            <div className="flex items-start gap-3 p-4 bg-coral-50 border border-coral-200 rounded-xl">
              <AlertCircle size={18} className="text-coral-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-coral-600">Critical Reading Detected</p>
                <p className="text-xs text-coral-500 mt-0.5">This reading has been flagged. Please notify the assigned clinician immediately.</p>
              </div>
            </div>
          )}

          <div className="vx-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={15} className="text-ink-400" />
              <h4 className="text-sm font-semibold text-ink-700">Session Note (optional)</h4>
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Add any clinical observations or instructions…" rows={3}
              className={`${inputCls} resize-none`} disabled={noteSaved} />
            {!noteSaved ? (
              <button onClick={handleSaveNote} disabled={!note.trim()}
                className="mt-2 px-3 py-1.5 text-xs bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-medium transition-colors disabled:opacity-40">
                Save Note
              </button>
            ) : (
              <p className="text-xs text-teal-600 flex items-center gap-1 mt-2"><CheckCircle size={12} /> Note saved</p>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-ink-200 text-sm font-semibold text-ink-600 dark:text-gray-300 hover:bg-ink-50 transition-colors">
              <RotateCcw size={15} /> New Reading
            </button>
            <button onClick={() => navigate('/provider/dashboard')}
              className="flex-1 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
