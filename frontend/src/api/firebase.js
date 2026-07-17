/**
 * Firebase client-side configuration.
 * Uses the same Firebase project as the ESP8266 hardware —
 * so hardware data and auth share the same project.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey:            "AIzaSyDHbSqJ0CPPGget2JsRZxXwCDY_A7uwC5E",
  authDomain:        "vitalwatch123.firebaseapp.com",
  databaseURL:       "https://vitalwatch123-default-rtdb.firebaseio.com",
  projectId:         "vitalwatch123",
  storageBucket:     "vitalwatch123.appspot.com",
  messagingSenderId: "",       // optional
  appId:             "",       // optional
};

const app      = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const rtdb = getDatabase(app);   // Realtime DB (same as ESP8266)

export default app;
