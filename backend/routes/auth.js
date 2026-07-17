/**
 * routes/auth.js
 * Authentication routes for the Vital X API — Firestore edition.
 *
 * POST /api/auth/login    — email + password → JWT
 * POST /api/auth/logout   — stateless logout acknowledgement
 * GET  /api/auth/me       — return current authenticated user
 * POST /api/auth/register — create a new user account
 */

const express = require('express');
const jwt     = require('jsonwebtoken');
const { protect } = require('../middleware/auth');
const {
  usersCol,
  patientsCol,
  docToObj,
  isValidId,
  hashPassword,
  comparePassword,
  serverTimestamp,
} = require('../models/firestore');

const router = express.Router();

// ─── Helper: sign JWT ─────────────────────────────────────────────────────────
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
}

// ─── Safe user shape for API responses ───────────────────────────────────────
function safeUser(userObj) {
  const { passwordHash, ...rest } = userObj;
  return rest;
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    // Find user by email (case-insensitive via lowercase storage)
    const snap = await usersCol()
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = docToObj(snap.docs[0]);

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact your administrator.',
      });
    }

    // Verify password
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = signToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: safeUser(user),
    });
  } catch (err) {
    console.error('POST /auth/login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully. Please discard your token.',
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const snap = await usersCol().doc(req.user._id).get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let user = docToObj(snap);

    // If the user is a patient, also attach the linked Patient document
    if (user.role === 'patient' && user.patientId) {
      const patSnap = await patientsCol().doc(String(user.patientId)).get();
      if (patSnap.exists) {
        user.patientId = docToObj(patSnap);
      }
    }

    res.status(200).json({ success: true, user: safeUser(user) });
  } catch (err) {
    console.error('GET /auth/me error:', err.message);
    res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, department, dob, gender } = req.body;

    // Basic validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'name, email, password, and role are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
      });
    }

    const VALID_ROLES = ['clinician', 'provider', 'patient'];
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `role must be one of: ${VALID_ROLES.join(', ')}.`,
      });
    }

    // Email uniqueness check
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await usersCol()
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({
        success: false,
        message: 'A user with that email already exists.',
      });
    }

    // ── Patient record (role === 'patient' only) ──────────────────────────────
    let patientId = null;

    if (role === 'patient') {
      // Generate a collision-free membershipId in the format GH-YYYY-XXXX
      const year = new Date().getFullYear();
      let membershipId;
      let collision = true;

      while (collision) {
        const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        membershipId = `GH-${year}-${rand}`;
        const colSnap = await patientsCol()
          .where('membershipId', '==', membershipId)
          .limit(1)
          .get();
        collision = !colSnap.empty;
      }

      const patientRef = patientsCol().doc(); // auto-generate ID
      await patientRef.set({
        membershipId,
        name,
        dob:      dob || null,
        gender:   gender || '',
        phone:    phone || '',
        isActive: true,
        threshold: {
          spo2Min:       95,
          spo2Max:       100,
          hrMin:         60,
          hrMax:         100,
          warningMargin: 2,
          trendWindow:   5,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      patientId = patientRef.id;
    }

    // ── Hash password and create user ─────────────────────────────────────────
    const passwordHash = await hashPassword(password);

    const userRef = usersCol().doc(); // auto-generate ID
    await userRef.set({
      name,
      email:        normalizedEmail,
      passwordHash,
      role,
      phone:        phone || '',
      department:   department || '',
      patientId,
      isActive:     true,
      createdAt:    serverTimestamp(),
      updatedAt:    serverTimestamp(),
    });

    const token = signToken(userRef.id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: {
        _id:        userRef.id,
        name,
        email:      normalizedEmail,
        role,
        phone:      phone || '',
        department: department || '',
        patientId,
        isActive:   true,
      },
    });
  } catch (err) {
    console.error('POST /auth/register error:', err.message);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

module.exports = router;
