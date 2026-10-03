const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const privateKey = fs.readFileSync(
  path.join(__dirname, '../keys/private.pem'),
  'utf8'
);
const publicKey = fs.readFileSync(
  path.join(__dirname, '../keys/public.pem'),
  'utf8'
);

/**
 * Sign a short-lived RS256 access token (15 minutes).
 * @param {object} payload - { userId, email }
 * @returns {string} signed JWT
 */
function signAccessToken(payload, expiresIn) {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: expiresIn || process.env.ACCESS_TOKEN_EXPIRY || '15m',
  });
}

/**
 * Sign a long-lived RS256 refresh token (7 days).
 * @param {object} payload - { userId }
 * @returns {string} signed JWT
 */
function signRefreshToken(payload) {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  });
}

/**
 * Verify an RS256 access token.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws if invalid or expired
 */
function verifyAccessToken(token) {
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
}

/**
 * Verify an RS256 refresh token.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws if invalid or expired
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
}

/**
 * Hash a token string with SHA-256 for safe DB storage.
 * Used to compare against User.refreshTokenHash.
 * @param {string} token
 * @returns {string} hex digest
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
