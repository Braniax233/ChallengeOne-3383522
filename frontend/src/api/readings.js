/**
 * api/readings.js
 * Firebase RTDB helpers for saving and fetching patient readings.
 *
 * Readings are stored at:   /readings/{patientId}/{pushId}
 * Latest vital from device: /vitals/latest  (written by ESP8266)
 */

import { ref, push, set, get, query, orderByChild, limitToLast } from 'firebase/database';
import { rtdb } from './firebase';

/**
 * Save a reading linked to a patient.
 * @param {string} patientId  – uid or patient doc id
 * @param {object} data       – { spo2, heartRate, status, bmi?, weight?, height?, capturedBy? }
 * @returns {string} the generated reading key
 */
export async function saveReading(patientId, data) {
  const payload = {
    ...data,
    timestamp: Date.now(),
  };

  if (!navigator.onLine) {
    const queue = JSON.parse(localStorage.getItem('offline_readings_queue') || '[]');
    const tempId = `local_${Date.now()}`;
    queue.push({ patientId, data: payload, tempId });
    localStorage.setItem('offline_readings_queue', JSON.stringify(queue));
    return tempId;
  }

  const readingsRef = ref(rtdb, `readings/${patientId}`);
  const newRef = push(readingsRef);
  await set(newRef, payload);
  return newRef.key;
}

/**
 * Sync offline readings to Firebase when back online.
 */
export async function syncOfflineReadings() {
  if (!navigator.onLine) return;
  const queue = JSON.parse(localStorage.getItem('offline_readings_queue') || '[]');
  if (queue.length === 0) return;

  for (const item of queue) {
    try {
      const newRef = push(ref(rtdb, `readings/${item.patientId}`));
      await set(newRef, item.data);
    } catch (e) {
      console.error("Failed to sync offline reading", e);
    }
  }
  localStorage.removeItem('offline_readings_queue');
}

/**
 * Fetch the most recent N readings for a patient.
 * @param {string} patientId
 * @param {number} limit
 * @returns {Array} sorted newest-first
 */
export async function getReadings(patientId, limit = 20) {
  if (!navigator.onLine) {
    const cached = localStorage.getItem(`cache_readings_${patientId}`);
    return cached ? JSON.parse(cached) : [];
  }

  // Fetch all and sort locally to avoid Firebase index requirement
  const snap = await get(ref(rtdb, `readings/${patientId}`));
  if (!snap.exists()) return [];
  
  const arr = [];
  snap.forEach((child) => {
    arr.push({ _id: child.key, ...child.val() });
  });
  
  // Sort descending by timestamp
  const sorted = arr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit);
  localStorage.setItem(`cache_readings_${patientId}`, JSON.stringify(sorted));
  return sorted;
}

/**
 * Get ALL readings across ALL patients (for clinician/provider dashboards).
 * Returns a flat array sorted newest-first.
 */
export async function getAllReadings(limit = 50) {
  const snap = await get(ref(rtdb, 'readings'));
  if (!snap.exists()) return [];
  const arr = [];
  snap.forEach((patientSnap) => {
    const patientId = patientSnap.key;
    patientSnap.forEach((readingSnap) => {
      arr.push({ _id: readingSnap.key, patientId, ...readingSnap.val() });
    });
  });
  arr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return arr.slice(0, limit);
}

/**
 * Classify a reading into NORMAL / WARNING / CRITICAL.
 */
export function classifyReading(spo2, hr) {
  const s = parseFloat(spo2);
  const h = parseFloat(hr);
  if (s < 90 || h > 120 || h < 40) return 'CRITICAL';
  if (s < 94 || h > 100 || h < 60) return 'WARNING';
  return 'NORMAL';
}
