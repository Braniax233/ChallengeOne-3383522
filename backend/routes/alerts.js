/**
 * routes/alerts.js
 * Alert management routes — Firestore edition.
 * API surface identical to the Mongoose version.
 */

const express = require('express');
const {
  patientsCol, alertsCol, readingsCol,
  docToObj, snapshotToArray, isValidId,
  serverTimestamp,
} = require('../models/firestore');
const { usersCol }            = require('../models/firestore');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ─── GET /api/alerts ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // Build patient ID scope
    let patientIds = null; // null = all (provider)

    if (req.user.role === 'clinician') {
      const pSnap = await patientsCol()
        .where('assignedClinicianId', '==', req.user._id)
        .get();
      patientIds = pSnap.docs.map((d) => d.id);
    } else if (req.user.role === 'patient') {
      if (!req.user.patientId) {
        return res.status(200).json({ success: true, count: 0, alerts: [] });
      }
      patientIds = [String(req.user.patientId)];
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    // Firestore doesn't support 'in' on more than 30 items natively in older
    // SDK versions — we query per-patient in batches if needed, but for
    // typical use cases the patient count is small.
    let allAlerts = [];

    if (patientIds === null) {
      // Provider — all alerts
      let query = alertsCol().orderBy('timestamp', 'desc').limit(limit);
      if (req.query.severity) {
        query = alertsCol()
          .where('severity', '==', req.query.severity.toUpperCase())
          .orderBy('timestamp', 'desc')
          .limit(limit);
      }
      if (req.query.isResolved !== undefined) {
        const resolved = req.query.isResolved === 'true';
        query = alertsCol()
          .where('isResolved', '==', resolved)
          .orderBy('timestamp', 'desc')
          .limit(limit);
      }
      const snap = await query.get();
      allAlerts = snapshotToArray(snap);
    } else if (patientIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, alerts: [] });
    } else {
      // Fetch in chunks of 30 (Firestore 'in' limit)
      const CHUNK = 30;
      for (let i = 0; i < patientIds.length; i += CHUNK) {
        const chunk = patientIds.slice(i, i + CHUNK);
        let query = alertsCol().where('patientId', 'in', chunk).orderBy('timestamp', 'desc');
        if (req.query.severity) {
          query = query.where('severity', '==', req.query.severity.toUpperCase());
        }
        if (req.query.isResolved !== undefined) {
          query = query.where('isResolved', '==', req.query.isResolved === 'true');
        }
        const snap = await query.get();
        allAlerts.push(...snapshotToArray(snap));
      }
      // Sort combined results and apply limit
      allAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      allAlerts = allAlerts.slice(0, limit);
    }

    // Populate patientId, readingId, resolvedBy
    await Promise.all(
      allAlerts.map(async (a) => {
        if (a.patientId) {
          const s = await patientsCol().doc(String(a.patientId)).get();
          if (s.exists) {
            const p = s.data();
            a.patientId = { _id: s.id, name: p.name, membershipId: p.membershipId };
          }
        }
        if (a.readingId) {
          const s = await readingsCol().doc(String(a.readingId)).get();
          if (s.exists) {
            const r = s.data();
            a.readingId = { _id: s.id, spo2: r.spo2, heartRate: r.heartRate, timestamp: r.timestamp };
          }
        }
        if (a.resolvedBy) {
          const s = await usersCol().doc(String(a.resolvedBy)).get();
          if (s.exists) {
            const u = s.data();
            a.resolvedBy = { _id: s.id, name: u.name, role: u.role };
          }
        }
      })
    );

    res.status(200).json({ success: true, count: allAlerts.length, alerts: allAlerts });
  } catch (err) {
    console.error('GET /alerts error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/alerts/:id/resolve ─────────────────────────────────────────────
router.put(
  '/:id/resolve',
  restrictTo('clinician', 'provider'),
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid alert ID.' });
      }

      const snap = await alertsCol().doc(req.params.id).get();
      if (!snap.exists) {
        return res.status(404).json({ success: false, message: 'Alert not found.' });
      }

      const alert = docToObj(snap);

      // Clinicians can only resolve alerts for their own patients
      if (req.user.role === 'clinician' && alert.patientId) {
        const pSnap = await patientsCol().doc(String(alert.patientId)).get();
        if (pSnap.exists) {
          const p = pSnap.data();
          if (String(p.assignedClinicianId) !== String(req.user._id)) {
            return res.status(403).json({
              success: false,
              message: 'You are not authorised to resolve alerts for this patient.',
            });
          }
        }
      }

      if (alert.isResolved) {
        return res.status(409).json({
          success: false,
          message: 'This alert has already been resolved.',
          alert,
        });
      }

      await alertsCol().doc(req.params.id).update({
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.user._id,
        updatedAt:  serverTimestamp(),
      });

      // Fetch the updated alert with populated fields
      const updatedSnap = await alertsCol().doc(req.params.id).get();
      const updatedAlert = docToObj(updatedSnap);

      if (updatedAlert.patientId) {
        const s = await patientsCol().doc(String(updatedAlert.patientId)).get();
        if (s.exists) {
          const p = s.data();
          updatedAlert.patientId = { _id: s.id, name: p.name, membershipId: p.membershipId };
        }
      }
      if (updatedAlert.readingId) {
        const s = await readingsCol().doc(String(updatedAlert.readingId)).get();
        if (s.exists) {
          const r = s.data();
          updatedAlert.readingId = { _id: s.id, spo2: r.spo2, heartRate: r.heartRate, timestamp: r.timestamp };
        }
      }
      if (updatedAlert.resolvedBy) {
        const s = await usersCol().doc(String(updatedAlert.resolvedBy)).get();
        if (s.exists) {
          const u = s.data();
          updatedAlert.resolvedBy = { _id: s.id, name: u.name, role: u.role };
        }
      }

      res.status(200).json({
        success: true,
        message: 'Alert resolved successfully.',
        alert: updatedAlert,
      });
    } catch (err) {
      console.error('PUT /alerts/:id/resolve error:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
