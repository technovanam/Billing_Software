// Local-first command handling shared by the API route, the tests and the eval
// script: try the rule-based parser; if it is not confident enough, ask the
// configured fallback model; if that is off or fails, return the local result
// with its uncertain parts marked for the user to check.
const { parseLocal } = require('./localParser');
const { ParsedCommandSchema } = require('./schema');
const { applyCommand, hydrateDraft } = require('./draftBuilder');

const DEFAULT_LOCAL_CONFIDENCE = 0.85;
const UNMATCHED_ITEM_CAP = 0.7; // a name that matches no product may be a bad parse

function localThreshold(env = process.env) {
  const v = Number(env.AI_LOCAL_CONFIDENCE);
  return v > 0 && v <= 1 ? v : DEFAULT_LOCAL_CONFIDENCE;
}

// Lowers item confidence when the parsed name matched nothing in the catalogue.
function catalogAwareConfidence(confidence, parsed, result) {
  const itemConfs = parsed.items.map((_, i) => {
    const base = confidence.items[i] ?? 1;
    const key = result.createdItemKeys[i];
    const line = key ? result.draft.items.find((it) => it.key === key) : null;
    return line && line.status === 'unmatched' ? Math.min(base, UNMATCHED_ITEM_CAP) : base;
  });
  const values = [confidence.intent, confidence.customer, confidence.payment, confidence.due, confidence.discount, ...itemConfs].filter(
    (v) => typeof v === 'number'
  );
  return { ...confidence, items: itemConfs, overall: values.length ? Math.min(...values) : 0 };
}

function uncertainParts(confidence, threshold) {
  const unsureIntent = confidence.intent < threshold; // then every item from this command is suspect
  return {
    itemMeta: confidence.items.map((c) => ({ uncertain: unsureIntent || c < threshold })),
    customerUncertain: typeof confidence.customer === 'number' && confidence.customer < threshold,
  };
}

/**
 * @returns {Promise<{ path, parsed, result, localConfidence, usage, provider, model, fallbackError, lowConfidence }>}
 */
async function runCommand({ text, context, currentDraft, catalog, ranking = null, fallback = null, fallbackError = null, threshold = DEFAULT_LOCAL_CONFIDENCE, matchThreshold }) {
  const draftItemNames = hydrateDraft(currentDraft, catalog).items.map((it) => it.product?.name || it.spokenName).filter(Boolean);
  const opts = { context, threshold: matchThreshold, ranking };

  const local = parseLocal({ text, context, draftItemNames });
  const localResult = applyCommand(local.parsed, currentDraft, catalog, opts);
  const localConfidence = catalogAwareConfidence(local.confidence, local.parsed, localResult);

  if (localConfidence.overall >= threshold) {
    return { path: 'local', parsed: local.parsed, result: localResult, localConfidence, draftItemNames, usage: null, provider: null, model: null, fallbackError: null, lowConfidence: false };
  }

  if (fallback) {
    try {
      const reply = await fallback.parseCommand({ text, context, draftItemNames });
      const checked = ParsedCommandSchema.safeParse(reply.parsed);
      if (!checked.success) throw Object.assign(new Error('Fallback reply failed validation.'), { code: 'AI_BAD_OUTPUT' });
      const result = applyCommand(checked.data, currentDraft, catalog, opts);
      return { path: fallback.name, parsed: checked.data, result, localConfidence, draftItemNames, usage: reply.usage || null, provider: fallback.name, model: fallback.model, fallbackError: null, lowConfidence: false };
    } catch (err) {
      fallbackError = err.code || 'AI_ERROR';
    }
  }

  // No fallback (or it failed): keep the local result, flag the unsure parts.
  const marked = applyCommand(local.parsed, currentDraft, catalog, { ...opts, ...uncertainParts(localConfidence, threshold) });
  if (!marked.clarification) {
    marked.messages = [...marked.messages, 'I was not fully sure about this command. Please check the items marked "Please check" before confirming.'];
  }
  return { path: 'local', parsed: local.parsed, result: marked, localConfidence, draftItemNames, usage: null, provider: fallback?.name || null, model: fallback?.model || null, fallbackError, lowConfidence: true };
}

module.exports = { runCommand, localThreshold, DEFAULT_LOCAL_CONFIDENCE };
