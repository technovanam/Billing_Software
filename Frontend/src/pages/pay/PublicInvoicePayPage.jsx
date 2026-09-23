import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase/config";
import {
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building2,
  Calendar,
  FileText,
  User,
  ShieldCheck,
  Printer,
  ArrowLeft,
  Loader2,
  QrCode,
  IndianRupee,
} from "lucide-react";
import { loadRazorpayScript } from "../../utils/loadRazorpay";

export default function PublicInvoicePayPage() {
  const { userId, invoiceId } = useParams();
  const navigate = useNavigate();

  const [resolvedUserId, setResolvedUserId] = useState(userId && userId !== "invoice" && userId !== "pay" ? userId : "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [realInvId, setRealInvId] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [transactionRef, setTransactionRef] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualUtr, setManualUtr] = useState("");

  useEffect(() => {
    async function fetchInvoiceData() {
      const pathname = window.location.pathname;
      const segments = pathname.split("/").filter(Boolean); // ['pay', 'userId', 'invoiceId'] or ['pay', 'invoice', 'invoiceId'] or ['pay', 'token']

      let targetIdentifier = "";
      if (segments.length >= 3) {
        targetIdentifier = segments.slice(2).join("/");
      } else if (segments.length === 2) {
        targetIdentifier = segments[1];
      }

      if (!targetIdentifier || targetIdentifier === "invoice" || targetIdentifier === "pay") {
        setError("Invalid invoice payment link.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // 1. Try Backend API first (bypasses permissions, handles token/invoiceNumber/docId)
        try {
          const apiRes = await fetch(`http://localhost:5000/api/public/payment/invoice/${encodeURIComponent(targetIdentifier)}`);
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData.success) {
              setInvoice({
                invoiceNumber: apiData.invoiceNumber,
                paymentToken: apiData.token,
                invoiceDate: apiData.invoiceDate,
                dueDate: apiData.dueDate,
                poNumber: apiData.poNumber,
                dcNumber: apiData.dcNumber,
                client: apiData.client || { name: apiData.customerName },
                clientName: apiData.customerName,
                items: apiData.items || [],
                cgst: apiData.cgst || 0,
                sgst: apiData.sgst || 0,
                igst: apiData.igst || 0,
                isRoundOff: apiData.isRoundOff,
                amount: apiData.amount,
                paidAmount: apiData.amount - apiData.balanceDue,
                status: apiData.status === "PAID" ? "Paid" : "Unpaid",
              });
              setCompanyProfile({
                companyName: apiData.companyName,
                logoURL: apiData.logoURL,
                address: apiData.companyAddress,
                phone: apiData.companyPhone,
                gstin: apiData.companyGstin,
              });
              setRealInvId(apiData.invoiceId || apiData.invoiceNumber);
              if (apiData.userId) setResolvedUserId(apiData.userId);
              if (apiData.status === "PAID") setPaymentSuccess(true);
              setLoading(false);
              return;
            }
          }
        } catch (apiErr) {
          console.warn("API lookup skipped, falling back to direct Firestore fetch:", apiErr);
        }

        // 2. Direct Firestore fallback
        const effectiveUserId = (userId && userId !== "invoice") ? userId : (segments[1] !== "invoice" ? segments[1] : null);
        if (effectiveUserId) setResolvedUserId(effectiveUserId);
        const decoded = decodeURIComponent(targetIdentifier);
        const normalizedWithSlash = decoded.replace(/_/g, "/");
        const normalizedWithUnderscore = decoded.replace(/\//g, "_");

        let foundId = null;
        let foundData = null;

        if (effectiveUserId) {
          try {
            const userDoc = await getDoc(doc(db, "users", effectiveUserId));
            if (userDoc.exists()) setCompanyProfile(userDoc.data());
          } catch (e) {
            console.warn("Could not load user profile:", e);
          }

          try {
            const invSnap = await getDoc(doc(db, "users", effectiveUserId, "invoices", decoded));
            if (invSnap.exists()) {
              foundId = invSnap.id;
              foundData = invSnap.data();
            }
          } catch (e) {
            console.warn("Direct doc fetch error:", e);
          }

          if (!foundData) {
            const possibilities = [decoded, normalizedWithSlash, targetIdentifier];
            for (const num of possibilities) {
              if (!num) continue;
              const q = query(collection(db, "users", effectiveUserId, "invoices"), where("invoiceNumber", "==", num));
              const querySnap = await getDocs(q);
              if (!querySnap.empty) {
                foundId = querySnap.docs[0].id;
                foundData = querySnap.docs[0].data();
                break;
              }
            }
          }

          if (!foundData) {
            const allSnap = await getDocs(collection(db, "users", effectiveUserId, "invoices"));
            const matched = allSnap.docs.find((d) => {
              const data = d.data();
              const invNum = data.invoiceNumber || "";
              const invNumUnderscore = invNum.replace(/\//g, "_");
              return (
                d.id === decoded ||
                invNum === decoded ||
                invNum === normalizedWithSlash ||
                invNumUnderscore === decoded ||
                invNumUnderscore === normalizedWithUnderscore
              );
            });
            if (matched) {
              foundId = matched.id;
              foundData = matched.data();
            }
          }
        }

        if (foundData) {
          setInvoice(foundData);
          setRealInvId(foundId);
          if (foundData.status?.toLowerCase() === "paid") setPaymentSuccess(true);
        } else {
          setError("Invoice not found or link has expired.");
        }
      } catch (err) {
        console.error("Error fetching invoice for payment:", err);
        setError("Failed to load invoice. Please verify the URL.");
      } finally {
        setLoading(false);
      }
    }

    fetchInvoiceData();
  }, [userId, invoiceId]);

  // Calculate totals
  const items = invoice?.items || invoice?.products || [];
  const subtotal = items.reduce(
    (sum, item) => sum + (item.amount || item.total || (item.quantity * item.rate) || 0),
    0
  );
  const cgstAmount = (subtotal * (invoice?.cgst || 0)) / 100;
  const sgstAmount = (subtotal * (invoice?.sgst || 0)) / 100;
  const igstAmount = (subtotal * (invoice?.igst || 0)) / 100;
  const roundOffAmount = invoice?.isRoundOff ? Math.round(invoice.amount) - invoice.amount : 0;
  const totalAmount = invoice?.amount || (subtotal + cgstAmount + sgstAmount + igstAmount + roundOffAmount);
  const paidAmount = invoice?.paidAmount || (invoice?.status?.toLowerCase() === "paid" ? totalAmount : 0);
  const balanceDue = Math.max(0, totalAmount - paidAmount);

  // Complete Payment Action (Records to Backend & Firestore)
  const completePaymentInFirestore = async (txId, methodUsed = "Razorpay") => {
    const targetUserId = resolvedUserId || userId;
    const targetIdentifier = invoice?.paymentToken || invoiceId || (window.location.pathname.split("/").filter(Boolean).pop());

    try {
      setIsProcessing(true);
      const newPaidAmount = totalAmount;

      // 1. Call Backend API to record payment with admin privileges
      try {
        await fetch("http://localhost:5000/api/public/payment/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: targetIdentifier,
            invoiceId: realInvId || invoice?.invoiceNumber,
            userId: targetUserId,
            amount: balanceDue > 0 ? balanceDue : totalAmount,
            paymentMethod: methodUsed,
            transactionId: txId,
          }),
        });
      } catch (backendErr) {
        console.warn("Backend payment recording failed, attempting client-side write:", backendErr);
      }

      // 2. Client-side fallback write if targetUserId and realInvId are present
      if (targetUserId && realInvId) {
        try {
          await addDoc(collection(db, "users", targetUserId, "payments"), {
            invoiceId: realInvId,
            invoiceNumber: invoice?.invoiceNumber || "",
            customerName: invoice?.client?.name || invoice?.clientName || "Customer",
            clientId: invoice?.clientId || invoice?.client?.id || "",
            amount: balanceDue > 0 ? balanceDue : totalAmount,
            paymentMethod: methodUsed,
            transactionId: txId,
            paymentDate: new Date().toLocaleDateString("en-GB"),
            status: "Completed",
            notes: `Paid via Online Invoice Link (${methodUsed})`,
            createdAt: serverTimestamp(),
          });

          await updateDoc(doc(db, "users", targetUserId, "invoices", realInvId), {
            status: "Paid",
            paidAmount: newPaidAmount,
            paymentMethod: methodUsed,
            transactionId: txId,
            paymentDate: new Date().toLocaleDateString("en-GB"),
            updatedAt: serverTimestamp(),
          });
        } catch (clientErr) {
          console.warn("Client-side write notice:", clientErr);
        }
      }

      setInvoice((prev) => ({
        ...prev,
        status: "Paid",
        paidAmount: newPaidAmount,
      }));
      setTransactionRef(txId);
      setPaymentSuccess(true);
    } catch (err) {
      console.error("Error saving payment:", err);
      alert("Payment was authorized, but updating record failed. Please contact merchant.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Razorpay Standard Checkout Handler
  const handleRazorpayPayment = async () => {
    if (balanceDue <= 0) return;
    setIsProcessing(true);

    try {
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        alert("Failed to load Razorpay SDK. Please check your internet connection.");
        setIsProcessing(false);
        return;
      }

      // Request Order Creation from Backend
      let orderData = null;
      try {
        const res = await fetch("http://localhost:5000/create-razorpay-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: balanceDue,
            currency: "INR",
            receipt: `inv_${realInvId.slice(0, 10)}`,
            notes: {
              invoiceNumber: invoice.invoiceNumber,
              userId: userId,
            },
          }),
        });
        if (res.ok) {
          orderData = await res.json();
        }
      } catch (e) {
        console.warn("Backend order creation endpoint unreachable, falling back to direct checkout:", e);
      }

      const razorpayKey = orderData?.keyId || "rzp_test_Tcxout7GfUZzbE";

      const options = {
        key: razorpayKey,
        amount: Math.round(balanceDue * 100),
        currency: "INR",
        name: companyProfile?.companyName || "ESA ENGINEERING WORKS",
        description: `Payment for Invoice ${invoice.invoiceNumber}`,
        image: companyProfile?.logoURL || "https://res.cloudinary.com/dnmvriw3e/image/upload/v1756868204/ESA_uggt8u.png",
        order_id: orderData?.orderId || undefined,
        handler: async function (response) {
          const txId = response.razorpay_payment_id || `RZP_${Date.now()}`;
          await completePaymentInFirestore(txId, "Razorpay Online");
        },
        prefill: {
          name: invoice.client?.name || "",
          email: invoice.client?.email || "",
          contact: invoice.client?.phone || "",
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

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        alert("Razorpay SDK not loaded. Please refresh the page.");
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Razorpay Checkout Error:", err);
      alert("Could not initialize Razorpay checkout. Please try again.");
      setIsProcessing(false);
    }
  };

  // Manual UPI / UTR Handler
  const handleManualUpiPayment = async () => {
    if (!manualUtr.trim()) {
      alert("Please enter the UTR or Transaction Ref Number.");
      return;
    }
    await completePaymentInFirestore(manualUtr.trim(), "UPI / Bank Transfer");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading Invoice Details...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invoice Not Found</h2>
          <p className="text-gray-600 text-sm mb-6">{error || "This invoice link is invalid or may have been removed."}</p>
          <button
            onClick={() => navigate("/")}
            className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* TOP BRAND HEADER */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={companyProfile?.logoURL || "https://res.cloudinary.com/dnmvriw3e/image/upload/v1756868204/ESA_uggt8u.png"}
              alt="Company Logo"
              className="h-14 w-auto object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{companyProfile?.companyName || "ESA ENGINEERING WORKS"}</h1>
              <p className="text-xs text-gray-500">{companyProfile?.address || "1/100, Chettipalayam Road, E.B. Compound, CBE"}</p>
              <p className="text-xs text-gray-500">GSTIN: {companyProfile?.gstin || "33AMWPB2116Q1ZS"} | Phone: {companyProfile?.phone || "+91 98432 94464"}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Official Invoice Portal
            </span>
          </div>
        </div>

        {/* PAYMENT STATUS CARD */}
        {paymentSuccess || invoice.status?.toLowerCase() === "paid" ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="text-2xl font-bold text-emerald-900">Invoice Paid Successfully</h2>
            <p className="text-emerald-700 text-sm mt-1">
              Thank you! Payment of <span className="font-bold">₹{totalAmount.toFixed(2)}</span> has been confirmed.
            </p>
            {transactionRef && (
              <p className="text-xs text-emerald-600 font-mono mt-2 bg-emerald-100/50 inline-block px-3 py-1 rounded-md">
                Transaction Ref: {transactionRef}
              </p>
            )}
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition"
              >
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <div className="text-xs text-blue-200 uppercase font-semibold tracking-wider">Amount Payable</div>
              <div className="text-4xl font-extrabold mt-1">₹{balanceDue.toFixed(2)}</div>
              <div className="text-xs text-blue-200 mt-1">Invoice #{invoice.invoiceNumber} • Date: {invoice.invoiceDate || "N/A"}</div>
            </div>

            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRazorpayPayment}
                disabled={isProcessing}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3.5 rounded-xl shadow-md transition-all transform hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CreditCard size={18} />
                )}
                Pay Now via Razorpay
              </button>
            </div>
          </div>
        )}

        {/* INVOICE DETAILS SHEET */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" /> Invoice Breakdown
            </h3>
            <span className="text-sm font-semibold text-gray-600">
              Invoice #{invoice.invoiceNumber}
            </span>
          </div>

          <div className="p-6 space-y-6">
            {/* Customer & PO Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Billed To</span>
                <p className="font-bold text-gray-900 text-base">{invoice.client?.name || invoice.clientName || "Client"}</p>
                <p className="text-gray-600">{invoice.client?.address || "Address N/A"}</p>
                <p className="text-gray-600">GSTIN: {invoice.client?.taxId || invoice.client?.gst || "N/A"}</p>
              </div>
              <div className="md:text-right">
                <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Order Details</span>
                <p className="text-gray-700"><span className="font-semibold">P.O. Number:</span> {invoice.poNumber || "N/A"}</p>
                <p className="text-gray-700"><span className="font-semibold">D.C. Number:</span> {invoice.dcNumber || "N/A"}</p>
                <p className="text-gray-700"><span className="font-semibold">Due Date:</span> {invoice.dueDate || "Upon Receipt"}</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-sm text-left text-gray-700">
                <thead className="bg-gray-100 text-gray-800 font-semibold text-xs uppercase border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-center">#</th>
                    <th className="px-4 py-3">Item Description</th>
                    <th className="px-4 py-3 text-center">HSN</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-center font-medium text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{item.description || item.name}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{item.hsnCode || item.hsn || "-"}</td>
                      <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">₹{Number(item.rate || item.price || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        ₹{Number(item.amount || item.total || (item.quantity * item.rate) || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 bg-slate-50 p-3 rounded-lg border border-slate-200 max-w-xs">
                <p className="font-semibold text-gray-700 mb-1">Bank Account Transfer Details:</p>
                <p>Bank: State Bank of India</p>
                <p>A/C: 42455711572</p>
                <p>IFSC: SBIN0015017</p>
                <p>Branch: Malumichampatti</p>
              </div>

              <div className="w-full sm:w-72 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                {invoice.cgst > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>CGST ({invoice.cgst}%)</span>
                    <span>₹{cgstAmount.toFixed(2)}</span>
                  </div>
                )}
                {invoice.sgst > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>SGST ({invoice.sgst}%)</span>
                    <span>₹{sgstAmount.toFixed(2)}</span>
                  </div>
                )}
                {invoice.igst > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>IGST ({invoice.igst}%)</span>
                    <span>₹{igstAmount.toFixed(2)}</span>
                  </div>
                )}
                {roundOffAmount !== 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Round Off</span>
                    <span>₹{roundOffAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total Amount</span>
                  <span>₹{totalAmount.toFixed(2)}</span>
                </div>
                {paidAmount > 0 && (
                  <>
                    <div className="flex justify-between font-medium text-emerald-600 text-sm">
                      <span>Paid / Received (Cash/Prior)</span>
                      <span>-₹{paidAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-base text-red-600 pt-1 border-t border-dashed border-red-200">
                      <span>Balance Due</span>
                      <span>₹{balanceDue.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ALTERNATIVE MANUAL PAYMENT OPTION */}
        {!paymentSuccess && invoice.status?.toLowerCase() !== "paid" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-2 text-gray-800 font-bold border-b border-gray-100 pb-3">
              <QrCode size={20} className="text-blue-600" />
              <span>Alternative Payment Method (Direct UPI / UTR Entry)</span>
            </div>
            <p className="text-xs text-gray-500">
              If you have already paid via UPI/Bank Transfer, enter your 12-digit UTR/Transaction Reference Number below to register payment instantly.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Enter 12-digit UTR / Transaction ID"
                value={manualUtr}
                onChange={(e) => setManualUtr(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleManualUpiPayment}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-slate-800 text-white font-semibold text-sm rounded-lg hover:bg-slate-900 transition disabled:opacity-50 cursor-pointer"
              >
                Submit Payment Ref
              </button>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="text-center text-xs text-gray-400 py-4">
          Protected by 256-bit SSL Encryption • Powered by Techno Vanam Billing
        </div>
      </div>
    </div>
  );
}
