// The only place the AI backend knows where a business's data lives.
// Business data is at users/{uid} today; moving to businesses/{businessId}
// later means changing this file only.
const admin = require('firebase-admin');

function getBusinessRef(businessId) {
  if (!businessId) throw new Error('businessId is required');
  return admin.firestore().collection('users').doc(businessId);
}

const businessCollections = {
  products: (businessId) => getBusinessRef(businessId).collection('products'),
  customers: (businessId) => getBusinessRef(businessId).collection('customers'),
  invoices: (businessId) => getBusinessRef(businessId).collection('invoices'),
  aiLogs: (businessId) => getBusinessRef(businessId).collection('aiLogs'),
};

module.exports = { getBusinessRef, businessCollections };
