/**
 * chat.js
 * Full chat application logic:
 * - Load/display chat history in sidebar
 * - Send messages to backend
 * - Render AI responses with Markdown + code highlighting
 * - New chat, delete chat, rename chat
 * - Auto-scroll, typing indicator, suggestion chips
 */

const ChatApp = {
  currentUser: null,
  currentChatId: null,
  isLoading: false,
  chatHistory: [],

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────

  async init(user) {
    this.currentUser = user;
    this.setupUserProfile(user);
    this.bindEvents();
    await this.loadChatHistory();
    this.focusInput();
  },

  setupUserProfile(user) {
    const name = user.displayName || user.email.split("@")[0];
    const email = user.email;
    const initial = name.charAt(0).toUpperCase();

    const avatarEl = document.getElementById("userAvatar");
    const nameEl = document.getElementById("userName");
    const emailEl = document.getElementById("userEmail");
    const adminAvatarEl = document.getElementById("adminAvatar");

    if (avatarEl) {
      if (user.photoURL) {
        avatarEl.innerHTML = `<img src="${user.photoURL}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
      } else {
        avatarEl.textContent = initial;
      }
    }
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (adminAvatarEl) adminAvatarEl.textContent = initial;

    // Check admin role
    firebase.firestore()
      .collection("users")
      .doc(user.uid)
      .get()
      .then(doc => {
        if (doc.exists && doc.data().role === "admin") {
          const adminLink = document.getElementById("adminLink");
          if (adminLink) adminLink.style.display = "flex";
        }
      })
      .catch(() => {});
  },

  // ─────────────────────────────────────────────
  // EVENT BINDING
  // ─────────────────────────────────────────────

  bindEvents() {
    // New chat
    document.getElementById("newChatBtn")?.addEventListener("click", () => this.startNewChat());

    // Send button
    document.getElementById("sendBtn")?.addEventListener("click", () => this.sendMessage());

    // Input field
    const input = document.getElementById("messageInput");
    if (input) {
      input.addEventListener("input", () => this.handleInputChange(input));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    // Logout
    document.getElementById("logoutBtn")?.addEventListener("click", () => this.logout());

    // User menu toggle
    document.getElementById("userMenuBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("userDropdown")?.classList.toggle("show");
    });

    document.addEventListener("click", () => {
      document.getElementById("userDropdown")?.classList.remove("show");
    });

    // Mobile sidebar
    document.getElementById("mobileMenuBtn")?.addEventListener("click", () => this.openSidebar());
    document.getElementById("sidebarClose")?.addEventListener("click", () => this.closeSidebar());
    document.getElementById("sidebarOverlay")?.addEventListener("click", () => this.closeSidebar());

    // Rename chat
    document.getElementById("renameChatBtn")?.addEventListener("click", () => this.openRenameModal());
    document.getElementById("confirmRenameBtn")?.addEventListener("click", () => this.confirmRename());
    document.getElementById("cancelRenameBtn")?.addEventListener("click", () => this.closeRenameModal());
    document.getElementById("closeRenameModal")?.addEventListener("click", () => this.closeRenameModal());
    document.getElementById("renameChatInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.confirmRename();
      if (e.key === "Escape") this.closeRenameModal();
    });

    // Delete chat
    document.getElementById("deleteChatBtn")?.addEventListener("click", () => this.openDeleteModal());
    document.getElementById("confirmDeleteBtn")?.addEventListener("click", () => this.confirmDelete());
    document.getElementById("cancelDeleteBtn")?.addEventListener("click", () => this.closeDeleteModal());
    document.getElementById("closeDeleteModal")?.addEventListener("click", () => this.closeDeleteModal());

    // Suggestion chips
    document.querySelectorAll(".suggestion-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const prompt = chip.dataset.prompt;
        if (prompt) {
          document.getElementById("messageInput").value = prompt;
          this.handleInputChange(document.getElementById("messageInput"));
          this.sendMessage();
        }
      });
    });
  },

  handleInputChange(input) {
    // Auto-resize textarea
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 200) + "px";

    // Update char count
    const count = input.value.length;
    const charCountEl = document.getElementById("charCount");
    if (charCountEl) charCountEl.textContent = `${count}/4000`;

    // Enable/disable send button
    const sendBtn = document.getElementById("sendBtn");
    if (sendBtn) sendBtn.disabled = count === 0 || count > 4000;
  },

  focusInput() {
    setTimeout(() => document.getElementById("messageInput")?.focus(), 100);
  },

  // ─────────────────────────────────────────────
  // CHAT HISTORY SIDEBAR
  // ─────────────────────────────────────────────

  async loadChatHistory() {
    const listEl = document.getElementById("chatHistoryList");
    if (!listEl) return;

    try {
      const data = await ApiClient.getChatHistory();
      this.chatHistory = data.chats || [];
      this.renderChatHistory();
    } catch (err) {
      console.error("Failed to load chat history:", err);
      listEl.innerHTML = `<p class="sidebar-empty">Failed to load chats.</p>`;
    }
  },

  renderChatHistory() {
    const listEl = document.getElementById("chatHistoryList");
    if (!listEl) return;

    if (this.chatHistory.length === 0) {
      listEl.innerHTML = `<p class="sidebar-empty">No chats yet. Start a new conversation!</p>`;
      return;
    }

    listEl.innerHTML = this.chatHistory
      .map(chat => `
        <div class="chat-history-item ${chat.chatId === this.currentChatId ? "active" : ""}"
             data-chat-id="${chat.chatId}"
             id="chatItem_${chat.chatId}"
             role="button"
             tabindex="0"
             title="${this.escapeHtml(chat.title)}">
          <div class="chat-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <span class="chat-item-title">${this.escapeHtml(chat.title)}</span>
          <div class="chat-item-actions">
            <button class="chat-item-action" onclick="ChatApp.promptRenameFromList('${chat.chatId}', '${this.escapeHtml(chat.title)}')" title="Rename">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="chat-item-action danger" onclick="ChatApp.promptDeleteFromList('${chat.chatId}')" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `)
      .join("");

    // Bind click events
    listEl.querySelectorAll(".chat-history-item").forEach(item => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".chat-item-actions")) return;
        this.loadChat(item.dataset.chatId);
      });
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.loadChat(item.dataset.chatId);
      });
    });
  },

  // ─────────────────────────────────────────────
  // LOAD CHAT
  // ─────────────────────────────────────────────

  async loadChat(chatId) {
    if (this.currentChatId === chatId) {
      this.closeSidebar();
      return;
    }

    this.currentChatId = chatId;
    this.updateActiveHistoryItem(chatId);

    // Show loading in messages
    const msgList = document.getElementById("messagesList");
    const welcomeScreen = document.getElementById("welcomeScreen");
    if (welcomeScreen) welcomeScreen.style.display = "none";
    if (msgList) msgList.innerHTML = `<div class="messages-loading"><div class="spinner"></div><span>Loading conversation…</span></div>`;

    // Show topbar actions
    document.getElementById("renameChatBtn").style.display = "flex";
    document.getElementById("deleteChatBtn").style.display = "flex";

    this.closeSidebar();

    try {
      const data = await ApiClient.getChat(chatId);
      const chat = data.chat;
      const messages = data.messages;

      document.getElementById("currentChatTitle").textContent = chat.title;

      if (msgList) {
        msgList.innerHTML = "";
        messages.forEach(msg => this.appendMessage(msg.sender, msg.content, false));
      }
      this.scrollToBottom();
    } catch (err) {
      if (msgList) msgList.innerHTML = `<div class="error-msg">Failed to load chat. Please try again.</div>`;
      console.error("Load chat error:", err);
    }
  },

  updateActiveHistoryItem(chatId) {
    document.querySelectorAll(".chat-history-item").forEach(el => {
      el.classList.toggle("active", el.dataset.chatId === chatId);
    });
  },

  // ─────────────────────────────────────────────
  // NEW CHAT
  // ─────────────────────────────────────────────

  startNewChat() {
    this.currentChatId = null;

    // Reset UI
    const msgList = document.getElementById("messagesList");
    if (msgList) msgList.innerHTML = "";

    const welcomeScreen = document.getElementById("welcomeScreen");
    if (welcomeScreen) welcomeScreen.style.display = "flex";

    document.getElementById("currentChatTitle").textContent = "AI Assistant";
    document.getElementById("renameChatBtn").style.display = "none";
    document.getElementById("deleteChatBtn").style.display = "none";

    this.updateActiveHistoryItem(null);
    this.closeSidebar();
    this.focusInput();
  },

  // ─────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────

  async sendMessage() {
    if (this.isLoading) return;

    const input = document.getElementById("messageInput");
    const message = input?.value.trim();
    if (!message) return;

    // Hide welcome screen
    const welcomeScreen = document.getElementById("welcomeScreen");
    if (welcomeScreen) welcomeScreen.style.display = "none";

    // Show topbar actions
    document.getElementById("renameChatBtn").style.display = "flex";
    document.getElementById("deleteChatBtn").style.display = "flex";

    // Clear input
    input.value = "";
    input.style.height = "auto";
    this.handleInputChange(input);

    // Append user message
    this.appendMessage("user", message);

    // Show typing indicator
    const typingId = this.showTypingIndicator();

    this.isLoading = true;
    document.getElementById("sendBtn").disabled = true;

    try {
      const data = await ApiClient.sendMessage(this.currentChatId, message);

      // Remove typing indicator
      this.removeTypingIndicator(typingId);

      // Update chatId if this was a new chat
      const isNewChat = data.isNewChat;
      this.currentChatId = data.chatId;

      // Append bot response
      this.appendMessage("bot", data.botMessage.content);
      this.scrollToBottom();

      // If new chat, refresh history
      if (isNewChat) {
        await this.loadChatHistory();
        this.updateActiveHistoryItem(data.chatId);
        // Update title
        const chats = this.chatHistory;
        const newChat = chats.find(c => c.chatId === data.chatId);
        if (newChat) {
          document.getElementById("currentChatTitle").textContent = newChat.title;
        }
      }
    } catch (err) {
      this.removeTypingIndicator(typingId);
      const errMsg = err.message || "Failed to get response. Please try again.";
      this.appendMessage("bot", `⚠️ ${errMsg}`, false, true);
      this.showToast(errMsg, "error");
      console.error("Send message error:", err);
    } finally {
      this.isLoading = false;
      document.getElementById("sendBtn").disabled = false;
      this.focusInput();
    }
  },

  // ─────────────────────────────────────────────
  // MESSAGE RENDERING
  // ─────────────────────────────────────────────

  appendMessage(sender, content, animate = true, isError = false) {
    const msgList = document.getElementById("messagesList");
    if (!msgList) return;

    const isBot = sender === "bot";
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const div = document.createElement("div");
    div.className = `message ${isBot ? "message-bot" : "message-user"} ${animate ? "message-animate" : ""} ${isError ? "message-error" : ""}`;
    div.id = msgId;

    if (isBot) {
      div.innerHTML = `
        <div class="message-avatar">
          <svg viewBox="0 0 32 32" fill="none" width="20" height="20">
            <circle cx="16" cy="16" r="14" fill="url(#msgGrad_${msgId})"/>
            <path d="M10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="16" cy="19" r="3" fill="white"/>
            <defs>
              <linearGradient id="msgGrad_${msgId}" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="message-content">
          <div class="message-bubble bot-bubble">
            ${this.renderMarkdown(content)}
          </div>
          <div class="message-meta">
            <span>AI Assistant</span>
            <span>${this.formatTime(new Date())}</span>
            <button class="copy-btn" onclick="ChatApp.copyMessage('${msgId}')" title="Copy response">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>
          </div>
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="message-content">
          <div class="message-bubble user-bubble">${this.escapeHtml(content)}</div>
          <div class="message-meta user-meta">
            <span>${this.formatTime(new Date())}</span>
          </div>
        </div>
        <div class="message-avatar user-avatar-small">
          ${this.currentUser?.photoURL
            ? `<img src="${this.currentUser.photoURL}" alt="You" />`
            : (this.currentUser?.displayName?.[0] || "U")}
        </div>
      `;
    }

    msgList.appendChild(div);

    // Syntax highlight code blocks
    div.querySelectorAll("pre code").forEach(block => {
      if (typeof hljs !== "undefined") hljs.highlightElement(block);
    });

    this.scrollToBottom();
  },

  renderMarkdown(text) {
    if (typeof marked === "undefined") return this.escapeHtml(text);
    try {
      marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: (code, lang) => {
          if (typeof hljs !== "undefined" && lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
          }
          return code;
        }
      });
      return marked.parse(text);
    } catch {
      return this.escapeHtml(text);
    }
  },

  showTypingIndicator() {
    const msgList = document.getElementById("messagesList");
    if (!msgList) return null;

    const id = `typing_${Date.now()}`;
    const div = document.createElement("div");
    div.className = "message message-bot message-animate";
    div.id = id;
    div.innerHTML = `
      <div class="message-avatar">
        <svg viewBox="0 0 32 32" fill="none" width="20" height="20">
          <circle cx="16" cy="16" r="14" fill="url(#typingGrad)"/>
          <path d="M10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="16" cy="19" r="3" fill="white"/>
          <defs>
            <linearGradient id="typingGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-bubble bot-bubble typing-bubble">
          <div class="typing-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    `;
    msgList.appendChild(div);
    this.scrollToBottom();
    return id;
  },

  removeTypingIndicator(id) {
    if (id) document.getElementById(id)?.remove();
  },

  copyMessage(msgId) {
    const bubble = document.querySelector(`#${msgId} .bot-bubble`);
    if (!bubble) return;
    const text = bubble.innerText;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast("Copied to clipboard!", "success");
    });
  },

  // ─────────────────────────────────────────────
  // RENAME CHAT
  // ─────────────────────────────────────────────

  openRenameModal() {
    const modal = document.getElementById("renameModal");
    const input = document.getElementById("renameChatInput");
    if (!modal) return;
    const currentTitle = document.getElementById("currentChatTitle").textContent;
    if (input) { input.value = currentTitle; input.select(); }
    modal.classList.add("show");
    setTimeout(() => input?.focus(), 100);
  },

  closeRenameModal() {
    document.getElementById("renameModal")?.classList.remove("show");
  },

  promptRenameFromList(chatId, currentTitle) {
    this.currentChatId = chatId;
    const input = document.getElementById("renameChatInput");
    if (input) input.value = currentTitle;
    document.getElementById("renameModal")?.classList.add("show");
    setTimeout(() => input?.focus(), 100);
  },

  async confirmRename() {
    const input = document.getElementById("renameChatInput");
    const newTitle = input?.value.trim();
    if (!newTitle || !this.currentChatId) return;

    const confirmBtn = document.getElementById("confirmRenameBtn");
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = "Renaming..."; }

    try {
      await ApiClient.renameChat(this.currentChatId, newTitle);
      document.getElementById("currentChatTitle").textContent = newTitle;

      // Update in local history
      const chat = this.chatHistory.find(c => c.chatId === this.currentChatId);
      if (chat) chat.title = newTitle;
      this.renderChatHistory();

      this.closeRenameModal();
      this.showToast("Chat renamed successfully!", "success");
    } catch (err) {
      this.showToast("Failed to rename chat.", "error");
    } finally {
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = "Rename"; }
    }
  },

  // ─────────────────────────────────────────────
  // DELETE CHAT
  // ─────────────────────────────────────────────

  openDeleteModal() {
    document.getElementById("deleteModal")?.classList.add("show");
  },

  closeDeleteModal() {
    document.getElementById("deleteModal")?.classList.remove("show");
  },

  promptDeleteFromList(chatId) {
    this.currentChatId = chatId;
    this.openDeleteModal();
  },

  async confirmDelete() {
    if (!this.currentChatId) return;
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = "Deleting..."; }

    try {
      await ApiClient.deleteChat(this.currentChatId);

      // Remove from local history
      this.chatHistory = this.chatHistory.filter(c => c.chatId !== this.currentChatId);
      this.renderChatHistory();

      this.closeDeleteModal();
      this.startNewChat();
      this.showToast("Chat deleted.", "success");
    } catch (err) {
      this.showToast("Failed to delete chat.", "error");
    } finally {
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = "Delete"; }
    }
  },

  // ─────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────

  async logout() {
    try {
      await ApiClient.logoutUser().catch(() => {});
      await firebase.auth().signOut();
      window.location.href = "login.html";
    } catch (err) {
      console.error("Logout error:", err);
      window.location.href = "login.html";
    }
  },

  // ─────────────────────────────────────────────
  // SIDEBAR (MOBILE)
  // ─────────────────────────────────────────────

  openSidebar() {
    document.getElementById("sidebar")?.classList.add("open");
    document.getElementById("sidebarOverlay")?.classList.add("show");
    document.body.style.overflow = "hidden";
  },

  closeSidebar() {
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("sidebarOverlay")?.classList.remove("show");
    document.body.style.overflow = "";
  },

  // ─────────────────────────────────────────────
  // TOAST NOTIFICATIONS
  // ─────────────────────────────────────────────

  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icons = {
      success: "✓",
      error: "✕",
      info: "ℹ",
      warning: "⚠",
    };
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

  scrollToBottom() {
    const container = document.getElementById("messagesContainer");
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  },

  formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  },

  escapeHtml(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  },
};

window.ChatApp = ChatApp;
