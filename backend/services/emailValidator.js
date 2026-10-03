const dns = require('dns').promises;

// Strict email format regex — validates local part + domain structure
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

/**
 * Validate email format with a strict regex.
 * @param {string} email
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateFormat(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email is required.' };
  }
  const trimmed = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, reason: 'Invalid email format.' };
  }

  const [localPart, domain] = trimmed.split('@');

  // Local part checks
  if (localPart.length < 1 || localPart.length > 64) {
    return { valid: false, reason: 'Email username must be between 1 and 64 characters.' };
  }
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { valid: false, reason: 'Email username cannot start or end with a dot.' };
  }
  if (localPart.includes('..')) {
    return { valid: false, reason: 'Email username cannot contain consecutive dots.' };
  }

  // Domain checks
  if (domain.length > 253) {
    return { valid: false, reason: 'Email domain is too long.' };
  }
  if (domain.startsWith('-') || domain.endsWith('-')) {
    return { valid: false, reason: 'Email domain cannot start or end with a hyphen.' };
  }

  return { valid: true };
}

/**
 * Verify the domain has MX (Mail Exchange) DNS records.
 * This confirms the domain is configured to receive email — i.e., it is a real, existing mail domain.
 * Does NOT verify the specific mailbox exists (impossible without sending an email).
 *
 * @param {string} email
 * @returns {{ valid: boolean, reason?: string }}
 */
async function validateDomain(email) {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain) return { valid: false, reason: 'Could not extract domain from email.' };

  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        valid: false,
        reason: `The domain "${domain}" does not appear to accept email. Please use a valid email provider.`,
      };
    }
    
    // RFC 7505 Null MX check: if the only MX record has exchange: '' or '.', the domain explicitly rejects all email
    if (mxRecords.length === 1 && (mxRecords[0].exchange === '' || mxRecords[0].exchange === '.')) {
      return {
        valid: false,
        reason: `The domain "${domain}" explicitly does not accept email (e.g. example domains).`,
      };
    }

    return { valid: true };
  } catch (err) {
    // If the DNS lookup fails for ANY reason (ENOTFOUND, ENODATA, ESERVFAIL, timeouts, VPN issues), 
    // we MUST fail open. The only true way to verify an email is the Magic Link itself.
    // We only hard-fail if we successfully get a Null MX record back (handled in the try block).
    console.warn(`[emailValidator] DNS lookup warning for ${domain} (failing open):`, err.code || err.message);
    return { valid: true };
  }
}

/**
 * Full email validation: format check + DNS MX record lookup.
 * @param {string} email
 * @returns {{ valid: boolean, reason?: string }}
 */
async function validateEmail(email) {
  const formatResult = validateFormat(email);
  if (!formatResult.valid) return formatResult;

  const domainResult = await validateDomain(email);
  return domainResult;
}

module.exports = { validateEmail, validateFormat };
