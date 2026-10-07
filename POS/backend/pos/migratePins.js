// Plans moving plain-text cashier PINs out of settings/app into hashed
// cashierSecrets. Pure: the script does the reads and writes.
const { normalizeCashierId } = require('./cashiers');
const { isValidPin } = require('./pins');

/**
 * @param list cashiers from settings/app (may contain `pin`)
 * @param secrets map cashierId -> existing cashierSecrets data
 */
function planPinMigration(list, secrets = {}) {
  const plan = { toHash: [], alreadyHashed: [], noPin: [], invalidPin: [], cleanedList: [] };
  for (const c of Array.isArray(list) ? list : []) {
    const id = normalizeCashierId(c.cashierId);
    const { pin, ...rest } = c;
    plan.cleanedList.push(rest);
    const hasHash = Boolean(secrets[id]?.pinHash);
    if (hasHash) plan.alreadyHashed.push(id);
    else if (pin && isValidPin(pin)) plan.toHash.push({ cashierId: id, pin: String(pin) });
    else if (pin) plan.invalidPin.push(id);
    else plan.noPin.push(id);
  }
  plan.listHasPins = (Array.isArray(list) ? list : []).some((c) => 'pin' in c);
  return plan;
}

module.exports = { planPinMigration };
