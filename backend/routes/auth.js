const crypto = require('crypto');
const express = require('express');
const router = express.Router();

const { registerStart, registerFinish } = require('../controllers/registerController');
const { loginStart, loginFinish, refreshToken, logout } = require('../controllers/loginController');
const { syncToken, syncClaim, syncFinish } = require('../controllers/syncController');
const { recover, recoverFinish } = require('../controllers/recoveryController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validateEmail } = require('../services/emailValidator');
const { sendVerificationEmail } = require('../services/emailService');
const { signAccessToken } = require('../services/jwtService');
const EmailVerification = require('../models/EmailVerification');

// ─── Real-time Email Validation ───────────────────────────────────────────────
// POST /api/auth/validate-email — format + DNS MX check (used by frontend debounce)
router.post('/validate-email', async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await validateEmail(email);
    return res.status(result.valid ? 200 : 422).json(result);
  } catch (err) {
    next(err);
  }
});


// ─── Registration ─────────────────────────────────────────────────────────────
// POST /api/auth/verify-email/send — send magic-link to confirm mailbox is real
router.post('/verify-email/send', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    // Format + MX check first
    const { validateEmail: vemail } = require('../services/emailValidator');
    const mx = await vemail(email);
    if (!mx.valid) return res.status(422).json({ error: mx.reason });

    const normalised = email.trim().toLowerCase();

    // Reject if account already exists
    const User = require('../models/User');
    const existingUser = await User.findOne({ email: normalised });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Invalidate any existing unused tokens for this email (rate-limit / re-send)
    await EmailVerification.deleteMany({ email: normalised });

    // Generate a 32-byte cryptographically random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    await EmailVerification.create({ token: rawToken, email: normalised });

    const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    const verifyUrl = `${frontendOrigin}/verify-email?token=${rawToken}`;

    console.log('\n======================================================');
    console.log('✉️  DEVELOPMENT MAGIC LINK:');
    console.log(`   ${verifyUrl}`);
    console.log('======================================================\n');

    await sendVerificationEmail(normalised, verifyUrl);

    return res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-email/confirm — user clicked the link; validate token, return verificationJWT
router.post('/verify-email/confirm', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required.' });

    const record = await EmailVerification.findOne({ token });

    if (!record) {
      return res.status(400).json({
        error: 'This verification link is invalid or has expired. Please request a new one.',
      });
    }
    if (record.used) {
      return res.status(400).json({
        error: 'This verification link has already been used. Please request a new one.',
      });
    }

    // Mark as used (single-use)
    record.used = true;
    await record.save();

    // Issue a short-lived verificationJWT — proof the email was verified
    // Expires in 10 minutes; register/start will validate this
    const verificationJWT = signAccessToken(
      { email: record.email, purpose: 'email-verification' },
      '10m'
    );

    return res.json({
      verified: true,
      email: record.email,
      verificationJWT,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register/start  — Create challenge for new user
router.post('/register/start', registerStart);
// POST /api/auth/register/finish — Verify credential, persist user + device, return recovery code
router.post('/register/finish', registerFinish);

// ─── Authentication ───────────────────────────────────────────────────────────
// POST /api/auth/login/start  — Risk Engine check, return authentication options
router.post('/login/start', loginStart);
// POST /api/auth/login/finish — Verify signature, increment counter, issue JWT pair
router.post('/login/finish', loginFinish);
// POST /api/auth/refresh      — Rotate refresh token, issue new access token
router.post('/refresh', refreshToken);
// POST /api/auth/logout       — Invalidate refresh token, clear cookie
router.post('/logout', logout);

// ─── Multi-Device Sync ────────────────────────────────────────────────────────
// POST /api/auth/sync/token  — Generate QR pairing token (authenticated)
router.post('/sync/token', authMiddleware, syncToken);
// POST /api/auth/sync/claim  — Secondary device claims the pairing token
router.post('/sync/claim', syncClaim);
// POST /api/auth/sync/finish — Secondary device finishes biometric registration
router.post('/sync/finish', syncFinish);

// ─── Emergency Recovery ───────────────────────────────────────────────────────
// POST /api/auth/recover — Verify recovery code, wipe devices, issue new code
router.post('/recover', recover);
// POST /api/auth/recover/finish — Verifies the WebAuthn response for a recovered user
router.post('/recover/finish', recoverFinish);

module.exports = router;
