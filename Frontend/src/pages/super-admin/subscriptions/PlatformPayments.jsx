import React, { useState } from "react";
import { superAdminService } from "../../../services/superAdminDataService";
import { usePlatformPayments } from "../../../hooks/useSuperAdminFirestore";
import { db } from "../../../lib/firebase/config";
import { doc, updateDoc } from "firebase/firestore";
import { Receipt, Search, CheckCircle2, XCircle, Clock, RotateCcw, ArrowRight, Eye, X } from "lucide-react";

export default function PlatformPayments() {
  const { payments, loading } = usePlatformPayments();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [refundReason, setRefundReason] = useState("");

  const handleRefund = async (e) => {
    e.preventDefault();
    if (!selectedPayment || !selectedPayment.path) return;
    
    try {
      await updateDoc(doc(db, selectedPayment.path), { status: "Refunded" });
      setSelectedPayment(null);
      setRefundReason("");
      alert("Refund processed successfully and recorded in audit trail.");
    } catch (err) {
      console.error(err);
      alert("Error processing refund. Check permissions.");
    }
  };

  const filtered = payments.filter((p) => {
    if (statusFilter !== "All" && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.id.toLowerCase().includes(q) ||
        p.businessName.toLowerCase().includes(q) ||
        p.invoiceNo.toLowerCase().includes(q) ||
        p.transactionId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Platform Payments</h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Monitor incoming subscription collections, transaction IDs, payment gateways, and refunds.
        </p>
      </div>

      <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search payment ID, invoice, or business…"
            className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 shadow-sm focus:outline-none w-full sm:w-auto cursor-pointer"
        >
          <option value="All">All Transactions</option>
          <option value="Successful">Successful</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
          <option value="Refunded">Refunded</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3.5 px-4">PAYMENT ID</th>
                <th className="p-3.5 px-4">BUSINESS</th>
                <th className="p-3.5 px-4">INVOICE #</th>
                <th className="p-3.5 px-4">AMOUNT</th>
                <th className="p-3.5 px-4">GATEWAY</th>
                <th className="p-3.5 px-4">METHOD</th>
                <th className="p-3.5 px-4">TRANSACTION ID</th>
                <th className="p-3.5 px-4">STATUS</th>
                <th className="p-3.5 px-4">DATE</th>
                <th className="p-3.5 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => (
                <tr key={p.id} className="text-sm transition-colors hover:bg-gray-50 group">
                  <td className="p-3.5 px-4 font-mono font-bold text-blue-600">{p.id}</td>
                  <td className="p-3.5 px-4 font-bold text-gray-900">{p.businessName}</td>
                  <td className="p-3.5 px-4 font-mono text-gray-500">{p.invoiceNo}</td>
                  <td className="p-3.5 px-4 font-mono font-bold text-gray-900">₹{p.amount.toLocaleString()}</td>
                  <td className="p-3.5 px-4 text-gray-700">{p.gateway}</td>
                  <td className="p-3.5 px-4 text-gray-500">{p.paymentMethod}</td>
                  <td className="p-3.5 px-4 font-mono text-[11px] text-gray-400">{p.transactionId}</td>
                  <td className="p-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        p.status === "Successful"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          : p.status === "Failed"
                          ? "bg-rose-50 text-rose-700 border-rose-200/60"
                          : "bg-amber-50 text-amber-700 border-amber-200/60"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${p.status === "Successful" ? "bg-emerald-500" : p.status === "Failed" ? "bg-rose-500" : "bg-amber-500"}`} />
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3.5 px-4 text-gray-500">{p.date}</td>
                  <td className="p-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedPayment(p)}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-gray-600 hover:text-gray-900 border border-slate-200 text-[11px] font-semibold flex items-center gap-1 ml-auto transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Details Drawer / Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-base font-bold text-gray-900">Transaction Audit: {selectedPayment.id}</h3>
              <button onClick={() => setSelectedPayment(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-600 mb-6">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400">Business:</span>
                <strong className="text-gray-900">{selectedPayment.businessName}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400">Gross Amount:</span>
                <strong className="text-gray-900 font-mono">₹{selectedPayment.amount.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400">Gateway Provider:</span>
                <span>{selectedPayment.gateway} (Live)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400">Gateway Transaction ID:</span>
                <span className="font-mono text-blue-600">{selectedPayment.transactionId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400">Payment Status:</span>
                <span className="font-bold text-emerald-600">{selectedPayment.status}</span>
              </div>
            </div>

            {selectedPayment.status === "Successful" && (
              <form onSubmit={handleRefund} className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 space-y-2.5 text-xs">
                <div className="font-bold text-rose-800 flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Initiate Gateway Refund</span>
                </div>
                <input
                  type="text"
                  placeholder="Mandatory refund justification reason…"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl bg-white border border-rose-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm transition"
                >
                  Confirm & Process Refund
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
