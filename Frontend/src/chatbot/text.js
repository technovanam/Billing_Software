// Text helpers for the chatbot: normalising, fuzzy name matching and number
// extraction. Pure functions so they can be unit tested with `node --test`.

export const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// Words that never identify a customer or product on their own.
const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "from", "by", "in", "on", "at", "with", "me", "my", "i", "is", "are",
  "was", "how", "much", "many", "what", "whats", "show", "tell", "give", "list", "all", "this", "that", "last", "month",
  "week", "year", "today", "yesterday", "sales", "sale", "invoice", "invoices", "bill", "bills", "customer", "customers",
  "client", "clients", "product", "products", "price", "stock", "paid", "pay", "payment", "owe", "owes", "due", "balance",
  "pending", "total", "amount", "rs", "rupees", "inr", "add", "new", "create", "please", "about", "details", "info", "did",
  "does", "do", "has", "have", "buy", "bought", "sell", "sold", "company", "traders", "store", "stores", "shop",
]);

function bigrams(s) {
  const t = ` ${s} `;
  const out = new Map();
  for (let i = 0; i < t.length - 1; i += 1) {
    const g = t.slice(i, i + 2);
    out.set(g, (out.get(g) || 0) + 1);
  }
  return out;
}

// Dice coefficient on character bigrams: 1 = identical, 0 = nothing shared.
export function similarity(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const A = bigrams(x);
  const B = bigrams(y);
  let overlap = 0;
  let total = 0;
  A.forEach((n, g) => {
    overlap += Math.min(n, B.get(g) || 0);
    total += n;
  });
  B.forEach((n) => {
    total += n;
  });
  return (2 * overlap) / total;
}

/**
 * Finds which entity (customer, product) the text mentions.
 * Scores every word span of the text against each entity name, so
 * "how much does ravi owe" finds "Ravi Traders".
 * @returns {{ item, score, matched } | null}
 */
export function findEntityInText(text, items, getName, minScore = 0.72) {
  const words = normalize(text).split(" ").filter(Boolean);
  if (!words.length || !items?.length) return null;
  let best = null;
  for (const item of items) {
    const name = normalize(getName(item));
    if (!name) continue;
    const nameWords = name.split(" ").filter((w) => !STOP.has(w));
    const core = nameWords.join(" ") || name;
    const maxLen = Math.min(words.length, name.split(" ").length + 1);
    for (let len = 1; len <= maxLen; len += 1) {
      for (let i = 0; i + len <= words.length; i += 1) {
        const span = words.slice(i, i + len);
        if (span.every((w) => STOP.has(w))) continue;
        const phrase = span.join(" ");
        // Short spans must be a whole word of the name ("ravi" in "ravi traders").
        let score = Math.max(similarity(phrase, name), similarity(phrase, core));
        if (len === 1 && nameWords.includes(phrase) && phrase.length >= 3) score = Math.max(score, 0.8 + 0.2 / nameWords.length);
        if (score > (best?.score ?? 0)) best = { item, score, matched: phrase };
      }
    }
  }
  return best && best.score >= minScore ? best : null;
}

// All entities whose name matches about as well as the best one (for "which Ravi?").
export function rankEntities(text, items, getName, limit = 5) {
  return (items || [])
    .map((item) => ({ item, score: findEntityInText(text, [item], getName, 0)?.score || 0 }))
    .filter((r) => r.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, hundred: 100, thousand: 1000 };

// "5,000", "5k", "2.5 lakh", "₹1,200.50" -> numbers, in order of appearance.
export function extractAmounts(text) {
  const out = [];
  const re = /(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakh|lakhs|lac|l|cr|crore)?\b/gi;
  let m;
  while ((m = re.exec(String(text || "")))) {
    let n = Number(m[1].replace(/,/g, ""));
    const unit = (m[2] || "").toLowerCase();
    if (unit === "k" || unit === "thousand") n *= 1000;
    else if (["lakh", "lakhs", "lac", "l"].includes(unit)) n *= 100000;
    else if (unit === "cr" || unit === "crore") n *= 10000000;
    if (Number.isFinite(n)) out.push({ value: n, index: m.index, raw: m[0] });
  }
  return out;
}

export function wordNumber(word) {
  return WORD_NUMBERS[String(word || "").toLowerCase()] ?? null;
}

export const hasAny = (text, words) => {
  const t = ` ${normalize(text)} `;
  return words.some((w) => t.includes(` ${normalize(w)} `));
};

export const titleCase = (s) => String(s || "").replace(/\b\p{L}/gu, (c) => c.toUpperCase());
