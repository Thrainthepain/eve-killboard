// routes/auth.js
// Handles EVE Online SSO: login, callback, logout

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const router = express.Router();

// EVE SSO endpoints and credentials from environment (loaded via convict in server.js)
const EVE_CLIENT_ID = process.env.EVE_CLIENT_ID;
const EVE_SECRET_KEY = process.env.EVE_SECRET_KEY;
const EVE_CALLBACK_URL = process.env.EVE_CALLBACK_URL;
const EVE_SSO_AUTH_URL = 'https://login.eveonline.com/v2/oauth/authorize/';
const EVE_SSO_TOKEN_URL = 'https://login.eveonline.com/v2/oauth/token';
const ESI_VERIFY_URL = 'https://esi.evetech.net/verify/';

// Utility to generate random string for state CSRF protection
function generateState(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

// 1. Redirect user to EVE SSO login page
// GET /auth/eve/login
router.get('/login', (req, res) => {
  const state = generateState();
  req.session.oauthState = state; // save state in session for verification

  const scopes = [
    'publicData',
    'esi-characterstats.read.v1',
    'esi-killmails.read_killmails.v1',
    'esi-corporations.read_corporation_membership.v1'
    // add more scopes as needed
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: EVE_CALLBACK_URL,
    client_id: EVE_CLIENT_ID,
    scope: scopes,
    state: state
  });

  res.redirect(`${EVE_SSO_AUTH_URL}?${params.toString()}`);
});

// 2. Callback from EVE SSO
// GET /auth/eve/callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  // CSRF check
  if (!state || state !== req.session.oauthState) {
    return res.status(400).send('Invalid state parameter.');
  }
  delete req.session.oauthState;

  if (!code) {
    return res.status(400).send('Authorization code missing.');
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      EVE_SSO_TOKEN_URL,
      new URLSearchParams({ grant_type: 'authorization_code', code }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${EVE_CLIENT_ID}:${EVE_SECRET_KEY}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Host: 'login.eveonline.com'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Verify token and get character info
    const verifyResponse = await axios.get(ESI_VERIFY_URL, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const characterInfo = verifyResponse.data;

    // Store in session
    req.session.eve = {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
      character: {
        id: characterInfo.CharacterID,
        name: characterInfo.CharacterName
      }
    };
    req.session.isLoggedIn = true;

    // Redirect back to frontend
    return res.redirect(process.env.FRONTEND_URL || '/');
  } catch (err) {
    console.error('EVE SSO callback error:', err.response ? err.response.data : err.message);
    return res.status(500).send('Authentication failed.');
  }
});

// 3. Logout
// GET /auth/eve/logout
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Error logging out.');
    }
    res.clearCookie('connect.sid');
    res.send('Logged out successfully.');
  });
});

module.exports = router;
