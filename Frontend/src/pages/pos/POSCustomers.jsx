import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Users,
  Receipt,
  Phone,
  Calendar,
  IndianRupee,
  Eye,
  ShoppingBag,
  Clock,
  ArrowRight,
  Filter,
  CheckCircle2,
  X,
  TrendingUp,
  DollarSign,
  Coins,
  CreditCard,
  UserCheck,
  Package,
  Zap,
  Plus,
} from "lucide-react";
import { useInvoices, useCustomers, useProducts } from "../../hooks/useFirestore";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import ThermalReceipt from "./ThermalReceipt";

// Reusable Stat Card Component matching Dashboard.jsx exactly
const StatCard = ({
  title,
  value,
  valueLabel,
  secondaryValue,
  secondaryValueLabel,
  subtext,
  subtextColor = "green",
  icon,
  footer,
  isSecondaryValueRed,
}) => (
  <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
    <div className="flex justify-between items-start mb-2">
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      <div className="p-1 bg-gray-50 rounded-md">{icon}</div>
    </div>
    <div className="mt-1">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {valueLabel && (
            <p
              className={`text-xs mt-0.5 ${
                valueLabel.includes("Paid") || valueLabel.includes("Collection")
                  ? "text-green-600"
                  : "text-gray-500"
              }`}
            >
              {valueLabel}
            </p>
          )}
        </div>
        {secondaryValue && (
          <div className="text-right">
            <p
              className={`text-xl font-bold ${
                isSecondaryValueRed ? "text-red-600" : "text-gray-900"
              }`}
            >
              {secondaryValue}
            </p>
            {secondaryValueLabel && (
              <p className="text-xs mt-0.5 text-gray-500">
                {secondaryValueLabel}
              </p>
            )}
          </div>
        )}
      </div>
      {subtext && (
        <div className="flex items-center gap-2 body-text-small mt-2">
          <span
            className={`${
              subtextColor === "blue" ? "bg-blue-600" : "bg-green-600"
            } text-white px-2 py-0.5 rounded-full font-medium`}
          >
            {subtext}
          </span>
        </div>
      )}
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  </div>
);

export default function POSCustomers() {
  const navigate = useNavigate();
  const { allInvoices, loading: invoicesLoading } = useInvoices();
  const { allCustomers: registeredCustomers, loading: customersLoading } = useCustomers();
  const { products } = useProducts();
  const { companyProfile } = useCompanyProfile();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [viewingBill, setViewingBill] = useState(null);

  // Extract and aggregate all customers who visited / have bills from invoices
  const customerList = useMemo(() => {
    const map = new Map();

    // 1. Process all invoices (both POS bills and sales invoices)
    (allInvoices || []).forEach((inv) => {
      if (!inv) return;

      const clientObj = inv.client || {};
      const rawName =
        inv.customerName ||
        clientObj.name ||
        clientObj.clientName ||
        inv.clientName ||
        "Walk-in Customer";

      const rawPhone =
        inv.customerPhone ||
        clientObj.phone ||
        clientObj.mobile ||
        inv.phone ||
        "";

      // Normalization key: phone if present, else normalized name
      const cleanPhone = String(rawPhone || "").replace(/[^0-9]/g, "");
      const key =
        cleanPhone && cleanPhone.length >= 7
          ? `phone_${cleanPhone}`
          : `name_${rawName.toLowerCase().trim()}`;

      const invAmount = Number(
        inv.totalAmount || inv.amount || inv.total || 0
      );

      let invoiceDateStr = "Recent";
      let invoiceDateObj = new Date();
      if (inv.invoiceDate) {
        if (typeof inv.invoiceDate?.toDate === "function") {
          invoiceDateObj = inv.invoiceDate.toDate();
          invoiceDateStr = invoiceDateObj.toLocaleDateString("en-GB");
        } else if (typeof inv.invoiceDate === "string") {
          invoiceDateStr = inv.invoiceDate.split("T")[0];
          invoiceDateObj = new Date(inv.invoiceDate);
        }
      } else if (inv.createdAt) {
        if (typeof inv.createdAt?.toDate === "function") {
          invoiceDateObj = inv.createdAt.toDate();
          invoiceDateStr = invoiceDateObj.toLocaleDateString("en-GB");
        }
      }

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: rawName,
          phone: rawPhone || "-",
          totalPaid: 0,
          billsCount: 0,
          lastVisit: invoiceDateStr,
          lastVisitDateObj: invoiceDateObj,
          bills: [],
        });
      }

      const existing = map.get(key);
      existing.totalPaid += invAmount;
      existing.billsCount += 1;
      if (invoiceDateObj > existing.lastVisitDateObj) {
        existing.lastVisit = invoiceDateStr;
        existing.lastVisitDateObj = invoiceDateObj;
      }

      // Add bill details
      existing.bills.push({
        id: inv.id || `inv_${Math.random().toString(36).substr(2, 6)}`,
        invoiceNumber: inv.invoiceNumber || inv.billNo || "INV-001",
        date: invoiceDateStr,
        dateObj: invoiceDateObj,
        amount: invAmount,
        paymentMode: inv.paymentMode || "Cash",
        itemsCount: Array.isArray(inv.items) ? inv.items.length : 0,
        items: inv.items || [],
        cgst: inv.cgst || 2.5,
        sgst: inv.sgst || 2.5,
        cgstAmount: inv.cgstAmount || 0,
        sgstAmount: inv.sgstAmount || 0,
        subtotal: inv.subtotal || invAmount * 0.95,
        cashier: inv.cashier || "CSH-001",
        rawInvoice: inv,
      });
    });

    // 2. Also ensure registered customers in database are listed
    (registeredCustomers || []).forEach((c) => {
      const cleanPhone = String(c.phone || c.mobile || "").replace(/[^0-9]/g, "");
      const key =
        cleanPhone && cleanPhone.length >= 7
          ? `phone_${cleanPhone}`
          : `name_${(c.name || c.clientName || "").toLowerCase().trim()}`;

      if (!map.has(key) && (c.name || c.clientName)) {
        map.set(key, {
          id: key,
          name: c.name || c.clientName,
          phone: c.phone || c.mobile || "-",
          totalPaid: Number(c.totalRevenue || c.amountPaid || 0),
          billsCount: Number(c.totalInvoices || 0),
          lastVisit: "Registered",
          lastVisitDateObj: new Date(0),
          bills: [],
        });
      }
    });

    // Sort by most recent visits or highest spending
    return Array.from(map.values()).sort(
      (a, b) => b.lastVisitDateObj - a.lastVisitDateObj
    );
  }, [allInvoices, registeredCustomers]);

  // Summary Metrics calculated from active customer & invoice data
  const summaryMetrics = useMemo(() => {
    const totalRev = customerList.reduce((acc, c) => acc + (c.totalPaid || 0), 0);
    const totalInvoicesCount = customerList.reduce((acc, c) => acc + (c.billsCount || 0), 0);
    const totalCustCount = customerList.length;

    // Split cash vs online
    let cashSum = 0;
    let onlineSum = 0;
    (allInvoices || []).forEach((inv) => {
      const amt = Number(inv.totalAmount || inv.amount || 0);
      const mode = (inv.paymentMode || "Cash").toLowerCase();
      if (mode === "cash") {
        cashSum += amt;
      } else {
        onlineSum += amt;
      }
    });

    const cashRate = totalRev > 0 ? (cashSum / totalRev) * 100 : 100;

    return {
      totalRev,
      totalInvoicesCount,
      totalCustCount,
      cashSum,
      onlineSum,
      cashRate,
    };
  }, [customerList, allInvoices]);

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customerList;
    const q = searchTerm.toLowerCase().trim();
    return customerList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.bills.some((b) => b.invoiceNumber.toLowerCase().includes(q))
    );
  }, [customerList, searchTerm]);

  // Handle viewing specific bill
  const handleOpenBillReceipt = (bill) => {
    const raw = bill.rawInvoice || {};
    const formattedBillData = {
      billNo: bill.invoiceNumber,
      billDate: bill.dateObj || new Date(),
      cashier: bill.cashier || "CSH-001",
      customerName: raw.client?.name || raw.customerName || selectedCustomer?.name || "Customer",
      customerPhone: raw.client?.phone || raw.customerPhone || selectedCustomer?.phone || "",
      items: bill.items.length > 0 ? bill.items : [{ name: "General Retail Items", qty: 1, rate: bill.amount, total: bill.amount }],
      totalItems: bill.items.length || 1,
      totalQty: bill.items.reduce((sum, it) => sum + (Number(it.qty) || 1), 0) || 1,
      subtotal: bill.subtotal || bill.amount * 0.95,
      cgstRate: bill.cgst || 2.5,
      sgstRate: bill.sgst || 2.5,
      cgstAmount: bill.cgstAmount || (bill.amount * 0.025),
      sgstAmount: bill.sgstAmount || (bill.amount * 0.025),
      cessAmount: 0,
      roundOff: raw.roundOff || 0,
      totalAmount: bill.amount,
      paymentMode: bill.paymentMode || "Cash",
      cashReceived: bill.amount,
      balancePaid: 0,
      onlinePaymentDetails: raw.onlinePaymentDetails || null,
    };

    setViewingBill(formattedBillData);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-IN").format(num || 0);
  };

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      {/* Optimized container matching Admin Dashboard layout */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        
        {/* ================= HEADER SECTION (Matching Admin Dashboard) ================= */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, Cashier!
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Here's what's happening with your store customers and billing today.
            </p>
          </div>
        </header>

        {/* ================= STATS GRID (Matching Admin Dashboard Style) ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 lg:gap-6 mb-6">
          {/* Card 1: Total Customer Revenue */}
          <StatCard
            title="Total Revenue Collected"
            value={formatCurrency(summaryMetrics.totalRev)}
            icon={<TrendingUp className="text-emerald-500 w-5 h-5" />}
            subtext="Counter Collections"
            subtextColor="green"
          />

          {/* Card 2: Total Customers */}
          <StatCard
            title="Total Customers"
            value={formatNumber(summaryMetrics.totalCustCount)}
            icon={<UserCheck className="text-indigo-600 w-5 h-5" />}
            subtext="Visited Customers"
            subtextColor="blue"
          />

          {/* Card 3: Total Invoices & Bills */}
          <StatCard
            title="Total Invoices / Bills"
            value={formatNumber(summaryMetrics.totalInvoicesCount)}
            icon={<Receipt className="text-blue-600 w-5 h-5" />}
            footer={
              <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                <span>Cash: {formatCurrency(summaryMetrics.cashSum)}</span>
                <span>UPI: {formatCurrency(summaryMetrics.onlineSum)}</span>
              </div>
            }
          />
        </div>

        {/* ================= MAIN CONTENT SPLIT (Matching Admin Dashboard Grid) ================= */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* LEFT 7-COL: Customers Table List */}
          <div className="xl:col-span-7 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
            {/* Table Header with Search */}
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Customers Directory ({filteredCustomers.length})
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Click any customer row to review their individual bills
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name or phone..."
                  className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-8 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Customers Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center">#</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4 text-center">Bills Count</th>
                    <th className="py-3 px-4 text-right">Total Spent</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-gray-400">
                        <Users className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                        <p className="font-semibold text-gray-700">No Customers Found</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {searchTerm ? "No customer matches your search criteria" : "Customer records will appear here as bills are generated."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((cust, idx) => {
                      const isSelected = selectedCustomer?.id === cust.id;
                      return (
                        <tr
                          key={cust.id}
                          onClick={() => setSelectedCustomer(cust)}
                          className={`cursor-pointer transition-colors duration-150 ${
                            isSelected
                              ? "bg-blue-50/70 border-l-4 border-l-blue-600 font-medium"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="py-3 px-4 text-center text-gray-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {cust.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate">{cust.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600 font-mono text-[11px]">
                            {cust.phone}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                              {cust.billsCount} bills
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900">
                            ₹{cust.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomer(cust);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-200 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>View Bills</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT 5-COL: Customer Details & Purchase History (Matching Recent Activity & Invoice Status style) */}
          <div className="xl:col-span-5 flex flex-col gap-6">
            {selectedCustomer ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
                {/* Customer Profile Header */}
                <div className="p-5 border-b border-gray-200 bg-gray-900 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800/50">
                        Customer Profile
                      </span>
                      <h3 className="text-lg font-bold mt-1 text-white truncate">
                        {selectedCustomer.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-300 font-mono">
                        <Phone className="h-3.5 w-3.5 text-blue-400" />
                        <span>{selectedCustomer.phone}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">Total Spent</p>
                      <p className="text-xl font-bold text-emerald-400">
                        ₹{selectedCustomer.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Customer Bills List */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
                      <Receipt className="h-4 w-4 text-blue-600" />
                      <span>Past Invoices ({selectedCustomer.bills.length})</span>
                    </h4>
                    <span className="text-[10px] text-gray-500">Most Recent First</span>
                  </div>

                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {selectedCustomer.bills.length === 0 ? (
                      <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <p className="text-xs text-gray-500 font-medium">No recorded bills found for this customer.</p>
                      </div>
                    ) : (
                      selectedCustomer.bills.map((bill) => (
                        <div
                          key={bill.id}
                          className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/60 hover:bg-white hover:border-blue-400 hover:shadow-xs transition flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-gray-900">
                                #{bill.invoiceNumber}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-gray-200 text-gray-700">
                                {bill.paymentMode}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-gray-400" />
                                <span>{bill.date}</span>
                              </span>
                              <span>•</span>
                              <span>{bill.itemsCount} items</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end">
                            <p className="text-sm font-bold text-gray-900">
                              ₹{bill.amount.toFixed(2)}
                            </p>
                            <button
                              onClick={() => handleOpenBillReceipt(bill)}
                              className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-xs"
                            >
                              <Receipt className="h-3 w-3" />
                              <span>View Receipt</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 text-center flex flex-col items-center justify-center min-h-[300px]">
                <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-3">
                  <Receipt className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900">Select a Customer</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">
                  Click on any customer in the table to view their purchase history, bill date, and thermal receipts.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bill Thermal Receipt Modal */}
      {viewingBill && (
        <ThermalReceipt
          billData={viewingBill}
          companyProfile={companyProfile}
          onClose={() => setViewingBill(null)}
        />
      )}
    </div>
  );
}

