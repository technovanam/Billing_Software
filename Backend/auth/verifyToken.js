// One place that turns an Authorization header into a verified identity.
// Every protected route uses this; there is no unverified fallback.
const admin = require('firebase-admin');

class AuthError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// The website has one role: the business owner. Cashier tokens and "wh."
// warehouse accounts belong to the separate POS app (same Firebase project).
function roleOf(decoded) {
  if (decoded.role === 'cashier') return 'cashier';
  if (String(decoded.email || '').toLowerCase().startsWith('wh.')) return 'warehouse';
  return 'owner';
}

/**
 * @returns {Promise<{ uid, email, role, businessUid, claims }>}
 */
async function verifyAuthHeader(header, { auth = admin.auth() } = {}) {
  const value = String(header || '');
  const token = value.replace(/^Bearer\s+/i, '');
  if (!token || token === value) throw new AuthError(401, 'Sign in required.', 'NO_TOKEN');

  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch (err) {
    const revoked = err?.code === 'auth/id-token-revoked' || err?.code === 'auth/user-disabled';
    throw new AuthError(401, revoked ? 'Your session was ended. Please sign in again.' : 'Your session has expired. Please sign in again.', revoked ? 'REVOKED' : 'INVALID_TOKEN');
  }

  const role = roleOf(decoded);
  if (role !== 'owner') throw new AuthError(403, 'POS cashier and warehouse accounts cannot use the billing website. Use the POS app.', 'POS_ACCOUNT');

  return {
    uid: decoded.uid,
    email: decoded.email || '',
    role,
    businessUid: decoded.uid,
    claims: decoded,
  };
}

// Express middleware. Options: roles (allowed roles), property (req field to set).
function requireAuth({ roles = null, property = 'identity', auth } = {}) {
  return async (req, res, next) => {
    try {
      const identity = await verifyAuthHeader(req.headers.authorization, { auth: auth || admin.auth() });
      if (roles && !roles.includes(identity.role)) {
        return res.status(403).json({ error: 'Your role is not allowed to do this.' });
      }
      req[property] = identity;
      return next();
    } catch (err) {
      if (err instanceof AuthError) return res.status(err.status).json({ error: err.message, code: err.code });
      return next(err);
    }
  };
}

module.exports = { verifyAuthHeader, requireAuth, roleOf, AuthError };
