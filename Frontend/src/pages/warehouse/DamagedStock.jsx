import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Trash2,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Package,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  FileText,
  Warehouse,
  ChevronDown,
  X,
  TrendingDown,
  ShieldAlert,
  Archive,
  ArrowRight,
} from "lucide-react";
import { useDamagedStock, useProducts } from "../../hooks/useWarehouse";
import { useOperator } from "../../context/OperatorContext";
import { useToast } from "../../context/ToastContext";

const DAMAGE_REASONS = [
  { value: "Physical Damage / Broken", label: "Broken / Physical Damage", color: "bg-red-50 text-red-700 border-red-200" },
  { value: "Expired / Past Date", label: "Expired / Past Date", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "Water / Moisture / Leakage", label: "Water / Moisture / Leakage", color: "bg-sky-50 text-sky-700 border-sky-200" },
  { value: "Manufacturing Defect", label: "Manufacturing Defect", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "Packaging Torn / Defective", label: "Packaging Torn / Defective", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "Wastage / Spoilage", label: "Wastage / Spoilage", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { value: "Other", label: "Other / Unspecified", color: "bg-slate-50 text-slate-700 border-slate-200" },
];

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts?._seconds ? new Date(ts._seconds * 1000) : ts?.toDate ? ts.toDate() : new Date(ts);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function DamagedStock() {
  const { damagedRecords, activeDamagedRecords, totalDamagedUnits, totalDamagedValue, loading, recordDamage, restoreDamage, scrapDamage } =
    useDamagedStock();
  const { products } = useProducts();
  const { operatorName } = useOperator();
  const toast = useToast();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL"); // ALL, DAMAGED, RESTORED, SCRAPPED

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalReason, setModalReason] = useState(DAMAGE_REASONS[0].value);
  const [modalRemarks, setModalRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected product object in modal
  const modalProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Current live stock
  const availableLiveStock = useMemo(() => {
    if (!modalProduct) return 0;
    return Number(modalProduct.stock) || 0;
  }, [modalProduct]);

  // Open modal handler
  const handleOpenModal = (prefillProductId = "") => {
    if (prefillProductId) {
      setSelectedProductId(prefillProductId);
    } else if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
    setModalQuantity(1);
    setModalReason(DAMAGE_REASONS[0].value);
    setModalRemarks("");
    setIsModalOpen(true);
  };

  // Submit Damage Report
  const handleSubmitDamage = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast.error("Please select a product");
      return;
    }
    if (modalQuantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (modalQuantity > availableLiveStock) {
      toast.error(`Cannot report more than available live stock (${availableLiveStock} units available)`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordDamage({
        productId: selectedProductId,
        barcode: modalProduct?.barcode || "",
        quantity: Number(modalQuantity),
        reason: modalReason,
        remarks: modalRemarks,
      });

      if (res.success) {
        setIsModalOpen(false);
        setModalQuantity(1);
        setModalRemarks("");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Restore damage handler
  const handleRestore = async (record) => {
    const confirmRestore = window.confirm(
      `Restore ${record.quantity} unit(s) of "${record.productName}" back to Usable Live Stock?`
    );
    if (!confirmRestore) return;

    await restoreDamage(record.id, `Restored by ${operatorName || "Operator"}`);
  };

  // Scrap damage handler
  const handleScrap = async (record) => {
    const confirmScrap = window.confirm(
      `Permanently write off / scrap ${record.quantity} unit(s) of "${record.productName}"? This confirms item disposal.`
    );
    if (!confirmScrap) return;

    await scrapDamage(record.id, `Written off / discarded by ${operatorName || "Operator"}`);
  };

  // Filtered damaged records
  const filteredRecords = useMemo(() => {
    return damagedRecords.filter((rec) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (rec.productName || "").toLowerCase().includes(q);
        const matchesBarcode = (rec.productBarcode || "").toLowerCase().includes(q);
        const matchesReason = (rec.reason || "").toLowerCase().includes(q);
        const matchesRemarks = (rec.remarks || "").toLowerCase().includes(q);
        if (!matchesName && !matchesBarcode && !matchesReason && !matchesRemarks) return false;
      }
      // Reason
      if (selectedReason && rec.reason !== selectedReason) return false;
      // Status
      if (selectedStatus !== "ALL" && rec.status !== selectedStatus) return false;

      return true;
    });
  }, [damagedRecords, searchQuery, selectedReason, selectedStatus]);

  // Total Live Usable Stock
  const totalLiveUsableUnits = useMemo(() => {
    return products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  }, [products]);

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0 shadow-xs">
            <Trash2 size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Damaged / Wastage Stock</h1>
            <p className="text-sm text-slate-500 mt-1">
              Separate damaged and non-usable items from usable live stock. Adding to damaged stock reduces live stock automatically.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleOpenModal()}
            className="bg-red-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Report Damaged Stock
          </button>
        </div>
      </header>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Damaged Units */}
        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-600">Total Damaged Units</h3>
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <Trash2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-red-600">{totalDamagedUnits.toLocaleString("en-IN")}</p>
          <p className="text-xs text-slate-500 mt-1">Deducted from live inventory</p>
        </div>

        {/* Estimated Loss Value */}
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700">Estimated Loss Value</h3>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">₹{totalDamagedValue.toLocaleString("en-IN")}</p>
          <p className="text-xs text-slate-500 mt-1">Based on purchase / retail price</p>
        </div>

        {/* Active Damage Records */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Active Incidents</h3>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{activeDamagedRecords.length}</p>
          <p className="text-xs text-slate-500 mt-1">Awaiting write-off or restoration</p>
        </div>

        {/* Usable Live Stock */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">Usable Live Stock</h3>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-700">{totalLiveUsableUnits.toLocaleString("en-IN")}</p>
          <p className="text-xs text-slate-500 mt-1">Ready for sale &amp; dispatch</p>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name, barcode, reason, remarks..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
            />
          </div>

          {/* Reason Filter */}
          <div className="w-full md:w-64">
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-red-500 text-slate-700 font-medium"
            >
              <option value="">All Reasons</option>
              {DAMAGE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Status:</span>
          {[
            { id: "ALL", label: `All (${damagedRecords.length})` },
            { id: "DAMAGED", label: `Active Damaged (${activeDamagedRecords.length})` },
            { id: "RESTORED", label: "Restored to Live" },
            { id: "SCRAPPED", label: "Written Off / Scrapped" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
                selectedStatus === tab.id
                  ? "bg-red-600 text-white shadow-xs font-bold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Damaged Stock Records Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Damaged / Wastage Stock Log
              <span className="ml-2 text-xs font-normal text-slate-400">({filteredRecords.length} records)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live audit trail of goods separated from inventory
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Damaged Stock Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {damagedRecords.length === 0
                ? "No products have been marked as damaged. Your inventory is 100% usable!"
                : "No damaged records match your current filter or search."}
            </p>
            {damagedRecords.length === 0 && (
              <button
                onClick={() => handleOpenModal()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors"
              >
                + Report First Damaged Item
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-4 py-3.5 text-center">Damaged Qty</th>
                  <th className="px-4 py-3.5 text-right">Est. Value</th>
                  <th className="px-4 py-3.5">Reason</th>
                  <th className="px-4 py-3.5">Reported By / Date</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => {
                  const reasonObj = DAMAGE_REASONS.find((d) => d.value === r.reason) || DAMAGE_REASONS[6];
                  const value = (r.quantity || 0) * (r.purchasePrice || r.price || 0);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Product Name & Barcode */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold shrink-0">
                            <Trash2 size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate max-w-[200px]">{r.productName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {r.productBarcode && (
                                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                                  {r.productBarcode}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400">{r.category}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Damaged Quantity */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-700 border border-red-200">
                          {r.quantity} {r.unit || "units"}
                        </span>
                      </td>

                      {/* Est Value */}
                      <td className="px-4 py-3.5 text-right font-medium text-slate-800 text-xs">
                        {value > 0 ? `₹${value.toLocaleString("en-IN")}` : "—"}
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium border ${reasonObj.color}`}>
                          {reasonObj.label}
                        </span>
                        {r.remarks && (
                          <p className="text-[11px] text-slate-400 mt-1 italic max-w-xs truncate" title={r.remarks}>
                            "{r.remarks}"
                          </p>
                        )}
                      </td>

                      {/* Reported By & Date */}
                      <td className="px-4 py-3.5">
                        <div className="text-xs text-slate-700 font-medium">{r.operatorName || "Operator"}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(r.createdAt)}</div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        {r.status === "DAMAGED" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Damaged
                          </span>
                        )}
                        {r.status === "RESTORED" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <RotateCcw size={10} />
                            Restored
                          </span>
                        )}
                        {r.status === "SCRAPPED" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <Archive size={10} />
                            Written Off
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        {r.status === "DAMAGED" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRestore(r)}
                              className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                              title="Restore to Usable Live Stock"
                            >
                              <RotateCcw size={12} />
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => handleScrap(r)}
                              className="px-2 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                              title="Write off / Scrap"
                            >
                              <Archive size={12} />
                              Write Off
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No action needed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Report Damaged Stock Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-red-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Report Damaged / Wastage Stock</h2>
                  <p className="text-xs text-slate-500">Deduct product from live stock and separate into damaged stock</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmitDamage} className="p-6 space-y-4">
              {/* Product Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Product *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setModalQuantity(1);
                  }}
                  required
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-medium"
                >
                  <option value="">-- Choose a Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.barcode ? `(${p.barcode})` : ""} — Live Stock: {p.stock}
                    </option>
                  ))}
                </select>
              </div>

              {/* Available Stock Indicator */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <span className="text-slate-600 font-medium">Available Live Stock:</span>
                <span className="font-bold text-slate-900">{availableLiveStock} {modalProduct?.unit || "units"}</span>
              </div>

              {/* Quantity Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Quantity to Mark Damaged *
                  </label>
                  <span className="text-xs text-red-600 font-semibold">
                    1 unit will reduce 1 live stock
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalQuantity((q) => Math.max(1, Number(q) - 1))}
                    disabled={modalQuantity <= 1}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg disabled:opacity-40 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={availableLiveStock > 0 ? availableLiveStock : 1}
                    value={modalQuantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setModalQuantity(isNaN(val) ? 1 : Math.max(1, val));
                    }}
                    required
                    className="flex-1 text-center py-2 text-base font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setModalQuantity((q) => Math.min(availableLiveStock, Number(q) + 1))}
                    disabled={modalQuantity >= availableLiveStock}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg disabled:opacity-40 transition-colors"
                  >
                    +
                  </button>
                </div>
                {availableLiveStock > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setModalQuantity(1)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      1 Unit
                    </button>
                    {availableLiveStock >= 5 && (
                      <button
                        type="button"
                        onClick={() => setModalQuantity(5)}
                        className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        5 Units
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setModalQuantity(availableLiveStock)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      Max ({availableLiveStock})
                    </button>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason for Damage / Wastage *
                </label>
                <select
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-red-500 font-medium"
                >
                  {DAMAGE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Remarks / Incident Notes (Optional)
                </label>
                <textarea
                  value={modalRemarks}
                  onChange={(e) => setModalRemarks(e.target.value)}
                  placeholder="e.g. Box dropped during forklift transfer, liquid leak detected..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-red-500 resize-none"
                />
              </div>

              {/* Live Impact Preview Notice */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-red-800 font-bold">
                  <AlertTriangle size={14} className="text-red-600" />
                  <span>Stock Adjustment Preview</span>
                </div>
                <div className="flex items-center justify-between text-slate-700 text-[11px]">
                  <span>Usable Live Stock:</span>
                  <span className="font-semibold text-rose-600">
                    {availableLiveStock} → {Math.max(0, availableLiveStock - modalQuantity)} units (-{modalQuantity})
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700 text-[11px]">
                  <span>Damaged Stock Pool:</span>
                  <span className="font-semibold text-red-700">
                    + {modalQuantity} units
                  </span>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || availableLiveStock < modalQuantity || modalQuantity <= 0}
                  className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Moving to Damaged...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Confirm &amp; Deduct from Live Stock
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
