/**
 * routes/readings.js
 * Vital-sign reading routes — Firestore edition.
 * API surface identical to the Mongoose version.
 */

const express = require('express');
const {
  patientsCol, readingsCol, alertsCol,
  docToObj, snapshotToArray, isValidId,
  serverTimestamp,
} = require('../models/firestore');
const { usersCol }               = require('../models/firestore');
const { protect, restrictTo }    = require('../middleware/auth');
const { classifyReading }        = require('../engines/classificationEngine');
const { sendCriticalAlert }      = require('../services/hubtelService');

const router = express.Router();
router.use(protect);

// ─── Shared reading pipeline ───────────────────────────────────────────────────
async function processReading({
  patientId,
  spo2,
  heartRate,
  captureContext = 'clinical',
  capturedBy     = null,
  deviceId       = null,
  sessionId      = null,
  gpsCoordinates = null,
  timestamp      = new Date(),
}) {
  // 1. Load patient
  const patSnap = await patientsCol().doc(String(patientId)).get();
  if (!patSnap.exists) {
    const err = new Error(`Patient with ID "${patientId}" not found.`);
    err.status = 404;
    throw err;
  }
  const patient = docToObj(patSnap);

  // 2. Fetch recent readings for trend analysis
  const trendWindow = (patient.threshold && patient.threshold.trendWindow) || 5;
  const recentSnap = await readingsCol()
    .where('patientId', '==', String(patientId))
    .orderBy('timestamp', 'desc')
    .limit(trendWindow + 1)
    .get();
  const recentReadings = snapshotToArray(recentSnap);

  // 3. Classify
  const classification = classifyReading(
    spo2,
    heartRate,
    patient.threshold || {},
    recentReadings
  );

  // 4. Persist reading
  const readingRef = readingsCol().doc();
  const readingData = {
    patientId:      String(patientId),
    capturedBy:     capturedBy ? String(capturedBy) : null,
    captureContext,
    spo2,
    heartRate,
    status:         classification.status,
    trendDirection: classification.trendDirection,
    timestamp:      timestamp instanceof Date ? timestamp : new Date(timestamp),
    deviceId:       deviceId || null,
    sessionId:      sessionId || null,
    details:        classification.details || null,
    createdAt:      serverTimestamp(),
  };
  await readingRef.set(readingData);
  const reading = { _id: readingRef.id, ...readingData };

  // 5. Create alert for WARNING / CRITICAL
  let alert = null;
  if (classification.status !== 'NORMAL') {
    const alertRef = alertsCol().doc();
    const alertData = {
      patientId:      String(patientId),
      readingId:      readingRef.id,
      severity:       classification.status,
      message:        classification.suggestedAction,
      timestamp:      readingData.timestamp,
      gpsCoordinates: gpsCoordinates || { lat: null, lng: null },
      isResolved:     false,
      resolvedAt:     null,
      resolvedBy:     null,
      smsDelivered:   false,
      smsSentTo:      [],
      createdAt:      serverTimestamp(),
    };

    // 6. SMS for CRITICAL
    if (classification.status === 'CRITICAL') {
      const phones = (patient.emergencyContacts || []).map((c) => c.phone).filter(Boolean);
      if (phones.length > 0) {
        try {
          const smsResults = await sendCriticalAlert(patient, reading, gpsCoordinates, phones);
          alertData.smsDelivered = smsResults.every((r) => r.success);
          alertData.smsSentTo    = phones;
          console.log(
            `📱  CRITICAL alert SMS: ${smsResults.filter((r) => r.success).length}/${phones.length} delivered`
          );
        } catch (smsErr) {
          console.error('SMS dispatch error:', smsErr.message);
          alertData.smsDelivered = false;
          alertData.smsSentTo    = phones;
        }
      }
    }

    await alertRef.set(alertData);
    alert = { _id: alertRef.id, ...alertData };
  }

  return { reading, classification, alert };
}

// ─── POST /api/readings ────────────────────────────────────────────────────────
router.post('/', restrictTo('clinician', 'provider'), async (req, res) => {
  try {
    const {
      patientId,
      spo2,
      heartRate,
      captureContext = 'clinical',
      deviceId       = null,
      sessionId      = null,
      gpsCoordinates = null,
      timestamp,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({ success: false, message: 'patientId is required.' });
    }
    if (typeof spo2 !== 'number' || typeof heartRate !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'spo2 and heartRate must be numbers.',
      });
    }
    if (!isValidId(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patientId.' });
    }

    const { reading, classification, alert } = await processReading({
      patientId,
      spo2,
      heartRate,
      captureContext,
      capturedBy: req.user._id,
      deviceId,
      sessionId,
      gpsCoordinates,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Reading submitted successfully.',
      reading,
      classification,
      alert: alert || null,
    });
  } catch (err) {
    console.error('POST /readings error:', err.message);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/readings/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid reading ID.' });
    }

    const snap = await readingsCol().doc(req.params.id).get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Reading not found.' });
    }

    const reading = docToObj(snap);

    // Populate patientId
    if (reading.patientId) {
      const pSnap = await patientsCol().doc(String(reading.patientId)).get();
      if (pSnap.exists) {
        const p = pSnap.data();
        reading.patientId = { _id: pSnap.id, name: p.name, membershipId: p.membershipId };
      }
    }
    // Populate capturedBy
    if (reading.capturedBy) {
      const uSnap = await usersCol().doc(String(reading.capturedBy)).get();
      if (uSnap.exists) {
        const u = uSnap.data();
        reading.capturedBy = { _id: uSnap.id, name: u.name, role: u.role };
      }
    }

    res.status(200).json({ success: true, reading });
  } catch (err) {
    console.error('GET /readings/:id error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.processReading = processReading;
