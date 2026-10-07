// Role gate for AI intents. The role comes from the verified token
// (see auth/verifyToken.js), never from which screen sent the request.
const ROLE_INTENTS = {
  owner: new Set([
    'create_invoice', 'add_item', 'remove_item', 'update_qty',
    'set_customer', 'apply_discount', 'record_payment', 'query', 'unknown',
  ]),
};

const ROLE_CONTEXTS = {
  owner: new Set(['invoice']),
};


function canUseContext(role, context) {
  return ROLE_CONTEXTS[role]?.has(context) || false;
}

function canRunIntent(role, intent) {
  return ROLE_INTENTS[role]?.has(intent) || false;
}

// Managing saved aliases (listing/removing) is owner-only; saving one while
// correcting a draft is allowed wherever drafts are allowed.
function canManageAliases(role) {
  return role === 'owner';
}

module.exports = { canUseContext, canRunIntent, canManageAliases };
