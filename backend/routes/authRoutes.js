const express = require('express');
const router = express.Router();
const { registerUser, loginUser, logoutUser, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

// POST /api/auth/register - Register or sync user after Firebase auth
router.post('/register', authLimiter, registerUser);

// POST /api/auth/login - Verify Firebase token and get JWT
router.post('/login', authLimiter, loginUser);

// POST /api/auth/logout - Logout user
router.post('/logout', authenticate, logoutUser);

// GET /api/auth/me - Get current user profile
router.get('/me', authenticate, getMe);

module.exports = router;
