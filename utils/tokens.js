const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'swayamisagoodb$oy';
const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const JWT_REFRESH_EXPIRES_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10);

function signAccessToken(userId) {
  return jwt.sign({ user: { id: userId } }, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES });
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getRefreshExpiryDate() {
  const date = new Date();
  date.setDate(date.getDate() + JWT_REFRESH_EXPIRES_DAYS);
  return date;
}

module.exports = {
  JWT_SECRET,
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  getRefreshExpiryDate,
};
