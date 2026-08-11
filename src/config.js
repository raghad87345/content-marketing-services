'use strict';

require('dotenv').config();

const path = require('path');

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && isProduction) {
  throw new Error('JWT_SECRET must be set in production. Generate one with: openssl rand -hex 32');
}

module.exports = {
  env: NODE_ENV,
  isProduction,
  isTest: NODE_ENV === 'test',
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${Number(process.env.PORT || 3000)}`,
  jwt: {
    secret: jwtSecret || 'mohtawa-development-secret-do-not-use-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  seedDemoData: process.env.SEED_DEMO_DATA !== 'false',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  trustProxy: process.env.TRUST_PROXY || (isProduction ? 1 : false),
  ai: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-5',
    // Requests are short; keep effort low so the studio stays snappy.
    effort: process.env.ANTHROPIC_EFFORT || 'low',
    get enabled() {
      return Boolean(this.apiKey);
    },
  },
  upload: {
    maxVideoBytes: Number(process.env.MAX_VIDEO_BYTES || 200 * 1024 * 1024),
  },
};
