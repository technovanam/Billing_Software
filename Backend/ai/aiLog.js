// Audit trail for AI actions, stored at {business}/aiLogs. Only the backend writes here.
const admin = require('firebase-admin');
const { businessCollections } = require('./businessRef');

const MAX_CORRECTIONS = 100;

function summarizeDraft(draft) {
  const count = (status) => draft.items.filter((it) => it.status === status).length;
  return {
    matched: count('matched'),
    ambiguous: count('ambiguous'),
    unmatched: count('unmatched'),
    customerStatus: draft.customer?.status || null,
  };
}

async function logCommand({ businessId, user, role, context, sessionId, text, inputMode, parsed, intent, draft, clarification, messages, usage, provider, model, latencyMs, error, path, localConfidence, lowConfidence, fallbackError, draftItemNames, itemKeys }) {
  const ref = await businessCollections.aiLogs(businessId).add({
    type: 'command',
    businessId,
    userId: user.uid,
    userEmail: user.email || null,
    role,
    context,
    sessionId: sessionId || null,
    inputMode: inputMode || 'text',
    transcript: text,
    parsed: parsed || null,
    intent: intent || null,
    result: draft ? summarizeDraft(draft) : null,
    clarification: clarification || null,
    messages: messages || [],
    corrections: [],
    finalInvoiceId: null,
    status: error ? 'error' : 'parsed',
    error: error || null,
    path: path || null, // local | anthropic | ollama
    localConfidence: localConfidence || null,
    lowConfidence: Boolean(lowConfidence),
    fallbackError: fallbackError || null,
    draftItemNames: draftItemNames || [],
    itemKeys: itemKeys || [], // draft line key for each parsed item (null if not added)
    finalDraft: null,
    provider: provider || null,
    model: model || null,
    usage: usage || null,
    latencyMs: latencyMs ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function logAliasEvent({ businessId, user, role, action, source, productId, productName, alias, commandLogId, customerId }) {
  await businessCollections.aiLogs(businessId).add({
    type: { removed: 'alias_removed', pick: 'pick_signal' }[action] || 'alias_saved',
    businessId,
    userId: user.uid,
    userEmail: user.email || null,
    role,
    source,
    productId,
    productName: productName || null,
    alias,
    spokenName: alias,
    customerId: customerId || null,
    commandLogId: commandLogId || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// Records what the user changed in the preview and the invoice that was saved.
async function updateCommandLogs({ businessId, userId, logIds, corrections, finalInvoiceId, status, finalDraft }) {
  const col = businessCollections.aiLogs(businessId);
  const snaps = await Promise.all(logIds.map((id) => col.doc(id).get()));
  const batch = admin.firestore().batch();
  let updated = 0;
  snaps.forEach((snap, i) => {
    const data = snap.exists ? snap.data() : null;
    if (!data || data.type !== 'command' || data.userId !== userId) return;
    const patch = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (status) patch.status = status;
    if (finalInvoiceId) patch.finalInvoiceId = finalInvoiceId;
    // Corrections belong to the latest command in the session (the last id sent).
    if (corrections?.length && i === logIds.length - 1) patch.corrections = corrections.slice(0, MAX_CORRECTIONS);
    if (finalDraft && i === logIds.length - 1) patch.finalDraft = finalDraft;
    batch.update(snap.ref, patch);
    updated += 1;
  });
  if (updated) await batch.commit();
  return updated;
}

module.exports = { logCommand, logAliasEvent, updateCommandLogs };
