// Advance receipts: money received before the invoice. Issues a GST receipt
// voucher, books the tax on the advance, and is later adjusted against the
// customer's invoice (GSTR-1 tables 11A / 11B).
import React, { useMemo, useState } from "react";
import { Plus, Printer, Trash2, Link2, ArrowLeft, Save, X, HandCoins, IndianRupee, Percent } from "lucide-react";
import { useVouchers, useCustomers, useInvoices, useAccounts } from "../../hooks/useFirestore";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useToast } from "../../context/ToastContext";
import { GST_RATES, invoiceTotalsInr, round2 } from "../../utils/gst.js";
import { ADVANCE_TYPE, newAdvance, advanceForSave } from "../../utils/advances.js";
import { generateVoucherHTML } from "../../utils/invoiceGenerator.js";

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const field = "w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
const nameOf = (p) => p?.name || p?.displayName || p?.companyName || "";

function printHtml(html) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
  return true;
}

// Invoice amount still due after payments, TDS, credit notes and adjusted advances.
const dueOn = (inv) =>
  round2(
    (Number(inv.amount ?? inv.total) || 0) -
      (Number(inv.paidAmount) || 0) -
      (Number(inv.tdsAmount) || 0) -
      (Number(inv.creditedAmount) || 0) -
      (Number(inv.advanceAdjusted) || 0)
  );

export default function AdvanceReceipts() {
  const { vouchers: advances, loading, addVoucher, editVoucher, removeVoucher } = useVouchers(ADVANCE_TYPE.collection);
  const { allCustomers } = useCustomers();
  const { allInvoices, editInvoice } = useInvoices();
  const { moneyAccounts } = useAccounts();
  const { companyProfile } = useCompanyProfile();
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => [...(advances || [])].sort((a, b) => String(b.voucherDate).localeCompare(String(a.voucherDate))), [advances]);
  const stats = useMemo(() => {
    const open = rows.filter((a) => !a.adjustedInvoiceId);
    return {
      open: round2(open.reduce((s, a) => s + (Number(a.amount) || 0), 0)),
      tax: round2(open.reduce((s, a) => s + (Number(a.totalTax) || 0), 0)),
      count: rows.length,
    };
  }, [rows]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const preview = form ? advanceForSave(form, companyProfile) : null;
  const previewTotals = preview ? invoiceTotalsInr(preview) : null;

  const save = async () => {
    if (!form.partyId) return toastError("Pick the customer.");
    if (!(Number(form.received) > 0)) return toastError("Enter the amount received.");
    if ((advances || []).some((a) => a.voucherNumber === form.voucherNumber)) return toastError(`${form.voucherNumber} already exists.`);
    setSaving(true);
    const doc = advanceForSave(form, companyProfile);
    const res = await addVoucher(doc);
    setSaving(false);
    if (res.success) {
      success(`Receipt voucher ${doc.voucherNumber} saved.`);
      setForm(null);
    } else toastError(res.error);
  };

  const adjust = async (adv, invoice) => {
    const due = dueOn(invoice);
    if (Number(adv.amount) > due + 0.5) return toastError(`Advance ₹${money(adv.amount)} is more than ₹${money(due)} due on ${invoice.invoiceNumber}.`);
    const today = new Date().toISOString().slice(0, 10);
    const adjusted = round2((Number(invoice.advanceAdjusted) || 0) + Number(adv.amount));
    const covered = (Number(invoice.paidAmount) || 0) + (Number(invoice.tdsAmount) || 0) + (Number(invoice.creditedAmount) || 0) + adjusted;
    const total = Number(invoice.amount ?? invoice.total) || 0;
    const r1 = await editInvoice(invoice.id, { advanceAdjusted: adjusted, status: covered + 0.5 >= total ? "Paid" : "Partial" });
    if (r1 && r1.success === false) return toastError(r1.error);
    const r2 = await editVoucher(adv.id, { adjustedInvoiceId: invoice.id, adjustedInvoiceNumber: invoice.invoiceNumber, adjustedDate: today, status: "Adjusted" });
    if (!r2.success) return toastError(r2.error);
    success(`${adv.voucherNumber} adjusted against ${invoice.invoiceNumber}.`);
    setAdjusting(null);
  };

  const remove = async (a) => {
    if (a.adjustedInvoiceId) return toastError("This advance is already adjusted against an invoice.");
    if (!window.confirm(`Delete ${a.voucherNumber}?`)) return;
    const res = await removeVoucher(a.id);
    if (res.success) success(`${a.voucherNumber} deleted.`);
    else toastError(res.error);
  };

  const print = (a) => {
    if (!printHtml(generateVoucherHTML({ ...a, notes: a.notes || "Advance received. GST on this advance is paid now and adjusted when the tax invoice is issued." }, ADVANCE_TYPE, companyProfile))) toastError("Allow pop-ups to print.");
  };

  if (form) {
    return (
      <div className="min-h-screen text-slate-800 font-mazzard">
        <div className="max-w-3xl mx-auto pb-8 pt-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setForm(null)} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">New receipt voucher</h1>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">Voucher no</span>
              <input className={field} value={form.voucherNumber} onChange={(e) => set({ voucherNumber: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">Date received</span>
              <input type="date" max="9999-12-31" className={field} value={form.voucherDate} onChange={(e) => set({ voucherDate: e.target.value })} />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-sm text-gray-700 mb-1">Customer *</span>
              <select className={field} value={form.partyId} onChange={(e) => set({ partyId: e.target.value, party: (allCustomers || []).find((c) => c.id === e.target.value) || null })}>
                <option value="">Select customer</option>
                {(allCustomers || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {nameOf(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">Amount received (₹, incl. GST) *</span>
              <input type="number" min="0" className={field} value={form.received} onChange={(e) => set({ received: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">GST rate of the supply</span>
              <select className={field} value={form.gstRate} onChange={(e) => set({ gstRate: Number(e.target.value) })}>
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%{r === 0 ? " (goods — no GST on advance)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">HSN / SAC</span>
              <input className={field} value={form.hsnCode} onChange={(e) => set({ hsnCode: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">Received by</span>
              <select className={field} value={form.method} onChange={(e) => set({ method: e.target.value })}>
                {["Bank Transfer", "UPI", "Cheque", "Cash"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            {moneyAccounts.length > 0 && (
              <label className="block">
                <span className="block text-sm text-gray-700 mb-1">Deposit to</span>
                <select className={field} value={form.account} onChange={(e) => set({ account: e.target.value })}>
                  <option value="">Default</option>
                  {moneyAccounts.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">Transaction / cheque no</span>
              <input className={field} value={form.transactionId} onChange={(e) => set({ transactionId: e.target.value })} />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-sm text-gray-700 mb-1">Notes</span>
              <input className={field} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            </label>
            {previewTotals && Number(form.received) > 0 && (
              <div className="sm:col-span-2 p-4 bg-gray-50 rounded-lg text-sm tabular-nums space-y-1">
                <div className="flex justify-between">
                  <span>Value of advance</span>
                  <span>₹{money(previewTotals.taxableAmount)}</span>
                </div>
                {preview.isInterState ? (
                  <div className="flex justify-between">
                    <span>IGST @ {form.gstRate}%</span>
                    <span>₹{money(previewTotals.igstAmount)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span>CGST + SGST @ {form.gstRate}%</span>
                    <span>₹{money(previewTotals.cgstAmount + previewTotals.sgstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-gray-200 pt-1">
                  <span>Received</span>
                  <span>₹{money(previewTotals.total)}</span>
                </div>
              </div>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
                <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save receipt voucher"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const adjustOptions = adjusting ? (allInvoices || []).filter((i) => (i.clientId || i.client?.id) === adjusting.partyId && !/^(draft|cancelled|paid)$/i.test(i.status || "") && dueOn(i) > 0.5) : [];

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Advance Receipts</h1>
            <p className="text-sm text-gray-600 mt-1">Money received before the invoice. GST on the advance is booked now and adjusted when you invoice.</p>
          </div>
          <button onClick={() => setForm(newAdvance({ advances }))} className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New receipt voucher
          </button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            [HandCoins, "Receipt vouchers", stats.count, "bg-blue-100 text-blue-600"],
            [IndianRupee, "Open advances", `₹${money(stats.open)}`, "bg-emerald-100 text-emerald-600"],
            [Percent, "GST paid on open advances", `₹${money(stats.tax)}`, "bg-amber-100 text-amber-600"],
          ].map(([Icon, label, value, tone]) => (
            <div key={label} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-lg font-bold text-gray-900">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Voucher</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">GST</th>
                <th className="px-4 py-3 text-left">Adjusted against</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-blue-700">{a.voucherNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{a.voucherDate}</td>
                  <td className="px-4 py-3">{nameOf(a.party)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(a.amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(a.totalTax)}</td>
                  <td className="px-4 py-3">
                    {a.adjustedInvoiceNumber ? (
                      <span className="text-green-700">
                        {a.adjustedInvoiceNumber} · {a.adjustedDate}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Open</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {!a.adjustedInvoiceId && (
                        <button onClick={() => setAdjusting(a)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50">
                          <Link2 className="w-3.5 h-3.5" /> Adjust
                        </button>
                      )}
                      <button onClick={() => print(a)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Print">
                        <Printer className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(a)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" aria-label="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    {loading ? "Loading…" : "No advances yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {adjusting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Adjust {adjusting.voucherNumber}</h3>
              <button onClick={() => setAdjusting(null)} className="p-1 hover:bg-gray-100 rounded-full" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              ₹{money(adjusting.amount)} from {nameOf(adjusting.party)}. Pick the invoice it was paid for.
            </p>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {adjustOptions.map((inv) => (
                <button key={inv.id} onClick={() => adjust(adjusting, inv)} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex justify-between text-sm">
                  <span>
                    {inv.invoiceNumber} · {inv.invoiceDate}
                  </span>
                  <span className="tabular-nums">due ₹{money(dueOn(inv))}</span>
                </button>
              ))}
              {!adjustOptions.length && <p className="px-4 py-6 text-center text-sm text-gray-500">No open invoices for this customer yet. Create the invoice first.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
