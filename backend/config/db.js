/**
 * config/db.js
 * Firebase Admin SDK initialiser for Vital X backend.
 *
 * Reads the service account key from config/serviceAccountKey.json and
 * initialises the Admin SDK so every other module can import `db` from
 * models/firestore.js without re-initialising.
 *
 * NOTE: The existing Firebase Realtime Database (used by the ESP8266
 * hardware) is handled separately in config/firebase.js and is NOT
 * affected by this file.
 *
 * Place your service account key at:
 *   backend/config/serviceAccountKey.json
 * (download from Firebase Console → Project Settings → Service Accounts)
 */

const admin = require('firebase-admin');
const path  = require('path');

let _db = null;

/**
 * initFirestore
 * Initialises the Firebase Admin SDK and returns the Firestore instance.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
function initFirestore() {
  if (admin.apps.length > 0) {
    _db = admin.firestore();
    return _db;
  }

  const keyPath = path.join(__dirname, 'serviceAccountKey.json');

  try {
    const serviceAccount = require(keyPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    _db = admin.firestore();
    console.log('✅  Firestore connected successfully.');
    return _db;
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error(
        '❌  serviceAccountKey.json not found at backend/config/serviceAccountKey.json\n' +
        '    → Download it from: Firebase Console → Project Settings → Service Accounts → Generate new private key'
      );
    } else {
      console.error('❌  Firestore init failed:', err.message);
    }
    process.exit(1);
  }
}

/**
 * getDb — returns the already-initialised Firestore instance.
 * Call initFirestore() once in server.js before using this.
 */
function getDb() {
  if (!_db) throw new Error('Firestore not initialised. Call initFirestore() first.');
  return _db;
}

module.exports = { initFirestore, getDb };
