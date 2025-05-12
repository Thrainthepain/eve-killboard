// Add this to your server.js or routes/index.js

/**
 * Health check endpoint for Docker and monitoring
 */
app.get('/health', (req, res) => {
  // Check connections to MongoDB and Redis
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  // Check Redis connection
  let redisStatus = 'disconnected';
  if (typeof redisClient.connected !== 'undefined') {
    redisStatus = redisClient.connected ? 'connected' : 'disconnected';
  } else if (redisClient.status === 'ready') {
    redisStatus = 'connected';
  }
  
  const status = {
    status: 'ok',
    timestamp: new Date(),
    service: 'eve-report-generator',
    version: process.env.npm_package_version || '1.0.0',
    mongodb: mongoStatus,
    redis: redisStatus
  };
  
  // Return appropriate status code
  if (mongoStatus === 'connected' && redisStatus === 'connected') {
    return res.status(200).json(status);
  }
  
  return res.status(503).json({
    ...status,
    status: 'error',
    message: 'Service degraded - check dependencies'
  });
});