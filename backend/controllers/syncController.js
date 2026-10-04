const crypto = require('crypto');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} = require('@simplewebauthn/server');
const PairingToken = require('../models/PairingToken');
const Device = require('../models/Device');
const User = require('../models/User');
const { setChallengeCookie, getChallengeCookie, clearChallengeCookie } = require('../services/challengeCookie');
const { webAuthnFromRequest } = require('../services/clientOrigin');

const RP_NAME = process.env.RP_NAME || 'SecureBank';

/**
 * POST /api/auth/sync/token
 * Header: Authorization: Bearer <accessToken>
 * Requires authMiddleware. Generates a 120-second single-use QR pairing token.
 */
async function syncToken(req, res, next) {
  try {
    const userId = req.user.userId;

    // Generate a UUID v4 pairing token
    const token = crypto.randomUUID();

    // Persist to MongoDB — TTL index auto-deletes after 120 seconds
    await PairingToken.create({ token, userId });

    return res.status(200).json({
      pairingToken: token,
      expiresInSeconds: 120,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/sync/claim
 * Body: { pairingToken, deviceName? }
 * Validates the QR token and returns WebAuthn registration options for the secondary device.
 */
async function syncClaim(req, res, next) {
  try {
    const { pairingToken, deviceName } = req.body;
    if (!pairingToken) {
      return res.status(400).json({ error: 'pairingToken is required.' });
    }

    // Look up the token in MongoDB
    const tokenDoc = await PairingToken.findOne({ token: pairingToken });
    if (!tokenDoc) {
      // Expired (TTL deleted it) or never existed
      return res.status(410).json({ error: 'Pairing token is expired or invalid. Please generate a new QR code.' });
    }

    const { userId } = tokenDoc;

    // Single-use: delete immediately, don't wait for TTL
    await PairingToken.deleteOne({ _id: tokenDoc._id });

    // Look up the user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Generate WebAuthn registration options for the secondary device
    const { rpID } = webAuthnFromRequest(req);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: user._id.toString(),
      userName: user.email,
      userDisplayName: user.email,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
    });

    // Store challenge in encrypted cookie on the secondary device's response
    setChallengeCookie(res, options.challenge, req);

    // Pass userId and deviceName in session so /register/finish can link correctly
    // We encode userId in a custom response field for the secondary device to re-submit
    return res.status(200).json({
      registrationOptions: options,
      userId: user._id.toString(),
      deviceName: deviceName || 'Secondary Device',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/sync/finish
 * Body: { userId, credentialResponse, deviceName }
 * Finishes registration for a secondary device — no new recovery code generated.
 */
async function syncFinish(req, res, next) {
  try {
    const { userId, credentialResponse, deviceName } = req.body;
    if (!userId || !credentialResponse) {
      return res.status(400).json({ error: 'userId and credentialResponse are required.' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Retrieve and decrypt challenge from cookie
    let expectedChallenge;
    try {
      expectedChallenge = getChallengeCookie(req);
    } catch {
      return res.status(400).json({ error: 'Challenge cookie is missing or expired.' });
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
      return res.status(400).json({ error: 'Secondary device registration could not be verified.' });
    }

    const { credential } = verification.registrationInfo;

    // Persist the new Device linked to the same userId — no new recovery code
    await Device.create({
      userId: user._id,
      deviceName: deviceName || 'Secondary Device',
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
    });

    clearChallengeCookie(res, req);

    return res.status(201).json({ message: 'Secondary device registered successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { syncToken, syncClaim, syncFinish };
