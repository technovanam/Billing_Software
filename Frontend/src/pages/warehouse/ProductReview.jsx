import React, { useState } from "react";
import PropTypes from "prop-types";
import { Package, X, CheckCircle2, Globe, Lock } from "lucide-react";
import { useCreateWarehouseProduct } from "../../hooks/useWarehouse";
import { useToast } from "../../context/ToastContext";

const UNITS = ["Piece", "Box", "Kilogram", "Gram", "Meter", "Litre", "Hour", "Dozen", "Pair", "Bag", "Tube", "Pack"];

export default function ProductReview({ barcode, prefill, source, onSuccess, onCancel }) {
  const { createProduct } = useCreateWarehouseProduct();
  const toast = useToast();

  const [form, setForm] = useState({
    name: prefill?.name || "",
    brand: prefill?.brand || "",
    category: prefill?.category || "",
    sku: "",
    unit: "Piece",
    price: "",
    purchasePrice: "",
    hsn: "",
    barcode: barcode || "",
    imageUrl: prefill?.imageUrl || "",
    minStockLevel: "10",
    description: "",
  });

  const [initialQty, setInitialQty] = useState(1);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Product name is required.");
      return;
    }

    setSaving(true);
    const result = await createProduct({
      ...form,
      name: form.name.trim(),
      barcode: String(form.barcode || "").trim(),
      initialQuantity: Number(initialQty) || 0,
    });
    setSaving(false);

    if (result.success) {
      toast.success(`"${form.name}" confirmed with ${initialQty} ${form.unit} initial stock.`);
      onSuccess(result.product, initialQty);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
            <Package size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Confirm Product Details</p>
            {source && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Globe size={11} className="text-emerald-600" />
                Data found via <span className="font-semibold capitalize">{source}</span>
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
        {/* Barcode (locked) */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Barcode <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={form.barcode}
              readOnly
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono text-slate-700 outline-none cursor-not-allowed pr-8"
            />
            <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Product Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Product Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={set("name")}
            placeholder="Product title"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            required
            autoFocus
          />
        </div>

        {/* Brand & Category */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
            <input
              type="text"
              value={form.brand}
              onChange={set("brand")}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <input
              type="text"
              value={form.category}
              onChange={set("category")}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* SKU & Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={set("sku")}
              placeholder="Internal SKU"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
            <select
              value={form.unit}
              onChange={set("unit")}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Price (₹)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.purchasePrice}
              onChange={set("purchasePrice")}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price (₹)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.price}
              onChange={set("price")}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Initial Stock Assignment */}
        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
          <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Opening Stock</p>
          <div>
            <label className="block text-xs font-semibold text-emerald-800 mb-1">Quantity to Stock In</label>
            <input
              type="number"
              min="0"
              value={initialQty}
              onChange={(e) => setInitialQty(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-sm font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            {saving ? "Confirming…" : "Confirm & Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

ProductReview.propTypes = {
  barcode: PropTypes.string.isRequired,
  prefill: PropTypes.object,
  source: PropTypes.string,
  onSuccess: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
