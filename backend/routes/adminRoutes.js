const express = require('express');
const router = express.Router();
const {
  getStats,
  getUsers,
  getChats,
  getLogs,
  getAnalytics,
  deleteUser,
} = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', getStats);

// GET /api/admin/users - All users
router.get('/users', getUsers);

// DELETE /api/admin/users/:uid - Delete a user
router.delete('/users/:uid', deleteUser);

// GET /api/admin/chats - All chats
router.get('/chats', getChats);

// GET /api/admin/logs - Interaction logs
router.get('/logs', getLogs);

// GET /api/admin/analytics - Analytics data for charts
router.get('/analytics', getAnalytics);

module.exports = router;
