// Cheques: amount in words (Indian numbering), a print layout for CTS-2010
// cheque leaves, and post-dated cheque status.

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? ` ${ONES[r % 10]}` : ""}`;
  return [h ? `${ONES[h]} Hundred` : "", rest].filter(Boolean).join(" ");
}

// 1234567.5 -> "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only"
export function amountInWords(amount) {
  const value = Math.round((Number(amount) || 0) * 100);
  let rupees = Math.floor(value / 100);
  const paise = value % 100;
  if (!rupees && !paise) return "Zero Rupees Only";
  const parts = [];
  const crore = Math.floor(rupees / 10000000);
  rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000);
  rupees %= 100000;
  const thousand = Math.floor(rupees / 1000);
  rupees %= 1000;
  if (crore) parts.push(`${crore >= 1000 ? amountInWords(crore).replace(/ Rupees Only$/, "") : below1000(crore)} Crore`);
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (rupees) parts.push(below1000(rupees));
  const words = parts.join(" ");
  return `${words ? `${words} Rupees` : ""}${paise ? `${words ? " and " : ""}${below1000(paise)} Paise` : ""} Only`;
}

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Field positions in mm on a 202 × 92 mm CTS-2010 leaf; `layout.dx/dy` nudge
// everything for a particular bank's leaf or printer.
export const CTS_LAYOUT = {
  width: 202,
  height: 92,
  date: { x: 159, y: 9, gap: 5.08 },
  payee: { x: 22, y: 21, w: 150 },
  words1: { x: 30, y: 29.5, w: 140 },
  words2: { x: 12, y: 37.5, w: 125 },
  figures: { x: 160, y: 36.5 },
  acPayee: { x: 12, y: 6 },
};

export function chequeHtml({ payee, amount, date, acPayee = true, layout = {} }) {
  const L = CTS_LAYOUT;
  const dx = Number(layout.dx) || 0;
  const dy = Number(layout.dy) || 0;
  const at = (p, extra = "") => `position:absolute;left:${p.x + dx}mm;top:${p.y + dy}mm;${extra}`;
  const [y, m, d] = String(date || "").split("-");
  const digits = d && m && y ? `${d}${m}${y}` : "";
  const words = amountInWords(amount);
  // Split words over the two printed lines at a word boundary.
  const cut = words.length > 62 ? words.lastIndexOf(" ", 62) : words.length;
  const line1 = words.slice(0, cut);
  const line2 = words.slice(cut).trim();
  const figures = `${Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/-`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Cheque</title><style>
@page { size: ${L.width}mm ${L.height}mm; margin: 0; }
html,body{margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:12pt;}
.leaf{position:relative;width:${L.width}mm;height:${L.height}mm;overflow:hidden}
.d{display:inline-block;width:${L.date.gap}mm;text-align:center;font-size:12pt;letter-spacing:0}
.cross{border-top:1px solid #000;border-bottom:1px solid #000;transform:rotate(-20deg);font-size:9pt;font-weight:bold;padding:1px 6px}
@media screen{body{background:#eee;padding:16px}.leaf{background:#fff;outline:1px dashed #999}}
</style></head><body><div class="leaf">
${acPayee ? `<div class="cross" style="${at(L.acPayee)}">A/c Payee</div>` : ""}
<div style="${at(L.date)}">${digits
    .split("")
    .map((c) => `<span class="d">${c}</span>`)
    .join("")}</div>
<div style="${at(L.payee, `width:${L.payee.w}mm;white-space:nowrap;overflow:hidden`)}">${esc(payee)}</div>
<div style="${at(L.words1, `width:${L.words1.w}mm;white-space:nowrap`)}">${esc(line1)}</div>
<div style="${at(L.words2, `width:${L.words2.w}mm;white-space:nowrap`)}">${esc(line2)}</div>
<div style="${at(L.figures, "font-weight:bold")}">**${esc(figures)}</div>
</div><script>window.onload=function(){window.print()}</script></body></html>`;
}

// "Post-dated" until its date, then "Due" for deposit / presentation.
export function chequeStage(c, today = new Date().toISOString().slice(0, 10)) {
  if (c.status && c.status !== "Pending") return c.status;
  return c.chequeDate > today ? "Post-dated" : "Due";
}

// A cheque can't be presented more than 3 months after its date.
export function isStale(c, today = new Date().toISOString().slice(0, 10)) {
  if (!c.chequeDate || (c.status && !["Pending", "Deposited"].includes(c.status))) return false;
  const [y, m, d] = c.chequeDate.split("-").map(Number);
  const limit = new Date(Date.UTC(y, m - 1 + 3, d)).toISOString().slice(0, 10);
  return today > limit;
}

// Journal lines posted when a cheque not tied to a bill clears.
export function chequeJournalLines(c) {
  const bank = { ledger: c.account || "Bank", group: "Bank Accounts" };
  const party = { ledger: c.partyName, group: c.direction === "received" ? "Sundry Debtors" : "Sundry Creditors" };
  const amt = Number(c.amount) || 0;
  return c.direction === "received"
    ? [
        { ...bank, dr: amt, cr: 0 },
        { ...party, dr: 0, cr: amt },
      ]
    : [
        { ...party, dr: amt, cr: 0 },
        { ...bank, dr: 0, cr: amt },
      ];
}
