/**
 * pages/patient/SMSSettings.jsx
 * Patient SMS notification settings page.
 * Lets the patient:
 *   - Toggle SMS alerts on/off
 *   - Toggle Warning/Critical separately
 *   - Enable location sharing in alerts
 *   - Add/remove emergency contacts
 */

import { useState, useEffect } from 'react';
import {
  MessageSquare, Plus, Trash2, MapPin, Bell, BellOff,
  ShieldCheck, AlertTriangle, User, Phone, Heart, Save,
  Loader2, CheckCircle, ToggleLeft, ToggleRight, Navigation, Send,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSmsSettings, saveSmsSettings, addContact, removeContact, getCurrentLocation } from '../../api/smsSettings';
import { sendSMS } from '../../api/sms';

function Toggle({ value, onChange, label, icon: Icon, color = 'teal' }) {
  const colors = {
    teal:  { on: 'bg-teal-500',  icon: 'text-teal-600'  },
    amber: { on: 'bg-amber-500', icon: 'text-amber-600' },
    coral: { on: 'bg-coral-500', icon: 'text-coral-600' },
  };
  const c = colors[color] || colors.teal;
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center justify-between w-full p-4 rounded-xl border border-ink-100 hover:bg-ink-50 transition-colors group"
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon size={18} className={value ? c.icon : 'text-ink-400'} />}
        <span className={`text-sm font-medium ${value ? 'text-ink-800' : 'text-ink-500'}`}>{label}</span>
      </div>
      <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${value ? c.on : 'bg-ink-200'}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </div>
    </button>
  );
}

export default function SMSSettings() {
  const { user } = useAuth();

  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  // New contact form
  const [newName,     setNewName]     = useState('');
  const [newPhone,    setNewPhone]    = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Location test
  const [locTesting,  setLocTesting]  = useState(false);
  const [locResult,   setLocResult]   = useState(null);

  // Test SMS
  const [testSending, setTestSending] = useState(false);
  const [testResult,  setTestResult]  = useState(null);

  useEffect(() => {
    if (!user) return;
    getSmsSettings(user.uid).then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, [user]);

  const updateSetting = (key, val) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!user || !settings) return;
    setSaving(true);
    await saveSmsSettings(user.uid, settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAddContact = async () => {
    if (!newName || !newPhone || !user) return;
    setAddingContact(true);
    const updated = await addContact(user.uid, { name: newName, phone: newPhone, relation: newRelation });
    setSettings(updated);
    setNewName(''); setNewPhone(''); setNewRelation('');
    setShowAddForm(false);
    setAddingContact(false);
  };

  const handleRemoveContact = async (id) => {
    if (!user) return;
    const updated = await removeContact(user.uid, id);
    setSettings(updated);
  };

  const handleTestLocation = async () => {
    setLocTesting(true);
    setLocResult(null);
    try {
      const loc = await getCurrentLocation();
      setLocResult({ success: true, lat: loc.lat, lng: loc.lng });
    } catch (err) {
      setLocResult({ success: false, error: err.message || 'Location permission denied.' });
    }
    setLocTesting(false);
  };

  const handleTestSMS = async () => {
    // Collect all recipient numbers
    const recipients = [];
    if (user?.phone) recipients.push(user.phone);
    for (const c of settings?.contacts || []) {
      if (c.phone) recipients.push(c.phone);
    }

    if (recipients.length === 0) {
      setTestResult({ success: false, error: 'No phone numbers found. Update your profile or add an emergency contact.' });
      return;
    }

    setTestSending(true);
    setTestResult(null);
    const result = await sendSMS(recipients, `[VitalX Test] Hello ${user?.name || 'there'}! Your SMS alerts are working correctly. This is a test message from VitalX.`);
    
    // Customize success message based on how many were sent
    if (result.success) {
      const msg = recipients.length === 1 
        ? `Test SMS sent successfully to ${recipients[0]}! Check your phone.`
        : `Test SMS sent successfully to ${recipients.length} contacts! Check phones.`;
      setTestResult({ success: true, message: msg });
    } else {
      setTestResult(result);
    }
    
    setTestSending(false);
    setTimeout(() => setTestResult(null), 8000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-ink-900 dark:text-gray-100 flex items-center gap-2">
            <MessageSquare size={20} className="text-teal-500" />
            SMS Alert Settings
          </h2>
          <p className="text-xs text-ink-400 mt-0.5">
            Get a text message when your vitals are abnormal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestSMS}
            disabled={testSending}
            title={user?.phone ? `Send test SMS to ${user.phone}` : 'No phone number on account'}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {testSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {testSending ? 'Sending…' : 'Test SMS'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Test SMS result */}
      {testResult && (
        <div className={`flex items-start gap-2.5 p-4 rounded-xl text-sm font-medium border ${
          testResult.success
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {testResult.success ? <CheckCircle size={16} className="mt-0.5 flex-shrink-0" /> : <Send size={16} className="mt-0.5 flex-shrink-0" />}
          <div>
            {testResult.success
              ? testResult.message
              : `Failed: ${testResult.error}`}
          </div>
        </div>
      )}

      {/* Main toggles */}
      <div className="vx-card p-5 space-y-3">
        <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-1">Notifications</p>
        <Toggle
          value={settings.enabled}
          onChange={(v) => updateSetting('enabled', v)}
          label="Enable SMS alerts"
          icon={settings.enabled ? Bell : BellOff}
          color="teal"
        />
        {settings.enabled && (
          <>
            <Toggle
              value={settings.notifyOnWarning}
              onChange={(v) => updateSetting('notifyOnWarning', v)}
              label="Notify on Warning readings"
              icon={AlertTriangle}
              color="amber"
            />
            <Toggle
              value={settings.notifyOnCritical}
              onChange={(v) => updateSetting('notifyOnCritical', v)}
              label="Notify on Critical readings"
              icon={ShieldCheck}
              color="coral"
            />
          </>
        )}
      </div>

      {/* Location */}
      {settings.enabled && (
        <div className="vx-card p-5 space-y-3">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-1">Location</p>
          <Toggle
            value={settings.shareLocation}
            onChange={(v) => updateSetting('shareLocation', v)}
            label="Include my location in alert SMS"
            icon={Navigation}
            color="teal"
          />
          {settings.shareLocation && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 space-y-3">
              <p className="text-xs text-teal-700">
                When enabled, your GPS coordinates (as a Google Maps link) will be included in every alert SMS. Your browser will ask for permission the first time.
              </p>
              <button
                onClick={handleTestLocation}
                disabled={locTesting}
                className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {locTesting ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
                {locTesting ? 'Getting location…' : 'Test Location Access'}
              </button>
              {locResult && (
                <div className={`text-xs font-medium rounded-lg px-3 py-2 ${locResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {locResult.success
                    ? `Location found: ${locResult.lat.toFixed(5)}, ${locResult.lng.toFixed(5)}`
                    : `Error: ${locResult.error}`}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Emergency contacts */}
      {settings.enabled && (
        <div className="vx-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
              Emergency Contacts
            </p>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold rounded-lg border border-teal-200 transition-colors"
            >
              <Plus size={13} /> Add Contact
            </button>
          </div>

          <p className="text-xs text-ink-500">
            These people will receive the same SMS alert when your vitals are abnormal.
            Your own phone number on your account is always notified first.
          </p>

          {/* Add contact form */}
          {showAddForm && (
            <div className="bg-ink-50 border border-ink-100 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-ink-600 block mb-1">Name *</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Mum"
                    className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-600 block mb-1">Relation</label>
                  <input
                    value={newRelation}
                    onChange={(e) => setNewRelation(e.target.value)}
                    placeholder="e.g. Parent"
                    className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Phone Number *</label>
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. 0244123456"
                  type="tel"
                  className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAddForm(false); setNewName(''); setNewPhone(''); setNewRelation(''); }}
                  className="px-3 py-2 text-xs font-medium text-ink-500 hover:text-ink-800 border border-ink-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddContact}
                  disabled={addingContact || !newName || !newPhone}
                  className="flex-1 py-2 bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {addingContact ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  {addingContact ? 'Adding…' : 'Add Contact'}
                </button>
              </div>
            </div>
          )}

          {/* Contact list */}
          {settings.contacts?.length === 0 && !showAddForm && (
            <div className="text-center py-6 text-ink-400">
              <User size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">No emergency contacts added yet.</p>
            </div>
          )}
          <div className="space-y-2">
            {settings.contacts?.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-ink-50 rounded-xl border border-ink-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
                    {(c.name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-800">{c.name}</p>
                    <p className="text-xs text-ink-400">{c.relation ? `${c.relation} · ` : ''}{c.phone}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveContact(c.id)}
                  className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Remove contact"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info footer */}
      <div className="flex items-start gap-2.5 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <Heart size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          SMS alerts are powered by SasuSync and sent to Ghana numbers. If the AI assistant is loaded, it will write a personalized message for each alert. Otherwise a standard template is used.
        </p>
      </div>
    </div>
  );
}
