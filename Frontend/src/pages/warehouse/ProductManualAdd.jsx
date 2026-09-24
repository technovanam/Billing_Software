import React, { useState } from "react";
import PropTypes from "prop-types";
import { Package, X, CheckCircle2, Lock } from "lucide-react";
import { useCreateWarehouseProduct } from "../../hooks/useWarehouse";
import { useToast } from "../../context/ToastContext";

const UNITS = ["Piece", "Box", "Kilogram", "Gram", "Meter", "Litre", "Hour", "Dozen", "Pair", "Bag", "Tube", "Pack"];

export default function ProductManualAdd({ barcode, onSuccess, onCancel }) {
  const { createProduct } = useCreateWarehouseProduct();
  const toast = useToast();

  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    sku: "",
    unit: "Piece",
    price: "",
    purchasePrice: "",
    hsn: "",
    barcode: barcode || "",
    imageUrl: "",
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
      toast.success(`"${form.name}" created with ${initialQty} ${form.unit} initial stock.`);
      onSuccess(result.product, initialQty);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
            <Package size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Add Product Manually</p>
            <p className="text-xs text-slate-500">Barcode not found in external databases</p>
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
            placeholder="e.g. Aashirvaad Atta 5kg"
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
              placeholder="e.g. ITC, Nestlé"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <input
              type="text"
              value={form.category}
              onChange={set("category")}
              placeholder="e.g. Groceries"
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
              placeholder="e.g. AASH-5KG"
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

        {/* Purchase Price & Selling Price */}
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

        {/* Min Stock Level & HSN */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Min Stock Alert Level</label>
            <input
              type="number"
              min="0"
              value={form.minStockLevel}
              onChange={set("minStockLevel")}
              placeholder="10"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">HSN Code</label>
            <input
              type="text"
              value={form.hsn}
              onChange={set("hsn")}
              placeholder="e.g. 1905"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Image URL */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Product Image URL</label>
          <input
            type="url"
            value={form.imageUrl}
            onChange={set("imageUrl")}
            placeholder="https://…"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Initial Stock */}
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
          <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">Initial Stock Assignment</p>
          <div>
            <label className="block text-xs font-semibold text-blue-800 mb-1">Initial Quantity *</label>
            <input
              type="number"
              min="0"
              value={initialQty}
              onChange={(e) => setInitialQty(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm font-bold text-center outline-none focus:ring-2 focus:ring-blue-500"
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
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            {saving ? "Saving…" : "Save Product"}
          </button>
        </div>
      </form>
    </div>
  );
}

ProductManualAdd.propTypes = {
  barcode: PropTypes.string.isRequired,
  onSuccess: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
