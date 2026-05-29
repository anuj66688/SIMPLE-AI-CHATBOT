const { getAdmin, getDb } = require('../config/firebase');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Middleware to verify Firebase ID Token or JWT
 * Attaches user data to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required',
      });
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    let decodedUser = null;

    // Try Firebase token verification first
    try {
      const admin = getAdmin();
      const decodedToken = await admin.auth().verifyIdToken(token);
      decodedUser = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0],
        role: 'user',
        authType: 'firebase',
      };

      // Check if user has admin role in Firestore
      const db = getDb();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      if (userDoc.exists && userDoc.data().role === 'admin') {
        decodedUser.role = 'admin';
      }
    } catch (firebaseError) {
      // Try JWT verification as fallback
      try {
        const jwtDecoded = jwt.verify(token, process.env.JWT_SECRET);
        decodedUser = {
          uid: jwtDecoded.uid,
          email: jwtDecoded.email,
          name: jwtDecoded.name,
          role: jwtDecoded.role || 'user',
          authType: 'jwt',
        };
      } catch (jwtError) {
        logger.warn(`Auth failed: ${jwtError.message}`);
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
        });
      }
    }

    req.user = decodedUser;
    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
};

/**
 * Middleware to check if user has admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  if (req.user.role !== 'admin') {
    logger.warn(`Admin access denied for user: ${req.user.uid}`);
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }

  next();
};

module.exports = { authenticate, requireAdmin };
