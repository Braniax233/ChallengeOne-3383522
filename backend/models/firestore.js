/**
 * models/firestore.js
 * Central Firestore helper for the Vital X backend.
 *
 * Replaces all Mongoose model files (User, Patient, Reading, Alert,
 * BmiRecord, SessionNote).  Every route imports what it needs from here.
 *
 * Key design decisions
 * ────────────────────
 * • Firestore documents use a string `id` field.  The `docToObj` helper
 *   maps it to `_id` so all API responses remain identical to the old
 *   Mongoose shape — the frontend needs zero changes.
 * • Password hashing (bcrypt) is done explicitly here since Firestore
 *   has no pre-save hooks.
 * • ObjectId validation is replaced by a simple non-empty-string guard.
 */

const { getDb }  = require('../config/db');
const bcrypt     = require('bcryptjs');
const admin      = require('firebase-admin');

const SALT_ROUNDS = 12;

// ── Collection name constants ─────────────────────────────────────────────────
const COLLECTIONS = {
  users:    'users',
  patients: 'patients',
  readings: 'readings',
  alerts:   'alerts',
  bmi:      'bmiRecords',
  notes:    'sessionNotes',
};

// ── Lazy collection accessors (db is ready after initFirestore()) ──────────────
const col = (name) => getDb().collection(name);

const usersCol    = () => col(COLLECTIONS.users);
const patientsCol = () => col(COLLECTIONS.patients);
const readingsCol = () => col(COLLECTIONS.readings);
const alertsCol   = () => col(COLLECTIONS.alerts);
const bmiCol      = () => col(COLLECTIONS.bmi);
const notesCol    = () => col(COLLECTIONS.notes);

// ── Server timestamp helper ───────────────────────────────────────────────────
const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

// ── docToObj ─────────────────────────────────────────────────────────────────
/**
 * Converts a Firestore DocumentSnapshot into a plain JS object.
 * Maps Firestore's `id` → `_id` so existing route/response code works
 * without modification.
 *
 * @param {FirebaseFirestore.DocumentSnapshot} snap
 * @returns {object|null}
 */
function docToObj(snap) {
  if (!snap || !snap.exists) return null;
  const data = snap.data();
  // Convert any Firestore Timestamps to JS Date objects
  const converted = convertTimestamps(data);
  return { _id: snap.id, ...converted };
}

/**
 * Recursively converts Firestore Timestamp values to JS Date objects.
 */
function convertTimestamps(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj && typeof obj.toDate === 'function') return obj.toDate();
  if (Array.isArray(obj)) return obj.map(convertTimestamps);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = convertTimestamps(v);
    }
    return out;
  }
  return obj;
}

/**
 * snapshotToArray
 * Converts a Firestore QuerySnapshot into an array of plain objects.
 */
function snapshotToArray(snapshot) {
  return snapshot.docs.map(docToObj);
}

// ── ID validation ─────────────────────────────────────────────────────────────
/**
 * isValidId — replaces mongoose.Types.ObjectId.isValid()
 * Firestore IDs are non-empty strings (auto-generated or manually set).
 */
function isValidId(id) {
  return typeof id === 'string' && id.trim().length > 0;
}

// ── Password helpers ──────────────────────────────────────────────────────────
async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ── "populate" helpers ────────────────────────────────────────────────────────
// Firestore has no JOIN / populate. These helpers manually fetch related
// documents and attach them — mimicking Mongoose's .populate() behaviour.

/**
 * populateField
 * Fetches a referenced document and attaches selected fields to `obj`.
 *
 * @param {object}   obj         — the parent object to mutate
 * @param {string}   field       — field name holding the referenced ID (e.g. 'patientId')
 * @param {Function} colFn       — collection accessor, e.g. patientsCol
 * @param {string[]} [select]    — fields to keep; omit to keep all
 */
async function populateField(obj, field, colFn, select) {
  const refId = obj[field];
  if (!refId) return obj;
  const snap = await colFn().doc(String(refId)).get();
  if (!snap.exists) return obj;
  let related = docToObj(snap);
  if (select && select.length) {
    const kept = { _id: related._id };
    for (const f of select) if (related[f] !== undefined) kept[f] = related[f];
    related = kept;
  }
  obj[field] = related;
  return obj;
}

/**
 * populateMany
 * Calls populateField for every object in an array.
 */
async function populateMany(arr, field, colFn, select) {
  return Promise.all(arr.map((o) => populateField(o, field, colFn, select)));
}

// ── Export everything ─────────────────────────────────────────────────────────
module.exports = {
  // Collection accessors
  usersCol,
  patientsCol,
  readingsCol,
  alertsCol,
  bmiCol,
  notesCol,

  // Helpers
  docToObj,
  snapshotToArray,
  isValidId,
  serverTimestamp,
  convertTimestamps,

  // Password
  hashPassword,
  comparePassword,

  // Populate
  populateField,
  populateMany,

  // Re-export admin for FieldValue etc.
  admin,
};
