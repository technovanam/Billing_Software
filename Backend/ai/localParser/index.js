// Rule-based command parser. Produces the same shape as the LLM
// (see ../schema.js) plus confidence scores, with no network calls.
const L = require('./lexicon');
const { tokenize } = require('./tokenize');
const { numberize } = require('./numbers');
const { normalizeText } = require('../matcher');

const BILL_INTENT = { invoice: 'create_invoice' };

const isNum = (t) => t && t.kind === 'num';
const isSep = (t) => t && L.SEPARATORS.has(t.text);
const isUnit = (t, afterNum) => t && t.text in L.UNIT_WORDS && (afterNum || !L.SHORT_UNITS.has(t.text));
const joinRaw = (toks) => toks.map((t) => t.raw).join(' ').replace(/\s+/g, ' ').trim();

function emptyParse(intent) {
  return {
    intent,
    customer: null,
    items: [],
    discount: null,
    payment: null,
    due_in_days: null,
    notes: null,
    clarification_needed: null,
  };
}

function nameConfidence(tokens) {
  if (!tokens.length) return 0.3;
  if (tokens.length <= 4) return 0.95;
  if (tokens.length <= 6) return 0.8;
  return 0.6;
}

// ---- global extractions (mark tokens as used) -------------------------------

function takePayment(toks, used) {
  let mode = null;
  const mark = (i) => {
    used[i] = true;
    for (const d of [-2, -1, 1, 2]) {
      const t = toks[i + d];
      if (t && !used[i + d] && L.PAYMENT_FILLER.has(t.text)) used[i + d] = true;
    }
  };
  for (let i = 0; i < toks.length; i += 1) {
    if (used[i]) continue;
    const pair = L.PAYMENT_PAIRS.find(([words]) => words.every((w, k) => toks[i + k]?.text === w));
    if (pair) {
      mode = pair[1];
      pair[0].forEach((_, k) => mark(i + k));
      continue;
    }
    if (toks[i].text in L.PAYMENT_WORDS) {
      mode = L.PAYMENT_WORDS[toks[i].text];
      mark(i);
    }
  }
  return mode;
}

function takeDue(toks, used) {
  for (let i = 0; i < toks.length; i += 1) {
    // "15 days credit", "15 naal kadan", "15 din udhaar", "15 days"
    if (isNum(toks[i]) && L.DAY_WORDS.has(toks[i + 1]?.text)) {
      used[i] = true;
      used[i + 1] = true;
      if (L.CREDIT_WORDS.has(toks[i + 2]?.text)) used[i + 2] = true;
      if (L.CREDIT_WORDS.has(toks[i - 1]?.text)) used[i - 1] = true;
      return { days: Math.round(toks[i].value), conf: toks[i].conf };
    }
  }
  for (let i = 0; i < toks.length; i += 1) {
    if (L.CREDIT_WORDS.has(toks[i].text) && !L.PAYMENT_WORDS[toks[i + 1]?.text] && toks[i + 1]?.text !== 'card') {
      used[i] = true;
      return { days: null, credit: true, conf: 0.9 };
    }
  }
  return null;
}

function takeDiscount(toks, used) {
  for (let i = 0; i < toks.length; i += 1) {
    if (!L.DISCOUNT_WORDS.has(toks[i].text)) continue;
    // Look for "10 percent discount", "discount 10%", "50 rupees off", "10% off".
    for (let j = Math.max(0, i - 3); j <= Math.min(toks.length - 1, i + 3); j += 1) {
      if (!isNum(toks[j])) continue;
      const after = toks[j + 1]?.text;
      const before = toks[j - 1]?.text;
      let type = 'percent';
      if (L.RUPEE_WORDS.has(after) || L.RUPEE_WORDS.has(before)) type = 'amount';
      else if (!L.PERCENT_WORDS.has(after) && toks[i].text === 'off') type = 'amount';
      used[i] = true;
      used[j] = true;
      if (L.PERCENT_WORDS.has(after) || L.RUPEE_WORDS.has(after)) used[j + 1] = true;
      if (L.RUPEE_WORDS.has(before)) used[j - 1] = true;
      return { type, value: toks[j].value, conf: 0.95 };
    }
    used[i] = true;
    return { type: 'percent', value: 0, conf: 0.4 };
  }
  return null;
}

// Customer before a particle ("Ravi Traders ku"), after "for"/"to", or in a
// "customer name X" phrase. Returns { name, conf } and marks tokens.
function takeCustomer(toks, used) {
  const isNameTok = (t) => t && !isNum(t) && !isSep(t) && !isUnit(t) && !(t.text in L.PAYMENT_WORDS);

  // "X ku", "X ki", "X ke liye": name runs from the start up to the particle.
  for (let k = 1; k < toks.length; k += 1) {
    const single = L.CUSTOMER_SUFFIX.has(toks[k].text);
    const pair = L.CUSTOMER_SUFFIX_PAIRS.find(([a, b]) => toks[k].text === a && toks[k + 1]?.text === b);
    if (!single && !pair) continue;
    let start = k - 1;
    while (start >= 0 && !used[start] && isNameTok(toks[start]) && !L.GIVE_FILLER.has(toks[start].text) && k - start <= 6) start -= 1;
    start += 1;
    if (start >= k) continue;
    const nameToks = toks.slice(start, k);
    for (let i = start; i < k + (pair ? 2 : 1); i += 1) used[i] = true;
    return { name: joinRaw(nameToks), conf: nameToks.length <= 4 ? 0.95 : 0.8 };
  }

  // "for Selvam Stores", "to Kumar": name runs until a number, unit or separator.
  for (let k = 0; k < toks.length; k += 1) {
    if (used[k] || !L.CUSTOMER_PREFIX.has(toks[k].text)) continue;
    let end = k + 1;
    // Stop at "with"/"add": "for Test Customer add 10 cement" names the customer, then the items.
    while (end < toks.length && !used[end] && isNameTok(toks[end]) && !L.ITEM_LEAD_WORDS.has(toks[end].text) && !L.ADD_WORDS.has(toks[end].text) && end - k <= 6) end += 1;
    if (end === k + 1) continue;
    const nameToks = toks.slice(k + 1, end);
    for (let i = k; i < end; i += 1) used[i] = true;
    return { name: joinRaw(nameToks), conf: nameToks.length <= 4 ? 0.9 : 0.75 };
  }
  return null;
}

// ---- items -----------------------------------------------------------------

function splitClauses(toks, used) {
  const clauses = [];
  let current = [];
  toks.forEach((t, i) => {
    if (used[i] || isSep(t)) {
      if (current.length) clauses.push(current);
      current = [];
      return;
    }
    current.push(t);
  });
  if (current.length) clauses.push(current);
  return clauses;
}

function parseItemClause(clause) {
  const vague = clause.some((t) => L.VAGUE_QTY.has(t.text));
  const toks = clause.filter(
    (t) => isNum(t) || !(L.GIVE_FILLER.has(t.text) || L.DO_VERBS.has(t.text) || L.ADD_WORDS.has(t.text) || L.REMOVE_WORDS.has(t.text) || L.UPDATE_WORDS.has(t.text) || L.QTY_WORDS.has(t.text) || L.PRONOUNS.has(t.text))
  );
  while (toks.length && L.ITEM_LEAD_WORDS.has(toks[0].text)) toks.shift();
  if (!toks.length) return null;
  // "and 2 quantity": a bare number belongs to the item before it.
  if (toks.length === 1 && isNum(toks[0])) return { qtyOnly: toks[0].value, conf: toks[0].conf };

  // Pick the quantity: a number followed by a unit, else a number at either end.
  const numIdx = toks.map((t, i) => (isNum(t) ? i : -1)).filter((i) => i >= 0);
  let q = numIdx.find((i) => isUnit(toks[i + 1], true));
  if (q === undefined && numIdx.includes(0)) q = 0;
  if (q === undefined && numIdx.includes(toks.length - 1)) q = toks.length - 1;
  if (q === undefined && numIdx.length === 1 && isUnit(toks[numIdx[0] + 1], true)) q = numIdx[0];

  let unit = null;
  let unitIdx = -1;
  if (q !== undefined && isUnit(toks[q + 1], true)) {
    unitIdx = q + 1;
  } else {
    unitIdx = toks.findIndex((t, i) => i !== q && isUnit(t, false) && (i === toks.length - 1 || i === 0 || isNum(toks[i - 1])));
  }
  if (unitIdx >= 0) unit = L.UNIT_WORDS[toks[unitIdx].text];

  const nameToks = toks.filter((_, i) => i !== q && i !== unitIdx);
  if (!nameToks.length) return null;

  const qty = vague || q === undefined ? null : toks[q].value;
  const qtyConf = qty === null ? 0.9 : toks[q].conf;
  return {
    item: { spoken_name: joinRaw(nameToks), qty, unit },
    conf: qtyConf * nameConfidence(nameToks),
  };
}

function parseItems(toks, used) {
  const items = [];
  const confs = [];
  let orphanQty = null; // "add 10 more": a number with no item named
  for (const clause of splitClauses(toks, used)) {
    const parsed = parseItemClause(clause);
    if (!parsed) continue;
    if (parsed.qtyOnly !== undefined) {
      const prev = items[items.length - 1];
      if (prev && prev.qty === null) {
        prev.qty = parsed.qtyOnly;
        confs[confs.length - 1] = Math.min(confs[confs.length - 1] / 0.9, 1) * parsed.conf;
      } else if (!prev && orphanQty === null) {
        orphanQty = parsed.qtyOnly;
      }
      continue;
    }
    items.push(parsed.item);
    confs.push(parsed.conf);
  }
  return { items, confs, orphanQty };
}

// Follow-ups that name no item ("add 10 more", "remove", "make it 15") mean
// the item on the bill when there is only one; otherwise ask which.
function itemOnBill(draftItemNames, question) {
  if (draftItemNames.length === 1) return { name: draftItemNames[0] };
  if (!draftItemNames.length) return { ask: 'There are no items on the bill yet. Say the product name, e.g. "10 bag cement".' };
  return { ask: `${question}: ${draftItemNames.join(', ')}?` };
}

function askBack(intent, question) {
  const result = emptyParse(intent);
  result.clarification_needed = question;
  return finish(result, { intent: 0.95, customer: null, items: [], payment: null, due: null, discount: null });
}

// ---- main ------------------------------------------------------------------

function hasStructure(toks) {
  return toks.some(
    (t) =>
      isNum(t) ||
      isUnit(t) ||
      isSep(t) ||
      L.CUSTOMER_SUFFIX.has(t.text) ||
      L.CUSTOMER_PREFIX.has(t.text) ||
      t.text in L.PAYMENT_WORDS ||
      L.ADD_WORDS.has(t.text)
  );
}

function firstMeaningful(toks, used) {
  const i = toks.findIndex((t, idx) => !used[idx] && !isSep(t) && !['bill', 'please', 'pls'].includes(t.text));
  return i;
}

function draftHas(name, draftItemNames) {
  const n = normalizeText(name);
  return draftItemNames.some((d) => {
    const dn = normalizeText(d);
    return dn === n || dn.includes(n) || n.includes(dn);
  });
}

function finish(parsed, conf) {
  const values = [conf.intent, conf.customer, conf.payment, conf.due, conf.discount, ...conf.items].filter((v) => typeof v === 'number');
  return { parsed, confidence: { ...conf, overall: values.length ? Math.min(...values) : 0 } };
}

function parseLocal({ text, context = 'invoice', draftItemNames = [] }) {
  const lower = String(text || '').toLowerCase().replace(/’/g, "'");
  const toks = numberize(tokenize(text));
  const used = new Array(toks.length).fill(false);
  const conf = { intent: 0, customer: null, items: [], payment: null, due: null, discount: null };
  const billIntent = BILL_INTENT[context] || 'create_invoice';

  if (!toks.length) return finish({ ...emptyParse('unknown') }, { ...conf, intent: 0.1 });

  // Business questions and later-phase commands.
  if (L.QUERY_PATTERNS.some((re) => re.test(lower))) {
    return finish(emptyParse('query'), { ...conf, intent: 0.9 });
  }
  if (L.UNSUPPORTED_PATTERNS.some((re) => re.test(lower))) {
    const parsed = emptyParse('unknown');
    const customer = takeCustomer(toks, used);
    if (customer) parsed.customer = { name: customer.name, phone: null };
    return finish(parsed, { ...conf, intent: 0.9, customer: customer?.conf ?? null });
  }

  const parsed = emptyParse(billIntent);

  // "Ravi Traders paid 5000 by UPI", "received 5000 from Ravi Traders"
  const paidIdx = toks.findIndex((t) => ['paid', 'received', 'kuduthar', 'koduthaar', 'diya', 'diye', 'bheja'].includes(t.text));
  if (paidIdx >= 0) {
    const amountIdx = toks.findIndex((t, i) => isNum(t) && i > paidIdx - 3 && !L.UNIT_WORDS[toks[i + 1]?.text]);
    if (amountIdx >= 0) {
      const mode = takePayment(toks, used);
      used[paidIdx] = true;
      used[amountIdx] = true;
      if (L.RUPEE_WORDS.has(toks[amountIdx + 1]?.text)) used[amountIdx + 1] = true;
      if (L.RUPEE_WORDS.has(toks[amountIdx - 1]?.text)) used[amountIdx - 1] = true;
      const fromIdx = toks.findIndex((t, i) => !used[i] && t.text === 'from');
      if (fromIdx >= 0) used[fromIdx] = true;
      const nameToks = toks.filter((t, i) => !used[i] && !isSep(t) && !L.PAYMENT_FILLER.has(t.text));
      const result = emptyParse('record_payment');
      result.payment = { mode, amount: toks[amountIdx].value };
      if (nameToks.length) result.customer = { name: joinRaw(nameToks), phone: null };
      return finish(result, { ...conf, intent: 0.9, customer: nameToks.length ? nameConfidence(nameToks) : null, payment: 0.95 });
    }
  }

  const due = takeDue(toks, used);
  const mode = takePayment(toks, used);
  const discount = takeDiscount(toks, used);
  if (due?.days !== null && due?.days !== undefined) {
    parsed.due_in_days = due.days;
    conf.due = due.conf;
  } else if (due?.credit) {
    parsed.notes = 'On credit';
    conf.due = due.conf;
  }
  if (mode) {
    parsed.payment = { mode, amount: null };
    conf.payment = 0.95;
  }
  if (discount) {
    parsed.discount = { type: discount.type, value: discount.value };
    conf.discount = discount.conf;
  }

  // Drop an English lead-in: "create a new invoice", "make bill", "please generate invoice".
  // Only when it names an invoice/bill, so "make sugar 750 gram" stays an update.
  let leadEnd = 0;
  while (leadEnd < toks.length && L.COMMAND_WORDS.has(toks[leadEnd].text)) leadEnd += 1;
  if (toks.slice(0, leadEnd).some((t) => ['invoice', 'bill', 'billing'].includes(t.text))) {
    for (let i = 0; i < leadEnd; i += 1) used[i] = true;
  }

  const first = firstMeaningful(toks, used);
  const firstTok = first >= 0 ? toks[first] : null;
  const lastIdx = toks.map((t, i) => (!used[i] && !isSep(t) ? i : -1)).filter((i) => i >= 0).pop();
  const lastTok = lastIdx !== undefined ? toks[lastIdx] : null;

  // Customer change: "customer name Kumar", "change customer to Kumar", "customer ka naam Kumar".
  // Only when the word opens the command ("customer ...", "change customer ..."),
  // never inside a bill: "Test Customer ABC ku 3 bag cement" names a customer.
  const custWordIdx = toks.findIndex((t, i) => !used[i] && (t.text === 'customer' || t.text === 'client' || t.text === 'party' || t.text === 'ग्राहक'));
  const opensCommand = custWordIdx === first || (custWordIdx === (first ?? 0) + 1 && L.UPDATE_WORDS.has(toks[first]?.text));
  const looksLikeBill = toks.some((t, i) => !used[i] && (isNum(t) || L.CUSTOMER_SUFFIX.has(t.text)));
  if (custWordIdx >= 0 && opensCommand && !looksLikeBill) {
    for (let i = 0; i <= custWordIdx; i += 1) used[i] = true;
    const nameToks = toks.filter((t, i) => !used[i] && !isSep(t) && !L.CUSTOMER_WORDS.has(t.text) && !L.UPDATE_WORDS.has(t.text) && t.text !== 'to' && !L.DO_VERBS.has(t.text));
    const result = emptyParse('set_customer');
    if (nameToks.length) result.customer = { name: joinRaw(nameToks), phone: null };
    return finish(result, { ...conf, intent: 0.95, customer: nameToks.length ? nameConfidence(nameToks) : 0.3 });
  }

  // Removal: "remove nails", "nails vendam", "nails hatao".
  if ((firstTok && L.REMOVE_WORDS.has(firstTok.text)) || (lastTok && L.REMOVE_WORDS.has(lastTok.text))) {
    const { items, confs } = parseItems(toks, used);
    const result = emptyParse('remove_item');
    if (!items.length) {
      const target = itemOnBill(draftItemNames, 'Which item should I remove');
      if (target.ask) return askBack('remove_item', target.ask);
      result.items = [{ spoken_name: target.name, qty: null, unit: null }];
      return finish(result, { ...conf, intent: 0.95, items: [0.95] });
    }
    result.items = items.map((it) => ({ spoken_name: it.spoken_name, qty: null, unit: null }));
    return finish(result, { ...conf, intent: 0.95, items: confs });
  }

  // Quantity change: "make sugar 750 gram", "change cement to 12 bags",
  // or "cement 12 bags pannunga" when cement is already on the bill.
  const explicitUpdate = firstTok && L.UPDATE_WORDS.has(firstTok.text);
  const doVerb = toks.some((t, i) => !used[i] && L.DO_VERBS.has(t.text));
  if (explicitUpdate || doVerb) {
    if (explicitUpdate) used[first] = true;
    const toIdx = toks.findIndex((t, i) => !used[i] && t.text === 'to');
    if (toIdx >= 0) used[toIdx] = true;
    const { items, confs, orphanQty } = parseItems(toks, used);
    if (!items.length && orphanQty !== null && explicitUpdate) {
      const target = itemOnBill(draftItemNames, `Change which item to ${orphanQty}`);
      if (target.ask) return askBack('update_qty', target.ask);
      return finish({ ...parsed, intent: 'update_qty', items: [{ spoken_name: target.name, qty: orphanQty, unit: null }] }, { ...conf, intent: 0.95, items: [0.95] });
    }
    const allOnBill = items.length > 0 && items.every((it) => draftHas(it.spoken_name, draftItemNames));
    if (explicitUpdate || allOnBill) {
      const result = { ...parsed, intent: 'update_qty', items };
      return finish(result, { ...conf, intent: explicitUpdate ? 0.95 : 0.9, items: confs });
    }
    // Not on the bill yet: treat as adding it.
    const result = { ...parsed, items };
    return finish(result, { ...conf, intent: 0.9, items: confs });
  }

  // New bill or additions.
  const customer = takeCustomer(toks, used);
  if (customer) {
    parsed.customer = { name: customer.name, phone: null };
    conf.customer = customer.conf;
  }
  const addFirst = firstTok && L.ADD_WORDS.has(firstTok.text) && firstTok.text !== 'more';
  const { items, confs, orphanQty } = parseItems(toks, used);
  const saysMore = toks.some((t) => L.ADD_WORDS.has(t.text));
  if (!items.length && orphanQty !== null && saysMore && draftItemNames.length) {
    const target = itemOnBill(draftItemNames, `Add ${orphanQty} more of which item`);
    if (target.ask) return askBack('add_item', target.ask);
    return finish({ ...parsed, intent: 'add_item', items: [{ spoken_name: target.name, qty: orphanQty, unit: null }] }, { ...conf, intent: 0.95, items: [0.95] });
  }
  parsed.items = items;
  conf.items = confs;

  if (items.length) {
    parsed.intent = addFirst ? 'add_item' : billIntent;
    // With no number, unit, customer particle, separator or payment word the
    // "item" may just be noise ("asdf qwerty", "Kumar kar do").
    conf.intent = hasStructure(toks) || customer ? 0.9 : 0.5;
    return finish(parsed, conf);
  }
  // No items: a lone payment mode, discount, credit term or customer.
  if (parsed.discount) return finish({ ...parsed, intent: 'apply_discount' }, { ...conf, intent: 0.95 });
  if (parsed.payment) return finish({ ...parsed, intent: 'record_payment' }, { ...conf, intent: 0.95 });
  if (parsed.due_in_days !== null || parsed.notes) return finish({ ...parsed, intent: 'add_item' }, { ...conf, intent: 0.9 });
  if (parsed.customer) return finish({ ...parsed, intent: 'set_customer' }, { ...conf, intent: 0.85 });
  return finish(emptyParse('unknown'), { ...conf, intent: 0.2 });
}

module.exports = { parseLocal };
