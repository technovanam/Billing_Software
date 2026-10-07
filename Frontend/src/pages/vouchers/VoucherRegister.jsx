// One screen for Credit Notes, Purchases and Debit Notes (Tally vouchers).
// Register (list) -> form (create / edit) -> print, all on the shared GST engine.
import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, Search, ArrowLeft, Save, Printer, Pencil, Trash2, FileText, Receipt, IndianRupee, Percent, X, ArrowRightLeft } from "lucide-react";
import { useVouchers, useSuppliers, useCustomers, useInvoices, useProducts, useSettings, useCostCentres, useGodowns, useAccounts, usePatchDoc, usePriceLists } from "../../hooks/useFirestore";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useToast } from "../../context/ToastContext";
import { ProductAutocomplete } from "../../components/InvoiceAutocomplete.jsx";
import { invoiceTotals, invoiceTotalsInr, GST_RATES, STATES, stateName, partyStateCode, round2 } from "../../utils/gst.js";
import { newInvoiceItem, applyItemChange, applyProduct } from "../../utils/invoiceForm.js";
import { invoiceTaxSettings } from "../../utils/invoiceFromDraft.js";
import { VOUCHER_TYPES, NOTE_REASONS, CONVERT_LABELS, newVoucher, withLinked, withParty, voucherForSave, voucherProblems, voucherFromOrder } from "../../utils/vouchers.js";
import { generateVoucherHTML } from "../../utils/invoiceGenerator.js";
import { priceListFor } from "../../utils/priceLists.js";

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const field = "w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
const cell = "w-full px-2.5 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

function partyName(p) {
  return p?.name || p?.displayName || p?.companyName || "";
}

function printHtml(html) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
  setTimeout(() => {
    try {
      w.print();
    } catch (_) {
      /* the onload handler prints */
    }
  }, 600);
  return true;
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function VoucherRegister({ typeKey }) {
  const type = VOUCHER_TYPES[typeKey];
  const { success, error: toastError } = useToast();
  const { companyProfile } = useCompanyProfile();
  const { settings } = useSettings();
  const { defaultGstRate } = invoiceTaxSettings(settings);

  const { vouchers, loading, addVoucher, editVoucher, removeVoucher } = useVouchers(type.collection);
  const { allCustomers } = useCustomers();
  const { suppliers } = useSuppliers();
  const { allInvoices, editInvoice } = useInvoices();

  // A credit note reduces what is due on its invoice: keep invoice.creditedAmount
  // equal to the total of all credit notes raised against it.
  const syncCredited = async (invoiceId, list) => {
    if (type.key !== "creditNote" || !invoiceId) return;
    const credited = round2(list.filter((v) => v.linkedId === invoiceId).reduce((s, v) => s + invoiceTotalsInr(v).total, 0));
    await editInvoice(invoiceId, { creditedAmount: credited });
  };
  const { vouchers: purchases } = useVouchers("purchases");
  const { allProducts } = useProducts();
  const { names: costCentres } = useCostCentres();
  const { names: godowns } = useGodowns();
  const { moneyAccounts } = useAccounts();
  const patchDoc = usePatchDoc();
  const { priceLists } = usePriceLists();
  const location = useLocation();
  const navigate = useNavigate();

  const parties = type.partyKind === "supplier" ? suppliers || [] : allCustomers || [];
  const linkable = type.linkKind === "invoice" ? (allInvoices || []).filter((i) => String(i.status).toLowerCase() !== "draft") : type.linkKind === "purchase" ? purchases || [] : [];

  const [mode, setMode] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [voucher, setVoucher] = useState(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => (voucher ? invoiceTotals(voucher) : null), [voucher]);

  // Arrived from "Convert" on an order: open a new voucher filled from it.
  const fromOrder = location.state?.fromOrder;
  React.useEffect(() => {
    if (!fromOrder || loading) return;
    setVoucher(voucherFromOrder(type, fromOrder, { vouchers, company: companyProfile }));
    setEditingId(null);
    setMode("form");
    navigate(location.pathname, { replace: true, state: null });
  }, [fromOrder, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const convert = (order, target) => {
    if (target === "invoice") navigate("/invoices/create", { state: { fromOrder: order } });
    else navigate(VOUCHER_TYPES[target].route, { state: { fromOrder: order } });
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(vouchers || [])]
      .filter((v) => !q || [v.voucherNumber, partyName(v.party), v.linkedNumber, v.supplierBillNumber].some((t) => String(t || "").toLowerCase().includes(q)))
      .sort((a, b) => String(b.voucherDate || "").localeCompare(String(a.voucherDate || "")) || String(b.voucherNumber).localeCompare(String(a.voucherNumber)));
  }, [vouchers, search]);

  const summary = useMemo(() => {
    const s = { count: 0, taxable: 0, tax: 0, total: 0 };
    for (const v of vouchers || []) {
      const t = invoiceTotals(v);
      s.count += 1;
      s.taxable += t.taxableAmount;
      s.tax += t.totalTax;
      s.total += t.total;
    }
    return s;
  }, [vouchers]);

  const startNew = () => {
    const base = newVoucher(type, { vouchers });
    setVoucher(withParty(base, type, null, companyProfile));
    setEditingId(null);
    setMode("form");
  };

  const startEdit = (v) => {
    setVoucher(JSON.parse(JSON.stringify(v)));
    setEditingId(v.id);
    setMode("form");
  };

  const set = (patch) => setVoucher((prev) => ({ ...prev, ...patch }));

  const pickParty = (id) => {
    const party = parties.find((p) => p.id === id) || null;
    setVoucher((prev) => withParty(prev, type, party, companyProfile));
  };

  const pickLinked = (id) => {
    const linked = linkable.find((d) => d.id === id) || null;
    setVoucher((prev) => withLinked(prev, type, linked, { company: companyProfile, parties }));
  };

  const updateItem = (id, key, value) => setVoucher((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === id ? applyItemChange(it, key, value) : it)) }));
  const pickProduct = (id, product) =>
    setVoucher((prev) => {
      const list = type.direction === "sale" ? priceListFor(prev.party, priceLists) : null;
      return { ...prev, items: prev.items.map((it) => (it.id === id ? applyProduct(it, product, defaultGstRate, list) : it)) };
    });
  const addItem = () => setVoucher((prev) => ({ ...prev, items: [...prev.items, newInvoiceItem(defaultGstRate)] }));
  const removeItem = (id) => setVoucher((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== id) }));

  const save = async () => {
    const problems = voucherProblems(voucher, type);
    if (problems.length) {
      toastError(`Please fill in: ${problems.join(", ")}`);
      return;
    }
    if (!editingId && (vouchers || []).some((v) => v.voucherNumber === voucher.voucherNumber)) {
      toastError(`${voucher.voucherNumber} already exists.`);
      return;
    }
    setSaving(true);
    const doc = voucherForSave({ ...voucher, items: voucher.items.filter((it) => Number(it.quantity) > 0) }, companyProfile);
    if (type.key === "purchase") {
      const paid = Number(doc.paidAmount) || 0;
      doc.status = paid <= 0 ? "Unpaid" : paid + 0.5 >= doc.amount ? "Paid" : "Partial";
      if (paid > 0 && !doc.paidDate) doc.paidDate = doc.voucherDate;
      if (paid > 0 && !doc.paymentMethod) doc.paymentMethod = "Bank Transfer";
    }
    delete doc.id;
    const res = editingId ? await editVoucher(editingId, doc) : await addVoucher(doc);
    setSaving(false);
    if (res.success) {
      const others = (vouchers || []).filter((v) => v.id !== editingId);
      const previousLink = editingId ? (vouchers || []).find((v) => v.id === editingId)?.linkedId : null;
      await syncCredited(doc.linkedId, [...others, doc]);
      if (!editingId && doc.orderRef?.id) await patchDoc(doc.orderRef.collection, doc.orderRef.id, { status: "Converted", convertedTo: { type: type.key, number: doc.voucherNumber } });
      if (previousLink && previousLink !== doc.linkedId) await syncCredited(previousLink, others);
      success(`${type.label} ${doc.voucherNumber} ${editingId ? "updated" : "saved"}.`);
      setMode("list");
      setVoucher(null);
    } else {
      toastError(`Could not save: ${res.error}`);
    }
  };

  const remove = async (v) => {
    if (!window.confirm(`Delete ${type.label} ${v.voucherNumber}? This cannot be undone.`)) return;
    const res = await removeVoucher(v.id);
    if (res.success) await syncCredited(v.linkedId, (vouchers || []).filter((x) => x.id !== v.id));
    if (res.success) success(`${v.voucherNumber} deleted.`);
    else toastError(`Could not delete: ${res.error}`);
  };

  const print = (v) => {
    if (!printHtml(generateVoucherHTML(v, type, companyProfile))) toastError("Allow pop-ups to print.");
  };

  /* ─── Form ───────────────────────────────────────────────────────────── */
  if (mode === "form" && voucher) {
    const gstOn = voucher.isGstEnabled !== false;
    const inter = Boolean(voucher.isInterState);
    const linkOptions = linkable.filter((d) => !voucher.partyId || (d.partyId || d.clientId) === voucher.partyId);
    return (
      <div className="min-h-screen text-slate-800 font-mazzard">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode("list")} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Back">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{editingId ? `Edit ${type.label}` : `New ${type.label}`}</h1>
                <p className="text-sm text-gray-600 mt-0.5">{type.blurb}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMode("list")} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => print(voucherForSave(voucher, companyProfile))} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <Printer className="w-4 h-4" /> Preview
              </button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
                <Save className="w-4 h-4" /> {saving ? "Saving…" : `Save ${type.label}`}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{type.label} details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-sm text-gray-700 mb-1">{type.label} No *</span>
                    <input className={field} value={voucher.voucherNumber} onChange={(e) => set({ voucherNumber: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="block text-sm text-gray-700 mb-1">Date *</span>
                    <input type="date" max="9999-12-31" className={field} value={voucher.voucherDate} onChange={(e) => set({ voucherDate: e.target.value })} />
                  </label>
                  {type.dueLabel && (
                    <label className="block">
                      <span className="block text-sm text-gray-700 mb-1">{type.dueLabel}</span>
                      <input type="date" max="9999-12-31" className={field} value={voucher.dueDate || ""} onChange={(e) => set({ dueDate: e.target.value })} />
                    </label>
                  )}
                  {type.isOrder && editingId && (
                    <label className="block">
                      <span className="block text-sm text-gray-700 mb-1">Status</span>
                      <select className={field} value={voucher.status || "Open"} onChange={(e) => set({ status: e.target.value })}>
                        {["Open", type.key === "quotation" ? "Accepted" : "Confirmed", "Converted", "Cancelled"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {voucher.orderRef?.number && (
                    <p className="sm:col-span-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">Created from {voucher.orderRef.number}. Change quantities for a part delivery.</p>
                  )}
                  {godowns.length > 1 && !type.isOrder && (
                    <label className="block">
                      <span className="block text-sm text-gray-700 mb-1">{type.key === "purchase" || type.key === "creditNote" ? "Receive into godown" : "Send from godown"}</span>
                      <select className={field} value={voucher.godown || "Main Location"} onChange={(e) => set({ godown: e.target.value })}>
                        {godowns.map((g) => (
                          <option key={g}>{g}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {costCentres.length > 0 && (
                    <label className="block">
                      <span className="block text-sm text-gray-700 mb-1">Cost centre</span>
                      <select className={field} value={voucher.costCentre || ""} onChange={(e) => set({ costCentre: e.target.value })}>
                        <option value="">None</option>
                        {costCentres.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="block">
                    <span className="block text-sm text-gray-700 mb-1">{type.partyLabel} *</span>
                    <select className={field} value={voucher.partyId} onChange={(e) => pickParty(e.target.value)}>
                      <option value="">Select {type.partyLabel.toLowerCase()}</option>
                      {parties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {partyName(p)}
                        </option>
                      ))}
                    </select>
                    {type.partyKind === "supplier" && !parties.length && (
                      <span className="text-xs text-amber-700 mt-1 block">
                        No suppliers yet —{" "}
                        <Link to="/suppliers" className="underline font-semibold">
                          add one
                        </Link>
                        .
                      </span>
                    )}
                  </label>
                  {type.linkKind && (
                    <label className="block">
                      <span className="block text-sm text-gray-700 mb-1">{type.linkLabel}</span>
                      <select className={field} value={voucher.linkedId} onChange={(e) => pickLinked(e.target.value)}>
                        <option value="">Select {type.linkKind === "invoice" ? "invoice" : "purchase bill"}</option>
                        {linkOptions.map((d) => (
                          <option key={d.id} value={d.id}>
                            {(d.invoiceNumber || d.voucherNumber) + " · " + (d.invoiceDate || d.voucherDate || "") + " · ₹" + money(d.amount)}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-gray-500 mt-1 block">Items are copied from the original bill — change the returned quantities.</span>
                    </label>
                  )}
                  {type.linkKind && (
                    <label className="block">
                      <span className="block text-sm text-gray-700 mb-1">Reason</span>
                      <select className={field} value={voucher.reason} onChange={(e) => set({ reason: e.target.value })}>
                        {NOTE_REASONS.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {type.key === "purchase" && (
                    <>
                      <label className="block">
                        <span className="block text-sm text-gray-700 mb-1">Supplier bill no *</span>
                        <input className={field} value={voucher.supplierBillNumber} onChange={(e) => set({ supplierBillNumber: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="block text-sm text-gray-700 mb-1">Supplier bill date</span>
                        <input type="date" max="9999-12-31" className={field} value={voucher.supplierBillDate} onChange={(e) => set({ supplierBillDate: e.target.value })} />
                      </label>
                      <label className="block">
                        <span className="block text-sm text-gray-700 mb-1">Amount paid (₹)</span>
                        <input type="number" min="0" className={field} value={voucher.paidAmount ?? 0} onFocus={(e) => e.target.select()} onChange={(e) => set({ paidAmount: Number.parseFloat(e.target.value) || 0 })} />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="block text-sm text-gray-700 mb-1">Payment mode</span>
                          <select className={field} value={voucher.paymentMethod || "Bank Transfer"} onChange={(e) => set({ paymentMethod: e.target.value })}>
                            {["Bank Transfer", "UPI", "Cheque", "Cash"].map((m) => (
                              <option key={m}>{m}</option>
                            ))}
                          </select>
                        </label>
                        {moneyAccounts.length > 0 && (
                          <label className="block col-span-2">
                            <span className="block text-sm text-gray-700 mb-1">Paid from account</span>
                            <select className={field} value={voucher.paymentAccount || ""} onChange={(e) => set({ paymentAccount: e.target.value })}>
                              <option value="">Default</option>
                              {moneyAccounts.map((a) => (
                                <option key={a}>{a}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label className="block">
                          <span className="block text-sm text-gray-700 mb-1">Paid on</span>
                          <input type="date" max="9999-12-31" className={field} value={voucher.paidDate || ""} onChange={(e) => set({ paidDate: e.target.value })} />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Items *</h3>
                  <button onClick={addItem} className="flex items-center px-3 py-1.5 text-white bg-blue-600 rounded-lg text-xs font-medium hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                    <thead className="text-xs uppercase font-semibold text-gray-500">
                      <tr>
                        <th className="p-2 text-left w-[4%]">#</th>
                        <th className="p-2 text-left">Description</th>
                        <th className="p-2 text-left w-[10%]">HSN/SAC</th>
                        <th className="p-2 text-left w-[8%]">Qty</th>
                        <th className="p-2 text-left w-[11%]">Rate (₹)</th>
                        <th className="p-2 text-left w-[8%]">Disc %</th>
                        <th className="p-2 text-left w-[9%]">GST %</th>
                        <th className="p-2 text-right w-[12%]">Taxable (₹)</th>
                        <th className="p-2 w-[4%]" />
                      </tr>
                    </thead>
                    <tbody>
                      {voucher.items.map((it, i) => (
                        <tr key={it.id} className="border-t">
                          <td className="p-2 pt-4 text-sm align-top text-gray-500">{i + 1}</td>
                          <td className="p-2 align-top">
                            <ProductAutocomplete
                              products={allProducts || []}
                              value={it.description || ""}
                              onSelect={(product) => pickProduct(it.id, product)}
                              onChange={(val) => updateItem(it.id, "description", val)}
                            />
                            {it.trackBatches && (
                              <div className="flex gap-1.5 mt-1.5">
                                <input value={it.batchNo || ""} onChange={(e) => updateItem(it.id, "batchNo", e.target.value)} placeholder="Batch" aria-label="Batch number" className="w-1/2 px-2 py-1 text-xs bg-amber-50 border border-amber-200 rounded" />
                                <input type="date" max="9999-12-31" value={it.expiryDate || ""} onChange={(e) => updateItem(it.id, "expiryDate", e.target.value)} aria-label="Expiry date" title="Expiry" className="w-1/2 px-2 py-1 text-xs bg-amber-50 border border-amber-200 rounded" />
                              </div>
                            )}
                          </td>
                          <td className="p-2 align-top">
                            <input className={cell} value={it.hsnCode || ""} onChange={(e) => updateItem(it.id, "hsnCode", e.target.value)} placeholder="HSN" />
                          </td>
                          <td className="p-2 align-top">
                            <input type="number" min="0" className={cell} value={it.quantity ?? 0} onFocus={(e) => e.target.select()} onChange={(e) => updateItem(it.id, "quantity", Number.parseFloat(e.target.value) || 0)} />
                          </td>
                          <td className="p-2 align-top">
                            <input type="number" min="0" className={cell} value={it.rate ?? 0} onFocus={(e) => e.target.select()} onChange={(e) => updateItem(it.id, "rate", Number.parseFloat(e.target.value) || 0)} />
                          </td>
                          <td className="p-2 align-top">
                            <input type="number" min="0" max="100" className={cell} value={it.discount ?? 0} onFocus={(e) => e.target.select()} onChange={(e) => updateItem(it.id, "discount", Math.min(100, Math.max(0, Number.parseFloat(e.target.value) || 0)))} />
                          </td>
                          <td className="p-2 align-top">
                            <select className={cell} value={String(it.gstRate ?? 0)} onChange={(e) => updateItem(it.id, "gstRate", Number(e.target.value))}>
                              {GST_RATES.map((r) => (
                                <option key={r} value={String(r)}>
                                  {r}%
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 pt-4 align-top text-right text-sm font-semibold tabular-nums">{money(it.amount)}</td>
                          <td className="p-2 align-top">
                            <button onClick={() => removeItem(it.id)} className="text-red-500 hover:bg-red-50 p-2 rounded" aria-label="Remove item">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!voucher.items.length && (
                        <tr>
                          <td colSpan={9} className="p-6 text-center text-sm text-gray-500 border-t">
                            {type.linkKind ? `Pick the ${type.linkKind === "invoice" ? "invoice" : "purchase bill"} above to copy its items, or add items.` : "Click Add Item to start."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <label className="block mt-4">
                  <span className="block text-sm text-gray-700 mb-1">Narration / notes</span>
                  <textarea className={`${field} h-16 resize-none`} value={voucher.notes} onChange={(e) => set({ notes: e.target.value })} />
                </label>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-white rounded-xl border border-gray-200">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Tax & Calculation</h3>
                <label className="block mb-3">
                  <span className="block text-sm text-gray-700 mb-1">Place of supply</span>
                  <select
                    className={field}
                    value={voucher.placeOfSupply?.code || ""}
                    onChange={(e) => {
                      const code = e.target.value;
                      const ours = partyStateCode(companyProfile);
                      set({ placeOfSupply: code ? { code, name: stateName(code) } : null, isInterState: type.direction === "purchase" ? inter : Boolean(code && ours && code !== ours) });
                    }}
                  >
                    <option value="">Select state</option>
                    {STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} – {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${inter ? "bg-purple-50 text-purple-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {inter ? "Inter-state · IGST" : "Intra-state · CGST + SGST"}
                  </span>
                  <button type="button" onClick={() => set({ isInterState: !inter })} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                    Switch
                  </button>
                </div>
                {type.direction === "purchase" && (
                  <label className="flex items-start gap-2 py-2 border-t border-gray-100 text-sm text-gray-700">
                    <input type="checkbox" checked={Boolean(voucher.reverseCharge)} onChange={(e) => set({ reverseCharge: e.target.checked })} className="mt-0.5 w-4 h-4 accent-blue-600" />
                    <span>
                      Reverse charge (RCM)
                      <span className="block text-xs text-gray-500">You pay this GST to the government, not the supplier, and claim it as ITC.</span>
                    </span>
                  </label>
                )}
                {voucher.reverseCharge && type.direction === "sale" && <p className="text-xs text-amber-700 mb-2">Original invoice was under reverse charge.</p>}
                {(type.key === "purchase" || type.key === "debitNote" || type.isOrder) && (
                  <label className="flex items-center justify-between py-2 border-t border-gray-100 text-sm">
                    <span className="font-semibold text-gray-800">
                      TCS %<span className="block text-xs font-normal text-gray-500">{type.direction === "purchase" ? "Collected by the supplier — claimable" : "Collected on the bill value"}</span>
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={voucher.tcsRate || ""}
                      onChange={(e) => set({ tcsRate: Number.parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-20 px-2 py-1.5 text-sm text-right bg-gray-100 rounded-lg"
                    />
                  </label>
                )}
                <label className="flex items-center justify-between py-2 border-t border-gray-100 text-sm">
                  <span className="font-semibold text-gray-800">Round off</span>
                  <input type="checkbox" checked={Boolean(voucher.isRoundOff)} onChange={(e) => set({ isRoundOff: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                </label>
                <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 mt-3 space-y-2 text-sm tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Taxable value</span>
                    <span className="font-bold">₹{money(totals.taxableAmount)}</span>
                  </div>
                  {gstOn &&
                    (totals.taxBreakup || []).map((b) =>
                      inter ? (
                        <div key={`i${b.gstRate}`} className="flex justify-between">
                          <span className="text-slate-600">IGST @ {b.gstRate}%</span>
                          <span className="font-semibold">{money(b.igst)}</span>
                        </div>
                      ) : (
                        <React.Fragment key={`c${b.gstRate}`}>
                          <div className="flex justify-between">
                            <span className="text-slate-600">CGST @ {b.gstRate / 2}%</span>
                            <span className="font-semibold">{money(b.cgst)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">SGST @ {b.gstRate / 2}%</span>
                            <span className="font-semibold">{money(b.sgst)}</span>
                          </div>
                        </React.Fragment>
                      )
                    )}
                  {totals.cessAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Cess</span>
                      <span className="font-semibold">{money(totals.cessAmount)}</span>
                    </div>
                  )}
                  {totals.tcsAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">TCS @ {totals.tcsRate}%</span>
                      <span className="font-semibold">{money(totals.tcsAmount)}</span>
                    </div>
                  )}
                  {voucher.isRoundOff && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Round off</span>
                      <span className="font-semibold">{money(totals.roundOffAmount)}</span>
                    </div>
                  )}
                  <div className="pt-3 mt-1 border-t border-gray-200 flex justify-between text-lg font-bold">
                    <span>{voucher.reverseCharge ? "Payable to party" : "Total"}</span>
                    <span>₹{money(totals.total)}</span>
                  </div>
                  {voucher.reverseCharge && totals.totalTax > 0 && <p className="text-xs text-amber-700">RCM tax ₹{money(totals.totalTax)} is payable by you in cash (GSTR-3B 3.1(d)).</p>}
                </div>
                {type.direction === "purchase" && (
                  <p className="text-xs text-gray-500 mt-3">
                    {type.key === "purchase" ? "GST on this bill is added to your input tax credit." : "GST on this note is reversed from your input tax credit."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Register ───────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{type.plural}</h1>
            <p className="text-sm text-gray-600 mt-1">{type.blurb}</p>
          </div>
          <button onClick={startNew} className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New {type.label}
          </button>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Stat icon={FileText} label={type.plural} value={summary.count} tone="bg-blue-100 text-blue-600" />
          <Stat icon={Receipt} label="Taxable value" value={`₹${money(summary.taxable)}`} tone="bg-purple-100 text-purple-600" />
          <Stat icon={Percent} label={type.isOrder ? "GST" : type.direction === "purchase" ? (type.key === "purchase" ? "Input GST (ITC)" : "ITC reversed") : "GST reduced"} value={`₹${money(summary.tax)}`} tone="bg-amber-100 text-amber-600" />
          <Stat icon={IndianRupee} label="Total value" value={`₹${money(summary.total)}`} tone="bg-emerald-100 text-emerald-600" />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${type.plural.toLowerCase()}…`}
                className="w-full pl-9 pr-8 py-2 text-sm bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" aria-label="Clear search">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">No.</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">{type.partyLabel}</th>
                  <th className="px-4 py-3 text-left">{type.key === "purchase" ? "Supplier bill" : type.isOrder ? type.dueLabel : "Against"}</th>
                  <th className="px-4 py-3 text-right">Taxable</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((v) => {
                  const t = invoiceTotals(v);
                  return (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-blue-700">{v.voucherNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{v.voucherDate}</td>
                      <td className="px-4 py-3 text-gray-900">{partyName(v.party)}</td>
                      <td className="px-4 py-3 text-gray-600">{type.isOrder ? v.dueDate || "—" : v.supplierBillNumber || v.linkedNumber || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(t.taxableAmount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(t.totalTax)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {money(t.total)}
                        {type.key === "purchase" && (
                          <span
                            className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              v.status === "Paid" ? "bg-green-50 text-green-700" : v.status === "Partial" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"
                            }`}
                          >
                            {v.status || "Unpaid"}
                          </span>
                        )}
                        {type.isOrder && (
                          <span
                            title={v.convertedTo ? `→ ${v.convertedTo.number}` : undefined}
                            className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              v.status === "Converted" ? "bg-green-50 text-green-700" : v.status === "Cancelled" ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {v.status || "Open"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {type.isOrder &&
                            v.status !== "Cancelled" &&
                            type.convertTo.map((target) => (
                              <button
                                key={target}
                                onClick={() => convert(v, target)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50"
                                title={`Convert to ${CONVERT_LABELS[target].toLowerCase()}`}
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" /> {CONVERT_LABELS[target]}
                              </button>
                            ))}
                          <button onClick={() => print(v)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="Print" aria-label="Print">
                            <Printer className="w-4 h-4" />
                          </button>
                          <button onClick={() => startEdit(v)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="Edit" aria-label="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => remove(v)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" title="Delete" aria-label="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      {loading ? "Loading…" : search ? "No matches." : `No ${type.plural.toLowerCase()} yet. Click "New ${type.label}" to add one.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

VoucherRegister.propTypes = { typeKey: PropTypes.oneOf(Object.keys(VOUCHER_TYPES)).isRequired };
