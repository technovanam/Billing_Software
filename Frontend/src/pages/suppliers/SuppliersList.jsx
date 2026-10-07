// Suppliers (Tally: Sundry Creditors). Their GSTIN/state decide CGST+SGST vs
// IGST on purchase bills, and their balance shows what you owe them.
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, Truck, IndianRupee, Building2 } from "lucide-react";
import { useSuppliers, useVouchers } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";
import { checkGstin } from "../../chatbot/gstin.js";
import { STATES, stateCodeFromGstin, stateName, invoiceTotals } from "../../utils/gst.js";

const blank = { name: "", gstin: "", state: "", address: "", phone: "", email: "", contactPerson: "", openingBalance: 0 };
const field = "w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SuppliersList() {
  const { suppliers, loading, addSupplier, editSupplier, removeSupplier } = useSuppliers();
  const { vouchers: purchases } = useVouchers("purchases");
  const { vouchers: debitNotes } = useVouchers("debitNotes");
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  // Payable = opening balance + purchases − debit notes − paid on purchases.
  const balances = useMemo(() => {
    const map = new Map();
    const bump = (id, v) => map.set(id, (map.get(id) || 0) + v);
    for (const p of purchases || []) bump(p.partyId, invoiceTotals(p).total - Number(p.paidAmount || 0));
    for (const d of debitNotes || []) bump(d.partyId, -invoiceTotals(d).total);
    return map;
  }, [purchases, debitNotes]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (suppliers || [])
      .filter((s) => !q || [s.name, s.gstin, s.phone, s.state].some((t) => String(t || "").toLowerCase().includes(q)))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [suppliers, search]);

  const totalPayable = rows.reduce((s, r) => s + Number(r.openingBalance || 0) + (balances.get(r.id) || 0), 0);

  const setField = (k) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [k]: value };
      if (k === "gstin") {
        const code = stateCodeFromGstin(value);
        if (code) next.state = stateName(code);
      }
      return next;
    });
  };

  const save = async () => {
    if (!form.name.trim()) {
      toastError("Supplier name is required.");
      return;
    }
    const check = form.gstin.trim() ? checkGstin(form.gstin) : null;
    if (check && !check.valid) {
      toastError(`GSTIN looks wrong: ${check.problems[0]}`);
      return;
    }
    const doc = { ...form, name: form.name.trim(), gstin: form.gstin.trim().toUpperCase(), openingBalance: Number(form.openingBalance) || 0 };
    const res = editingId ? await editSupplier(editingId, doc) : await addSupplier(doc);
    if (res.success) {
      success(`Supplier ${doc.name} ${editingId ? "updated" : "added"}.`);
      setForm(null);
      setEditingId(null);
    } else toastError(`Could not save: ${res.error}`);
  };

  const remove = async (s) => {
    if ((purchases || []).some((p) => p.partyId === s.id)) {
      toastError(`${s.name} has purchase bills. Delete those first.`);
      return;
    }
    if (!window.confirm(`Delete supplier ${s.name}?`)) return;
    const res = await removeSupplier(s.id);
    if (res.success) success(`${s.name} deleted.`);
    else toastError(`Could not delete: ${res.error}`);
  };

  const gstinCheck = form?.gstin?.trim() ? checkGstin(form.gstin) : null;
  const fromGstin = form ? stateCodeFromGstin(form.gstin) : null;

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
            <p className="text-sm text-gray-600 mt-1">The businesses you buy from (sundry creditors).</p>
          </div>
          <button
            onClick={() => {
              setForm({ ...blank });
              setEditingId(null);
            }}
            className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            [Truck, "Suppliers", rows.length, "bg-blue-100 text-blue-600"],
            [Building2, "GST registered", rows.filter((r) => r.gstin).length, "bg-purple-100 text-purple-600"],
            [IndianRupee, "Total payable", `₹${money(totalPayable)}`, "bg-rose-100 text-rose-600"],
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

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers…" className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-left">GSTIN</th>
                  <th className="px-4 py-3 text-left">State</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-right">Payable</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((s) => {
                  const payable = Number(s.openingBalance || 0) + (balances.get(s.id) || 0);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{s.name}</p>
                        {s.contactPerson && <p className="text-xs text-gray-500">{s.contactPerson}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{s.gstin || "Unregistered"}</td>
                      <td className="px-4 py-3 text-gray-600">{s.state || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{s.phone || "—"}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${payable > 0 ? "text-rose-600" : "text-gray-700"}`}>₹{money(payable)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setForm({ ...blank, ...s });
                              setEditingId(s.id);
                            }}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                            aria-label="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => remove(s)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" aria-label="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      {loading ? "Loading…" : "No suppliers yet. Click Add Supplier."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-lenis-prevent>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? "Edit supplier" : "Add supplier"}</h2>
              <button onClick={() => setForm(null)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block sm:col-span-2">
                <span className="block text-sm text-gray-700 mb-1">Supplier name *</span>
                <input className={field} value={form.name} onChange={setField("name")} />
              </label>
              <label className="block">
                <span className="block text-sm text-gray-700 mb-1">GSTIN</span>
                <input className={`${field} font-mono uppercase`} maxLength={15} value={form.gstin} onChange={setField("gstin")} />
                {gstinCheck && <span className={`text-xs mt-1 block ${gstinCheck.valid ? "text-green-600" : "text-red-600"}`}>{gstinCheck.valid ? `Valid · ${gstinCheck.state}` : gstinCheck.problems[0]}</span>}
              </label>
              <label className="block">
                <span className="block text-sm text-gray-700 mb-1">State</span>
                <select className={field} value={form.state} onChange={setField("state")} disabled={Boolean(fromGstin)}>
                  <option value="">Select state</option>
                  {STATES.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm text-gray-700 mb-1">Phone</span>
                <input className={field} value={form.phone} onChange={setField("phone")} />
              </label>
              <label className="block">
                <span className="block text-sm text-gray-700 mb-1">Email</span>
                <input type="email" className={field} value={form.email} onChange={setField("email")} />
              </label>
              <label className="block">
                <span className="block text-sm text-gray-700 mb-1">Contact person</span>
                <input className={field} value={form.contactPerson} onChange={setField("contactPerson")} />
              </label>
              <label className="block">
                <span className="block text-sm text-gray-700 mb-1">Opening balance payable (₹)</span>
                <input type="number" className={field} value={form.openingBalance} onChange={setField("openingBalance")} />
              </label>
              <label className="block sm:col-span-2">
                <span className="block text-sm text-gray-700 mb-1">Address</span>
                <textarea className={`${field} h-20 resize-none`} value={form.address} onChange={setField("address")} />
              </label>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={save} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                {editingId ? "Save changes" : "Add supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
