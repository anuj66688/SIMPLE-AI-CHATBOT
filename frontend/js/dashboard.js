/**
 * dashboard.js
 * Admin Dashboard logic:
 * - Section navigation
 * - Load stats, users, chats, logs
 * - Chart.js analytics charts
 * - Search/filter tables
 */

const AdminDashboard = {
  currentUser: null,
  charts: {},
  allUsers: [],
  allChats: [],
  allLogs: [],

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────

  async init(user) {
    this.currentUser = user;

    // Check admin role
    const db = firebase.firestore();
    const userDoc = await db.collection("users").doc(user.uid).get().catch(() => null);
    if (!userDoc || !userDoc.exists || userDoc.data().role !== "admin") {
      this.showToast("Access denied. Admin privileges required.", "error");
      setTimeout(() => window.location.href = "chat.html", 2000);
      return;
    }

    this.setupAdminProfile(user);
    this.bindEvents();
    this.showSection("dashboard");
    await this.loadDashboard();
  },

  setupAdminProfile(user) {
    const name = user.displayName || user.email.split("@")[0];
    const nameEl = document.getElementById("adminUserName");
    const avatarEl = document.getElementById("adminAvatar");
    if (nameEl) nameEl.textContent = name;
    if (avatarEl) {
      if (user.photoURL) {
        avatarEl.innerHTML = `<img src="${user.photoURL}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
      } else {
        avatarEl.textContent = name.charAt(0).toUpperCase();
      }
    }
  },

  // ─────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────

  bindEvents() {
    // Sidebar navigation
    document.querySelectorAll(".admin-nav-item[data-section]").forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        this.showSection(section);
      });
    });

    // Logout
    document.getElementById("adminLogoutBtn")?.addEventListener("click", async () => {
      await firebase.auth().signOut();
      window.location.href = "login.html";
    });

    // Refresh
    document.getElementById("refreshBtn")?.addEventListener("click", () => this.refreshCurrentSection());

    // Mobile sidebar
    document.getElementById("adminMobileToggle")?.addEventListener("click", () => {
      document.getElementById("adminSidebar")?.classList.toggle("open");
    });

    // Search inputs
    document.getElementById("userSearch")?.addEventListener("input", (e) => this.filterUsers(e.target.value));
    document.getElementById("chatSearch")?.addEventListener("input", (e) => this.filterChats(e.target.value));
    document.getElementById("logSearch")?.addEventListener("input", (e) => this.filterLogs(e.target.value));

    // Analytics range
    document.getElementById("analyticsRange")?.addEventListener("change", (e) => {
      this.loadAnalytics(parseInt(e.target.value));
    });
  },

  showSection(sectionName) {
    // Update nav items
    document.querySelectorAll(".admin-nav-item").forEach(item => {
      item.classList.toggle("active", item.dataset.section === sectionName);
    });

    // Show/hide sections
    document.querySelectorAll(".admin-section").forEach(section => {
      section.classList.remove("active");
    });
    const target = document.getElementById(`section${this.capitalize(sectionName)}`);
    if (target) target.classList.add("active");

    // Update page title
    const titles = {
      dashboard: "Dashboard",
      users: "Users",
      chats: "Chats",
      logs: "Logs",
      analytics: "Analytics",
    };
    const titleEl = document.getElementById("adminPageTitle");
    if (titleEl) titleEl.textContent = titles[sectionName] || sectionName;

    // Load section data
    this.loadSectionData(sectionName);

    // Close mobile sidebar
    document.getElementById("adminSidebar")?.classList.remove("open");
  },

  async loadSectionData(section) {
    switch (section) {
      case "dashboard": await this.loadDashboard(); break;
      case "users": await this.loadUsers(); break;
      case "chats": await this.loadChats(); break;
      case "logs": await this.loadLogs(); break;
      case "analytics": await this.loadAnalytics(); break;
    }
  },

  refreshCurrentSection() {
    const activeNav = document.querySelector(".admin-nav-item.active[data-section]");
    if (activeNav) this.loadSectionData(activeNav.dataset.section);
  },

  // ─────────────────────────────────────────────
  // DASHBOARD STATS
  // ─────────────────────────────────────────────

  async loadDashboard() {
    try {
      const data = await ApiClient.getAdminStats();
      const stats = data.stats;

      this.setVal("totalUsersVal", this.formatNum(stats.totalUsers));
      this.setVal("totalChatsVal", this.formatNum(stats.totalChats));
      this.setVal("totalMessagesVal", this.formatNum(stats.totalMessages));
      this.setVal("activeUsersVal", this.formatNum(stats.activeUsers));
      this.setVal("msgsTodayVal", this.formatNum(stats.messagesToday));
      this.setVal("totalTokensVal", this.formatNum(stats.totalTokensThisMonth));

      // Update badges
      this.setVal("usersBadge", stats.totalUsers);
      this.setVal("chatsBadge", stats.totalChats);

      // Load mini charts
      await this.loadMiniCharts();
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
      this.showToast("Failed to load stats. Is the backend running?", "error");
    }
  },

  async loadMiniCharts() {
    try {
      const data = await ApiClient.getAnalytics(7);
      const analytics = data.analytics;

      const last7 = analytics.dailyMessages.slice(-7);
      const last7Reg = analytics.dailyRegistrations.slice(-7);

      this.createChart("weeklyChart", "bar", {
        labels: last7.map(d => this.formatChartDate(d.date)),
        datasets: [{
          label: "Messages",
          data: last7.map(d => d.count),
          backgroundColor: "rgba(99, 102, 241, 0.7)",
          borderColor: "#6366f1",
          borderWidth: 2,
          borderRadius: 6,
        }]
      });

      this.createChart("registrationsChart", "bar", {
        labels: last7Reg.map(d => this.formatChartDate(d.date)),
        datasets: [{
          label: "Registrations",
          data: last7Reg.map(d => d.count),
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "#10b981",
          borderWidth: 2,
          borderRadius: 6,
        }]
      });
    } catch (err) {
      console.warn("Mini charts failed:", err);
    }
  },

  // ─────────────────────────────────────────────
  // USERS TABLE
  // ─────────────────────────────────────────────

  async loadUsers() {
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="table-loading"><div class="spinner"></div> Loading users...</td></tr>`;

    try {
      const data = await ApiClient.getAdminUsers(100);
      this.allUsers = data.users;
      this.renderUsersTable(this.allUsers);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-error">Failed to load users.</td></tr>`;
    }
  },

  renderUsersTable(users) {
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(user => `
      <tr>
        <td>
          <div class="table-user-cell">
            <div class="table-avatar">${(user.name || user.email || "?")[0].toUpperCase()}</div>
            <span>${this.escapeHtml(user.name || "—")}</span>
          </div>
        </td>
        <td><span class="table-email">${this.escapeHtml(user.email || "—")}</span></td>
        <td><span class="role-badge role-${user.role || 'user'}">${user.role || "user"}</span></td>
        <td>${this.formatDate(user.createdAt)}</td>
        <td>${this.formatDate(user.lastLoginAt)}</td>
        <td>${user.totalChats || 0}</td>
        <td>
          <div class="table-actions">
            <button class="table-action-btn danger" onclick="AdminDashboard.deleteUserConfirm('${user.uid}', '${this.escapeHtml(user.name || user.email)}')" title="Delete user">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  },

  filterUsers(query) {
    const q = query.toLowerCase();
    const filtered = this.allUsers.filter(u =>
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
    this.renderUsersTable(filtered);
  },

  async deleteUserConfirm(uid, name) {
    if (!confirm(`Delete user "${name}"? This will remove all their data and cannot be undone.`)) return;
    try {
      await ApiClient.deleteUser(uid);
      this.allUsers = this.allUsers.filter(u => u.uid !== uid);
      this.renderUsersTable(this.allUsers);
      this.showToast("User deleted successfully.", "success");
    } catch (err) {
      this.showToast("Failed to delete user.", "error");
    }
  },

  // ─────────────────────────────────────────────
  // CHATS TABLE
  // ─────────────────────────────────────────────

  async loadChats() {
    const tbody = document.getElementById("chatsTableBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="table-loading"><div class="spinner"></div> Loading chats...</td></tr>`;

    try {
      const data = await ApiClient.getAdminChats(100);
      this.allChats = data.chats;
      this.renderChatsTable(this.allChats);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-error">Failed to load chats.</td></tr>`;
    }
  },

  renderChatsTable(chats) {
    const tbody = document.getElementById("chatsTableBody");
    if (!tbody) return;

    if (chats.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No chats found.</td></tr>`;
      return;
    }

    tbody.innerHTML = chats.map(chat => `
      <tr>
        <td><span class="chat-title-cell">${this.escapeHtml(chat.title || "Untitled")}</span></td>
        <td><code class="uid-cell">${(chat.uid || "").substring(0, 12)}…</code></td>
        <td>${chat.messageCount || 0}</td>
        <td>${this.formatDate(chat.createdAt)}</td>
        <td>${this.formatDate(chat.updatedAt)}</td>
      </tr>
    `).join("");
  },

  filterChats(query) {
    const q = query.toLowerCase();
    const filtered = this.allChats.filter(c =>
      (c.title || "").toLowerCase().includes(q) ||
      (c.uid || "").toLowerCase().includes(q)
    );
    this.renderChatsTable(filtered);
  },

  // ─────────────────────────────────────────────
  // LOGS TABLE
  // ─────────────────────────────────────────────

  async loadLogs() {
    const tbody = document.getElementById("logsTableBody");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="table-loading"><div class="spinner"></div> Loading logs...</td></tr>`;

    try {
      const data = await ApiClient.getAdminLogs(200);
      this.allLogs = data.logs;
      this.renderLogsTable(this.allLogs);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-error">Failed to load logs.</td></tr>`;
    }
  },

  renderLogsTable(logs) {
    const tbody = document.getElementById("logsTableBody");
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No logs found.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(log => `
      <tr>
        <td>${this.formatDate(log.timestamp)}</td>
        <td><code class="uid-cell">${(log.userId || "").substring(0, 10)}…</code></td>
        <td class="log-question-cell" title="${this.escapeHtml(log.question || "")}">
          ${this.escapeHtml((log.question || "").substring(0, 80))}${(log.question || "").length > 80 ? "…" : ""}
        </td>
        <td><span class="token-badge">${log.tokensUsed || 0}</span></td>
        <td><code class="uid-cell">${(log.sessionId || "").substring(0, 8)}…</code></td>
      </tr>
    `).join("");
  },

  filterLogs(query) {
    const q = query.toLowerCase();
    const filtered = this.allLogs.filter(l =>
      (l.question || "").toLowerCase().includes(q) ||
      (l.userId || "").toLowerCase().includes(q)
    );
    this.renderLogsTable(filtered);
  },

  // ─────────────────────────────────────────────
  // ANALYTICS CHARTS
  // ─────────────────────────────────────────────

  async loadAnalytics(days = 30) {
    try {
      const data = await ApiClient.getAnalytics(days);
      const analytics = data.analytics;

      // Daily messages chart
      this.createChart("dailyMessagesChart", "line", {
        labels: analytics.dailyMessages.map(d => this.formatChartDate(d.date)),
        datasets: [{
          label: "Messages",
          data: analytics.dailyMessages.map(d => d.count),
          borderColor: "#6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          tension: 0.4,
          fill: true,
          pointBackgroundColor: "#6366f1",
          pointRadius: 3,
        }]
      });

      // Token usage chart
      this.createChart("tokenUsageChart", "line", {
        labels: analytics.dailyTokens.map(d => this.formatChartDate(d.date)),
        datasets: [{
          label: "Tokens Used",
          data: analytics.dailyTokens.map(d => d.tokens),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
          fill: true,
          pointBackgroundColor: "#10b981",
          pointRadius: 3,
        }]
      });

      // User growth
      this.createChart("userGrowthChart", "bar", {
        labels: analytics.dailyRegistrations.map(d => this.formatChartDate(d.date)),
        datasets: [{
          label: "New Users",
          data: analytics.dailyRegistrations.map(d => d.count),
          backgroundColor: "rgba(139, 92, 246, 0.7)",
          borderColor: "#8b5cf6",
          borderWidth: 2,
          borderRadius: 4,
        }]
      });

      // Message distribution (doughnut)
      const msgCounts = analytics.dailyMessages.map(d => d.count);
      const total = msgCounts.reduce((a, b) => a + b, 0);
      const today = msgCounts[msgCounts.length - 1] || 0;
      const week = msgCounts.slice(-7).reduce((a, b) => a + b, 0);
      const older = total - week;

      this.createChart("messageDistChart", "doughnut", {
        labels: ["Today", "Last 7 Days", "Older"],
        datasets: [{
          data: [today, week - today, Math.max(0, older)],
          backgroundColor: ["#6366f1", "#8b5cf6", "#06b6d4"],
          borderWidth: 0,
          hoverOffset: 8,
        }]
      }, { plugins: { legend: { position: "bottom" } } });

    } catch (err) {
      console.error("Analytics load failed:", err);
      this.showToast("Failed to load analytics.", "error");
    }
  },

  createChart(canvasId, type, data, extraOptions = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Destroy existing chart
    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: type === "doughnut",
          labels: { color: "#94a3b8", font: { family: "Inter", size: 12 } }
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          titleColor: "#f1f5f9",
          bodyColor: "#94a3b8",
          borderColor: "rgba(148, 163, 184, 0.1)",
          borderWidth: 1,
          padding: 12,
        }
      },
      scales: type !== "doughnut" ? {
        x: {
          ticks: { color: "#64748b", font: { family: "Inter", size: 11 } },
          grid: { color: "rgba(148, 163, 184, 0.05)" }
        },
        y: {
          ticks: { color: "#64748b", font: { family: "Inter", size: 11 } },
          grid: { color: "rgba(148, 163, 184, 0.08)" },
          beginAtZero: true,
        }
      } : {},
    };

    const options = this.deepMerge(defaultOptions, extraOptions);
    this.charts[canvasId] = new Chart(canvas, { type, data, options });
  },

  // ─────────────────────────────────────────────
  // TOAST NOTIFICATIONS
  // ─────────────────────────────────────────────

  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icons = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ"}</span><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  formatNum(n) {
    if (n === undefined || n === null) return "0";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  },

  formatDate(dateStr) {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch { return dateStr; }
  },

  formatChartDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length < 3) return dateStr;
    return `${parts[2]}/${parts[1]}`;
  },

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  escapeHtml(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(String(text)));
    return div.innerHTML;
  },

  deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  },
};

window.AdminDashboard = AdminDashboard;
