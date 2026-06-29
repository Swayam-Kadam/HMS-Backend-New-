const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../utils/tokens');

const fetchuser = (req, res, next) => {
  const token =
    req.header('auth-token') ||
    req.header('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).send({ error: 'plz authenticate using a valid token ' });
  }

  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data.user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).send({ error: 'token_expired' });
    }
    return res.status(401).send({ error: 'plz authenticate using a valid token' });
  }
};

module.exports = fetchuser;
