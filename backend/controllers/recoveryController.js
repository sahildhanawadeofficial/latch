const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} = require('@simplewebauthn/server');
const UAParser = require('ua-parser-js');
const User = require('../models/User');
const Device = require('../models/Device');
const { verifyCode, generateRecoveryCode, hashCode } = require('../services/recoveryService');
const { sendLockoutAlert } = require('../services/emailService');
const { setChallengeCookie, getChallengeCookie, clearChallengeCookie } = require('../services/challengeCookie');
const { validateEmail } = require('../services/emailValidator');

const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const RP_NAME = process.env.RP_NAME || 'SecureBank';
const RP_ID = process.env.RP_ID || 'localhost';

/**
 * POST /api/auth/recover
 * Body: { email, recoveryCode }
 * Verifies the emergency recovery code; on success wipes all devices and issues
 * a new recovery code; on failure enforces a 30-minute lockout and sends an alert.
 */
async function recover(req, res, next) {
  try {
    const { email, recoveryCode } = req.body;
    if (!email || !recoveryCode) {
      return res.status(400).json({ error: 'email and recoveryCode are required.' });
    }

    // Validate email format + DNS MX record
    const emailCheck = await validateEmail(email);
    if (!emailCheck.valid) {
      return res.status(422).json({ error: emailCheck.reason });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(404).json({ error: 'No account found with this email.' });

    // --- Lockout Check ---
    const now = new Date();
    if (user.status === 'disabled' && user.disabledUntil && user.disabledUntil > now) {
      const remainingMs = user.disabledUntil - now;
      const remainingMins = Math.ceil(remainingMs / 60000);
      return res.status(403).json({
        error: 'Account is temporarily locked.',
        lockedUntil: user.disabledUntil,
        remainingMinutes: remainingMins,
      });
    }

    // Constant-time comparison of submitted code vs stored SHA-256 hash
    const isValid = verifyCode(recoveryCode, user.recoveryCodeHash);

    if (!isValid) {
      // --- FAILURE: Apply lockout ---
      const disabledUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
      await User.updateOne(
        { _id: user._id },
        { status: 'disabled', disabledUntil }
      );

      // Send security alert via Resend (fire-and-forget, don't block response)
      sendLockoutAlert(email).catch((err) =>
        console.error('Failed to send lockout alert email:', err.message)
      );

      return res.status(403).json({
        error: 'Incorrect recovery code. Your account has been locked for 30 minutes.',
        lockedUntil: disabledUntil,
        remainingMinutes: 30,
      });
    }

    // --- SUCCESS: Wipe all devices, issue new recovery code ---

    // Generate and hash a fresh recovery code
    const newPlaintextCode = generateRecoveryCode();
    const newRecoveryCodeHash = hashCode(newPlaintextCode);

    // Generate WebAuthn registration options for re-enrollment IN MEMORY FIRST
    // Doing this before DB updates prevents locking out the user if generation crashes
    const registrationOptions = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new Uint8Array(Buffer.from(user._id.toString())),
      userName: user.email,
      userDisplayName: user.email,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
    });

    // Delete all registered devices
    await Device.deleteMany({ userId: user._id });

    // Clear lockout state and update recovery code hash
    await User.updateOne(
      { _id: user._id },
      {
        status: 'active',
        disabledUntil: null,
        recoveryCodeHash: newRecoveryCodeHash,
        refreshTokenHash: null, // Invalidate any active sessions
      }
    );

    // Store challenge in encrypted cookie for the re-enrollment flow
    setChallengeCookie(res, registrationOptions.challenge);

    return res.status(200).json({
      message: 'Recovery successful. All devices have been removed. Please save your new recovery code and re-register your fingerprint.',
      newRecoveryCode: newPlaintextCode, // Displayed once in-app
      registrationOptions,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/recover/finish
 * Body: { email, credentialResponse, deviceName? }
 * Verifies the WebAuthn response for a recovered user and saves their new device.
 */
async function recoverFinish(req, res, next) {
  try {
    const { email, credentialResponse } = req.body;
    if (!email || !credentialResponse) {
      return res.status(400).json({ error: 'email and credentialResponse are required.' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Retrieve challenge from cookie
    let expectedChallenge;
    try {
      expectedChallenge = getChallengeCookie(req);
    } catch {
      return res.status(400).json({ error: 'Challenge cookie missing or expired.' });
    }

    // Verify registration response
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credentialResponse,
        expectedChallenge,
        expectedOrigin: process.env.ORIGIN || 'http://localhost:3000',
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });
    } catch (err) {
      return res.status(400).json({ error: `WebAuthn verification failed: ${err.message}` });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Registration could not be verified.' });
    }

    const { credential } = verification.registrationInfo;

    // Generate device name
    const userAgent = req.headers['user-agent'] || '';
    const parser = new UAParser(userAgent);
    const os = parser.getOS().name || 'Unknown OS';
    const browser = parser.getBrowser().name || 'Unknown Browser';
    const autoDeviceName = `${browser} on ${os} (Recovered)`;

    // Persist new Device
    await Device.create({
      userId: user._id,
      deviceName: autoDeviceName,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
    });

    clearChallengeCookie(res);

    return res.status(201).json({ message: 'Device recovered successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { recover, recoverFinish };
