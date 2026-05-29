const { getDb } = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * GET /api/admin/stats
 * Get overall dashboard statistics
 */
const getStats = async (req, res, next) => {
  try {
    const db = getDb();
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Parallel Firestore queries
    const [usersSnap, chatsSnap, messagesSnap, todayLogsSnap, weekLogsSnap, monthLogsSnap] =
      await Promise.all([
        db.collection('users').get(),
        db.collection('chats').get(),
        db.collection('messages').get(),
        db.collection('logs').where('timestamp', '>=', todayStart).get(),
        db.collection('logs').where('timestamp', '>=', weekStart).get(),
        db.collection('logs').where('timestamp', '>=', monthStart).get(),
      ]);

    // Active users (logged in within last 7 days)
    const activeUsers = usersSnap.docs.filter((doc) => {
      const lastLogin = doc.data().lastLoginAt;
      return lastLogin && lastLogin >= weekStart;
    }).length;

    // Total tokens used
    const totalTokens = monthLogsSnap.docs.reduce(
      (sum, doc) => sum + (doc.data().tokensUsed || 0),
      0
    );

    res.status(200).json({
      success: true,
      stats: {
        totalUsers: usersSnap.size,
        totalChats: chatsSnap.size,
        totalMessages: messagesSnap.size,
        activeUsers,
        messagesToday: todayLogsSnap.size,
        messagesThisWeek: weekLogsSnap.size,
        messagesThisMonth: monthLogsSnap.size,
        totalTokensThisMonth: totalTokens,
      },
    });
  } catch (error) {
    logger.error('Admin getStats error:', error);
    next(error);
  }
};

/**
 * GET /api/admin/users
 * Get all users with pagination
 */
const getUsers = async (req, res, next) => {
  try {
    const db = getDb();
    const { limit = 50, page = 1 } = req.query;
    const limitNum = Math.min(parseInt(limit), 100);

    const snapshot = await db
      .collection('users')
      .orderBy('createdAt', 'desc')
      .limit(limitNum)
      .get();

    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      // Remove sensitive data
      delete data.privateKey;
      return data;
    });

    res.status(200).json({
      success: true,
      users,
      count: users.length,
      page: parseInt(page),
    });
  } catch (error) {
    logger.error('Admin getUsers error:', error);
    next(error);
  }
};

/**
 * GET /api/admin/chats
 * Get all chats with user info
 */
const getChats = async (req, res, next) => {
  try {
    const db = getDb();
    const { limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit), 100);

    const snapshot = await db
      .collection('chats')
      .orderBy('updatedAt', 'desc')
      .limit(limitNum)
      .get();

    const chats = snapshot.docs.map((doc) => doc.data());

    res.status(200).json({
      success: true,
      chats,
      count: chats.length,
    });
  } catch (error) {
    logger.error('Admin getChats error:', error);
    next(error);
  }
};

/**
 * GET /api/admin/logs
 * Get interaction logs with filtering
 */
const getLogs = async (req, res, next) => {
  try {
    const db = getDb();
    const { limit = 100, userId } = req.query;
    const limitNum = Math.min(parseInt(limit), 500);

    let query = db.collection('logs').orderBy('timestamp', 'desc').limit(limitNum);

    if (userId) {
      query = db
        .collection('logs')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limitNum);
    }

    const snapshot = await query.get();
    const logs = snapshot.docs.map((doc) => doc.data());

    res.status(200).json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    logger.error('Admin getLogs error:', error);
    next(error);
  }
};

/**
 * GET /api/admin/analytics
 * Get analytics data for charts
 */
const getAnalytics = async (req, res, next) => {
  try {
    const db = getDb();
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const logsSnap = await db
      .collection('logs')
      .where('timestamp', '>=', startDate)
      .orderBy('timestamp', 'asc')
      .get();

    // Group logs by day
    const dailyData = {};
    const tokensByDay = {};

    logsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const date = data.timestamp.split('T')[0]; // YYYY-MM-DD

      dailyData[date] = (dailyData[date] || 0) + 1;
      tokensByDay[date] = (tokensByDay[date] || 0) + (data.tokensUsed || 0);
    });

    // Build array for last N days
    const dailyMessages = [];
    const dailyTokens = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      dailyMessages.push({ date, count: dailyData[date] || 0 });
      dailyTokens.push({ date, tokens: tokensByDay[date] || 0 });
    }

    // User registrations by day
    const usersSnap = await db
      .collection('users')
      .where('createdAt', '>=', startDate)
      .orderBy('createdAt', 'asc')
      .get();

    const usersByDay = {};
    usersSnap.docs.forEach((doc) => {
      const date = doc.data().createdAt.split('T')[0];
      usersByDay[date] = (usersByDay[date] || 0) + 1;
    });

    const dailyRegistrations = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      dailyRegistrations.push({ date, count: usersByDay[date] || 0 });
    }

    res.status(200).json({
      success: true,
      analytics: {
        dailyMessages,
        dailyTokens,
        dailyRegistrations,
        totalLogs: logsSnap.size,
        totalTokens: Object.values(tokensByDay).reduce((a, b) => a + b, 0),
      },
    });
  } catch (error) {
    logger.error('Admin getAnalytics error:', error);
    next(error);
  }
};

/**
 * DELETE /api/admin/users/:uid
 * Delete a user and all their data
 */
const deleteUser = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const db = getDb();

    // Delete user's chats
    const chatsSnap = await db.collection('chats').where('uid', '==', uid).get();
    const batch = db.batch();

    // Delete messages for each chat
    for (const chatDoc of chatsSnap.docs) {
      const messagesSnap = await db
        .collection('messages')
        .where('chatId', '==', chatDoc.id)
        .get();
      messagesSnap.docs.forEach((msg) => batch.delete(msg.ref));
      batch.delete(chatDoc.ref);
    }

    // Delete user document
    batch.delete(db.collection('users').doc(uid));
    await batch.commit();

    logger.info(`Admin deleted user: ${uid}`);

    res.status(200).json({ success: true, message: 'User and all data deleted successfully' });
  } catch (error) {
    logger.error('Admin deleteUser error:', error);
    next(error);
  }
};

module.exports = { getStats, getUsers, getChats, getLogs, getAnalytics, deleteUser };
