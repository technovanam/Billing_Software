// Turns purchase statistics into small ranking bonuses and the "usual product
// for this customer" auto-match. Fuzzy/alias matching still decides whether a
// name matched; these only reorder candidates or resolve a clear favourite.
const { normalizeText } = require('../matcher');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEIGHTS = { popularity: 0.06, recency: 0.04, customer: 0.12, together: 0.05, picks: 0.08 };
const USUAL = { minCount: 3, minShare: 0.7, windowDays: 90 };

function daysSince(iso, now) {
  if (!iso) return Infinity;
  return (now.getTime() - new Date(iso).getTime()) / DAY_MS;
}

function createRanking({ stats, now = new Date() }) {
  if (!stats) return null;
  const maxProductBills = Math.max(1, ...Object.values(stats.products).map((p) => p.n));
  const maxCustomerBills = Math.max(1, ...Object.values(stats.customers).map((c) => c.n));

  function productBonus(productId, { customerId = null, draftProductIds = [], spokenName = null } = {}) {
    const p = stats.products[productId];
    let bonus = 0;
    if (p) {
      bonus += WEIGHTS.popularity * (Math.log1p(p.n) / Math.log1p(maxProductBills));
      bonus += WEIGHTS.recency * Math.exp(-daysSince(p.last, now) / 30);
    }
    const byCustomer = customerId ? stats.customerProducts[customerId] : null;
    if (byCustomer?.[productId]) {
      const total = Object.values(byCustomer).reduce((s, x) => s + x.n, 0);
      bonus += WEIGHTS.customer * (byCustomer[productId].n / total);
    }
    if (p && draftProductIds.length) {
      const together = draftProductIds.reduce((s, id) => s + (stats.pairs[productId]?.[id] || 0), 0);
      bonus += WEIGHTS.together * Math.min(1, together / p.n);
    }
    const picked = spokenName ? stats.picks[normalizeText(spokenName)] : null;
    if (picked?.[productId]) {
      const total = Object.values(picked).reduce((s, n) => s + n, 0);
      bonus += WEIGHTS.picks * (picked[productId] / total);
    }
    return bonus;
  }

  function customerBonus(customerId) {
    const c = stats.customers[customerId];
    if (!c) return 0;
    return 0.05 * (Math.log1p(c.n) / Math.log1p(maxCustomerBills)) + 0.03 * Math.exp(-daysSince(c.last, now) / 30);
  }

  // The customer's clear favourite among these candidates in the last 90 days:
  // bought at least 3 times and at least 70% of their purchases among them.
  function usualFor(candidates, customerId) {
    const byCustomer = customerId ? stats.customerProducts[customerId] : null;
    if (!byCustomer) return null;
    const counts = candidates
      .filter((c) => !c.inactive)
      .map((c) => ({ id: c.id, n: (byCustomer[c.id]?.recent || []).filter((iso) => daysSince(iso, now) <= USUAL.windowDays).length }));
    const total = counts.reduce((s, c) => s + c.n, 0);
    const best = counts.sort((a, b) => b.n - a.n)[0];
    if (!best || best.n < USUAL.minCount || best.n / total < USUAL.minShare) return null;
    return { productId: best.id, count: best.n };
  }

  return { productBonus, customerBonus, usualFor };
}

module.exports = { createRanking, USUAL, WEIGHTS };
