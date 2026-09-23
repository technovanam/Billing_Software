import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "../../components/Pagination";
import {
  Search,
  Plus,
  Eye,
  Download,
  X,
  Printer,
  Trash2,
  FileText,
  Filter,
  Calendar,
  ChevronDown,
  Edit,
} from "lucide-react";
import { useChallans, useCustomers } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";
import { generateChallanHTML } from "../../utils/challanGenerator";
import PropTypes from "prop-types";

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirmClass = "bg-red-600 hover:bg-red-700",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{message}</p>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ChallanPreview = ({
  challan,
  challanData,
  calculations,
  setShowPreview,
  embedded = false,
  autoDownload = false,
  onDownloadComplete,
}) => {
  const { error: toastError } = useToast();

  useEffect(() => {
    if (embedded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [embedded]);

  const previewData = challanData || challan;
  const previewCalcs = challanData
    ? calculations
    : (() => {
        const itemsArray = challan.items || challan.products || [];
        const subtotal = itemsArray.reduce((sum, item) => sum + (item.amount || item.total || 0), 0);
        return {
          subtotal: subtotal,
          cgstAmount: (subtotal * (challan.cgst || 0)) / 100,
          sgstAmount: (subtotal * (challan.sgst || 0)) / 100,
          igstAmount: (subtotal * (challan.igst || 0)) / 100,
          roundOffAmount: challan.isRoundOff
            ? Math.round(challan.amount) - challan.amount
            : 0,
          total: challan.isRoundOff ? Math.round(challan.amount) : challan.amount,
        };
      })();

  const convertToWords = (amount) => {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];

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

  const amountInWords = convertToWords(Math.floor(previewCalcs.total));

  const handleSaveAsPDF = async () => {
    try {
      const element = document.getElementById("challan-print-root");
      if (!element) {
        toastError("Preview content not found");
        if (onDownloadComplete) onDownloadComplete();
        return;
      }

      const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
        .map((style) => style.outerHTML)
        .join("\n");

      const response = await fetch("http://localhost:5000/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: element.outerHTML,
          css: styles,
          baseUrl: window.location.origin + "/",
        }),
      });

      if (!response.ok) {
        throw new Error("Server failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const num = previewData.challanNumber || previewData.dcNumber || "Challan";
      a.download = `DeliveryChallan_${num.replaceAll("/", "_")}.pdf`;
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
      const timer = setTimeout(() => {
        handleSaveAsPDF();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoDownload]);

  const handlePrint = () => {
    const printContent = document.querySelector(".challan-print-wrapper");
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
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      doc.head.appendChild(node.cloneNode(true));
    });

    const style = document.createElement("style");
    style.textContent = `
      @media print {
        @page { size: A4; margin: 0; }
        body { margin: 0; background: white; -webkit-print-color-adjust: exact; }
        .challan-print-wrapper {
            margin: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 15mm !important;
            box-sizing: border-box !important;
            background-color: white !important;
            display: flex !important;
            flex-direction: column !important;
        }
        .challan-preview-content {
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

    const images = doc.querySelectorAll("img");
    const promises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
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
            <h2 className="text-lg font-bold text-gray-900">Delivery Challan Preview</h2>
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
          className={embedded ? "bg-white flex justify-center p-0" : "min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gray-100 p-8 flex justify-center"}
        >
          {/* Outer Page Wrapper (A4) - Handles 15mm white space */}
          <div
            className="challan-print-wrapper bg-white shadow-lg mx-auto flex flex-col"
            style={{
              width: "210mm",
              minHeight: "297mm",
              padding: "15mm",
              boxSizing: "border-box"
            }}
          >
            {/* Inner Content (Challan) */}
            <div
              id="challan-print-root"
              className="challan-preview-content border-2 border-black flex flex-col flex-grow"
              style={{ width: "100%", height: "100%" }}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: generateChallanHTML(previewData),
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function DeliveryChallanManagement() {
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("All Challans");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { challans = [], loading, error, removeChallan } = useChallans();
  const { customers = [] } = useCustomers();

  const [selectedChallan, setSelectedChallan] = useState(null);
  const [downloadingChallan, setDownloadingChallan] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, dcNumber: "" });

  // Filter Dropdown state
  const [showFilters, setShowFilters] = useState(false);
  const [filterClientId, setFilterClientId] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const filterRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };
    if (showFilters) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFilters]);

  const clearFilters = () => {
    setFilterClientId("");
    setFilterFromDate("");
    setFilterToDate("");
  };

  const hasActiveFilters = filterClientId !== "" || filterFromDate !== "" || filterToDate !== "";
  const tabs = ["All Challans", "Delivered", "Sent", "Drafts"];

  const filteredChallans = useMemo(() => {
    return challans.filter((c) => {
      const num = (c.challanNumber || c.dcNumber || c.id || "").toLowerCase();
      const clientName = (c.client?.name || c.customerName || "").toLowerCase();
      const matchesSearch = !searchTerm || num.includes(searchTerm.toLowerCase()) || clientName.includes(searchTerm.toLowerCase());

      const status = (c.status || "Sent").toLowerCase();
      let matchesTab = true;
      if (activeTab === "Drafts") matchesTab = status === "draft";
      else if (activeTab === "Sent") matchesTab = status === "sent";
      else if (activeTab === "Delivered") matchesTab = status === "delivered";

      if (!matchesSearch || !matchesTab) return false;

      if (filterClientId && c.customerId !== filterClientId && c.client?.id !== filterClientId) {
        return false;
      }

      if (filterFromDate && filterToDate) {
        const cDate = c.challanDate || c.date;
        if (cDate && (cDate < filterFromDate || cDate > filterToDate)) {
          return false;
        }
      }

      return true;
    });
  }, [challans, searchTerm, activeTab, filterClientId, filterFromDate, filterToDate]);

  const totalPages = Math.max(1, Math.ceil(filteredChallans.length / itemsPerPage));
  const paginatedChallans = filteredChallans.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDelete = (id, dcNumber) => {
    setDeleteModal({ isOpen: true, id, dcNumber });
  };

  const confirmDelete = async () => {
    try {
      const res = await removeChallan(deleteModal.id);
      if (res.success) {
        toastSuccess(`Delivery Challan ${deleteModal.dcNumber} deleted successfully.`);
      } else {
        toastError("Failed to delete delivery challan.");
      }
    } catch (err) {
      toastError("Error deleting delivery challan.");
    } finally {
      setDeleteModal({ isOpen: false, id: null, dcNumber: "" });
    }
  };

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Delivery Challan Management
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage all your delivery challans in one place
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
                    onClick={() => {
                      setActiveTab(tab);
                      setCurrentPage(1);
                    }}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      activeTab === tab
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
                  placeholder="Search challans..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Filter Button & Dropdown */}
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all border shadow-xs ${
                    hasActiveFilters || showFilters
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
                      {/* Customer Filter */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Customer</label>
                        <div className="relative">
                          <select
                            value={filterClientId}
                            onChange={(e) => setFilterClientId(e.target.value)}
                            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                          >
                            <option value="">All Customers</option>
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>

                      {/* Date Range Filters */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">From Date</label>
                          <input
                            type="date"
                            max="9999-12-31"
                            value={filterFromDate}
                            onChange={(e) => setFilterFromDate(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg text-sm px-2 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">To Date</label>
                          <input
                            type="date"
                            max="9999-12-31"
                            value={filterToDate}
                            onChange={(e) => setFilterToDate(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg text-sm px-2 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-white"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => setShowFilters(false)}
                        className="w-full mt-2 py-2 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate("/delivery-challans/create")}
                className="w-full sm:w-auto flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl transition-colors hover:bg-blue-700 shadow-xs"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create Delivery Challan
              </button>
            </div>
          </div>

          {/* Challans Table matching reference screenshot */}
          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full min-w-[800px]">
              <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left">CHALLAN NO</th>
                  <th scope="col" className="px-6 py-3 text-left">DATE</th>
                  <th scope="col" className="px-6 py-3 text-left">CLIENT</th>
                  <th scope="col" className="px-6 py-3 text-left">AMOUNT</th>
                  <th scope="col" className="px-6 py-3 text-left">REFERENCE NO</th>
                  <th scope="col" className="px-6 py-3 text-left">STATUS</th>
                  <th scope="col" className="px-6 py-3 text-left">ACTIONS</th>
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
                ) : paginatedChallans.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="mb-2 text-gray-500 font-medium">No delivery challans found</div>
                      <p className="text-sm text-gray-400">
                        {searchTerm ? "Try adjusting your search terms" : "Create your first delivery challan to get started"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedChallans.map((c) => {
                    const dcNum = c.challanNumber || c.dcNumber || c.id;
                    const clientName = c.client?.name || c.customerName || "Unknown";
                    const dateStr = c.challanDate || "-";
                    const total = Number(c.amount ?? c.total ?? 0);
                    const status = c.status || "Sent";

                    return (
                      <tr key={c.id} className="text-sm transition-colors hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{dcNum}</td>
                        <td className="px-6 py-4 text-gray-700">{dateStr}</td>
                        <td className="px-6 py-4 text-gray-700">{clientName}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-gray-700">{c.referenceNumber || c.poNumber || "-"}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-white text-xs font-medium ${
                              status === "Draft"
                                ? "bg-gray-500"
                                : status === "Delivered"
                                ? "bg-green-500"
                                : "bg-blue-600"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => {
                                setSelectedChallan(c);
                                setShowPreview(true);
                              }}
                              className="p-1 text-gray-600 transition-colors hover:text-blue-600"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/delivery-challans/edit/${c.id}`)}
                              className="p-1 text-gray-600 transition-colors hover:text-green-600"
                              title="Edit Delivery Challan"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDownloadingChallan(c)}
                              className="p-1 text-gray-600 transition-colors hover:text-purple-600"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id, dcNum)}
                              className="p-1 text-gray-600 transition-colors hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-end">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </main>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedChallan && (
        <ChallanPreview
          challan={selectedChallan}
          setShowPreview={setShowPreview}
        />
      )}

      {/* Hidden Download Modal */}
      {downloadingChallan && (
        <div style={{ position: "fixed", left: "-1000vw", top: 0 }}>
          <ChallanPreview
            challan={downloadingChallan}
            setShowPreview={() => setDownloadingChallan(null)}
            embedded={true}
            autoDownload={true}
            onDownloadComplete={() => setDownloadingChallan(null)}
          />
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null, dcNumber: "" })}
        onConfirm={confirmDelete}
        title="Delete Delivery Challan"
        message={`Are you sure you want to delete delivery challan ${deleteModal.dcNumber}? This action cannot be undone.`}
      />
    </div>
  );
}
