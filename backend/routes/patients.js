/**
 * routes/patients.js
 * Patient management routes — Firestore edition.
 * API surface is identical to the Mongoose version.
 */

const express = require('express');
const {
  patientsCol, readingsCol, alertsCol,
  docToObj, snapshotToArray, isValidId,
  populateField, serverTimestamp,
} = require('../models/firestore');
const { usersCol } = require('../models/firestore');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * buildPatientFilter — returns Firestore query constraints based on role.
 * Returns an array of { field, op, value } objects.
 */
function buildRoleConstraints(user) {
  if (user.role === 'clinician') {
    return [{ field: 'assignedClinicianId', op: '==', value: user._id }];
  }
  if (user.role === 'patient') {
    return [{ field: '__name__', op: '==', value: String(user.patientId) }];
  }
  return []; // provider — no filter
}

function applyConstraints(query, constraints) {
  let q = query;
  for (const c of constraints) {
    if (c.field === '__name__') {
      // ID-based filter handled differently — use .doc() in callers
    } else {
      q = q.where(c.field, c.op, c.value);
    }
  }
  return q;
}

async function getPatientById(id, user) {
  const snap = await patientsCol().doc(id).get();
  if (!snap.exists) return null;
  const p = docToObj(snap);
  // Role-based access check
  if (user.role === 'clinician' && p.assignedClinicianId !== user._id) return null;
  if (user.role === 'patient' && String(user.patientId) !== id) return null;
  return p;
}

async function attachClinicianName(patient) {
  if (patient && patient.assignedClinicianId) {
    const snap = await usersCol().doc(String(patient.assignedClinicianId)).get();
    if (snap.exists) {
      const u = snap.data();
      patient.assignedClinicianId = {
        _id:        snap.id,
        name:       u.name,
        email:      u.email,
        department: u.department,
        phone:      u.phone,
      };
    }
  }
  return patient;
}

// ─── GET /api/patients/lookup/:membershipId ───────────────────────────────────
router.get('/lookup/:membershipId', async (req, res) => {
  try {
    let query = patientsCol().where(
      'membershipId', '==', req.params.membershipId.toUpperCase()
    );
    const constraints = buildRoleConstraints(req.user).filter(c => c.field !== '__name__');
    query = applyConstraints(query, constraints);

    const snap = await query.limit(1).get();
    if (snap.empty) {
      return res.status(404).json({
        success: false,
        message: `No patient found with membership ID "${req.params.membershipId}".`,
      });
    }

    let patient = docToObj(snap.docs[0]);
    patient = await attachClinicianName(patient);
    res.status(200).json({ success: true, patient });
  } catch (err) {
    console.error('GET /patients/lookup/:membershipId error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/patients/barcode/:barcode ──────────────────────────────────────
router.get('/barcode/:barcode', async (req, res) => {
  try {
    let query = patientsCol().where('barcode', '==', req.params.barcode);
    const constraints = buildRoleConstraints(req.user).filter(c => c.field !== '__name__');
    query = applyConstraints(query, constraints);

    const snap = await query.limit(1).get();
    if (snap.empty) {
      return res.status(404).json({
        success: false,
        message: `No patient found with barcode "${req.params.barcode}".`,
      });
    }

    let patient = docToObj(snap.docs[0]);
    patient = await attachClinicianName(patient);
    res.status(200).json({ success: true, patient });
  } catch (err) {
    console.error('GET /patients/barcode/:barcode error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/patients ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, isActive } = req.query;
    const constraints = buildRoleConstraints(req.user);

    // Patient role — return only their own record
    if (req.user.role === 'patient') {
      if (!req.user.patientId) {
        return res.status(200).json({ success: true, count: 0, patients: [] });
      }
      const snap = await patientsCol().doc(String(req.user.patientId)).get();
      const patients = snap.exists ? [await attachClinicianName(docToObj(snap))] : [];
      return res.status(200).json({ success: true, count: patients.length, patients });
    }

    let query = patientsCol();
    for (const c of constraints) {
      query = query.where(c.field, c.op, c.value);
    }
    if (isActive !== undefined) {
      query = query.where('isActive', '==', isActive === 'true');
    }
    query = query.orderBy('createdAt', 'desc');

    const snap = await query.get();
    let patients = snapshotToArray(snap);

    // Client-side search filter (Firestore doesn't support regex)
    if (search) {
      const lower = search.toLowerCase();
      patients = patients.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(lower)) ||
          (p.membershipId && p.membershipId.toLowerCase().includes(lower)) ||
          (p.primaryCondition && p.primaryCondition.toLowerCase().includes(lower))
      );
    }

    // Populate clinician names
    patients = await Promise.all(patients.map(attachClinicianName));

    res.status(200).json({ success: true, count: patients.length, patients });
  } catch (err) {
    console.error('GET /patients error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/patients/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    let patient = await getPatientById(req.params.id, req.user);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }
    patient = await attachClinicianName(patient);

    // Attach most recent reading
    const readingSnap = await readingsCol()
      .where('patientId', '==', req.params.id)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    let latestReading = null;
    if (!readingSnap.empty) {
      latestReading = docToObj(readingSnap.docs[0]);
      if (latestReading.capturedBy) {
        await populateField(latestReading, 'capturedBy', usersCol, ['name', 'role']);
      }
    }

    res.status(200).json({ success: true, patient, latestReading });
  } catch (err) {
    console.error('GET /patients/:id error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/patients ───────────────────────────────────────────────────────
router.post('/', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    const {
      membershipId, barcode, name, dob, gender, bloodGroup,
      assignedClinicianId, bmi, threshold, emergencyContacts,
      locationSharingConsent, address, primaryCondition,
      allergies, medications, photo, isActive,
    } = req.body;

    if (!membershipId || !name) {
      return res.status(400).json({
        success: false,
        message: 'membershipId and name are required.',
      });
    }

    // Check membershipId uniqueness
    const existing = await patientsCol()
      .where('membershipId', '==', membershipId.toUpperCase())
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(409).json({
        success: false,
        message: 'A patient with that membership ID already exists.',
      });
    }

    const clinicianId =
      assignedClinicianId ||
      (req.user.role === 'clinician' ? req.user._id : null);

    const ref = patientsCol().doc();
    const data = {
      membershipId:           membershipId.toUpperCase(),
      barcode:                barcode || '',
      name,
      dob:                    dob || null,
      gender:                 gender || '',
      bloodGroup:             bloodGroup || '',
      assignedClinicianId:    clinicianId || null,
      bmi:                    bmi || {},
      threshold:              threshold || {},
      emergencyContacts:      emergencyContacts || [],
      locationSharingConsent: locationSharingConsent || false,
      address:                address || '',
      primaryCondition:       primaryCondition || '',
      allergies:              allergies || '',
      medications:            medications || '',
      photo:                  photo || '',
      isActive:               isActive !== undefined ? isActive : true,
      createdAt:              serverTimestamp(),
      updatedAt:              serverTimestamp(),
    };

    await ref.set(data);
    const patient = { _id: ref.id, ...data };

    res.status(201).json({
      success: true,
      message: 'Patient created successfully.',
      patient,
    });
  } catch (err) {
    console.error('POST /patients error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/patients/:id ────────────────────────────────────────────────────
router.put('/:id', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    const patient = await getPatientById(req.params.id, req.user);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or you are not authorised to update this record.',
      });
    }

    // Prevent overwriting _id or membershipId
    const { _id, membershipId: _mid, ...updates } = req.body;
    updates.updatedAt = serverTimestamp();

    await patientsCol().doc(req.params.id).update(updates);

    const updated = await getPatientById(req.params.id, req.user);
    const withClinician = await attachClinicianName(updated);

    res.status(200).json({
      success: true,
      message: 'Patient updated successfully.',
      patient: withClinician,
    });
  } catch (err) {
    console.error('PUT /patients/:id error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/patients/:id/threshold ─────────────────────────────────────────
router.put('/:id/threshold', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    const { spo2Min, spo2Max, hrMin, hrMax, warningMargin, trendWindow } = req.body;

    const thresholdUpdate = {};
    if (spo2Min       !== undefined) thresholdUpdate['threshold.spo2Min']       = spo2Min;
    if (spo2Max       !== undefined) thresholdUpdate['threshold.spo2Max']       = spo2Max;
    if (hrMin         !== undefined) thresholdUpdate['threshold.hrMin']         = hrMin;
    if (hrMax         !== undefined) thresholdUpdate['threshold.hrMax']         = hrMax;
    if (warningMargin !== undefined) thresholdUpdate['threshold.warningMargin'] = warningMargin;
    if (trendWindow   !== undefined) thresholdUpdate['threshold.trendWindow']   = trendWindow;

    if (Object.keys(thresholdUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No threshold fields provided in the request body.',
      });
    }

    const patient = await getPatientById(req.params.id, req.user);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or you are not authorised to update this record.',
      });
    }

    thresholdUpdate.updatedAt = serverTimestamp();
    await patientsCol().doc(req.params.id).update(thresholdUpdate);

    const updated = await getPatientById(req.params.id, req.user);

    let bmiRecommendation = null;
    if (updated.bmi && updated.bmi.classification) {
      try {
        const { generateThresholdRecommendation } = require('../engines/bmiEngine');
        bmiRecommendation = generateThresholdRecommendation(updated.bmi.classification);
      } catch (_) { /* classification may not be set yet */ }
    }

    res.status(200).json({
      success: true,
      message: 'Thresholds updated successfully.',
      patient: updated,
      bmiRecommendation,
    });
  } catch (err) {
    console.error('PUT /patients/:id/threshold error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/patients/:id/readings ──────────────────────────────────────────
router.get('/:id/readings', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    const patient = await getPatientById(req.params.id, req.user);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or access denied.',
      });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    let query = readingsCol()
      .where('patientId', '==', req.params.id)
      .orderBy('timestamp', 'desc')
      .limit(limit);

    if (req.query.status) {
      query = readingsCol()
        .where('patientId', '==', req.params.id)
        .where('status', '==', req.query.status.toUpperCase())
        .orderBy('timestamp', 'desc')
        .limit(limit);
    }

    const snap = await query.get();
    const readings = snapshotToArray(snap);
    await Promise.all(
      readings.map((r) =>
        r.capturedBy ? populateField(r, 'capturedBy', usersCol, ['name', 'role']) : r
      )
    );

    res.status(200).json({ success: true, count: readings.length, readings });
  } catch (err) {
    console.error('GET /patients/:id/readings error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/patients/:id/alerts ────────────────────────────────────────────
router.get('/:id/alerts', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    const patient = await getPatientById(req.params.id, req.user);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or access denied.',
      });
    }

    let query = alertsCol()
      .where('patientId', '==', req.params.id)
      .orderBy('timestamp', 'desc')
      .limit(100);

    if (req.query.isResolved !== undefined) {
      query = alertsCol()
        .where('patientId', '==', req.params.id)
        .where('isResolved', '==', req.query.isResolved === 'true')
        .orderBy('timestamp', 'desc')
        .limit(100);
    }

    const snap = await query.get();
    const alerts = snapshotToArray(snap);
    await Promise.all([
      Promise.all(alerts.map((a) => populateField(a, 'readingId', readingsCol))),
      Promise.all(
        alerts.map((a) =>
          a.resolvedBy ? populateField(a, 'resolvedBy', usersCol, ['name', 'role']) : a
        )
      ),
    ]);

    res.status(200).json({ success: true, count: alerts.length, alerts });
  } catch (err) {
    console.error('GET /patients/:id/alerts error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
