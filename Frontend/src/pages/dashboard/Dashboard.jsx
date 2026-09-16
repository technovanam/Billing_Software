import React, { useMemo, memo } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Receipt,
  TrendingUp,
  CreditCard,
  Package,
  UserCheck,
  FileEdit,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  DollarSign,
  BadgePercent,
} from "lucide-react";
import {
  useDashboard,
  useInvoices,
  useAllPayments,
  useExpenses,
  useProducts,
  useCustomers,
} from "../../hooks/useFirestore";
// Chart Components
import InvoiceStatus from "./InvoiceStatus";

// Main Dashboard Component
const Dashboard = () => {
  const { allInvoices } = useInvoices(); // Use allInvoices for accurate stats
  const { payments } = useAllPayments();
  const { expenses } = useExpenses();
  const { allProducts } = useProducts(); // Get all products, not just paginated view
  const { allCustomers } = useCustomers(); // Get all customers, not just paginated view

  // Calculate stats dynamically from allInvoices
  const stats = useMemo(() => {
    if (!allInvoices) return null;

    const activeInvoices = allInvoices.filter(i => i.status !== 'Cancelled');
    const validInvoices = activeInvoices.filter(i => (i.status || '').toLowerCase() !== 'draft');

    // Total invoices now includes ALL active invoices (including drafts)
    const totalInvoices = activeInvoices.length;

    // Revenue = Sum of all amounts actually received (paidAmount or received field)
    // This represents actual money received, not invoiced amounts
    const totalRevenue = activeInvoices.reduce((sum, inv) => {
      const received = Number(inv.paidAmount || inv.received || 0);
      return sum + received;
    }, 0);

    const totalExpenses = (expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    const paidInvoices = activeInvoices.filter(i => (i.status || '').toLowerCase() === 'paid').length;
    const draftInvoices = activeInvoices.filter(i => (i.status || '').toLowerCase() === 'draft').length;

    // Calculate overdue invoices
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueInvoices = activeInvoices.filter(i => {
      const s = (i.status || '').toLowerCase();
      if (s === 'paid' || s === 'draft' || s === 'partial') return false;
      const dueDate = i.dueDate ? new Date(i.dueDate) : null;
      if (dueDate) dueDate.setHours(0, 0, 0, 0);
      return dueDate && today > dueDate;
    }).length;

    // Unpaid includes invoices that are not paid, not draft, and not overdue
    const unpaidInvoices = activeInvoices.filter(i => {
      const s = (i.status || '').toLowerCase();
      if (s === 'paid' || s === 'draft' || s === 'partial') return false;
      const dueDate = i.dueDate ? new Date(i.dueDate) : null;
      if (dueDate) dueDate.setHours(0, 0, 0, 0);
      const isOverdue = dueDate && today > dueDate;
      return !isOverdue;
    }).length;

    const paymentRate = (paidInvoices + unpaidInvoices + draftInvoices + overdueInvoices) > 0
      ? (paidInvoices / (paidInvoices + unpaidInvoices + draftInvoices + overdueInvoices)) * 100
      : 0;

    // Total Customers - count from actual customers collection
    const totalCustomers = allCustomers ? allCustomers.length : 0;

    // Total Bill Amount - sum of all invoice totals (what was billed)
    const totalBillAmount = validInvoices.reduce((sum, inv) => {
      const amount = Number(inv.total || inv.amount || inv.totalAmount || 0);
      return sum + amount;
    }, 0);

    // Total Amount to Receive - outstanding amounts (bill amount - received)
    const totalOutstanding = activeInvoices.reduce((sum, inv) => {
      const total = Number(inv.total || inv.amount || inv.totalAmount || 0);
      const received = Number(inv.paidAmount || inv.received || 0);
      const outstanding = Math.max(0, total - received);
      return sum + outstanding;
    }, 0);

    // GST Collected - sum of SGST, CGST, IGST from paid and partial invoices
    let totalSGST = 0;
    let totalCGST = 0;
    let totalIGST = 0;
    
    activeInvoices.forEach(inv => {
      const status = (inv.status || '').toLowerCase();
      // Only count GST for paid or partial invoices (when payment is received)
      if (status === 'paid' || status === 'partial') {
        totalSGST += Number(inv.sgst || 0);
        totalCGST += Number(inv.cgst || 0);
        totalIGST += Number(inv.igst || 0);
      }
    });

    const totalGST = totalSGST + totalCGST + totalIGST;

    return {
      totalInvoices,
      totalRevenue,
      paidInvoices,
      unpaidInvoices,
      draftInvoices,
      overdueInvoices,
      paymentRate, // Percentage of Paid vs Total
      totalExpenses,
      totalCustomers,
      totalBillAmount,
      totalOutstanding,
      totalGST,
      totalSGST,
      totalCGST,
      totalIGST,
      financialYearLabel: 'Current FY' // Placeholder
    };
  }, [allInvoices, allCustomers, expenses]);

  const memoizedPayments = useMemo(() => payments || [], [payments]);
  const memoizedProducts = useMemo(() => allProducts || [], [allProducts]);
  const memoizedInvoices = useMemo(() => allInvoices || [], [allInvoices]);


  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      {/* Optimized container for laptop/desktop view */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <Header />
        <main className="mt-6 flex flex-col gap-6">
          {/* Stats Grid */}
          <StatsGrid stats={stats} products={memoizedProducts} />

          {/* Bottom Row: Recent Activity and Invoice Status */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <RecentActivity
              invoices={memoizedInvoices}
              payments={memoizedPayments}
            />
            <InvoiceStatus stats={stats} />
          </div>
        </main>
      </div>
    </div>
  );
};

// Header Section
const Header = () => {
  const navigate = useNavigate();

  const handleCreateInvoice = () => {
    navigate("/invoices", { state: { action: "create" } });
  };

  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, Admin!
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Here's what's happening with your business today.
        </p>
      </div>
      <div className="flex items-center gap-2 mt-3 sm:mt-0">
        <button
          onClick={handleCreateInvoice}
          className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Invoice
        </button>
      </div>
    </header>
  );
};

// Grid of Statistical Cards - Memoized to prevent unnecessary re-renders
const StatsGrid = memo(({ stats, products }) => {
  // Handle null stats gracefully
  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 lg:gap-6">
        <StatCard
          title="Total Invoice"
          value="0"
          icon={<Receipt className="text-blue-600" />}
        />
        <StatCard
          title="Total Revenue"
          value="₹0"
          icon={<TrendingUp className="text-green-500" />}
        />
        <StatCard
          title="Payment Status"
          value="0"
          valueLabel="Paid (0.0%)"
          secondaryValue="0"
          secondaryValueLabel="Unpaid"
          isSecondaryValueRed={false}
          icon={<CreditCard className="text-emerald-600" />}
          footer={
            <div className="w-full h-2 rounded-full mt-2 overflow-hidden flex">
              <div className="h-2 bg-gray-200 flex-1"></div>
            </div>
          }
        />
        <StatCard
          title="Total Products"
          value="0"
          icon={<Package className="text-purple-600" />}
        />
      </div>
    );
  }

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 lg:gap-6">
      {/* Row 1: Total Bill Amount, Total Amount to Receive, Total Revenue [Received] */}
      <StatCard
        title="Total Bill Amount"
        value={formatCurrency(stats.totalBillAmount)}
        icon={<DollarSign className="text-blue-500" />}
        subtext={stats?.financialYearLabel}
        subtextColor="blue"
      />
      <StatCard
        title="Total Amount to Receive"
        value={formatCurrency(stats.totalOutstanding)}
        icon={<TrendingUp className="text-red-500" />}
        subtext={stats?.financialYearLabel}
        subtextColor="blue"
      />
      <StatCard
        title="Total Revenue [Received]"
        value={formatCurrency(stats?.totalRevenue || 0)}
        icon={<TrendingUp className="text-green-500" />}
        subtext={stats?.financialYearLabel}
        subtextColor="green"
      />
      
      {/* Row 2: Total Expenses, Total GST, Payment Status */}
      <StatCard
        title="Total Expenses"
        value={formatCurrency(stats.totalExpenses)}
        icon={<Coins className="text-orange-500" />}
        footer={
          <div className="flex items-center gap-2 body-text-small">
            <span className="bg-orange-600 text-white px-2 py-0.5 rounded-full font-medium">
              Expenses
            </span>
            <span className="text-slate-500">Current FY</span>
          </div>
        }
      />
      <StatCard
        title="Total GST Collected"
        value={formatCurrency(stats.totalSGST)}
        valueLabel="SGST"
        secondaryValue={formatCurrency(stats.totalCGST)}
        secondaryValueLabel="CGST"
        icon={<BadgePercent className="text-purple-600" />}
        footer={
          <div className="w-full h-2 rounded-full mt-2 overflow-hidden flex bg-gray-200">
            {stats.totalGST > 0 && (
              <>
                {stats.totalSGST > 0 && (
                  <div
                    className="h-2 bg-purple-500"
                    style={{ width: `${(stats.totalSGST / stats.totalGST) * 100}%` }}
                    title={`SGST: ${formatCurrency(stats.totalSGST)}`}
                  ></div>
                )}
                {stats.totalCGST > 0 && (
                  <div
                    className="h-2 bg-indigo-500"
                    style={{ width: `${(stats.totalCGST / stats.totalGST) * 100}%` }}
                    title={`CGST: ${formatCurrency(stats.totalCGST)}`}
                  ></div>
                )}
                {stats.totalIGST > 0 && (
                  <div
                    className="h-2 bg-blue-500"
                    style={{ width: `${(stats.totalIGST / stats.totalGST) * 100}%` }}
                    title={`IGST: ${formatCurrency(stats.totalIGST)}`}
                  ></div>
                )}
              </>
            )}
          </div>
        }
      />
      <StatCard
        title="Payment Status"
        value={formatNumber(stats?.paidInvoices || 0)}
        valueLabel={`Paid (${(stats?.paymentRate || 0).toFixed(1)}%)`}
        secondaryValue={formatNumber(stats?.unpaidInvoices || 0)}
        secondaryValueLabel="Unpaid"
        isSecondaryValueRed={(stats?.unpaidInvoices || 0) > 0}
        icon={<CreditCard className="text-emerald-600" />}
        footer={
          <div className="w-full h-2 rounded-full mt-2 overflow-hidden flex">
            {/* Paid portion - Green */}
            <div
              className="h-2 bg-green-500"
              style={{ width: `${stats?.paymentRate || 0}%` }}
            ></div>
            {/* Unpaid portion - Red */}
            <div
              className="h-2 bg-red-500 flex-1"
              style={{ width: `${100 - (stats?.paymentRate || 0)}%` }}
            ></div>
          </div>
        }
      />
      
      {/* Row 3: Total Invoice, Total Customers, Total Products */}
      <StatCard
        title="Total Invoice"
        value={formatNumber(stats?.totalInvoices || 0)}
        icon={<Receipt className="text-blue-600" />}
        subtext={stats?.financialYearLabel}
        subtextColor="blue"
      />
      <StatCard
        title="Total Customers"
        value={formatNumber(stats?.totalCustomers || 0)}
        icon={<UserCheck className="text-indigo-600" />}
      />
      <StatCard
        title="Total Products"
        value={formatNumber(products ? products.length : 0)}
        icon={<Package className="text-purple-600" />}
      />
    </div>
  );
});

StatsGrid.displayName = "StatsGrid";

StatsGrid.propTypes = {
  stats: PropTypes.shape({
    totalInvoices: PropTypes.number,
    totalRevenue: PropTypes.number,
    paidInvoices: PropTypes.number,
    unpaidInvoices: PropTypes.number,
    overdueInvoices: PropTypes.number,
    totalCustomers: PropTypes.number,
    paymentRate: PropTypes.number,
    draftInvoices: PropTypes.number,
    totalExpenses: PropTypes.number,
    totalBillAmount: PropTypes.number,
    totalOutstanding: PropTypes.number,
    totalGST: PropTypes.number,
    totalSGST: PropTypes.number,
    totalCGST: PropTypes.number,
    totalIGST: PropTypes.number,
    financialYearLabel: PropTypes.string,
  }),
  products: PropTypes.array,
};

// Reusable Stat Card Component with modern styling
const StatCard = ({
  title,
  value,
  valueLabel,
  secondaryValue,
  secondaryValueLabel,
  change,
  changeType,
  period,
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
              className={`text-xs mt-0.5 ${valueLabel.includes("Paid") ? "text-green-600" : "text-gray-500"
                }`}
            >
              {valueLabel}
            </p>
          )}
        </div>
        {secondaryValue && (
          <div className="text-right">
            <p
              className={`text-xl font-bold ${isSecondaryValueRed ? "text-red-600" : "text-gray-900"
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
      {change && (
        <div className="flex items-center text-xs mt-2">
          <span
            className={`flex items-center font-semibold ${changeType === "increase" ? "text-green-600" : "text-red-600"
              }`}
          >
            {changeType === "increase" ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {change}
          </span>
          <span className="text-gray-500 ml-1">{period}</span>
        </div>
      )}
      {subtext && (
        <div className="flex items-center gap-2 body-text-small mt-2">
          <span className={`${subtextColor === "blue" ? "bg-blue-600" : "bg-green-600"} text-white px-2 py-0.5 rounded-full font-medium`}>
            {subtext}
          </span>
        </div>
      )}
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  </div>
);

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  valueLabel: PropTypes.string,
  secondaryValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  secondaryValueLabel: PropTypes.string,
  change: PropTypes.string,
  changeType: PropTypes.string,
  period: PropTypes.string,
  subtext: PropTypes.string,
  subtextColor: PropTypes.string,
  icon: PropTypes.node,
  footer: PropTypes.node,
  isSecondaryValueRed: PropTypes.bool,
};

// Recent Activity List using real data - Memoized to prevent unnecessary re-renders
const RecentActivity = memo(({ invoices = [], payments = [] }) => {
  // Generate recent activities from real data
  const generateRecentActivities = () => {
    const activities = [];

    // Ensure we have arrays to work with
    const safeInvoices = Array.isArray(invoices) ? invoices : [];
    const safePayments = Array.isArray(payments) ? payments : [];

    // Add recent invoices with better status handling
    const recentInvoices = [...safeInvoices]
      .sort((a, b) => {
        // Get activity date for invoice A
        let dateA;
        if (a.status === "Paid" || a.status === "paid") {
          dateA = new Date(a.paymentDate || a.updatedAt?.toDate?.() || a.updatedAt || a.createdAt?.toDate?.() || a.createdAt || a.invoiceDate || 0);
        } else if (a.status === "Draft" || a.status === "draft") {
          dateA = new Date(a.updatedAt?.toDate?.() || a.updatedAt || a.createdAt?.toDate?.() || a.createdAt || a.invoiceDate || 0);
        } else {
          dateA = new Date(a.createdAt?.toDate?.() || a.createdAt || a.invoiceDate || 0);
        }

        // Get activity date for invoice B
        let dateB;
        if (b.status === "Paid" || b.status === "paid") {
          dateB = new Date(b.paymentDate || b.updatedAt?.toDate?.() || b.updatedAt || b.createdAt?.toDate?.() || b.createdAt || b.invoiceDate || 0);
        } else if (b.status === "Draft" || b.status === "draft") {
          dateB = new Date(b.updatedAt?.toDate?.() || b.updatedAt || b.createdAt?.toDate?.() || b.createdAt || b.invoiceDate || 0);
        } else {
          dateB = new Date(b.createdAt?.toDate?.() || b.createdAt || b.invoiceDate || 0);
        }

        return dateB - dateA;
      })
      .slice(0, 4);

    recentInvoices.forEach((inv) => {
      // Use the appropriate date based on the action/status
      let activityDate;
      let action, color;

      if (inv.status === "Paid" || inv.status === "paid") {
        // For paid invoices, use the payment date (when it was marked as paid)
        activityDate = new Date(
          inv.paymentDate || inv.updatedAt?.toDate?.() || inv.updatedAt || inv.createdAt?.toDate?.() || inv.createdAt || inv.invoiceDate
        );
        action = "marked as paid";
        color = "bg-green-500";
      } else if (inv.status === "Draft" || inv.status === "draft") {
        // For drafts, use the last updated date (when it was saved/modified)
        activityDate = new Date(
          inv.updatedAt?.toDate?.() || inv.updatedAt || inv.createdAt?.toDate?.() || inv.createdAt || inv.invoiceDate
        );
        action = "saved as draft";
        color = "bg-yellow-500";
      } else {
        // For created/unpaid invoices, use the creation date
        activityDate = new Date(
          inv.createdAt?.toDate?.() || inv.createdAt || inv.invoiceDate
        );
        action = "created";
        color = "bg-blue-500";
      }

      const timeAgo = getTimeAgo(activityDate);
      const clientName = inv.client?.name ? ` for ${inv.client.name}` : "";

      activities.push({
        text: `Invoice #${inv.invoiceNumber} ${action}${clientName}`,
        time: timeAgo,
        color: color,
        timestamp: activityDate,
        type: "invoice",
      });
    });

    // Add recent payments
    const recentPayments = [...safePayments]
      .sort((a, b) => {
        const dateA = new Date(
          a.createdAt?.toDate?.() || a.createdAt || a.paymentDate || 0
        );
        const dateB = new Date(
          b.createdAt?.toDate?.() || b.createdAt || b.paymentDate || 0
        );
        return dateB - dateA;
      })
      .slice(0, 3);

    recentPayments.forEach((payment) => {
      const paymentDate = new Date(
        payment.createdAt?.toDate?.() ||
        payment.createdAt ||
        payment.paymentDate ||
        new Date()
      );
      const timeAgo = getTimeAgo(paymentDate);
      const invoice = safeInvoices.find((inv) => inv.id === payment.invoiceId);

      activities.push({
        text: `Payment ₹${payment.amount?.toLocaleString("en-IN") || "0"
          } received${invoice ? ` for Invoice #${invoice.invoiceNumber}` : ""}${payment.method ? ` via ${payment.method}` : ""
          }`,
        time: timeAgo,
        color: "bg-green-500",
        timestamp: paymentDate,
        type: "payment",
      });
    });

    // Sort all activities by actual timestamp and take the most recent 5
    return [...activities].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  };

  const getDiffs = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return { diffMs, diffMins, diffHours, diffDays };
  };

  const getTimeAgo = (date) => {
    if (!date || Number.isNaN(date.getTime())) return "Unknown";

    const { diffMs, diffMins, diffHours, diffDays } = getDiffs(date);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMs < 0) return "In the future";
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
    return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  };

  const activities = generateRecentActivities();

  return (
    <div className="bg-white p-4 lg:p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        Recent Activity
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Latest updates and notifications
      </p>
      <ul className="space-y-2">
        {activities.length > 0 ? (
          activities.map((activity, index) => (
            <li
              key={`${activity.type}-${activity.timestamp.getTime()}-${index}`}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50"
            >
              <div
                className={`w-2 h-2 ${activity.color} rounded-full mt-1.5 flex-shrink-0`}
              ></div>
              <div>
                <p className="body-text text-gray-800">{activity.text}</p>
                <p className="body-text-small text-slate-400">
                  {activity.time}
                </p>
              </div>
            </li>
          ))
        ) : (
          <li className="flex items-start gap-3 p-3 rounded-lg">
            <div className="w-2 h-2 bg-gray-300 rounded-full mt-1.5 flex-shrink-0"></div>
            <div>
              <p className="body-text text-gray-500">No recent activity</p>
              <p className="body-text-small text-slate-400">
                Activity will appear here as you use the system
              </p>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
});

RecentActivity.displayName = "RecentActivity";

RecentActivity.propTypes = {
  invoices: PropTypes.array,
  payments: PropTypes.array,
};

// ...existing code...

export default Dashboard;
