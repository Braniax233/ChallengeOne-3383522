import { getAllReadings } from './readings';
import { ref, get } from 'firebase/database';
import { rtdb } from './firebase';

/**
 * Derives a list of alerts from the most recent readings across all patients.
 * In a production app, you might have a dedicated /alerts RTDB node.
 * For this implementation, we dynamically generate alerts from any reading
 * that has a status of WARNING or CRITICAL.
 */
export async function getAlerts() {
  const allReadings = await getAllReadings(200);
  
  // Build a cache of patient profiles so we don't fetch the same user twice
  const userCache = {};
  const getPatientInfo = async (patientId) => {
    if (userCache[patientId] !== undefined) return userCache[patientId];
    try {
      const snap = await get(ref(rtdb, `users/${patientId}`));
      const data = snap.exists() ? snap.val() : null;
      userCache[patientId] = data;
      return data;
    } catch {
      userCache[patientId] = null;
      return null;
    }
  };

  const alerts = [];
  for (const r of allReadings) {
    if (r.status === 'WARNING' || r.status === 'CRITICAL') {
      const patient = await getPatientInfo(r.patientId);
      
      alerts.push({
        _id: r._id,
        patientId: r.patientId,
        patientName: patient?.name || r.patientName || 'Unknown Patient',
        memberId: patient?.memberId || r.memberId || '—',
        phone: patient?.phone || r.patientPhone || null,
        type: `Abnormal ${r.status === 'CRITICAL' ? 'SpO₂/HR' : 'Vitals'} Detected`,
        severity: r.status,
        status: 'unresolved', // Default for derived alerts
        hr: r.heartRate,
        spo2: r.spo2,
        temp: r.temperature,
        createdAt: r.timestamp,
      });
    }
  }

  return alerts;
}

export async function resolveAlert(alertId) {
  // In a real RTDB, this would update /alerts/${alertId}/status to 'resolved'
  // Since we derive them dynamically, we simulate success for the UI.
  return Promise.resolve(true);
}
