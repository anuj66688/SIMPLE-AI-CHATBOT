/**
 * firebase.js
 * Firebase SDK initialization using compat (v8-style) API for simplicity
 * Exposes global `firebase` object used by auth.js, chat.js, dashboard.js
 */

// Firebase App (CDN loaded via script tags below — this file configures it)
// The actual SDKs are loaded from CDN in each HTML file

const firebaseConfig = {
  apiKey: "AIzaSyAlmBLXH5bSozajpqQnWkyg1uEVTeaFKzM",
  authDomain: "simple-ai-chatbot-de606.firebaseapp.com",
  projectId: "simple-ai-chatbot-de606",
  storageBucket: "simple-ai-chatbot-de606.firebasestorage.app",
  messagingSenderId: "25256077845",
  appId: "1:25256077845:web:2192f39fe7c93a84e27c1c"
};

// Load Firebase SDKs dynamically if not already loaded
(function loadFirebaseSDKs() {
  const sdks = [
    "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"
  ];

  let loaded = 0;

  function initApp() {
    loaded++;
    if (loaded === sdks.length) {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log("✅ Firebase initialized:", firebase.app().name);
      }
      // Dispatch event so other scripts know Firebase is ready
      document.dispatchEvent(new Event("firebase-ready"));
    }
  }

  // Check if already loaded
  if (typeof firebase !== "undefined" && firebase.apps) {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    document.dispatchEvent(new Event("firebase-ready"));
    return;
  }

  sdks.forEach(src => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = initApp;
    script.onerror = () => console.error("Failed to load Firebase SDK:", src);
    document.head.appendChild(script);
  });
})();

/**
 * FirebaseService — thin helper wrappers
 */
const FirebaseService = {
  /**
   * Get the current Firebase Auth instance
   */
  auth() {
    return firebase.auth();
  },

  /**
   * Get Firestore instance
   */
  db() {
    return firebase.firestore();
  },

  /**
   * Get Google Auth Provider
   */
  googleProvider() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    return provider;
  },

  /**
   * Get the current user's ID token (for backend requests)
   */
  async getIdToken() {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("No authenticated user");
    return await user.getIdToken(true);
  },

  /**
   * Get current user
   */
  currentUser() {
    return firebase.auth().currentUser;
  }
};

// Make available globally
window.FirebaseService = FirebaseService;
