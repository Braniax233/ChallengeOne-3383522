/**
 * context/AuthContext.jsx
 * Authentication via Firebase Auth (client-side).
 *
 * Profile data (name, role, etc.) is stored in localStorage so the app
 * works without needing special Firebase RTDB rules.  An RTDB write is
 * also attempted opportunistically — if it fails due to permissions it
 * is silently ignored.
 *
 * The ESP8266 hardware continues to write directly to RTDB unchanged.
 */

import {
  createContext, useState, useContext, useCallback, useEffect,
} from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { ref, set, get, remove } from 'firebase/database';
import { auth, rtdb } from '../api/firebase';

/** Set to true to use mock data without Firebase. */
export const DEV_MODE = false;

const AuthContext = createContext(null);

const PROFILE_KEY = 'vitalx_profile'; // localStorage key

// ── Helpers ───────────────────────────────────────────────────────────────────
const saveLocal  = (uid, profile) =>
  localStorage.setItem(`${PROFILE_KEY}_${uid}`, JSON.stringify(profile));

const loadLocal  = (uid) => {
  try {
    const raw = localStorage.getItem(`${PROFILE_KEY}_${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const clearLocal = (uid) =>
  localStorage.removeItem(`${PROFILE_KEY}_${uid}`);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Resolve full user from Firebase auth state ────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // 1. Try localStorage first (fast, always available)
        let profile = loadLocal(fbUser.uid);

        // 2. If not in localStorage, try RTDB (may fail on first load)
        if (!profile) {
          try {
            const snap = await get(ref(rtdb, `users/${fbUser.uid}`));
            if (snap.exists()) {
              profile = snap.val();
              saveLocal(fbUser.uid, profile);   // cache it
            }
          } catch { /* RTDB permission denied — fall through */ }
        }

        setUser({
          uid:   fbUser.uid,
          email: fbUser.email,
          ...(profile || {}),
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── register ─────────────────────────────────────────────────────────────
  const register = useCallback(async (userData) => {
    const {
      name, email, password, role,
      phone = '', department = '', dob = null, gender = '', memberId = '',
    } = userData;

    // 1. Create Firebase Auth account
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = cred.user;

    let profile = {
      name,
      email:      email.toLowerCase().trim(),
      role,
      phone,
      department,
      dob:        dob    || null,
      gender:     gender || '',
      isActive:   true,
      createdAt:  Date.now(),
      ...(role === 'patient' && {
        memberId: memberId || `GH-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      }),
    };

    // 2.5 Migration logic for patients claiming an account
    if (role === 'patient' && memberId) {
      try {
        const snap = await get(ref(rtdb, 'users'));
        if (snap.exists()) {
          let oldUid = null;
          let oldProfile = null;
          snap.forEach(child => {
            const u = child.val();
            if (u.role === 'patient' && (u.memberId || '').toUpperCase() === memberId.toUpperCase() && child.key !== uid) {
              oldUid = child.key;
              oldProfile = u;
            }
          });

          if (oldUid) {
            // Merge profiles (keep new email/password/name, but inherit old data like emergency contacts)
            profile = { ...oldProfile, ...profile };
            
            // Migrate readings
            const rSnap = await get(ref(rtdb, `readings/${oldUid}`));
            if (rSnap.exists()) {
              await set(ref(rtdb, `readings/${uid}`), rSnap.val());
              await remove(ref(rtdb, `readings/${oldUid}`));
            }
            
            // Migrate notes
            const nSnap = await get(ref(rtdb, `notes/${oldUid}`));
            if (nSnap.exists()) {
              await set(ref(rtdb, `notes/${uid}`), nSnap.val());
              await remove(ref(rtdb, `notes/${oldUid}`));
            }

            // Remove old user
            await remove(ref(rtdb, `users/${oldUid}`));
          }
        }
      } catch (e) {
        console.error("Migration failed:", e);
      }
    }

    // 3. Save to localStorage (primary — always works)
    saveLocal(uid, profile);

    // 4. Attempt RTDB write (secondary — may be blocked by rules)
    try {
      await set(ref(rtdb, `users/${uid}`), profile);
    } catch {
      // RTDB permission denied — profile is still in localStorage, app works fine
    }

    const fullUser = { uid, ...profile };
    setUser(fullUser);
    return fullUser;
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const { uid } = cred.user;

    // Try localStorage cache first
    let profile = loadLocal(uid);

    // Fall back to RTDB
    if (!profile) {
      try {
        const snap = await get(ref(rtdb, `users/${uid}`));
        if (snap.exists()) {
          profile = snap.val();
          saveLocal(uid, profile);
        }
      } catch { /* ignore */ }
    }

    const fullUser = { uid, email: cred.user.email, ...(profile || {}) };
    setUser(fullUser);
    return fullUser;
  }, []);

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    await signOut(auth);
    // Removed clearLocal so offline cache persists across logouts
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        token: user ? 'firebase-session' : null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
