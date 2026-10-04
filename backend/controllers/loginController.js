const {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const User = require('../models/User');
const Device = require('../models/Device');
const { setChallengeCookie, getChallengeCookie, clearChallengeCookie } = require('../services/challengeCookie');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } = require('../services/jwtService');
const { validateEmail } = require('../services/emailValidator');

const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || 'http://localhost:3000';

/**
 * POST /api/auth/login/start
 * Body: { email }
 * Checks lockout status, returns WebAuthn authentication options.
 */
async function loginStart(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    // Validate email format + DNS MX record
    const emailCheck = await validateEmail(email);
    if (!emailCheck.valid) {
      return res.status(422).json({ error: emailCheck.reason });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(404).json({ error: 'No account found with this email.' });

    // --- Risk Engine: Lockout Check ---
    const now = new Date();
    if (user.status === 'disabled' && user.disabledUntil && user.disabledUntil > now) {
      const remainingMs = user.disabledUntil - now;
      const remainingMins = Math.ceil(remainingMs / 60000);
      return res.status(403).json({
        error: 'Account is temporarily locked due to a failed recovery attempt.',
        lockedUntil: user.disabledUntil,
        remainingMinutes: remainingMins,
      });
    }

    // Auto-heal: lockout has expired
    if (user.status === 'disabled' && user.disabledUntil && user.disabledUntil <= now) {
      await User.updateOne({ _id: user._id }, { status: 'active', disabledUntil: null });
    }

    // Fetch all registered devices for this user
    const devices = await Device.find({ userId: user._id });
    if (devices.length === 0) {
      return res.status(400).json({ error: 'No registered devices found for this account.' });
    }

    const allowCredentials = devices.map((d) => ({
      id: d.credentialId,
      type: 'public-key',
    }));

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'required',
    });

    // Store challenge in encrypted httpOnly cookie
    setChallengeCookie(res, options.challenge);

    return res.status(200).json(options);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login/finish
 * Body: { email, signatureResponse }
 * Verifies WebAuthn signature, increments counter, issues RS256 JWT pair.
 */
async function loginFinish(req, res, next) {
  try {
    const { email, signatureResponse } = req.body;
    if (!email || !signatureResponse) {
      return res.status(400).json({ error: 'email and signatureResponse are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'No account found with this email.' });

    // Retrieve challenge from encrypted cookie
    let expectedChallenge;
    try {
      expectedChallenge = getChallengeCookie(req);
    } catch {
      return res.status(400).json({ error: 'Challenge cookie is missing or expired. Please restart login.' });
    }

    // Find the Device being used
    const device = await Device.findOne({ credentialId: signatureResponse.id });
    if (!device || !device.userId.equals(user._id)) {
      return res.status(400).json({ error: 'Unknown credential.' });
    }

    // Verify the authentication response
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: signatureResponse,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: device.credentialId,
          publicKey: Buffer.from(device.publicKey, 'base64url'),
          counter: device.counter,
        },
        requireUserVerification: true,
      });
    } catch (err) {
      return res.status(400).json({ error: `WebAuthn verification failed: ${err.message}` });
    }

    if (!verification.verified) {
      return res.status(400).json({ error: 'Authentication signature verification failed.' });
    }

    const { newCounter } = verification.authenticationInfo;

    // Windows Hello and some other authenticators always report 0 because they
    // do not keep a signature counter. WebAuthn only treats a stalled counter
    // as a possible clone when at least one of the two values is non-zero.
    if ((newCounter > 0 || device.counter > 0) && newCounter <= device.counter) {
      return res.status(400).json({
        error: 'Signature counter did not increment. Possible authenticator clone detected.',
      });
    }

    if (newCounter > device.counter) {
      await Device.updateOne({ _id: device._id }, { counter: newCounter });
    }

    // Clear the challenge cookie
    clearChallengeCookie(res);

    // Issue RS256 token pair
    const payload = { userId: user._id.toString(), email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken({ userId: user._id.toString() });

    // Store hashed refresh token on user for rotation invalidation
    await User.updateOne({ _id: user._id }, { refreshTokenHash: hashToken(refreshToken) });

    // Set refresh token as httpOnly cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({ accessToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 * Reads httpOnly refresh token cookie, validates, rotates, issues new access + refresh tokens.
 */
async function refreshToken(req, res, next) {
  try {
    const token = req.cookies['refresh_token'];
    if (!token) return res.status(401).json({ error: 'No refresh token provided.' });

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ error: 'Refresh token is invalid or expired.' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found.' });

    // Validate token against stored hash (rotation guard)
    if (!user.refreshTokenHash || user.refreshTokenHash !== hashToken(token)) {
      return res.status(401).json({ error: 'Refresh token has been rotated. Please log in again.' });
    }

    // Issue new pair
    const payload = { userId: user._id.toString(), email: user.email };
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken({ userId: user._id.toString() });

    await User.updateOne({ _id: user._id }, { refreshTokenHash: hashToken(newRefreshToken) });

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Clears refresh token cookie and invalidates stored hash.
 */
async function logout(req, res, next) {
  try {
    const token = req.cookies['refresh_token'];
    if (token) {
      try {
        const decoded = verifyRefreshToken(token);
        await User.updateOne({ _id: decoded.userId }, { refreshTokenHash: null });
      } catch {
        // Token already invalid — still clear the cookie
      }
    }
    res.clearCookie('refresh_token');
    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { loginStart, loginFinish, refreshToken, logout };
