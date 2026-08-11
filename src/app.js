'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { PLANS } = require('./lib/plans');
const { notFound, errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/auth.routes');
const brandRoutes = require('./routes/brands.routes');
const trendRoutes = require('./routes/trends.routes');
const studioRoutes = require('./routes/studio.routes');
const contentRoutes = require('./routes/content.routes');
const calendarRoutes = require('./routes/calendar.routes');
const videoRoutes = require('./routes/video.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const billingRoutes = require('./routes/billing.routes');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function createApp() {
  const app = express();

  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // Inline styles are used for chart bars and progress widths.
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          mediaSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );
  app.use(compression());
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
  if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      max: config.isTest ? 10000 : 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: 'rate_limited', message: 'طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة.' } },
    })
  );

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'mohtawa',
      version: require('../package.json').version,
      env: config.env,
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  });

  /** Everything the browser needs before the user signs in. */
  app.get('/api/config', (_req, res) => {
    res.json({
      appName: 'MOHTAWA',
      aiEnabled: config.ai.enabled,
      plans: PLANS,
      maxVideoBytes: config.upload.maxVideoBytes,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/brands', brandRoutes);
  app.use('/api/trends', trendRoutes);
  app.use('/api/studio', studioRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/video', videoRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/billing', billingRoutes);

  app.use(
    express.static(PUBLIC_DIR, {
      maxAge: config.isProduction ? '7d' : 0,
      setHeaders(res, filePath) {
        // HTML must never be cached hard, or users get a stale shell after deploys.
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    })
  );
  app.get('/app', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'app.html')));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, PUBLIC_DIR };
