import React, { useState, useRef, useEffect, useContext } from "react";
import {
  ChevronDown,
  TrendingUp,
  FileText,
  Percent,
  Users,
  Printer,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  IndianRupee,
  X,
  Search,
  Calendar,
  Filter,
} from "lucide-react";
import PropTypes from "prop-types";
import { ResponsivePie } from "@nivo/pie";

import {
  useDashboard,
  useInvoices,
  useCustomers,
  useAllPayments,
} from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";
import { AuthContext } from "../../context/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { generateInvoiceHTML } from "../../utils/invoiceGenerator";





// Donut chart component for GST Distribution
const DonutChart = ({ cgst, sgst, igst }) => {
  const total = cgst + sgst + igst;
  const cgstPercent = total > 0 ? (cgst / total) * 360 : 0;
  const sgstPercent = total > 0 ? (sgst / total) * 360 : 0;

  const getArcPath = (startAngle, endAngle, radius) => {
    const start = {
      x: 50 + radius * Math.cos((startAngle * Math.PI) / 180),
      y: 50 + radius * Math.sin((startAngle * Math.PI) / 180),
    };
    const end = {
      x: 50 + radius * Math.cos((endAngle * Math.PI) / 180),
      y: 50 + radius * Math.sin((endAngle * Math.PI) / 180),
    };
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  return (
    <div className="w-48 h-48 flex items-center justify-center relative">
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <path
          d={getArcPath(0, cgstPercent, 42)}
          fill="none"
          stroke="#1A73E8"
          strokeWidth="16"
        />
        <path
          d={getArcPath(cgstPercent, cgstPercent + sgstPercent, 42)}
          fill="none"
          stroke="#34D399"
          strokeWidth="16"
        />
        <path
          d={getArcPath(cgstPercent + sgstPercent, 360, 42)}
          fill="none"
          stroke="#F59E0B"
          strokeWidth="16"
        />
      </svg>
    </div>
  );
};

DonutChart.propTypes = {
  cgst: PropTypes.number.isRequired,
  sgst: PropTypes.number.isRequired,
  igst: PropTypes.number.isRequired,
};

// Component for the GST Summary tab content using real data
const GSTSummary = ({ invoices = [], getDynamicInvoiceStatus }) => {
  // Helper to calculate GST totals
  const calculateGST = (invoices, getDynamicInvoiceStatus) => {
    const paidInvoices = invoices.filter((inv) => getDynamicInvoiceStatus(inv) === "Paid");

    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    paidInvoices.forEach((inv) => {
      // Use the GST amounts directly from the invoice if available
      // Note: cgst/sgst/igst are percentages, cgstAmount/sgstAmount/igstAmount are the actual amounts
      if (inv.cgstAmount !== undefined || inv.sgstAmount !== undefined || inv.igstAmount !== undefined) {
        totalCGST += Number(inv.cgstAmount) || 0;
        totalSGST += Number(inv.sgstAmount) || 0;
        totalIGST += Number(inv.igstAmount) || 0;
      } else {
        // Fallback: Calculate from items/products if GST amounts not stored
        const items = inv.items || inv.products || [];
        const subtotal = items.reduce((sum, item) => {
          return sum + (item.total || item.amount || (item.quantity || 0) * (item.price || item.rate || 0));
        }, 0);

        const cgstPercent = inv.cgst || 9; // Default 9%
        const sgstPercent = inv.sgst || 9; // Default 9%
        const igstPercent = inv.igst || 0;

        totalCGST += (subtotal * cgstPercent) / 100;
        totalSGST += (subtotal * sgstPercent) / 100;
        totalIGST += (subtotal * igstPercent) / 100;
      }
    });

    const total = totalCGST + totalSGST + totalIGST;

    return {
      cgst: totalCGST,
      sgst: totalSGST,
      igst: totalIGST,
      total,
      cgstPercent: total > 0 ? (totalCGST / total) * 100 : 0,
      sgstPercent: total > 0 ? (totalSGST / total) * 100 : 0,
      igstPercent: total > 0 ? (totalIGST / total) * 100 : 0,
    };
  };

  const gstData = calculateGST(invoices, getDynamicInvoiceStatus);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* GST Collection Summary */}
      <div className="p-5 border border-gray-200 rounded-xl">
        <h3 className="font-bold text-gray-900 text-lg">
          GST Collection Summary
        </h3>
        <p className="text-sm text-gray-500 mb-4">Tax breakdown by type</p>
        <div className="space-y-3">
          <div className="bg-gray-50/50 p-4 rounded-lg flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span className="font-medium text-sm">CGST</span>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm text-gray-900">
                ₹
                {gstData.cgst.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-gray-500">
                {gstData.cgstPercent.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="bg-gray-50/50 p-4 rounded-lg flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-green-400 rounded-full"></div>
              <span className="font-medium text-sm">SGST</span>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm text-gray-900">
                ₹
                {gstData.sgst.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-gray-500">
                {gstData.sgstPercent.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="bg-gray-50/50 p-4 rounded-lg flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
              <span className="font-medium text-sm">IGST</span>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm text-gray-900">
                ₹
                {gstData.igst.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-gray-500">
                {gstData.igstPercent.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* GST Distribution */}
      <div className="p-5 border border-gray-200 rounded-xl flex flex-col">
        <h3 className="font-bold text-gray-900 text-lg">
          GST Distribution
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Visual breakdown
        </p>
        <div className="h-80">
          <ResponsivePie
            data={[
              { id: "CGST", label: "CGST", value: gstData.cgst, color: "#3b82f6" },
              { id: "SGST", label: "SGST", value: gstData.sgst, color: "#10b981" },
              { id: "IGST", label: "IGST", value: gstData.igst, color: "#f59e0b" }
            ].filter(item => item.value > 0)}
            margin={{ top: 20, right: 80, bottom: 80, left: 80 }}
            innerRadius={0.5}
            padAngle={0.7}
            cornerRadius={3}
            activeOuterRadiusOffset={8}
            colors={{ datum: 'data.color' }}
            borderWidth={1}
            borderColor={{
              from: 'color',
              modifiers: [['darker', 0.2]]
            }}
            arcLinkLabelsSkipAngle={10}
            arcLinkLabelsTextColor="#333333"
            arcLinkLabelsThickness={2}
            arcLinkLabelsColor={{ from: 'color' }}
            arcLabelsSkipAngle={10}
            enableArcLabels={false}
            theme={{
              labels: {
                text: {
                  fontSize: 12,
                  fontWeight: 600
                }
              }
            }}
            tooltip={({ datum }) => (
              <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
                <div className="text-sm font-semibold text-gray-900">
                  {datum.label}
                </div>
                <div className="text-sm text-gray-600">
                  Amount: <span className="font-bold" style={{ color: datum.color }}>₹{datum.value.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {datum.data.id === 'CGST' && `${gstData.cgstPercent.toFixed(1)}%`}
                  {datum.data.id === 'SGST' && `${gstData.sgstPercent.toFixed(1)}%`}
                  {datum.data.id === 'IGST' && `${gstData.igstPercent.toFixed(1)}%`}
                </div>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
};

GSTSummary.propTypes = {
  invoices: PropTypes.array,
  getDynamicInvoiceStatus: PropTypes.func.isRequired,
};

const PDFExportModal = ({ isOpen, onClose, invoices, customers, payments, stats, onExport }) => {
  const [step, setStep] = useState("type-selection"); // type-selection, client-selection, client-options, date-selection
  const [reportType, setReportType] = useState(""); // client, monthly, yearly
  const [clientReportType, setClientReportType] = useState(""); // monthly, yearly
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState("");


  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const { error: toastError, warning } = useToast();

  useEffect(() => {
    if (isOpen) {
      setStep("type-selection");
      setReportType("");
      setClientReportType("");
      setSelectedClient(null);
      setSearchTerm("");
      setSelectedMonth(new Date().getMonth());
      setSelectedYear(new Date().getFullYear());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleTypeSelect = (type) => {
    setReportType(type);
    if (type === "client" || type === "summary") {
      setStep("client-selection");
    } else {
      setStep("date-selection");
    }
  };

  const handleClientSelect = (client) => {
    setSelectedClient(client);
    if (reportType === "summary") {
      setStep("client-options"); // For summary, show filter options
    } else {
      setStep("client-options");
    }
  };

  const handleClientOptionSelect = (type) => {
    setClientReportType(type);
    setStep("date-selection");
  };

  const handleGenerate = () => {
    let filteredInvoices = [...invoices];
    let title = "Business Report";
    let subtitle = "";

    // Handle Summary Report separately
    if (reportType === "summary") {
      if (!selectedClient) {
        toastError("Please select a client.");
        return;
      }

      // Filter by Client
      filteredInvoices = filteredInvoices.filter(inv =>
        inv.clientId === selectedClient.id || inv.client?.id === selectedClient.id
      );

      // Filter by Date based on clientReportType
      const isMonthly = clientReportType === "monthly";
      const isYearly = clientReportType === "yearly";

      if (isMonthly) {
        const start = new Date(selectedYear, selectedMonth, 1);
        const end = new Date(selectedYear, selectedMonth + 1, 0);
        end.setHours(23, 59, 59, 999);

        filteredInvoices = filteredInvoices.filter(inv => {
          const d = new Date(inv.invoiceDate || inv.createdAt?.toDate?.() || inv.createdAt);
          return d >= start && d <= end;
        });
      } else if (isYearly) {
        const start = new Date(selectedYear, 3, 1); // April 1st
        const end = new Date(selectedYear + 1, 2, 31); // March 31st next year
        end.setHours(23, 59, 59, 999);

        filteredInvoices = filteredInvoices.filter(inv => {
          const d = new Date(inv.invoiceDate || inv.createdAt?.toDate?.() || inv.createdAt);
          return d >= start && d <= end;
        });
      }

      if (filteredInvoices.length === 0) {
        toastError("No bills found for the selected period.");
        return;
      }

      // Call the summary report function
      const result = exportClientSummaryReport(
        filteredInvoices,
        selectedClient,
        clientReportType,
        selectedMonth,
        selectedYear
      );

      if (result.success) {
        onClose();
      } else {
        toastError(result.message || "Failed to generate summary report.");
      }
      return;
    }

    // Filter by Client if needed
    if (reportType === "client" && selectedClient) {
      filteredInvoices = filteredInvoices.filter(inv =>
        inv.clientId === selectedClient.id || inv.client?.id === selectedClient.id
      );
    }

    // Filter by Date
    const isMonthly = (reportType === "monthly") || (reportType === "client" && clientReportType === "monthly");
    const isYearly = (reportType === "yearly") || (reportType === "client" && clientReportType === "yearly");

    if (isMonthly) {
      const start = new Date(selectedYear, selectedMonth, 1);
      const end = new Date(selectedYear, selectedMonth + 1, 0);
      end.setHours(23, 59, 59, 999);

      filteredInvoices = filteredInvoices.filter(inv => {
        const d = new Date(inv.invoiceDate || inv.createdAt?.toDate?.() || inv.createdAt);
        return d >= start && d <= end;
      });

      title = reportType === "client" ? `Client Monthly Bill - ${selectedClient.name}` : "Monthly Bill";
      subtitle = `For ${months[selectedMonth]} ${selectedYear}`;
    } else if (isYearly) {
      // Financial Year: 1st April of selectedYear to 31st March of selectedYear + 1
      const start = new Date(selectedYear, 3, 1); // April 1st
      const end = new Date(selectedYear + 1, 2, 31); // March 31st next year
      end.setHours(23, 59, 59, 999);

      filteredInvoices = filteredInvoices.filter(inv => {
        const d = new Date(inv.invoiceDate || inv.createdAt?.toDate?.() || inv.createdAt);
        return d >= start && d <= end;
      });

      title = reportType === "client" ? `Client Yearly Bill - ${selectedClient.name}` : "Yearly Bill";
      subtitle = `Financial Year ${selectedYear}-${selectedYear + 1}`;
    }

    if (filteredInvoices.length === 0) {
      toastError("No bills found for the selected period.");
      return;
    }

    onExport(filteredInvoices, customers, payments, stats, title, subtitle);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          title="Close"
        >
          <X size={18} />
        </button>

        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {step === "type-selection" && "Select Report Type"}
            {step === "client-selection" && "Select Client"}
            {step === "client-options" && "Select Bill Type"}
            {step === "date-selection" && "Select Period"}
          </h2>

          {step === "type-selection" && (
            <div className="space-y-3">
              <button
                onClick={() => handleTypeSelect("summary")}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group bg-gray-50"
              >
                <div className="font-semibold text-gray-900 group-hover:text-blue-700">Summary Report</div>
                <div className="text-sm text-gray-500">Detailed client summary with all invoice details</div>
              </button>
              <button
                onClick={() => handleTypeSelect("client")}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group bg-gray-50"
              >
                <div className="font-semibold text-gray-900 group-hover:text-blue-700">Client Bill</div>
                <div className="text-sm text-gray-500">Download reports for specific clients</div>
              </button>
              <button
                onClick={() => handleTypeSelect("monthly")}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group bg-gray-50"
              >
                <div className="font-semibold text-gray-900 group-hover:text-blue-700">Monthly Bill</div>
                <div className="text-sm text-gray-500">Download entire monthly bill</div>
              </button>
              <button
                onClick={() => handleTypeSelect("yearly")}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group bg-gray-50"
              >
                <div className="font-semibold text-gray-900 group-hover:text-blue-700">Yearly Bill</div>
                <div className="text-sm text-gray-500">Download entire financial year bill</div>
              </button>
            </div>
          )}

          {step === "client-selection" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-blue-500 border-transparent transition-all"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map(client => (
                    <button
                      key={client.id}
                      onClick={() => handleClientSelect(client)}
                      className="w-full p-3 text-left hover:bg-gray-100 rounded-lg flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{client.name}</div>
                        <div className="text-xs text-gray-500">{client.email}</div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600" />
                    </button>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-4">No clients found</div>
                )}
              </div>
            </div>
          )}

          {step === "client-options" && (
            <div className="space-y-3">
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-sm text-blue-800 font-medium">Selected Client: </span>
                <span className="text-sm text-blue-900">{selectedClient?.name}</span>
              </div>
              <button
                onClick={() => handleClientOptionSelect("monthly")}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group bg-gray-50"
              >
                <div className="font-semibold text-gray-900 group-hover:text-blue-700">Monthly Bill</div>
                <div className="text-sm text-gray-500">Download monthly report for this client</div>
              </button>
              <button
                onClick={() => handleClientOptionSelect("yearly")}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group bg-gray-50"
              >
                <div className="font-semibold text-gray-900 group-hover:text-blue-700">Yearly Bill</div>
                <div className="text-sm text-gray-500">Download yearly report for this client</div>
              </button>
            </div>
          )}

          {step === "date-selection" && (
            <div className="space-y-4">
              {/* Show Month Selector if Monthly */}
              {((reportType === "monthly") || (reportType === "client" && clientReportType === "monthly")) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-0 focus:border-blue-500 border-transparent transition-all"
                  >
                    {months.map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Show Year Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {((reportType === "yearly") || (reportType === "client" && clientReportType === "yearly"))
                    ? "Select Financial Year (Starts April 1st)"
                    : "Select Year"}
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-0 focus:border-blue-500 border-transparent transition-all"
                >
                  {years.map(y => (
                    <option key={y} value={y}>
                      {((reportType === "yearly") || (reportType === "client" && clientReportType === "yearly"))
                        ? `${y} - ${y + 1}`
                        : y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => {
                    if (reportType === "client") setStep("client-options");
                    else setStep("type-selection");
                  }}
                  className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-900 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </div>

        {step !== "type-selection" && step !== "date-selection" && (
          <div className="px-6 pb-6 pt-0 flex justify-start">
            <button
              onClick={() => {
                if (step === "client-options") {
                  setStep("client-selection");
                } else if (step === "client-selection") {
                  setStep("type-selection");
                }
              }}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
            >
              <ChevronLeft size={16} className="mr-1" /> Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

PDFExportModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  invoices: PropTypes.array,
  customers: PropTypes.array,
  payments: PropTypes.array,
  stats: PropTypes.object,
  onExport: PropTypes.func.isRequired,
};

const ReportsAnalytics = () => {
  const [activeTab, setActiveTab] = useState("Overview");
  const currentYear = new Date().getFullYear();
  // Default to Yearly Report for the current financial year
  const [reportType, setReportType] = useState("Yearly Report");
  const [timePeriod, setTimePeriod] = useState(currentYear.toString());
  // New state variables for explicit Month/Year filtering in Monthly Report
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  // New state for the new charts
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [revenueYear, setRevenueYear] = useState(new Date().getFullYear());


  // PDF Modal State
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const exportDropdownRef = useRef(null);
  const filterDropdownRef = useRef(null);

  // Get authentication context
  const { user } = useContext(AuthContext);
  const { error: toastError, warning } = useToast();

  // Use data hooks
  const { stats, error: statsError } = useDashboard();
  const { allInvoices: invoices, error: invoicesError } = useInvoices();
  const { allCustomers: customers, error: customersError } = useCustomers();
  const { payments, error: paymentsError } = useAllPayments();

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Close export dropdown and filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };

    if (showExportDropdown || showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportDropdown, showFilterDropdown]);


  // Filter invoices based on selected time period
  const getFilteredInvoices = () => {
    if (!invoices || invoices.length === 0) return [];

    const now = new Date();
    let startDate, endDate;

    switch (timePeriod) {
      /* REMOVED: "This Month" and "Last Month" cases, as they are now handled by explicit selection */
      /*
      case "This Month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "Last Month":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      */
      case "Monthly Report": // We will use this identifier logic
        // Fallthrough or handle below. Logic moved to conditional check below for reportType
        break;
      case "Custom":
        if (fromDate && toDate) {
          startDate = new Date(fromDate);
          endDate = new Date(toDate);
        } else {
          return invoices; // Return all if custom dates not set
        }
        break;
      default:
        // For Yearly Report (Financial Year)
        // If reportType is Monthly Report, we shouldn't be here if we handle it differently
        if (reportType === "Monthly Report") {
          startDate = new Date(filterYear, filterMonth, 1);
          endDate = new Date(filterYear, filterMonth + 1, 0);
        } else {
          // Yearly report (Financial Year: April 1st to March 31st of next year)
          const year = Number.parseInt(timePeriod);
          if (!isNaN(year)) {
            startDate = new Date(year, 3, 1); // April 1st of selected year
            endDate = new Date(year + 1, 2, 31); // March 31st of next year
          } else {
            return invoices;
          }
        }
    }

    // Set endDate to end of day
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    // Set startDate to beginning of day (just in case)
    if (startDate) {
      startDate.setHours(0, 0, 0, 0);
    }

    return invoices.filter(invoice => {
      // Handle Firestore Timestamp or Date string or Date object
      let invoiceDate;

      // Check if invoiceDate exists and handle different formats
      if (invoice.invoiceDate) {
        if (invoice.invoiceDate?.toDate && typeof invoice.invoiceDate.toDate === 'function') {
          // Firestore Timestamp
          invoiceDate = invoice.invoiceDate.toDate();
        } else if (invoice.invoiceDate instanceof Date) {
          // Already a Date object
          invoiceDate = invoice.invoiceDate;
        } else {
          // String - try to parse it
          invoiceDate = new Date(invoice.invoiceDate);
        }
      } else if (invoice.createdAt) {
        // Fallback to createdAt if invoiceDate doesn't exist
        if (invoice.createdAt?.toDate && typeof invoice.createdAt.toDate === 'function') {
          // Firestore Timestamp
          invoiceDate = invoice.createdAt.toDate();
        } else if (invoice.createdAt instanceof Date) {
          // Already a Date object
          invoiceDate = invoice.createdAt;
        } else {
          // String - try to parse it
          invoiceDate = new Date(invoice.createdAt);
        }
      } else {
        // No date available, use current date as fallback
        invoiceDate = new Date();
      }

      // Validate the date before comparison
      if (isNaN(invoiceDate.getTime())) {
        return false; // Skip invalid dates
      }

      return invoiceDate >= startDate && invoiceDate <= endDate;
    });
  };

  const filteredInvoices = getFilteredInvoices();

  // Function to calculate dynamic invoice status
  const getDynamicInvoiceStatus = (invoice) => {
    if (invoice.status === "Paid" || invoice.status === "paid") return "Paid";
    if (invoice.status === "Draft" || invoice.status === "draft") return "Draft";
    if (invoice.status === "deleted") return "Deleted";

    // Check if invoice is overdue
    if (invoice.dueDate) {
      const dueDate = new Date(invoice.dueDate);
      const today = new Date();
      if (dueDate < today) return "Overdue";
    }

    return "Unpaid";
  };

  const realTimeStats = React.useMemo(() => {
    const paidInvoices = filteredInvoices.filter(inv => getDynamicInvoiceStatus(inv) === "Paid");
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (Number.parseFloat(inv.total || inv.amount || 0) || 0), 0);

    // Calculate unique clients in filtered invoices
    const uniqueClientIds = new Set(filteredInvoices.map(inv => inv.clientId || inv.client?.id).filter(Boolean));
    const activeClientsCount = uniqueClientIds.size;

    return {
      totalInvoices: filteredInvoices.length,
      paidInvoices,
      totalRevenue,
      activeClientsCount
    };
  }, [filteredInvoices, getDynamicInvoiceStatus]); // Replaced missing useRealTimeStats
  const handleReportTypeChange = (e) => {
    const newReportType = e.target.value;
    setReportType(newReportType);
    // Reset time period to a default value when report type changes
    if (newReportType === "Monthly Report") {
      // Default to current month/year is already set in state initialization
      // setTimePeriod("Monthly Report"); // Just a placeholder
    } else if (newReportType === "Yearly Report") {
      setTimePeriod(currentYear.toString());
    }
  };



  const renderContent = () => {
    // Show error state
    if (statsError || invoicesError || customersError || paymentsError) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-600 mb-4">
              Error loading reports:{" "}
              {statsError || invoicesError || customersError || paymentsError}
            </p>
            <button
              onClick={() => globalThis.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 mb-6">
          <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-600">
                Total Revenue
              </h3>
              <div className="p-1 bg-gray-50 rounded-md">
                <IndianRupee className="w-4 h-4 text-green-500" />
              </div>
            </div>
            <div className="mt-1">
              <p className="text-xl font-bold text-gray-900">
                ₹{realTimeStats.totalRevenue.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-green-500 flex items-center mt-0.5">
                <TrendingUp className="w-3 h-3 mr-1" /> Real-time data
              </p>
            </div>
          </div>
          <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-600">
                Total Invoices
              </h3>
              <div className="p-1 bg-gray-50 rounded-md">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="mt-1">
              <p className="text-xl font-bold text-gray-900">
                {realTimeStats.totalInvoices}
              </p>
              <p className="text-xs text-green-500 flex items-center mt-0.5">
                <TrendingUp className="w-3 h-3 mr-1" /> Total Invoices
              </p>
            </div>
          </div>
          <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-600">
                GST Collected
              </h3>
              <div className="p-1 bg-gray-50 rounded-md">
                <Percent className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div className="mt-1">
              <p className="text-xl font-bold text-gray-900">
                ₹{(() => {
                  const paidInvoices = realTimeStats.paidInvoices;
                  const totalGST = paidInvoices.reduce((sum, inv) => {
                    // Use GST amounts directly from invoice if available
                    if (inv.cgstAmount !== undefined || inv.sgstAmount !== undefined || inv.igstAmount !== undefined) {
                      return sum + (Number(inv.cgstAmount) || 0) + (Number(inv.sgstAmount) || 0) + (Number(inv.igstAmount) || 0);
                    }

                    // Fallback: Calculate from items/products
                    const items = inv.items || inv.products || [];
                    const subtotal = items.reduce((itemSum, item) => {
                      return itemSum + (item.total || item.amount || (item.quantity || 0) * (item.price || item.rate || 0));
                    }, 0);

                    const cgstPercent = inv.cgst || 9; // Default 9%
                    const sgstPercent = inv.sgst || 9; // Default 9%
                    const igstPercent = inv.igst || 0;
                    return sum + (subtotal * (cgstPercent + sgstPercent + igstPercent)) / 100;
                  }, 0);
                  return totalGST.toLocaleString("en-IN");
                })()}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                From paid invoices
              </p>
            </div>
          </div>
          <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-600">
                Total Clients
              </h3>
              <div className="p-1 bg-gray-50 rounded-md">
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            <div className="mt-1">
              <p className="text-xl font-bold text-gray-900">
                {realTimeStats.activeClientsCount}
              </p>
              <p className="text-xs text-green-500 flex items-center mt-0.5">
                <TrendingUp className="w-3 h-3 mr-1" /> Total Clients
              </p>
            </div>
          </div>
        </div>



        {/* GST Summary */}
        <GSTSummary invoices={filteredInvoices} getDynamicInvoiceStatus={getDynamicInvoiceStatus} />
      </>
    );
  };

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Reports & Analytics
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Generate comprehensive business reports and insights
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3 sm:mt-0">
            {/* Filter Dropdown */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="bg-white border border-gray-200 text-gray-700 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all shadow-sm hover:shadow active:scale-95"
              >
                <Filter className="w-4 h-4" />
                Filter
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-fade-in-up p-4">
                  <div className="space-y-4">
                    {/* Report Type */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Report Type
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                          value={reportType}
                          onChange={handleReportTypeChange}
                          className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
                        >
                          <option>Monthly Report</option>
                          <option>Yearly Report</option>
                          <option>Custom Report</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Time Period / Month & Year Selection */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                        {reportType === "Monthly Report" ? "Select Month & Year" : "Time Period"}
                      </label>

                      {reportType === "Monthly Report" ? (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <select
                              value={filterMonth}
                              onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
                            >
                              {months.map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                              ))}
                            </select>
                          </div>
                          <div className="relative flex-1">
                            <select
                              value={filterYear}
                              onChange={(e) => setFilterYear(parseInt(e.target.value))}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
                            >
                              {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
                                <option key={y} value={y}>{y}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <select
                            value={timePeriod}
                            onChange={(e) => setTimePeriod(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={reportType === "Custom Report"}
                          >
                            {reportType === "Yearly Report" &&
                              years.map((year) => <option key={year} value={year}>{`${year}-${(year + 1).toString().slice(-2)}`}</option>)}
                            {reportType === "Custom Report" && <option>Custom</option>}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                      )}
                    </div>

                    {/* Custom Date Inputs */}
                    {reportType === "Custom Report" && (
                      <div className="pt-2 border-t border-gray-100 space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-700 mb-1 block">From</label>
                          <input
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            type="date"
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-700 mb-1 block">To</label>
                          <input
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            type="date"
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Export Dropdown */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm hover:shadow active:scale-95"
              >
                <FileText className="w-4 h-4" />
                Export Report
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showExportDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showExportDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-fade-in-up">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowPDFModal(true);
                        setShowExportDropdown(false);
                      }}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Printer className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900">PDF Report</div>
                        <div className="text-xs text-gray-500 mt-0.5">Detailed invoice report</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowSummaryModal(true);
                        setShowExportDropdown(false);
                      }}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="p-2 bg-green-50 rounded-lg">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900">Summary Report</div>
                        <div className="text-xs text-gray-500 mt-0.5">Client-wise detailed summary</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>



        {/* Main Content */}
        <main className="mt-6 flex flex-col gap-6">


          {/* Main Content Area */}
          {renderContent()}
        </main>

        {/* PDF Export Modal */}
        <PDFExportModal
          isOpen={showPDFModal}
          onClose={() => setShowPDFModal(false)}
          invoices={invoices}
          customers={customers}
          payments={payments}
          stats={stats}
          onExport={(inv, cust, pay, st, title, subtitle) => {
            setIsGeneratingPDF(true);
            // Use setTimeout to allow UI to update with loading state
            setTimeout(async () => {
              await exportToPDF(inv, cust, pay, st, title, subtitle);
              setIsGeneratingPDF(false);
            }, 100);
          }}
        />

        {/* Summary Report Modal */}
        <PDFExportModal
          isOpen={showSummaryModal}
          onClose={() => setShowSummaryModal(false)}
          invoices={invoices}
          customers={customers}
          payments={payments}
          stats={stats}
          onExport={(inv, cust, pay, st, title, subtitle) => {
            // This won't be called for summary reports, but required by PropTypes
          }}
        />

        {/* Loading Overlay */}
        {isGeneratingPDF && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900">Generating Report...</h3>
              <p className="text-sm text-gray-500">Please wait while we generate the PDF invoices.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Export functions
const exportToPDF = async (invoices, customers, payments, stats, title = "Business Report", subtitle = "") => {
  // If it's a specific bill request (Client/Monthly/Yearly), generate actual invoices
  if (title.includes("Bill")) {
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();

      // Sort invoices by date
      const sortedInvoices = [...invoices].sort((a, b) => {
        const dateA = new Date(a.invoiceDate || a.createdAt);
        const dateB = new Date(b.invoiceDate || b.createdAt);
        return dateA - dateB;
      });

      for (let i = 0; i < sortedInvoices.length; i++) {
        const invoice = sortedInvoices[i];

        // Create temp div
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = generateInvoiceHTML(invoice, {});
        tempDiv.style.position = "absolute";
        tempDiv.style.left = "-9999px";
        tempDiv.style.width = "800px"; // Fixed width for consistent rendering
        document.body.appendChild(tempDiv);

        // Convert to canvas
        const canvas = await html2canvas(tempDiv, {
          scale: 3, // Increased scale for better quality
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          width: 800,
          height: tempDiv.scrollHeight
        });

        document.body.removeChild(tempDiv);

        const imgData = canvas.toDataURL("image/png");
        const margin = 15; // 15mm margin to match standard
        const imgWidth = pdfWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Add page (except for first one)
        if (i > 0) {
          doc.addPage();
        }

        // Add image to PDF
        // standard invoice fits A4 usually
        if (imgHeight > pdfHeight - (margin * 2)) {
          // If too tall, scale it down to fit one page within margins
          const scaleFactor = (pdfHeight - (margin * 2)) / imgHeight;
          doc.addImage(imgData, "PNG", margin, margin, imgWidth * scaleFactor, imgHeight * scaleFactor);
        } else {
          doc.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
        }
      }

      doc.save(`${title.replace(/ /g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
      return;
    } catch (error) {
      console.error("Error generating bulk PDF:", error);
      alert("Error generating PDF. Please try again.");
      return;
    }
  }

  // Fallback to Summary Report for "Detailed Report" or generic export
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text(title, 20, 20);
  doc.setFontSize(12);
  doc.text(subtitle || `Generated on: ${new Date().toLocaleDateString("en-IN")}`, 20, 30);

  // Summary Stats
  doc.setFontSize(16);
  doc.text("Summary Statistics", 20, 50);

  const summaryData = [
    [
      "Total Revenue",
      `₹${stats?.totalRevenue?.toLocaleString("en-IN") || "0"}`,
    ],
    ["Total Invoices", stats?.totalInvoices || 0],
    ["Total Customers", stats?.totalCustomers || 0],
    ["Paid Invoices", stats?.paidInvoices || 0],
    ["Unpaid Invoices", stats?.unpaidInvoices || 0],
    ["Payment Rate", `${stats?.paymentRate?.toFixed(1) || 0}%`],
  ];

  autoTable(doc, {
    startY: 60,
    head: [["Metric", "Value"]],
    body: summaryData,
    theme: "grid",
    headStyles: { fillColor: [66, 139, 202] },
    styles: { fontSize: 10 },
  });

  // Detailed Invoice Information
  doc.setFontSize(16);
  doc.text("Detailed Invoice Information", 20, doc.lastAutoTable.finalY + 20);

  const invoiceData = (invoices || []).map((inv) => [
    inv.invoiceNumber || "N/A",
    inv.client?.name || "N/A",
    inv.client?.email || "N/A",
    inv.client?.phone || "N/A",
    `₹${(inv.total || inv.amount || 0).toLocaleString("en-IN")}`,
    inv.status || "N/A",
    inv.invoiceDate
      ? new Date(inv.invoiceDate).toLocaleDateString("en-IN")
      : "N/A",
    inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "N/A",
    inv.items?.length || 0,
    inv.cgst ? `${inv.cgst}%` : "0%",
    inv.sgst ? `${inv.sgst}%` : "0%",
    inv.igst ? `${inv.igst}%` : "0%",
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 30,
    head: [
      [
        "Invoice #",
        "Client",
        "Email",
        "Phone",
        "Amount",
        "Status",
        "Date",
        "Due Date",
        "Items",
        "CGST",
        "SGST",
        "IGST",
      ],
    ],
    body: invoiceData,
    theme: "grid",
    headStyles: { fillColor: [66, 139, 202] },
    styles: { fontSize: 8 },
    columnStyles: {
      4: { halign: "right" },
    },
  });

  // Payment Information
  if (payments && payments.length > 0) {
    doc.setFontSize(16);
    doc.text("Payment Information", 20, doc.lastAutoTable.finalY + 20);

    const paymentData = payments.map((payment) => [
      payment.invoiceId || "N/A",
      `₹${(payment.amount || 0).toLocaleString("en-IN")}`,
      payment.method || "N/A",
      payment.transactionId || "N/A",
      payment.paymentDate
        ? new Date(payment.paymentDate).toLocaleDateString("en-IN")
        : "N/A",
      payment.status || "N/A",
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 30,
      head: [
        [
          "Invoice ID",
          "Amount",
          "Method",
          "Transaction ID",
          "Payment Date",
          "Status",
        ],
      ],
      body: paymentData,
      theme: "grid",
      headStyles: { fillColor: [66, 139, 202] },
      styles: { fontSize: 10 },
      columnStyles: {
        1: { halign: "right" },
        4: { halign: "center" },
        5: { halign: "center" },
      },
    });
  }

  // Save the PDF
  doc.save(`business_report_${new Date().toISOString().split("T")[0]}.pdf`);
};

const exportClientSummaryReport = (invoices, selectedClient, filterType, filterMonth, filterYear) => {
  if (!invoices || invoices.length === 0) {
    return { success: false, message: "No bills found to generate summary report." };
  }

  if (!selectedClient) {
    return { success: false, message: "Please select a client." };
  }

  const doc = new jsPDF();

  // Set default font to Helvetica (closest to Mazzard in standard PDF fonts)
  doc.setFont('helvetica');

  // Company Header (Centered at top)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(139, 0, 0); // Dark red color
  doc.text("ESA ENGINEERING WORKS", doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text("All Kinds of Lathe and Milling Works", doc.internal.pageSize.getWidth() / 2, 21, { align: 'center' });
  doc.text("Specialist in: Press Tools, Die Casting Tools, Precision Components", doc.internal.pageSize.getWidth() / 2, 26, { align: 'center' });
  doc.text("1/100, Chettipalayam Road, E.B. Compound, Malumichampatti, CBE - 641 050", doc.internal.pageSize.getWidth() / 2, 31, { align: 'center' });
  doc.text("E-Mail: esaengineeringworks@gmail.com | GSTIN: 33AMWPB2116Q1ZS", doc.internal.pageSize.getWidth() / 2, 36, { align: 'center' });

  // Client Details (Left side)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text("Client Details:", 14, 48);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${selectedClient.name || 'N/A'}`, 14, 54);
  doc.text(`Address: ${selectedClient.address || 'N/A'}`, 14, 60);
  doc.text(`GSTIN: ${selectedClient.taxId || selectedClient.gst || 'N/A'}`, 14, 66);

  // Period Info
  let periodText = "";
  if (filterType === "monthly") {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    periodText = `Period: ${months[filterMonth]} ${filterYear}`;
  } else if (filterType === "yearly") {
    periodText = `Period: Financial Year ${filterYear}-${filterYear + 1}`;
  } else if (filterType === "custom") {
    periodText = `Period: Custom Range`;
  }
  doc.setFontSize(9);
  doc.text(periodText, 14, 72);

  // Prepare table data
  const tableData = [];
  let totalBillAmount = 0;
  let totalGST = 0;
  let totalAmount = 0;
  let totalTDS = 0;
  let totalPaid = 0;
  let totalBalance = 0;

  invoices.forEach((inv, index) => {
    // Calculate bill amount (subtotal without GST)
    const items = inv.items || inv.products || [];
    const billAmount = items.reduce((sum, item) => {
      return sum + (item.amount || item.total || (item.quantity || 0) * (item.price || item.rate || 0));
    }, 0);

    // Calculate GST
    const cgst = (billAmount * (inv.cgst || 0)) / 100;
    const sgst = (billAmount * (inv.sgst || 0)) / 100;
    const igst = (billAmount * (inv.igst || 0)) / 100;
    const gstAmount = cgst + sgst + igst;

    // Total amount = Bill Amount + GST
    const invoiceTotal = billAmount + gstAmount;

    // TDS Amount
    const tdsAmount = inv.tdsAmount || 0;

    // Paid Amount
    const paidAmount = inv.paidAmount || 0;

    // Balance = Total - TDS - Paid
    const balance = invoiceTotal - tdsAmount - paidAmount;

    // Format date
    let billDate = "N/A";
    if (inv.invoiceDate) {
      if (typeof inv.invoiceDate === 'string') {
        billDate = inv.invoiceDate;
      } else if (inv.invoiceDate?.toDate && typeof inv.invoiceDate.toDate === 'function') {
        billDate = inv.invoiceDate.toDate().toLocaleDateString('en-IN');
      } else if (inv.invoiceDate instanceof Date) {
        billDate = inv.invoiceDate.toLocaleDateString('en-IN');
      }
    }

    tableData.push([
      (index + 1).toString(),
      billDate,
      inv.invoiceNumber || inv.displayId || 'N/A',
      "Sales Invoice",
      billAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ]);

    // Add to totals
    totalBillAmount += billAmount;
    totalGST += gstAmount;
    totalAmount += invoiceTotal;
    totalTDS += tdsAmount;
    totalPaid += paidAmount;
    totalBalance += balance;
  });

  // Add totals row
  tableData.push([
    { content: 'TOTAL', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
    { content: totalBillAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { fontStyle: 'bold' } },
    { content: totalGST.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { fontStyle: 'bold' } },
    { content: totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { fontStyle: 'bold' } },
    { content: totalTDS.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { fontStyle: 'bold' } },
    { content: totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { fontStyle: 'bold' } },
    { content: totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { fontStyle: 'bold' } }
  ]);

  // Generate table
  autoTable(doc, {
    startY: 78,
    head: [[
      'S.No',
      'Bill Date',
      'Bill No',
      'Particulars',
      'Bill Amt',
      'GST',
      'Total Amt',
      'TDS',
      'Paid Amt',
      'Balance'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },   // S.No
      1: { cellWidth: 20, halign: 'center' },   // Bill Date
      2: { cellWidth: 20, halign: 'center' },   // Bill No
      3: { cellWidth: 22, halign: 'left' },     // Particulars
      4: { cellWidth: 'auto', halign: 'right' }, // Bill Amount
      5: { cellWidth: 'auto', halign: 'right' }, // GST
      6: { cellWidth: 'auto', halign: 'right' }, // Total Amount
      7: { cellWidth: 'auto', halign: 'right' }, // TDS
      8: { cellWidth: 'auto', halign: 'right' }, // Paid Amount
      9: { cellWidth: 'auto', halign: 'right' }  // Balance
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      minCellHeight: 8,
      valign: 'middle'
    },
    didParseCell: function (data) {
      // Make the totals row bold
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
    }
  });

  // Save the PDF
  const fileName = `${selectedClient.name.replace(/\s+/g, '_')}_Summary_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);

  return { success: true };
};

const exportDetailed = (invoices, customers, payments, stats) => {
  // This will export a comprehensive JSON with all data
  const detailedData = {
    reportInfo: {
      generatedAt: new Date().toISOString(),
      reportType: "Detailed Business Report",
      totalRecords: {
        invoices: invoices?.length || 0,
        customers: customers?.length || 0,
        payments: payments?.length || 0,
      },
    },
    summary: {
      totalRevenue: stats?.totalRevenue || 0,
      totalInvoices: stats?.totalInvoices || 0,
      totalCustomers: stats?.totalCustomers || 0,
      paidInvoices: stats?.paidInvoices || 0,
      unpaidInvoices: stats?.unpaidInvoices || 0,
      paymentRate: stats?.paymentRate || 0,
    },
    invoices: invoices || [],
    customers: customers || [],
    payments: payments || [],
  };

  const blob = new Blob([JSON.stringify(detailedData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `detailed_report_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

ReportsAnalytics.propTypes = {
  // Empty propTypes as it currently uses internal state/hooks
};

export default ReportsAnalytics;
