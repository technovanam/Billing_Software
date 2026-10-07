// AI routes use the shared, strict token check. Only business owners get
// through (see auth/verifyToken.js).
const { requireAuth } = require('../auth/verifyToken');

// `auth` is injectable for tests; defaults to Firebase Admin.
const createRequireVerifiedUser = (auth) => requireAuth({ property: 'aiUser', auth });
const requireVerifiedUser = createRequireVerifiedUser();

module.exports = { requireVerifiedUser, createRequireVerifiedUser };
