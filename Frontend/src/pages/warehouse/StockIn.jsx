import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowDown, ScanBarcode, Package, CheckCircle2, Loader2,
  Warehouse, Plus, X, AlertTriangle,
} from "lucide-react";
import { useBarcodeIndex, useStockIn } from "../../hooks/useWarehouse";
import { useToast } from "../../context/ToastContext";
import { useOperator, ROLES } from "../../context/OperatorContext";

export default function StockIn() {
  const { resolveBarcode } = useBarcodeIndex();
  const { stockIn } = useStockIn();
  const { role, hasPermission } = useOperator();
  const toast = useToast();

  // Barcode / product state
  const inputRef = useRef(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [product, setProduct] = useState(null);
  const [currentStock, setCurrentStock] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Stock-in form
  const [quantity, setQuantity] = useState(1);
  const [referenceNo, setReferenceNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [adding, setAdding] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const canStockIn = hasPermission("stock_in");

  const handleResolve = useCallback(async () => {
    const bc = barcodeInput.trim();
    if (!bc) return;
    setProduct(null);
    setNotFound(false);
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

  const handleStockIn = useCallback(async () => {
    if (!product || quantity <= 0) return;
    setAdding(true);

    const result = await stockIn({
      barcode: product.barcode || barcodeInput,
      quantity: Number(quantity),
      referenceNo,
      remarks,
    });
    setAdding(false);

    if (result.success) {
      setLastResult({ product, added: quantity, newQuantity: result.newQuantity });
      toast.success(`+${quantity} ${product.name} added to stock`);
      setBarcodeInput("");
      setProduct(null);
      setQuantity(1);
      setReferenceNo("");
      setRemarks("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [product, quantity, referenceNo, remarks, stockIn, barcodeInput, toast]);

  return (
    <div className="w-full space-y-6">


      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700">
          <ArrowDown size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock In</h1>
          <p className="text-sm text-slate-500">Add inventory units with movement logging</p>
        </div>
      </div>

      {/* Role notice if Manager (view-only) */}
      {!canStockIn && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3 text-amber-800 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-amber-600" />
          <span>You are in <strong>{role}</strong> role. Stock In is view-only for this session.</span>
        </div>
      )}

      {/* Barcode Search Box */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
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
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base outline-none focus:ring-2 focus:ring-emerald-500"
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
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            Find
          </button>
        </div>

        {notFound && (
          <p className="text-xs text-rose-600 font-medium">
            Product not found for this barcode. Go to Barcode Scanner to register it.
          </p>
        )}
      </div>

      {/* Product Details & Quantity Input */}
      {product && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 animate-fade-in-up">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Package size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 truncate">{product.name}</h3>
              <p className="text-xs text-slate-400 font-mono">Barcode: {product.barcode}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-medium">Current Stock</p>
              <p className="text-lg font-extrabold text-slate-800">{currentStock}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={!canStockIn}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / PO No.</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. PO-8921"
                disabled={!canStockIn}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes"
                disabled={!canStockIn}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleStockIn}
            disabled={adding || !canStockIn || quantity <= 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            {adding ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Committing Stock In…
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                Confirm Stock In (+{quantity})
              </>
            )}
          </button>
        </div>
      )}

      {/* Success Feedback */}
      {lastResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4 animate-fade-in-up">
          <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-emerald-900">{lastResult.product.name}</p>
            <p className="text-sm text-emerald-700">
              +{lastResult.added} units added · New stock: <strong>{lastResult.newQuantity}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
