/**
 * routes/notes.js
 * Clinical session note routes — Firestore edition.
 * API surface identical to the Mongoose version.
 */

const express = require('express');
const {
  patientsCol, notesCol, readingsCol,
  docToObj, snapshotToArray, isValidId,
  serverTimestamp,
} = require('../models/firestore');
const { usersCol }            = require('../models/firestore');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ─── GET /api/notes/patient/:id ───────────────────────────────────────────────
router.get('/patient/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    // Verify patient exists and is accessible
    const patSnap = await patientsCol().doc(req.params.id).get();
    if (!patSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or access denied.',
      });
    }
    const patient = patSnap.data();

    // Role-based access check
    if (req.user.role === 'clinician' &&
        String(patient.assignedClinicianId) !== String(req.user._id)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or access denied.',
      });
    }
    if (req.user.role === 'patient' &&
        String(req.user.patientId) !== req.params.id) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or access denied.',
      });
    }

    let query = notesCol()
      .where('patientId', '==', req.params.id)
      .orderBy('timestamp', 'desc');

    const snap = await query.get();
    const notes = snapshotToArray(snap);

    // Optional tag filter (client-side — Firestore array-contains-any limited to 30 items)
    let filtered = notes;
    if (req.query.tags) {
      const tags = req.query.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tags.length > 0) {
        filtered = notes.filter(
          (n) => n.tags && n.tags.some((t) => tags.includes(t))
        );
      }
    }

    // Populate clinicianId and readingId
    await Promise.all(
      filtered.map(async (n) => {
        if (n.clinicianId) {
          const s = await usersCol().doc(String(n.clinicianId)).get();
          if (s.exists) {
            const u = s.data();
            n.clinicianId = { _id: s.id, name: u.name, role: u.role, department: u.department };
          }
        }
        if (n.readingId) {
          const s = await readingsCol().doc(String(n.readingId)).get();
          if (s.exists) {
            const r = s.data();
            n.readingId = { _id: s.id, spo2: r.spo2, heartRate: r.heartRate, status: r.status, timestamp: r.timestamp };
          }
        }
      })
    );

    res.status(200).json({ success: true, count: filtered.length, notes: filtered });
  } catch (err) {
    console.error('GET /notes/patient/:id error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/notes ──────────────────────────────────────────────────────────
router.post('/', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    const { patientId, note, readingId, tags } = req.body;

    if (!patientId || !note) {
      return res.status(400).json({
        success: false,
        message: 'patientId and note content are required.',
      });
    }
    if (!isValidId(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patientId.' });
    }
    if (readingId && !isValidId(readingId)) {
      return res.status(400).json({ success: false, message: 'Invalid readingId.' });
    }

    const patSnap = await patientsCol().doc(patientId).get();
    if (!patSnap.exists) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const ref = notesCol().doc();
    const data = {
      patientId,
      clinicianId: req.user._id,
      readingId:   readingId || null,
      note:        note.trim(),
      tags:        Array.isArray(tags) ? tags.map((t) => t.trim()).filter(Boolean) : [],
      timestamp:   new Date(),
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
    };
    await ref.set(data);

    const sessionNote = { _id: ref.id, ...data };

    // Populate for response
    const uSnap = await usersCol().doc(String(req.user._id)).get();
    if (uSnap.exists) {
      const u = uSnap.data();
      sessionNote.clinicianId = { _id: uSnap.id, name: u.name, role: u.role };
    }
    if (readingId) {
      const rSnap = await readingsCol().doc(readingId).get();
      if (rSnap.exists) {
        const r = rSnap.data();
        sessionNote.readingId = { _id: rSnap.id, spo2: r.spo2, heartRate: r.heartRate, status: r.status, timestamp: r.timestamp };
      }
    }

    res.status(201).json({
      success: true,
      message: 'Session note created successfully.',
      note: sessionNote,
    });
  } catch (err) {
    console.error('POST /notes error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/notes/:id ───────────────────────────────────────────────────────
router.put('/:id', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid note ID.' });
    }

    const snap = await notesCol().doc(req.params.id).get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Session note not found.' });
    }

    const existing = docToObj(snap);

    // Clinicians can only edit their own notes
    if (req.user.role === 'clinician' &&
        String(existing.clinicianId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorised to edit this note.',
      });
    }

    const { note, tags } = req.body;
    if (!note && !tags) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one field to update: note or tags.',
      });
    }

    const updates = { updatedAt: serverTimestamp() };
    if (note) updates.note = note.trim();
    if (tags) updates.tags = Array.isArray(tags)
      ? tags.map((t) => t.trim()).filter(Boolean)
      : existing.tags;

    await notesCol().doc(req.params.id).update(updates);

    const updatedSnap = await notesCol().doc(req.params.id).get();
    const updatedNote = docToObj(updatedSnap);

    // Populate
    if (updatedNote.clinicianId) {
      const s = await usersCol().doc(String(updatedNote.clinicianId)).get();
      if (s.exists) {
        const u = s.data();
        updatedNote.clinicianId = { _id: s.id, name: u.name, role: u.role };
      }
    }
    if (updatedNote.readingId) {
      const s = await readingsCol().doc(String(updatedNote.readingId)).get();
      if (s.exists) {
        const r = s.data();
        updatedNote.readingId = { _id: s.id, spo2: r.spo2, heartRate: r.heartRate, status: r.status, timestamp: r.timestamp };
      }
    }

    res.status(200).json({
      success: true,
      message: 'Session note updated successfully.',
      note: updatedNote,
    });
  } catch (err) {
    console.error('PUT /notes/:id error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
