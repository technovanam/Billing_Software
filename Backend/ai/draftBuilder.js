// Applies a parsed command to the current draft. Prices and HSN codes always
// come from the catalogue (re-read on every command), never from the client or
// the LLM. Money is integer paise. GST and totals are left to the existing
// invoice / POS calculation on the frontend.
const crypto = require('crypto');
const Fuse = require('fuse.js');
const { matchProduct, matchCustomer, normalizeText, normalizeUnit, convertQty } = require('./matcher');
const { lineTotalPaise } = require('./money');

const MAX_ITEMS = 100;

function productView(p) {
  return { id: p.id, name: p.name, brand: p.brand, unit: p.unit, unitLabel: p.unitLabel, hsn: p.hsn, pricePaise: p.pricePaise };
}

function candidateView({ product, score }) {
  return { ...productView(product), score };
}

function withLineTotal(item) {
  const total = item.status === 'matched' && item.product && item.qty !== null ? lineTotalPaise(item.product.pricePaise, item.qty) : null;
  return { ...item, lineTotalPaise: total };
}

function emptyDraft() {
  return { customer: null, items: [], dueInDays: null, payment: null, notes: null };
}

// Rebuild the client's draft against the live catalogue so nothing the client
// sends (prices, names) is trusted.
function hydrateDraft(raw, catalog) {
  const draft = emptyDraft();
  if (!raw || typeof raw !== 'object') return draft;
  const byId = new Map(catalog.products.map((p) => [p.id, p]));
  const customersById = new Map(catalog.customers.map((c) => [c.id, c]));

  draft.items = (Array.isArray(raw.items) ? raw.items : []).slice(0, MAX_ITEMS).map((it) => {
    const product = it?.product?.id ? byId.get(it.product.id) : null;
    const candidates = (Array.isArray(it?.candidates) ? it.candidates : [])
      .map((c) => (c?.id && byId.get(c.id) ? { product: byId.get(c.id), score: Number(c.score) || 0 } : null))
      .filter(Boolean);
    const qty = Number.isFinite(Number(it?.qty)) && it?.qty !== null ? Number(it.qty) : null;
    let status = it?.status === 'matched' ? 'matched' : it?.status === 'ambiguous' ? 'ambiguous' : 'unmatched';
    if (status === 'matched' && !product) status = candidates.length ? 'ambiguous' : 'unmatched';
    return withLineTotal({
      key: typeof it?.key === 'string' ? it.key.slice(0, 64) : crypto.randomUUID(),
      spokenName: String(it?.spokenName || product?.name || '').slice(0, 120),
      spokenUnit: normalizeUnit(it?.spokenUnit),
      qty,
      status,
      source: it?.source || 'draft',
      product: status === 'matched' ? productView(product) : null,
      candidates: candidates.map(candidateView),
      ...(it?.learned && status === 'matched'
        ? { learned: { reason: String(it.learned.reason || ''), label: String(it.learned.label || '').slice(0, 80), count: Number(it.learned.count) || 0 } }
        : {}),
      ...(it?.uncertain ? { uncertain: true } : {}),
    });
  });

  const c = raw.customer;
  if (c && typeof c === 'object') {
    const known = c.id ? customersById.get(c.id) : null;
    draft.customer = known
      ? { spokenName: c.spokenName || known.name, status: 'matched', id: known.id, name: known.name, candidates: [] }
      : { spokenName: String(c.spokenName || c.name || '').slice(0, 120), status: c.status === 'new' ? 'new' : 'unmatched', id: null, name: String(c.name || c.spokenName || '').slice(0, 120), candidates: [] };
    if (c.uncertain) draft.customer.uncertain = true;
  }
  draft.dueInDays = Number.isInteger(raw.dueInDays) ? raw.dueInDays : null;
  draft.payment = raw.payment && typeof raw.payment === 'object' ? { mode: raw.payment.mode || null, amountPaise: Number.isInteger(raw.payment.amountPaise) ? raw.payment.amountPaise : null } : null;
  draft.notes = typeof raw.notes === 'string' ? raw.notes.slice(0, 500) : null;
  return draft;
}

// ctx: { threshold, ranking, customerId, customerName, draftProductIds, uncertain }
function buildItem(spoken, catalog, ctx = {}) {
  const spokenUnit = normalizeUnit(spoken.unit);
  const { ranking, customerId } = ctx;
  const rank = ranking
    ? (p) => ranking.productBonus(p.id, { customerId, draftProductIds: ctx.draftProductIds || [], spokenName: spoken.spoken_name })
    : null;
  let result = matchProduct(spoken.spoken_name, spokenUnit, catalog.products, { threshold: ctx.threshold, rank });
  let learned = null;

  // A customer's clear favourite resolves an ambiguous name (>= 3 buys in 90 days, >= 70% share, still active).
  if (result.status === 'ambiguous' && ranking && customerId) {
    const usual = ranking.usualFor(result.candidates.map((c) => c.product), customerId);
    const pick = usual && result.candidates.find((c) => c.product.id === usual.productId);
    if (pick) {
      result = { ...result, status: 'matched', source: 'learned', best: pick };
      learned = { reason: 'usual_for_customer', label: `Usual for ${ctx.customerName || 'this customer'}`, count: usual.count };
    }
  }

  const product = result.best?.product || null;
  const qty = product ? convertQty(spoken.qty, spokenUnit, product.unit) : spoken.qty;
  const item = {
    key: crypto.randomUUID(),
    spokenName: spoken.spoken_name,
    spokenUnit,
    qty,
    status: result.status,
    source: result.source,
    product: product ? productView(product) : null,
    candidates: result.candidates.map(candidateView),
  };
  if (learned) item.learned = learned;
  if (ctx.uncertain) item.uncertain = true;
  return withLineTotal(item);
}

// Find the draft line a follow-up command refers to ("remove nails").
function findDraftItem(spokenName, items) {
  const query = normalizeText(spokenName);
  if (!query || !items.length) return { index: -1, ambiguous: false };
  const labels = items.map((it) => [it.product?.name, it.spokenName, it.product ? `${it.product.brand} ${it.product.name}` : ''].map(normalizeText).filter(Boolean));

  const exact = labels.map((l, i) => (l.includes(query) ? i : -1)).filter((i) => i >= 0);
  if (exact.length === 1) return { index: exact[0], ambiguous: false };
  if (exact.length > 1) return { index: -1, ambiguous: true };

  const contains = labels.map((l, i) => (l.some((x) => x.includes(query) || query.includes(x)) ? i : -1)).filter((i) => i >= 0);
  if (contains.length === 1) return { index: contains[0], ambiguous: false };
  if (contains.length > 1) return { index: -1, ambiguous: true };

  const fuse = new Fuse(labels.map((l, i) => ({ i, l })), { keys: ['l'], includeScore: true, threshold: 0.35, ignoreLocation: true });
  const hits = fuse.search(query);
  if (hits.length === 1 || (hits.length > 1 && hits[1].score - hits[0].score >= 0.1)) return { index: hits[0].item.i, ambiguous: false };
  return { index: -1, ambiguous: hits.length > 1 };
}

// Returns the key of the line that now holds the item.
function addOrMerge(draft, item) {
  if (item.status === 'matched') {
    const existing = draft.items.findIndex((it) => it.status === 'matched' && it.product?.id === item.product.id);
    if (existing >= 0) {
      const merged = draft.items[existing];
      draft.items[existing] = withLineTotal({ ...merged, qty: (merged.qty || 0) + (item.qty || 0), ...(item.uncertain ? { uncertain: true } : {}) });
      return merged.key;
    }
  }
  if (draft.items.length < MAX_ITEMS) {
    draft.items.push(item);
    return item.key;
  }
  return null;
}

function setCustomer(draft, spokenCustomer, catalog, context, threshold, ranking, uncertain) {
  const rank = ranking ? (c) => ranking.customerBonus(c.id) : null;
  const result = matchCustomer(spokenCustomer.name, catalog.customers, { threshold, rank });
  setCustomerFromResult(draft, spokenCustomer, result, context);
  if (uncertain && draft.customer) draft.customer.uncertain = true;
}

function setCustomerFromResult(draft, spokenCustomer, result, context) {
  if (result.status === 'matched') {
    const c = result.best.customer;
    draft.customer = { spokenName: spokenCustomer.name, status: 'matched', id: c.id, name: c.name, candidates: [] };
    return;
  }
  const candidates = result.candidates.map(({ customer, score }) => ({ id: customer.id, name: customer.name, score }));
  if (result.status === 'ambiguous') {
    draft.customer = { spokenName: spokenCustomer.name, status: 'ambiguous', id: null, name: spokenCustomer.name, candidates };
    return;
  }
  // POS bills can go to a walk-in name; invoices need an existing client.
  draft.customer = {
    spokenName: spokenCustomer.name,
    status: context === 'pos' ? 'new' : 'unmatched',
    id: null,
    name: spokenCustomer.name,
    candidates,
  };
}

function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * @returns {{ draft, intent, messages: string[], clarification: string|null }}
 */
function applyCommand(parsed, rawDraft, catalog, { context, threshold, ranking = null, itemMeta = [], customerUncertain = false } = {}) {
  const draft = hydrateDraft(rawDraft, catalog);
  const messages = [];
  // Which draft line each parsed item ended up in (for aiLogs and the training export).
  const createdItemKeys = parsed.items.map(() => null);
  const itemCtx = (index) => ({
    threshold,
    ranking,
    customerId: draft.customer?.status === 'matched' ? draft.customer.id : null,
    customerName: draft.customer?.name || null,
    draftProductIds: draft.items.filter((it) => it.product).map((it) => it.product.id),
    uncertain: Boolean(itemMeta[index]?.uncertain),
  });
  let intent = parsed.intent;
  if (context === 'pos' && intent === 'create_invoice') intent = 'create_pos_bill';
  if (context === 'invoice' && intent === 'create_pos_bill') intent = 'create_invoice';

  if (parsed.clarification_needed) {
    return { draft, intent, messages, clarification: parsed.clarification_needed, createdItemKeys };
  }

  const needQty = [];
  const addItems = (items) => {
    items.forEach((spoken, index) => {
      if (spoken.qty === null || spoken.qty === undefined || !(spoken.qty > 0)) {
        needQty.push(spoken.spoken_name);
        return;
      }
      createdItemKeys[index] = addOrMerge(draft, buildItem(spoken, catalog, itemCtx(index)));
    });
  };

  switch (intent) {
    case 'create_invoice':
    case 'create_pos_bill':
    case 'add_item':
      // A new bill command adds to whatever is already in the draft; the user
      // clears the draft explicitly, so a stray command never wipes a bill.
      if (parsed.customer?.name) setCustomer(draft, parsed.customer, catalog, context, threshold, ranking, customerUncertain);
      addItems(parsed.items);
      break;

    case 'remove_item': {
      const missing = [];
      for (const spoken of parsed.items) {
        const { index, ambiguous } = findDraftItem(spoken.spoken_name, draft.items);
        if (ambiguous) return { draft, intent, messages, clarification: `Which "${spoken.spoken_name}" should I remove?`, createdItemKeys };
        if (index < 0) missing.push(spoken.spoken_name);
        else draft.items.splice(index, 1);
      }
      if (missing.length) messages.push(`${listNames(missing)} ${missing.length > 1 ? 'are' : 'is'} not on the bill.`);
      break;
    }

    case 'update_qty':
      for (const [n, spoken] of parsed.items.entries()) {
        if (spoken.qty === null || spoken.qty === undefined || !(spoken.qty > 0)) {
          needQty.push(spoken.spoken_name);
          continue;
        }
        const { index, ambiguous } = findDraftItem(spoken.spoken_name, draft.items);
        if (ambiguous) return { draft, intent, messages, clarification: `Which "${spoken.spoken_name}" should I change?`, createdItemKeys };
        if (index < 0) {
          createdItemKeys[n] = addOrMerge(draft, buildItem(spoken, catalog, itemCtx(n)));
          continue;
        }
        const line = draft.items[index];
        const unit = normalizeUnit(spoken.unit);
        const qty = line.product ? convertQty(spoken.qty, unit, line.product.unit) : spoken.qty;
        draft.items[index] = withLineTotal({ ...line, qty, spokenUnit: unit || line.spokenUnit, ...(itemMeta[n]?.uncertain ? { uncertain: true } : {}) });
        createdItemKeys[n] = line.key;
      }
      break;

    case 'set_customer':
      if (parsed.customer?.name) setCustomer(draft, parsed.customer, catalog, context, threshold, ranking, customerUncertain);
      else return { draft, intent, messages, clarification: 'What is the customer name?', createdItemKeys };
      break;

    case 'apply_discount':
      messages.push('Discounts are not supported on bills yet, so no discount was added.');
      break;

    case 'record_payment':
      if (context === 'pos' && parsed.payment?.mode) {
        draft.payment = { mode: parsed.payment.mode, amountPaise: null };
      } else {
        messages.push('Recording payments against an invoice by command is not available yet. Use the Payments page.');
      }
      break;

    case 'query':
      messages.push('Business questions are answered in the AI Assistant. This bar only builds bills.');
      break;

    default:
      return {
        draft,
        intent,
        messages,
        clarification: 'Sorry, I did not understand that. Try something like "Ravi Traders ku 10 bag cement, 5 kg nails".',
        createdItemKeys,
      };
  }

  // Details that ride along with a bill command.
  if (['create_invoice', 'create_pos_bill', 'add_item'].includes(intent)) {
    if (context === 'invoice' && Number.isInteger(parsed.due_in_days) && parsed.due_in_days >= 0) draft.dueInDays = parsed.due_in_days;
    if (context === 'pos' && parsed.payment?.mode) draft.payment = { mode: parsed.payment.mode, amountPaise: null };
    if (parsed.discount) messages.push('Discounts are not supported on bills yet, so no discount was added.');
    if (parsed.notes) draft.notes = parsed.notes.slice(0, 500);
  }

  const clarification = needQty.length ? `How many ${listNames(needQty)}?` : null;
  return { draft, intent, messages, clarification, createdItemKeys };
}

module.exports = { applyCommand, hydrateDraft, findDraftItem, emptyDraft };
