/**
 * api.js
 * Centralised API client for all backend communication.
 * Uses the Firebase ID token as a Bearer token.
 */

const API_BASE_URL = "http://localhost:5000/api";

const ApiClient = {
  /**
   * Make an authenticated HTTP request to the backend
   */
  async request(endpoint, options = {}) {
    try {
      // Get fresh Firebase ID token
      const token = await FirebaseService.getIdToken();

      const sessionId = sessionStorage.getItem("sessionId") || (() => {
        const id = crypto.randomUUID();
        sessionStorage.setItem("sessionId", id);
        return id;
      })();

      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Session-ID": sessionId,
          ...options.headers,
        },
        ...options,
      };

      if (config.body && typeof config.body === "object") {
        config.body = JSON.stringify(config.body);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error [${options.method || "GET"} ${endpoint}]:`, error);
      throw error;
    }
  },

  // ========================
  // AUTH ENDPOINTS
  // ========================

  /** Register / sync user to Firestore after Firebase auth */
  async registerUser(userData) {
    return this.request("/auth/register", {
      method: "POST",
      body: userData,
    });
  },

  /** Login with Firebase ID token */
  async loginUser(idToken) {
    return this.request("/auth/login", {
      method: "POST",
      body: { idToken },
    });
  },

  /** Logout */
  async logoutUser() {
    return this.request("/auth/logout", { method: "POST" });
  },

  // ========================
  // CHAT ENDPOINTS
  // ========================

  /** Send a chat message and receive an AI response */
  async sendMessage(chatId, message) {
    return this.request("/chat", {
      method: "POST",
      body: { chatId, message },
    });
  },

  /** Create a new empty chat session */
  async createNewChat() {
    return this.request("/chat/new", { method: "POST" });
  },

  /** Get all chats for the current user */
  async getChatHistory() {
    return this.request("/chat/history");
  },

  /** Get messages for a specific chat */
  async getChat(chatId) {
    return this.request(`/chat/${chatId}`);
  },

  /** Delete a chat */
  async deleteChat(chatId) {
    return this.request(`/chat/${chatId}`, { method: "DELETE" });
  },

  /** Rename a chat */
  async renameChat(chatId, title) {
    return this.request(`/chat/rename/${chatId}`, {
      method: "PUT",
      body: { title },
    });
  },

  // ========================
  // ADMIN ENDPOINTS
  // ========================

  /** Get admin dashboard stats */
  async getAdminStats() {
    return this.request("/admin/stats");
  },

  /** Get all users */
  async getAdminUsers(limit = 100) {
    return this.request(`/admin/users?limit=${limit}`);
  },

  /** Get all chats (admin) */
  async getAdminChats(limit = 100) {
    return this.request(`/admin/chats?limit=${limit}`);
  },

  /** Get interaction logs */
  async getAdminLogs(limit = 200) {
    return this.request(`/admin/logs?limit=${limit}`);
  },

  /** Get analytics data */
  async getAnalytics(days = 30) {
    return this.request(`/admin/analytics?days=${days}`);
  },

  /** Delete a user (admin) */
  async deleteUser(uid) {
    return this.request(`/admin/users/${uid}`, { method: "DELETE" });
  },
};

window.ApiClient = ApiClient;
