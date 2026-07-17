/**
 * api/patients.js
 * Firebase RTDB helpers for fetching patient profiles.
 *
 * Patients are stored at /users/{uid} with role === 'patient'
 * (written during registration by AuthContext).
 */

import { ref, get } from 'firebase/database';
import { rtdb } from './firebase';
import { getReadings, classifyReading } from './readings';

/**
 * Fetch all users with role === 'patient' from /users
 * Enriches each with their latest reading from /readings/{uid}
 */
export async function getAllPatients() {
  if (!navigator.onLine) {
    const cached = localStorage.getItem("cache_all_patients");
    return cached ? JSON.parse(cached) : [];
  }

  const snap = await get(ref(rtdb, 'users'));
  if (!snap.exists()) return [];

  const patients = [];
  snap.forEach((child) => {
    const u = child.val();
    if (u.role === 'patient') {
      const patientData = {
        _id:      child.key,
        uid:      child.key,
        name:     u.name     || 'Unknown',
        email:    u.email    || '',
        memberId: u.memberId || '—',
        gender:   u.gender   || '—',
        phone:    u.phone    || '—',
        location: typeof u.location === 'string' ? u.location : (u.location ? "Tracking Enabled" : "—"),
        bloodGroup: u.bloodGroup || '',
        height:   u.height || '',
        weight:   u.weight || '',
        dob:      u.dob      || null,
        age:      u.dob
          ? Math.floor((Date.now() - new Date(u.dob).getTime()) / (365.25 * 24 * 3600000))
          : null,
        status:        'NORMAL',
        latestReading: null,
        updatedAt:     null,
        createdAt:     u.createdAt || null,
      };
      patients.push(patientData);
    }
  });

  // Enrich with latest reading (parallel fetch)
  await Promise.all(
    patients.map(async (p) => {
      try {
        const readings = await getReadings(p._id, 1);
        if (readings.length > 0) {
          const r = readings[0];
          p.latestReading = { hr: r.heartRate, spo2: r.spo2 };
          p.status        = r.status || classifyReading(r.spo2, r.heartRate);
          p.updatedAt     = r.timestamp;
        }
      } catch { /* no readings yet */ }
    })
  );

  // Sort by updatedAt descending (most recent reading first)
  patients.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  
  localStorage.setItem("cache_all_patients", JSON.stringify(patients));
  return patients;
}

/**
 * Fetch a single patient profile by uid
 */
export async function getPatient(uid) {
  if (!navigator.onLine) {
    const cached = localStorage.getItem(`cache_patient_${uid}`);
    return cached ? JSON.parse(cached) : null;
  }

  const snap = await get(ref(rtdb, `users/${uid}`));
  if (!snap.exists()) return null;
  const u = snap.val();
  const patientData = {
    _id:  uid,
    uid,
    name:     u.name     || 'Unknown',
    email:    u.email    || '',
    memberId: u.memberId || '—',
    gender:   u.gender   || '—',
    phone:    u.phone    || '—',
    location: typeof u.location === 'string' ? u.location : (u.location ? "Tracking Enabled" : "—"),
    bloodGroup: u.bloodGroup || '',
    height:   u.height || '',
    weight:   u.weight || '',
    dob:      u.dob      || null,
    age:      u.dob
      ? Math.floor((Date.now() - new Date(u.dob).getTime()) / (365.25 * 24 * 3600000))
      : null,
    createdAt: u.createdAt || null,
  };
  
  localStorage.setItem(`cache_patient_${uid}`, JSON.stringify(patientData));
  return patientData;
}

/**
 * Update a patient's demographics
 */
export async function updatePatient(uid, updates) {
  const { update } = await import('firebase/database');
  const patientRef = ref(rtdb, `users/${uid}`);
  await update(patientRef, updates);
  
  // Clear caches
  localStorage.removeItem(`cache_patient_${uid}`);
  localStorage.removeItem("cache_all_patients");
}
