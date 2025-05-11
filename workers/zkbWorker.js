// workers/zkbWorker.js
// Background worker to fetch battle reports from zKillboard queue

const Queue = require('bull');
const axios = require('axios');
const mongoose = require('mongoose');
const Report = require('../models/report');
const reportProcessor = require('../services/reportProcessorService');

// Redis connection (inherit from REDIS_URL env)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const zkbQueue = new Queue('zkbQueue', redisUrl);

// Mongo connection
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/eve_reports';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

zkbQueue.process(async job => {
  const { zkbUrl } = job.data;
  console.log(`[zkbWorker] Processing ${zkbUrl}`);
  try {
    const raw = await axios.get(`${zkbUrl}?format=json`).then(res => res.data);
    const reportData = reportProcessor.generatePublicReport({ dataSourceType: 'manual_zkb_url', zkbUrl });

    const reportDoc = new Report({ ...reportData, createdBy: null });
    await reportDoc.save();
    console.log('[zkbWorker] Report saved');
  } catch (err) {
    console.error('[zkbWorker] Error:', err.message);
    throw err;
  }
});

console.log('zkbWorker started and waiting for jobs...');
