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
  ChevronDown,
} from "lucide-react";
import { useInvoices, useSettings, useCustomers, useProducts, usePriceLists } from "../../hooks/useFirestore";
import { priceListFor } from "../../utils/priceLists";
import { AuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { loadRazorpayScript } from "../../utils/loadRazorpay";
import PropTypes from "prop-types";
import { authJsonHeaders } from "../../lib/authHeaders";
import CreateInvoiceComponent from "./CreateInvoiceComponent";
import { calculateInvoiceTotals } from "../../utils/invoiceTotals";
import { invoiceTaxSettings } from "../../utils/invoiceFromDraft";
import { ITEMWISE_DEFAULTS, newInvoiceItem, applyItemChange, applyProduct, withClient, prepareForEdit, invoiceForSave } from "../../utils/invoiceForm";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { buildEinvoicePayload, buildEwayBillJson } from "../../utils/einvoice.js";
import { invoiceTotals, isItemwise, upgradeToItemwise, sellerFor, sellerAddressLines, partyStateCode, stateName, supplyNotes, supplyTypeLabel, isExport, inrFactor } from "../../utils/gst.js";
import { backendUrl } from "../../lib/backend";

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
    setSearchTerm(value || "");
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
  const { companyProfile } = useCompanyProfile();

  // Same GST engine as the form, so the printed bill always adds up.
  const previewCalcs = invoiceTotals(previewData || {});
  const itemwise = isItemwise(previewData);
  const gstOn = previewData?.isGstEnabled !== false;
  const interState = itemwise
    ? Boolean(previewData?.isInterState)
    : Number(previewData?.igst) > 0 && !(Number(previewData?.cgst) + Number(previewData?.sgst));
  const seller = sellerFor(previewData, companyProfile);
  const isTaxInvoice = gstOn && Boolean(seller.gstin);
  const lines = previewCalcs.lines || [];
  const hasDiscount = lines.some((l) => Number(l.discount) > 0);
  const showGstColumn = gstOn && itemwise;
  const hsnRows = gstOn ? (itemwise ? previewCalcs.hsnSummary : invoiceTotals(upgradeToItemwise(previewData)).hsnSummary) : [];

  const client = previewData?.client || {};
  const looksLikeGstin = (v) => /^\d{2}[A-Z0-9]{13}$/i.test(String(v || "").trim());
  const buyerGstin = client.gstin || client.taxId || client.gst || (looksLikeGstin(client.company) ? client.company : "");
  const buyerStateCode = partyStateCode({ ...client, gstin: buyerGstin });
  const posCode = previewData?.placeOfSupply?.code || buyerStateCode || seller.stateCode;
  const posLabel = posCode ? `${stateName(posCode)} (${posCode})` : "";

  const fmt = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalRows = [{ label: "Taxable Value", value: fmt(previewCalcs.taxableAmount ?? previewCalcs.subtotal) }];
  if (gstOn) {
    for (const b of previewCalcs.taxBreakup || []) {
      if (interState) totalRows.push({ label: `IGST @ ${b.gstRate}%`, value: fmt(b.igst) });
      else {
        totalRows.push({ label: `CGST @ ${b.gstRate / 2}%`, value: fmt(b.cgst) });
        totalRows.push({ label: `SGST @ ${b.gstRate / 2}%`, value: fmt(b.sgst) });
      }
    }
  }
  if (Number(previewCalcs.cessAmount) > 0) totalRows.push({ label: "Cess", value: fmt(previewCalcs.cessAmount) });
  if (Number(previewCalcs.tcsAmount) > 0) totalRows.push({ label: `TCS @ ${previewCalcs.tcsRate}%`, value: fmt(previewCalcs.tcsAmount) });
  if (previewData?.isRoundOff || Number(previewCalcs.roundOffAmount)) totalRows.push({ label: "Round Off", value: fmt(previewCalcs.roundOffAmount) });

  const bank = seller.bank || {};
  const bankLines = [
    ["Bank Name", bank.bankName],
    ["A/c Name", bank.accountName],
    ["A/c No", bank.accountNumber],
    ["IFSC Code", bank.ifsc],
    ["Branch", bank.branch],
    ["UPI ID", bank.upiId],
  ].filter(([, v]) => v);

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

  const currentUserId = user?.businessUid || user?.uid || previewData?.userId || previewData?.uid || "";
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
      const res = await fetch(backendUrl("/create-razorpay-order"), {
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
          name: "Kanakku Desk",
          description: `Payment for Invoice #${previewData?.invoiceNumber || ""}`,
          order_id: orderData.orderId,
          handler: async function (response) {
            try {
              const verifyRes = await fetch(backendUrl("/verify-razorpay-payment"), {
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
      const response = await fetch(backendUrl("/generate-pdf"), {
        method: "POST",
        headers: await authJsonHeaders(),
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

  // ── E-invoice / e-way bill ──────────────────────────────────────────────
  const [einv, setEinv] = useState({ busy: false, irn: previewData?.irn || "", ackNo: previewData?.ackNo || "", ackDate: previewData?.ackDate || "", problems: [] });
  const downloadJson = (name, data) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const safeNo = String(previewData?.invoiceNumber || "invoice").replace(/[^\w-]+/g, "_");

  const handleEwayBill = () => {
    const { json, problems } = buildEwayBillJson(previewData, companyProfile);
    const blocking = problems.filter((p) => !p.startsWith("Note:"));
    if (blocking.length) {
      setEinv((e) => ({ ...e, problems }));
      return;
    }
    downloadJson(`EWB_${safeNo}.json`, json);
    setEinv((e) => ({ ...e, problems }));
    toastSuccess("E-way bill JSON downloaded — upload it on ewaybillgst.gov.in (Generate → Bulk).");
  };

  const handleEinvoiceJson = () => {
    const { payload, problems } = buildEinvoicePayload(previewData, companyProfile);
    setEinv((e) => ({ ...e, problems }));
    if (problems.length) return;
    downloadJson(`EINV_${safeNo}.json`, payload);
    toastSuccess("E-invoice JSON downloaded.");
  };

  const handleGenerateIrn = async () => {
    const { payload, problems } = buildEinvoicePayload(previewData, companyProfile);
    setEinv((e) => ({ ...e, problems }));
    if (problems.length) return;
    if (!previewData?.id) {
      toastError("Save the invoice before generating an IRN.");
      return;
    }
    setEinv((e) => ({ ...e, busy: true }));
    try {
      const res = await fetch(backendUrl("/api/einvoice/irn"), {
        method: "POST",
        headers: await authJsonHeaders(),
        body: JSON.stringify({ invoiceId: previewData.id, payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const extra = data.missing?.length ? ` Missing: ${data.missing.join(", ")}.` : "";
        throw new Error((data.error || "IRN generation failed.") + extra);
      }
      setEinv({ busy: false, irn: data.irn, ackNo: data.ackNo, ackDate: data.ackDate, problems: [] });
      if (onUpdateInvoice) onUpdateInvoice(previewData.id, { irn: data.irn, ackNo: data.ackNo, ackDate: data.ackDate, signedQrCode: data.signedQrCode, einvoiceStatus: "Generated" });
      toastSuccess(`IRN generated (Ack ${data.ackNo}).`);
    } catch (err) {
      setEinv((e) => ({ ...e, busy: false }));
      toastError(err.message === "Failed to fetch" ? "Could not reach the server." : err.message);
    }
  };

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
              {previewData?.isGstEnabled !== false && (
                <>
                  <button onClick={handleEwayBill} className="flex items-center px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" title="Download e-way bill JSON for bulk upload">
                    e-Way Bill
                  </button>
                  <button onClick={handleEinvoiceJson} className="flex items-center px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" title="Download IRP e-invoice JSON">
                    e-Invoice JSON
                  </button>
                  {!einv.irn && (
                    <button onClick={handleGenerateIrn} disabled={einv.busy} className="flex items-center px-3 py-1.5 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60" title="Generate IRN through your GSP">
                      {einv.busy ? "Generating…" : "Generate IRN"}
                    </button>
                  )}
                </>
              )}
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
        {!embedded && einv.problems.length > 0 && (
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
            <div className="flex items-start justify-between gap-3">
              <ul className="list-disc pl-5 space-y-0.5">
                {einv.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <button onClick={() => setEinv((e) => ({ ...e, problems: [] }))} className="text-amber-700 hover:text-amber-900" aria-label="Dismiss">
                <X className="w-4 h-4" />
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
              {/* Seller header — from the invoice's saved seller details or the business profile */}
              <div className="flex items-center gap-4 border-b border-black px-4 py-3">
                {seller.logoURL && <img src={seller.logoURL} alt={`${seller.companyName} logo`} className="h-16 w-16 object-contain" />}
                <div className="flex-1 text-center">
                  <h1 className="text-3xl font-bold" style={{ fontFamily: '"Times New Roman", serif', color: "#d00000", margin: 0 }}>
                    {seller.companyName || "Your Business Name"}
                  </h1>
                  <div className="text-sm text-black leading-snug mt-1">
                    {sellerAddressLines(seller).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    <p>
                      {[seller.phone && `Phone : ${seller.phone}`, seller.email && `E-Mail : ${seller.email}`].filter(Boolean).join(" | ")}
                    </p>
                    <p className="font-semibold">
                      {seller.gstin ? `GSTIN : ${seller.gstin}` : "Unregistered"}
                      {seller.stateCode ? ` | State : ${stateName(seller.stateCode)} (${seller.stateCode})` : ""}
                    </p>
                  </div>
                </div>
                {seller.logoURL && <div className="w-16" />}
              </div>

              {/* Invoice Title */}
              <div className="flex border-b border-black">
                <div className="w-[30%] border-r border-black pl-2 flex items-center text-sm">
                  <span className="font-bold mr-2">Invoice No :</span> {previewData.invoiceNumber}
                </div>
                <div className="w-[40%] text-center font-bold text-2xl">{isTaxInvoice ? "TAX INVOICE" : "INVOICE"}</div>
                <div className="w-[30%] border-l border-black pl-2 flex items-center text-sm">
                  <span className="font-bold mr-2">Date :</span> {previewData.invoiceDate}
                </div>
              </div>

              {einv.irn && (
                <div className="border-b border-black px-2 py-1 text-[11px] leading-snug break-all">
                  <span className="font-bold">IRN :</span> {einv.irn} &nbsp;|&nbsp; <span className="font-bold">Ack No :</span> {einv.ackNo} &nbsp;|&nbsp;{" "}
                  <span className="font-bold">Ack Date :</span> {einv.ackDate}
                </div>
              )}

              {/* Buyer & reference details */}
              <div className="flex border-b border-black">
                <div className="w-[60%] border-r border-black text-sm flex flex-col">
                  <div className="pl-2 pt-1 pb-1 flex-grow">
                    <div className="text-xs font-bold uppercase">Bill To</div>
                    <div className="font-bold">{previewData.client?.name}</div>
                    <div className="whitespace-pre-line">{previewData.client?.address}</div>
                  </div>
                  <div className="border-t border-black pl-2 py-1 flex flex-wrap gap-x-6">
                    <span>
                      <span className="font-bold">GSTIN :</span> {buyerGstin || "Unregistered"}
                    </span>
                    {buyerStateCode && (
                      <span>
                        <span className="font-bold">State :</span> {stateName(buyerStateCode)} ({buyerStateCode})
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-[40%] text-sm">
                  {[
                    ["Place of Supply", isExport(previewData) ? "96 – Outside India" : posLabel],
                    ...(previewData.supplyType && previewData.supplyType !== "REGULAR" ? [["Supply Type", supplyTypeLabel(previewData)]] : []),
                    ["Reverse Charge", previewData.reverseCharge ? "Yes" : "No"],
                    ...(isExport(previewData)
                      ? [
                          ["Shipping Bill", [previewData.shippingBillNo, previewData.shippingBillDate].filter(Boolean).join(" / ")],
                          ["Port / Country", [previewData.portCode, previewData.countryCode].filter(Boolean).join(" / ")],
                        ]
                      : []),
                    ["Due Date", previewData.dueDate],
                    ["P.O. No / Date", [previewData.poNumber, previewData.poDate].filter(Boolean).join(" / ")],
                    ["D.C. No / Date", [previewData.dcNumber, previewData.dcDate].filter(Boolean).join(" / ")],
                  ].map(([label, value], i, arr) => (
                    <div key={label} className={`pl-2 py-1 flex ${i < arr.length - 1 ? "border-b border-black" : ""}`}>
                      <span className="font-bold mr-2 whitespace-nowrap">{label} :</span>
                      <span>{value || ""}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Items */}
              <div className="flex-grow">
                <table className="w-full text-sm border-b border-black h-full">
                  <thead>
                    <tr className="border-b border-black text-xs">
                      <th className="w-[4%] border-r border-black p-1 text-center">S.No</th>
                      <th className="border-r border-black p-1 text-center">PARTICULARS</th>
                      <th className="w-[9%] border-r border-black p-1 text-center">HSN/SAC</th>
                      <th className="w-[8%] border-r border-black p-1 text-center">QTY</th>
                      <th className="w-[10%] border-r border-black p-1 text-center">RATE</th>
                      {hasDiscount && <th className="w-[6%] border-r border-black p-1 text-center">DISC %</th>}
                      {showGstColumn && <th className="w-[6%] border-r border-black p-1 text-center">GST %</th>}
                      <th className="w-[13%] p-1 text-center">TAXABLE VALUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((item, index) => (
                      <tr key={item.id ?? index}>
                        <td className="border-r border-black p-1 text-center">{index + 1}</td>
                        <td className="border-r border-black p-1">{item.description || item.name}</td>
                        <td className="border-r border-black p-1 text-center">{item.hsnCode || item.hsn}</td>
                        <td className="border-r border-black p-1 text-center">
                          {item.quantity} {item.unit || ""}
                        </td>
                        <td className="border-r border-black p-1 text-right">{fmt(item.rate ?? item.price)}</td>
                        {hasDiscount && <td className="border-r border-black p-1 text-center">{Number(item.discount || 0) ? `${item.discount}%` : ""}</td>}
                        {showGstColumn && <td className="border-r border-black p-1 text-center">{item.gstRate}%</td>}
                        <td className="p-1 text-right">{fmt(item.taxable ?? item.amount ?? item.total)}</td>
                      </tr>
                    ))}
                    {new Array(Math.max(0, 10 - lines.length)).fill(0).map((_, index) => (
                      <tr key={`empty-${index}`}>
                        <td className="border-r border-black p-1 h-6">&nbsp;</td>
                        <td className="border-r border-black p-1"></td>
                        <td className="border-r border-black p-1"></td>
                        <td className="border-r border-black p-1"></td>
                        <td className="border-r border-black p-1"></td>
                        {hasDiscount && <td className="border-r border-black p-1"></td>}
                        {showGstColumn && <td className="border-r border-black p-1"></td>}
                        <td className="p-1"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* HSN/SAC-wise tax summary (required on GST tax invoices) */}
              {isTaxInvoice && hsnRows.length > 0 && (
                <table className="w-full text-xs border-b border-black">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="border-r border-black p-1 text-left">HSN/SAC</th>
                      <th className="border-r border-black p-1 text-right">Taxable Value</th>
                      {interState ? (
                        <th className="border-r border-black p-1 text-right">IGST (Rate / Amt)</th>
                      ) : (
                        <>
                          <th className="border-r border-black p-1 text-right">CGST (Rate / Amt)</th>
                          <th className="border-r border-black p-1 text-right">SGST (Rate / Amt)</th>
                        </>
                      )}
                      <th className="p-1 text-right">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hsnRows.map((h) => (
                      <tr key={`${h.hsn}-${h.gstRate}`}>
                        <td className="border-r border-black p-1">{h.hsn || "—"}</td>
                        <td className="border-r border-black p-1 text-right">{fmt(h.taxable)}</td>
                        {interState ? (
                          <td className="border-r border-black p-1 text-right">
                            {h.gstRate}% / {fmt(h.igst)}
                          </td>
                        ) : (
                          <>
                            <td className="border-r border-black p-1 text-right">
                              {h.gstRate / 2}% / {fmt(h.cgst)}
                            </td>
                            <td className="border-r border-black p-1 text-right">
                              {h.gstRate / 2}% / {fmt(h.sgst)}
                            </td>
                          </>
                        )}
                        <td className="p-1 text-right">{fmt(h.cgst + h.sgst + h.igst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Footer: notes, bank details, totals */}
              <table className="w-full text-sm mt-auto">
                <tbody>
                  {previewData.invoiceNotes && (
                    <tr>
                      <td className="p-1 pl-2 align-top border-b border-black" colSpan="4">
                        <span className="font-bold">Note : </span>
                        {previewData.invoiceNotes}
                      </td>
                    </tr>
                  )}

                  {totalRows.map((row, i) => (
                    <tr key={row.label}>
                      {i === 0 && (
                        <td className="w-[60%] p-1 pl-2 align-top" colSpan="2" rowSpan={totalRows.length}>
                          <div className="font-bold mb-1">Bank Details</div>
                          {bankLines.length ? (
                            bankLines.map(([label, value]) => (
                              <div key={label}>
                                <span className="inline-block w-28">{label}</span>: {value}
                              </div>
                            ))
                          ) : (
                            <div className="text-gray-500">Add bank details in Settings → Business</div>
                          )}
                        </td>
                      )}
                      <th scope="row" className="w-[22%] border-l border-b border-black p-1 font-normal text-left">
                        {row.label}
                      </th>
                      <td className="w-[18%] border-l border-b border-black p-1 text-right">{row.value}</td>
                    </tr>
                  ))}

                  <tr>
                    <td className="border-t border-black p-2 align-middle" colSpan={2} rowSpan={paidAmount > 0 ? 3 : 1}>
                      <div className="flex flex-row items-center justify-between gap-4 w-full h-full min-h-[44px]">
                        <div>
                          <span className="font-bold">{(previewData.currency || "INR") === "INR" ? "Rupees" : previewData.currency} :</span> <span className="font-normal">{amountInWords} Only</span>
                          {(previewData.currency || "INR") !== "INR" && (
                            <div className="text-xs mt-1">
                              ({previewData.currency} 1 = ₹{previewData.exchangeRate}; invoice value ₹{fmt(Number(previewCalcs?.total || 0) * inrFactor(previewData))})
                            </div>
                          )}
                        </div>
                        <div>
                          {isPaid ? (
                            <span
                              className="inline-block px-3 py-1.5 font-bold text-xs rounded"
                              style={{ backgroundColor: "#10b981", color: "#ffffff", padding: "6px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", border: "1px solid #059669" }}
                            >
                              ✓ PAID IN FULL
                            </span>
                          ) : (
                            <a
                              href={razorpayUrl}
                              onClick={handleOpenRazorpayCheckout}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block font-bold text-xs rounded no-underline cursor-pointer"
                              style={{ backgroundColor: "#2563eb", color: "#ffffff", textDecoration: "none", display: "inline-block", padding: "6px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", border: "1px solid #1d4ed8" }}
                            >
                              {paidAmount > 0 ? `Pay Balance (₹${balanceDue.toFixed(2)})` : "Pay"}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-l border-t border-black p-1 text-left font-bold">NET TOTAL</td>
                    <td className="border-b border-l border-t border-black p-1 text-right font-bold">{fmt(previewCalcs?.total)}</td>
                  </tr>

                  {paidAmount > 0 && (
                    <>
                      <tr>
                        <td className="border-b border-l border-black p-1 text-left text-emerald-700 font-bold text-xs">PAID / RECEIVED</td>
                        <td className="border-b border-l border-black p-1 text-right text-emerald-700 font-bold text-xs">-{fmt(paidAmount)}</td>
                      </tr>
                      <tr>
                        <td className="border-b border-l border-black p-1 text-left text-red-700 font-bold text-sm">BALANCE DUE</td>
                        <td className="border-b border-l border-black p-1 text-right text-red-700 font-bold text-sm">{fmt(balanceDue)}</td>
                      </tr>
                    </>
                  )}

                  <tr>
                    <td className="border-t border-black align-top p-1 pl-2" colSpan="2">
                      <div className="font-bold mb-1">Declaration</div>
                      {supplyNotes(previewData).map((note) => (
                        <div key={note} className="text-sm font-semibold">
                          {note}
                        </div>
                      ))}
                      <div className="text-sm">
                        {previewData.declaration ||
                          "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."}
                      </div>
                    </td>
                    <td className="border-l border-t border-black h-24 align-bottom text-left p-1" colSpan="2">
                      <div className="font-bold text-red-600 mb-8">For {seller.companyName || "Your Business"}</div>
                      <div className="text-right">Authorised Signatory</div>
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
  const { companyProfile } = useCompanyProfile();
  const { settings: invoiceSettings } = useSettings();
  const { defaultGstRate } = invoiceTaxSettings(invoiceSettings);

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
    pagination,
    addInvoice,
    editInvoice,
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

  const { customers } = useCustomers();

  const { products, addProduct } = useProducts();
  const { priceLists } = usePriceLists();

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
    ...ITEMWISE_DEFAULTS,
    isGstEnabled: true,
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
    const total = Number(invoice.total || invoice.amount || 0) - Number(invoice.creditedAmount || 0) - Number(invoice.advanceAdjusted || 0);
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
    setCalculations(calculateInvoiceTotals(invoiceData));
  }, [invoiceData]);

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
    setInvoiceData((prev) => ({ ...prev, items: [...(prev.items || []), newInvoiceItem(defaultGstRate)] }));
  };

  const updateItem = (itemId, field, value) => {
    setInvoiceData((prev) => ({
      ...prev,
      items: (prev.items || []).map((item) => (item.id === itemId ? applyItemChange(item, field, value) : item)),
    }));
  };

  const applyProductToItem = (itemId, product) => {
    setInvoiceData((prev) => ({
      ...prev,
      items: (prev.items || []).map((item) => (item.id === itemId ? applyProduct(item, product, defaultGstRate, priceListFor(prev.client, priceLists)) : item)),
    }));
  };

  const removeItem = (itemId) => {
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleClientSelect = (clientId) => {
    const selectedClient = clientId === null ? null : customers.find((c) => c.id === clientId);
    setInvoiceData((prev) => withClient(prev, selectedClient, companyProfile));
  };

  const handleAddNewProduct = async (productName, clientId) => {
    if (!productName?.trim()) return;
    const result = await addProduct({ name: productName, hsn: "", price: 0, gstRate: defaultGstRate, clientId: clientId || "" });
    if (result?.success) success(`Product "${productName}" added successfully!`);
    else showError("Failed to add new product.");
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
    const draftInvoice = invoiceForSave(invoiceData, companyProfile, { status: "Draft" });

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

    const newInvoice = invoiceForSave(invoiceData, companyProfile, { status: invoiceData.status });

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

    const updatedInvoice = invoiceForSave(invoiceData, companyProfile);

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
          gstRate: item.gstRate ?? defaultGstRate,
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
    const invoiceToEdit = prepareForEdit(invoice, companyProfile);
    setInvoiceData(invoiceToEdit);
    setEditingInvoice(invoiceToEdit);
    setCurrentPage("edit");
  };
  const handleDownloadInvoice = (invoice) => {
    let invToDownload = invoice;
    if (!invoice?.userId && user?.businessUid) {
      invToDownload = { ...invToDownload, userId: user.businessUid };
    }
    if (!invToDownload?.paymentToken) {
      const bytes = new Uint8Array(16);
      if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
      const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") || Math.random().toString(36).slice(2);
      invToDownload = { ...invToDownload, paymentToken: token };
      if (invoice?.id) editInvoice(invoice.id, { paymentToken: token, userId: user?.businessUid });
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
          applyProductToItem={applyProductToItem}
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


export { InvoicePreview, ClientAutocomplete, ProductAutocomplete, ConfirmationModal };
export default InvoiceManagementSystem;
