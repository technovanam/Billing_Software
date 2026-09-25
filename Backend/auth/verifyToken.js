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

function roleOf(decoded) {
  if (decoded.role === 'cashier' && decoded.businessUid && decoded.cashierId) return 'cashier';
  if (String(decoded.email || '').toLowerCase().startsWith('wh.')) return 'warehouse';
  return 'owner';
}

/**
 * @returns {Promise<{ uid, email, role, businessUid, cashierId, counter, deviceId, claims }>}
 */
async function verifyAuthHeader(header, { auth = admin.auth() } = {}) {
  const value = String(header || '');
  const token = value.replace(/^Bearer\s+/i, '');
  if (!token || token === value) throw new AuthError(401, 'Sign in required.', 'NO_TOKEN');

  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
    // Cashier sessions can be revoked (deactivation, PIN change, device removal):
    // check revocation for them on every request.
    if (decoded.role === 'cashier') decoded = await auth.verifyIdToken(token, true);
  } catch (err) {
    const revoked = err?.code === 'auth/id-token-revoked' || err?.code === 'auth/user-disabled';
    throw new AuthError(401, revoked ? 'Your session was ended. Please sign in again.' : 'Your session has expired. Please sign in again.', revoked ? 'REVOKED' : 'INVALID_TOKEN');
  }

  const role = roleOf(decoded);
  return {
    uid: decoded.uid,
    email: decoded.email || '',
    role,
    businessUid: role === 'cashier' ? decoded.businessUid : decoded.uid,
    cashierId: role === 'cashier' ? decoded.cashierId : null,
    counter: role === 'cashier' ? decoded.counter || null : null,
    deviceId: role === 'cashier' ? decoded.deviceId || null : null,
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
