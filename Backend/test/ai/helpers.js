const path = require('path');
const { toProductRecord, toCustomerRecord } = require('../../ai/matcher');

const fixtures = path.join(__dirname, 'fixtures');
const rawCatalog = require(path.join(fixtures, 'catalog.json'));
const { cases } = require(path.join(fixtures, 'commands.json'));

function loadCatalog() {
  return {
    products: rawCatalog.products.map(toProductRecord),
    customers: rawCatalog.customers.map(toCustomerRecord),
  };
}

// Recorded replies leave out null/empty fields; fill them to the full LLM shape.
function fullReply(partial) {
  return {
    intent: 'unknown',
    customer: null,
    items: [],
    discount: null,
    payment: null,
    due_in_days: null,
    notes: null,
    clarification_needed: null,
    ...partial,
  };
}

module.exports = { loadCatalog, fullReply, cases, rawCatalog };
