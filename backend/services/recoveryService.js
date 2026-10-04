const crypto = require('crypto');

const CODE_LENGTH = 16; // 16 hex chars = 4 groups of 4
const GROUP_SIZE = 4;
const SEPARATOR = '-';

/**
 * Generate a cryptographically secure 16-character emergency recovery code.
 * Format: XXXX-XXXX-XXXX-XXXX (hex uppercase)
 * @returns {string} plaintext recovery code
 */
function generateRecoveryCode() {
  const raw = crypto.randomBytes(8).toString('hex').toUpperCase(); // 16 hex chars
  const groups = [];
  for (let i = 0; i < CODE_LENGTH; i += GROUP_SIZE) {
    groups.push(raw.slice(i, i + GROUP_SIZE));
  }
  return groups.join(SEPARATOR);
}

/**
 * Hash a plaintext recovery code with SHA-256 for DB storage.
 * @param {string} plaintext - the raw recovery code
 * @returns {string} hex digest
 */
function hashCode(plaintext) {
  return crypto
    .createHash('sha256')
    .update(plaintext.replace(/-/g, '').toUpperCase()) // normalise before hashing
    .digest('hex');
}

/**
 * Constant-time comparison of a submitted code against a stored SHA-256 hash.
 * Prevents timing attacks during recovery verification.
 * @param {string} submitted - the code the user typed
 * @param {string} storedHash - the SHA-256 hash stored in User.recoveryCodeHash
 * @returns {boolean}
 */
function verifyCode(submitted, storedHash) {
  const submittedHash = hashCode(submitted);
  // Both buffers must be the same length for timingSafeEqual
  const a = Buffer.from(submittedHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { generateRecoveryCode, hashCode, verifyCode };
