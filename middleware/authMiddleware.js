// middleware/authMiddleware.js
// Protects routes requiring authenticated EVE SSO session and auto-refreshes expired tokens

const axios = require('axios');
const { URLSearchParams } = require('url');
const winston = require('winston');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}] ${message}`)
  ),
  transports: [new winston.transports.Console()]
});

const EVE_SSO_TOKEN_URL = 'https://login.eveonline.com/v2/oauth/token';
const EVE_CLIENT_ID = process.env.EVE_CLIENT_ID;
const EVE_SECRET_KEY = process.env.EVE_SECRET_KEY;

/**
 * Middleware to ensure user has a valid EVE session.
 * Refreshes access tokens automatically if expired.
 */
async function isAuthenticated(req, res, next) {
  const session = req.session;
  if (session && session.isLoggedIn && session.eve && session.eve.accessToken) {
    const eveSess = session.eve;
    // If token expired, attempt refresh
    if (Date.now() >= eveSess.expiresAt) {
      logger.info('[authMiddleware] Access token expired, attempting refresh');
      try {
        const params = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: eveSess.refreshToken
        });
        const tokenRes = await axios.post(
          EVE_SSO_TOKEN_URL,
          params.toString(),
          {
            headers: {
              Authorization: `Basic ${Buffer.from(`${EVE_CLIENT_ID}:${EVE_SECRET_KEY}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              Host: 'login.eveonline.com'
            }
          }
        );
        const { access_token, refresh_token, expires_in } = tokenRes.data;
        // Update session tokens and expiry
        eveSess.accessToken = access_token;
        eveSess.refreshToken = refresh_token;
        eveSess.expiresAt = Date.now() + expires_in * 1000;
        session.eve = eveSess;
        logger.info('[authMiddleware] Token refresh successful');
      } catch (err) {
        logger.error(`[authMiddleware] Token refresh failed: ${err.response?.data || err.message}`);
        // Destroy session and require fresh login
        req.session.destroy(() => {});
        return res.status(401).json({ message: 'Session expired. Please log in again.' });
      }
    }
    // User is authenticated and token is valid
    logger.debug('[authMiddleware] Authentication validated');
    return next();
  }
  // No valid session
  logger.warn('[authMiddleware] Unauthorized access attempt');
  return res.status(401).json({ message: 'Unauthorized: Please log in.' });
}

module.exports = { isAuthenticated };
