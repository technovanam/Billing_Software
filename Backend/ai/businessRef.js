// The only place the backend knows where a business's data lives.
// Business data is at users/{uid} today; moving to businesses/{businessId}
// later means changing this file only. `db` is injectable for tests.
const admin = require('firebase-admin');

function getBusinessRef(businessId, db = admin.firestore()) {
  if (!businessId) throw new Error('businessId is required');
  return db.collection('users').doc(businessId);
}

const sub = (name) => (businessId, db) => getBusinessRef(businessId, db).collection(name);

const businessCollections = {
  products: sub('products'),
  customers: sub('customers'),
  invoices: sub('invoices'),
  aiLogs: sub('aiLogs'),
  settings: sub('settings'),
  cashierSecrets: sub('cashierSecrets'),
  securityLogs: sub('securityLogs'),
  terminals: sub('terminals'),
  posShifts: sub('posShifts'),
  posShiftLocks: sub('posShiftLocks'),
};

module.exports = { getBusinessRef, businessCollections };
