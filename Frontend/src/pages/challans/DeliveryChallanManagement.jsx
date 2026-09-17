import React, { useState, useEffect } from "react";
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

  const [selectedChallan, setSelectedChallan] = useState(null);
  const [downloadingChallan, setDownloadingChallan] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, dcNumber: "" });

  const filteredChallans = challans.filter((c) => {
    const num = (c.challanNumber || c.dcNumber || "").toLowerCase();
    const clientName = (c.client?.name || c.customerName || "").toLowerCase();
    const matchesSearch = num.includes(searchTerm.toLowerCase()) || clientName.includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "All Challans" || (c.status || "Sent").toLowerCase() === "draft";
    return matchesSearch && matchesTab;
  });

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
              <div className="flex p-1 bg-gray-100 rounded-lg whitespace-nowrap">
                {["All Challans", "Drafts"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              <div className="relative w-full sm:w-auto flex-1 lg:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search challans..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-80 bg-gray-100 rounded-lg pl-9 pr-4 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-0"
                />
              </div>

              <button
                onClick={() => navigate("/delivery-challans/create")}
                className="w-full sm:w-auto flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Delivery Challan
              </button>
            </div>
          </div>

          {/* Challans Table matching Invoice Management screenshot */}
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
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      Loading delivery challans...
                    </td>
                  </tr>
                ) : paginatedChallans.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="mb-2 text-gray-500">No delivery challans found</div>
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
                    const total = (c.amount || c.total || 0).toFixed(2);
                    const status = c.status || "Sent";

                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900">{dcNum}</td>
                        <td className="px-6 py-4 text-gray-700">{dateStr}</td>
                        <td className="px-6 py-4 text-gray-700">{clientName}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">₹{Number(total).toLocaleString()}</td>
                        <td className="px-6 py-4 text-gray-700">{c.referenceNumber || c.poNumber || "-"}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-white text-xs font-medium ${
                              status === "Draft"
                                ? "bg-gray-500"
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
