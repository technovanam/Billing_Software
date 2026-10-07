// Cheque register: cheques received from customers and issued to suppliers,
// including post-dated cheques. Nothing reaches the books until a cheque is
// marked cleared — then it settles the linked invoice / purchase bill (or posts
// a receipt / payment journal). Issued cheques can be printed on the leaf.
import React, { useMemo, useState } from "react";
import { Plus, Printer, Trash2, CheckCircle2, XCircle, Landmark, CalendarClock, AlertTriangle, ArrowLeft, Save } from "lucide-react";
import { useVouchers, useCustomers, useSuppliers, useInvoices, useAccounts, usePayments } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";
import { chequeHtml, chequeStage, isStale, chequeJournalLines } from "../../utils/cheque.js";
import { nextVoucherNumber } from "../../utils/vouchers.js";
import { round2 } from "../../utils/gst.js";

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const field = "w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
const today = () => new Date().toISOString().slice(0, 10);
const nameOf = (p) => p?.name || p?.displayName || p?.companyName || "";
const TONE = {
  "Post-dated": "bg-purple-50 text-purple-700",
  Due: "bg-amber-50 text-amber-700",
  Deposited: "bg-blue-50 text-blue-700",
  Cleared: "bg-green-50 text-green-700",
  Bounced: "bg-red-50 text-red-700",
  Cancelled: "bg-gray-100 text-gray-500",
};

const dueOnInvoice = (inv) => round2((Number(inv.amount ?? inv.total) || 0) - (Number(inv.paidAmount) || 0) - (Number(inv.tdsAmount) || 0) - (Number(inv.creditedAmount) || 0) - (Number(inv.advanceAdjusted) || 0));

export default function Cheques() {
  const { vouchers: cheques, loading, addVoucher, editVoucher, removeVoucher } = useVouchers("cheques");
  const { vouchers: purchases, editVoucher: editPurchase } = useVouchers("purchases");
  const { vouchers: journals, addVoucher: addJournal } = useVouchers("journals");
  const { allCustomers } = useCustomers();
  const { suppliers } = useSuppliers();
  const { allInvoices, editInvoice } = useInvoices();
  const { addPayment } = usePayments();
  const { accounts, moneyAccounts } = useAccounts();
  const { success, error: toastError } = useToast();
  const [direction, setDirection] = useState("received");
  const [form, setForm] = useState(null);
  const [clearing, setClearing] = useState(null);

  const banks = moneyAccounts.filter((a) => accounts.find((x) => x.name === a)?.group === "Bank Accounts");
  const parties = direction === "received" ? allCustomers || [] : suppliers || [];
  const rows = useMemo(() => (cheques || []).filter((c) => c.direction === direction).sort((a, b) => String(a.chequeDate).localeCompare(String(b.chequeDate))), [cheques, direction]);
  const stats = useMemo(() => {
    const t = today();
    const open = rows.filter((c) => ["Pending", "Deposited"].includes(c.status || "Pending"));
    return {
      pdc: round2(open.filter((c) => c.chequeDate > t).reduce((s, c) => s + Number(c.amount || 0), 0)),
      due: open.filter((c) => c.chequeDate <= t && (c.status || "Pending") === "Pending").length,
      stale: open.filter((c) => isStale(c, t)).length,
      bounced: rows.filter((c) => c.status === "Bounced").length,
    };
  }, [rows]);

  const linkOptions = (f) =>
    f.direction === "received"
      ? (allInvoices || []).filter((i) => (i.clientId || i.client?.id) === f.partyId && !/^(draft|cancelled|paid)$/i.test(i.status || "") && dueOnInvoice(i) > 0.5)
      : (purchases || []).filter((p) => p.partyId === f.partyId && String(p.status) !== "Paid");

  const startNew = () =>
    setForm({
      direction,
      chequeNo: "",
      chequeDate: today(),
      bankName: "",
      account: banks[0] || "",
      partyId: "",
      partyName: "",
      amount: "",
      linkedId: "",
      linkedNumber: "",
      acPayee: true,
      notes: "",
      status: "Pending",
    });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.chequeNo.trim() || !form.chequeDate || !form.partyId || !(Number(form.amount) > 0)) return toastError("Cheque no, date, party and amount are required.");
    if ((cheques || []).some((c) => c.direction === form.direction && c.chequeNo === form.chequeNo.trim() && (c.bankName || "") === (form.bankName || "") && c.status !== "Cancelled"))
      return toastError(`Cheque ${form.chequeNo} is already in the register.`);
    const res = await addVoucher({ ...form, chequeNo: form.chequeNo.trim(), amount: Number(form.amount) });
    if (res.success) {
      success(`Cheque ${form.chequeNo} saved${form.chequeDate > today() ? " as post-dated" : ""}.`);
      setForm(null);
    } else toastError(res.error);
  };

  // Settle the bill (or post a journal) and mark cleared.
  const clear = async (c, clearedOn) => {
    try {
      if (c.direction === "received" && c.linkedId) {
        const inv = (allInvoices || []).find((i) => i.id === c.linkedId);
        if (!inv) throw new Error("The linked invoice no longer exists.");
        const paid = round2((Number(inv.paidAmount) || 0) + Number(c.amount));
        const covered = paid + (Number(inv.tdsAmount) || 0) + (Number(inv.creditedAmount) || 0) + (Number(inv.advanceAdjusted) || 0);
        const total = Number(inv.amount ?? inv.total) || 0;
        const r1 = await editInvoice(inv.id, { paidAmount: paid, status: covered + 0.5 >= total ? "Paid" : "Partial", paymentMethod: "Cheque", ...(c.account ? { paymentAccount: c.account } : {}), paymentDate: clearedOn });
        if (r1 && r1.success === false) throw new Error(r1.error || "Could not update the invoice.");
        await addPayment({ invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, amount: Number(c.amount), method: "Cheque", ...(c.account ? { account: c.account } : {}), transactionId: c.chequeNo, paymentDate: clearedOn, status: "completed" });
      } else if (c.direction === "issued" && c.linkedId) {
        const p = (purchases || []).find((x) => x.id === c.linkedId);
        if (!p) throw new Error("The linked purchase bill no longer exists.");
        const paid = round2((Number(p.paidAmount) || 0) + Number(c.amount));
        const r = await editPurchase(p.id, { paidAmount: paid, status: paid + 0.5 >= Number(p.amount) ? "Paid" : "Partial", paymentMethod: "Cheque", paidDate: clearedOn, ...(c.account ? { paymentAccount: c.account } : {}) });
        if (!r.success) throw new Error(r.error);
      } else {
        const r = await addJournal({
          voucherType: c.direction === "received" ? "Receipt" : "Payment",
          voucherNumber: nextVoucherNumber(journals, c.direction === "received" ? "RCT" : "PMT", new Date(clearedOn)),
          voucherDate: clearedOn,
          party: c.partyName,
          narration: `Cheque ${c.chequeNo} ${c.direction === "received" ? "from" : "to"} ${c.partyName}`,
          lines: chequeJournalLines(c),
        });
        if (!r.success) throw new Error(r.error);
      }
      const r2 = await editVoucher(c.id, { status: "Cleared", clearedOn });
      if (!r2.success) throw new Error(r2.error);
      success(`Cheque ${c.chequeNo} cleared and recorded in the books.`);
      setClearing(null);
    } catch (err) {
      toastError(err.message);
    }
  };

  const setStatus = async (c, status) => {
    if (status === "Bounced" && !window.confirm(`Mark cheque ${c.chequeNo} as bounced?`)) return;
    const res = await editVoucher(c.id, { status, [`${status.toLowerCase()}On`]: today() });
    if (res.success) success(`Cheque ${c.chequeNo}: ${status.toLowerCase()}.`);
    else toastError(res.error);
  };

  const print = (c) => {
    const acct = accounts.find((a) => a.name === c.account);
    const w = window.open("", "_blank", "width=900,height=500");
    if (!w) return toastError("Allow pop-ups to print.");
    w.document.open();
    w.document.write(chequeHtml({ payee: c.partyName, amount: c.amount, date: c.chequeDate, acPayee: c.acPayee !== false, layout: acct?.chequeLayout || {} }));
    w.document.close();
  };

  if (form) {
    const links = linkOptions(form);
    return (
      <div className="min-h-screen text-slate-800 font-mazzard">
        <div className="max-w-3xl mx-auto pb-8 pt-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setForm(null)} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{form.direction === "received" ? "Cheque received" : "Cheque issued"}</h1>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">Cheque no *</span>
              <input className={field} value={form.chequeNo} onChange={(e) => set({ chequeNo: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" placeholder="6 digits" />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">Cheque date *</span>
              <input type="date" max="9999-12-31" className={field} value={form.chequeDate} onChange={(e) => set({ chequeDate: e.target.value })} />
              {form.chequeDate > today() && <span className="text-xs text-purple-700 mt-1 block">Post-dated — recorded in the books only when it clears.</span>}
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-sm text-gray-700 mb-1">{form.direction === "received" ? "Customer" : "Supplier"} *</span>
              <select
                className={field}
                value={form.partyId}
                onChange={(e) => {
                  const p = parties.find((x) => x.id === e.target.value);
                  set({ partyId: e.target.value, partyName: nameOf(p), linkedId: "", linkedNumber: "" });
                }}
              >
                <option value="">Select</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {nameOf(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">Amount (₹) *</span>
              <input type="number" min="0" className={field} value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">Against {form.direction === "received" ? "invoice" : "purchase bill"}</span>
              <select
                className={field}
                value={form.linkedId}
                onChange={(e) => {
                  const d = links.find((x) => x.id === e.target.value);
                  set({ linkedId: e.target.value, linkedNumber: d?.invoiceNumber || d?.supplierBillNumber || d?.voucherNumber || "", ...(d && !form.amount ? { amount: form.direction === "received" ? dueOnInvoice(d) : round2(Number(d.amount) - Number(d.paidAmount || 0)) } : {}) });
                }}
              >
                <option value="">On account (no bill)</option>
                {links.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.invoiceNumber || d.supplierBillNumber || d.voucherNumber} · ₹{money(form.direction === "received" ? dueOnInvoice(d) : Number(d.amount) - Number(d.paidAmount || 0))} due
                  </option>
                ))}
              </select>
            </label>
            {form.direction === "received" && (
              <label className="block">
                <span className="block text-sm text-gray-700 mb-1">Drawn on (customer&apos;s bank)</span>
                <input className={field} value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} />
              </label>
            )}
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">{form.direction === "received" ? "Deposit into" : "Issued from"}</span>
              <select className={field} value={form.account} onChange={(e) => set({ account: e.target.value })}>
                <option value="">Bank (default)</option>
                {banks.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            {form.direction === "issued" && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.acPayee} onChange={(e) => set({ acPayee: e.target.checked })} className="w-4 h-4 accent-blue-600" /> Print &ldquo;A/c Payee&rdquo; crossing
              </label>
            )}
            <label className="block sm:col-span-2">
              <span className="block text-sm text-gray-700 mb-1">Notes</span>
              <input className={field} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            </label>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg">
                Cancel
              </button>
              <button onClick={save} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">
                <Save className="w-4 h-4" /> Save cheque
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cheques</h1>
            <p className="text-sm text-gray-600 mt-1">Track cheques and post-dated cheques. They reach the books when cleared.</p>
          </div>
          <div className="flex gap-2">
            <div className="flex p-1 bg-white border border-slate-300 rounded-xl">
              {[
                ["received", "Received"],
                ["issued", "Issued"],
              ].map(([k, label]) => (
                <button key={k} onClick={() => setDirection(k)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${direction === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={startNew} className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" /> {direction === "received" ? "Cheque received" : "Cheque issued"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            [CalendarClock, "Post-dated (not yet due)", `₹${money(stats.pdc)}`, "bg-purple-100 text-purple-600"],
            [Landmark, direction === "received" ? "Due for deposit" : "Due for presentation", stats.due, "bg-amber-100 text-amber-600"],
            [AlertTriangle, "Stale (over 3 months)", stats.stale, "bg-orange-100 text-orange-600"],
            [XCircle, "Bounced", stats.bounced, "bg-red-100 text-red-600"],
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
          <table className="w-full text-sm min-w-[960px]">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Cheque</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">{direction === "received" ? "From" : "To"}</th>
                <th className="px-4 py-3 text-left">Against</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((c) => {
                const stage = chequeStage(c);
                const open = ["Pending", "Deposited"].includes(c.status || "Pending");
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-blue-700">{c.chequeNo}</span>
                      {c.bankName && <span className="block text-xs text-gray-500">{c.bankName}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.chequeDate}</td>
                    <td className="px-4 py-3">{c.partyName}</td>
                    <td className="px-4 py-3 text-gray-600">{c.linkedNumber || "On account"}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(c.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TONE[stage] || ""}`}>{stage}</span>
                      {isStale(c) && <span className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">Stale</span>}
                      {c.clearedOn && <span className="block text-xs text-gray-500 mt-0.5">on {c.clearedOn}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {open && direction === "received" && (c.status || "Pending") === "Pending" && stage !== "Post-dated" && (
                          <button onClick={() => setStatus(c, "Deposited")} className="px-2 py-1 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50">
                            Deposited
                          </button>
                        )}
                        {open && stage !== "Post-dated" && (
                          <button onClick={() => setClearing({ cheque: c, date: today() })} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-green-700 hover:bg-green-50">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                          </button>
                        )}
                        {open && stage !== "Post-dated" && (
                          <button onClick={() => setStatus(c, "Bounced")} className="px-2 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">
                            Bounced
                          </button>
                        )}
                        {open && (
                          <button onClick={() => setStatus(c, "Cancelled")} className="px-2 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
                            Cancel
                          </button>
                        )}
                        {direction === "issued" && (
                          <button onClick={() => print(c)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Print cheque" title="Print on cheque leaf">
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        {c.status !== "Cleared" && (
                          <button onClick={() => window.confirm(`Delete cheque ${c.chequeNo}?`) && removeVoucher(c.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" aria-label="Delete cheque">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    {loading ? "Loading…" : `No cheques ${direction} yet.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {direction === "issued" && (
          <p className="text-xs text-gray-500 mt-3">
            Prints on a standard CTS-2010 leaf (202 × 92 mm). If the text sits off the lines, add a nudge in millimetres on the bank ledger (Books &amp; Statements → Chart of Accounts).
          </p>
        )}
      </div>

      {clearing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Cheque {clearing.cheque.chequeNo} cleared</h3>
            <p className="text-sm text-gray-600 mb-3">
              ₹{money(clearing.cheque.amount)} {clearing.cheque.direction === "received" ? "from" : "to"} {clearing.cheque.partyName}
              {clearing.cheque.linkedNumber ? ` against ${clearing.cheque.linkedNumber}` : ""} will be recorded in the books.
            </p>
            <label className="block">
              <span className="block text-sm text-gray-700 mb-1">Cleared on</span>
              <input type="date" max="9999-12-31" className={field} value={clearing.date} onChange={(e) => setClearing({ ...clearing, date: e.target.value })} />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setClearing(null)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg">
                Back
              </button>
              <button onClick={() => clear(clearing.cheque, clearing.date)} className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">
                Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
