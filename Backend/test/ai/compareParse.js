// Compares a parse with the expected one on the fields that matter for billing.
const { normalizeText, normalizeUnit } = require('../../ai/matcher');

const coerce = (intent, context) => (context === 'pos' && intent === 'create_invoice' ? 'create_pos_bill' : intent);
const itemKey = (it) => `${normalizeText(it.spoken_name)}|${it.qty ?? '-'}|${normalizeUnit(it.unit) ?? '-'}`;

function compareParse(expected, got, context) {
  const problems = [];
  if (coerce(expected.intent, context) !== coerce(got.intent, context)) problems.push(`intent ${got.intent} (want ${expected.intent})`);
  if (normalizeText(expected.customer?.name) !== normalizeText(got.customer?.name)) {
    problems.push(`customer "${got.customer?.name ?? ''}" (want "${expected.customer?.name ?? ''}")`);
  }
  const want = (expected.items || []).map(itemKey).sort();
  const have = (got.items || []).map(itemKey).sort();
  if (JSON.stringify(want) !== JSON.stringify(have)) problems.push(`items [${have.join('; ')}] (want [${want.join('; ')}])`);
  if ((expected.due_in_days ?? null) !== (got.due_in_days ?? null)) problems.push(`due_in_days ${got.due_in_days} (want ${expected.due_in_days})`);
  if ((expected.payment?.mode ?? null) !== (got.payment?.mode ?? null)) problems.push(`payment ${got.payment?.mode} (want ${expected.payment?.mode})`);
  if ((expected.payment?.amount ?? null) !== (got.payment?.amount ?? null)) problems.push(`amount ${got.payment?.amount} (want ${expected.payment?.amount})`);
  if (JSON.stringify(expected.discount ?? null) !== JSON.stringify(got.discount ?? null)) problems.push(`discount ${JSON.stringify(got.discount)}`);
  if ((expected.notes ?? null) !== (got.notes ?? null) && expected.notes !== undefined) problems.push(`notes ${got.notes}`);
  return problems;
}

module.exports = { compareParse };
