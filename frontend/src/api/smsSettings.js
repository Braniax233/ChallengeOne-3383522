/**
 * api/smsSettings.js
 * Manages a patient's SMS notification preferences stored in Firebase RTDB.
 *
 * Schema stored at /smsSettings/{uid}:
 * {
 *   enabled: true,
 *   shareLocation: false,
 *   notifyOnWarning: true,
 *   notifyOnCritical: true,
 *   contacts: [
 *     { id: "...", name: "Mum", phone: "0244123456", relation: "Parent" },
 *     ...
 *   ]
 * }
 */

import { ref, get, set, update } from 'firebase/database';
import { rtdb } from './firebase';

const LOCAL_KEY = (uid) => `sms_settings_${uid}`;

const DEFAULTS = {
  enabled: true,
  shareLocation: false,
  notifyOnWarning: true,
  notifyOnCritical: true,
  contacts: [],
};

// ── Load settings ─────────────────────────────────────────────────────────────
export async function getSmsSettings(uid) {
  if (!uid) return DEFAULTS;

  // Try localStorage first (fast)
  try {
    const cached = localStorage.getItem(LOCAL_KEY(uid));
    if (cached) return { ...DEFAULTS, ...JSON.parse(cached) };
  } catch { /* ignore */ }

  // Fall back to Firebase
  try {
    const snap = await get(ref(rtdb, `smsSettings/${uid}`));
    if (snap.exists()) {
      const data = { ...DEFAULTS, ...snap.val() };
      localStorage.setItem(LOCAL_KEY(uid), JSON.stringify(data));
      return data;
    }
  } catch { /* ignore */ }

  return DEFAULTS;
}

// ── Save settings ─────────────────────────────────────────────────────────────
export async function saveSmsSettings(uid, settings) {
  if (!uid) return;
  const data = { ...DEFAULTS, ...settings };
  localStorage.setItem(LOCAL_KEY(uid), JSON.stringify(data));
  try {
    await set(ref(rtdb, `smsSettings/${uid}`), data);
  } catch { /* if RTDB fails, localStorage still works */ }
}

// ── Add a contact ──────────────────────────────────────────────────────────────
export async function addContact(uid, contact) {
  const settings = await getSmsSettings(uid);
  const newContact = {
    id: `c_${Date.now()}`,
    name: contact.name || 'Contact',
    phone: contact.phone || '',
    relation: contact.relation || '',
  };
  const updated = { ...settings, contacts: [...(settings.contacts || []), newContact] };
  await saveSmsSettings(uid, updated);
  return updated;
}

// ── Remove a contact ───────────────────────────────────────────────────────────
export async function removeContact(uid, contactId) {
  const settings = await getSmsSettings(uid);
  const updated = {
    ...settings,
    contacts: (settings.contacts || []).filter((c) => c.id !== contactId),
  };
  await saveSmsSettings(uid, updated);
  return updated;
}

// ── Get browser location ───────────────────────────────────────────────────────
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 8000, maximumAge: 60000 }
    );
  });
}
