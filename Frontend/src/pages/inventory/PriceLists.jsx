// Price lists (price levels): special rates or a flat discount for groups of
// customers. Assign a list on the customer; invoices pick its rates.
import React, { useMemo, useState } from "react";
import { Plus, Save, Trash2, Tags, Search } from "lucide-react";
import { usePriceLists, useProducts, useCustomers } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";
import { priceFor } from "../../utils/priceLists.js";

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const field = "px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function PriceLists() {
  const { priceLists, addPriceList, editPriceList, removePriceList } = usePriceLists();
  const { allProducts } = useProducts();
  const { allCustomers } = useCustomers();
  const { success, error: toastError } = useToast();
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [newName, setNewName] = useState("");
  const [q, setQ] = useState("");

  const selected = priceLists.find((l) => l.id === selectedId) || priceLists[0] || null;
  const working = draft && draft.id === selected?.id ? draft : selected;
  const products = useMemo(() => (allProducts || []).filter((p) => p.isActive !== false && (!q || String(p.name).toLowerCase().includes(q.toLowerCase()))), [allProducts, q]);
  const customersOn = (name) => (allCustomers || []).filter((c) => c.priceList === name).length;

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    if (priceLists.some((l) => l.name.toLowerCase() === name.toLowerCase())) return toastError("A price list with that name exists.");
    const res = await addPriceList({ name, discountPct: 0, rates: {} });
    if (res.success) {
      setNewName("");
      setSelectedId(res.id);
      success(`${name} created.`);
    } else toastError(res.error);
  };

  const edit = (patch) => setDraft({ ...(working || {}), ...patch });
  const setRate = (productId, value) => edit({ rates: { ...(working?.rates || {}), [productId]: value === "" ? undefined : Number(value) } });

  const save = async () => {
    const rates = Object.fromEntries(Object.entries(working.rates || {}).filter(([, v]) => v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v))));
    const res = await editPriceList(working.id, { discountPct: Number(working.discountPct) || 0, rates });
    if (res.success) {
      setDraft(null);
      success(`${working.name} saved.`);
    } else toastError(res.error);
  };

  const remove = async (l) => {
    if (customersOn(l.name)) return toastError(`${customersOn(l.name)} customer(s) use ${l.name}. Move them to another list first.`);
    if (!window.confirm(`Delete price list ${l.name}?`)) return;
    const res = await removePriceList(l.id);
    if (res.success) setSelectedId(null);
    else toastError(res.error);
  };

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tags className="w-6 h-6 text-blue-600" /> Price Lists
          </h1>
          <p className="text-sm text-gray-600 mt-1">Wholesale, dealer or retail rates. Assign a list to a customer and invoices use its rates automatically.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 h-fit">
            <div className="flex gap-2 mb-3">
              <input className={`${field} flex-1 min-w-0`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New list, e.g. Wholesale" onKeyDown={(e) => e.key === "Enter" && create()} />
              <button onClick={create} className="p-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700" aria-label="Add price list">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-1">
              {priceLists.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => {
                      setSelectedId(l.id);
                      setDraft(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between ${selected?.id === l.id ? "bg-blue-50 text-blue-700 font-semibold" : "hover:bg-gray-50"}`}
                  >
                    <span>{l.name}</span>
                    <span className="text-xs text-gray-400">{customersOn(l.name)} customers</span>
                  </button>
                </li>
              ))}
              {!priceLists.length && <li className="text-sm text-gray-500 px-1">No price lists yet.</li>}
            </ul>
          </div>

          {working && (
            <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-200 flex flex-wrap items-end gap-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{working.name}</h3>
                  <p className="text-xs text-gray-500">Items without a special rate get the standard price less this discount.</p>
                </div>
                <label className="block">
                  <span className="block text-xs text-gray-600 mb-1">Discount on standard price %</span>
                  <input type="number" min="0" max="100" className={`${field} w-28`} value={working.discountPct ?? 0} onChange={(e) => edit({ discountPct: e.target.value })} />
                </label>
                <button onClick={save} disabled={!draft} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                  <Save className="w-4 h-4" /> Save
                </button>
                <button onClick={() => remove(working)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" aria-label="Delete price list">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 border-b border-gray-100">
                <div className="relative max-w-sm">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input className={`${field} w-full pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px] tabular-nums">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Product</th>
                      <th className="px-4 py-2.5 text-right">Standard price</th>
                      <th className="px-4 py-2.5 text-right">Special rate</th>
                      <th className="px-4 py-2.5 text-right">Billed at</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2">{p.name}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{money(priceFor(p, null))}</td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" min="0" className={`${field} w-28 text-right`} value={working.rates?.[p.id] ?? ""} onChange={(e) => setRate(p.id, e.target.value)} placeholder="—" />
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">{money(priceFor(p, working))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
