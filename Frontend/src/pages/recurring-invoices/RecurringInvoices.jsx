import React, { useMemo, useState } from "react";
import { ArrowLeft, Edit, MoreVertical, Pause, Play, Plus, Search, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCustomers, useProducts, useRecurringInvoices } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";

const schedules = ["Week", "2 Weeks", "Month", "2 Months", "3 Months", "6 Months", "Year"];
const paymentTerms = ["Due on Receipt", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60"];
const emptyItem = { productId: "", productName: "", quantity: 1, rate: 0, amount: 0 };
const emptyForm = {
  customerId: "", customerName: "", profileName: "", orderNumber: "", repeatEvery: "Month",
  startOn: new Date().toISOString().slice(0, 10), endsOn: "", neverExpires: true,
  paymentTerms: "Due on Receipt", salesperson: "", projectIds: [], hours: "",
  items: [{ ...emptyItem }], discount: 0, tds: 0, adjustment: 0, roundOff: false,
  customerNotes: "Thanks for your business.", termsAndConditions: "",
};

const fieldClass = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function explainFirestoreError(error) {
  if (!error) return "";
  if (error.code === "permission-denied" || error.message?.toLowerCase().includes("permission")) {
    return "Firestore denied access to users/{your UID}/recurringInvoices. Make sure you are signed in and deploy the latest firestore.rules file to the same Firebase project configured in Frontend/.env.";
  }
  if (error.code === "unauthenticated") return "Your Firebase session has expired. Sign in again before loading recurring invoices.";
  return error.message || "Unable to load recurring invoices.";
}

function explainSaveError(error) {
  if (error?.code === "permission-denied" || error?.message?.toLowerCase().includes("permission")) {
    return "Firestore denied saving users/{your UID}/recurringInvoices. Deploy firestore.rules for project billing-software-19d79, then sign in again and retry.";
  }
  return error?.message || "Unable to save recurring invoice.";
}

function nextDate(startOn, repeatEvery) {
  const date = new Date(`${startOn}T00:00:00`);
  if (repeatEvery === "Week") date.setDate(date.getDate() + 7);
  else if (repeatEvery === "2 Weeks") date.setDate(date.getDate() + 14);
  else date.setMonth(date.getMonth() + ({ Month: 1, "2 Months": 2, "3 Months": 3, "6 Months": 6, Year: 12 }[repeatEvery] || 1));
  return date.toISOString().slice(0, 10);
}

function getStatus(profile) {
  if (profile.status === "Paused") return "Paused";
  if (!profile.neverExpires && profile.endsOn && new Date(profile.endsOn) < new Date()) return "Expired";
  return "Active";
}

function RecurringForm({ form, setForm, products, customers, editingId, onSave, onCancel }) {
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const updateItem = (index, name, value) => setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [name]: value, amount: Number(name === "quantity" ? value : item.quantity) * Number(name === "rate" ? value : item.rate) } : item) }));
  const chooseProduct = (index, productId) => {
    const product = products.find((item) => item.id === productId);
    setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, productId, productName: product?.name || "", rate: Number(product?.price) || 0, amount: (Number(item.quantity) || 1) * (Number(product?.price) || 0) } : item) }));
  };
  const subtotal = useMemo(() => form.items.reduce((sum, item) => sum + Number(item.amount || 0), 0), [form.items]);
  const discountAmount = subtotal * Number(form.discount || 0) / 100;
  const tdsAmount = (subtotal - discountAmount) * Number(form.tds || 0) / 100;
  const rawTotal = subtotal - discountAmount - tdsAmount + Number(form.adjustment || 0);
  const total = form.roundOff ? Math.round(rawTotal) : rawTotal;

  return (
    <form onSubmit={(event) => onSave(event, { ...form, subtotal, discount: discountAmount, tds: tdsAmount, total, nextRunDate: nextDate(form.startOn, form.repeatEvery) })} className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Recurring Invoice Details</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm">Customer Name *<select required value={form.customerId} onChange={(event) => update("customerId", event.target.value)} className={fieldClass}><option value="">Select customer</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm">Profile Name *<input required value={form.profileName} onChange={(event) => update("profileName", event.target.value)} className={fieldClass} /></label>
          <label className="text-sm">Order Number<input value={form.orderNumber} onChange={(event) => update("orderNumber", event.target.value)} className={fieldClass} /></label>
          <label className="text-sm">Repeat Every *<select required value={form.repeatEvery} onChange={(event) => update("repeatEvery", event.target.value)} className={fieldClass}>{schedules.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm">Start On<input required type="date" value={form.startOn} onChange={(event) => update("startOn", event.target.value)} className={fieldClass} /></label>
          <label className="text-sm">Ends On<input type="date" disabled={form.neverExpires} value={form.endsOn} onChange={(event) => update("endsOn", event.target.value)} className={`${fieldClass} disabled:bg-slate-100`} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.neverExpires} onChange={(event) => update("neverExpires", event.target.checked)} /> Never Expires</label>
          <label className="text-sm">Payment Terms<select value={form.paymentTerms} onChange={(event) => update("paymentTerms", event.target.value)} className={fieldClass}>{paymentTerms.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm">Salesperson<input value={form.salesperson} onChange={(event) => update("salesperson", event.target.value)} className={fieldClass} /></label>
          <label className="text-sm">Hours<input type="number" min="0" value={form.hours} onChange={(event) => update("hours", event.target.value)} className={fieldClass} /></label>
        </div>
        <p className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-500">There are no active projects for this customer.</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Item Table</h2><div className="flex gap-2"><button type="button" onClick={() => setForm((current) => ({ ...current, items: [...current.items, { ...emptyItem }] }))} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"><Plus className="h-4 w-4" /> Add New Row</button><button type="button" onClick={() => setForm((current) => ({ ...current, items: [...current.items, { ...emptyItem }] }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">Add Items in Bulk</button></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="p-2">Item Details</th><th className="p-2">Quantity</th><th className="p-2">Rate</th><th className="p-2">Amount</th><th /></tr></thead><tbody>{form.items.map((item, index) => <tr key={`${item.productId}-${index}`} className="border-b"><td className="p-2"><select value={item.productId} onChange={(event) => chooseProduct(index, event.target.value)} className={fieldClass}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></td><td className="p-2"><input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, "quantity", Number(event.target.value) || 0)} className={fieldClass} /></td><td className="p-2"><input type="number" min="0" value={item.rate} onChange={(event) => updateItem(index, "rate", Number(event.target.value) || 0)} className={fieldClass} /></td><td className="p-2 font-semibold">₹{Number(item.amount || 0).toFixed(2)}</td><td><button type="button" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} title="Delete item" className="text-red-500"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Customer Notes</h2><textarea value={form.customerNotes} onChange={(event) => update("customerNotes", event.target.value)} rows={4} className={fieldClass} /><h2 className="mb-2 mt-5 text-lg font-semibold">Terms & Conditions</h2><textarea placeholder="Enter the terms and conditions of your business to be displayed in your transaction" value={form.termsAndConditions} onChange={(event) => update("termsAndConditions", event.target.value)} rows={5} className={fieldClass} /></div><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Summary</h2>{[["Sub Total", subtotal], ["Discount", discountAmount], ["TDS", tdsAmount], ["Adjustment", Number(form.adjustment || 0)]].map(([label, value]) => <div key={label} className="mb-3 flex justify-between text-sm"><span>{label}</span><span>₹{Number(value).toFixed(2)}</span></div>)}<label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.roundOff} onChange={(event) => update("roundOff", event.target.checked)} /> Round Off</label><div className="flex justify-between border-t pt-4 text-lg font-bold"><span>Total</span><span>₹{Number(total).toFixed(2)}</span></div><label className="mt-4 block text-sm">Discount %<input type="number" min="0" value={form.discount} onChange={(event) => update("discount", event.target.value)} className={fieldClass} /></label><label className="mt-3 block text-sm">TDS %<input type="number" min="0" value={form.tds} onChange={(event) => update("tds", event.target.value)} className={fieldClass} /></label><label className="mt-3 block text-sm">Adjustment<input type="number" value={form.adjustment} onChange={(event) => update("adjustment", event.target.value)} className={fieldClass} /></label></div></section>
      <div className="flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm">Cancel</button><button type="submit" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white">{editingId ? "Update Recurring Invoice" : "Save Recurring Invoice"}</button></div>
    </form>
  );
}

export default function RecurringInvoices() {
  const location = useLocation();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const { recurringInvoices, loading, error, addRecurringInvoice, editRecurringInvoice, removeRecurringInvoice } = useRecurringInvoices();
  const { allCustomers, error: customerError } = useCustomers();
  const { allProducts, error: productError } = useProducts();
  const isFormPage = location.pathname.endsWith("/new");
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ ...emptyForm });

  const openNew = () => { setEditingId(null); setForm({ ...emptyForm, items: [{ ...emptyItem }] }); navigate("/recurring-invoices/new"); };
  const openEdit = (item) => { setEditingId(item.id); setForm({ ...emptyForm, ...item, items: item.items?.length ? item.items : [{ ...emptyItem }] }); navigate("/recurring-invoices/new"); };
  const save = async (event, payload) => {
    event.preventDefault();
    if (!payload.customerId || !payload.profileName.trim() || !payload.items.some((item) => item.productId && Number(item.quantity) > 0 && Number(item.rate) >= 0)) { showError("Customer, profile, schedule, start date, and one valid item are required."); return; }
    if (!payload.neverExpires && (!payload.endsOn || payload.endsOn <= payload.startOn)) { showError("Ends On must be after Start On."); return; }
    const customer = allCustomers.find((item) => item.id === payload.customerId);
    const data = { ...payload, customerName: customer?.name || payload.customerName, status: "Active", lastRunDate: payload.lastRunDate || "" };
    try { if (editingId) await editRecurringInvoice(editingId, data); else await addRecurringInvoice(data); success(editingId ? "Recurring invoice updated." : "Recurring invoice created."); navigate("/recurring-invoices"); } catch (saveError) { showError(explainSaveError(saveError)); }
  };
  const remove = async (item) => { if (!window.confirm(`Delete ${item.profileName}? Generated invoices will remain.`)) return; await removeRecurringInvoice(item.id); success("Recurring invoice deleted."); };
  const togglePause = async (item) => { const status = getStatus(item); if (status === "Expired") return; await editRecurringInvoice(item.id, { status: status === "Paused" ? "Active" : "Paused" }); success(status === "Paused" ? "Recurring invoice resumed." : "Recurring invoice paused."); };
  const visible = recurringInvoices.filter((item) => `${item.profileName} ${item.customerName}`.toLowerCase().includes(search.toLowerCase()));

  if (isFormPage) {
    return (
      <main className="mx-auto max-w-6xl pb-10 font-mazzard">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate("/recurring-invoices")}
              className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"
            >
              <ArrowLeft className="h-4 w-4" /> All Recurring Invoices
            </button>
            <h1 className="text-2xl font-bold text-slate-900">New Recurring Invoice</h1>
          </div>
        </div>
        <RecurringForm
          form={form}
          setForm={setForm}
          products={allProducts}
          customers={allCustomers}
          editingId={editingId}
          onSave={save}
          onCancel={() => navigate("/recurring-invoices")}
        />
      </main>
    );
  }

  return (
    <section className="mx-auto max-w-7xl pb-8 font-mazzard">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Recurring Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">Manage profiles that create invoices on a schedule.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> New
          </button>
          <button title="More options" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Search className="h-5 w-5 text-slate-400" />
        <input
          placeholder="Search in Recurring Invoices"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full max-w-md bg-transparent py-2 text-sm outline-none"
        />
      </div>

      {loading ? (
        <div className="rounded-lg border bg-white p-10 text-center text-slate-500">
          Loading recurring invoices...
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-14 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Create. Set. Repeat.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Set up a profile to periodically create and send invoices to your customers.
          </p>
          <button
            onClick={openNew}
            className="mt-6 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            CREATE NEW RECURRING INVOICE
          </button>
          <button className="mt-4 block w-full text-sm text-blue-600 hover:underline">
            Import Recurring Invoices
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-left">Profile Name</th>
                <th className="p-4 text-left">Customer</th>
                <th className="p-4 text-left">Repeat Every</th>
                <th className="p-4 text-left">Start Date</th>
                <th className="p-4 text-left">Next Invoice</th>
                <th className="p-4 text-left">Amount</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((item) => {
                const status = getStatus(item);
                return (
                  <tr key={item.id}>
                    <td className="p-4 font-medium">{item.profileName}</td>
                    <td className="p-4">{item.customerName}</td>
                    <td className="p-4">{item.repeatEvery}</td>
                    <td className="p-4">{item.startOn}</td>
                    <td className="p-4">{item.nextRunDate}</td>
                    <td className="p-4">₹{Number(item.total || 0).toFixed(2)}</td>
                    <td className="p-4">{status}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(item)} title="Edit">
                          <Edit className="h-4 w-4 text-slate-600 hover:text-blue-600" />
                        </button>
                        <button
                          onClick={() => togglePause(item)}
                          title={status === "Paused" ? "Resume" : "Pause"}
                        >
                          {status === "Paused" ? (
                            <Play className="h-4 w-4 text-green-600" />
                          ) : (
                            <Pause className="h-4 w-4 text-orange-600" />
                          )}
                        </button>
                        <button onClick={() => remove(item)} title="Delete">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
