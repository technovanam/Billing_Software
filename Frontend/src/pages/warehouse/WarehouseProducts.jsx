import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Package, Plus, Tag, BoxSelect, CheckCircle2,
  Eye, Edit2, Trash2, Loader2, RefreshCw,
} from "lucide-react";
import { useWarehouseStats, useProducts } from "../../hooks/useWarehouse";
import { useToast } from "../../context/ToastContext";
import ProductManualAdd from "./ProductManualAdd";
import {
  PageContainer, PageHeader, TableCard, EmptyRow, SkeletonRows, SearchInput, Modal,
  btnPrimary, btnSecondary, btnDanger, btnIcon, inputClass, labelClass,
  theadClass, thClass, tbodyClass,
} from "../../components/warehouse/WarehouseUI";

const STATUS_STYLES = {
  IN_STOCK:     { cls: "bg-green-100 text-green-800", label: "In Stock" },
  LOW_STOCK:    { cls: "bg-amber-100 text-amber-800", label: "Low Stock" },
  OUT_OF_STOCK: { cls: "bg-red-100 text-red-800",     label: "Out of Stock" },
};

const formatINR = (n) => (n > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "—");

const DetailField = ({ label, children, danger }) => (
  <div className={`p-3 rounded-xl border ${danger ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
    <p className={`text-xs font-semibold uppercase tracking-wider ${danger ? "text-red-600" : "text-gray-500"}`}>{label}</p>
    <div className="mt-1 text-sm font-semibold text-gray-900">{children}</div>
  </div>
);

DetailField.propTypes = { label: PropTypes.string, children: PropTypes.node, danger: PropTypes.bool };

// ─── View Product Modal ───────────────────────────────────────────────────────
const ViewProductModal = ({ product, onClose, onEdit }) => {
  if (!product) return null;
  const ss = STATUS_STYLES[product.status] || STATUS_STYLES.IN_STOCK;
  const unit = product.unit || "units";

  return (
    <Modal
      title={product.name}
      icon={<Package className="w-5 h-5 text-blue-600 shrink-0" />}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btnSecondary}>Close</button>
          <button
            onClick={() => {
              onClose();
              onEdit(product);
            }}
            className={btnPrimary}
          >
            <Edit2 size={14} />
            Edit Product
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${ss.cls}`}>
            <CheckCircle2 size={12} />
            {ss.label}
          </span>
          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full">
            Category: {product.category || "General"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DetailField label="Barcode"><span className="font-mono">{product.barcode || "—"}</span></DetailField>
          <DetailField label="Unit of Measure">{product.unit || "Piece"}</DetailField>
          <DetailField label="Purchase Price">{formatINR(product.purchasePrice)}</DetailField>
          <DetailField label="Sale Price">{formatINR(product.price)}</DetailField>
          <DetailField label="Usable Live Stock">
            <span className={product.stock === 0 ? "text-red-600" : "text-green-600"}>
              {(product.stock ?? 0).toLocaleString("en-IN")} {unit}
            </span>
          </DetailField>
          <DetailField label="Damaged / Wastage" danger>
            <span className="text-red-600">
              {(product.damagedStock ?? 0).toLocaleString("en-IN")} {unit}
            </span>
          </DetailField>
          <DetailField label="Min Alert Level">
            {product.minStockLevel > 0 ? `${product.minStockLevel} units` : "Not set"}
          </DetailField>
        </div>

        {product.description && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Description</p>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100">{product.description}</p>
          </div>
        )}
      </div>
    </Modal>
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
    <Modal
      title="Edit Product"
      icon={<Edit2 className="w-5 h-5 text-blue-600" />}
      onClose={loading ? undefined : onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="wp-name" className={labelClass}>Product Name *</label>
          <input id="wp-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="wp-barcode" className={labelClass}>Barcode</label>
            <input id="wp-barcode" type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} className={`${inputClass} font-mono`} />
          </div>
          <div>
            <label htmlFor="wp-category" className={labelClass}>Category</label>
            <input id="wp-category" type="text" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="wp-unit" className={labelClass}>Unit</label>
            <input id="wp-unit" type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Piece, Box, etc." className={inputClass} />
          </div>
          <div>
            <label htmlFor="wp-purchase" className={labelClass}>Purchase Price ₹</label>
            <input id="wp-purchase" type="number" min="0" step="any" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="wp-price" className={labelClass}>Sale Price ₹</label>
            <input id="wp-price" type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="wp-min" className={labelClass}>Min Stock Alert Level</label>
          <input id="wp-min" type="number" min="0" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} placeholder="e.g. 10" className={inputClass} />
        </div>

        <div>
          <label htmlFor="wp-desc" className={labelClass}>Description / Notes</label>
          <textarea id="wp-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional notes or specifications" className={`${inputClass} resize-none`} />
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={loading} className={`${btnSecondary} flex-1`}>
            Cancel
          </button>
          <button type="submit" disabled={loading || !name.trim()} className={`${btnPrimary} flex-1`}>
            {loading ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
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
    <Modal onClose={loading ? undefined : onClose} maxWidth="max-w-md">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
          <Trash2 size={22} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Product</h3>
        <p className="text-sm text-gray-600 mb-5">
          Are you sure you want to delete <strong className="text-gray-900">{product.name}</strong>
          {product.barcode ? ` (${product.barcode})` : ""}? This will remove the item from your catalog.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <button type="button" onClick={onClose} disabled={loading} className={`${btnSecondary} flex-1`}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className={`${btnDanger} flex-1`}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {loading ? "Deleting…" : "Delete Product"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

DeleteProductModal.propTypes = {
  product: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

const COLS = 9;

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

  const renderTableBody = () => {
    if (productsLoading) return <SkeletonRows cols={COLS} />;
    if (filteredProducts.length === 0) {
      return (
        <EmptyRow
          colSpan={COLS}
          message={
            products.length === 0
              ? 'No products registered yet. Click "Add Product" to get started.'
              : "No products match your search or filter."
          }
        />
      );
    }
    return filteredProducts.map((p) => {
      const ss = STATUS_STYLES[p.status] || STATUS_STYLES.IN_STOCK;
      return (
        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
          <td className="px-4 sm:px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                <BoxSelect size={15} />
              </div>
              <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{p.name}</span>
            </div>
          </td>
          <td className="px-4 sm:px-6 py-4">
            <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{p.barcode || "—"}</span>
          </td>
          <td className="px-4 sm:px-6 py-4">
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Tag size={12} className="text-gray-400" />
              {p.category || "General"}
            </div>
          </td>
          <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{p.unit || "Piece"}</td>
          <td className="px-4 sm:px-6 py-4 text-right text-sm text-gray-700">{formatINR(p.purchasePrice)}</td>
          <td className="px-4 sm:px-6 py-4 text-right text-sm font-medium text-gray-900">{formatINR(p.price)}</td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <span
              className={`text-sm font-bold ${
                p.stock === 0 ? "text-red-600" : p.status === "LOW_STOCK" ? "text-amber-600" : "text-green-700"
              }`}
            >
              {(p.stock ?? 0).toLocaleString("en-IN")}
            </span>
            {p.minStockLevel > 0 && <span className="block text-xs text-gray-400">min {p.minStockLevel}</span>}
            {p.damagedStock > 0 && (
              <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                <Trash2 size={10} /> {p.damagedStock} dmg
              </span>
            )}
          </td>
          <td className="px-4 sm:px-6 py-4 text-center">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${ss.cls}`}>
              {ss.label}
            </span>
          </td>
          <td className="px-4 sm:px-6 py-4">
            <div className="flex items-center justify-center gap-1">
              <button type="button" onClick={() => setViewingProduct(p)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Product Details" aria-label="View">
                <Eye size={16} />
              </button>
              <button type="button" onClick={() => setEditingProduct(p)} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Edit Product" aria-label="Edit">
                <Edit2 size={16} />
              </button>
              <button type="button" onClick={() => setDeletingProduct(p)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Product" aria-label="Delete">
                <Trash2 size={16} />
              </button>
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Product Management"
        subtitle="Manage your warehouse product catalog, pricing, and live inventory levels"
        actions={
          <>
            <SearchInput value={productSearch} onChange={setProductSearch} placeholder="Search by name, barcode or category..." />
            <button onClick={() => setIsManualAddOpen(true)} className={btnPrimary}>
              <Plus className="w-4 h-4" />
              Add Product
            </button>
            <button onClick={refetchProducts} className={btnIcon} title="Refresh Products" aria-label="Refresh Products">
              <RefreshCw className="w-4 h-4" />
            </button>
          </>
        }
      />

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              statusFilter === st
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {st === "ALL" ? "All" : STATUS_STYLES[st]?.label || st}
          </button>
        ))}
        <span className="text-sm text-gray-500 sm:ml-auto">{filteredProducts.length} items</span>
      </div>

      <TableCard minWidth="min-w-[960px]">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={thClass}>Product</th>
            <th scope="col" className={thClass}>Barcode</th>
            <th scope="col" className={thClass}>Category</th>
            <th scope="col" className={thClass}>Unit</th>
            <th scope="col" className={`${thClass} text-right`}>Purchase ₹</th>
            <th scope="col" className={`${thClass} text-right`}>Sale ₹</th>
            <th scope="col" className={`${thClass} text-right`}>Stock</th>
            <th scope="col" className={`${thClass} text-center`}>Status</th>
            <th scope="col" className={`${thClass} text-center`}>Actions</th>
          </tr>
        </thead>
        <tbody className={tbodyClass}>{renderTableBody()}</tbody>
      </TableCard>

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

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={handleUpdateProduct}
          loading={actionLoading}
        />
      )}

      {deletingProduct && (
        <DeleteProductModal
          product={deletingProduct}
          onClose={() => setDeletingProduct(null)}
          onConfirm={handleDeleteProduct}
          loading={actionLoading}
        />
      )}

      {isManualAddOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto">
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
    </PageContainer>
  );
}
