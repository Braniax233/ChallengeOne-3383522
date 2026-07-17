import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Activity, CheckCircle, AlertCircle, Wifi, RotateCcw, WifiOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useVitalsListener from '../../hooks/useVitalsListener';
import { saveReading, classifyReading } from '../../api/readings';

const STATUS_STYLES = {
  NORMAL:   { card: 'bg-teal-50 border-teal-300',  badge: 'bg-teal-500 text-white',  icon: CheckCircle, msg: 'Your vitals look great! Keep it up.' },
  WARNING:  { card: 'bg-amber-50 border-amber-300', badge: 'bg-amber-500 text-white', icon: AlertCircle, msg: 'Some readings are outside normal range. Please consult your clinician.' },
  CRITICAL: { card: 'bg-coral-50 border-coral-300', badge: 'bg-coral-500 text-white', icon: AlertCircle, msg: 'Critical reading detected. Please seek medical attention immediately.' },
};

export default function PatientCapture() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const { latestReading, waiting, startListening, stopListening } = useVitalsListener();

  const [reading, setReading] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [spo2, setSpo2] = useState('');
  const [hr, setHr]     = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); };
    const handleOffline = () => { 
      setIsOffline(true);
      setManualMode(true); 
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) setManualMode(true);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── When device data arrives ──────────────────────────────────────────────
  useEffect(() => {
    if (!latestReading || !user) return;
    const status = classifyReading(latestReading.spo2, latestReading.heartRate);
    const r = { spo2: latestReading.spo2, hr: latestReading.heartRate, status, timestamp: new Date() };
    setReading(r);
    stopListening();

    (async () => {
      setSaving(true);
      try {
        await saveReading(user.uid, {
          spo2:           r.spo2,
          heartRate:      r.hr,
          status:         r.status,
          capturedBy:     user.uid,
          captureContext: 'home',
        });
      } catch { /* silent */ }
      setSaving(false);
    })();
  }, [latestReading]);

  // ── Manual submit ─────────────────────────────────────────────────────────
  const handleManualSubmit = async () => {
    if (!spo2 || !hr || !user) return;
    const status = classifyReading(spo2, hr);
    const r = { spo2: parseFloat(spo2), hr: parseFloat(hr), status, timestamp: new Date() };
    setReading(r);

    setSaving(true);
    try {
      await saveReading(user.uid, {
        spo2:           r.spo2,
        heartRate:      r.hr,
        status:         r.status,
        capturedBy:     user.uid,
        captureContext: 'home',
      });
    } catch { /* silent */ }
    setSaving(false);
  };

  const reset = () => {
    stopListening();
    setReading(null);
    setManualMode(false);
    setSpo2(''); setHr('');
  };

  const resultStyle = reading ? (STATUS_STYLES[reading.status] ?? STATUS_STYLES.NORMAL) : null;
  const inputCls = 'w-full px-3 py-2.5 text-sm border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400';

  // ── Result view ───────────────────────────────────────────────────────────
  if (reading && resultStyle) {
    return (
      <div className="max-w-md mx-auto space-y-4 animate-fade-in">
        <div className={`rounded-2xl border-2 p-8 text-center ${resultStyle.card}`}>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-bold mb-4 ${resultStyle.badge}`}>
            <resultStyle.icon size={16} /> {reading.status}
          </div>
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <p className="text-4xl font-bold text-ink-900">{reading.spo2}%</p>
              <p className="text-sm text-ink-500 mt-1">SpO₂</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-ink-900">{reading.hr}</p>
              <p className="text-sm text-ink-500 mt-1">Heart Rate</p>
            </div>
          </div>
          <p className="text-sm text-ink-600">{resultStyle.msg}</p>
          {saving && <p className="text-xs text-ink-400 mt-2">Saving reading…</p>}
          {!saving && isOffline && <p className="text-xs text-amber-600 mt-2 font-medium">Saved to offline queue. Will sync when reconnected.</p>}
        </div>

        {reading.status === 'CRITICAL' && (
          <div className="flex items-start gap-3 p-4 bg-coral-50 border border-coral-200 rounded-xl">
            <AlertCircle size={18} className="text-coral-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-coral-600">Please seek medical attention</p>
              <p className="text-xs text-coral-500 mt-0.5">Your reading is critically abnormal. Contact your healthcare provider immediately.</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-ink-200 text-sm font-semibold text-ink-600 hover:bg-ink-50 transition-colors">
            <RotateCcw size={15} /> Take Another
          </button>
          <button onClick={() => navigate('/patient/dashboard')}
            className="flex-1 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold transition-colors">
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Capture view ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <div className="vx-card bg-ink-900 p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-lg font-bold text-white mb-1">Capture Your Vitals</h2>
          {isOffline && (
            <div className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-3 py-2 rounded-lg mt-2 mb-3 flex items-start gap-2 text-left">
              <WifiOff size={14} className="mt-0.5 flex-shrink-0" />
              <p>You are offline. Hardware sync is disabled. Please enter readings manually. They will be saved to your device and synced automatically when you reconnect.</p>
            </div>
          )}
          <p className="text-ink-400 text-sm">
            {manualMode
              ? 'Enter your readings manually below.'
              : waiting
                ? 'Waiting for sensor data…'
                : 'Press the button, then reset your device and place your finger on the sensor.'}
          </p>
        </div>

        {!manualMode && (
          <>
            <div className="flex flex-col items-center py-6">
              <div className={`relative w-28 h-28 rounded-full flex items-center justify-center ${
                waiting ? 'bg-teal-500/20 animate-pulse' : 'bg-ink-800'
              } border-4 ${waiting ? 'border-teal-400' : 'border-ink-700'} transition-all`}>
                {waiting ? (
                  <Wifi size={40} className="text-teal-400 animate-pulse" />
                ) : (
                  <Heart size={40} className="text-ink-500" />
                )}
              </div>

              {waiting ? (
                <div className="mt-4 text-center">
                  <p className="text-white font-semibold">Listening for device…</p>
                  <p className="text-ink-400 text-xs mt-1">Press RESET on the sensor and place your finger</p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="w-2 h-2 bg-teal-400 rounded-full animate-ping" />
                    <span className="text-teal-400 text-xs font-medium">Waiting for data…</span>
                  </div>
                </div>
              ) : (
                <button onClick={startListening}
                  className="mt-6 px-8 py-3 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-teal-500/30">
                  Start Capture
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
                  className="w-full px-3 py-2.5 text-sm bg-ink-800 border border-ink-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-ink-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-300 mb-1.5">
                  <Heart size={12} className="inline mr-1" /> Heart Rate (bpm)
                </label>
                <input type="number" value={hr} onChange={(e) => setHr(e.target.value)}
                  placeholder="e.g. 72" min="30" max="250"
                  className="w-full px-3 py-2.5 text-sm bg-ink-800 border border-ink-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-ink-500" />
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
      </div>
    </div>
  );
}
