import { getAllReadings } from './readings';

/**
 * Derives a list of alerts from the most recent readings across all patients.
 * In a production app, you might have a dedicated /alerts RTDB node.
 * For this implementation, we dynamically generate alerts from any reading
 * that has a status of WARNING or CRITICAL.
 */
export async function getAlerts() {
  const allReadings = await getAllReadings(200);
  
  const alerts = [];
  for (const r of allReadings) {
    if (r.status === 'WARNING' || r.status === 'CRITICAL') {
      alerts.push({
        _id: r._id,
        patientName: r.patientName || 'Unknown Patient',
        memberId: r.memberId || '—',
        type: `Abnormal ${r.status === 'CRITICAL' ? 'SpO₂/HR' : 'Vitals'} Detected`,
        severity: r.status,
        status: 'unresolved', // Default for derived alerts
        hr: r.heartRate,
        spo2: r.spo2,
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
