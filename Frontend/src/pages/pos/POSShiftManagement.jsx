import React, { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import { useInvoices } from "../../hooks/useFirestore";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useToast } from "../../context/ToastContext";

export default function POSShiftManagement() {
  const { allInvoices } = useInvoices();
  const { companyProfile } = useCompanyProfile();
  const { success: toastSuccess, error: toastError } = useToast();

  const cashierSession = useMemo(() => {
    try {
      const saved = localStorage.getItem("pos_cashier_session");
      return saved ? JSON.parse(saved) : { cashierId: "CSH-001", cashierName: "Arun", counterNumber: "Counter 01" };
    } catch {
      return { cashierId: "CSH-001", cashierName: "Arun", counterNumber: "Counter 01" };
    }
  }, []);

  // Shifts state
  const [shiftsHistory, setShiftsHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("pos_cashier_shifts");
      if (saved) return JSON.parse(saved);
    } catch {}

    // Default active shift #102 as specified in requirements
    return [
      {
        shiftNumber: 102,
        cashierId: cashierSession.cashierId || "CSH-001",
        cashierName: cashierSession.cashierName || "Arun",
        counter: cashierSession.counterNumber || "Counter 01",
        openingCash: 5000,
        openedAt: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
        closedAt: null,
        status: "Active", // "Active" | "Closed"
        cashSales: 20000,
        upiSales: 35000,
        cardSales: 15000,
        refunds: 2000,
        closingCashDeclared: null,
        notes: "Morning primary counter shift",
      },
      {
        shiftNumber: 101,
        cashierId: "CSH-002",
        cashierName: "Sahanaa",
        counter: "Counter 02",
        openingCash: 3000,
        openedAt: new Date(Date.now() - 86400000).toISOString(),
        closedAt: new Date(Date.now() - 50400000).toISOString(),
        status: "Closed",
        cashSales: 18500,
        upiSales: 22000,
        cardSales: 9500,
        refunds: 500,
        closingCashDeclared: 21000,
        notes: "Shift closed smoothly",
      },
    ];
  });

  const [activeShift, setActiveShift] = useState(() => {
    return shiftsHistory.find((s) => s.status === "Active") || null;
  });

  // Modal controls
  const [isOpenShiftModal, setIsOpenShiftModal] = useState(false);
  const [isCloseShiftModal, setIsCloseShiftModal] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [selectedShiftForSummary, setSelectedShiftForSummary] = useState(null);

  // Form states
  const [openingCashInput, setOpeningCashInput] = useState("5000");
  const [closingCashDeclaredInput, setClosingCashDeclaredInput] = useState("");
  const [shiftNotesInput, setShiftNotesInput] = useState("");

  // Sync shifts with localStorage
  useEffect(() => {
    try {
      localStorage.setItem("pos_cashier_shifts", JSON.stringify(shiftsHistory));
    } catch (_) {}
  }, [shiftsHistory]);

  // Real-time calculation for active shift
  const activeMetrics = useMemo(() => {
    if (!activeShift) return null;

    const opening = Number(activeShift.openingCash) || 0;
    const cash = Number(activeShift.cashSales) || 0;
    const upi = Number(activeShift.upiSales) || 0;
    const card = Number(activeShift.cardSales) || 0;
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
  }, [activeShift]);

  // Handle Open New Shift
  const handleOpenShift = (e) => {
    e.preventDefault();
    const openingAmt = Number(openingCashInput) || 0;
    const nextShiftNum = (shiftsHistory[0]?.shiftNumber || 100) + 1;

    const newShift = {
      shiftNumber: nextShiftNum,
      cashierId: cashierSession.cashierId || "CSH-001",
      cashierName: cashierSession.cashierName || "Arun",
      counter: cashierSession.counterNumber || "Counter 01",
      openingCash: openingAmt,
      openedAt: new Date().toISOString(),
      closedAt: null,
      status: "Active",
      cashSales: 0,
      upiSales: 0,
      cardSales: 0,
      refunds: 0,
      closingCashDeclared: null,
      notes: shiftNotesInput.trim(),
    };

    const updated = [newShift, ...shiftsHistory.map((s) => ({ ...s, status: "Closed" }))];
    setShiftsHistory(updated);
    setActiveShift(newShift);
    setIsOpenShiftModal(false);
    setShiftNotesInput("");
    toastSuccess(`Shift #${nextShiftNum} opened successfully with ₹${openingAmt.toLocaleString("en-IN")} float!`);
  };

  // Handle Close Active Shift
  const handleCloseShift = (e) => {
    e.preventDefault();
    if (!activeShift) return;

    const declaredCash = Number(closingCashDeclaredInput) || 0;
    const closedShift = {
      ...activeShift,
      closedAt: new Date().toISOString(),
      status: "Closed",
      closingCashDeclared: declaredCash,
      notes: shiftNotesInput.trim() || activeShift.notes,
    };

    const updated = shiftsHistory.map((s) => (s.shiftNumber === activeShift.shiftNumber ? closedShift : s));
    setShiftsHistory(updated);
    setActiveShift(null);
    setIsCloseShiftModal(false);
    setSelectedShiftForSummary(closedShift);
    setIsSummaryModalOpen(true);
    toastSuccess(`Shift #${closedShift.shiftNumber} closed! Shift summary generated.`);
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
              onClick={() => {
                setClosingCashDeclaredInput(String(activeMetrics?.expectedCashInDrawer || ""));
                setIsCloseShiftModal(true);
              }}
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
              Initialize drawer float and begin sales tracking for Cashier <strong>{cashierSession.cashierName}</strong>.
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
    </div>
  );
}
