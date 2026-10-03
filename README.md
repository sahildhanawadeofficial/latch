# 🔐 SecureBank — Biometric & Face Authentication System

A production-grade, passwordless banking authentication platform combining **WebAuthn/FIDO2 Passkeys**, **Client-Side Face Biometrics with Active Liveness Anti-Spoofing**, **RS256 JWT Security**, and **2-Step Biological Intent Authorization**.

---

## 🌟 Key Features

- **Passwordless Passkeys (WebAuthn/FIDO2)**: Hardware-backed biometric authentication (Fingerprint, Face ID, Windows Hello, YubiKey) using `@simplewebauthn`.
- **Active Liveness Anti-Spoofing**: 
  - Prevents photo presentation attacks (printed photographs or phone screens).
  - Uses continuous **Eye Aspect Ratio (EAR)** calculation to detect genuine human eye blinks in real time.
- **6-Month Biometric Security Policy**: Enforced 180-day lock on Facecard updates across both frontend and backend APIs.
- **2-Step Biological Intent Authorization**: Sensitive transactions (e.g. Send Money) require both a 4-digit S-PIN and live human facial biometric verification.
- **Enterprise-Grade Cryptography**:
  - RSA-2048 keypair (`RS256`) for access and refresh tokens.
  - AES-256-GCM encrypted cookies for WebAuthn authentication challenges.
  - Automatic refresh token rotation with SHA-256 hash validation.
- **Email Verification & Magic Links**:
  - Real-time DNS MX record validation.
  - Automated dispatch via Gmail SMTP (with local development fallback and console magic links).

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, `face-api.js` (TensorFlow.js), `@simplewebauthn/browser`.
- **Backend**: Node.js, Express 5, Mongoose, `@simplewebauthn/server`, `jsonwebtoken`, `nodemailer`.
- **Database**: MongoDB.

---

## 📋 Prerequisites

Before running the application, make sure you have:

1. **Node.js** (v18.0.0 or higher) — [Download Node.js](https://nodejs.org/)
2. **MongoDB** installed and running on your system:
   - **Check status in PowerShell**:
     ```powershell
     Get-Service -Name *mongo*
     ```
   - **Start the MongoDB service**:
     ```powershell
     Start-Service MongoDB
     ```
3. A modern web browser supporting WebAuthn and webcam access (Google Chrome, Microsoft Edge, Brave, Firefox).

---

## 🚀 Quick Start Guide

### Step 1: Backend Setup & Launch

1. Open a terminal / PowerShell window and navigate to the `backend` folder:
   ```powershell
   cd backend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Initialize Environment & Cryptographic Keys (Automatic):
   You can run:
   ```powershell
   npm run setup
   ```
   *(Or simply run `npm run dev` — the backend will **automatically detect and generate** a fresh `backend/.env` with a 32-byte cryptographic secret and an RSA-2048 keypair in `backend/keys/` if they do not exist!)*

4. *(Optional)* Add your Gmail credentials to `backend/.env` if you want real emails delivered to your inbox (see the Gmail section below).

5. Start the backend server:
   ```powershell
   npm run dev
   ```
   The backend will be running at **`http://localhost:5000`**.

---

### Step 2: Frontend Setup & Launch

1. Open a **second** terminal / PowerShell window and navigate to the `frontend` folder:
   ```powershell
   cd frontend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Start the Vite React development server:
   ```powershell
   npm run dev
   ```
   The application will be running at **`http://localhost:3000`**.

---

## 📧 Gmail SMTP Configuration (Optional)

If you want real emails delivered to users' Gmail inboxes:

1. Visit **[Google Account App Passwords](https://myaccount.google.com/apppasswords)**.
2. In the App Name field, enter `SecureBank` and click **Create**.
3. Copy the 16-character generated password (e.g. `abcd efgh ijkl mnop`).
4. Update `backend/.env`:
   ```env
   GMAIL_USER=your_email@gmail.com
   GMAIL_APP_PASSWORD=your_16_character_app_password
   ```
5. Save the file. The backend will automatically restart and dispatch emails.

*(Note: In local development without Gmail credentials, the verification link is automatically printed to the terminal and shown directly in the UI as a convenient one-click button).*

---

## 📱 User Workflow

1. **Registration**:
   - Navigate to `http://localhost:3000/register`.
   - Enter your email and submit.
   - Click the verification link in your email (or the direct dev button).
   - Touch your fingerprint sensor / Windows Hello / security key to register your hardware Passkey.
   - Securely save your 16-character emergency recovery code.
2. **Login**:
   - Navigate to `http://localhost:3000/login`.
   - Enter your email and verify your biometric Passkey.
3. **Dashboard Setup**:
   - **Set S-PIN**: Configure your 4-digit security PIN.
   - **Register Facecard**: Position your face in the frame, blink naturally once to confirm active liveness, and click **Confirm Live Face & Authorize**.
4. **Sending Money**:
   - Click **Send Money**, enter recipient and amount.
   - Step 1: Authorize using your 4-digit S-PIN.
   - Step 2: Look at the camera, blink once to confirm liveness, and authorize with your face.

---

## 🛡️ Anti-Spoofing & Liveness Explained

| Attack Vector | Vulnerability | Mitigation |
| :--- | :--- | :--- |
| **Static Photo Attack** | Attacker holds up a photograph of the account owner. | **Eye Aspect Ratio (EAR)**: A photograph's eyelids cannot blink. The system continuously samples EAR and will refuse to authorize until a genuine eye blink (compression and reopening) occurs. |
| **Video Replay Attack** | Attacker replays a pre-recorded clip. | Combined with dual-token WebAuthn hardware device signatures. |
| **Camera Distance / Lighting Variations** | Legitimate users blocked by strict thresholds. | Dynamically relaxed Euclidean distance threshold (`1.05`) calibrated for standard webcams and ambient room lighting. |

---

## 📂 Project Architecture

```
Face_authentication_system/
├── backend/
│   ├── controllers/         # Auth, Login, Settings, Sync & Transaction logic
│   ├── middleware/          # JWT auth & error handlers
│   ├── models/             # Mongoose schemas (User, Account, Device, Transaction)
│   ├── routes/             # Express API endpoints (/api/auth, /api/dashboard)
│   ├── services/           # Challenge cookies, email dispatch, JWT RS256 service
│   ├── keys/               # RSA-2048 private and public keypair
│   ├── .env                # Environment secrets
│   └── index.js            # Express server entry point
└── frontend/
    ├── public/
    │   └── models/         # Pretrained neural network weights (SSD, Landmarks, Descriptors)
    ├── src/
    │   ├── components/     # UI Modals, Camera Auth, Navigation
    │   ├── hooks/          # React Auth context & session persistence
    │   ├── pages/          # Login, Register, Verify, Recovery, Dashboard
    │   └── App.jsx         # React Router & ProtectedRoute guards
    └── vite.config.js      # Reverse proxy to port 5000
```
