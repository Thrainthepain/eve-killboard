// routes/user.js
// Handles user-specific data: profile and recent kill activity

const express = require('express');
const axios = require('axios');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');

// Base ESI endpoint
const ESI_BASE = 'https://esi.evetech.net/latest';

// GET /api/user/profile
// Returns character, corporation, and alliance names
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const accessToken = req.session.eve.accessToken;
    const character = req.session.eve.character;

    // Fetch affiliation (corp & alliance IDs)
    const affiliationResponse = await axios.post(
      `${ESI_BASE}/characters/affiliation/?datasource=tranquility`,
      [character.id],
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const { corporation_id, alliance_id } = affiliationResponse.data[0];

    // Fetch corporation name
    const corpResponse = await axios.get(
      `${ESI_BASE}/corporations/${corporation_id}/?datasource=tranquility`
    );
    const corporationName = corpResponse.data.name;

    // Fetch alliance name (if applicable)
    let allianceName = null;
    if (alliance_id) {
      const allianceResponse = await axios.get(
        `${ESI_BASE}/alliances/${alliance_id}/?datasource=tranquility`
      );
      allianceName = allianceResponse.data.name;
    }

    res.json({
      characterName: character.name,
      corporationName,
      allianceName
    });
  } catch (err) {
    console.error('Error fetching user profile:', err.response ? err.response.data : err.message);
    res.status(500).json({ message: 'Failed to fetch profile.' });
  }
});

// GET /api/user/kill-activity
// Returns recent killmail IDs the character was involved in
router.get('/kill-activity', isAuthenticated, async (req, res) => {
  try {
    const accessToken = req.session.eve.accessToken;
    const character = req.session.eve.character;

    const killResponse = await axios.get(
      `${ESI_BASE}/characters/${character.id}/killmails/recent/?datasource=tranquility`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    // killResponse.data is an array of { killmail_id, killmail_time, solar_system_id }
    res.json(killResponse.data);
  } catch (err) {
    console.error('Error fetching kill activity:', err.response ? err.response.data : err.message);
    res.status(500).json({ message: 'Failed to fetch kill activity.' });
  }
});

module.exports = router;
