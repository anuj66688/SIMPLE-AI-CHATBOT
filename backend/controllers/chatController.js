const { getDb } = require('../config/firebase');
const { generateResponse, generateChatTitle } = require('../services/geminiService');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * POST /api/chat
 * Send a message and get AI response
 */
const sendMessage = async (req, res, next) => {
  try {
    const { chatId, message } = req.body;
    const uid = req.user.uid;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const db = getDb();
    let currentChatId = chatId;
    let isNewChat = false;

    // Create new chat if no chatId provided
    if (!currentChatId) {
      currentChatId = uuidv4();
      isNewChat = true;
    } else {
      // Verify user owns this chat
      const chatDoc = await db.collection('chats').doc(currentChatId).get();
      if (!chatDoc.exists || chatDoc.data().uid !== uid) {
        return res.status(403).json({ success: false, error: 'Chat not found or access denied' });
      }
    }

    // Load conversation history for context
    let history = [];
    if (!isNewChat) {
      const messagesSnap = await db
        .collection('messages')
        .where('chatId', '==', currentChatId)
        .orderBy('timestamp', 'asc')
        .limit(50) // Last 50 messages for context
        .get();

      history = messagesSnap.docs.map((doc) => doc.data());
    }

    // Generate AI response
    const { response: aiResponse, tokensUsed } = await generateResponse(message, history);

    const now = new Date().toISOString();
    const sessionId = req.headers['x-session-id'] || uuidv4();

    // Save user message
    const userMessageId = uuidv4();
    await db.collection('messages').doc(userMessageId).set({
      messageId: userMessageId,
      chatId: currentChatId,
      sender: 'user',
      content: message,
      timestamp: now,
      uid,
    });

    // Save AI message
    const aiMessageId = uuidv4();
    await db.collection('messages').doc(aiMessageId).set({
      messageId: aiMessageId,
      chatId: currentChatId,
      sender: 'bot',
      content: aiResponse,
      timestamp: new Date().toISOString(),
      uid,
    });

    // Create or update chat document
    if (isNewChat) {
      const title = await generateChatTitle(message);
      await db.collection('chats').doc(currentChatId).set({
        chatId: currentChatId,
        uid,
        title,
        createdAt: now,
        updatedAt: new Date().toISOString(),
        messageCount: 2,
      });

      // Increment user's total chats
      await db
        .collection('users')
        .doc(uid)
        .update({
          totalChats: require('firebase-admin').firestore.FieldValue.increment(1),
          totalMessages: require('firebase-admin').firestore.FieldValue.increment(2),
          updatedAt: new Date().toISOString(),
        });
    } else {
      await db
        .collection('chats')
        .doc(currentChatId)
        .update({
          updatedAt: new Date().toISOString(),
          messageCount: require('firebase-admin').firestore.FieldValue.increment(2),
        });

      await db
        .collection('users')
        .doc(uid)
        .update({
          totalMessages: require('firebase-admin').firestore.FieldValue.increment(2),
          updatedAt: new Date().toISOString(),
        });
    }

    // Log interaction in Firestore
    const logId = uuidv4();
    await db.collection('logs').doc(logId).set({
      logId,
      userId: uid,
      sessionId,
      chatId: currentChatId,
      question: message,
      answer: aiResponse,
      timestamp: now,
      tokensUsed,
    });

    logger.info(`Chat message processed. User: ${uid}, Chat: ${currentChatId}, Tokens: ${tokensUsed}`);

    res.status(200).json({
      success: true,
      chatId: currentChatId,
      isNewChat,
      userMessage: {
        messageId: userMessageId,
        sender: 'user',
        content: message,
        timestamp: now,
      },
      botMessage: {
        messageId: aiMessageId,
        sender: 'bot',
        content: aiResponse,
        timestamp: new Date().toISOString(),
      },
      tokensUsed,
    });
  } catch (error) {
    logger.error('Send message error:', error);
    next(error);
  }
};

/**
 * POST /api/chat/new
 * Create a new empty chat session
 */
const createNewChat = async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const db = getDb();
    const chatId = uuidv4();
    const now = new Date().toISOString();

    await db.collection('chats').doc(chatId).set({
      chatId,
      uid,
      title: 'New Chat',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    });

    await db
      .collection('users')
      .doc(uid)
      .update({
        totalChats: require('firebase-admin').firestore.FieldValue.increment(1),
        updatedAt: now,
      });

    res.status(201).json({
      success: true,
      chat: { chatId, uid, title: 'New Chat', createdAt: now, updatedAt: now, messageCount: 0 },
    });
  } catch (error) {
    logger.error('Create new chat error:', error);
    next(error);
  }
};

/**
 * GET /api/chat/history
 * Get all chats for the authenticated user
 */
const getChatHistory = async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const db = getDb();

    const chatsSnap = await db
      .collection('chats')
      .where('uid', '==', uid)
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get();

    const chats = chatsSnap.docs.map((doc) => doc.data());

    res.status(200).json({ success: true, chats });
  } catch (error) {
    logger.error('Get chat history error:', error);
    next(error);
  }
};

/**
 * GET /api/chat/:id
 * Get a specific chat and its messages
 */
const getChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    const uid = req.user.uid;
    const db = getDb();

    const chatDoc = await db.collection('chats').doc(id).get();

    if (!chatDoc.exists) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }

    const chatData = chatDoc.data();

    if (chatData.uid !== uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const messagesSnap = await db
      .collection('messages')
      .where('chatId', '==', id)
      .orderBy('timestamp', 'asc')
      .get();

    const messages = messagesSnap.docs.map((doc) => doc.data());

    res.status(200).json({ success: true, chat: chatData, messages });
  } catch (error) {
    logger.error('Get chat error:', error);
    next(error);
  }
};

/**
 * DELETE /api/chat/:id
 * Delete a chat and all its messages
 */
const deleteChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    const uid = req.user.uid;
    const db = getDb();

    const chatDoc = await db.collection('chats').doc(id).get();

    if (!chatDoc.exists) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }

    if (chatDoc.data().uid !== uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Delete all messages in this chat using batch
    const messagesSnap = await db.collection('messages').where('chatId', '==', id).get();

    const batch = db.batch();
    messagesSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(db.collection('chats').doc(id));
    await batch.commit();

    // Update user stats
    await db
      .collection('users')
      .doc(uid)
      .update({
        totalChats: require('firebase-admin').firestore.FieldValue.increment(-1),
        totalMessages: require('firebase-admin').firestore.FieldValue.increment(
          -messagesSnap.size
        ),
        updatedAt: new Date().toISOString(),
      });

    logger.info(`Chat deleted: ${id} by user: ${uid}`);

    res.status(200).json({ success: true, message: 'Chat deleted successfully' });
  } catch (error) {
    logger.error('Delete chat error:', error);
    next(error);
  }
};

/**
 * PUT /api/chat/rename/:id
 * Rename a chat
 */
const renameChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const uid = req.user.uid;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const db = getDb();
    const chatDoc = await db.collection('chats').doc(id).get();

    if (!chatDoc.exists) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }

    if (chatDoc.data().uid !== uid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const newTitle = title.trim().substring(0, 100);

    await db.collection('chats').doc(id).update({
      title: newTitle,
      updatedAt: new Date().toISOString(),
    });

    logger.info(`Chat renamed: ${id} to "${newTitle}" by user: ${uid}`);

    res.status(200).json({ success: true, message: 'Chat renamed successfully', title: newTitle });
  } catch (error) {
    logger.error('Rename chat error:', error);
    next(error);
  }
};

module.exports = { sendMessage, createNewChat, getChatHistory, getChat, deleteChat, renameChat };
