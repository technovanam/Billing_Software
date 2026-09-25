import React, { useState } from "react";
import PropTypes from "prop-types";
import { Trash2, PlusCircle, CheckCircle2, AlertTriangle, XCircle, UserPlus } from "lucide-react";

const rupees = (paise) =>
  paise === null || paise === undefined ? "—" : `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_STYLES = {
  matched: { row: "border-emerald-200 bg-emerald-50", icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />, label: "Matched" },
  ambiguous: { row: "border-amber-300 bg-amber-50", icon: <AlertTriangle className="h-4 w-4 text-amber-600" />, label: "Choose product" },
  unmatched: { row: "border-red-300 bg-red-50", icon: <XCircle className="h-4 w-4 text-red-600" />, label: "Not found" },
};

function CreateProductForm({ item, onCreate, onCancel }) {
  const [name, setName] = useState(item.spokenName);
  const [price, setPrice] = useState("");
  const [hsn, setHsn] = useState("");
  const [unit, setUnit] = useState(item.spokenUnit || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !(Number(price) > 0)) {
      setError("Enter a name and a price above zero.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await onCreate(item.key, { name, priceRupees: price, hsn, unit });
    setSaving(false);
    if (!res?.success) setError("Could not create the product.");
  };

  return (
    <form onSubmit={submit} className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-red-200 bg-white p-2" data-testid="ai-create-product-form">
      <input className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" aria-label="Product name" />
      <input className="rounded border border-slate-300 px-2 py-1 text-xs" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (₹)" inputMode="decimal" aria-label="Price" />
      <input className="rounded border border-slate-300 px-2 py-1 text-xs" value={hsn} onChange={(e) => setHsn(e.target.value)} placeholder="HSN code" aria-label="HSN code" />
      <input className="rounded border border-slate-300 px-2 py-1 text-xs" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit (kg, piece…)" aria-label="Unit" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">Cancel</button>
        <button type="submit" disabled={saving} className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
          {saving ? "Saving…" : "Create"}
        </button>
      </div>
      {error && <p className="col-span-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}

CreateProductForm.propTypes = {
  item: PropTypes.object.isRequired,
  onCreate: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

function ItemRow({ item, ai }) {
  const [creating, setCreating] = useState(false);
  const style = STATUS_STYLES[item.status] || STATUS_STYLES.unmatched;
  // A matched line the parser was unsure about is shown amber too.
  const rowClass = item.status === "matched" && item.uncertain ? STATUS_STYLES.ambiguous.row : style.row;

  return (
    <li className={`rounded-xl border p-3 ${rowClass}`} data-testid="ai-draft-item" data-status={item.status} data-uncertain={item.uncertain ? "true" : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            {style.icon}
            <span className="truncate">{item.product?.name || item.spokenName}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {item.status === "matched"
              ? `${item.product.hsn ? `HSN ${item.product.hsn} · ` : ""}${rupees(item.product.pricePaise)} / ${item.product.unitLabel || "unit"}`
              : `${style.label} · you said "${item.spokenName}"`}
          </p>
          {(item.uncertain || item.learned) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.uncertain && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800" data-testid="ai-uncertain-badge">
                  Please check · you said &quot;{item.spokenName}&quot;
                </span>
              )}
              {item.learned && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800" data-testid="ai-learned-badge">
                  {item.learned.label}
                </span>
              )}
            </div>
          )}
        </div>
        <button type="button" onClick={() => ai.removeItem(item.key)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600" aria-label={`Remove ${item.spokenName}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {item.status !== "matched" && item.candidates?.length > 0 && (
        <select
          className="mt-2 w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs"
          defaultValue=""
          onChange={(e) => ai.pickProduct(item.key, item.candidates.find((c) => c.id === e.target.value))}
          aria-label={`Choose product for ${item.spokenName}`}
          data-testid="ai-candidate-select"
        >
          <option value="" disabled>Choose the right product…</option>
          {item.candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.brand ? `${c.brand} ` : ""}{c.name} — {rupees(c.pricePaise)} ({Math.round(c.score * 100)}%)
            </option>
          ))}
        </select>
      )}

      {item.status === "unmatched" &&
        (creating ? (
          <CreateProductForm item={item} onCreate={ai.createProduct} onCancel={() => setCreating(false)} />
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline" data-testid="ai-create-product">
            <PlusCircle className="h-3.5 w-3.5" /> Create new product
          </button>
        ))}

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <label className="flex items-center gap-1 text-slate-600">
          Qty
          <input
            type="number"
            min="0"
            step="any"
            defaultValue={item.qty ?? ""}
            key={`${item.key}-${item.qty}`}
            onBlur={(e) => ai.setItemQty(item.key, e.target.value)}
            className="w-20 rounded border border-slate-300 bg-white px-2 py-0.5"
            aria-label={`Quantity for ${item.spokenName}`}
          />
          <span className="text-slate-500">{item.product?.unitLabel || item.spokenUnit || ""}</span>
        </label>
        <span className="font-semibold text-slate-900">{rupees(item.lineTotalPaise)}</span>
      </div>
    </li>
  );
}

ItemRow.propTypes = { item: PropTypes.object.isRequired, ai: PropTypes.object.isRequired };

function CustomerRow({ customer, ai, customers }) {
  if (!customer) return null;
  if (customer.status === "matched") {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${customer.uncertain ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
        data-testid="ai-draft-customer"
        data-status="matched"
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span className="font-semibold text-slate-900">{customer.name}</span>
        {customer.uncertain && <span className="ml-auto text-[10px] font-semibold text-amber-800">Please check</span>}
      </div>
    );
  }
  if (customer.status === "new") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm" data-testid="ai-draft-customer" data-status="new">
        <UserPlus className="h-4 w-4 text-sky-600" />
        <span className="text-slate-900">New walk-in customer: <strong>{customer.name}</strong></span>
      </div>
    );
  }
  const ambiguous = customer.status === "ambiguous";
  const options = ambiguous ? customer.candidates : customers;
  return (
    <div className={`rounded-xl border p-3 text-sm ${ambiguous ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50"}`} data-testid="ai-draft-customer" data-status={customer.status}>
      <p className="flex items-center gap-1.5 font-semibold text-slate-900">
        {ambiguous ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
        {ambiguous ? `More than one customer matches "${customer.spokenName}"` : `No customer named "${customer.spokenName}"`}
      </p>
      <select
        className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
        defaultValue=""
        onChange={(e) => {
          const picked = options.find((c) => c.id === e.target.value);
          if (picked) ai.pickCustomer({ id: picked.id, name: picked.name || picked.companyName || picked.displayName });
        }}
        aria-label="Choose customer"
        data-testid="ai-customer-select"
      >
        <option value="" disabled>Choose a customer…</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || c.companyName || c.displayName || [c.firstName, c.lastName].filter(Boolean).join(" ")}
            {c.phone ? ` · ${c.phone}` : ""}
          </option>
        ))}
      </select>
      {!ambiguous && <p className="mt-1 text-[11px] text-slate-500">You can also pick the client on the form after confirming.</p>}
    </div>
  );
}

CustomerRow.propTypes = { customer: PropTypes.object, ai: PropTypes.object.isRequired, customers: PropTypes.array.isRequired };

export default function DraftPreviewPanel({ ai, customers, totals, onConfirm }) {
  const { draft } = ai;
  const hasContent = draft.items.length > 0 || draft.customer;
  if (!hasContent) return null;

  return (
    <div className="space-y-3" data-testid="ai-draft-preview">
      <CustomerRow customer={draft.customer} ai={ai} customers={customers} />

      <ul className="space-y-2">
        {draft.items.map((item) => (
          <ItemRow key={item.key} item={item} ai={ai} />
        ))}
      </ul>

      {(draft.dueInDays !== null || draft.payment?.mode || draft.notes) && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          {draft.dueInDays !== null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Due in {draft.dueInDays} days</span>}
          {draft.payment?.mode && <span className="rounded-full bg-slate-100 px-2 py-0.5 uppercase text-slate-700">Pay: {draft.payment.mode}</span>}
          {draft.notes && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Note: {draft.notes}</span>}
        </div>
      )}

      {totals && (
        <dl className="space-y-1 rounded-xl border border-slate-200 bg-white p-3 text-xs" data-testid="ai-draft-totals">
          {totals.map((row) => (
            <div key={row.label} className={`flex justify-between ${row.strong ? "border-t border-slate-200 pt-1 text-sm font-bold text-slate-900" : "text-slate-600"}`}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
          <p className="pt-1 text-[10px] text-slate-400">Totals use the bill&apos;s current GST settings. Prices come from your product list.</p>
        </dl>
      )}

      {ai.blockers.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-[11px] text-amber-700">
          {ai.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={ai.discard} className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" data-testid="ai-discard">
          Discard
        </button>
        <button
          type="button"
          onClick={() => onConfirm(draft)}
          disabled={!ai.canConfirm}
          className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="ai-confirm"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

DraftPreviewPanel.propTypes = {
  ai: PropTypes.object.isRequired,
  customers: PropTypes.array.isRequired,
  totals: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, value: PropTypes.string, strong: PropTypes.bool })),
  onConfirm: PropTypes.func.isRequired,
};
