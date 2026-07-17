/**
 * middleware/auth.js
 * Real JWT authentication middleware for Vital X — Firestore edition.
 *
 * protect        — verifies the Bearer token, loads the user from Firestore,
 *                  and attaches them to req.user
 * restrictTo(...roles) — role-based access guard (unchanged logic)
 */

const jwt = require('jsonwebtoken');
const { usersCol, docToObj } = require('../models/firestore');

// ─── protect ──────────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please log in.',
      });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Your session has expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in.',
      });
    }

    // 3. Fetch user from Firestore (ensures account still exists and is active)
    const snap = await usersCol().doc(decoded.id).get();
    if (!snap.exists) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists.',
      });
    }

    const user = docToObj(snap);

    // Never expose the password hash downstream
    delete user.passwordHash;

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated.',
      });
    }

    // 4. Attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error('protect middleware error:', err.message);
    res.status(500).json({ success: false, message: 'Authentication error.' });
  }
};

// ─── restrictTo ───────────────────────────────────────────────────────────────
const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This route is restricted to: ${roles.join(', ')}.`,
      });
    }
    next();
  };

module.exports = { protect, restrictTo };
