const express = require('express');
const router = express.Router();
const {
  sendMessage,
  createNewChat,
  getChatHistory,
  getChat,
  deleteChat,
  renameChat,
} = require('../controllers/chatController');
const { authenticate } = require('../middleware/authMiddleware');
const { chatLimiter } = require('../middleware/rateLimiter');

// All chat routes require authentication
router.use(authenticate);

// POST /api/chat - Send message and get AI response
router.post('/', chatLimiter, sendMessage);

// POST /api/chat/new - Create new empty chat
router.post('/new', createNewChat);

// GET /api/chat/history - Get user's chat history
router.get('/history', getChatHistory);

// GET /api/chat/:id - Get specific chat with messages
router.get('/:id', getChat);

// DELETE /api/chat/:id - Delete a chat
router.delete('/:id', deleteChat);

// PUT /api/chat/rename/:id - Rename a chat
router.put('/rename/:id', renameChat);

module.exports = router;
