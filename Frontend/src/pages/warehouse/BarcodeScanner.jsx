import React, { useState, useRef, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import {
  ScanBarcode, Camera, CameraOff, CheckCircle2, XCircle,
  Loader2, Package, AlertTriangle, RefreshCw, ArrowDown, Zap,
} from "lucide-react";
import {
  useBarcodeIndex, useStockIn,
} from "../../hooks/useWarehouse";
import { useToast } from "../../context/ToastContext";
import ProductReview from "./ProductReview";
import ProductManualAdd from "./ProductManualAdd";
import { PageContainer, PageHeader, btnSecondary, btnIcon } from "../../components/warehouse/WarehouseUI";

const DEBOUNCE_MS = 500;

// Simple Web Audio API beep for physical scanner feel
const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (_) {}
};

// ─── Session History ──────────────────────────────────────────────────────────
const SessionHistory = ({ items }) => {
  if (!items.length) return null;
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 lg:px-5 py-3 border-b border-gray-200 bg-gray-50">
        <p className="text-xs font-semibold uppercase text-gray-500">This Session</p>
      </div>
      <div className="divide-y divide-gray-200">
        {items.slice(0, 10).map((h, i) => (
          <div key={i} className="flex items-center gap-3 px-4 lg:px-5 py-3">
            <Package size={13} className="text-slate-400 shrink-0" />
            <span className="text-sm text-slate-700 flex-1 truncate">{h.name}</span>
            <span className="text-sm font-semibold text-green-600">+{h.qty}</span>
            <span className="text-xs text-slate-400">{h.newQty} total</span>
          </div>
        ))}
      </div>
    </div>
  );
};
SessionHistory.propTypes = { items: PropTypes.array.isRequired };

// ─── Inline Stock Form (shown when Auto-Add is OFF and a product is resolved) ─
const StockForm = ({ product, currentStock, onConfirm, onCancel, loading }) => {
  const [quantity, setQuantity] = useState(1);
  const [referenceNo, setReferenceNo] = useState("");
  const [remarks, setRemarks] = useState("");

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 lg:p-5 space-y-4 animate-fade-in-up">
      {/* Product info */}
      <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-gray-200">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold bg-blue-50 text-blue-600">
          <Package size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{product.name}</h3>
          <p className="text-xs text-slate-400 font-mono">Barcode: {product.barcode}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500">Current Stock</p>
          <p className="text-xl font-bold text-gray-900">{currentStock}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Quantity *</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-center font-bold text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Reference / PO No.</label>
          <input
            type="text"
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            placeholder="e.g. PO-8921"
            className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Remarks</label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional notes"
            className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => onConfirm({ quantity, referenceNo, remarks })}
          disabled={loading || quantity <= 0}
          className="flex-1 py-2.5 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Processing…</>
          ) : (
            <>
              <ArrowDown size={16} />
              Confirm Stock In (+{quantity})
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className={btnSecondary}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
StockForm.propTypes = {
  product: PropTypes.object.isRequired,
  currentStock: PropTypes.number.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BarcodeScanner() {
  const { resolveBarcode } = useBarcodeIndex();
  const { stockIn } = useStockIn();
  const toast = useToast();

  const inputRef = useRef(null);
  const lastScanRef = useRef({ barcode: "", time: 0 });
  const [inputValue, setInputValue] = useState("");
  const [processing, setProcessing] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Auto-add settings (default ON: scan or enter automatically adds to stock)
  const [autoAdd, setAutoAdd] = useState(true);
  const [scanQty, setScanQty] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoReference, setAutoReference] = useState("");
  const [autoRemarks, setAutoRemarks] = useState("");

  // Product resolved state
  const [resolvedProduct, setResolvedProduct] = useState(null); // { product, stock }
  const [reviewData, setReviewData] = useState(null);
  const [manualAddData, setManualAddData] = useState(null);

  // Feedback
  const [lastResult, setLastResult] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);

  // Camera
  const [cameraMode, setCameraMode] = useState(false);
  const videoRef = useRef(null);
  const readerRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!cameraMode) {
      readerRef.current?.reset?.();
      readerRef.current = null;
      return;
    }
    let active = true;
    import("@zxing/browser").then(({ BrowserMultiFormatReader }) => {
      if (!active || !videoRef.current) return;
      const codeReader = new BrowserMultiFormatReader();
      readerRef.current = codeReader;
      codeReader.decodeFromVideoDevice(null, videoRef.current, (result) => {
        if (result && active) {
          if (!autoAdd) setCameraMode(false);
          handleScan(result.getText());
        }
      }).catch(() => {
        toast.error("Camera not accessible. Using keyboard mode.");
        setCameraMode(false);
      });
    });
    return () => { active = false; readerRef.current?.reset?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode, autoAdd]);

  const resetAll = () => {
    setResolvedProduct(null);
    setReviewData(null);
    setManualAddData(null);
    setLastResult(null);
    setInputValue("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Step 1: Scan → resolve the barcode ──────────────────────────────────────
  const handleScan = useCallback(async (rawBarcode) => {
    const barcode = rawBarcode.trim();
    if (!barcode) return;
    const now = Date.now();
    if (barcode === lastScanRef.current.barcode && now - lastScanRef.current.time < DEBOUNCE_MS) {
      setInputValue("");
      return;
    }
    lastScanRef.current = { barcode, time: now };
    setInputValue("");
    setResolvedProduct(null);
    setReviewData(null);
    setManualAddData(null);
    setProcessing(true);

    try {
      const resolved = await resolveBarcode(barcode);

      if (resolved.found) {
        // If Auto-Add is enabled, directly add stock!
        if (autoAdd) {
          const qtyToAdd = Math.max(1, parseInt(scanQty) || 1);
          setCommitting(true);
          const result = await stockIn({
            barcode: resolved.product.barcode,
            quantity: qtyToAdd,
            referenceNo: autoReference || "",
            remarks: autoRemarks || "",
          });
          setCommitting(false);

          if (result.success) {
            playBeep();
            toast.success(`+${qtyToAdd} ${resolved.product.name} — New stock: ${result.newQuantity}`);
            setLastResult({
              product: resolved.product,
              qty: qtyToAdd,
              newQuantity: result.newQuantity,
            });
            setSessionHistory((prev) => [
              { name: resolved.product.name, qty: qtyToAdd, newQty: result.newQuantity },
              ...prev,
            ]);
          } else {
            toast.error(result.error || "Failed to add stock.");
          }
          setTimeout(() => inputRef.current?.focus(), 80);
          return;
        }

        // Manual mode: Show the stock form for this product
        setResolvedProduct({
          product: resolved.product,
          stock: resolved.stock?.quantity ?? 0,
        });
        return;
      }

      if (resolved.externalFound && resolved.lookupData) {
        setReviewData({ barcode, prefill: resolved.lookupData, source: "External Database" });
        return;
      }

      setManualAddData({ barcode });
    } finally {
      setProcessing(false);
    }
  }, [resolveBarcode, autoAdd, scanQty, autoReference, autoRemarks, stockIn, toast]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && inputValue.trim()) handleScan(inputValue.trim());
  };

  // ── Step 2: Confirm stock in (manual mode) ──────────────────────────────────
  const handleConfirm = useCallback(async ({ quantity, referenceNo, remarks }) => {
    if (!resolvedProduct) return;
    setCommitting(true);
    const { product } = resolvedProduct;

    const result = await stockIn({
      barcode: product.barcode,
      quantity: Number(quantity),
      referenceNo,
      remarks,
    });
    setCommitting(false);

    if (result.success) {
      playBeep();
      toast.success(`+${quantity} ${product.name} — New stock: ${result.newQuantity}`);
      setLastResult({ product, qty: quantity, newQuantity: result.newQuantity });
      setSessionHistory((prev) => [
        { name: product.name, qty: quantity, newQty: result.newQuantity },
        ...prev,
      ]);
      setResolvedProduct(null);
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      toast.error(result.error || "Operation failed.");
    }
  }, [resolvedProduct, stockIn, toast]);

  const handleReviewSuccess = (product, qty) => {
    setReviewData(null);
    setLastResult({ product, qty, newQuantity: qty });
    setSessionHistory((prev) => [{ name: product.name, qty, newQty: qty }, ...prev]);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const handleManualAddSuccess = (newProduct, qty) => {
    setManualAddData(null);
    setLastResult({ product: newProduct, qty, newQuantity: qty });
    setSessionHistory((prev) => [{ name: newProduct.name, qty, newQty: qty }, ...prev]);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const showForm = !!resolvedProduct || !!reviewData || !!manualAddData;

  return (
    <PageContainer>
      <PageHeader
        title="Scan &amp; Stock In"
        subtitle="Scan or enter a barcode to add stock instantly"
        actions={
          <>
            <button
              onClick={() => setCameraMode((v) => !v)}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                cameraMode ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {cameraMode ? <Camera size={16} /> : <CameraOff size={16} />}
              {cameraMode ? "Camera Active" : "Scan via Camera"}
            </button>
            <button onClick={resetAll} className={btnIcon} title="Reset" aria-label="Reset">
              <RefreshCw className="w-4 h-4" />
            </button>
          </>
        }
      />

      {/* Camera preview */}
      {cameraMode && (
        <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
          <video ref={videoRef} className="w-full h-full object-cover" />
          <div className="absolute inset-0 border-4 border-blue-400/40 rounded-lg pointer-events-none" />
          <p className="absolute bottom-3 left-0 right-0 text-center text-white text-sm font-medium drop-shadow">
            Point camera at barcode
          </p>
        </div>
      )}

      {/* Barcode input */}
      {!cameraMode && !showForm && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 lg:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-200">
            <label className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ScanBarcode size={18} className="text-blue-600" />
              Scan Barcode to Stock In
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAutoAdd((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  autoAdd
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                title="When ON, entering or scanning barcode immediately adds stock"
              >
                <Zap size={13} className={autoAdd ? "fill-white" : ""} />
                Auto-Add on Scan: {autoAdd ? "ON" : "OFF"}
              </button>

              {autoAdd && (
                <div className="flex items-center gap-1 bg-gray-100 px-2.5 py-1.5 rounded-lg text-sm">
                  <span className="text-gray-600">Qty:</span>
                  <input
                    type="number"
                    min="1"
                    value={scanQty}
                    onChange={(e) => setScanQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 bg-transparent text-center font-bold text-gray-900 outline-none"
                    title="Units to add per scan"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={autoAdd ? "Scan barcode or enter number and press Enter (auto-adds)…" : "Scan barcode or type and press Enter…"}
              disabled={processing || committing}
              autoFocus
              className="w-full px-4 py-3 text-base sm:text-lg font-mono bg-gray-100 border-0 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            {(processing || committing) && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-white px-2.5 py-1.5 rounded-lg shadow-sm border border-gray-200">
                <Loader2 size={13} className="animate-spin" /> {committing ? "Adding stock…" : "Resolving barcode…"}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-gray-500">
            <p>
              {autoAdd ? (
                <span className="text-green-700 flex items-center gap-1">
                  ⚡ Auto-Add active: scanning or pressing Enter adds <strong>+{scanQty}</strong> immediately.
                </span>
              ) : (
                <span>Manual mode: scanning opens confirmation form.</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="self-start sm:self-auto text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              {showAdvanced ? "Hide Batch Info" : "Optional Batch Info (PO / Remarks)"}
            </button>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-200 animate-fade-in-up">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Reference / PO No.</label>
                <input
                  type="text"
                  value={autoReference}
                  onChange={(e) => setAutoReference(e.target.value)}
                  placeholder="e.g. PO-8921"
                  className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={autoRemarks}
                  onChange={(e) => setAutoRemarks(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2 Form: after barcode resolved ─────────────────────────────── */}
      {resolvedProduct && (
        <StockForm
          product={resolvedProduct.product}
          currentStock={resolvedProduct.stock}
          onConfirm={handleConfirm}
          onCancel={resetAll}
          loading={committing}
        />
      )}

      {/* External lookup review */}
      {reviewData && (
        <ProductReview
          barcode={reviewData.barcode}
          prefill={reviewData.prefill}
          source={reviewData.source}
          onSuccess={handleReviewSuccess}
          onCancel={() => setReviewData(null)}
        />
      )}

      {/* Manual add */}
      {manualAddData && (
        <ProductManualAdd
          barcode={manualAddData.barcode}
          onSuccess={handleManualAddSuccess}
          onCancel={() => setManualAddData(null)}
        />
      )}

      {/* Last result */}
      {lastResult && !showForm && (
        <div className="rounded-lg border bg-green-50 border-green-200 p-4 lg:p-5 flex items-center gap-4 animate-fade-in-up">
          <CheckCircle2 size={24} className="text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-green-900 truncate">{lastResult.product.name}</p>
            <p className="text-sm text-green-700">
              +{lastResult.qty} units received · New stock: <strong>{lastResult.newQuantity}</strong>
            </p>
          </div>
          <button onClick={() => setLastResult(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600" aria-label="Dismiss">
            <XCircle size={18} />
          </button>
        </div>
      )}

      {/* Session history */}
      <SessionHistory items={sessionHistory} />
    </PageContainer>
  );
}
