const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const COOKIE_NAME = 'webauthn_challenge';
const COOKIE_MAX_AGE = 5 * 60 * 1000; // 5 minutes in ms

/**
 * Get the 32-byte encryption key from COOKIE_SECRET env var.
 * COOKIE_SECRET must be a 64-char hex string (32 bytes).
 */
function getKey() {
  const secret = process.env.COOKIE_SECRET;
  if (!secret || Buffer.from(secret, 'hex').length !== 32) {
    throw new Error('COOKIE_SECRET must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(secret, 'hex');
}

/**
 * AES-256-GCM encrypt a challenge string.
 * Returns a base64url-encoded string: iv:authTag:ciphertext
 * @param {string} challenge
 * @returns {string}
 */
function encryptChallenge(challenge) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(challenge, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Encode as iv:authTag:ciphertext (all base64)
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * AES-256-GCM decrypt a challenge string.
 * @param {string} encoded - iv:authTag:ciphertext (base64)
 * @returns {string} plaintext challenge
 */
function decryptChallenge(encoded) {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(':');

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Set the encrypted WebAuthn challenge as an httpOnly cookie.
 * @param {object} res - Express response
 * @param {string} challenge - raw WebAuthn challenge string
 */
function setChallengeCookie(res, challenge) {
  const encrypted = encryptChallenge(challenge);
  res.cookie(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * Read and decrypt the WebAuthn challenge from the cookie.
 * @param {object} req - Express request
 * @returns {string} plaintext challenge
 * @throws if cookie is missing or decryption fails
 */
function getChallengeCookie(req) {
  const encrypted = req.cookies[COOKIE_NAME];
  if (!encrypted) {
    throw new Error('WebAuthn challenge cookie is missing or expired.');
  }
  return decryptChallenge(encrypted);
}

/**
 * Clear the WebAuthn challenge cookie after it has been consumed.
 * @param {object} res - Express response
 */
function clearChallengeCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

module.exports = { setChallengeCookie, getChallengeCookie, clearChallengeCookie };
