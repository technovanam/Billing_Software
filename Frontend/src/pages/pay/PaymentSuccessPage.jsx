import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, FileText, Printer, ArrowLeft } from "lucide-react";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const invoiceNumber = searchParams.get("invoice") || "N/A";
  const amount = searchParams.get("amount") || "0.00";
  const paymentId = searchParams.get("payment_id") || "N/A";

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 max-w-md w-full text-center">
        
        {/* SUCCESS ICON */}
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={48} />
        </div>

        <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full mb-2 uppercase tracking-wider">
          ✓ Payment Processing / Successful
        </span>

        <h1 className="text-2xl font-black text-gray-900 mb-1">Thank You!</h1>
        <p className="text-gray-600 text-sm mb-6">Your payment has been successfully authorized.</p>

        {/* DETAILS CARD */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left text-sm space-y-3 mb-6">
          <div className="flex justify-between items-center pb-2 border-b border-gray-200">
            <span className="text-gray-500 font-medium">Invoice Number</span>
            <span className="font-bold text-gray-900">{invoiceNumber}</span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-gray-200">
            <span className="text-gray-500 font-medium">Amount Paid</span>
            <span className="font-bold text-emerald-600 text-base">₹{Number(amount).toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-medium">Payment ID</span>
            <span className="font-mono text-xs text-gray-800 bg-gray-200/60 px-2 py-1 rounded">{paymentId}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition text-sm cursor-pointer"
          >
            <Printer size={16} /> Print Receipt
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          A receipt has been generated. The invoice status will update automatically.
        </p>
      </div>
    </div>
  );
}
