const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} = require('@simplewebauthn/server');
const UAParser = require('ua-parser-js');
const User = require('../models/User');
const Device = require('../models/Device');
const { setChallengeCookie, getChallengeCookie, clearChallengeCookie } = require('../services/challengeCookie');
const { generateRecoveryCode, hashCode } = require('../services/recoveryService');
const { verifyAccessToken } = require('../services/jwtService');
const { webAuthnFromRequest } = require('../services/clientOrigin');

const RP_NAME = process.env.RP_NAME || 'SecureBank';

/**
 * POST /api/auth/register/start
 * Body: { email }
 * Creates a user stub and returns WebAuthn registration options.
 */
async function registerStart(req, res, next) {
  try {
    const { email, verificationJWT } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    // Require a valid verificationJWT — proof the user clicked the link in their inbox
    if (!verificationJWT) {
      return res.status(403).json({ error: 'Email verification required. Please verify your email first.' });
    }
    let verified;
    try {
      verified = verifyAccessToken(verificationJWT);
    } catch {
      return res.status(403).json({ error: 'Email verification token is invalid or expired. Please verify your email again.' });
    }
    if (verified.purpose !== 'email-verification') {
      return res.status(403).json({ error: 'Invalid verification token.' });
    }
    if (verified.email !== email.trim().toLowerCase()) {
      return res.status(403).json({ error: 'Verification token does not match the provided email.' });
    }

    // Reject duplicate emails
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Generate a temporary userId for the WebAuthn challenge
    // The actual User doc will be persisted in /register/finish
    // SimpleWebAuthn requires userID to be a Uint8Array
    const tempUserId = new Uint8Array(Buffer.from(email));

    const { rpID } = webAuthnFromRequest(req);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: tempUserId,
      userName: email,
      userDisplayName: email,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // biometric/hardware only
        userVerification: 'required',
      },
    });

    // Store challenge in encrypted httpOnly cookie (stateless)
    setChallengeCookie(res, options.challenge, req);

    // Return options (challenge is included for the browser but also stored encrypted)
    return res.status(200).json(options);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/register/finish
 * Body: { email, credentialResponse, deviceName? }
 * Verifies the WebAuthn response, persists User + Device, returns one-time recovery code.
 */
async function registerFinish(req, res, next) {
  try {
    const { email, credentialResponse } = req.body;
    if (!email || !credentialResponse) {
      return res.status(400).json({ error: 'email and credentialResponse are required.' });
    }

    // Retrieve and decrypt challenge from cookie
    let expectedChallenge;
    try {
      expectedChallenge = getChallengeCookie(req);
    } catch {
      return res.status(400).json({ error: 'Challenge cookie is missing or expired. Please restart registration.' });
    }

    // Verify the WebAuthn registration response
    const { rpID, origin } = webAuthnFromRequest(req);
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credentialResponse,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch (err) {
      return res.status(400).json({ error: `WebAuthn verification failed: ${err.message}` });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Registration could not be verified.' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // Check again for duplicate (race condition guard)
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Generate and hash the one-time recovery code
    const plaintextCode = generateRecoveryCode();
    const recoveryCodeHash = hashCode(plaintextCode);

    // Persist User
    const user = await User.create({ email, recoveryCodeHash });

    // Generate device name from User-Agent if not provided
    const userAgent = req.headers['user-agent'] || '';
    const parser = new UAParser(userAgent);
    const os = parser.getOS().name || 'Unknown OS';
    const browser = parser.getBrowser().name || 'Unknown Browser';
    const autoDeviceName = `${browser} on ${os}`;

    // Persist Device
    await Device.create({
      userId: user._id,
      deviceName: autoDeviceName,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
    });

    // Clear challenge cookie — it has been consumed
    clearChallengeCookie(res, req);

    // Return the plaintext recovery code exactly once — never stored in plaintext
    return res.status(201).json({
      message: 'Registration successful.',
      recoveryCode: plaintextCode, // Displayed once in-app; user must save offline
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerStart, registerFinish };
