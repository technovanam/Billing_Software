import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building2,
  FileText,
  ShieldCheck,
  Loader2,
  XCircle,
  Clock,
  Printer,
} from "lucide-react";
import { loadRazorpayScript } from "../../utils/loadRazorpay";

export default function TokenPublicPayPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [errorState, setErrorState] = useState(null); // { type: 'INVALID'|'DISABLED'|'CANCELLED'|'EXPIRED'|'PAID', message: '' }
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function fetchPublicInvoice() {
      if (!token) {
        setErrorState({ type: "INVALID", message: "Invalid payment link." });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(`http://localhost:5000/api/public/payment/invoice/${token}`);
        const result = await res.json();

        if (result.success) {
          setData(result);
          setErrorState(null);
        } else {
          setErrorState({
            type: result.status || "INVALID",
            invoiceNumber: result.invoiceNumber || "",
            amountPaid: result.amountPaid,
            gatewayPaymentId: result.gatewayPaymentId,
            paidAt: result.paidAt,
            message: result.message || result.error || "Payment link is invalid or disabled.",
          });
        }
      } catch (err) {
        console.error("Fetch invoice error:", err);
        setErrorState({
          type: "ERROR",
          message: "Failed to connect to payment server. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchPublicInvoice();
  }, [token]);

  const handlePayNow = async () => {
    if (!token || isProcessing) return;
    setIsProcessing(true);

    try {
      // 1. Ensure Razorpay SDK is loaded
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        alert("Failed to load Razorpay SDK. Please check your internet connection.");
        setIsProcessing(false);
        return;
      }

      // 2. Request backend to create Razorpay Order (Server-calculated amount)
      const res = await fetch("http://localhost:5000/api/public/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const orderResult = await res.json();
      if (!orderResult.success) {
        alert(orderResult.error || "Failed to create payment order. Please try again.");
        setIsProcessing(false);
        return;
      }

      // 3. Launch official Razorpay Checkout modal
      const options = {
        key: orderResult.keyId,
        amount: orderResult.amount,
        currency: orderResult.currency || "INR",
        name: data?.companyName || "ESA ENGINEERING WORKS",
        description: `Invoice ${data?.invoiceNumber}`,
        image: data?.logoURL || "https://res.cloudinary.com/dnmvriw3e/image/upload/v1756868204/ESA_uggt8u.png",
        order_id: orderResult.orderId,
        handler: async function (response) {
          const paymentId = response.razorpay_payment_id || "PAY_SUCCESS";
          // Redirect to payment success page
          navigate(
            `/payment/success?payment_id=${paymentId}&order_id=${orderResult.orderId}&invoice=${encodeURIComponent(
              data?.invoiceNumber || ""
            )}&amount=${data?.balanceDue || data?.amount}`
          );
        },
        prefill: {
          name: data?.customerName || "",
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Pay Now error:", err);
      alert("An unexpected error occurred. Please try again.");
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading Secure Payment Portal...</p>
      </div>
    );
  }

  // ALREADY PAID STATE
  if (errorState?.type === "PAID") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={36} />
          </div>
          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
            ✓ PAYMENT COMPLETED
          </span>
          <h2 className="text-xl font-extrabold text-gray-900 mb-1">Invoice Already Paid</h2>
          <p className="text-gray-600 text-sm mb-6">This invoice has already been settled in full.</p>

          <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2 border border-slate-200 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice:</span>
              <span className="font-bold text-gray-900">{errorState.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount Paid:</span>
              <span className="font-bold text-emerald-600">₹{Number(errorState.amountPaid || 0).toFixed(2)}</span>
            </div>
            {errorState.gatewayPaymentId && (
              <div className="flex justify-between">
                <span className="text-gray-500">Payment ID:</span>
                <span className="font-mono text-xs text-gray-700">{errorState.gatewayPaymentId}</span>
              </div>
            )}
            {errorState.paidAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Paid On:</span>
                <span className="text-gray-700">{new Date(errorState.paidAt).toLocaleDateString("en-IN")}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-900 transition text-sm cursor-pointer"
          >
            <Printer size={16} /> Print Receipt
          </button>
        </div>
      </div>
    );
  }

  // CANCELLED INVOICE STATE
  if (errorState?.type === "CANCELLED") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle size={36} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">PAYMENT UNAVAILABLE</h2>
          <p className="text-gray-600 text-sm mb-6">{errorState.message}</p>
          <div className="text-xs text-gray-400">Invoice: {errorState.invoiceNumber}</div>
        </div>
      </div>
    );
  }

  // EXPIRED PAYMENT LINK STATE
  if (errorState?.type === "EXPIRED") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock size={36} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">PAYMENT LINK EXPIRED</h2>
          <p className="text-gray-600 text-sm mb-6">{errorState.message}</p>
          <div className="text-xs text-gray-400">Invoice: {errorState.invoiceNumber}</div>
        </div>
      </div>
    );
  }

  // INVALID OR DISABLED STATE
  if (errorState) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={36} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">PAYMENT LINK INVALID OR DISABLED</h2>
          <p className="text-gray-600 text-sm mb-6">{errorState.message}</p>
        </div>
      </div>
    );
  }

  // ACTIVE PAYABLE INVOICE STATE
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 max-w-md w-full overflow-hidden">
        
        {/* BRAND HEADER */}
        <div className="bg-slate-900 text-white p-6 text-center relative">
          {data?.logoURL && (
            <img src={data.logoURL} alt="Company Logo" className="h-12 w-auto mx-auto mb-2 object-contain" />
          )}
          <h1 className="text-lg font-bold tracking-wide">{data?.companyName || "ESA ENGINEERING WORKS"}</h1>
          <span className="inline-block mt-2 px-3 py-0.5 bg-blue-500/20 text-blue-300 text-xs font-semibold rounded-full border border-blue-400/30">
            Invoice Payment Portal
          </span>
        </div>

        {/* INVOICE SUMMARY SHEET */}
        <div className="p-6 space-y-5">
          <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-3">
            <span className="text-gray-500 flex items-center gap-1.5 font-medium">
              <FileText size={16} className="text-blue-600" /> Invoice
            </span>
            <span className="font-bold text-gray-900">{data?.invoiceNumber}</span>
          </div>

          <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-3">
            <span className="text-gray-500 font-medium">Customer</span>
            <span className="font-semibold text-gray-800">{data?.customerName}</span>
          </div>

          <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-3">
            <span className="text-gray-500 font-medium">Due Date</span>
            <span className="font-medium text-gray-700">{data?.dueDate}</span>
          </div>

          {/* TOTAL AMOUNT CARD */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount Due</span>
            <div className="text-3xl font-black text-slate-900 mt-1">₹{Number(data?.balanceDue || data?.amount || 0).toFixed(2)}</div>
          </div>

          {/* PAY NOW BUTTON */}
          <button
            onClick={handlePayNow}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-2xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 cursor-pointer"
          >
            {isProcessing ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <CreditCard size={20} />
            )}
            PAY NOW
          </button>

          {/* TRUST BADGE */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-2">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span>256-bit SSL Secure Payment Gateway</span>
          </div>
        </div>
      </div>
    </div>
  );
}
