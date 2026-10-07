// Bill of materials and manufacturing journals (Tally: BOM on the stock item +
// Manufacturing Journal). Making goods consumes the components and brings the
// finished item into stock at the components' cost.
import React, { useMemo, useState } from "react";
import { Factory, Plus, Save, Trash2, Hammer } from "lucide-react";
import { useProducts, useVouchers, useBooksData, useGodowns } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";
import { bomRequirement, currentRates, MAIN_GODOWN, stockSummary } from "../../utils/inventory.js";
import { nextVoucherNumber } from "../../utils/vouchers.js";

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const field = "px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
const today = () => new Date().toISOString().slice(0, 10);

export default function Manufacturing() {
  const { allProducts, editProduct } = useProducts();
  const data = useBooksData();
  const { vouchers: journals, addVoucher, removeVoucher } = useVouchers("stockJournals");
  const { names: godowns } = useGodowns();
  const { success, error: toastError } = useToast();
  const products = useMemo(() => (allProducts || []).filter((p) => p.isActive !== false), [allProducts]);
  const nameOf = (id) => products.find((p) => p.id === id)?.name || "Deleted product";

  const [bomFor, setBomFor] = useState("");
  const [bom, setBom] = useState(null);
  const [run, setRun] = useState({ productId: "", quantity: "", date: today(), godown: MAIN_GODOWN, batchNo: "", expiryDate: "" });

  const stockData = useMemo(
    () => ({ products: data.products || [], invoices: data.invoices || [], creditNotes: data.creditNotes || [], purchases: data.purchases || [], debitNotes: data.debitNotes || [], stockJournals: journals || [] }),
    [data.products, data.invoices, data.creditNotes, data.purchases, data.debitNotes, journals]
  );
  const rates = useMemo(() => currentRates(stockData, run.date), [stockData, run.date]);
  const onHand = useMemo(() => new Map(stockSummary(stockData, { to: run.date }).rows.map((r) => [r.productId, r.closing])), [stockData, run.date]);
  const withBom = products.filter((p) => p.bom?.components?.length);
  const runProduct = products.find((p) => p.id === run.productId);
  const need = runProduct && Number(run.quantity) > 0 ? bomRequirement(runProduct, Number(run.quantity), rates) : null;
  const runs = (journals || []).filter((j) => j.kind === "manufacture").sort((a, b) => String(b.voucherDate).localeCompare(String(a.voucherDate)));

  const pickBom = (id) => {
    setBomFor(id);
    const p = products.find((x) => x.id === id);
    setBom(p ? { outputQty: p.bom?.outputQty || 1, overhead: p.bom?.overhead || 0, components: (p.bom?.components || []).map((c) => ({ ...c })) } : null);
  };
  const setComp = (i, patch) => setBom((b) => ({ ...b, components: b.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const saveBom = async () => {
    const components = bom.components.filter((c) => c.productId && Number(c.quantity) > 0 && c.productId !== bomFor).map((c) => ({ productId: c.productId, quantity: Number(c.quantity) }));
    const res = await editProduct(bomFor, { bom: { outputQty: Number(bom.outputQty) || 1, overhead: Number(bom.overhead) || 0, components } });
    if (res.success) success(`Bill of materials saved for ${nameOf(bomFor)}.`);
    else toastError(res.error || "Could not save.");
  };

  const manufacture = async () => {
    if (!need || !need.components.length) return toastError("Pick an item with a bill of materials and a quantity.");
    const short = need.components.filter((c) => (onHand.get(c.productId) || 0) < c.quantity);
    if (short.length && !window.confirm(`Not enough stock of ${short.map((c) => nameOf(c.productId)).join(", ")}. Record anyway (stock goes negative)?`)) return;
    const res = await addVoucher({
      kind: "manufacture",
      voucherNumber: nextVoucherNumber(journals, "MJ", new Date(run.date)),
      voucherDate: run.date,
      productId: run.productId,
      quantity: Number(run.quantity),
      rate: need.rate,
      cost: need.cost,
      components: need.components,
      godown: run.godown || MAIN_GODOWN,
      batchNo: run.batchNo.trim(),
      expiryDate: run.expiryDate,
      reason: "Manufacture",
    });
    if (res.success) {
      success(`${run.quantity} × ${nameOf(run.productId)} made at ₹${money(need.rate)} each.`);
      setRun((r) => ({ ...r, quantity: "", batchNo: "", expiryDate: "" }));
    } else toastError(res.error);
  };

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Factory className="w-6 h-6 text-blue-600" /> Manufacturing
          </h1>
          <p className="text-sm text-gray-600 mt-1">Define what goes into an item, then record production. Components leave stock; the finished item comes in at their cost.</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Bill of materials</h3>
            <select className={`${field} w-full`} value={bomFor} onChange={(e) => pickBom(e.target.value)}>
              <option value="">Pick the finished item</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.bom?.components?.length ? " · has BOM" : ""}
                </option>
              ))}
            </select>
            {bom && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-3">
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">Makes (quantity)</span>
                    <input type="number" min="0" className={`${field} w-28`} value={bom.outputQty} onChange={(e) => setBom({ ...bom, outputQty: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">Labour / overhead per batch (₹)</span>
                    <input type="number" min="0" className={`${field} w-36`} value={bom.overhead} onChange={(e) => setBom({ ...bom, overhead: e.target.value })} />
                  </label>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-gray-500">
                    <tr>
                      <th className="text-left py-1">Component</th>
                      <th className="text-right py-1 w-28">Quantity</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {bom.components.map((c, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-2">
                          <select className={`${field} w-full`} value={c.productId} onChange={(e) => setComp(i, { productId: e.target.value })}>
                            <option value="">Select</option>
                            {products
                              .filter((p) => p.id !== bomFor)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="py-1">
                          <input type="number" min="0" className={`${field} w-full text-right`} value={c.quantity} onChange={(e) => setComp(i, { quantity: e.target.value })} />
                        </td>
                        <td className="py-1 text-right">
                          <button onClick={() => setBom({ ...bom, components: bom.components.filter((_, j) => j !== i) })} className="p-1.5 text-red-500 hover:bg-red-50 rounded" aria-label="Remove component">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-2">
                  <button onClick={() => setBom({ ...bom, components: [...bom.components, { productId: "", quantity: 1 }] })} className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-700 bg-blue-50 rounded-lg">
                    <Plus className="w-4 h-4" /> Component
                  </button>
                  <button onClick={saveBom} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">
                    <Save className="w-4 h-4" /> Save BOM
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Record production</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="block col-span-2">
                <span className="block text-xs text-gray-600 mb-1">Item made</span>
                <select className={`${field} w-full`} value={run.productId} onChange={(e) => setRun({ ...run, productId: e.target.value })}>
                  <option value="">{withBom.length ? "Select" : "Add a bill of materials first"}</option>
                  {withBom.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs text-gray-600 mb-1">Quantity made</span>
                <input type="number" min="0" className={`${field} w-full`} value={run.quantity} onChange={(e) => setRun({ ...run, quantity: e.target.value })} />
              </label>
              <label className="block">
                <span className="block text-xs text-gray-600 mb-1">Date</span>
                <input type="date" max="9999-12-31" className={`${field} w-full`} value={run.date} onChange={(e) => setRun({ ...run, date: e.target.value })} />
              </label>
              {godowns.length > 1 && (
                <label className="block">
                  <span className="block text-xs text-gray-600 mb-1">Godown</span>
                  <select className={`${field} w-full`} value={run.godown} onChange={(e) => setRun({ ...run, godown: e.target.value })}>
                    {godowns.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
              )}
              {runProduct?.trackBatches && (
                <>
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">Batch no</span>
                    <input className={`${field} w-full`} value={run.batchNo} onChange={(e) => setRun({ ...run, batchNo: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">Expiry</span>
                    <input type="date" max="9999-12-31" className={`${field} w-full`} value={run.expiryDate} onChange={(e) => setRun({ ...run, expiryDate: e.target.value })} />
                  </label>
                </>
              )}
            </div>
            {need && (
              <table className="w-full text-sm mt-4 tabular-nums">
                <thead className="text-xs uppercase text-gray-500">
                  <tr>
                    <th className="text-left py-1">Consumes</th>
                    <th className="text-right py-1">Qty</th>
                    <th className="text-right py-1">In stock</th>
                    <th className="text-right py-1">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {need.components.map((c) => (
                    <tr key={c.productId} className={(onHand.get(c.productId) || 0) < c.quantity ? "text-red-600" : ""}>
                      <td className="py-1">{nameOf(c.productId)}</td>
                      <td className="py-1 text-right">{c.quantity}</td>
                      <td className="py-1 text-right">{onHand.get(c.productId) ?? 0}</td>
                      <td className="py-1 text-right">{money(c.value)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-1" colSpan={3}>
                      Cost of {run.quantity} (incl. overhead) · ₹{money(need.rate)} each
                    </td>
                    <td className="py-1 text-right">{money(need.cost)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            <button onClick={manufacture} className="mt-4 flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Hammer className="w-4 h-4" /> Record production
            </button>
          </section>
        </div>

        <section className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <h3 className="px-4 py-3 border-b border-gray-200 font-semibold text-gray-900">Manufacturing journals</h3>
          <table className="w-full text-sm min-w-[720px] tabular-nums">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left">No.</th>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Item</th>
                <th className="px-4 py-2.5 text-right">Qty</th>
                <th className="px-4 py-2.5 text-right">Cost</th>
                <th className="px-4 py-2.5 text-left">Components</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.map((j) => (
                <tr key={j.id}>
                  <td className="px-4 py-2.5 font-semibold text-blue-700">{j.voucherNumber}</td>
                  <td className="px-4 py-2.5">{j.voucherDate}</td>
                  <td className="px-4 py-2.5">
                    {nameOf(j.productId)}
                    {j.batchNo ? <span className="text-xs text-gray-500"> · {j.batchNo}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 text-right">{j.quantity}</td>
                  <td className="px-4 py-2.5 text-right">{money(j.cost)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{(j.components || []).map((c) => `${nameOf(c.productId)} × ${c.quantity}`).join(", ")}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => window.confirm(`Delete ${j.voucherNumber}?`) && removeVoucher(j.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" aria-label="Delete journal">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!runs.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    No production recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
