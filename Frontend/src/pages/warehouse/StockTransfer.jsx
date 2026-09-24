import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowLeftRight, ScanBarcode, Loader2, Warehouse, ArrowRight,
  CheckCircle2, AlertTriangle, Package,
} from "lucide-react";
import { useGodowns, useBarcodeIndex, useStockTransfer } from "../../hooks/useWarehouse";
import { useToast } from "../../context/ToastContext";
import { useOperator, ROLES } from "../../context/OperatorContext";

export default function StockTransfer() {
  const { godowns, loading: loadingGodowns } = useGodowns();
  const { resolveBarcode } = useBarcodeIndex();
  const { transfer } = useStockTransfer();
  const { role, hasPermission } = useOperator();
  const toast = useToast();

  const [fromGodown, setFromGodown] = useState(null);
  const [toGodown, setToGodown] = useState(null);

  const inputRef = useRef(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [product, setProduct] = useState(null);
  const [sourceStock, setSourceStock] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [remarks, setRemarks] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const canTransfer = hasPermission("transfer");

  useEffect(() => {
    if (godowns.length >= 2) {
      if (!fromGodown) setFromGodown(godowns[0]);
      if (!toGodown) setToGodown(godowns[1]);
    } else if (godowns.length === 1) {
      if (!fromGodown) setFromGodown(godowns[0]);
    }
  }, [godowns, fromGodown, toGodown]);

  const handleResolve = useCallback(async () => {
    const bc = barcodeInput.trim();
    if (!bc) return;
    setProduct(null);
    setNotFound(false);
    setErrorMsg(null);
    setLastResult(null);
    setResolving(true);

    const result = await resolveBarcode(bc, fromGodown?.id);
    setResolving(false);

    if (result.found) {
      setProduct(result.product);
      setSourceStock(result.stock?.quantity || 0);
      setQuantity(1);
    } else {
      setNotFound(true);
    }
  }, [barcodeInput, fromGodown, resolveBarcode]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleResolve();
  };

  const handleTransfer = useCallback(async () => {
    if (!product || !fromGodown || !toGodown || quantity <= 0) return;
    if (fromGodown.id === toGodown.id) {
      setErrorMsg("Source and destination godowns must be different.");
      return;
    }
    if (quantity > sourceStock) {
      setErrorMsg(`Insufficient stock in ${fromGodown.name}. Available: ${sourceStock}, Requested: ${quantity}`);
      return;
    }

    setErrorMsg(null);
    setTransferring(true);

    const result = await transfer({
      barcode: product.barcode || barcodeInput,
      fromGodownId: fromGodown.id,
      toGodownId: toGodown.id,
      quantity: Number(quantity),
      remarks,
    });
    setTransferring(false);

    if (result.success) {
      setLastResult({
        product,
        quantity,
        fromName: fromGodown.name,
        toName: toGodown.name,
        sourceQty: result.sourceQty,
        destQty: result.destQty,
      });
      toast.success(`Transferred ${quantity} ${product.name} from ${fromGodown.name} to ${toGodown.name}`);
      setBarcodeInput("");
      setProduct(null);
      setQuantity(1);
      setRemarks("");
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setErrorMsg(result.error || "Transfer failed.");
    }
  }, [product, fromGodown, toGodown, quantity, sourceStock, remarks, transfer, barcodeInput, toast]);

  if (loadingGodowns) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (godowns.length < 2) {
    return (
      <div className="w-full space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <Warehouse className="mx-auto text-slate-300" size={48} />
          <h2 className="text-lg font-bold text-slate-800">At least 2 godowns are required</h2>
          <p className="text-sm text-slate-500">
            You currently have {godowns.length} godown. Please create another godown to enable stock transfers.
          </p>
          <a
            href="/warehouse/godowns"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
          >
            Manage Godowns →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">


      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-700">
          <ArrowLeftRight size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Transfer</h1>
          <p className="text-sm text-slate-500">Move inventory between godowns with linked atomic movements</p>
        </div>
      </div>

      {/* Role Notice if Manager */}
      {!canTransfer && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-center gap-3 text-rose-800 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-rose-600" />
          <span>You are in <strong>{role}</strong> role. Stock transfers are disabled for Manager role.</span>
        </div>
      )}

      {/* Source and Destination Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Source (From)
            </label>
            <select
              value={fromGodown?.id || ""}
              onChange={(e) => {
                const g = godowns.find((item) => item.id === e.target.value);
                setFromGodown(g);
                if (product) handleResolve();
              }}
              disabled={!canTransfer}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500"
            >
              {godowns.map((g) => (
                <option key={g.id} value={g.id} disabled={g.id === toGodown?.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center text-slate-400">
            <ArrowRight size={20} className="hidden sm:block" />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Destination (To)
            </label>
            <select
              value={toGodown?.id || ""}
              onChange={(e) => {
                const g = godowns.find((item) => item.id === e.target.value);
                setToGodown(g);
              }}
              disabled={!canTransfer}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-violet-500"
            >
              {godowns.map((g) => (
                <option key={g.id} value={g.id} disabled={g.id === fromGodown?.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Barcode Search */}
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
              placeholder="Scan or type barcode to transfer…"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base outline-none focus:ring-2 focus:ring-violet-500"
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
            className="px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            Find
          </button>
        </div>

        {notFound && (
          <p className="text-xs text-rose-600 font-medium">
            Product not found for this barcode.
          </p>
        )}
      </div>

      {/* Product Details & Transfer Inputs */}
      {product && fromGodown && toGodown && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 animate-fade-in-up">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <Package size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 truncate">{product.name}</h3>
              <p className="text-xs text-slate-400 font-mono">Barcode: {product.barcode}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-medium">Stock in {fromGodown.name}</p>
              <p className={`text-lg font-extrabold ${sourceStock === 0 ? "text-rose-600" : "text-slate-800"}`}>
                {sourceStock}
              </p>
            </div>
          </div>

          {sourceStock === 0 ? (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-sm">
              <AlertTriangle size={18} className="shrink-0" />
              <span>Cannot transfer. No available stock in {fromGodown.name}.</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    max={sourceStock}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={!canTransfer}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-lg outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Stock balancing"
                    disabled={!canTransfer}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-rose-700 text-xs">
                  <AlertTriangle size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleTransfer}
                disabled={transferring || !canTransfer || quantity <= 0 || quantity > sourceStock}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
              >
                {transferring ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Executing Atomic Transfer…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Confirm Transfer ({quantity} units)
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Success Feedback */}
      {lastResult && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 flex items-center gap-4 animate-fade-in-up">
          <CheckCircle2 size={24} className="text-violet-600 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-violet-900">{lastResult.product.name}</p>
            <p className="text-sm text-violet-700">
              Successfully moved <strong>{lastResult.quantity}</strong> units from {lastResult.fromName} to {lastResult.toName}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
