import React, { useState, useMemo, useContext } from "react";
import {
  Clock,
  UserCheck,
  Banknote,
  Smartphone,
  CreditCard,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  FileSpreadsheet,
  Printer,
  Calendar,
  DollarSign,
  TrendingUp,
  Receipt,
  Plus,
  WifiOff,
  RefreshCw,
  X,
} from "lucide-react";
import { useInvoices } from "../../hooks/useFirestore";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useToast } from "../../context/ToastContext";
import usePosShifts from "../../hooks/usePosShifts";
import { AuthContext } from "../../context/AuthContext";
import { getPendingBills, flushQueue } from "../../services/posBillQueue";

export default function POSShiftManagement() {
  const { allInvoices } = useInvoices();
  const { companyProfile } = useCompanyProfile();
  const { success: toastSuccess, error: toastError } = useToast();

  // Shifts live in Firestore; the backend allows one open shift per cashier and per counter.
  const { shifts: shiftsHistory, activeShift, open: openShiftRemote, close: closeShiftRemote } = usePosShifts();
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useContext(AuthContext);
  const cashierLabel = user?.cashierName || user?.displayName || "Owner";
  const ownerUid = user?.role === "cashier" ? user?.businessUid : user?.uid;

  // Modal controls
  const [isOpenShiftModal, setIsOpenShiftModal] = useState(false);
  const [isCloseShiftModal, setIsCloseShiftModal] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [selectedShiftForSummary, setSelectedShiftForSummary] = useState(null);

  // Pending unsynced bills blocking shift close
  const [isPendingBlockModalOpen, setIsPendingBlockModalOpen] = useState(false);
  const [pendingBlockList, setPendingBlockList] = useState([]);
  const [isSyncingPending, setIsSyncingPending] = useState(false);

  // Form states
  const [openingCashInput, setOpeningCashInput] = useState("5000");
  const [closingCashDeclaredInput, setClosingCashDeclaredInput] = useState("");
  const [shiftNotesInput, setShiftNotesInput] = useState("");

  // Sales during the open shift, from this cashier's POS bills since it opened.
  const shiftSales = useMemo(() => {
    if (!activeShift) return { cash: 0, online: 0 };
    const since = activeShift.openedAt || "";
    return (allInvoices || [])
      .filter((inv) => inv.source === "POS Counter Terminal" && (inv.cashier || "") === activeShift.cashierId && String(inv.createdAt || "") >= since)
      .reduce(
        (acc, inv) => {
          const amount = Number(inv.amount) || 0;
          if (String(inv.paymentMode || "").toLowerCase().startsWith("cash")) acc.cash += amount;
          else acc.online += amount;
          return acc;
        },
        { cash: 0, online: 0 }
      );
  }, [activeShift, allInvoices]);

  // Real-time calculation for active shift
  const activeMetrics = useMemo(() => {
    if (!activeShift) return null;

    const opening = Number(activeShift.openingCash) || 0;
    const cash = shiftSales.cash;
    const upi = shiftSales.online; // POS records online payments (UPI/card) together
    const card = 0;
    const refunds = Number(activeShift.refunds) || 0;

    const totalSales = cash + upi + card;
    const netRevenue = totalSales - refunds;
    // Expected drawer cash = Opening Cash + Cash Sales - Cash Refunds
    const expectedCashInDrawer = opening + cash - refunds;

    return {
      opening,
      cash,
      upi,
      card,
      refunds,
      totalSales,
      netRevenue,
      expectedCashInDrawer,
    };
  }, [activeShift, shiftSales]);

  // Handle Open New Shift
  const handleOpenShift = async (e) => {
    e.preventDefault();
    const openingAmt = Number(openingCashInput) || 0;
    setIsSaving(true);
    try {
      const shift = await openShiftRemote(openingAmt, shiftNotesInput.trim());
      setIsOpenShiftModal(false);
      setShiftNotesInput("");
      toastSuccess(`Shift #${shift.shiftNumber} opened successfully with ₹${openingAmt.toLocaleString("en-IN")} float!`);
    } catch (err) {
      // e.g. "Counter 01 already has an open shift #104 (Arun, Counter 01, open since ...)"
      toastError(err.message || "Could not open the shift.");
    } finally {
      setIsSaving(false);
    }
  };

  // Check pending bills before opening close shift modal
  const handleInitiateCloseShift = () => {
    const pending = getPendingBills();
    if (pending.length > 0) {
      setPendingBlockList(pending);
      setIsPendingBlockModalOpen(true);
      return;
    }
    setClosingCashDeclaredInput(String(activeMetrics?.expectedCashInDrawer || ""));
    setIsCloseShiftModal(true);
  };

  // Sync pending bills from the blocking modal
  const handleSyncPendingBills = async () => {
    if (!ownerUid) {
      toastError("Store credentials missing. Please sign in again.");
      return;
    }
    setIsSyncingPending(true);
    try {
      const { synced, failed } = await flushQueue(ownerUid);
      const remaining = getPendingBills();
      setPendingBlockList(remaining);
      window.dispatchEvent(new CustomEvent("pos_queue_updated"));
      if (synced > 0) {
        toastSuccess(`${synced} bill(s) synced to cloud successfully!`);
      }
      if (remaining.length === 0) {
        setIsPendingBlockModalOpen(false);
        setClosingCashDeclaredInput(String(activeMetrics?.expectedCashInDrawer || ""));
        setIsCloseShiftModal(true);
      } else {
        toastError(`${failed || remaining.length} bill(s) could not sync. Check internet connection.`);
      }
    } catch (err) {
      toastError("Sync failed: " + (err.message || String(err)));
    } finally {
      setIsSyncingPending(false);
    }
  };

  // Handle Close Active Shift
  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!activeShift) return;
    const pending = getPendingBills();
    if (pending.length > 0) {
      setPendingBlockList(pending);
      setIsCloseShiftModal(false);
      setIsPendingBlockModalOpen(true);
      toastError(`Cannot close shift: ${pending.length} unsynced bill(s) pending.`);
      return;
    }
    setIsSaving(true);
    try {
      const declaredCash = Number(closingCashDeclaredInput) || 0;
      const closedShift = await closeShiftRemote(
        activeShift.id,
        declaredCash,
        { cashSales: activeMetrics?.cash || 0, upiSales: activeMetrics?.upi || 0, cardSales: 0 },
        shiftNotesInput.trim() || undefined
      );
      setIsCloseShiftModal(false);
      setShiftNotesInput("");
      setSelectedShiftForSummary(closedShift);
      setIsSummaryModalOpen(true);
      toastSuccess(`Shift #${closedShift.shiftNumber} closed! Shift summary generated.`);
    } catch (err) {
      toastError(err.message || "Could not close the shift.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-y-auto font-mazzard p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Shift Management & Cash Reconciliation</h1>
            <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              POS Terminal
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Cashier shift logs, drawer opening float, payment breakdowns, refunds and closing reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeShift ? (
            <button
              onClick={handleInitiateCloseShift}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-xs transition cursor-pointer"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Close Shift #{activeShift.shiftNumber}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsOpenShiftModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-xs transition cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Open New Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Card & Live Summary */}
      {activeShift && activeMetrics ? (
        <div className="bg-white rounded-2xl border border-blue-200 p-6 shadow-sm mb-6 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-extrabold text-lg shadow-sm">
                #{activeShift.shiftNumber}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Active Shift #{activeShift.shiftNumber}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    Running
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cashier: <strong>{activeShift.cashierName}</strong> ({activeShift.cashierId}) · Counter: <strong>{activeShift.counter}</strong> · Opened: {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Opening Float</span>
                <p className="text-base font-extrabold text-slate-900">
                  ₹{activeMetrics.opening.toLocaleString("en-IN")}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedShiftForSummary(activeShift);
                  setIsSummaryModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition cursor-pointer"
              >
                Shift Summary
              </button>
            </div>
          </div>

          {/* Sales Breakdown Stat Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase mb-1">
                <span>Cash Sales</span>
                <Banknote className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-extrabold text-slate-900">
                ₹{activeMetrics.cash.toLocaleString("en-IN")}
              </p>
              <span className="text-[10px] text-emerald-700 font-semibold">In Counter Drawer</span>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100">
              <div className="flex items-center justify-between text-blue-800 text-xs font-bold uppercase mb-1">
                <span>UPI Sales</span>
                <Smartphone className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xl font-extrabold text-slate-900">
                ₹{activeMetrics.upi.toLocaleString("en-IN")}
              </p>
              <span className="text-[10px] text-blue-700 font-semibold">Direct Bank QR</span>
            </div>

            <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100">
              <div className="flex items-center justify-between text-purple-800 text-xs font-bold uppercase mb-1">
                <span>Card Sales</span>
                <CreditCard className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-xl font-extrabold text-slate-900">
                ₹{activeMetrics.card.toLocaleString("en-IN")}
              </p>
              <span className="text-[10px] text-purple-700 font-semibold">POS Swipe Machine</span>
            </div>

            <div className="p-4 rounded-xl bg-red-50/60 border border-red-100">
              <div className="flex items-center justify-between text-red-800 text-xs font-bold uppercase mb-1">
                <span>Refunds / Returns</span>
                <RotateCcw className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-xl font-extrabold text-red-600">
                ₹{activeMetrics.refunds.toLocaleString("en-IN")}
              </p>
              <span className="text-[10px] text-red-700 font-semibold">Deducted from drawer</span>
            </div>
          </div>

          {/* Reconciliation Banner */}
          <div className="mt-5 p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Expected Cash in Drawer (Reconciliation)
              </span>
              <p className="text-xs text-slate-300 mt-0.5">
                Opening (₹{activeMetrics.opening.toLocaleString()}) + Cash Sales (₹{activeMetrics.cash.toLocaleString()}) - Refunds (₹{activeMetrics.refunds.toLocaleString()})
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-emerald-400">
                ₹{activeMetrics.expectedCashInDrawer.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 text-center mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
          <h2 className="text-base font-bold text-amber-900">No Active Shift Running</h2>
          <p className="text-xs text-amber-700 mt-1 max-w-md mx-auto">
            Please open a new shift with your opening cash float to begin processing counter bills and automatic reconciliation.
          </p>
          <button
            onClick={() => setIsOpenShiftModal(true)}
            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
          >
            + Open Shift Now
          </button>
        </div>
      )}

      {/* Shifts History Log Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4 flex items-center justify-between">
          <span>Cashier-wise Shift History & Reconciliation Logs</span>
          <span className="text-xs text-slate-400 font-normal">Total recorded: {shiftsHistory.length}</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Shift #</th>
                <th className="py-3 px-3.5">Cashier</th>
                <th className="py-3 px-3.5">Counter</th>
                <th className="py-3 px-3.5">Opened</th>
                <th className="py-3 px-3.5">Closed</th>
                <th className="py-3 px-3.5 text-right">Opening</th>
                <th className="py-3 px-3.5 text-right">Total Sales</th>
                <th className="py-3 px-3.5 text-right">Refunds</th>
                <th className="py-3 px-3.5 text-right">Closing Cash</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shiftsHistory.map((shift) => {
                const totalS = Number(shift.cashSales || 0) + Number(shift.upiSales || 0) + Number(shift.cardSales || 0);
                return (
                  <tr key={shift.shiftNumber} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3.5 font-bold text-slate-900">#{shift.shiftNumber}</td>
                    <td className="py-3 px-3.5 font-medium text-slate-800">{shift.cashierName} ({shift.cashierId})</td>
                    <td className="py-3 px-3.5 text-slate-600">{shift.counter}</td>
                    <td className="py-3 px-3.5 text-slate-600">
                      {new Date(shift.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-3 px-3.5 text-slate-600">
                      {shift.closedAt
                        ? new Date(shift.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </td>
                    <td className="py-3 px-3.5 text-right font-semibold text-slate-900">
                      ₹{Number(shift.openingCash).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3.5 text-right font-bold text-emerald-700">
                      ₹{totalS.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3.5 text-right text-red-600">
                      ₹{Number(shift.refunds || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3.5 text-right font-extrabold text-slate-900">
                      {shift.closingCashDeclared !== null
                        ? `₹${Number(shift.closingCashDeclared).toLocaleString("en-IN")}`
                        : "In Progress"}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          shift.status === "Active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {shift.status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <button
                        onClick={() => {
                          setSelectedShiftForSummary(shift);
                          setIsSummaryModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-bold text-xs"
                      >
                        View Summary
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: OPEN SHIFT */}
      {isOpenShiftModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Open Shift Counter</h3>
            <p className="text-xs text-slate-500">
              Initialize drawer float and begin sales tracking for Cashier <strong>{cashierLabel}</strong>.
            </p>

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Opening Cash Float (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Shift Notes (Optional)
                </label>
                <input
                  type="text"
                  value={shiftNotesInput}
                  onChange={(e) => setShiftNotesInput(e.target.value)}
                  placeholder="e.g. Morning counter shift"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs font-medium text-slate-900"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Confirm Open Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CLOSE SHIFT & RECONCILIATION */}
      {isCloseShiftModal && activeShift && activeMetrics && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Close Shift #{activeShift.shiftNumber} & Cash Reconciliation
            </h3>
            <p className="text-xs text-slate-500">
              Count drawer cash and declare actual closing cash to reconcile shift.
            </p>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Opening Cash Float:</span>
                <span className="font-bold text-slate-900">₹{activeMetrics.opening.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cash Sales Recorded:</span>
                <span className="font-bold text-emerald-700">+₹{activeMetrics.cash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cash Refunds Processed:</span>
                <span className="font-bold text-red-600">-₹{activeMetrics.refunds.toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-sm text-slate-900">
                <span>Expected Drawer Cash:</span>
                <span className="text-blue-600">₹{activeMetrics.expectedCashInDrawer.toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Actual Closing Cash Counted (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={closingCashDeclaredInput}
                  onChange={(e) => setClosingCashDeclaredInput(e.target.value)}
                  placeholder="Counted cash in drawer"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-base font-extrabold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {closingCashDeclaredInput && (
                <div
                  className={`p-3 rounded-lg text-xs font-bold flex items-center justify-between ${
                    Number(closingCashDeclaredInput) === activeMetrics.expectedCashInDrawer
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : Number(closingCashDeclaredInput) > activeMetrics.expectedCashInDrawer
                      ? "bg-blue-50 text-blue-800 border border-blue-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  <span>Reconciliation Difference:</span>
                  <span>
                    {Number(closingCashDeclaredInput) === activeMetrics.expectedCashInDrawer
                      ? "Perfect Match (₹0.00)"
                      : Number(closingCashDeclaredInput) > activeMetrics.expectedCashInDrawer
                      ? `+₹${(Number(closingCashDeclaredInput) - activeMetrics.expectedCashInDrawer).toLocaleString()} (Surplus)`
                      : `-₹${(activeMetrics.expectedCashInDrawer - Number(closingCashDeclaredInput)).toLocaleString()} (Shortage)`}
                  </span>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Confirm & Close Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SHIFT SUMMARY PRINT DIALOG */}
      {isSummaryModalOpen && selectedShiftForSummary && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Shift Summary Report #{selectedShiftForSummary.shiftNumber}
              </h3>
              <button
                onClick={() => setIsSummaryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono">
              <div className="text-center pb-2 border-b border-dashed border-slate-300 font-sans">
                <p className="font-bold text-sm text-slate-900">{companyProfile?.companyName || "Techno Vanam"}</p>
                <p className="text-[11px] text-slate-500">Counter Shift Summary Report</p>
              </div>

              <div className="flex justify-between">
                <span>Shift Number:</span>
                <strong>#{selectedShiftForSummary.shiftNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <strong>{selectedShiftForSummary.cashierName} ({selectedShiftForSummary.cashierId})</strong>
              </div>
              <div className="flex justify-between">
                <span>Opened Time:</span>
                <span>{new Date(selectedShiftForSummary.openedAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Opening Cash Float:</span>
                <strong>₹{Number(selectedShiftForSummary.openingCash).toLocaleString()}</strong>
              </div>

              <div className="pt-2 border-t border-dashed border-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span>Cash Sales:</span>
                  <span>₹{Number(selectedShiftForSummary.cashSales).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>UPI Sales:</span>
                  <span>₹{Number(selectedShiftForSummary.upiSales).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Card Sales:</span>
                  <span>₹{Number(selectedShiftForSummary.cardSales).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Refunds / Returns:</span>
                  <span>-₹{Number(selectedShiftForSummary.refunds || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-300 flex justify-between font-bold text-sm text-slate-900 font-sans">
                <span>Closing Drawer Cash:</span>
                <span className="text-emerald-700">
                  ₹{(
                    Number(selectedShiftForSummary.closingCashDeclared) ||
                    Number(selectedShiftForSummary.openingCash) + Number(selectedShiftForSummary.cashSales) - Number(selectedShiftForSummary.refunds || 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Shift Report</span>
              </button>
              <button
                onClick={() => setIsSummaryModalOpen(false)}
                className="py-2.5 px-4 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PENDING BILLS BLOCKING SHIFT CLOSE */}
      {isPendingBlockModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-red-200">
            <div className="bg-red-50 p-5 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                  <WifiOff className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-red-950">
                    Cannot Close Shift: Unsynced Bills Pending
                  </h3>
                  <p className="text-xs text-red-700">
                    {pendingBlockList.length} bill(s) saved on this device must sync to cloud first
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPendingBlockModalOpen(false)}
                className="text-red-400 hover:text-red-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  The shift cannot be closed while offline bills are still pending on this device. Closing now would cause discrepancies in shift totals and risk bill loss.
                </span>
              </div>

              {/* Pending Bills List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Bill ID</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {pendingBlockList.map((bill) => (
                      <tr key={bill.localId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-[11px] font-bold text-blue-700">
                          {bill.payload?.invoiceNumber || bill.localId}
                        </td>
                        <td className="py-2 px-3 truncate max-w-[120px]">
                          {bill.payload?.customerName || bill.payload?.client?.name || "Walk-in"}
                        </td>
                        <td className="py-2 px-3 text-right font-bold tabular-nums">
                          ₹{Number(bill.payload?.amount || bill.payload?.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[10px]">
                          {bill.queuedAt ? new Date(bill.queuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsPendingBlockModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Back to POS
                </button>
                <button
                  type="button"
                  onClick={handleSyncPendingBills}
                  disabled={isSyncingPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingPending ? "animate-spin" : ""}`} />
                  <span>{isSyncingPending ? "Syncing..." : "Sync Pending Bills Now"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
