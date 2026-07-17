/**
 * routes/bmi.js
 * BMI calculation and record management — Firestore edition.
 * API surface identical to the Mongoose version.
 */

const express = require('express');
const {
  patientsCol, bmiCol,
  docToObj, snapshotToArray, isValidId,
  serverTimestamp,
} = require('../models/firestore');
const { usersCol }            = require('../models/firestore');
const { protect, restrictTo } = require('../middleware/auth');
const {
  calculateBMI,
  classifyBMI,
  generateThresholdRecommendation,
} = require('../engines/bmiEngine');

const router = express.Router();
router.use(protect);

// ─── POST /api/bmi ────────────────────────────────────────────────────────────
router.post('/', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    const { patientId, weight, height } = req.body;

    if (!patientId) {
      return res.status(400).json({ success: false, message: 'patientId is required.' });
    }
    if (!isValidId(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patientId.' });
    }
    if (typeof weight !== 'number' || weight <= 0) {
      return res.status(400).json({
        success: false,
        message: 'weight must be a positive number (kg).',
      });
    }
    if (typeof height !== 'number' || height <= 0) {
      return res.status(400).json({
        success: false,
        message: 'height must be a positive number (cm).',
      });
    }

    const patSnap = await patientsCol().doc(patientId).get();
    if (!patSnap.exists) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }
    const patient = docToObj(patSnap);

    const bmiValue       = calculateBMI(weight, height);
    const classification = classifyBMI(bmiValue);
    const recommendation = generateThresholdRecommendation(classification);

    // Save BMI record
    const bmiRef = bmiCol().doc();
    const bmiData = {
      patientId,
      recordedBy:              req.user._id,
      weight,
      height,
      bmi:                     bmiValue,
      classification,
      thresholdRecommendation: recommendation,
      timestamp:               new Date(),
      createdAt:               serverTimestamp(),
    };
    await bmiRef.set(bmiData);
    const bmiRecord = { _id: bmiRef.id, ...bmiData };

    // Update patient's bmi sub-document and apply threshold recommendation
    const patientUpdate = {
      'bmi.weight':         weight,
      'bmi.height':         height,
      'bmi.value':          bmiValue,
      'bmi.classification': classification,
      'threshold.spo2Min':  recommendation.spo2Min,
      'threshold.spo2Max':  recommendation.spo2Max,
      'threshold.hrMin':    recommendation.hrMin,
      'threshold.hrMax':    recommendation.hrMax,
      updatedAt:            serverTimestamp(),
    };
    await patientsCol().doc(patientId).update(patientUpdate);

    // Return updated patient
    const updatedSnap = await patientsCol().doc(patientId).get();
    const updatedPatient = docToObj(updatedSnap);

    res.status(201).json({
      success: true,
      message: `BMI calculated: ${bmiValue} kg/m² — ${classification}`,
      bmiRecord,
      classification,
      thresholdRecommendation: recommendation,
      patient: updatedPatient,
    });
  } catch (err) {
    console.error('POST /bmi error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/bmi/patient/:patientId ─────────────────────────────────────────
router.get('/patient/:patientId', async (req, res) => {
  try {
    if (!isValidId(req.params.patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patientId.' });
    }

    const snap = await bmiCol()
      .where('patientId', '==', req.params.patientId)
      .orderBy('timestamp', 'desc')
      .get();

    const records = snapshotToArray(snap);

    // Populate recordedBy
    await Promise.all(
      records.map(async (r) => {
        if (r.recordedBy) {
          const s = await usersCol().doc(String(r.recordedBy)).get();
          if (s.exists) {
            const u = s.data();
            r.recordedBy = { _id: s.id, name: u.name, role: u.role };
          }
        }
      })
    );

    res.status(200).json({ success: true, count: records.length, records });
  } catch (err) {
    console.error('GET /bmi/patient/:patientId error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
