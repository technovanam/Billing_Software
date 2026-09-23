import React, { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  TrendingUp,
  Receipt,
  FileText,
  CreditCard,
  Banknote,
  Plus,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Store,
} from "lucide-react";
import { useInvoices } from "../../hooks/useFirestore";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import ThermalReceipt from "./ThermalReceipt";

export default function POSDashboard() {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const cashierId = outletContext.cashierId || "BAL/086430";
  const { companyProfile } = useCompanyProfile();
  const { allInvoices, loading } = useInvoices();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBillForReceipt, setSelectedBillForReceipt] = useState(null);

  // Filter today's POS invoices
  const todayStr = new Date().toISOString().split("T")[0];

  const shiftInvoices = useMemo(() => {
    return (allInvoices || []).filter((inv) => {
      const invDate = inv.invoiceDate || (inv.createdAt?.split?.("T")?.[0]);
      return invDate === todayStr || inv.source === "POS Counter Terminal";
    });
  }, [allInvoices, todayStr]);

  // Real-time Shift Stats
  const stats = useMemo(() => {
    const totalSales = shiftInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount || inv.totalAmount || 0),
      0
    );

    const cashSales = shiftInvoices
      .filter((inv) => (inv.paymentMode || "Cash").toLowerCase() === "cash")
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    const upiSales = shiftInvoices
      .filter((inv) => (inv.paymentMode || "").toLowerCase() !== "cash")
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    return {
      totalBills: shiftInvoices.length,
      totalSales,
      cashSales,
      upiSales,
    };
  }, [shiftInvoices]);

  // Filtered Table
  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) return shiftInvoices;
    const q = searchTerm.toLowerCase().trim();
    return shiftInvoices.filter(
      (inv) =>
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        inv.client?.name?.toLowerCase().includes(q) ||
        inv.paymentMode?.toLowerCase().includes(q)
    );
  }, [shiftInvoices, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Top Header Banner matching Admin Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Cashier Shift Dashboard</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Shift Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as <strong className="text-slate-800 font-semibold">{cashierId}</strong> • Today: {new Date().toLocaleDateString("en-GB")}
          </p>
        </div>

        <button
          onClick={() => navigate("/pos/billing")}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Open Billing Terminal & Scanner</span>
        </button>
      </div>

      {/* 4 Stats Cards following Admin Dashboard Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Total Shift Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Shift Revenue
            </span>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            ₹{stats.totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <span>Real-time counter collection</span>
          </p>
        </div>

        {/* Card 2: Total Bills Generated */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Bills Generated
            </span>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats.totalBills}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Invoices issued this shift</p>
        </div>

        {/* Card 3: Cash Collected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Cash Tendered
            </span>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Banknote className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            ₹{stats.cashSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Cash drawer settlement</p>
        </div>

        {/* Card 4: UPI / Card Payments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              UPI & Digital
            </span>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            ₹{stats.upiSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Electronic transactions</p>
        </div>
      </div>

      {/* Recent Shift Bills Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Header & Search Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Shift Invoices & Transactions</h3>
            <p className="text-xs text-slate-500">List of all bills generated during this session</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search bill number..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading transactions...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No shift invoices yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Bills generated in the Billing Terminal will appear here in real time.
              </p>
              <button
                onClick={() => navigate("/pos/billing")}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
              >
                <span>Go to Billing Terminal</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Bill No</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {inv.invoiceDate || "Today"}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {inv.client?.name || "Counter Walk-in"}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {inv.items?.length || 1} items
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        {inv.paymentMode || "Cash"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      ₹{Number(inv.amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedBillForReceipt({
                            billNo: inv.invoiceNumber,
                            billDate: inv.invoiceDate || new Date(),
                            cashier: cashierId,
                            items: inv.items || [],
                            totalItems: inv.items?.length || 1,
                            totalQty: (inv.items || []).reduce(
                              (s, it) => s + Number(it.qty || 1),
                              0
                            ),
                            subtotal: Number(inv.amount || 0) / 1.05,
                            cgstRate: 2.5,
                            sgstRate: 2.5,
                            cgstAmount: ((Number(inv.amount || 0) / 1.05) * 2.5) / 100,
                            sgstAmount: ((Number(inv.amount || 0) / 1.05) * 2.5) / 100,
                            cessAmount: 0,
                            totalAmount: Number(inv.amount || 0),
                            cashReceived: Number(inv.amount || 0),
                            balancePaid: 0,
                          });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-[11px] font-semibold transition shadow-2xs"
                        title="Reprint D-Mart thermal receipt"
                      >
                        <Printer className="h-3 w-3" />
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Thermal Receipt Modal (for reprinting) */}
      {selectedBillForReceipt && (
        <ThermalReceipt
          billData={selectedBillForReceipt}
          companyProfile={companyProfile}
          onClose={() => setSelectedBillForReceipt(null)}
          isSaved={true}
        />
      )}
    </div>
  );
}
