// Field-level differences between the before/after copies in an audit entry.
const SKIP = new Set(["updatedAt", "createdAt", "clientAt"]);

const short = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  }
  return String(v);
};

export function auditDiff(before, after) {
  const b = before || {};
  const a = after || {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => !SKIP.has(k));
  return keys
    .filter((k) => JSON.stringify(b[k] ?? null) !== JSON.stringify(a[k] ?? null))
    .map((k) => ({ field: k, from: short(b[k]), to: short(a[k]) }))
    .sort((x, y) => x.field.localeCompare(y.field));
}

export const COLLECTION_LABELS = {
  invoices: "Invoice",
  customers: "Customer",
  products: "Product",
  payments: "Payment",
  expenses: "Expense",
  deliveryChallans: "Delivery challan",
  recurringInvoices: "Recurring invoice",
  creditNotes: "Credit note",
  debitNotes: "Debit note",
  purchases: "Purchase bill",
  suppliers: "Supplier",
  journals: "Journal",
  stockJournals: "Stock journal",
  payrollRuns: "Payroll run",
  employees: "Employee",
  costCentres: "Cost centre",
  godowns: "Godown",
  budgets: "Budget",
  ledgers: "Ledger setting",
  settings: "Settings",
  businessProfile: "Business details",
};
