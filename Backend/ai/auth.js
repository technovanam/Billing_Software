// Strict Firebase ID token check for AI routes. Unlike the shared
// authenticateRequest in server.js, this never falls back to decoding an
// unverified token: an invalid or missing token is always a 401.
const admin = require('firebase-admin');

async function requireVerifiedUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token || token === header) return res.status(401).json({ error: 'Sign in required.' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.aiUser = { uid: decoded.uid, email: decoded.email || '' };
    return next();
  } catch (_) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

module.exports = { requireVerifiedUser };
