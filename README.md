# 🤖 AI Assistant Chatbot

A production-ready AI chatbot web application powered by **Google Gemini AI**, built with a modern dark glassmorphism UI — similar to ChatGPT.

![AI Assistant Chatbot](https://img.shields.io/badge/Gemini-AI%20Powered-blue?style=for-the-badge&logo=google)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-orange?style=for-the-badge&logo=firebase)
![Node.js](https://img.shields.io/badge/Node.js-Express%20Backend-green?style=for-the-badge&logo=node.js)

---

## ✨ Features

- 🔐 **Authentication** — Google Sign-In + Email/Password via Firebase Auth
- 💬 **AI Chat** — Powered by Google Gemini 1.5 Flash with context awareness
- 🗂️ **Chat History** — All conversations saved to Firestore
- ✏️ **Rename & Delete** — Full chat management
- 📊 **Admin Dashboard** — Users, chats, logs, analytics with charts
- 🌑 **Dark Theme** — Premium glassmorphism UI
- 📱 **Responsive** — Works on all devices
- 🔒 **Secure** — JWT auth, rate limiting, helmet, CORS, XSS protection

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js + Express.js |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| AI | Google Gemini 1.5 Flash API |
| Hosting | Vercel (frontend) + Render (backend) |

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/anuj66688/SIMPLE-AI-CHATBOT.git
cd SIMPLE-AI-CHATBOT
```

### 2. Install backend dependencies
```bash
cd backend
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your keys (see Configuration below)
```

### 4. Start the backend
```bash
npm run dev
# Server runs on http://localhost:5000
```

### 5. Open the frontend
Open `frontend/index.html` with VS Code Live Server on port 5500.

---

## ⚙️ Configuration

Create `backend/.env` with these values:

```env
PORT=5000
NODE_ENV=development

# Get from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSy...your_key_here

# Get from: Firebase Console > Project Settings > Service Accounts
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Any secure random string (32+ chars)
JWT_SECRET=your_super_secret_jwt_key_here

# Your frontend URL (for CORS)
FRONTEND_URL=http://localhost:5500
```

---

## 📁 Project Structure

```
├── backend/
│   ├── server.js
│   ├── config/firebase.js
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/geminiService.js
│   └── utils/logger.js
│
├── frontend/
│   ├── index.html       ← Landing page
│   ├── login.html       ← Login page
│   ├── register.html    ← Register page
│   ├── chat.html        ← Chat interface
│   ├── admin.html       ← Admin dashboard
│   ├── css/
│   └── js/
│
└── firestore.rules      ← Firestore security rules
```

---

## 🔐 Firebase Setup

1. Enable **Email/Password** and **Google** in Authentication
2. Create a **Firestore** database
3. Apply rules from `firestore.rules`
4. Generate a **Service Account key** for the backend

---

## 🌐 Deployment

- **Frontend** → [Vercel](https://vercel.com) (import `frontend/` folder)
- **Backend** → [Render](https://render.com) (import `backend/` folder, add env vars)

---

## 📜 License

MIT License — free to use and modify.

---

Built with ❤️ using Google Gemini AI
