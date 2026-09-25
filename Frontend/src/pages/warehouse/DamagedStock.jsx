import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Trash2, AlertTriangle, RotateCcw, Plus, Package, TrendingDown, ShieldAlert, Archive,
} from "lucide-react";
import { useDamagedStock, useProducts } from "../../hooks/useWarehouse";
import { useOperator } from "../../context/OperatorContext";
import { useToast } from "../../context/ToastContext";
import {
  PageContainer, PageHeader, StatCard, StatGrid, Card, TableCard, SkeletonRows, SearchInput, Modal,
  btnDanger, btnSecondary, inputClass, labelClass, theadClass, thClass, tbodyClass,
} from "../../components/warehouse/WarehouseUI";

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

  const COLS = 7;

  const renderTableBody = () => {
    if (loading) return <SkeletonRows cols={COLS} />;
    if (filteredRecords.length === 0) {
      return (
        <tr>
          <td colSpan={COLS} className="text-center text-sm text-gray-500 py-12">
            <p>
              {damagedRecords.length === 0
                ? "No products have been marked as damaged."
                : "No damaged records match your current filter or search."}
            </p>
            {damagedRecords.length === 0 && (
              <button onClick={() => handleOpenModal()} className={`${btnDanger} mt-4`}>
                <Plus className="w-4 h-4" />
                Report First Damaged Item
              </button>
            )}
          </td>
        </tr>
      );
    }
    return filteredRecords.map((r) => {
      const reasonObj = DAMAGE_REASONS.find((d) => d.value === r.reason) || DAMAGE_REASONS[6];
      const value = (r.quantity || 0) * (r.purchasePrice || r.price || 0);

      return (
        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
          <td className="px-4 sm:px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{r.productName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {r.productBarcode && (
                    <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 rounded">{r.productBarcode}</span>
                  )}
                  <span className="text-xs text-gray-400">{r.category}</span>
                </div>
              </div>
            </div>
          </td>
          <td className="px-4 sm:px-6 py-4 text-center">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 whitespace-nowrap">
              {r.quantity} {r.unit || "units"}
            </span>
          </td>
          <td className="px-4 sm:px-6 py-4 text-right text-sm text-gray-700">
            {value > 0 ? `₹${value.toLocaleString("en-IN")}` : "—"}
          </td>
          <td className="px-4 sm:px-6 py-4">
            <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium border whitespace-nowrap ${reasonObj.color}`}>
              {reasonObj.label}
            </span>
            {r.remarks && (
              <p className="text-xs text-gray-400 mt-1 italic max-w-xs truncate" title={r.remarks}>
                &quot;{r.remarks}&quot;
              </p>
            )}
          </td>
          <td className="px-4 sm:px-6 py-4">
            <div className="text-sm text-gray-700">{r.operatorName || "Operator"}</div>
            <div className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">{formatDate(r.createdAt)}</div>
          </td>
          <td className="px-4 sm:px-6 py-4 text-center">
            {r.status === "DAMAGED" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-800 bg-red-100 px-2.5 py-0.5 rounded-full">
                Damaged
              </span>
            )}
            {r.status === "RESTORED" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-800 bg-green-100 px-2.5 py-0.5 rounded-full">
                <RotateCcw size={10} />
                Restored
              </span>
            )}
            {r.status === "SCRAPPED" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                <Archive size={10} />
                Written Off
              </span>
            )}
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            {r.status === "DAMAGED" ? (
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => handleRestore(r)}
                  className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors flex items-center gap-1"
                  title="Restore to Usable Live Stock"
                >
                  <RotateCcw size={12} />
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => handleScrap(r)}
                  className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
                  title="Write off / Scrap"
                >
                  <Archive size={12} />
                  Write Off
                </button>
              </div>
            ) : (
              <span className="text-xs text-gray-400">—</span>
            )}
          </td>
        </tr>
      );
    });
  };

  const quickQtyBtn = "px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200";

  return (
    <PageContainer>
      <PageHeader
        title="Damaged / Wastage Stock"
        subtitle="Separate damaged and non-usable items from live stock. Reporting damage reduces live stock automatically."
        actions={
          <button onClick={() => handleOpenModal()} className={btnDanger}>
            <Plus className="w-4 h-4" />
            Report Damaged Stock
          </button>
        }
      />

      <StatGrid cols={4}>
        <StatCard
          title="Total Damaged Units"
          value={totalDamagedUnits.toLocaleString("en-IN")}
          valueLabel="Deducted from live inventory"
          icon={<Trash2 className="w-5 h-5 text-red-500" />}
        />
        <StatCard
          title="Estimated Loss Value"
          value={`₹${totalDamagedValue.toLocaleString("en-IN")}`}
          valueLabel="Based on purchase / retail price"
          icon={<TrendingDown className="w-5 h-5 text-orange-500" />}
        />
        <StatCard
          title="Active Incidents"
          value={activeDamagedRecords.length}
          valueLabel="Awaiting write-off or restoration"
          icon={<ShieldAlert className="w-5 h-5 text-purple-600" />}
        />
        <StatCard
          title="Usable Live Stock"
          value={totalLiveUsableUnits.toLocaleString("en-IN")}
          valueLabel="Ready for sale & dispatch"
          icon={<Package className="w-5 h-5 text-green-500" />}
        />
      </StatGrid>

      {/* Filters & Search */}
      <Card>
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search product, barcode, reason, remarks..."
            className="w-full md:flex-1"
          />
          <div className="w-full md:w-64">
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className={inputClass}
              aria-label="Filter by reason"
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

        <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-200 flex-wrap">
          <span className="text-sm text-gray-500 mr-1">Status:</span>
          {[
            { id: "ALL", label: `All (${damagedRecords.length})` },
            { id: "DAMAGED", label: `Active Damaged (${activeDamagedRecords.length})` },
            { id: "RESTORED", label: "Restored to Live" },
            { id: "SCRAPPED", label: "Written Off / Scrapped" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors border ${
                selectedStatus === tab.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Damaged Stock Records Table */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Damaged / Wastage Stock Log
            <span className="ml-2 text-sm font-normal text-gray-500">({filteredRecords.length} records)</span>
          </h3>
          <p className="text-sm text-gray-500">Audit trail of goods separated from inventory</p>
        </div>
        <TableCard minWidth="min-w-[980px]">
          <thead className={theadClass}>
            <tr>
              <th scope="col" className={thClass}>Product</th>
              <th scope="col" className={`${thClass} text-center`}>Damaged Qty</th>
              <th scope="col" className={`${thClass} text-right`}>Est. Value</th>
              <th scope="col" className={thClass}>Reason</th>
              <th scope="col" className={thClass}>Reported By / Date</th>
              <th scope="col" className={`${thClass} text-center`}>Status</th>
              <th scope="col" className={`${thClass} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className={tbodyClass}>{renderTableBody()}</tbody>
        </TableCard>
      </div>

      {/* Report Damaged Stock Modal */}
      {isModalOpen && (
        <Modal
          title="Report Damaged / Wastage Stock"
          icon={<Trash2 className="w-5 h-5 text-red-600 shrink-0" />}
          onClose={isSubmitting ? undefined : () => setIsModalOpen(false)}
        >
          <form onSubmit={handleSubmitDamage} className="space-y-4">
            <p className="text-sm text-gray-500 -mt-1">
              Deduct product from live stock and separate it into damaged stock.
            </p>

            <div>
              <label htmlFor="ds-product" className={labelClass}>Select Product *</label>
              <select
                id="ds-product"
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setModalQuantity(1);
                }}
                required
                className={inputClass}
              >
                <option value="">-- Choose a Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.barcode ? `(${p.barcode})` : ""} — Live Stock: {p.stock}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg text-sm">
              <span className="text-gray-600">Available Live Stock:</span>
              <span className="font-bold text-gray-900">{availableLiveStock} {modalProduct?.unit || "units"}</span>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <label htmlFor="ds-qty" className="text-sm text-gray-700">Quantity to Mark Damaged *</label>
                <span className="text-xs text-red-600">1 unit reduces live stock by 1</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalQuantity((q) => Math.max(1, Number(q) - 1))}
                  disabled={modalQuantity <= 1}
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg disabled:opacity-40 transition-colors"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <input
                  id="ds-qty"
                  type="number"
                  min="1"
                  max={availableLiveStock > 0 ? availableLiveStock : 1}
                  value={modalQuantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setModalQuantity(isNaN(val) ? 1 : Math.max(1, val));
                  }}
                  required
                  className={`${inputClass} flex-1 text-center font-bold text-base`}
                />
                <button
                  type="button"
                  onClick={() => setModalQuantity((q) => Math.min(availableLiveStock, Number(q) + 1))}
                  disabled={modalQuantity >= availableLiveStock}
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg disabled:opacity-40 transition-colors"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              {availableLiveStock > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <button type="button" onClick={() => setModalQuantity(1)} className={quickQtyBtn}>
                    1 Unit
                  </button>
                  {availableLiveStock >= 5 && (
                    <button type="button" onClick={() => setModalQuantity(5)} className={quickQtyBtn}>
                      5 Units
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setModalQuantity(availableLiveStock)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Max ({availableLiveStock})
                  </button>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="ds-reason" className={labelClass}>Reason for Damage / Wastage *</label>
              <select id="ds-reason" value={modalReason} onChange={(e) => setModalReason(e.target.value)} className={inputClass}>
                {DAMAGE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ds-remarks" className={labelClass}>Remarks / Incident Notes (Optional)</label>
              <textarea
                id="ds-remarks"
                value={modalRemarks}
                onChange={(e) => setModalRemarks(e.target.value)}
                placeholder="e.g. Box dropped during transfer, liquid leak detected..."
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm space-y-1">
              <div className="flex items-center gap-1.5 text-red-800 font-semibold">
                <AlertTriangle size={14} className="text-red-600" />
                <span>Stock Adjustment Preview</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1 text-gray-700 text-xs">
                <span>Usable Live Stock:</span>
                <span className="font-semibold text-red-600">
                  {availableLiveStock} → {Math.max(0, availableLiveStock - modalQuantity)} units (-{modalQuantity})
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-700 text-xs">
                <span>Damaged Stock Pool:</span>
                <span className="font-semibold text-red-700">+ {modalQuantity} units</span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || availableLiveStock < modalQuantity || modalQuantity <= 0}
                className={btnDanger}
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
        </Modal>
      )}
    </PageContainer>
  );
}
