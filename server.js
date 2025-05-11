// server.js
// EVE Online Smart Report Generator - Backend with Convict, MongoDB, Sentry, Rate Limiting, and Security Hardening
// ---------------------------------------------------------

// 1. Sentry Initialization (must come first)
const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.2
});

// 2. Configuration via Convict
const convict = require('convict');
const config = convict({
  server: {
    port:       { doc: 'Port to bind.', format: 'port', default: 5000, env: 'PORT' },
    sessionSecret: { doc: 'Session secret.', format: String, default: 'dev-secret', env: 'SESSION_SECRET' },
    frontendUrl:   { doc: 'Frontend URL (CORS).', format: 'url', default: 'http://localhost:3000', env: 'FRONTEND_URL' }
  },
  eve: {
    clientId:    { doc: 'EVE Client ID.', format: String, default: null, env: 'EVE_CLIENT_ID' },
    secretKey:   { doc: 'EVE Secret Key.', format: String, default: null, env: 'EVE_SECRET_KEY', sensitive: true },
    callbackUrl: { doc: 'EVE OAuth Callback URL.', format: 'url', default: null, env: 'EVE_CALLBACK_URL' }
  }
});
config.loadFile('./config/default.json');
config.loadFile('./config/custom-environment-variables.json');
config.validate({ allowed: 'strict' });

// 3. Express App Setup
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Swagger API Documentation
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'EVE Report Generator API',
    version: '1.0.0',
    description: 'Auto-generated API docs for the EVE Online Report Generator backend'
  },
  servers: [
    { url: `http://localhost:${config.get('server.port')}`, description: 'Local server' }
  ]
};
const swaggerOptions = {
  swaggerDefinition,
  apis: ['./routes/*.js'] // JSDoc‑annotated route files
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// 4. Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/eve_reports';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log(`Connected to MongoDB at ${MONGO_URI}`))
  .catch(err => { console.error('MongoDB connection error:', err); process.exit(1); });

const app = express();

// 5. Enforce HTTPS in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// 6. Sentry Handlers (request + tracing)
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// 7. Security Middleware
app.use(helmet());
app.use(cors({ origin: config.get('server.frontendUrl'), credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 7a. Session Store using Redis
const Redis = require('ioredis');
const RedisStore = require('connect-redis')(session);
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

app.use(session({
  store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
  secret: config.get('server.sessionSecret'),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax', maxAge: 24*60*60*1000 }
}));

// 8. Rate Limiting
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, message: 'Too many requests, please try again later.' });
app.use('/api/', apiLimiter);
// Stricter limiter for report generation
const reportLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: 'Too many reports generated, slow down.' });
app.use('/api/reports/generate', reportLimiter);

// 9. Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const reportsRoutes = require('./routes/reports');
app.use('/auth/eve', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/reports', reportsRoutes);

// 10. Enhanced Health Check
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const sentryState = Sentry.getCurrentHub().getClient() ? 'initialized' : 'unconfigured';
  res.json({ status: 'OK', db: dbState, sentry: sentryState });
});

// 11. Sentry Error Handler
app.use(Sentry.Handlers.errorHandler());

// 12. Fallback Error Handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
});

// 13. Start Server
const PORT = config.get('server.port');
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log('Frontend URL:', config.get('server.frontendUrl'));
  console.log('EVE Callback URL:', config.get('eve.callbackUrl'));
});
