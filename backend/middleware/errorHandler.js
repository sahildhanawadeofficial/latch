/**
 * Global Express error handler.
 * Must be registered as the last middleware with 4 parameters.
 * Returns a consistent { error: message } JSON response.
 * Hides stack traces in production.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);

  const statusCode = err.statusCode || err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An internal server error occurred.'
      : err.message || 'An unexpected error occurred.';

  return res.status(statusCode).json({ error: message });
}

module.exports = { errorHandler };
