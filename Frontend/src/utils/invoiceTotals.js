// Bill total calculations shared by the invoice form and the AI draft preview,
// so GST is calculated in one place (see ./gst.js).
//
// Pass the invoice fields: items, isGstEnabled, isRoundOff, and either
// gstVersion + isInterState (item-wise GST) or cgst/sgst/igst (older invoices).
import { invoiceTotals } from "./gst.js";

export function calculateInvoiceTotals(invoice) {
  return invoiceTotals(invoice);
}
