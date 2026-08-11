'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db/store');
const { ApiError, asyncHandler } = require('../lib/errors');

const signToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

const publicUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
};

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    throw ApiError.unauthorized();
  }
  let payload;
  try {
    payload = jwt.verify(header.slice(7), config.jwt.secret);
  } catch {
    throw ApiError.unauthorized('انتهت صلاحية الجلسة. سجّل الدخول مرة أخرى.');
  }
  const user = db.users.findOne({ id: payload.sub });
  if (!user || user.isActive === false) {
    throw ApiError.unauthorized('الحساب غير موجود أو معطّل.');
  }
  req.user = user;
  next();
});

/**
 * Loads the brand named by `:brandId` / `?brandId` / `body.brandId`, or the
 * user's default brand, and asserts ownership.
 */
const withBrand = asyncHandler(async (req, _res, next) => {
  const brandId = req.params.brandId || req.query.brandId || req.body?.brandId;
  const brand = brandId
    ? db.brands.findOne({ id: brandId })
    : db.brands.find({ ownerId: req.user.id }, { sort: { createdAt: 'asc' }, limit: 1 })[0];

  if (!brand) {
    throw ApiError.notFound('لم نجد البراند المطلوب. أنشئ براند أولًا من الإعدادات.');
  }
  if (brand.ownerId !== req.user.id) {
    throw ApiError.forbidden();
  }
  req.brand = brand;
  next();
});

module.exports = { authenticate, withBrand, signToken, publicUser };
