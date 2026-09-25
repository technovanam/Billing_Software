// Matches spoken product and customer names against the business's own records.
// Order: exact name, saved alias, then fuzzy (Fuse.js). The LLM is never involved here.
const Fuse = require('fuse.js');
const { rupeesToPaise } = require('./money');

const DEFAULT_THRESHOLD = 0.75; // minimum confidence for an automatic fuzzy match
const MIN_LEAD = 0.1; // top fuzzy candidate must beat the runner-up by this much
const MAX_CANDIDATES = 3;

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const UNIT_ALIASES = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  g: 'gram', gm: 'gram', gms: 'gram', gram: 'gram', grams: 'gram',
  l: 'litre', ltr: 'litre', litre: 'litre', litres: 'litre', liter: 'litre', liters: 'litre',
  ml: 'ml',
  pc: 'piece', pcs: 'piece', piece: 'piece', pieces: 'piece', nos: 'piece', no: 'piece', unit: 'piece', units: 'piece',
  dozen: 'dozen', dz: 'dozen',
  bag: 'bag', bags: 'bag', box: 'box', boxes: 'box', packet: 'packet', packets: 'packet', pkt: 'packet',
  bottle: 'bottle', bottles: 'bottle', meter: 'metre', metre: 'metre', meters: 'metre', metres: 'metre', m: 'metre',
};

function normalizeUnit(unit) {
  if (!unit) return null;
  return UNIT_ALIASES[normalizeText(unit)] || normalizeText(unit) || null;
}

const UNIT_GROUP = {
  kg: 'weight', gram: 'weight',
  litre: 'volume', ml: 'volume',
  piece: 'count', dozen: 'count', bag: 'count', box: 'count', packet: 'count', bottle: 'count',
  metre: 'length',
};

// Convert a spoken quantity into the product's own unit when that is unambiguous.
const TO_BASE = { kg: 1000, gram: 1, litre: 1000, ml: 1, dozen: 12, piece: 1 };
function convertQty(qty, fromUnit, toUnit) {
  if (qty === null || qty === undefined) return qty;
  if (!fromUnit || !toUnit || fromUnit === toUnit) return qty;
  if (UNIT_GROUP[fromUnit] !== UNIT_GROUP[toUnit]) return qty;
  if (!(fromUnit in TO_BASE) || !(toUnit in TO_BASE)) return qty;
  return Math.round(((qty * TO_BASE[fromUnit]) / TO_BASE[toUnit]) * 1000) / 1000;
}

function unitAdjustment(spokenUnit, productUnit) {
  if (!spokenUnit || !productUnit) return 0;
  if (spokenUnit === productUnit) return 0.05;
  const a = UNIT_GROUP[spokenUnit];
  const b = UNIT_GROUP[productUnit];
  if (a && b && a !== b) return -0.1;
  return 0;
}

// Compact, matcher-friendly view of a product document.
function toProductRecord(doc) {
  return {
    id: doc.id,
    name: doc.name || '',
    brand: doc.brand || '',
    unit: normalizeUnit(doc.unit),
    unitLabel: doc.unit || '',
    hsn: doc.hsn || doc.hsnCode || '',
    pricePaise: rupeesToPaise(doc.price ?? doc.rate),
    aliases: Array.isArray(doc.aliases) ? doc.aliases.map(normalizeText).filter(Boolean) : [],
    inactive: isInactive(doc),
  };
}

// No product has an "active" flag today (deletes remove the document), so a
// product counts as active unless one of these markers says otherwise.
function isInactive(doc) {
  return doc.active === false || doc.isActive === false || /^(inactive|discontinued|archived)$/i.test(String(doc.status || ''));
}

function customerDisplayName(doc) {
  const personal = [doc.firstName, doc.lastName].filter(Boolean).join(' ');
  return doc.name || doc.companyName || doc.company || doc.displayName || personal || '';
}

function toCustomerRecord(doc) {
  const personal = [doc.firstName, doc.lastName].filter(Boolean).join(' ');
  const names = [doc.name, doc.companyName, doc.company, doc.displayName, personal]
    .map(normalizeText)
    .filter(Boolean);
  return {
    id: doc.id,
    name: customerDisplayName(doc),
    names: [...new Set(names)],
    aliases: Array.isArray(doc.aliases) ? doc.aliases.map(normalizeText).filter(Boolean) : [],
  };
}

const productIndexCache = new WeakMap();
const customerIndexCache = new WeakMap();

function productIndex(products) {
  if (!productIndexCache.has(products)) {
    const docs = products.map((p) => ({
      ...p,
      nameN: normalizeText(p.name),
      fullN: normalizeText(`${p.brand} ${p.name}`),
      brandN: normalizeText(p.brand),
    }));
    productIndexCache.set(
      products,
      new Fuse(docs, {
        keys: [
          { name: 'nameN', weight: 0.6 },
          { name: 'fullN', weight: 0.25 },
          { name: 'aliases', weight: 0.1 },
          { name: 'brandN', weight: 0.05 },
        ],
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.5,
      })
    );
  }
  return productIndexCache.get(products);
}

function customerIndex(customers) {
  if (!customerIndexCache.has(customers)) {
    customerIndexCache.set(
      customers,
      new Fuse(customers, {
        keys: [
          { name: 'names', weight: 0.8 },
          { name: 'aliases', weight: 0.2 },
        ],
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.4,
      })
    );
  }
  return customerIndexCache.get(customers);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

const MIN_CANDIDATE_SCORE = 0.4; // weaker fuzzy hits are noise, not useful choices

function tokens(value) {
  return normalizeText(value).split(' ').filter((t) => t.length >= 2);
}

// Word-overlap score for spoken names that skip or reorder words
// ("Gold Winner oil" vs "Gold Winner Sunflower Oil"). Mostly rewards covering
// every spoken word, slightly rewards covering the record's words too.
function tokenScore(queryTokens, recordTokenLists) {
  if (!queryTokens.length) return 0;
  let best = 0;
  for (const recordTokens of recordTokenLists) {
    if (!recordTokens.length) continue;
    const set = new Set(recordTokens);
    const hits = queryTokens.filter((t) => set.has(t)).length;
    if (!hits) continue;
    const score = 0.85 * (hits / queryTokens.length) + 0.15 * (hits / set.size);
    if (score > best) best = score;
  }
  return best;
}

// Merge Fuse hits with word-overlap hits, keeping the higher score per record.
function mergeFuzzy(fuseHits, allRecords, queryTokens, recordTokens, idOf) {
  const scores = new Map();
  for (const { record, score } of fuseHits) scores.set(idOf(record), { record, score });
  for (const record of allRecords) {
    const score = tokenScore(queryTokens, recordTokens(record));
    const current = scores.get(idOf(record));
    if (score > 0 && (!current || score > current.score)) scores.set(idOf(record), { record, score });
  }
  return [...scores.values()].filter((s) => s.score >= MIN_CANDIDATE_SCORE).sort((a, b) => b.score - a.score);
}

// Shared decision: one exact/alias hit is a match, several are ambiguous,
// otherwise use fuzzy candidates with a confidence threshold.
function decide({ exact, alias, fuzzy, threshold }) {
  if (exact.length === 1) return { status: 'matched', source: 'exact', best: exact[0], candidates: [exact[0]] };
  if (exact.length > 1) return { status: 'ambiguous', source: 'exact', best: null, candidates: exact.slice(0, MAX_CANDIDATES) };
  if (alias.length === 1) return { status: 'matched', source: 'alias', best: alias[0], candidates: [alias[0]] };
  if (alias.length > 1) return { status: 'ambiguous', source: 'alias', best: null, candidates: alias.slice(0, MAX_CANDIDATES) };

  const top = fuzzy.slice(0, MAX_CANDIDATES);
  if (!top.length) return { status: 'unmatched', source: 'none', best: null, candidates: [] };
  const [first, second] = top;
  const clearWinner = first.score >= threshold && (!second || first.score - second.score >= MIN_LEAD);
  if (clearWinner) return { status: 'matched', source: 'fuzzy', best: first, candidates: top };
  return { status: 'ambiguous', source: 'fuzzy', best: null, candidates: top };
}

// Reorders candidates by match score plus an optional learning bonus. The
// matched/ambiguous decision above is made on match scores alone.
function applyRanking(result, bonusOf) {
  if (!bonusOf || result.candidates.length < 2) return result;
  const ranked = result.candidates
    .map((c) => ({ ...c, rank: round2(c.score + bonusOf(c)) }))
    .sort((a, b) => b.rank - a.rank);
  return { ...result, candidates: ranked };
}

function matchProduct(spokenName, spokenUnit, products, { threshold = DEFAULT_THRESHOLD, rank = null } = {}) {
  const query = normalizeText(spokenName);
  const unit = normalizeUnit(spokenUnit);
  if (!query) return { status: 'unmatched', source: 'none', best: null, candidates: [] };

  const withScore = (p, score) => ({ product: p, score: round2(Math.max(0, Math.min(1, score))) });

  const exact = products
    .filter((p) => normalizeText(p.name) === query || normalizeText(`${p.brand} ${p.name}`) === query)
    .map((p) => withScore(p, 1));
  const alias = products.filter((p) => p.aliases.includes(query)).map((p) => withScore(p, 1));

  const byId = new Map(products.map((p) => [p.id, p]));
  const fuzzy = mergeFuzzy(
    productIndex(products).search(query).map((r) => ({ record: byId.get(r.item.id), score: 1 - r.score })),
    products,
    tokens(query),
    (p) => [tokens(`${p.brand} ${p.name}`), ...p.aliases.map(tokens)],
    (p) => p.id
  ).map(({ record, score }) => withScore(record, score + unitAdjustment(unit, record.unit)))
    .filter((c) => c.score >= MIN_CANDIDATE_SCORE)
    .sort((a, b) => b.score - a.score);

  return applyRanking(decide({ exact, alias, fuzzy, threshold }), rank && ((c) => rank(c.product)));
}

function matchCustomer(spokenName, customers, { threshold = DEFAULT_THRESHOLD, rank = null } = {}) {
  const query = normalizeText(spokenName);
  if (!query) return { status: 'unmatched', source: 'none', best: null, candidates: [] };

  const withScore = (c, score) => ({ customer: c, score: round2(Math.max(0, Math.min(1, score))) });
  const exact = customers.filter((c) => c.names.includes(query)).map((c) => withScore(c, 1));
  const alias = customers.filter((c) => c.aliases.includes(query)).map((c) => withScore(c, 1));
  const fuzzy = mergeFuzzy(
    customerIndex(customers).search(query).map((r) => ({ record: r.item, score: 1 - r.score })),
    customers,
    tokens(query),
    (c) => [...c.names, ...c.aliases].map(tokens),
    (c) => c.id
  ).map(({ record, score }) => withScore(record, score));

  return applyRanking(decide({ exact, alias, fuzzy, threshold }), rank && ((c) => rank(c.customer)));
}

module.exports = {
  normalizeText,
  normalizeUnit,
  convertQty,
  toProductRecord,
  toCustomerRecord,
  matchProduct,
  matchCustomer,
  DEFAULT_THRESHOLD,
};
