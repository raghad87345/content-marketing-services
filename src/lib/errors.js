'use strict';

class ApiError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || httpCode(status);
    if (details) this.details = details;
  }

  static badRequest(message, options) {
    return new ApiError(400, message, options);
  }

  static unauthorized(message = 'يلزم تسجيل الدخول للمتابعة.', options) {
    return new ApiError(401, message, options);
  }

  static forbidden(message = 'لا تملك صلاحية للوصول إلى هذا المورد.', options) {
    return new ApiError(403, message, options);
  }

  static notFound(message = 'العنصر غير موجود.', options) {
    return new ApiError(404, message, options);
  }

  static conflict(message, options) {
    return new ApiError(409, message, options);
  }

  static payloadTooLarge(message, options) {
    return new ApiError(413, message, options);
  }

  static quotaExceeded(message, options) {
    return new ApiError(429, message, { code: 'quota_exceeded', ...options });
  }
}

function httpCode(status) {
  return (
    {
      400: 'bad_request',
      401: 'unauthorized',
      403: 'forbidden',
      404: 'not_found',
      409: 'conflict',
      413: 'payload_too_large',
      429: 'rate_limited',
    }[status] || 'server_error'
  );
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ApiError, asyncHandler };
