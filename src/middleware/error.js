'use strict';

const path = require('path');
const { validationResult } = require('express-validator');
const config = require('../config');
const { ApiError } = require('../lib/errors');

/** Turns express-validator output into a single 400 with field-level details. */
function handleValidation(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array().map((error) => ({
    field: error.path || error.param,
    message: error.msg,
  }));
  next(new ApiError(400, details[0].message, { code: 'validation_error', details }));
}

function notFound(req, res, next) {
  if (req.path.startsWith('/api')) {
    return next(new ApiError(404, `المسار ${req.method} ${req.path} غير موجود.`));
  }
  // Anything else is a client-side route: hand back the app shell.
  const shell = req.path.startsWith('/app')
    ? 'app.html'
    : 'index.html';
  return res.sendFile(path.join(__dirname, '..', '..', 'public', shell));
}

// Express identifies error handlers by arity, so the unused `_next` must stay.
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }
  const body = {
    error: {
      code: err.code || 'server_error',
      message:
        status >= 500 && config.isProduction
          ? 'حدث خطأ غير متوقع. حاول مرة أخرى.'
          : err.message || 'Internal server error',
    },
  };
  if (err.details) body.error.details = err.details;
  if (!config.isProduction && status >= 500) body.error.stack = err.stack;
  res.status(status).json(body);
}

module.exports = { handleValidation, notFound, errorHandler };
