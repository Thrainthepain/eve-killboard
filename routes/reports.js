// routes/reports.js
// Handles report listing, generation, validation, and persistence

const express = require('express');
const Joi = require('joi');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');
const reportService = require('../services/reportProcessorService');
const Report = require('../models/report');

// Validation schema for report generation request
const generateSchema = Joi.object({
  dataSourceType: Joi.string().valid(
    'sso_recent_killmail',
    'sso_zkb_url',
    'manual_zkb_url',
    'manual_details'
  ).required(),
  ssoReferenceId: Joi.number()
    .when('dataSourceType', { is: 'sso_recent_killmail', then: Joi.required() }),
  zkbUrl: Joi.string().uri()
    .when('dataSourceType', { is: Joi.valid('sso_zkb_url', 'manual_zkb_url'), then: Joi.required() }),
  manualSystem: Joi.string()
    .when('dataSourceType', { is: 'manual_details', then: Joi.required() }),
  manualDate: Joi.date().iso()
    .when('dataSourceType', { is: 'manual_details', then: Joi.required() }),
  manualTime: Joi.string().pattern(/^\d{2}:\d{2}$/)
    .when('dataSourceType', { is: 'manual_details', then: Joi.required() }),
  attackers: Joi.array().items(Joi.object({
    ship_type: Joi.string().required(),
    value: Joi.number().min(0).required(),
    pilot_name: Joi.string().required()
  })).when('dataSourceType', { is: 'manual_details', then: Joi.required() }),
  defenders: Joi.array().items(Joi.object({
    ship_type: Joi.string().required(),
    value: Joi.number().min(0).required(),
    pilot_name: Joi.string().required()
  })).when('dataSourceType', { is: 'manual_details', then: Joi.required() }),
  events: Joi.array().items(Joi.string())
});

// GET /api/reports/public
router.get('/public', async (req, res) => {
  try {
    const reports = await Report.find()
      .sort({ createdAt: -1 })
      .select('reportTitle battleTime systemName createdBy createdAt')
      .lean();
    res.json(reports);
  } catch (err) {
    console.error('[reports] Error fetching public reports:', err);
    res.status(500).json({ message: 'Failed to fetch public reports.' });
  }
});

// POST /api/reports/generate
router.post('/generate', async (req, res) => {
  // Validate input
  const { error, value: params } = generateSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map(d => d.message);
    return res.status(400).json({ message: 'Validation error', details: messages });
  }

  try {
    let reportData;
    let createdBy = null;

    switch (params.dataSourceType) {
      case 'sso_recent_killmail':
        await isAuthenticated(req, res, () => {});
        reportData = await reportService.generateSSOReport(params, req.session.eve);
        createdBy = req.session.eve.character.id;
        break;

      case 'sso_zkb_url':
      case 'manual_zkb_url':
      case 'manual_details':
        reportData = await reportService.generatePublicReport(params);
        createdBy = req.session?.eve?.character?.id || null;
        break;

      default:
        return res.status(400).json({ message: 'Invalid dataSourceType.' });
    }

    // Persist to MongoDB
    const reportDoc = new Report({ ...reportData, createdBy });
    await reportDoc.save();

    res.json(reportDoc);
  } catch (err) {
    console.error('[reports] Error generating/saving report:', err);
    res.status(500).json({ message: 'Report generation failed.' });
  }
});

module.exports = router;
