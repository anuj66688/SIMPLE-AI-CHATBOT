const admin = require('firebase-admin');

let db;

const initializeFirebase = () => {
  if (admin.apps.length > 0) {
    db = admin.firestore();
    return db;
  }

  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: privateKey,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    db = admin.firestore();
    console.log('✅ Firebase Admin initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    throw error;
  }
};

const getDb = () => {
  if (!db) {
    return initializeFirebase();
  }
  return db;
};

const getAdmin = () => admin;

module.exports = { initializeFirebase, getDb, getAdmin };
