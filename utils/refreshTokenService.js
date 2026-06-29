const crypto = require('crypto');
const RefreshToken = require('../models/refreshToken');
const {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  getRefreshExpiryDate,
} = require('../utils/tokens');

async function createRefreshTokenForUser(userId) {
  const refreshToken = generateRefreshToken();
  const familyId = crypto.randomUUID();

  await RefreshToken.create({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    familyId,
    expiresAt: getRefreshExpiryDate(),
  });

  return refreshToken;
}

async function revokeTokenFamily(familyId) {
  await RefreshToken.updateMany(
    { familyId, revokedAt: null },
    { revokedAt: new Date() }
  );
}

async function rotateRefreshToken(storedToken) {
  storedToken.revokedAt = new Date();
  await storedToken.save();

  const refreshToken = generateRefreshToken();
  await RefreshToken.create({
    userId: storedToken.userId,
    tokenHash: hashRefreshToken(refreshToken),
    familyId: storedToken.familyId,
    expiresAt: getRefreshExpiryDate(),
  });

  return refreshToken;
}

async function refreshTokens(refreshToken) {
  const tokenHash = hashRefreshToken(refreshToken);
  const storedToken = await RefreshToken.findOne({ tokenHash });

  if (!storedToken) {
    return { success: false, status: 401, error: 'Invalid refresh token' };
  }

  if (storedToken.revokedAt) {
    await revokeTokenFamily(storedToken.familyId);
    return { success: false, status: 401, error: 'Refresh token reuse detected' };
  }

  if (storedToken.expiresAt < new Date()) {
    return { success: false, status: 401, error: 'Refresh token expired' };
  }

  const newRefreshToken = await rotateRefreshToken(storedToken);
  const authtoken = signAccessToken(storedToken.userId);

  return { success: true, authtoken, refreshToken: newRefreshToken };
}

async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) {
    return;
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const storedToken = await RefreshToken.findOne({ tokenHash });

  if (storedToken) {
    await revokeTokenFamily(storedToken.familyId);
  }
}

module.exports = {
  createRefreshTokenForUser,
  refreshTokens,
  revokeRefreshToken,
};
