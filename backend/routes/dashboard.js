/**
 * routes/dashboard.js
 * Dashboard statistics route — Firestore edition.
 * API surface identical to the Mongoose version.
 */

const express = require('express');
const {
  patientsCol, readingsCol, alertsCol,
  snapshotToArray,
} = require('../models/firestore');
const { usersCol }  = require('../models/firestore');
const { protect }   = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    // 1. Build patient scope
    let patientIds = null; // null = all (provider)

    if (req.user.role === 'patient') {
      if (!req.user.patientId) {
        return res.status(200).json({
          success: true,
          data: {
            totalPatients: 0, normalCount: 0, warningCount: 0,
            criticalCount: 0, noReadingCount: 0, recentReadings: [],
            unresolvedAlerts: 0, onlineDevices: 0,
          },
        });
      }
      patientIds = [String(req.user.patientId)];
    } else if (req.user.role === 'clinician') {
      const pSnap = await patientsCol()
        .where('assignedClinicianId', '==', req.user._id)
        .get();
      patientIds = pSnap.docs.map((d) => d.id);
    } else {
      // Provider — get all patient IDs
      const pSnap = await patientsCol().get();
      patientIds = pSnap.docs.map((d) => d.id);
    }

    const totalPatients = patientIds.length;

    if (totalPatients === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalPatients: 0, normalCount: 0, warningCount: 0,
          criticalCount: 0, noReadingCount: 0, recentReadings: [],
          unresolvedAlerts: 0, onlineDevices: 0,
        },
      });
    }

    // 2. Latest reading status per patient
    //    Firestore has no aggregate — fetch last reading per patient
    const CHUNK = 30;
    const latestReadingPromises = [];
    for (let i = 0; i < patientIds.length; i += CHUNK) {
      const chunk = patientIds.slice(i, i + CHUNK);
      latestReadingPromises.push(
        readingsCol()
          .where('patientId', 'in', chunk)
          .orderBy('timestamp', 'desc')
          .get()
      );
    }
    const readingSnapshots = await Promise.all(latestReadingPromises);

    // Group: keep only the newest reading per patient
    const latestByPatient = {};
    for (const snap of readingSnapshots) {
      for (const doc of snap.docs) {
        const r = doc.data();
        if (!latestByPatient[r.patientId]) {
          latestByPatient[r.patientId] = r.status;
        }
      }
    }

    let normalCount = 0, warningCount = 0, criticalCount = 0;
    for (const status of Object.values(latestByPatient)) {
      if (status === 'NORMAL')   normalCount++;
      else if (status === 'WARNING')  warningCount++;
      else if (status === 'CRITICAL') criticalCount++;
    }
    const noReadingCount = totalPatients - Object.keys(latestByPatient).length;

    // 3. Recent readings (last 5)
    const recentPromises = [];
    for (let i = 0; i < patientIds.length; i += CHUNK) {
      const chunk = patientIds.slice(i, i + CHUNK);
      recentPromises.push(
        readingsCol()
          .where('patientId', 'in', chunk)
          .orderBy('timestamp', 'desc')
          .limit(5)
          .get()
      );
    }
    const recentSnapshots = await Promise.all(recentPromises);
    let recentReadings = [];
    for (const snap of recentSnapshots) {
      recentReadings.push(...snapshotToArray(snap));
    }
    recentReadings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    recentReadings = recentReadings.slice(0, 5);

    // Populate patient name and capturedBy for recent readings
    await Promise.all(
      recentReadings.map(async (r) => {
        if (r.patientId) {
          const s = await patientsCol().doc(String(r.patientId)).get();
          if (s.exists) {
            const p = s.data();
            r.patientId = { _id: s.id, name: p.name, membershipId: p.membershipId };
          }
        }
        if (r.capturedBy) {
          const s = await usersCol().doc(String(r.capturedBy)).get();
          if (s.exists) {
            const u = s.data();
            r.capturedBy = { _id: s.id, name: u.name, role: u.role };
          }
        }
      })
    );

    // 4. Unresolved alert count
    let unresolvedAlerts = 0;
    for (let i = 0; i < patientIds.length; i += CHUNK) {
      const chunk = patientIds.slice(i, i + CHUNK);
      const aSnap = await alertsCol()
        .where('patientId', 'in', chunk)
        .where('isResolved', '==', false)
        .get();
      unresolvedAlerts += aSnap.size;
    }

    // 5. Online devices (readings in the past 5 minutes with a deviceId)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1_000);
    const deviceSet = new Set();
    for (let i = 0; i < patientIds.length; i += CHUNK) {
      const chunk = patientIds.slice(i, i + CHUNK);
      const dSnap = await readingsCol()
        .where('patientId', 'in', chunk)
        .where('timestamp', '>=', fiveMinutesAgo)
        .get();
      for (const doc of dSnap.docs) {
        const d = doc.data().deviceId;
        if (d) deviceSet.add(d);
      }
    }
    const onlineDevices = deviceSet.size;

    res.status(200).json({
      success: true,
      data: {
        totalPatients,
        normalCount,
        warningCount,
        criticalCount,
        noReadingCount,
        recentReadings,
        unresolvedAlerts,
        onlineDevices,
      },
    });
  } catch (err) {
    console.error('GET /dashboard/stats error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
