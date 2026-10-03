const { verifyAccessToken } = require('../services/jwtService');

/**
 * Express middleware to protect routes requiring a valid RS256 access token.
 * Reads the Authorization: Bearer <token> header, verifies it, and attaches
 * the decoded payload to req.user.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header is missing or malformed.' });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix
  try {
    const decoded = verifyAccessToken(token);
    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token has expired. Please refresh.' });
    }
    return res.status(401).json({ error: 'Access token is invalid.' });
  }
}

module.exports = { authMiddleware };
