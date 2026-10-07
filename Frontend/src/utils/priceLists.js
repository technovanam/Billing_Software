// Price lists (Tally "price levels"): a customer on a list gets its rate for an
// item, or the list's discount on the standard price when no rate is set.
const num = (v) => {
  const x = Number.parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(x) ? x : 0;
};

export function priceListFor(client, lists = []) {
  const name = client?.priceList;
  return name ? lists.find((l) => l.name === name) || null : null;
}

export function priceFor(product, list) {
  const base = num(product?.price);
  if (!list) return base;
  const special = list.rates?.[product?.id];
  if (special !== undefined && special !== "" && special !== null) return num(special);
  const d = Math.min(100, Math.max(0, num(list.discountPct)));
  return Math.round(base * (100 - d)) / 100;
}
