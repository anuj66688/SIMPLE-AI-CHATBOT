/**
 * auth.js
 * Handles all authentication logic:
 * - Email/Password Login & Register
 * - Google Sign-In
 * - Form validation
 * - Password strength
 * - Forgot password
 */

const AuthManager = {
  // ─────────────────────────────────────────────
  // SHARED UTILITIES
  // ─────────────────────────────────────────────

  showAlert(message, type = "error") {
    const alert = document.getElementById("authAlert");
    if (!alert) return;
    alert.textContent = message;
    alert.className = `auth-alert show ${type}`;
    setTimeout(() => alert.classList.remove("show"), 6000);
  },

  setLoading(btnId, spinnerId, textId, loading, text = "Sign In") {
    const btn = document.getElementById(btnId);
    const spinner = document.getElementById(spinnerId);
    const btnText = document.getElementById(textId);
    if (!btn) return;
    btn.disabled = loading;
    if (spinner) spinner.classList.toggle("active", loading);
    if (btnText) btnText.style.opacity = loading ? "0" : "1";
  },

  setFieldError(fieldId, errorId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(errorId);
    if (field) field.classList.toggle("error", !!message);
    if (errorEl) errorEl.textContent = message || "";
  },

  clearErrors() {
    document.querySelectorAll(".field-error").forEach(el => el.textContent = "");
    document.querySelectorAll(".form-input.error").forEach(el => el.classList.remove("error"));
  },

  async syncUserToBackend(user, extra = {}) {
    try {
      await ApiClient.registerUser({
        uid: user.uid,
        email: user.email,
        name: user.displayName || extra.name || user.email.split("@")[0],
        photoURL: user.photoURL || null,
      });
    } catch (err) {
      console.warn("Backend sync failed (non-fatal):", err.message);
    }
  },

  initPasswordToggle(toggleId, inputId) {
    const btn = document.getElementById(toggleId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener("click", () => {
      const isText = input.type === "text";
      input.type = isText ? "password" : "text";
      btn.querySelector("svg").innerHTML = isText
        ? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`
        : `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
    });
  },

  // ─────────────────────────────────────────────
  // GOOGLE SIGN-IN
  // ─────────────────────────────────────────────

  async handleGoogleSignIn() {
    const btn = document.getElementById("googleSignIn");
    if (btn) { btn.disabled = true; btn.classList.add("loading"); }

    try {
      const provider = FirebaseService.googleProvider();
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;

      await this.syncUserToBackend(user);
      window.location.href = "chat.html";
    } catch (err) {
      console.error("Google sign-in error:", err);
      const msg = err.code === "auth/popup-closed-by-user"
        ? "Sign-in cancelled. Please try again."
        : err.code === "auth/popup-blocked"
        ? "Popup blocked by browser. Please allow popups and try again."
        : err.message || "Google sign-in failed. Please try again.";
      this.showAlert(msg, "error");
    } finally {
      if (btn) { btn.disabled = false; btn.classList.remove("loading"); }
    }
  },

  // ─────────────────────────────────────────────
  // LOGIN PAGE
  // ─────────────────────────────────────────────

  initLogin() {
    document.getElementById("googleSignIn")?.addEventListener("click", () => this.handleGoogleSignIn());
    document.getElementById("togglePassword")?.addEventListener("click", () => {
      const pw = document.getElementById("password");
      const icon = document.querySelector("#togglePassword svg");
      const isText = pw.type === "text";
      pw.type = isText ? "password" : "text";
      if (icon) {
        icon.style.opacity = isText ? "0.5" : "1";
      }
    });

    document.getElementById("forgotPassword")?.addEventListener("click", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      if (!email) {
        this.setFieldError("email", "emailError", "Enter your email first to reset password.");
        return;
      }
      try {
        await firebase.auth().sendPasswordResetEmail(email);
        this.showAlert("Password reset email sent! Check your inbox.", "success");
      } catch (err) {
        this.showAlert(err.message || "Failed to send reset email.", "error");
      }
    });

    document.getElementById("loginForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });
  },

  async handleLogin() {
    this.clearErrors();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    let valid = true;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.setFieldError("email", "emailError", "Please enter a valid email address.");
      valid = false;
    }
    if (!password || password.length < 6) {
      this.setFieldError("password", "passwordError", "Password must be at least 6 characters.");
      valid = false;
    }
    if (!valid) return;

    this.setLoading("loginBtn", "loginSpinner", "loginBtnText", true);

    try {
      const userCred = await firebase.auth().signInWithEmailAndPassword(email, password);
      await this.syncUserToBackend(userCred.user);
      window.location.href = "chat.html";
    } catch (err) {
      const msg = this.getAuthErrorMessage(err.code);
      this.showAlert(msg, "error");
    } finally {
      this.setLoading("loginBtn", "loginSpinner", "loginBtnText", false);
    }
  },

  // ─────────────────────────────────────────────
  // REGISTER PAGE
  // ─────────────────────────────────────────────

  initRegister() {
    document.getElementById("googleSignIn")?.addEventListener("click", () => this.handleGoogleSignIn());

    // Password toggle
    const pwField = document.getElementById("password");
    if (pwField) {
      pwField.addEventListener("input", () => this.updatePasswordStrength(pwField.value));
    }

    document.getElementById("togglePassword")?.addEventListener("click", () => {
      if (!pwField) return;
      pwField.type = pwField.type === "text" ? "password" : "text";
    });

    document.getElementById("registerForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleRegister();
    });
  },

  updatePasswordStrength(password) {
    const bars = [
      document.getElementById("sBar1"),
      document.getElementById("sBar2"),
      document.getElementById("sBar3"),
      document.getElementById("sBar4"),
    ];
    const label = document.getElementById("strengthLabel");
    if (!bars[0]) return;

    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
      { color: "#ef4444", label: "Weak" },
      { color: "#f59e0b", label: "Fair" },
      { color: "#10b981", label: "Good" },
      { color: "#6366f1", label: "Strong" },
    ];

    bars.forEach((bar, i) => {
      bar.style.background = i < score ? levels[score - 1].color : "var(--border)";
    });

    if (label) label.textContent = password ? (levels[score - 1]?.label || "Weak") : "Enter password";
  },

  async handleRegister() {
    this.clearErrors();
    const name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirmPassword").value;
    const terms = document.getElementById("terms").checked;

    let valid = true;

    if (!name || name.length < 2) {
      this.setFieldError("fullName", "nameError", "Please enter your full name.");
      valid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.setFieldError("email", "emailError", "Please enter a valid email address.");
      valid = false;
    }
    if (!password || password.length < 8) {
      this.setFieldError("password", "passwordError", "Password must be at least 8 characters.");
      valid = false;
    }
    if (password !== confirm) {
      this.setFieldError("confirmPassword", "confirmError", "Passwords do not match.");
      valid = false;
    }
    if (!terms) {
      this.showAlert("Please accept the Terms of Service to continue.", "error");
      valid = false;
    }
    if (!valid) return;

    this.setLoading("registerBtn", "registerSpinner", "registerBtnText", true);

    try {
      const userCred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      await userCred.user.updateProfile({ displayName: name });
      await this.syncUserToBackend(userCred.user, { name });
      window.location.href = "chat.html";
    } catch (err) {
      const msg = this.getAuthErrorMessage(err.code);
      this.showAlert(msg, "error");
    } finally {
      this.setLoading("registerBtn", "registerSpinner", "registerBtnText", false);
    }
  },

  // ─────────────────────────────────────────────
  // ERROR MESSAGES
  // ─────────────────────────────────────────────

  getAuthErrorMessage(code) {
    const messages = {
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/email-already-in-use": "An account with this email already exists.",
      "auth/weak-password": "Password is too weak. Use at least 8 characters.",
      "auth/invalid-email": "Invalid email address format.",
      "auth/too-many-requests": "Too many failed attempts. Please wait and try again.",
      "auth/user-disabled": "This account has been disabled.",
      "auth/network-request-failed": "Network error. Check your internet connection.",
      "auth/invalid-credential": "Invalid credentials. Please check email and password.",
    };
    return messages[code] || "Authentication failed. Please try again.";
  },
};

window.AuthManager = AuthManager;
