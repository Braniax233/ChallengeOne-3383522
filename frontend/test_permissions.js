import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, push } from "firebase/database";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

// Firebase Credentials from user's original message
const firebaseConfig = {
  databaseURL: "https://vitalwatch123-default-rtdb.firebaseio.com",
  apiKey: "AIzaSyDHbSqJ0CPPGget2JsRZxXwCDY_A7uwC5E",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const rtdb = getDatabase(app);

async function testPermissions() {
  try {
    // Authenticate as a user to test write permissions
    await signInWithEmailAndPassword(auth, "braniax123@gmail.com", "aaaaaaaa");
    console.log("Authenticated as:", auth.currentUser.uid);

    // Test writing to /users/test
    try {
      await set(ref(rtdb, "users/test"), { hello: "world" });
      console.log("Write to /users/test SUCCEEDED");
    } catch (e) {
      console.log("Write to /users/test FAILED:", e.message);
    }

    // Test writing to /patients/test
    try {
      await set(ref(rtdb, "patients/test"), { hello: "world" });
      console.log("Write to /patients/test SUCCEEDED");
    } catch (e) {
      console.log("Write to /patients/test FAILED:", e.message);
    }

    // Test writing to our own UID node
    try {
      await set(ref(rtdb, `users/${auth.currentUser.uid}`), { hello: "world" });
      console.log("Write to own UID SUCCEEDED");
    } catch (e) {
      console.log("Write to own UID FAILED:", e.message);
    }

    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

testPermissions();
