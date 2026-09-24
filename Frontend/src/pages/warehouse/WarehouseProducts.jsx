import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Package, Plus, Search, Tag, BoxSelect, CheckCircle2,
  Eye, Edit2, Trash2, X, Loader2, RefreshCw,
} from "lucide-react";
import { useWarehouseStats, useProducts } from "../../hooks/useWarehouse";
import { useToast } from "../../context/ToastContext";
import ProductManualAdd from "./ProductManualAdd";

const STATUS_STYLES = {
  IN_STOCK:     { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "In Stock" },
  LOW_STOCK:    { cls: "bg-amber-50 text-amber-700 border-amber-200",       label: "Low Stock" },
  OUT_OF_STOCK: { cls: "bg-rose-50 text-rose-700 border-rose-200",         label: "Out of Stock" },
};

// ─── View Product Modal ───────────────────────────────────────────────────────
const ViewProductModal = ({ product, onClose, onEdit }) => {
  if (!product) return null;
  const ss = STATUS_STYLES[product.status] || STATUS_STYLES.IN_STOCK;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Package size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 truncate max-w-xs">{product.name}</h2>
              <p className="text-xs text-slate-400 font-mono">Barcode: {product.barcode || "No barcode"}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status + Category Row */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${ss.cls}`}>
              <CheckCircle2 size={12} />
              {ss.label}
            </span>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              Category: {product.category || "General"}
            </span>
          </div>

          {/* Key specs grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-400">Barcode</p>
              <p className="font-mono font-bold text-slate-800 mt-0.5">{product.barcode || "—"}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-400">Unit of Measure</p>
              <p className="font-bold text-slate-800 mt-0.5">{product.unit || "Piece"}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-400">Purchase Price</p>
              <p className="font-bold text-slate-800 mt-0.5">
                {product.purchasePrice > 0 ? `₹${product.purchasePrice.toLocaleString("en-IN")}` : "—"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-400">Sale Price</p>
              <p className="font-bold text-slate-800 mt-0.5">
                {product.price > 0 ? `₹${product.price.toLocaleString("en-IN")}` : "—"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-400">Usable Live Stock</p>
              <p className={`text-lg font-extrabold mt-0.5 ${product.stock === 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {(product.stock ?? 0).toLocaleString("en-IN")} {product.unit || "units"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-red-50 border border-red-100">
              <p className="text-xs font-semibold text-red-600">Damaged / Wastage</p>
              <p className="text-lg font-extrabold mt-0.5 text-red-600">
                {(product.damagedStock ?? 0).toLocaleString("en-IN")} {product.unit || "units"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-400">Min Alert Level</p>
              <p className="font-bold text-slate-800 mt-0.5">
                {product.minStockLevel > 0 ? `${product.minStockLevel} units` : "Not set"}
              </p>
            </div>
          </div>



          {/* Description */}
          {product.description && (
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</p>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl leading-relaxed">{product.description}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onEdit(product);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Edit2 size={13} />
            Edit Product
          </button>
        </div>
      </div>
    </div>
  );
};

ViewProductModal.propTypes = {
  product: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
};

// ─── Edit Product Modal ───────────────────────────────────────────────────────
const EditProductModal = ({ product, onClose, onSave, loading }) => {
  const [name, setName] = useState(product?.name || "");
  const [barcode, setBarcode] = useState(product?.barcode || "");
  const [category, setCategory] = useState(product?.category || "General");
  const [unit, setUnit] = useState(product?.unit || "Piece");
  const [price, setPrice] = useState(product?.price ?? "");
  const [purchasePrice, setPurchasePrice] = useState(product?.purchasePrice ?? "");
  const [minStockLevel, setMinStockLevel] = useState(product?.minStockLevel ?? "");
  const [description, setDescription] = useState(product?.description || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      barcode: barcode.trim(),
      category: category.trim(),
      unit: unit.trim(),
      price: Number(price) || 0,
      purchasePrice: Number(purchasePrice) || 0,
      minStockLevel: Number(minStockLevel) || 0,
      description: description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Edit2 size={18} className="text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Edit Product</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode</label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Piece, Box, etc."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Price ₹</label>
              <input
                type="number"
                min="0"
                step="any"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sale Price ₹</label>
              <input
                type="number"
                min="0"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Min Stock Alert Level</label>
            <input
              type="number"
              min="0"
              value={minStockLevel}
              onChange={(e) => setMinStockLevel(e.target.value)}
              placeholder="e.g. 10"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional notes or specifications"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {loading ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

EditProductModal.propTypes = {
  product: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

// ─── Delete Product Confirmation Modal ────────────────────────────────────────
const DeleteProductModal = ({ product, onClose, onConfirm, loading }) => {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <Trash2 size={24} />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Confirm Product Deletion</h3>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Are you sure you want to delete <strong className="text-slate-800">{product.name}</strong>
          {product.barcode ? ` (${product.barcode})` : ""}? This will remove the item from your catalog.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 px-4 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 px-4 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            {loading ? "Deleting…" : "Delete Product"}
          </button>
        </div>
      </div>
    </div>
  );
};

DeleteProductModal.propTypes = {
  product: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

// ─── Main Warehouse Products Page ─────────────────────────────────────────────
export default function WarehouseProducts() {
  const {
    products,
    loading: productsLoading,
    refetch: refetchProducts,
    updateProduct,
    deleteProduct,
  } = useProducts();
  const { refetch: refetchStats } = useWarehouseStats();
  const toast = useToast();

  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Product Action States
  const [viewingProduct, setViewingProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !productSearch.trim() ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()));
      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [products, productSearch, statusFilter]);

  // Handle Edit Save
  const handleUpdateProduct = async (updateData) => {
    if (!editingProduct) return;
    setActionLoading(true);
    try {
      await updateProduct(editingProduct.id, updateData);
      toast.success(`"${updateData.name}" updated successfully!`);
      setEditingProduct(null);
      refetchStats();
    } catch (err) {
      toast.error(err.message || "Failed to update product");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Confirm
  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    setActionLoading(true);
    try {
      await deleteProduct(deletingProduct.id);
      toast.success(`"${deletingProduct.name}" deleted successfully!`);
      setDeletingProduct(null);
      refetchStats();
    } catch (err) {
      toast.error(err.message || "Failed to delete product");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your warehouse product catalog, pricing, and live inventory levels
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsManualAddOpen(true)}
            className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
          <button
            onClick={refetchProducts}
            className="p-2 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 text-gray-500 transition-colors shadow-xs"
            title="Refresh Products"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Available Products Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Table Top Header */}
        <div className="p-4 lg:p-5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Available Products
              <span className="ml-2 text-xs font-medium text-slate-400">
                ({filteredProducts.length} items)
              </span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Real-time inventory levels, prices, and stock alerts</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status filter pills */}
            {["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                  statusFilter === s
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                }`}
              >
                {s === "ALL" ? "All" : STATUS_STYLES[s]?.label || s}
              </button>
            ))}

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search name, barcode…"
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white w-48"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {productsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-14 text-center">
            <Package size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-500">
              {products.length === 0
                ? "No products registered yet. Click \"Add Product\" to get started."
                : "No products match your search or filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200">
                  <th className="px-5 py-3">Product</th>
                  <th className="px-4 py-3">Barcode</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Purchase ₹</th>
                  <th className="px-4 py-3 text-right">Sale ₹</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((p) => {
                  const ss = STATUS_STYLES[p.status] || STATUS_STYLES.IN_STOCK;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 border border-blue-100">
                            <BoxSelect size={15} />
                          </div>
                          <span className="font-semibold text-gray-900 truncate max-w-[180px]">
                            {p.name}
                          </span>
                        </div>
                      </td>

                      {/* Barcode */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {p.barcode || "—"}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-slate-600 text-xs">
                          <Tag size={12} className="text-slate-400" />
                          {p.category || "General"}
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="px-4 py-3 text-xs text-slate-500">{p.unit || "Piece"}</td>

                      {/* Purchase price */}
                      <td className="px-4 py-3 text-right text-xs font-medium text-slate-700">
                        {p.purchasePrice > 0 ? `₹${p.purchasePrice.toLocaleString("en-IN")}` : "—"}
                      </td>

                      {/* Sale price */}
                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-900">
                        {p.price > 0 ? `₹${p.price.toLocaleString("en-IN")}` : "—"}
                      </td>

                      {/* Stock qty */}
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-sm font-bold ${
                            p.stock === 0
                              ? "text-rose-600"
                              : p.status === "LOW_STOCK"
                              ? "text-amber-600"
                              : "text-emerald-700"
                          }`}
                        >
                          {(p.stock ?? 0).toLocaleString("en-IN")}
                        </span>
                        {p.minStockLevel > 0 && (
                          <span className="block text-[10px] text-slate-400">
                            min {p.minStockLevel}
                          </span>
                        )}
                        {p.damagedStock > 0 && (
                          <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-50 text-red-600 border border-red-200">
                            <Trash2 size={10} /> {p.damagedStock} dmg
                          </span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${ss.cls}`}
                        >
                          <CheckCircle2 size={11} />
                          {ss.label}
                        </span>
                      </td>

                      {/* Actions: View, Edit, Delete */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingProduct(p)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Product Details"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingProduct(p)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProduct(p)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 size={15} />
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
      </div>

      {/* View Product Details Modal */}
      {viewingProduct && (
        <ViewProductModal
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
          onEdit={(prod) => {
            setViewingProduct(null);
            setEditingProduct(prod);
          }}
        />
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={handleUpdateProduct}
          loading={actionLoading}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <DeleteProductModal
          product={deletingProduct}
          onClose={() => setDeletingProduct(null)}
          onConfirm={handleDeleteProduct}
          loading={actionLoading}
        />
      )}

      {/* Manual Add Product Modal */}
      {isManualAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg">
            <ProductManualAdd
              barcode={`EAN-${Date.now().toString().slice(-8)}`}
              onSuccess={() => {
                setIsManualAddOpen(false);
                refetchProducts();
                refetchStats();
              }}
              onCancel={() => setIsManualAddOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
