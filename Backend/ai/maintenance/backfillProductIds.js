// Plans adding productId to saved invoice / POS lines that don't have one,
// when the line's name matches exactly one product. Pure: the script applies it.
const { normalizeText } = require('../matcher');

function productNameIndex(products) {
  const index = new Map();
  const add = (key, id) => {
    if (!key) return;
    if (!index.has(key)) index.set(key, new Set());
    index.get(key).add(id);
  };
  for (const p of products) {
    add(normalizeText(p.name), p.id);
    if (p.brand) add(normalizeText(`${p.brand} ${p.name}`), p.id);
  }
  return index;
}

function planBackfill({ invoices, products }) {
  const index = productNameIndex(products);
  const productIds = new Set(products.map((p) => p.id));
  const counts = { invoicesScanned: 0, invoicesToUpdate: 0, linesMatched: 0, linesAlreadyLinked: 0, skippedNoName: 0, skippedNoMatch: 0, skippedAmbiguous: 0 };
  const updates = [];

  for (const inv of invoices) {
    counts.invoicesScanned += 1;
    const field = Array.isArray(inv.items) ? 'items' : Array.isArray(inv.products) ? 'products' : null;
    if (!field) continue;
    let changed = false;
    const lines = inv[field].map((line) => {
      if (!line || typeof line !== 'object') return line;
      if (line.productId && productIds.has(line.productId)) {
        counts.linesAlreadyLinked += 1;
        return line;
      }
      const name = normalizeText(line.description || line.name);
      if (!name) {
        counts.skippedNoName += 1;
        return line;
      }
      const ids = index.get(name);
      if (!ids) {
        counts.skippedNoMatch += 1;
        return line;
      }
      if (ids.size > 1) {
        counts.skippedAmbiguous += 1;
        return line;
      }
      counts.linesMatched += 1;
      changed = true;
      return { ...line, productId: [...ids][0] };
    });
    if (changed) {
      counts.invoicesToUpdate += 1;
      updates.push({ id: inv.id, field, lines });
    }
  }
  return { updates, counts };
}

module.exports = { planBackfill };
