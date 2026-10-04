const LOCAL_ORIGIN = 'http://localhost:3000';
const PRODUCTION_FRONTEND = 'https://latch-indol-six.vercel.app';

function allowedOrigins() {
  return [...new Set(
    [process.env.ORIGIN, process.env.FRONTEND_ORIGIN, LOCAL_ORIGIN, PRODUCTION_FRONTEND]
      .filter(Boolean)
  )];
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return allowedOrigins().includes(origin);
}

/**
 * Passkey RP ID must be the hostname of the page the user has open.
 * A localhost RP ID is rejected by the browser on the Vercel site.
 */
function webAuthnFromRequest(req) {
  const originHeader = req.headers.origin;
  if (originHeader && isAllowedOrigin(originHeader)) {
    try {
      const { hostname, protocol } = new URL(originHeader);
      if (protocol === 'https:' && hostname !== 'localhost') {
        return { rpID: hostname, origin: originHeader };
      }
    } catch {
      // Fall through to configured values.
    }
  }

  return {
    rpID: process.env.RP_ID || 'localhost',
    origin: process.env.ORIGIN || LOCAL_ORIGIN,
  };
}

module.exports = { allowedOrigins, isAllowedOrigin, webAuthnFromRequest };
