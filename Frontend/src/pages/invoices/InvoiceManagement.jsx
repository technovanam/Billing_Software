import React, { useState, useRef, useEffect, useContext, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import Pagination from "../../components/Pagination";
import {
  Search,
  Plus,
  Eye,
  Edit,
  Download,
  X,
  Save,
  FileText,
  ArrowLeft,
  Trash2,
  Printer,
  Filter,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { useInvoices, useSettings, useCustomers, useProducts } from "../../hooks/useFirestore";
import { AuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { generateInvoiceHTML } from "../../utils/invoiceGenerator";
import { loadRazorpayScript } from "../../utils/loadRazorpay";
import PropTypes from "prop-types";
// Removed jsPDF and html2canvas imports

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirmClass = "bg-red-600 hover:bg-red-700"
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
        <h3 className="heading-section">{title}</h3>
        <p className="body-text text-gray-600 mt-2">{message}</p>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 button-text text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 button-text text-white rounded-lg ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const ClientAutocomplete = ({ clients, selectedClient, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (selectedClient) {
      setSearchTerm(selectedClient.name);
    } else {
      setSearchTerm("");
    }
  }, [selectedClient]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsFocused(false);
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value) {
      const filteredSuggestions = clients.filter((client) =>
        client.name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
      onSelect(null);
    }
  };

  const handleSelectSuggestion = (client) => {
    onSelect(client.id); // Pass the client ID directly
    setSearchTerm(client.name);
    setSuggestions([]);
    setIsFocused(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label htmlFor="client-search" className="block text-sm text-gray-700 mb-1">Select Customer</label>
      <input
        id="client-search"
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setIsFocused(true)}
        placeholder="Type to search for a customer..."
        className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
      />
      {isFocused && searchTerm && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.length > 0 ? (
            suggestions.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(client)}
                  className="w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                >
                  {client.name}
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-2 text-sm text-gray-500">No customer found</li>
          )}
        </ul>
      )}
    </div>
  );
};

const ProductAutocomplete = ({
  products,
  value,
  onSelect,
  onChange,
  onAddNewProduct,
  clientId,
}) => {
  const [searchTerm, setSearchTerm] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  const updateDropdownPosition = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: `${rect.bottom}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      });
    }
  };

  useEffect(() => {
    if (isFocused) {
      updateDropdownPosition();
      window.addEventListener("scroll", updateDropdownPosition, true);
      window.addEventListener("resize", updateDropdownPosition);
    }
    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
    };
  }, [isFocused]);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(event.target))
      ) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleInputChange = (e) => {
    const inputValue = e.target.value;
    setSearchTerm(inputValue);
    onChange(inputValue);

    if (inputValue) {
      const filteredSuggestions = products.filter((product) =>
        product.name.toLowerCase().includes(inputValue.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
    }
  };

  const handleAddNewProduct = () => {
    if (onAddNewProduct && searchTerm.trim()) {
      onAddNewProduct(searchTerm.trim(), clientId);
      setSearchTerm("");
      setSuggestions([]);
      setIsFocused(false);
    }
  };

  const handleSelectSuggestion = (product) => {
    onSelect(product);
    setSearchTerm(product.name);
    setSuggestions([]);
    setIsFocused(false);
  };

  const Dropdown = () => {
    const exactMatch = products.find(
      (p) => p.name.toLowerCase() === searchTerm.toLowerCase()
    );
    const showAddOption = searchTerm.trim() && !exactMatch && onAddNewProduct;

    return (
      <ul
        ref={dropdownRef}
        style={{ ...dropdownStyle, position: "fixed" }}
        className="z-50 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
      >
        {suggestions.length > 0 ? (
          suggestions.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => handleSelectSuggestion(product)}
                className="w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                {product.name} - ₹{product.price}
              </button>
            </li>
          ))
        ) : (
          !showAddOption && (
            <li className="px-4 py-2 text-sm text-gray-500">
              No item found
            </li>
          )
        )}
        {showAddOption && (
          <li>
            <button
              type="button"
              onClick={handleAddNewProduct}
              className="w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-blue-100 border-t border-gray-200 text-blue-600 font-medium focus:outline-none focus:bg-blue-100"
            >
              + Add "{searchTerm}" as new product
            </button>
          </li>
        )}
      </ul>
    );
  };

  return (
    <div ref={wrapperRef}>
      <input
        type="text"
        placeholder="Item description"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setIsFocused(true)}
        className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
      />
      {isFocused &&
        searchTerm &&
        createPortal(<Dropdown />, document.body)}
    </div>
  );
};

const PaymentLinkControls = ({ invoice, onUpdateInvoice }) => {
  const { success: toastSuccess } = useToast();
  const [token, setToken] = useState(invoice?.paymentToken || "");
  const [disabled, setDisabled] = useState(
    invoice?.paymentTokenStatus === "DISABLED" || invoice?.paymentLinkDisabled === true
  );

  useEffect(() => {
    setToken(invoice?.paymentToken || "");
    setDisabled(
      invoice?.paymentTokenStatus === "DISABLED" || invoice?.paymentLinkDisabled === true
    );
  }, [invoice]);

  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "http://localhost:5173";

  const isPaid =
    (invoice?.status || "").toLowerCase() === "paid" ||
    (invoice?.paymentStatus || "").toUpperCase() === "PAID";

  const isCancelled = (invoice?.status || "").toLowerCase() === "cancelled";

  const generateToken = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  };

  const handleGenerateLink = async (isRegenerate = false) => {
    if (!invoice?.id) return;
    const newToken = generateToken();
    const patch = {
      paymentToken: newToken,
      paymentTokenCreatedAt: new Date().toISOString(),
      paymentTokenStatus: "ACTIVE",
      paymentLinkDisabled: false,
    };

    if (onUpdateInvoice) {
      await onUpdateInvoice(invoice.id, patch);
    }
    setToken(newToken);
    setDisabled(false);
    toastSuccess(isRegenerate ? "Payment link regenerated!" : "Payment link generated!");
  };

  const handleDisableLink = async () => {
    if (!invoice?.id) return;
    const patch = {
      paymentTokenStatus: "DISABLED",
      paymentLinkDisabled: true,
    };
    if (onUpdateInvoice) {
      await onUpdateInvoice(invoice.id, patch);
    }
    setDisabled(true);
    toastSuccess("Payment link disabled!");
  };

  const linkUrl = `${origin}/pay/${token}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(linkUrl);
    toastSuccess("Payment link copied to clipboard!");
  };

  if (isPaid) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-emerald-900 mb-4 max-w-[210mm] mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="font-bold bg-emerald-600 text-white text-xs px-2.5 py-0.5 rounded-full">
            ✓ PAID
          </span>
          <span>
            Payment ID: <code className="font-mono text-xs text-emerald-800 font-semibold">{invoice.gatewayPaymentId || invoice.transactionId || "pay_completed"}</code>
          </span>
        </div>
        <div className="text-xs text-emerald-700 font-medium">
          Paid On: {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString("en-IN") : "Settled"}
        </div>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-semibold mb-4 max-w-[210mm] mx-auto w-full">
        Payment Status: CANCELLED (This invoice is no longer payable)
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-sm mb-4 max-w-[210mm] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-gray-800">
          <span>Payment Status:</span>
          <span className={disabled ? "text-amber-600 font-bold" : "text-blue-600 font-bold"}>
            {disabled ? "DISABLED" : "PENDING"}
          </span>
        </div>
        {!token ? (
          <button
            onClick={() => handleGenerateLink(false)}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
          >
            Generate Payment Link
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleGenerateLink(true)}
              className="px-2.5 py-1 bg-gray-200 text-gray-800 rounded-md text-xs font-medium hover:bg-gray-300 transition cursor-pointer"
            >
              Regenerate
            </button>
            {!disabled ? (
              <button
                onClick={handleDisableLink}
                className="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium hover:bg-red-200 transition cursor-pointer"
              >
                Disable
              </button>
            ) : (
              <button
                onClick={() => handleGenerateLink(false)}
                className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-medium hover:bg-emerald-200 transition cursor-pointer"
              >
                Enable
              </button>
            )}
          </div>
        )}
      </div>

      {token && !disabled && (
        <div className="flex items-center gap-2 bg-white p-2 border border-slate-300 rounded-lg">
          <input
            type="text"
            readOnly
            value={linkUrl}
            className="flex-1 bg-transparent text-xs font-mono text-blue-700 outline-none truncate"
          />
          <button
            onClick={copyToClipboard}
            className="px-3 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
          >
            Copy Link
          </button>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-slate-800 text-white rounded-md text-xs font-bold hover:bg-slate-900 transition text-center"
          >
            Open Link
          </a>
        </div>
      )}
    </div>
  );
};

const InvoicePreview = ({
  invoice,
  invoiceData,
  calculations,
  setShowPreview,
  embedded = false,
  autoDownload = false,
  onDownloadComplete,
  onUpdateInvoice,
}) => {
  const { error: toastError, success: toastSuccess } = useToast();

  useEffect(() => {
    if (embedded) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [embedded]);

  // Prioritize invoiceData (current form) over invoice (previously viewed)
  const previewData = invoiceData || invoice;
  const previewCalcs = invoiceData
    ? calculations
    : (() => {
      // Handle both 'items' and 'products' fields
      const itemsArray = invoice.items || invoice.products || [];
      const subtotal = itemsArray.reduce((sum, item) => sum + (item.amount || item.total || 0), 0);

      const invoiceTotal = Number(invoice?.amount ?? invoice?.total ?? subtotal ?? 0);
      return {
        subtotal: subtotal,
        cgstAmount: (subtotal * (invoice?.cgst || 0)) / 100,
        sgstAmount: (subtotal * (invoice?.sgst || 0)) / 100,
        igstAmount: (subtotal * (invoice?.igst || 0)) / 100,
        roundOffAmount: invoice?.isRoundOff
          ? Math.round(invoiceTotal) - invoiceTotal
          : 0,
        total: invoice?.isRoundOff ? Math.round(invoiceTotal) : invoiceTotal,
      };
    })();

  const isPaid =
    (previewData?.status || "").toLowerCase() === "paid" ||
    (previewData?.paymentStatus || "").toUpperCase() === "PAID";
  const paidAmount = Number(previewData?.paidAmount || 0);
  const balanceDue = Math.max(0, Number(previewCalcs?.total || 0) - paidAmount);

  const convertToWords = (amount) => {
    const ones = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    ];
    const tens = [
      "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
    ];
    const teens = [
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
    ];

    const convertHundreds = (num) => {
      let result = "";
      if (num >= 100) {
        result += ones[Math.floor(num / 100)] + " Hundred ";
        num %= 100;
      }
      if (num >= 20) {
        result += tens[Math.floor(num / 10)] + " ";
        num %= 10;
      } else if (num >= 10) {
        result += teens[num - 10] + " ";
        return result;
      }
      if (num > 0) {
        result += ones[num] + " ";
      }
      return result;
    };

    if (amount === 0) return "Zero";

    const crores = Math.floor(amount / 10000000);
    const lakhs = Math.floor((amount % 10000000) / 100000);
    const thousands = Math.floor((amount % 100000) / 1000);
    const hundreds = amount % 1000;

    let words = "";
    if (crores > 0) words += convertHundreds(crores) + "Crore ";
    if (lakhs > 0) words += convertHundreds(lakhs) + "Lakh ";
    if (thousands > 0) words += convertHundreds(thousands) + "Thousand ";
    if (hundreds > 0) words += convertHundreds(hundreds);

    return words.trim() + " Only";
  };

  const { user } = useContext(AuthContext);
  const { settings } = useSettings();
  const validTotal = Number(previewCalcs?.total || 0);
  const amountInWords = convertToWords(Math.floor(validTotal));

  const origin = (typeof window !== "undefined" && window.location && window.location.origin)
    ? window.location.origin
    : "http://localhost:5173";

  const currentUserId = user?.uid || previewData?.userId || previewData?.uid || "";
  const rawId = previewData?.id || previewData?.invoiceNumber || "";
  const currentInvoiceId = previewData?.id ? previewData.id : String(rawId).replace(/\//g, "_");

  let razorpayUrl = "";
  if (currentUserId && currentInvoiceId) {
    razorpayUrl = `${origin}/pay/${currentUserId}/${encodeURIComponent(currentInvoiceId)}`;
  } else if (previewData?.razorpayLink || settings?.systemSettings?.value?.systemConfig?.razorpayLink) {
    const baseLink = previewData?.razorpayLink || settings?.systemSettings?.value?.systemConfig?.razorpayLink;
    razorpayUrl = baseLink.includes("?")
      ? `${baseLink}&amount=${previewCalcs.total.toFixed(2)}`
      : `${baseLink}?amount=${previewCalcs.total.toFixed(2)}`;
  } else {
    razorpayUrl = `${origin}/pay/invoice/${encodeURIComponent(currentInvoiceId || 'latest')}`;
  }

  const handleOpenRazorpayCheckout = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const amount = previewCalcs.total;
    if (!amount || amount <= 0) {
      if (toastError) toastError("Invalid invoice amount");
      return;
    }

    try {
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        if (toastError) toastError("Razorpay SDK failed to load. Check your internet connection.");
        return;
      }
      const res = await fetch("http://localhost:5000/create-razorpay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          receipt: previewData?.invoiceNumber || `inv_${Date.now()}`,
          notes: {
            customerName: previewData?.clientName || "",
            invoiceNumber: previewData?.invoiceNumber || ""
          }
        })
      });

      const orderData = await res.json();
      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to create Razorpay order");
      }

      const keyId = orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_Tcxout7GfUZzbE";

      if (window.Razorpay) {
        const options = {
          key: keyId,
          amount: orderData.amount,
          currency: orderData.currency || "INR",
          name: "Techno Vanam Billing",
          description: `Payment for Invoice #${previewData?.invoiceNumber || ""}`,
          order_id: orderData.orderId,
          handler: async function (response) {
            try {
              const verifyRes = await fetch("http://localhost:5000/verify-razorpay-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response)
              });
              const verifyData = await verifyRes.json();
              if (verifyData.success) {
                if (toastSuccess) toastSuccess("Payment Successful! ID: " + response.razorpay_payment_id);
              } else {
                if (toastError) toastError("Payment Verification Failed");
              }
            } catch (err) {
              if (toastError) toastError("Error verifying payment: " + err.message);
            }
          },
          prefill: {
            name: previewData?.clientName || "",
            email: previewData?.clientEmail || "",
            contact: previewData?.clientPhone || ""
          },
          theme: {
            color: "#2563eb"
          }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        window.open(razorpayUrl, "_blank");
      }
    } catch (err) {
      console.error("Razorpay error:", err);
      window.open(razorpayUrl, "_blank");
    }
  };



  const handleSaveAsPDF = async () => {
    try {
      const element = document.getElementById("invoice-print-root");
      if (!element) {
        toastError("Preview content not found");
        if (onDownloadComplete) onDownloadComplete();
        return;
      }

      // Capture all styles
      const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
        .map(style => style.outerHTML)
        .join("\n");

      // Send to backend
      const response = await fetch("http://localhost:5000/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: element.outerHTML,
          css: styles,
          baseUrl: window.location.origin + '/'
        })
      });

      if (!response.ok) {
        throw new Error("Server failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${(previewData || invoice).invoiceNumber.replaceAll("/", "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      if (onDownloadComplete) onDownloadComplete();

    } catch (error) {
      console.error("PDF Generation Error:", error);
      toastError("Failed to generate PDF. Please try again.");
      if (onDownloadComplete) onDownloadComplete();
    }
  };

  useEffect(() => {
    if (autoDownload) {
      // Small delay to ensure render
      const timer = setTimeout(() => {
        handleSaveAsPDF();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoDownload]);

  const handlePrint = () => {
    // Select the OUTER wrapper which has the padding
    const printContent = document.querySelector('.invoice-print-wrapper');
    if (!printContent) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;

    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
      doc.head.appendChild(node.cloneNode(true));
    });

    const style = document.createElement('style');
    style.textContent = `
      @media print {
        @page { 
            size: A4; 
            margin: 0; 
        }
        body { 
            margin: 0;
            background: white;
            -webkit-print-color-adjust: exact;
        }
        /* Wrapper ensures 15mm padding */
        .invoice-print-wrapper {
            margin: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 15mm !important;
            box-sizing: border-box !important;
            background-color: white !important;
            display: flex !important;
            flex-direction: column !important;
        }
        /* Content fills the wrapper area */
        .invoice-preview-content {
            border: 2px solid black !important;
            width: 100% !important;
            flex-grow: 1 !important;
            box-shadow: none !important;
            margin: 0 !important;
        }
      }
    `;
    doc.head.appendChild(style);

    doc.body.appendChild(printContent.cloneNode(true));

    const images = doc.querySelectorAll('img');
    const promises = Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });

    Promise.all(promises).then(() => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }, 500);
    });
  };





  // If not embedded, render the modal
  return (
    <div className={embedded ? "absolute top-0 left-0 bg-white z-50 w-auto" : "fixed inset-0 overflow-hidden bg-black/50 flex items-center justify-center z-50 p-4"}>
      <div className={embedded ? "w-full" : "bg-white rounded-lg shadow-2xl max-w-5xl w-full h-[90vh] max-h-[90vh] flex flex-col overflow-hidden"}>
        {!embedded && (
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
            <h2 className="text-lg font-bold text-gray-900">Invoice Preview</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSaveAsPDF}
                className="flex items-center px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Save as PDF
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center px-3 py-1.5 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </button>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        <div
          onWheel={(event) => event.stopPropagation()}
          className={embedded ? "bg-white flex justify-center p-0" : "min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gray-100 p-8 flex flex-col items-center"}
        >
          {!embedded && <PaymentLinkControls invoice={previewData || invoice} onUpdateInvoice={onUpdateInvoice} />}

          {/* Outer Page Wrapper (A4) - Handles the 15mm white space */}
          <div
            className="invoice-print-wrapper bg-white shadow-lg mx-auto flex flex-col"
            style={{
              width: "210mm",
              minHeight: "297mm",
              padding: "15mm",
              boxSizing: "border-box"
            }}
          >
            {/* Inner Content (Invoice) - Handles the border and actual data */}
            <div
              id="invoice-print-root"
              className="invoice-preview-content border-2 border-black flex flex-col flex-grow"
              style={{ width: "100%", height: "100%" }}
            >
              {/* Header Phone Numbers */}
              <div className="flex justify-between px-4 py-2 font-bold text-sm">
                <div>☎ 98432 94464</div>
                <div>☎ 96984 87096</div>
              </div>

              {/* Main Header */}
              <div className="text-center border-b border-black pb-2 ">
                <div className="flex pl-8">
                  <img
                    src="https://res.cloudinary.com/dnmvriw3e/image/upload/v1756868204/ESA_uggt8u.png"
                    alt="ESA Logo"
                    className="h-16"
                  />
                  <div className="flex">
                    <div className="text-center">
                      <h1
                        className="text-4xl font-bold"
                        style={{
                          fontFamily: '"Times New Roman", serif',
                          color: "#d00000ff",
                          margin: 0,
                        }}
                      >
                        ESA ENGINEERING WORKS
                      </h1>
                      <div className="text-md text-black">
                        <p>All Kinds of Lathe and Milling Works</p>
                        <p>Specialist in : Press Tools, Die Casting Tools, Precision Components</p>
                        <p>1/100, Chettipalayam Road, E.B. Compound, Malumichampatti, CBE - 641 050.</p>
                        <p>E-Mail : esaengineeringworks@gmail.com | GSTIN : 33AMWPB2116Q1ZS</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Title */}
              <div className="flex border-b border-black">
                <div className="w-[20%] border-r border-black pl-2 flex items-center text-sm">
                  <span className="font-bold mr-2">NO :</span> {previewData.invoiceNumber}
                </div>
                <div className="w-[49.9%] text-center font-bold text-2xl pl-2">
                  INVOICE
                </div>
                <div className="w-[30.1%] border-l border-black pl-2 flex items-center text-sm">
                  <span className="font-bold mr-2">DATE :</span> {previewData.invoiceDate}
                </div>
              </div>

              {/* Client & Invoice Details */}
              <div className="flex border-b border-black">
                <div className="w-[70%] border-r border-black text-sm flex flex-col h-32">
                  <div className="pl-2 pt-1 flex-grow">
                    <div>To, M/s,</div>
                    <div className="font-bold ml-4">{previewData.client?.name}</div>
                    <div className="ml-4">{previewData.client?.address}</div>
                  </div>
                  <div className="h-8 border-t border-black pl-2 flex items-center">
                    GSTIN : {previewData.client?.taxId || previewData.client?.company || previewData.client?.gst || ""}
                  </div>
                </div>
                <div className="w-[30%] text-sm h-32">
                  <div className="border-b border-black pl-2 h-8 flex items-center">
                    <span className="font-bold mr-2">P.O. No :</span> {previewData.poNumber || ""}
                  </div>
                  <div className="border-b border-black pl-2 h-8 flex items-center">
                    <span className="font-bold mr-2">P.O. Date :</span> {previewData.poDate || ""}
                  </div>
                  <div className="border-b border-black pl-2 h-8 flex items-center">
                    <span className="font-bold mr-2">D.C. No :</span> {previewData.dcNumber || ""}
                  </div>
                  <div className="pl-2 h-8 flex items-center">
                    <span className="font-bold mr-2">D.C. Date :</span> {previewData.dcDate || ""}
                  </div>
                </div>
              </div>

              {/* Items Table - Added flex-grow to push footer down */}
              <div className="flex-grow">
                <table className="w-full text-sm border-b border-black h-full">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="w-[5%] border-r border-black p-1 text-center">S.No.</th>
                      <th className="w-[55%] border-r border-black p-1 text-center">PARTICULARS</th>
                      <th className="w-[10%] border-r border-black p-1 text-center">HSN CODE</th>
                      <th className="w-[6%] border-r border-black p-1 text-center">QTY.</th>
                      <th className="w-[10%] border-r border-black p-1 text-center">RATE</th>
                      <th className="w-[19%] p-1 text-center">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(previewData.items || previewData.products || []).map((item, index) => (
                      <tr key={index}>
                        <td className="border-r border-black p-1 text-center">{index + 1}</td>
                        <td className="border-r border-black p-1">{item.description || item.name}</td>
                        <td className="border-r border-black p-1 text-center">{item.hsnCode || item.hsn}</td>
                        <td className="border-r border-black p-1 text-center">{item.quantity}</td>
                        <td className="border-r border-black p-1 text-right">{item.rate || item.price}</td>
                        <td className="p-1 text-right">{item.amount || item.total}</td>
                      </tr>
                    ))}

                    {new Array(Math.max(0, 12 - (previewData.items || previewData.products || []).length))
                      .fill(0)
                      .map((_, index) => (
                        <tr key={`empty-${index}`}>
                          <td className="border-r border-black p-1 h-6">&nbsp;</td>
                          <td className="border-r border-black p-1"></td>
                          <td className="border-r border-black p-1"></td>
                          <td className="border-r border-black p-1"></td>
                          <td className="border-r border-black p-1"></td>
                          <td className="p-1"></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Section - Added mt-auto to ensure it sits at bottom */}
              <table className="w-full text-sm mt-auto">
                <tbody>
                  {/* Invoice Notes Row - Only show if notes exist */}
                  {previewData.invoiceNotes && (
                    <tr>
                      <td className="p-1 pl-10 align-top border-b" colSpan="2">
                        <div className="text-sm">{previewData.invoiceNotes}</div>
                      </td>
                      <td className="border-black p-1 border-b" colSpan="2"></td>
                    </tr>
                  )}

                  {/* Bank Details Row */}
                  <tr>
                    <th scope="row" className="w-[15%] p-1 font-normal text-left">Bank Details :</th>
                    <td className="w-[55%] p-1">Bank Name : State Bank Of India</td>
                    <th scope="row" className="w-[16%] border-l border-b border-black p-1 font-normal text-left">SUB TOTAL</th>
                    <td className="w-[16%] border-l border-b border-black p-1 text-right">
                      {(Number(previewCalcs?.subtotal || 0)).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-1 pl-9" colSpan="2">
                      <span className="inline-block w-20">&nbsp;</span>
                      A/C No : 42455711572
                    </td>
                    <th scope="row" className="border-l border-b border-black p-1 font-normal text-left">
                      CGST <span className="ml-6">{previewData.cgst}%</span>
                    </th>
                    <td className="border-l border-b border-black p-1 text-right">
                      {(Number(previewCalcs?.cgstAmount || 0)).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-1 pl-9" colSpan="2">
                      <span className="inline-block w-20">&nbsp;</span>
                      IFSC Code : SBIN0015017
                    </td>
                    <th scope="row" className="border-l border-b border-black p-1 font-normal text-left">
                      SGST <span className="ml-6">{previewData.sgst}%</span>
                    </th>
                    <td className="border-l border-b border-black p-1 text-right">
                      {(Number(previewCalcs?.sgstAmount || 0)).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-1 pl-9" colSpan="2">
                      <span className="inline-block w-20">&nbsp;</span>
                      Branch : Malumichampatti
                    </td>
                    <th scope="row" className="border-l border-b border-black p-1 font-normal text-left">
                      IGST <span className="ml-6">{previewData.igst}%</span>
                    </th>
                    <td className="border-l border-b border-black p-1 text-right">
                      {(Number(previewCalcs?.igstAmount || 0)).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    {/* LEFT SIDE — Rupees spans 2 rows */}
                    <td
                      className="border-t p-2 align-middle"
                      colSpan={2}
                      rowSpan={2}
                    >
                      <div className="flex flex-row items-center justify-between gap-4 w-full h-full min-h-[44px]">
                        <div>
                          <span className="font-bold">Rupees :</span>{" "}
                          <span className="font-normal">{amountInWords}</span>
                        </div>
                        <div>
                          {isPaid ? (
                            <span
                              className="inline-block px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded shadow-sm border border-emerald-700"
                              style={{
                                backgroundColor: "#10b981",
                                color: "#ffffff",
                                padding: "6px 12px",
                                borderRadius: "4px",
                                fontSize: "12px",
                                fontWeight: "bold",
                                border: "1px solid #059669"
                              }}
                            >
                              ✓ PAID IN FULL
                            </span>
                          ) : (
                            <a
                              href={razorpayUrl}
                              onClick={handleOpenRazorpayCheckout}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded shadow-sm transition-colors border border-blue-700 no-underline cursor-pointer"
                              style={{
                                backgroundColor: "#2563eb",
                                color: "#ffffff",
                                textDecoration: "none",
                                display: "inline-block",
                                padding: "6px 12px",
                                borderRadius: "4px",
                                fontSize: "12px",
                                fontWeight: "bold",
                                border: "1px solid #1d4ed8"
                              }}
                            >
                              {paidAmount > 0 ? `Pay Balance (₹${balanceDue.toFixed(2)})` : 'Pay'}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* RIGHT SIDE — ROUND OFF */}
                    <td className="border-b border-l text-right font-bold">
                      ROUND OFF
                    </td>
                    <td className="border-b border-l  text-right">
                      {(Number(previewCalcs?.roundOffAmount || 0)).toFixed(2)}
                    </td>
                  </tr>

                  <tr>
                    {/* RIGHT SIDE — NET TOTAL */}
                    <td className="border-b border-l text-right font-bold">
                      NET TOTAL
                    </td>
                    <td className="border-b border-l text-right font-bold">
                      {(Number(previewCalcs?.total || 0)).toFixed(2)}
                    </td>
                  </tr>

                  {paidAmount > 0 && (
                    <>
                      <tr>
                        <td className="border-b border-l text-right text-emerald-700 font-bold text-xs">
                          PAID / RECEIVED
                        </td>
                        <td className="border-b border-l text-right text-emerald-700 font-bold text-xs">
                          -{(Number(paidAmount)).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="border-b border-l text-right text-red-700 font-bold text-sm">
                          BALANCE DUE
                        </td>
                        <td className="border-b border-l text-right text-red-700 font-bold text-sm">
                          {(Number(balanceDue)).toFixed(2)}
                        </td>
                      </tr>
                    </>
                  )}

                  <tr>
                    <td className=" border-t border-black align-top" colSpan="2" rowSpan="2">
                      <div className="font-bold mb-1">Declaration</div>
                      <div className="text-md">
                        We declare that this invoice shows the actual price of the goods Described and that all Particulars are true and correct
                      </div>
                    </td>

                  </tr>
                  <tr>
                    <td className="border-l border-black h-20 align-bottom text-left" colSpan="2">
                      <div className="font-bold text-red-600 mb-8">For ESA Engineering Works</div>
                      <div className="text-md text-right">Authorized Signatory</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div> {/* End of Inner Invoice Content */}
          </div> {/* End of Outer Print Wrapper */}
        </div> {/* End of Overflow Container */}
      </div>
    </div>
  );
};

const CreateInvoiceComponent = ({
  editingInvoice,
  invoiceData,
  clients,
  products,
  calculations,
  setCurrentPage,
  saveDraft,
  handlePreview, // Renamed/Passed prop
  setShowPreview, // Kept for other uses if any, but main one is handlePreview
  updateInvoice,
  saveInvoice,
  setInvoiceData,
  handleClientSelect,
  handleAddNewProduct,
  addItem,
  updateItem,
  removeItem,
}) => (
  <div className="min-h-screen text-slate-800 font-mazzard">
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <button
            onClick={() => setCurrentPage("management")}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {editingInvoice ? "Edit Invoice" : "Create Invoice"}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {editingInvoice
                ? "Update details for an existing invoice"
                : "Create a new invoice for your client"}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-sm font-medium">
          <button
            onClick={() => setCurrentPage("management")}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={saveDraft}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </button>
          <button
            onClick={handlePreview}
            className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </button>
          <button
            onClick={editingInvoice ? updateInvoice : saveInvoice}
            className="flex items-center px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            <FileText className="w-4 h-4 mr-2" />
            {editingInvoice ? "Update Invoice" : "Save Invoice"}
          </button>
        </div>
      </div>
      <main className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Invoice Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Invoice Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={invoiceData.invoiceNumber}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      invoiceNumber: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Invoice Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  max="9999-12-31"
                  value={invoiceData.invoiceDate}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      invoiceDate: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  P.O. Number
                </label>
                <input
                  type="text"
                  value={invoiceData.poNumber}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      poNumber: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  P.O. Date
                </label>
                <input
                  type="date"
                  max="9999-12-31"
                  value={invoiceData.poDate}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      poDate: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                    D.O. Number
                </label>
                <input
                  type="text"
                  value={invoiceData.dcNumber}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      dcNumber: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                    D.O. Date
                </label>
                <input
                  type="date"
                  max="9999-12-31"
                  value={invoiceData.dcDate}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      dcDate: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  max="9999-12-31"
                  value={invoiceData.dueDate}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      dueDate: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                />
              </div>
            </div>
          </div>
          <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Client Information <span className="text-red-500">*</span>
            </h3>
            <ClientAutocomplete
              clients={clients}
              selectedClient={invoiceData.client}
              onSelect={handleClientSelect}
            />
          </div>
          <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Items & Services <span className="text-red-500">*</span>
              </h3>
              <button
                onClick={addItem}
                className="flex items-center px-3 py-1.5 text-white bg-blue-600 rounded-lg text-xs font-medium hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </button>
            </div>
            <div>
              <table className="w-full">
                <thead className="text-xs uppercase font-semibold text-gray-500">
                  <tr>
                    <th className="p-2 text-left w-[5%]">S.No</th>
                    <th className="p-2 text-left w-[35%]">Description</th>
                    <th className="p-2 text-left w-[10%]">HSN</th>
                    <th className="p-2 text-left w-[10%]">Qty</th>
                    <th className="p-2 text-left w-[10%]">Rate (₹)</th>
                    <th className="p-2 text-left w-[12%]">Amount (₹)</th>
                    <th className="p-2 text-left w-[5%]"></th>
                  </tr>
                </thead>
                <tbody>
                  {(invoiceData.items || invoiceData.products || []).map((item, index) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-4 text-sm align-top">{index + 1}</td>
                      <td className="p-2">
                        <ProductAutocomplete
                          products={products}
                          value={item.description || item.name || ''}
                          onSelect={(product) => {
                            updateItem(item.id, "description", product.name);
                            updateItem(item.id, "hsnCode", product.hsn);
                            updateItem(item.id, "rate", product.price);
                          }}
                          onChange={(val) =>
                            updateItem(item.id, "description", val)
                          }
                          onAddNewProduct={handleAddNewProduct}
                          clientId={invoiceData.clientId}
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          placeholder="HSN"
                          value={item.hsnCode || item.hsn || ''}
                          onChange={(e) =>
                            updateItem(item.id, "hsnCode", e.target.value)
                          }
                          className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="number"
                          value={item.quantity || 0}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "quantity",
                              Number.parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                          min="0"
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="number"
                          value={item.rate || item.price || 0}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "rate",
                              Number.parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                          min="0"
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          value={(item.amount || item.total || 0).toLocaleString()}
                          readOnly
                          className="w-full px-3 py-2 text-sm bg-gray-200 border-0 rounded-lg text-gray-600"
                        />
                      </td>
                      <td className="p-2 align-top">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded"
                        >
                          <Trash2 className="w-4 h-7" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <label className="block text-sm text-gray-700 mb-1">
                Invoice Notes (Optional)
              </label>
              <textarea
                placeholder="e.g., For labour charges only"
                value={invoiceData.invoiceNotes}
                onChange={(e) =>
                  setInvoiceData((prev) => ({
                    ...prev,
                    invoiceNotes: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg resize-none h-16 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
        </div>
        <div className="space-y-8">
          <div className="p-6 bg-white rounded-xl border border-gray-200">
            <h3 className="mb-4 text-lg font-bold text-gray-900">
              Tax & Calculation
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label htmlFor="cgstInput" className="block mb-1 text-sm text-gray-700">
                  CGST (%)
                </label>
                <input
                  id="cgstInput"
                  type="number"
                  value={invoiceData.cgst}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      cgst: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label htmlFor="sgstInput" className="block mb-1 text-sm text-gray-700">
                  SGST (%)
                </label>
                <input
                  id="sgstInput"
                  type="number"
                  value={invoiceData.sgst}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      sgst: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label htmlFor="igstInput" className="block mb-1 text-sm text-gray-700">
                  IGST (%)
                </label>
                <input
                  id="igstInput"
                  type="number"
                  value={invoiceData.igst}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      igst: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                  min="0"
                  max="100"
                />
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-gray-700 select-none">
                Enable Round Off
              </span>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${invoiceData.isRoundOff ? "bg-blue-600" : "bg-gray-200"
                  }`}
                onClick={() =>
                  setInvoiceData((prev) => ({
                    ...prev,
                    isRoundOff: !prev.isRoundOff,
                  }))
                }
              >
                <span className="sr-only">Enable Round Off</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${invoiceData.isRoundOff ? "translate-x-5" : "translate-x-0"
                    }`}
                />
              </button>
            </div>
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-100 mt-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-semibold text-slate-900">
                    ₹
                    {calculations.subtotal.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {invoiceData.cgst > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      CGST ({invoiceData.cgst}%):
                    </span>
                    <span className="font-semibold text-slate-900">
                      ₹
                      {calculations.cgstAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                {invoiceData.sgst > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      SGST ({invoiceData.sgst}%):
                    </span>
                    <span className="font-semibold text-slate-900">
                      ₹
                      {calculations.sgstAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                {invoiceData.igst > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      IGST ({invoiceData.igst}%):
                    </span>
                    <span className="font-semibold text-slate-900">
                      ₹
                      {calculations.igstAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                {invoiceData.isRoundOff && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Round Off:</span>
                    <span className="font-semibold text-slate-900">
                      ₹
                      {calculations.roundOffAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center text-lg font-bold text-slate-900">
                    <span>Total Amount:</span>
                    <span>
                      ₹
                      {calculations.total.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 bg-white rounded-xl border border-gray-200">
            <h3 className="mb-4 text-lg font-bold text-gray-900">
              Payment & Notes
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-sm text-gray-700">
                  Bank Details
                </label>
                <div className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-0">
                  State Bank Of India
                </div>
              </div>
              <div>
                <label className="block mb-1 text-sm text-gray-700">
                  Declaration
                </label>
                <textarea
                  value={invoiceData.declaration}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      declaration: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg resize-none h-20 focus:outline-none focus:ring-0"
                />
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  </div>
);

const InvoiceManagementComponent = ({
  activeTab,
  searchTerm,
  filteredInvoices,
  setActiveTab,
  setSearchTerm,
  handleCreateInvoice,
  getStatusColor,
  handleViewInvoice,
  handleEditInvoice,
  handleDownloadInvoice,
  getDynamicStatus,
  pagination,
  onPageChange,
  itemsPerPage,
  productConfirmation, // Added prop
  handleProductConfirmationSkip, // Added prop
  handleProductConfirmationConfirm, // Added prop
  onItemsPerPageChange,
  loading,
  // Filter props
  showFilters,
  setShowFilters,
  filterReportType,
  setFilterReportType,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  filterTimePeriod,
  setFilterTimePeriod,
  filterFromDate,
  setFilterFromDate,
  filterToDate,
  setFilterToDate,
  filterClientId,
  setFilterClientId,
  filterRef,
  clearFilters,
  hasActiveFilters,
  customers,
  currentYear,
}) => {
  const tabs = ["All Invoices", "Paid", "Unpaid", "Drafts", "Overdue"];

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Invoice Management
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage all your invoices in one place
            </p>
          </div>
        </header>
        <main className="mt-6 flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="w-fit lg:w-auto overflow-x-auto pb-1">
              <div className="flex p-1 bg-white border border-slate-300 rounded-xl whitespace-nowrap shadow-xs">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              <div className="relative w-full sm:w-auto flex-1 lg:flex-none">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Filter Button & Dropdown */}
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all border shadow-xs ${hasActiveFilters || showFilters
                    ? "bg-blue-50 text-blue-600 border-blue-300"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                >
                  <Filter size={16} />
                  Filter
                  {hasActiveFilters && <span className="w-2 h-2 bg-blue-600 rounded-full"></span>}
                </button>

                {showFilters && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-900">Filters</h3>
                      <button
                        onClick={clearFilters}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Report Type Filter */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Report Type
                        </label>
                        <div className="relative">
                          <select
                            value={filterReportType}
                            onChange={(e) => setFilterReportType(e.target.value)}
                            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                          >
                            <option>All Time</option>
                            <option>Monthly Report</option>
                            <option>Yearly Report</option>
                            <option>Custom Report</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Date Selectors based on Report Type */}
                      {filterReportType === "Monthly Report" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Month</label>
                            <div className="relative">
                              <select
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                                className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                              >
                                {Array.from({ length: 12 }, (_, i) => (
                                  <option key={i} value={i}>
                                    {new Date(0, i).toLocaleString("default", { month: "long" })}
                                  </option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <ChevronDown size={14} />
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Year</label>
                            <div className="relative">
                              <select
                                value={filterYear}
                                onChange={(e) => setFilterYear(parseInt(e.target.value))}
                                className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                              >
                                {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(
                                  (year) => (
                                    <option key={year} value={year}>
                                      {year}
                                    </option>
                                  )
                                )}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <ChevronDown size={14} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {filterReportType === "Yearly Report" && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Financial Year</label>
                          <div className="relative">
                            <select
                              value={filterTimePeriod}
                              onChange={(e) => setFilterTimePeriod(e.target.value)}
                              className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                            >
                              <option value="2024">2024-25</option>
                              <option value="2025">2025-26</option>
                              <option value="2023">2023-24</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                              <ChevronDown size={14} />
                            </div>
                          </div>
                        </div>
                      )}

                      {filterReportType === "Custom Report" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">From</label>
                            <div className="relative">
                              <input
                                type="date"
                                max="9999-12-31"
                                value={filterFromDate}
                                onChange={(e) => setFilterFromDate(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">To</label>
                            <div className="relative">
                              <input
                                type="date"
                                max="9999-12-31"
                                value={filterToDate}
                                onChange={(e) => setFilterToDate(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Client Filter */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Client
                        </label>
                        <select
                          value={filterClientId}
                          onChange={(e) => setFilterClientId(e.target.value)}
                          className="w-full text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                        >
                          <option value="">All Clients</option>
                          {(customers || []).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                      <button
                        onClick={() => setShowFilters(false)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateInvoice}
                className="w-full sm:w-auto flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </button>
            </div>
          </div>
          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full min-w-[800px]">
              <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left">Invoice No</th>
                  <th scope="col" className="px-6 py-3 text-left">Date</th>
                  <th scope="col" className="px-6 py-3 text-left">Client</th>
                  <th scope="col" className="px-6 py-3 text-left">Amount</th>
                  <th scope="col" className="px-6 py-3 text-left">Due Date</th>
                  <th scope="col" className="px-6 py-3 text-left">Status</th>
                  <th scope="col" className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    </tr>
                  ))
                ) : filteredInvoices.length > 0 ? (
                  filteredInvoices.map((invoice) => {
                    const dynamicStatus = getDynamicStatus(invoice);
                    return (
                      <tr
                        key={invoice.id}
                        className="text-sm transition-colors hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {invoice.invoiceDate}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {invoice.client?.name || "Unknown"}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          <div>₹{Number(invoice?.amount ?? invoice?.total ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                          {Number(invoice?.paidAmount || 0) > 0 && Number(invoice?.paidAmount || 0) < Number(invoice?.amount ?? invoice?.total ?? 0) && (
                            <div className="text-xs space-y-0.5 mt-0.5">
                              <span className="text-emerald-600 font-medium block">Received: ₹{Number(invoice.paidAmount).toLocaleString("en-IN")}</span>
                              <span className="text-red-600 font-bold block">Balance Due: ₹{(Number(invoice?.amount ?? invoice?.total ?? 0) - Number(invoice.paidAmount)).toLocaleString("en-IN")}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {invoice.dueDate}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-white text-xs font-medium ${getStatusColor(
                              dynamicStatus
                            )}`}
                          >
                            {dynamicStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleViewInvoice(invoice)}
                              className="p-1 text-gray-600 transition-colors hover:text-blue-600"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditInvoice(invoice)}
                              className="p-1 text-gray-600 transition-colors hover:text-green-600"
                              title="Edit Invoice"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadInvoice(invoice)}
                              className="p-1 text-gray-600 transition-colors hover:text-purple-600"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="mb-2 text-gray-500">
                        No invoices found
                      </div>
                      <p className="text-sm text-gray-400">
                        {searchTerm
                          ? "Try adjusting your search terms"
                          : "Create your first invoice to get started"}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pagination && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={onPageChange}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={onItemsPerPageChange}
              totalItems={pagination.total}
              startIndex={(pagination.page - 1) * pagination.limit}
              endIndex={pagination.page * pagination.limit}
            />
          )}
        </main>
      </div >
    </div >
  );
};

InvoiceManagementComponent.propTypes = {
  activeTab: PropTypes.string.isRequired,
  searchTerm: PropTypes.string.isRequired,
  filteredInvoices: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      invoiceNumber: PropTypes.string.isRequired,
      invoiceDate: PropTypes.string.isRequired,
      dueDate: PropTypes.string,
      amount: PropTypes.number.isRequired,
      status: PropTypes.string.isRequired,
      client: PropTypes.shape({
        name: PropTypes.string.isRequired,
      }).isRequired,
    })
  ).isRequired,
  setActiveTab: PropTypes.func.isRequired,
  setSearchTerm: PropTypes.func.isRequired,
  handleCreateInvoice: PropTypes.func.isRequired,
  getStatusColor: PropTypes.func.isRequired,
  handleViewInvoice: PropTypes.func.isRequired,
  handleEditInvoice: PropTypes.func.isRequired,
  handleDownloadInvoice: PropTypes.func.isRequired,
  getDynamicStatus: PropTypes.func.isRequired,
  pagination: PropTypes.shape({
    page: PropTypes.number,
    totalPages: PropTypes.number,
    total: PropTypes.number,
    limit: PropTypes.number,
  }),
  onPageChange: PropTypes.func,
  itemsPerPage: PropTypes.number,
  onItemsPerPageChange: PropTypes.func,
  loading: PropTypes.bool,
};

const InvoiceManagementSystem = () => {
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState("management");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [activeTab, setActiveTab] = useState("All Invoices");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const { success, error: showError, warning } = useToast();

  // Filter state variables
  const [showFilters, setShowFilters] = useState(false);
  const [filterReportType, setFilterReportType] = useState("Yearly Report");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterTimePeriod, setFilterTimePeriod] = useState(new Date().getFullYear().toString());
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [filterClientId, setFilterClientId] = useState("");
  const filterRef = useRef(null);
  const currentYear = new Date().getFullYear();

  // Get authentication context
  const { user } = useContext(AuthContext);

  // Handle navigation from dashboard
  useEffect(() => {
    if (location.state?.action === "create") {
      setCurrentPage("create");
      setEditingInvoice(null);
      // Clear the state to prevent repeated triggers
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Use data hooks
  const statusParam = useMemo(() => {
    if (activeTab === "All Invoices") return undefined;
    if (activeTab === "Drafts") return "Draft";
    return activeTab;
  }, [activeTab]);

  const sortDirection = useMemo(() => {
    // All Invoices: newest first (descending)
    // Other tabs (Paid, Unpaid, Drafts, Overdue): oldest first (ascending)
    return activeTab === "All Invoices" ? "desc" : "asc";
  }, [activeTab]);

  const {
    invoices,
    allInvoices,
    loading: invoicesLoading,
    error: invoicesError,
    pagination,
    addInvoice,
    editInvoice,
    removeInvoice
  } = useInvoices({
    search: searchTerm,
    page: page,
    limit: itemsPerPage,
    status: statusParam,
    sortBy: "invoiceNumber",
    sortDirection: sortDirection
  });

  // Reset page when search or tab changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, activeTab]);

  const { customers, error: customersError } = useCustomers();

  const { products, addProduct, error: productsError } = useProducts();

  // Use Settings hook to fetch company info
  const { settings, loading: settingsLoading, error: settingsError } = useSettings();

  const generateNextInvoiceNumber = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const financialYearStart =
      today.getMonth() >= 3 ? currentYear : currentYear - 1; // Financial year starts in April (month 3)
    const financialYearEnd = financialYearStart + 1;
    const financialYearString = `${financialYearStart}-${financialYearEnd
      .toString()
      .slice(2)}`;

    // Use allInvoices instead of paginated invoices
    const invoicesInCurrentYear = (allInvoices || []).filter((inv) => {
      // Check if invoice belongs to current financial year
      return inv.invoiceNumber && inv.invoiceNumber.endsWith(`/${financialYearString}`);
    });

    if (invoicesInCurrentYear.length === 0) {
      return `001/${financialYearString}`;
    }

    const maxNumber = invoicesInCurrentYear.reduce((max, invoice) => {
      // Extract number part: "INV 001/2025-26" -> "001"
      // Split by space first, then take the last part (number/year), then split by slash
      // Or regex match
      const match = invoice.invoiceNumber.match(/(\d+)\/\d{4}-\d{2}$/);
      if (match && match[1]) {
        return Math.max(Number.parseInt(match[1], 10), max);
      }
      return max;
    }, 0);

    return `${String(maxNumber + 1).padStart(3, "0")}/${financialYearString}`;
  };

  const getInitialInvoiceData = () => ({
    invoiceNumber: generateNextInvoiceNumber(),
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    poNumber: "",
    poDate: "",
    dcNumber: "",
    dcDate: "",
    clientId: "",
    client: null,
    items: [],
    cgst: 9,
    sgst: 9,
    igst: 0,
    bankDetails: "State Bank Of India",
    status: "Unpaid",
    declaration:
      "We declare that this invoice shows the actual price of the goods Described and that all Particulars are true and correct.",
    isRoundOff: false,
    invoiceNotes: "",
  });

  const [invoiceData, setInvoiceData] = useState(getInitialInvoiceData);

  // Mock data removed - now using data from hooks above

  const [calculations, setCalculations] = useState({
    subtotal: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    roundOffAmount: 0,
    total: 0,
  });

  // Sample invoices removed - now using data

  const getDynamicStatus = (invoice) => {
    if (invoice.status === "Draft" || invoice.status === "draft")
      return "Draft";

    const received = Number(invoice.paidAmount || invoice.received || 0);
    const total = Number(invoice.total || invoice.amount || 0);
    const tds = Number(invoice.tdsAmount || 0);

    if (total > 0 && (received + tds >= total || Math.abs(total - (received + tds)) < 1)) {
      return "Paid";
    }

    if (invoice.status === "Paid" || invoice.status === "paid") return "Paid";

    if (received > 0 && (received + tds < total)) {
      return "Partial";
    }

    const today = new Date();
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    if (dueDate && !isNaN(dueDate.getTime())) {
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      if (today > dueDate) return "Overdue";
    }
    return "Unpaid";
  };

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };

    if (showFilters) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilters]);

  // Clear all filters
  const clearFilters = () => {
    setFilterReportType("Yearly Report");
    setFilterMonth(new Date().getMonth());
    setFilterYear(new Date().getFullYear());
    setFilterTimePeriod(new Date().getFullYear().toString());
    setFilterFromDate("");
    setFilterToDate("");
    setFilterClientId("");
  };

  // Check if any filters are active (excluding default yearly filter for current year)
  const hasActiveFilters =
    (filterReportType !== "Yearly Report") ||
    (filterReportType === "Yearly Report" && filterTimePeriod !== currentYear.toString()) ||
    filterClientId !== "";



  useEffect(() => {
    // Handle both 'items' and 'products' fields
    const itemsArray = invoiceData.items || invoiceData.products || [];
    const subtotal = itemsArray.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.rate || item.price || 0),
      0
    );
    const cgstAmount = (subtotal * invoiceData.cgst) / 100;
    const sgstAmount = (subtotal * invoiceData.sgst) / 100;
    const igstAmount = (subtotal * invoiceData.igst) / 100;
    let total = subtotal + cgstAmount + sgstAmount + igstAmount;
    let roundOffAmount = 0;
    if (invoiceData.isRoundOff) {
      const roundedTotal = Math.round(total);
      roundOffAmount = roundedTotal - total;
      total = roundedTotal;
    }
    setCalculations({
      subtotal,
      cgstAmount,
      sgstAmount,
      igstAmount,
      roundOffAmount,
      total,
    });
  }, [
    invoiceData.items,
    invoiceData.products,
    invoiceData.cgst,
    invoiceData.sgst,
    invoiceData.igst,
    invoiceData.isRoundOff,
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case "Paid":
        return "bg-green-500";
      case "Partial":
        return "bg-purple-500";
      case "Draft":
        return "bg-yellow-500";
      case "Overdue":
        return "bg-red-500";
      case "Unpaid":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const addItem = () => {
    const newItem = {
      id: Date.now(),
      description: "",
      hsnCode: "",
      quantity: 1,
      rate: 0,
      amount: 0,
    };
    setInvoiceData((prev) => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const updateItem = (itemId, field, value) => {
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          if (field === "quantity" || field === "rate") {
            updatedItem.amount =
              (Number.parseFloat(updatedItem.quantity) || 0) *
              (Number.parseFloat(updatedItem.rate) || 0);
          }
          return updatedItem;
        }
        return item;
      }),
    }));
  };

  const removeItem = (itemId) => {
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleClientSelect = (clientId) => {
    if (clientId === null) {
      setInvoiceData((prev) => ({ ...prev, clientId: "", client: null }));
      return;
    }
    const selectedClient = customers.find((c) => c.id === clientId);
    setInvoiceData((prev) => ({
      ...prev,
      clientId: clientId,
      client: selectedClient,
    }));
  };

  const handleAddNewProduct = async (productName, clientId) => {
    try {
      // For now, we'll add a basic product structure
      // This would ideally be connected to a proper addProduct function from useProducts hook
      const newProduct = {
        name: productName,
        description: productName,
        hsnCode: "",
        rate: 0,
        unit: "Nos",
        associatedClients: clientId ? [clientId] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // ...existing code...
    } catch (error) {
      throw error;
    }
  };

  const resetInvoiceForm = () => {
    setInvoiceData(getInitialInvoiceData());
  };

  const validateInvoice = () => {
    // CHANGED: Added poNumber to validation
    const {
      invoiceNumber,
      invoiceDate,
      dueDate,
      poNumber,
      poDate,
      dcNumber,
      dcDate,
      clientId,
      items,
    } = invoiceData;
    const missingFields = [];
    if (!invoiceNumber) missingFields.push("Invoice Number");
    if (!invoiceDate) missingFields.push("Invoice Date");
    if (!dueDate) missingFields.push("Due Date");
    if (!clientId) missingFields.push("Client Information");
    if (items.length === 0) missingFields.push("At least one item");
    if (missingFields.length > 0) {
      showError(
        `Please fill in all required fields:\n- ${missingFields.join("\n- ")}`,
        "Validation Error"
      );
      return false;
    }
    return true;
  };

  const saveDraft = async () => {
    const draftInvoice = {
      ...invoiceData,
      status: "Draft",
      amount: calculations.total,
    };

    const result = await addInvoice(draftInvoice);
    if (result.success) {
      success("Invoice saved as draft!", "Draft Saved");
      resetInvoiceForm();
      setEditingInvoice(null);
      setCurrentPage("management");
    } else {
      showError("Error saving draft: " + result.error, "Error");
    }
  };

  const saveInvoice = async () => {
    if (!validateInvoice()) return;

    const newInvoice = {
      ...invoiceData,
      amount: calculations.total,
      status: invoiceData.status,
    };

    const result = await addInvoice(newInvoice);
    if (result.success) {
      success("Invoice saved successfully!", "Invoice Saved");
      resetInvoiceForm();
      setCurrentPage("management");
    } else {
      showError("Error saving invoice: " + result.error, "Error");
    }
  };

  const updateInvoice = async () => {
    if (!validateInvoice()) return;

    const updatedInvoice = {
      ...invoiceData,
      amount: calculations.total,
    };

    const result = await editInvoice(editingInvoice.id, updatedInvoice);
    if (result.success) {
      warning("Invoice updated successfully!", "Invoice Updated");
      setEditingInvoice(null);
      resetInvoiceForm();
      setCurrentPage("management");
    } else {
      showError("Error updating invoice: " + result.error, "Error");
    }
  };

  const [productConfirmation, setProductConfirmation] = useState({
    isOpen: false,
    products: [],
    action: null,
    added: new Set(), // Track added product names
  });

  const checkProductsAndProceed = (action) => {
    // Filter items that satisfy:
    // 1. Have a description
    // 2. Description is not empty
    // 3. Description does not match any existing product name (case-insensitive)
    // 4. Not already added in this session
    const added = productConfirmation.added || new Set();
    const newItems = invoiceData.items.filter(item =>
      item.description &&
      item.description.trim() !== "" &&
      !products.some(p => p.name.toLowerCase() === item.description.trim().toLowerCase()) &&
      !added.has(item.description.trim().toLowerCase())
    );

    // Deduplicate items based on description
    const uniqueItems = newItems.reduce((acc, current) => {
      const x = acc.find(item => item.description.trim().toLowerCase() === current.description.trim().toLowerCase());
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, []);

    if (uniqueItems.length > 0) {
      setProductConfirmation(pc => ({
        ...pc,
        isOpen: true,
        products: uniqueItems,
        action: () => action()
      }));
    } else {
      action();
    }
  };

  const handleProductConfirmationConfirm = async () => {
    try {
      const proms = productConfirmation.products.map(item =>
        addProduct({
          name: item.description.trim(),
          price: Number(item.rate) || 0,
          hsn: item.hsnCode || "",
          category: "General",
          unit: "Nos",
          createdAt: new Date().toISOString()
        })
      );

      await Promise.all(proms);
      success(`Added ${productConfirmation.products.length} new products to database`);

      // Mark these products as added so we don't prompt again
      setProductConfirmation(pc => {
        const added = new Set(pc.added || []);
        productConfirmation.products.forEach(item => {
          added.add(item.description.trim().toLowerCase());
        });
        return { ...pc, isOpen: false, products: [], action: null, added };
      });

      // Proceed with the original action
      if (productConfirmation.action) {
        productConfirmation.action();
      }
    } catch (e) {
      showError("Failed to add products to database");
      console.error(e);
      // Still proceed? User opted to add, if fail, maybe we should stop?
      // For now let's stop to let them retry or skip.
    }
  };

  const handleProductConfirmationSkip = () => {
    // Mark these products as added so we don't prompt again in this session
    setProductConfirmation(pc => {
      const added = new Set(pc.added || []);
      pc.products.forEach(item => {
        added.add(item.description.trim().toLowerCase());
      });
      return { ...pc, isOpen: false, products: [], action: null, added };
    });
    if (productConfirmation.action) {
      productConfirmation.action();
    }
  };

  const navigate = useNavigate();
  const handleCreateInvoice = () => {
    resetInvoiceForm();
    setEditingInvoice(null);
    navigate("/invoices/create");
  };
  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowPreview(true);
  };
  const handleEditInvoice = (invoice) => {
    const invoiceToEdit = JSON.parse(JSON.stringify(invoice));
    setInvoiceData(invoiceToEdit);
    setEditingInvoice(invoiceToEdit);
    setCurrentPage("edit");
  };
  const handleDownloadInvoice = (invoice) => {
    let invToDownload = invoice;
    if (!invoice?.userId && user?.uid) {
      invToDownload = { ...invToDownload, userId: user.uid };
    }
    if (!invToDownload?.paymentToken) {
      const bytes = new Uint8Array(16);
      if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
      const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") || Math.random().toString(36).slice(2);
      invToDownload = { ...invToDownload, paymentToken: token };
      if (invoice?.id) editInvoice(invoice.id, { paymentToken: token, userId: user?.uid });
    }
    setDownloadingInvoice(invToDownload);
  };

  // generateInvoicePDF and generateInvoiceHTML removed

  // Filter invoices based on date range and client
  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];

    return invoices.filter((invoice) => {
      // Filter by Client
      if (filterClientId && invoice.clientId !== filterClientId) {
        return false;
      }

      // Filter by Date Range
      if (filterReportType !== "All Time") {
        let startDate, endDate;

        if (filterReportType === "Monthly Report") {
          startDate = new Date(filterYear, filterMonth, 1);
          endDate = new Date(filterYear, filterMonth + 1, 0);
        } else if (filterReportType === "Yearly Report") {
          const year = parseInt(filterTimePeriod);
          startDate = new Date(year, 3, 1); // April 1st
          endDate = new Date(year + 1, 2, 31); // March 31st
        } else if (filterReportType === "Custom Report") {
          if (filterFromDate && filterToDate) {
            startDate = new Date(filterFromDate);
            endDate = new Date(filterToDate);
          }
        }

        if (startDate && endDate) {
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);

          // Use invoice date for filtering
          const invoiceDateVal = invoice.invoiceDate;
          if (!invoiceDateVal) return true;

          let invoiceDate;
          if (invoiceDateVal && typeof invoiceDateVal.toDate === "function") {
            invoiceDate = invoiceDateVal.toDate();
          } else if (typeof invoiceDateVal === "string") {
            const trimmed = invoiceDateVal.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
              const [y, m, d] = trimmed.split('-');
              invoiceDate = new Date(Number(y), Number(m) - 1, Number(d));
            } else if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
              const [d, m, y] = trimmed.split('-');
              invoiceDate = new Date(Number(y), Number(m) - 1, Number(d));
            } else {
              invoiceDate = new Date(trimmed);
            }
          } else if (invoiceDateVal instanceof Date) {
            invoiceDate = invoiceDateVal;
          } else {
            invoiceDate = new Date(invoiceDateVal);
          }

          if (isNaN(invoiceDate.getTime())) return true;

          // Check if date is within range
          if (invoiceDate < startDate || invoiceDate > endDate) return false;
        }
      }

      return true;
    });
  }, [invoices, filterReportType, filterMonth, filterYear, filterTimePeriod, filterFromDate, filterToDate, filterClientId]);


  return (
    <div>
      {/* debug overlay removed */}

      {currentPage === "management" && (
        <InvoiceManagementComponent
          activeTab={activeTab}
          searchTerm={searchTerm}
          filteredInvoices={filteredInvoices}
          setActiveTab={setActiveTab}
          setSearchTerm={setSearchTerm}
          handleCreateInvoice={handleCreateInvoice}
          getStatusColor={getStatusColor}
          handleViewInvoice={handleViewInvoice}
          handleEditInvoice={handleEditInvoice}
          handleDownloadInvoice={handleDownloadInvoice}
          getDynamicStatus={getDynamicStatus}
          pagination={pagination}
          onPageChange={setPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          loading={invoicesLoading}
          // Filter props
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          filterReportType={filterReportType}
          setFilterReportType={setFilterReportType}
          filterMonth={filterMonth}
          setFilterMonth={setFilterMonth}
          filterYear={filterYear}
          setFilterYear={setFilterYear}
          filterTimePeriod={filterTimePeriod}
          setFilterTimePeriod={setFilterTimePeriod}
          filterFromDate={filterFromDate}
          setFilterFromDate={setFilterFromDate}
          filterToDate={filterToDate}
          setFilterToDate={setFilterToDate}
          filterClientId={filterClientId}
          setFilterClientId={setFilterClientId}
          filterRef={filterRef}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          customers={customers}
          currentYear={currentYear}
        />
      )}
      {(currentPage === "create" || currentPage === "edit") && (
        <CreateInvoiceComponent
          editingInvoice={editingInvoice}
          invoiceData={invoiceData}
          clients={customers || []}
          products={products || []}
          calculations={calculations}
          setCurrentPage={setCurrentPage}
          saveDraft={saveDraft}
          handlePreview={() => checkProductsAndProceed(() => {
            setSelectedInvoice(null); // Clear any previously selected invoice
            setShowPreview(true);
          })}
          setShowPreview={setShowPreview}
          updateInvoice={() => checkProductsAndProceed(updateInvoice)}
          saveInvoice={() => checkProductsAndProceed(saveInvoice)}
          setInvoiceData={setInvoiceData}
          handleClientSelect={handleClientSelect}
          handleAddNewProduct={handleAddNewProduct}
          addItem={addItem}
          updateItem={updateItem}
          removeItem={removeItem}
        />
      )}
      {showPreview && (
        <InvoicePreview
          invoice={selectedInvoice}
          invoiceData={currentPage !== "management" ? invoiceData : null}
          calculations={calculations}
          setShowPreview={setShowPreview}
          onUpdateInvoice={editInvoice}
          productConfirmation={productConfirmation}
          handleProductConfirmationSkip={handleProductConfirmationSkip}
          handleProductConfirmationConfirm={handleProductConfirmationConfirm}
        />
      )}

      {/* Hidden Invoice Preview for Downloading */}
      {downloadingInvoice && (
        <div style={{ position: 'fixed', left: '-1000vw', top: 0 }}>
          <InvoicePreview
            invoice={downloadingInvoice}
            setShowPreview={() => setDownloadingInvoice(null)}
            embedded={true}
            autoDownload={true}
            onDownloadComplete={() => setDownloadingInvoice(null)}
          />
        </div>
      )}
      {/* Product Confirmation Modal attached to System level */}
      <ConfirmationModal
        isOpen={productConfirmation.isOpen}
        onClose={handleProductConfirmationSkip}
        onConfirm={handleProductConfirmationConfirm}
        title="Add New Products?"
        message={`The following items are not in your database: \n\n${productConfirmation.products.map(p => "• " + p.description).join("\n")} \n\nDo you want to add them to your product list ? `}
        confirmLabel="Yes, Add items"
        cancelLabel="No, Skip"
        confirmClass="bg-green-600 hover:bg-green-700"
      />

    </div>
  );
};

// Add PropTypes
ConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
};

ClientAutocomplete.propTypes = {
  clients: PropTypes.array.isRequired,
  selectedClient: PropTypes.shape({ // Or PropTypes.object if structure variable
    id: PropTypes.string, // Assuming id exists
    name: PropTypes.string,
  }),
  onSelect: PropTypes.func.isRequired,
};

ProductAutocomplete.propTypes = {
  products: PropTypes.array.isRequired,
  value: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onAddNewProduct: PropTypes.func,
  clientId: PropTypes.string,
};

InvoicePreview.propTypes = {
  invoice: PropTypes.object, // Consider specific shape
  invoiceData: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.shape({ // Nested validation
      description: PropTypes.string,
      hsnCode: PropTypes.string,
      quantity: PropTypes.number,
      rate: PropTypes.number,
      amount: PropTypes.number
    })),
    invoiceNotes: PropTypes.string,
    isRoundOff: PropTypes.bool,
    // Add other properties...
  }),
  calculations: PropTypes.object,
  setShowPreview: PropTypes.func.isRequired,
  settings: PropTypes.object,
};

CreateInvoiceComponent.propTypes = {
  editingInvoice: PropTypes.object,
  invoiceData: PropTypes.object.isRequired,
  clients: PropTypes.array.isRequired,
  products: PropTypes.array.isRequired,
  calculations: PropTypes.object.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  saveDraft: PropTypes.func.isRequired,
  setShowPreview: PropTypes.func.isRequired,
  updateInvoice: PropTypes.func.isRequired,
  saveInvoice: PropTypes.func.isRequired,
  setInvoiceData: PropTypes.func.isRequired,
  handleClientSelect: PropTypes.func.isRequired,
  handleAddNewProduct: PropTypes.func.isRequired,
  addItem: PropTypes.func.isRequired,
  updateItem: PropTypes.func.isRequired,
  removeItem: PropTypes.func.isRequired,
};

export { InvoicePreview, ClientAutocomplete, ProductAutocomplete, ConfirmationModal };
export default InvoiceManagementSystem;
