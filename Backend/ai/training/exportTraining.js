// Turns confirmed AI sessions from aiLogs into fine-tuning examples:
// input = the command (plus the bill's item names before it),
// output = the parse with the user's corrections applied.
// Customer names become <CUSTOMER>; phone numbers and GSTINs are removed.

const CONFIRMED = new Set(['confirmed', 'saved']);

const PHONE_RE = /(?:\+?91[\s-]?)?(?<!\d)[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;
const LONG_DIGITS_RE = /(?<!\d)\d{10,}(?!\d)/g;
const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/gi;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactText(text, customerNames = []) {
  let out = String(text || '');
  const names = [...new Set(customerNames.filter((n) => n && n.trim().length >= 2))].sort((a, b) => b.length - a.length);
  for (const name of names) {
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name.trim())}(?![\\p{L}\\p{N}])`, 'giu'), '<CUSTOMER>');
  }
  return out.replace(GSTIN_RE, '<GSTIN>').replace(PHONE_RE, '<PHONE>').replace(LONG_DIGITS_RE, '<PHONE>');
}

function millis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts._seconds === 'number') return ts._seconds * 1000;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

// Corrected output for one command, using the confirmed draft of its session.
function correctedOutput(log, finalDraft, customerNames) {
  const parsed = JSON.parse(JSON.stringify(log.parsed));
  const changedQty = new Set((log.corrections || []).filter((c) => c.type === 'change_qty' && c.itemKey).map((c) => c.itemKey));
  const lines = new Map((finalDraft?.items || []).map((l) => [l.key, l]));

  const items = [];
  (parsed.items || []).forEach((item, i) => {
    const key = (log.itemKeys || [])[i];
    const line = key ? lines.get(key) : null;
    if (key && finalDraft && !line) return; // the user removed it: the parse was wrong or unwanted
    const out = { ...item, spoken_name: redactText(item.spoken_name, customerNames) };
    if (line) {
      out.product_name = line.productName || null;
      if (changedQty.has(key) && line.qty !== null) {
        out.qty = line.qty;
        out.unit = null; // the corrected quantity is in the product's own unit
      }
    }
    items.push(out);
  });

  parsed.items = items;
  if (parsed.customer) parsed.customer = { name: '<CUSTOMER>', phone: null };
  if (parsed.notes) parsed.notes = redactText(parsed.notes, customerNames);
  if (parsed.clarification_needed) parsed.clarification_needed = redactText(parsed.clarification_needed, customerNames);
  return parsed;
}

function buildTrainingExamples(logs) {
  const sessions = new Map();
  for (const log of logs) {
    if (log.type !== 'command' || log.error || !log.parsed || !log.transcript) continue;
    const key = log.sessionId || `single:${log.id}`;
    if (!sessions.has(key)) sessions.set(key, []);
    sessions.get(key).push(log);
  }

  const examples = [];
  for (const group of sessions.values()) {
    if (!group.some((l) => CONFIRMED.has(l.status))) continue; // only drafts the user confirmed
    group.sort((a, b) => millis(a.createdAt) - millis(b.createdAt));
    const finalDraft = [...group].reverse().find((l) => l.finalDraft)?.finalDraft || null;
    const customerNames = [finalDraft?.customerName, ...group.map((l) => l.parsed?.customer?.name)].filter(Boolean);

    for (const log of group) {
      examples.push({
        input: redactText(log.transcript, customerNames),
        context: log.context,
        draft_items: (log.draftItemNames || []).map((n) => redactText(n, customerNames)),
        output: correctedOutput(log, finalDraft, customerNames),
      });
    }
  }
  return examples;
}

module.exports = { buildTrainingExamples, redactText };
