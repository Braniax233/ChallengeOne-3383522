import { getAllReadings } from './readings';
import { getAllPatients } from './patients';
import { getAlerts } from './alerts';

export async function getReportStats() {
  const [readings, patients, alerts] = await Promise.all([
    getAllReadings(500),
    getAllPatients(),
    getAlerts()
  ]);

  // Aggregate weekly data (last 7 days)
  const now = new Date();
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateStr: d.toDateString(),
      normal: 0,
      warning: 0,
      critical: 0
    };
  });

  readings.forEach((r) => {
    const rDate = new Date(r.timestamp).toDateString();
    const dayBucket = weekData.find(d => d.dateStr === rDate);
    if (dayBucket) {
      if (r.status === 'NORMAL') dayBucket.normal++;
      else if (r.status === 'WARNING') dayBucket.warning++;
      else if (r.status === 'CRITICAL') dayBucket.critical++;
    }
  });

  return {
    weeklyData: weekData,
    summaryStats: {
      reportsGenerated: 12, // Stub for derived PDF export count
      patientsCovered: patients.length,
      alertReports: alerts.length,
      exportsToday: 0
    }
  };
}

export async function getReports() {
  // In a fully functional app with a backend, this would fetch actual generated PDF records.
  // We'll simulate fetching a list of past generated reports derived from real patient names.
  const patients = await getAllPatients();
  
  if (patients.length === 0) return [];

  return [
    {
      id: 'R-001',
      title: 'Weekly Vitals Summary',
      patient: 'All Patients',
      type: 'Summary',
      generated: new Date(Date.now() - 1 * 86400000),
      size: '2.4 MB'
    },
    {
      id: 'R-002',
      title: `${patients[0].name} — Monthly Report`,
      patient: patients[0].name,
      type: 'Individual',
      generated: new Date(Date.now() - 3 * 86400000),
      size: '1.1 MB'
    },
    {
      id: 'R-003',
      title: 'Critical Alerts Export',
      patient: 'Multiple',
      type: 'Alerts',
      generated: new Date(Date.now() - 5 * 86400000),
      size: '0.8 MB'
    }
  ];
}
