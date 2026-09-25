import React, { useState, useRef, useCallback } from "react";
import {
  ScanBarcode, Loader2, Warehouse, X, CheckCircle2, AlertTriangle, Package,
} from "lucide-react";
import { useBarcodeIndex, useStockOut } from "../../hooks/useWarehouse";
import { useToast } from "../../context/ToastContext";
import { PageContainer, PageHeader } from "../../components/warehouse/WarehouseUI";
import { useOperator, ROLES } from "../../context/OperatorContext";

export default function StockOut() {
  const { resolveBarcode } = useBarcodeIndex();
  const { stockOut } = useStockOut();
  const { role, hasPermission } = useOperator();
  const toast = useToast();

  const inputRef = useRef(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [product, setProduct] = useState(null);
  const [currentStock, setCurrentStock] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [referenceNo, setReferenceNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [removing, setRemoving] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const canStockOut = hasPermission("stock_out");

  const handleResolve = useCallback(async () => {
    const bc = barcodeInput.trim();
    if (!bc) return;
    setProduct(null);
    setNotFound(false);
    setErrorMsg(null);
    setLastResult(null);
    setResolving(true);

    const result = await resolveBarcode(bc);
    setResolving(false);

    if (result.found) {
      setProduct(result.product);
      setCurrentStock(Number(result.product?.stock) || result.stock?.quantity || 0);
      setQuantity(1);
    } else {
      setNotFound(true);
    }
  }, [barcodeInput, resolveBarcode]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleResolve();
  };

  const handleStockOut = useCallback(async () => {
    if (!product || quantity <= 0) return;

    if (quantity > currentStock) {
      setErrorMsg(`Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`);
      return;
    }

    setErrorMsg(null);
    setRemoving(true);

    const result = await stockOut({
      barcode: product.barcode || barcodeInput,
      quantity: Number(quantity),
      referenceNo,
      remarks,
    });
    setRemoving(false);

    if (result.success) {
      setLastResult({ product, removed: quantity, newQuantity: result.newQuantity });
      setCurrentStock(result.newQuantity);
      toast.success(`−${quantity} ${product.name} dispatched`);
      setBarcodeInput("");
      setProduct(null);
      setQuantity(1);
      setReferenceNo("");
      setRemarks("");
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setErrorMsg(result.error || "Stock-out failed.");
    }
  }, [product, quantity, currentStock, referenceNo, remarks, stockOut, barcodeInput, toast]);

  return (
    <PageContainer>
      <PageHeader title="Stock Out" subtitle="Dispatch / issue inventory with quantity validation" />

      {/* Role notice if Manager (view-only) */}
      {!canStockOut && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3 text-amber-800 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-amber-600" />
          <span>You are in <strong>{role}</strong> role. Stock Out is view-only for this session.</span>
        </div>
      )}

      {/* Barcode Search Box */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 lg:p-5 space-y-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Product Barcode
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scan or type barcode, press Enter…"
              className="w-full px-4 py-3 font-mono text-base bg-gray-100 border-0 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {resolving && (
              <Loader2 size={16} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            )}
          </div>
          <button
            type="button"
            onClick={handleResolve}
            disabled={resolving || !barcodeInput.trim()}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            Find
          </button>
        </div>

        {notFound && (
          <p className="text-sm text-red-600">
            Product not found for this barcode.
          </p>
        )}
      </div>

      {/* Product Card & Quantity */}
      {product && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 lg:p-5 space-y-4 animate-fade-in-up">
          <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-gray-200">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Package size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{product.name}</h3>
              <p className="text-xs text-gray-500 font-mono">Barcode: {product.barcode}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Available Live Stock</p>
              <p className={`text-xl font-bold ${currentStock === 0 ? "text-red-600" : "text-gray-900"}`}>
                {currentStock}
              </p>
            </div>
          </div>

          {currentStock === 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700 text-sm">
              <AlertTriangle size={18} className="shrink-0" />
              <span>Cannot dispatch. This product is completely out of stock.</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Dispatch Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    max={currentStock}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={!canStockOut}
                    className="w-full px-3 py-2 text-center font-bold text-lg disabled:opacity-50 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Invoice / Ref No.</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g. INV-1002"
                    disabled={!canStockOut}
                    className="w-full px-3 py-2 text-sm disabled:opacity-50 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Reason / Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Customer sale, damage"
                    disabled={!canStockOut}
                    className="w-full px-3 py-2 text-sm disabled:opacity-50 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                  <AlertTriangle size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleStockOut}
                disabled={removing || !canStockOut || quantity <= 0 || quantity > currentStock}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {removing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Validating & Dispatching…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Confirm Stock Out (−{quantity})
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Success Feedback */}
      {lastResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 lg:p-5 flex items-center gap-4 animate-fade-in-up">
          <CheckCircle2 size={24} className="text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-green-900 truncate">{lastResult.product.name}</p>
            <p className="text-sm text-green-700">
              −{lastResult.removed} units dispatched · Remaining stock: <strong>{lastResult.newQuantity}</strong>
            </p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
