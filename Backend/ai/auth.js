// AI routes use the shared, strict token check. The role comes from the token:
// cashiers have custom claims from /api/pos/cashier-login, warehouse accounts
// use a "wh." email, everyone else signed in with email/password is the owner.
const { requireAuth } = require('../auth/verifyToken');

// `auth` is injectable for tests; defaults to Firebase Admin.
const createRequireVerifiedUser = (auth) => requireAuth({ property: 'aiUser', auth });
const requireVerifiedUser = createRequireVerifiedUser();

module.exports = { requireVerifiedUser, createRequireVerifiedUser };
