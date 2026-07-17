import { useState } from 'react';
import { User, Bell, Shield, Save, CheckCircle, Eye, EyeOff, Mail, Phone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-teal-500' : 'bg-ink-200'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white dark:bg-ink-800 shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="vx-card">
      <div className="px-5 py-4 border-b border-ink-100">
        <h3 className="text-sm font-bold text-ink-900 dark:text-gray-100 ">{title}</h3>
        {subtitle && <p className="text-xs text-ink-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function ClinicianSettings() {
  const { user } = useAuth();

  const [profile, setProfile] = useState({
    name:  user?.name  || '',
    email: user?.email || '',
    phone: user?.phone || '',
    title: user?.title || 'Senior Clinician',
    department: user?.department || 'Cardiology',
  });

  const [notifications, setNotifications] = useState({
    criticalAlerts:  true,
    warningAlerts:   true,
    resolvedAlerts:  false,
    weeklyReports:   true,
    emailAlerts:     true,
    smsAlerts:       false,
    browserPush:     true,
  });

  const [thresholdDefaults, setThresholdDefaults] = useState({
    spo2Min: 90, spo2Max: 100, hrMin: 60, hrMax: 100,
  });

  const [savedProfile, setSavedProfile] = useState(false);
  const [showPwd,     setShowPwd]      = useState(false);
  const [newPassword, setNewPassword]  = useState('');
  const [savedPwd,    setSavedPwd]     = useState(false);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 2500);
  };

  const handleSavePwd = (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return;
    setSavedPwd(true);
    setNewPassword('');
    setTimeout(() => setSavedPwd(false), 2500);
  };

  const InputField = ({ label, value, onChange, type = 'text', icon: Icon, disabled }) => (
    <div>
      <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1">{label}</label>
      <div className="relative">
        {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />}
        <input
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`w-full text-sm border border-ink-200 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400 transition ${Icon ? 'pl-9 pr-3' : 'px-3'} ${disabled ? 'bg-ink-50 text-ink-400 cursor-not-allowed' : 'bg-white dark:bg-ink-800 '}`}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile */}
      <Section title="Profile Information" subtitle="Update your personal and professional details">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 bg-brand/10 rounded-2xl flex items-center justify-center text-brand text-xl font-bold">
              {(user?.name || 'C').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 ">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              <button type="button" className="text-xs text-brand hover:underline mt-0.5">Change photo</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputField label="Full Name" icon={User}
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <InputField label="Email" icon={Mail} type="email" disabled
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            <InputField label="Phone" icon={Phone}
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            <InputField label="Title / Position"
              value={profile.title}
              onChange={(e) => setProfile({ ...profile, title: e.target.value })} />
            <div className="col-span-2">
              <InputField label="Department"
                value={profile.department}
                onChange={(e) => setProfile({ ...profile, department: e.target.value })} />
            </div>
          </div>

          <button type="submit"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${savedProfile ? 'bg-teal-50 text-teal-700' : 'bg-teal-500 text-white hover:bg-teal-600'}`}>
            {savedProfile ? <><CheckCircle size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
          </button>
        </form>
      </Section>

      {/* Notifications */}
      <Section title="Notification Preferences" subtitle="Choose how and when you receive alerts">
        <div className="space-y-4">
          {[
            { key: 'criticalAlerts', label: 'Critical patient alerts',     desc: 'Immediate notify on CRITICAL status' },
            { key: 'warningAlerts',  label: 'Warning patient alerts',      desc: 'Notify on WARNING status changes'     },
            { key: 'resolvedAlerts', label: 'Alert resolved confirmations', desc: 'Notify when alerts are marked resolved' },
            { key: 'weeklyReports',  label: 'Weekly summary reports',      desc: 'Receive weekly digest every Monday'   },
            { key: 'emailAlerts',    label: 'Email notifications',         desc: 'Send alerts to your email address'    },
            { key: 'smsAlerts',      label: 'SMS notifications',           desc: 'Send alerts via text message'         },
            { key: 'browserPush',    label: 'Browser push notifications',  desc: 'Desktop push alerts in browser'       },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-ink-700">{label}</p>
                <p className="text-xs text-ink-400">{desc}</p>
              </div>
              <Toggle
                checked={notifications[key]}
                onChange={(v) => setNotifications((prev) => ({ ...prev, [key]: v }))}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Default thresholds */}
      <Section title="Default Alert Thresholds" subtitle="Applied when adding new patients without custom thresholds">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'SpO₂ Min (%)', key: 'spo2Min' },
            { label: 'SpO₂ Max (%)', key: 'spo2Max' },
            { label: 'HR Min (bpm)', key: 'hrMin'   },
            { label: 'HR Max (bpm)', key: 'hrMax'   },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-ink-600 dark:text-gray-300 mb-1">{label}</label>
              <input
                type="number"
                value={thresholdDefaults[key]}
                onChange={(e) => setThresholdDefaults((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                className="w-full text-sm border border-ink-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400"
              />
            </div>
          ))}
        </div>
        <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold rounded-xl transition-colors">
          <Save size={14} /> Save Defaults
        </button>
      </Section>

      {/* Security */}
      <Section title="Security" subtitle="Change your password and manage account security">
        <form onSubmit={handleSavePwd} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">New Password</label>
            <div className="relative">
              <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full pl-9 pr-10 py-2 text-sm border border-gray-200 dark:border-ink-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
              <button type="button" onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-300">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={newPassword.length < 6}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              savedPwd
                ? 'bg-teal-50 text-teal-700'
                : 'bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {savedPwd ? <><CheckCircle size={14} /> Password updated!</> : <><Shield size={14} /> Update Password</>}
          </button>
        </form>
      </Section>
    </div>
  );
}
