import React, { useState, useMemo } from "react";
import {
  Search,
  RotateCcw,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  Gift,
  ArrowRightLeft,
  FileText,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User,
  ShoppingBag,
  Printer,
  ChevronDown,
  X,
  Package,
} from "lucide-react";
import { useInvoices } from "../../hooks/useFirestore";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useToast } from "../../context/ToastContext";
import { addShiftRefund } from "../../services/posService";

export default function POSSalesReturn() {
  const { allInvoices, addInvoice } = useInvoices();
  const { companyProfile } = useCompanyProfile();
  const { success: toastSuccess, error: toastError } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Return item selection state: { [itemIdx]: { selected: boolean, returnQty: number, reason: string } }
  const [returnItems, setReturnItems] = useState({});
  const [refundMethod, setRefundMethod] = useState("Cash"); // "Cash" | "UPI" | "Card" | "Store Credit" | "Exchange" | "Credit Note"
  const [refundNotes, setRefundNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [returnSuccessData, setReturnSuccessData] = useState(null);

  // Return reasons list
  const returnReasons = [
    "Defective / Damaged item",
    "Wrong item purchased",
    "Customer changed mind",
    "Size / Fit mismatch",
    "Quality not satisfactory",
    "Expired / Past date",
    "Other",
  ];

  // Past returns list stored in localStorage for tracking
  const [returnsHistory, setReturnsHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("pos_sales_returns_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Filter matching invoices by bill number, invoice number, or customer phone/name
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return (allInvoices || [])
      .filter((inv) => {
        const num = (inv.invoiceNumber || inv.billNumber || inv.id || "").toLowerCase();
        const custName = (inv.customerName || inv.client?.name || "").toLowerCase();
        const custPhone = (inv.customerPhone || inv.client?.phone || "").toLowerCase();
        return num.includes(q) || custName.includes(q) || custPhone.includes(q);
      })
      .slice(0, 8);
  }, [allInvoices, searchQuery]);

  // When an invoice is picked, initialize return items state
  const handleSelectInvoice = (inv) => {
    setSelectedInvoice(inv);
    const initial = {};
    const items = inv.items || inv.products || [];
    items.forEach((item, idx) => {
      initial[idx] = {
        selected: false,
        returnQty: 1,
        maxQty: Number(item.quantity || item.qty || 1),
        price: Number(item.price || item.unitPrice || item.rate || 0),
        name: item.name || item.description || `Item #${idx + 1}`,
        reason: "Defective / Damaged item",
      };
    });
    setReturnItems(initial);
    setReturnSuccessData(null);
  };

  // Toggle item selection
  const toggleItemSelection = (idx) => {
    setReturnItems((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        selected: !prev[idx]?.selected,
      },
    }));
  };

  // Update return quantity
  const updateReturnQty = (idx, qty) => {
    const val = Math.max(1, Math.min(Number(qty) || 1, returnItems[idx]?.maxQty || 1));
    setReturnItems((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        returnQty: val,
      },
    }));
  };

  // Update return reason
  const updateReturnReason = (idx, reason) => {
    setReturnItems((prev) => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        reason,
      },
    }));
  };

  // Calculation of total refundable amount
  const returnSummary = useMemo(() => {
    let subtotal = 0;
    let selectedCount = 0;
    const selectedList = [];

    Object.entries(returnItems).forEach(([idx, item]) => {
      if (item.selected) {
        const itemTotal = item.price * item.returnQty;
        subtotal += itemTotal;
        selectedCount += item.returnQty;
        selectedList.push({ ...item, itemIndex: idx });
      }
    });

    // Approximate GST on return matching 5% default (2.5% CGST + 2.5% SGST)
    const tax = subtotal * 0.05;
    const totalRefund = subtotal + tax;

    return {
      subtotal,
      tax,
      totalRefund: Math.round(totalRefund),
      selectedCount,
      selectedList,
    };
  }, [returnItems]);

  // Process Sales Return
  const handleProcessReturn = async () => {
    if (!selectedInvoice) return;
    if (returnSummary.selectedList.length === 0) {
      toastError("Please select at least one item to return.");
      return;
    }

    setIsProcessing(true);
    try {
      const returnId = `RET-${Date.now().toString().slice(-6)}`;
      const creditNoteNumber = `CN-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

      const returnRecord = {
        returnId,
        creditNoteNumber,
        originalInvoiceNumber: selectedInvoice.invoiceNumber || selectedInvoice.id,
        originalInvoiceDate: selectedInvoice.invoiceDate || selectedInvoice.createdAt,
        customerName: selectedInvoice.customerName || selectedInvoice.client?.name || "Walk-in Customer",
        customerPhone: selectedInvoice.customerPhone || selectedInvoice.client?.phone || "-",
        returnedItems: returnSummary.selectedList,
        totalRefundAmount: returnSummary.totalRefund,
        refundMethod,
        refundNotes,
        timestamp: new Date().toISOString(),
        cashier: (JSON.parse(localStorage.getItem("pos_cashier_session") || "{}"))?.cashierId || "Cashier",
      };

      // Save to local returns history
      const updatedHistory = [returnRecord, ...returnsHistory];
      setReturnsHistory(updatedHistory);
      localStorage.setItem("pos_sales_returns_history", JSON.stringify(updatedHistory));

      // Add the refund to the cashier's open shift (Firestore, via the backend).
      try {
        await addShiftRefund(returnSummary.totalRefund);
      } catch (shiftErr) {
        console.warn("Shift refund not recorded:", shiftErr.message);
      }

      setReturnSuccessData(returnRecord);
      toastSuccess(`Return processed! ${refundMethod === "Credit Note" ? "Credit Note issued" : "Refund recorded"} of ₹${returnSummary.totalRefund.toLocaleString("en-IN")}`);
    } catch (err) {
      console.error("Return processing error:", err);
      toastError("Failed to process return. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReturnReceipt = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-y-auto font-mazzard p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Sales Return & Refund</h1>
            <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white">
              POS Module
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Search invoices, process item returns, issue refunds, store credits or credit notes
          </p>
        </div>

        {selectedInvoice && (
          <button
            onClick={() => {
              setSelectedInvoice(null);
              setReturnSuccessData(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Selection</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* Left Column: Search & Invoice Selector / Return Item Form */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* 1. Search Invoice Box */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              <span>Search Original Invoice</span>
            </h2>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter Invoice / Bill number, Customer name or Mobile number..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 pl-10 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Dropdown / Results */}
            {searchResults.length > 0 && !selectedInvoice && (
              <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-lg">
                {searchResults.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      handleSelectInvoice(inv);
                      setSearchQuery("");
                    }}
                    className="p-3.5 hover:bg-blue-50 transition cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {inv.invoiceNumber || inv.billNumber || inv.id}
                        </span>
                        <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                          {inv.invoiceDate || inv.createdAt?.split?.("T")?.[0] || "Recent"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Customer: <strong>{inv.customerName || inv.client?.name || "Walk-in"}</strong> · Phone: {inv.customerPhone || inv.client?.phone || "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">
                        ₹{Number(inv.amount || inv.totalAmount || 0).toLocaleString("en-IN")}
                      </p>
                      <span className="text-[11px] font-semibold text-blue-600 hover:underline">
                        Select for Return →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Select Items to Return */}
          {selectedInvoice && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs animate-fade-in">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span>Select Items for Return</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Original Bill #{selectedInvoice.invoiceNumber || selectedInvoice.id} · Customer: {selectedInvoice.customerName || selectedInvoice.client?.name || "Walk-in Customer"}
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                  Total Bill: ₹{Number(selectedInvoice.amount || selectedInvoice.totalAmount || 0).toLocaleString("en-IN")}
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {(selectedInvoice.items || selectedInvoice.products || []).map((item, idx) => {
                  const state = returnItems[idx] || {};
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all ${
                        state.selected
                          ? "border-blue-400 bg-blue-50/40 shadow-xs"
                          : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={!!state.selected}
                          onChange={() => toggleItemSelection(idx)}
                          className="h-4 w-4 mt-1 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                {item.name || item.description || `Item #${idx + 1}`}
                              </p>
                              <p className="text-xs text-slate-500">
                                Billed Qty: {item.quantity || item.qty || 1} · Unit Price: ₹{Number(item.price || item.unitPrice || item.rate || 0).toLocaleString("en-IN")}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-slate-900">
                              ₹{(Number(item.price || item.unitPrice || item.rate || 0) * (state.returnQty || 1)).toLocaleString("en-IN")}
                            </span>
                          </div>

                          {/* Return Qty and Reason Options if selected */}
                          {state.selected && (
                            <div className="mt-3.5 pt-3 border-t border-blue-100 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                  Return Quantity (Max: {state.maxQty})
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={state.maxQty}
                                  value={state.returnQty}
                                  onChange={(e) => updateReturnQty(idx, e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                  Return Reason
                                </label>
                                <select
                                  value={state.reason}
                                  onChange={(e) => updateReturnReason(idx, e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                                >
                                  {returnReasons.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past Returns Log */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>Recent Sales Returns & Credit Notes History</span>
            </h3>

            {returnsHistory.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-medium">
                No returns processed in this terminal session yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Return ID</th>
                      <th className="py-2.5 px-3">Original Invoice</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Refund Mode</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returnsHistory.slice(0, 5).map((ret, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-900">{ret.returnId}</td>
                        <td className="py-2 px-3 font-semibold text-blue-600">{ret.originalInvoiceNumber}</td>
                        <td className="py-2 px-3 text-slate-700">{ret.customerName}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            {ret.refundMethod}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold text-right text-red-600">
                          -₹{Number(ret.totalRefundAmount).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400 text-[10px]">
                          {new Date(ret.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Refund Method & Action Summary */}
        <div className="lg:col-span-4 flex flex-col gap-5 sticky top-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Receipt className="w-4 h-4 text-blue-600" />
              <span>Refund Calculation & Settlement</span>
            </h2>

            {/* Calculation summary */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Selected Items:</span>
                <span className="font-bold text-slate-900">{returnSummary.selectedCount} qty</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-bold text-slate-900">₹{returnSummary.subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST Adjustment (5%):</span>
                <span className="font-bold text-slate-900">₹{returnSummary.tax.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                <span>Total Refund Amount:</span>
                <span className="text-lg text-red-600 font-extrabold">
                  ₹{returnSummary.totalRefund.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Refund Settlement Method */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
                Refund Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "Cash", icon: Banknote, label: "Cash Refund" },
                  { id: "UPI", icon: Smartphone, label: "UPI Refund" },
                  { id: "Store Credit", icon: Gift, label: "Store Credit" },
                  { id: "Exchange", icon: ArrowRightLeft, label: "Product Exchange" },
                  { id: "Credit Note", icon: FileText, label: "Credit Note" },
                ].map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setRefundMethod(mode.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition text-left cursor-pointer ${
                        refundMethod === mode.id
                          ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                      <span className="truncate">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes / Reason */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-700 mb-1">
                Return Remarks (Optional)
              </label>
              <textarea
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                placeholder="Add customer remarks or authorization note..."
                rows={2}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Button */}
            <button
              onClick={handleProcessReturn}
              disabled={isProcessing || !selectedInvoice || returnSummary.selectedList.length === 0}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {isProcessing
                  ? "Processing Return..."
                  : `Process Return & ${refundMethod === "Credit Note" ? "Issue Credit Note" : "Refund"}`}
              </span>
            </button>
          </div>

          {/* Success Summary Card if processed */}
          {returnSuccessData && (
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-xs animate-fade-in text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Return Successful!</span>
              </div>
              <p className="text-slate-700">
                Return ID: <strong>{returnSuccessData.returnId}</strong>
              </p>
              {returnSuccessData.refundMethod === "Credit Note" && (
                <p className="text-slate-700">
                  Credit Note Number: <strong>{returnSuccessData.creditNoteNumber}</strong>
                </p>
              )}
              <p className="text-slate-700">
                Refund Amount: <strong>₹{returnSuccessData.totalRefundAmount.toLocaleString("en-IN")}</strong> via {returnSuccessData.refundMethod}
              </p>
              <div className="pt-2 flex gap-2">
                <button
                  onClick={handlePrintReturnReceipt}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
