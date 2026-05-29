const { getAdmin, getDb } = require('../config/firebase');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * POST /api/auth/register
 * Register user and store in Firestore
 */
const registerUser = async (req, res, next) => {
  try {
    const { uid, email, name, photoURL } = req.body;

    if (!uid || !email) {
      return res.status(400).json({
        success: false,
        error: 'UID and email are required',
      });
    }

    const db = getDb();
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Create new user document
      await userRef.set({
        uid,
        email,
        name: name || email.split('@')[0],
        photoURL: photoURL || null,
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        totalChats: 0,
        totalMessages: 0,
      });

      logger.info(`New user registered: ${email} (${uid})`);
    } else {
      // Update last login
      await userRef.update({
        lastLoginAt: new Date().toISOString(),
        name: name || userDoc.data().name,
        photoURL: photoURL || userDoc.data().photoURL,
        updatedAt: new Date().toISOString(),
      });
    }

    const userData = (await userRef.get()).data();

    // Generate JWT token
    const token = jwt.sign(
      { uid, email, name: userData.name, role: userData.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: userDoc.exists ? 'User logged in successfully' : 'User registered successfully',
      user: {
        uid: userData.uid,
        email: userData.email,
        name: userData.name,
        photoURL: userData.photoURL,
        role: userData.role,
      },
      token,
    });
  } catch (error) {
    logger.error('Register user error:', error);
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Verify Firebase token and return user data
 */
const loginUser = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: 'Firebase ID token is required',
      });
    }

    const admin = getAdmin();
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    const db = getDb();
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    let userData;

    if (!userDoc.exists) {
      // Create user if not exists
      const newUser = {
        uid,
        email,
        name: name || email.split('@')[0],
        photoURL: picture || null,
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        totalChats: 0,
        totalMessages: 0,
      };
      await userRef.set(newUser);
      userData = newUser;
    } else {
      await userRef.update({
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      userData = userDoc.data();
    }

    // Generate JWT token
    const token = jwt.sign(
      { uid, email, name: userData.name, role: userData.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info(`User logged in: ${email}`);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        uid: userData.uid,
        email: userData.email,
        name: userData.name,
        photoURL: userData.photoURL,
        role: userData.role,
      },
      token,
    });
  } catch (error) {
    logger.error('Login error:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Revoke refresh tokens (optional: just acknowledge)
 */
const logoutUser = async (req, res, next) => {
  try {
    const uid = req.user?.uid;

    if (uid) {
      // Optionally revoke Firebase tokens
      const admin = getAdmin();
      await admin.auth().revokeRefreshTokens(uid).catch(() => {});
      logger.info(`User logged out: ${uid}`);
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Get current user profile
 */
const getMe = async (req, res, next) => {
  try {
    const db = getDb();
    const userDoc = await db.collection('users').doc(req.user.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userData = userDoc.data();
    delete userData.privateKey;

    res.status(200).json({
      success: true,
      user: userData,
    });
  } catch (error) {
    logger.error('Get me error:', error);
    next(error);
  }
};

module.exports = { registerUser, loginUser, logoutUser, getMe };
