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
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  DollarSign,
  BadgePercent,
  Building2,
  GitBranch,
  Warehouse,
  Smartphone,
} from "lucide-react";
import { ResponsivePie } from "@nivo/pie";
import {
  usePlatformBusinesses,
  usePlatformInvoices,
  usePlatformPayments,
  useAuditLogs,
} from "../../../hooks/useSuperAdminFirestore";

function getFYLabel() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1} FY`;
}

// Reusable Stat Card Component matching exact Billing Dashboard pattern
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
              className={`text-xs mt-0.5 ${
                valueLabel.includes("Paid") || valueLabel.includes("Active")
                  ? "text-green-600"
                  : "text-gray-500"
              }`}
            >
              {valueLabel}
            </p>
          )}
        </div>
        {secondaryValue !== undefined && secondaryValue !== null && (
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
      {change && (
        <div className="flex items-center text-xs mt-2">
          <span
            className={`flex items-center font-semibold ${
              changeType === "increase" ? "text-green-600" : "text-red-600"
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
          <span
            className={`${
              subtextColor === "blue" ? "bg-blue-600" : "bg-green-600"
            } text-white px-2 py-0.5 rounded-full font-medium text-xs`}
          >
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

// 9-Card Stats Grid Component
const StatsGrid = memo(({ stats }) => {
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
        icon={<DollarSign className="text-blue-500 w-5 h-5" />}
        subtext={stats.financialYearLabel}
        subtextColor="blue"
      />
      <StatCard
        title="Total Amount to Receive"
        value={formatCurrency(stats.totalOutstanding)}
        icon={<TrendingUp className="text-red-500 w-5 h-5" />}
        subtext={stats.financialYearLabel}
        subtextColor="blue"
      />
      <StatCard
        title="Total Revenue [Received]"
        value={formatCurrency(stats.totalRevenue)}
        icon={<TrendingUp className="text-green-500 w-5 h-5" />}
        subtext={stats.financialYearLabel}
        subtextColor="green"
      />

      {/* Row 2: Total Expenses, Total GST Collected, Payment Status */}
      <StatCard
        title="Total Expenses"
        value={formatCurrency(stats.totalExpenses)}
        icon={<Coins className="text-orange-500 w-5 h-5" />}
        footer={
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-orange-600 text-white px-2 py-0.5 rounded-full font-medium">
              Expenses
            </span>
            <span className="text-slate-500">{stats.financialYearLabel}</span>
          </div>
        }
      />
      <StatCard
        title="Total GST Collected"
        value={formatCurrency(stats.totalSGST)}
        valueLabel="SGST"
        secondaryValue={formatCurrency(stats.totalCGST)}
        secondaryValueLabel="CGST"
        icon={<BadgePercent className="text-purple-600 w-5 h-5" />}
        footer={
          <div className="w-full h-2 rounded-full mt-2 overflow-hidden flex bg-gray-200">
            {stats.totalGST > 0 ? (
              <>
                <div
                  className="h-2 bg-purple-500"
                  style={{ width: `${(stats.totalSGST / stats.totalGST) * 100}%` }}
                  title={`SGST: ${formatCurrency(stats.totalSGST)}`}
                />
                <div
                  className="h-2 bg-indigo-500"
                  style={{ width: `${(stats.totalCGST / stats.totalGST) * 100}%` }}
                  title={`CGST: ${formatCurrency(stats.totalCGST)}`}
                />
              </>
            ) : (
              <div className="h-2 bg-gray-200 w-full" />
            )}
          </div>
        }
      />
      <StatCard
        title="Payment Status"
        value={formatNumber(stats.paidInvoices)}
        valueLabel={`Paid (${stats.paymentRate.toFixed(1)}%)`}
        secondaryValue={formatNumber(stats.unpaidInvoices)}
        secondaryValueLabel="Unpaid"
        isSecondaryValueRed={stats.unpaidInvoices > 0}
        icon={<CreditCard className="text-emerald-600 w-5 h-5" />}
        footer={
          <div className="w-full h-2 rounded-full mt-2 overflow-hidden flex">
            {/* Paid portion - Green */}
            <div
              className="h-2 bg-green-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, stats.paymentRate))}%` }}
            />
            {/* Unpaid portion - Red */}
            <div
              className="h-2 bg-red-500 flex-1 transition-all duration-300"
              style={{ width: `${Math.max(0, 100 - stats.paymentRate)}%` }}
            />
          </div>
        }
      />

      {/* Row 3: Total Invoice, Total Customers, Total Products */}
      <StatCard
        title="Total Invoice"
        value={formatNumber(stats.totalInvoices)}
        icon={<Receipt className="text-blue-600 w-5 h-5" />}
        subtext={stats.financialYearLabel}
        subtextColor="blue"
      />
      <StatCard
        title="Total Customers"
        value={formatNumber(stats.totalCustomers)}
        icon={<UserCheck className="text-indigo-600 w-5 h-5" />}
      />
      <StatCard
        title="Total Products"
        value={formatNumber(stats.totalProducts)}
        icon={<Package className="text-purple-600 w-5 h-5" />}
      />
    </div>
  );
});

StatsGrid.displayName = "StatsGrid";

StatsGrid.propTypes = {
  stats: PropTypes.shape({
    totalInvoices: PropTypes.number,
    totalRevenue: PropTypes.number,
    totalBillAmount: PropTypes.number,
    totalOutstanding: PropTypes.number,
    totalExpenses: PropTypes.number,
    totalSGST: PropTypes.number,
    totalCGST: PropTypes.number,
    totalGST: PropTypes.number,
    paidInvoices: PropTypes.number,
    unpaidInvoices: PropTypes.number,
    paymentRate: PropTypes.number,
    totalCustomers: PropTypes.number,
    totalProducts: PropTypes.number,
    financialYearLabel: PropTypes.string,
  }).isRequired,
};

// Recent Activity Component
const RecentActivity = memo(({ logs = [], invoices = [] }) => {
  const activities = useMemo(() => {
    const list = [];

    // From audit logs
    if (Array.isArray(logs) && logs.length > 0) {
      logs.slice(0, 5).forEach((log) => {
        const dateObj = log.timestamp?.toDate
          ? log.timestamp.toDate()
          : new Date(log.timestamp || Date.now());
        const timeStr = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        list.push({
          text: `${log.action?.replace(/_/g, " ") || "Event"}: ${log.details || log.target || "Platform event recorded"}`,
          time: timeStr,
          color: log.action?.includes("BUSINESS") ? "bg-blue-500" : log.action?.includes("PAYMENT") ? "bg-green-500" : "bg-purple-500",
          timestamp: dateObj,
        });
      });
    }

    // From invoices if fewer logs
    if (list.length < 5 && Array.isArray(invoices)) {
      invoices.slice(0, 5 - list.length).forEach((inv) => {
        const d = new Date(inv.createdAt?.toDate?.() || inv.createdAt || inv.invoiceDate || Date.now());
        const isPaid = (inv.status || "").toLowerCase() === "paid";
        list.push({
          text: `Invoice #${inv.invoiceNumber || inv.id?.slice(0, 8)} ${isPaid ? "marked as paid" : "created"}${inv.client?.name ? ` for ${inv.client.name}` : ""}`,
          time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          color: isPaid ? "bg-green-500" : "bg-blue-500",
          timestamp: d,
        });
      });
    }

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [logs, invoices]);

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
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div
                className={`w-2 h-2 ${activity.color} rounded-full mt-1.5 flex-shrink-0`}
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{activity.text}</p>
                <p className="text-xs text-slate-400">{activity.time}</p>
              </div>
            </li>
          ))
        ) : (
          <li className="flex items-start gap-3 p-3 rounded-lg">
            <div className="w-2 h-2 bg-gray-300 rounded-full mt-1.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-500">No recent activity</p>
              <p className="text-xs text-slate-400">
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
  logs: PropTypes.array,
  invoices: PropTypes.array,
};

// Invoice Status Breakdown Chart Component
const InvoiceStatusCard = memo(({ stats }) => {
  const paid = stats?.paidInvoices || 0;
  const unpaid = stats?.unpaidInvoices || 0;
  const overdue = stats?.overdueInvoices || 0;
  const draft = stats?.draftInvoices || 0;
  const total = paid + unpaid + overdue + draft;

  const data = useMemo(
    () =>
      [
        { id: "Paid", label: "Paid", value: paid, color: "#22c55e" },
        { id: "Unpaid", label: "Unpaid", value: unpaid, color: "#f97316" },
        ...(overdue > 0
          ? [{ id: "Overdue", label: "Overdue", value: overdue, color: "#ef4444" }]
          : []),
        ...(draft > 0
          ? [{ id: "Draft", label: "Draft", value: draft, color: "#eab308" }]
          : []),
      ].filter((item) => item.value > 0),
    [paid, unpaid, overdue, draft]
  );

  return (
    <div className="bg-white p-4 lg:p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Invoice Status
          </h3>
          <p className="text-sm text-gray-500">
            Breakdown of invoice statuses
          </p>
        </div>
        <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
          {stats?.financialYearLabel}
        </span>
      </div>

      {total === 0 ? (
        <div className="flex justify-center items-center py-16">
          <p className="text-gray-500 text-sm">No invoices yet</p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div style={{ height: 260, width: "100%" }}>
            <ResponsivePie
              data={data}
              margin={{ top: 15, right: 30, bottom: 30, left: 30 }}
              innerRadius={0.55}
              padAngle={0.6}
              cornerRadius={3}
              activeOuterRadiusOffset={6}
              colors={{ datum: "data.color" }}
              enableArcLinkLabels={false}
              arcLabelsSkipAngle={10}
              arcLabelsTextColor="#ffffff"
            />
          </div>
          <div className="flex justify-center gap-4 text-xs font-medium text-slate-600 flex-wrap mt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
              <span>Paid ({paid})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
              <span>Unpaid ({unpaid})</span>
            </div>
            {overdue > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                <span>Overdue ({overdue})</span>
              </div>
            )}
            {draft > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
                <span>Draft ({draft})</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

InvoiceStatusCard.displayName = "InvoiceStatusCard";

InvoiceStatusCard.propTypes = {
  stats: PropTypes.object.isRequired,
};

// Main Super Admin Dashboard matching exact Billing Admin UI pattern
export default function SuperAdminDashboard() {
  const navigate = useNavigate();

  const { businesses = [] } = usePlatformBusinesses();
  const { invoices = [] } = usePlatformInvoices();
  const { payments = [] } = usePlatformPayments();
  const { logs = [], auditLogs = [] } = useAuditLogs();

  const actualBusinesses = Array.isArray(businesses) ? businesses : [];
  const actualInvoices = Array.isArray(invoices) ? invoices : [];
  const actualLogs = Array.isArray(logs) && logs.length > 0 ? logs : Array.isArray(auditLogs) ? auditLogs : [];

  // Calculate stats dynamically from all platform invoices & tenants
  const stats = useMemo(() => {
    const activeInvoices = actualInvoices.filter((i) => i.status !== "Cancelled");
    const validInvoices = activeInvoices.filter(
      (i) => (i.status || "").toLowerCase() !== "draft"
    );

    const totalInvoices = activeInvoices.length;

    const totalRevenue = activeInvoices.reduce((sum, inv) => {
      const received = Number(inv.paidAmount || inv.received || 0);
      return sum + received;
    }, 0);

    const totalBillAmount = validInvoices.reduce((sum, inv) => {
      const amount = Number(inv.total || inv.amount || inv.totalAmount || 0);
      return sum + amount;
    }, 0);

    const totalOutstanding = Math.max(0, totalBillAmount - totalRevenue);

    const paidInvoices = activeInvoices.filter(
      (i) => (i.status || "").toLowerCase() === "paid"
    ).length;
    const draftInvoices = activeInvoices.filter(
      (i) => (i.status || "").toLowerCase() === "draft"
    ).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueInvoices = activeInvoices.filter((i) => {
      const s = (i.status || "").toLowerCase();
      if (s === "paid" || s === "draft" || s === "partial") return false;
      const dueDate = i.dueDate ? new Date(i.dueDate) : null;
      if (dueDate) dueDate.setHours(0, 0, 0, 0);
      return dueDate && today > dueDate;
    }).length;

    const unpaidInvoices = activeInvoices.filter((i) => {
      const s = (i.status || "").toLowerCase();
      if (s === "paid" || s === "draft" || s === "partial") return false;
      const dueDate = i.dueDate ? new Date(i.dueDate) : null;
      if (dueDate) dueDate.setHours(0, 0, 0, 0);
      return !dueDate || today <= dueDate;
    }).length;

    const paymentRate =
      paidInvoices + unpaidInvoices + draftInvoices + overdueInvoices > 0
        ? (paidInvoices / (paidInvoices + unpaidInvoices + draftInvoices + overdueInvoices)) * 100
        : 0;

    let totalSGST = 0;
    let totalCGST = 0;
    let totalIGST = 0;

    activeInvoices.forEach((inv) => {
      const status = (inv.status || "").toLowerCase();
      if (status === "paid" || status === "partial") {
        totalSGST += Number(inv.sgst || 0);
        totalCGST += Number(inv.cgst || 0);
        totalIGST += Number(inv.igst || 0);
      }
    });

    const totalGST = totalSGST + totalCGST + totalIGST;

    // Platform user and product totals
    const totalCustomers = actualBusinesses.reduce(
      (sum, b) => sum + (Number(b?.usersCount) || 1),
      0
    );
    const totalProducts = actualBusinesses.reduce(
      (sum, b) => sum + (Number(b?.productsCount) || 0),
      0
    );

    // Sum of platform operational/subscription expenses or 0
    const totalExpenses = (payments || []).reduce(
      (sum, p) => (p.status === "Refunded" ? sum + Number(p.amount || 0) : sum),
      0
    );

    return {
      totalInvoices,
      totalRevenue,
      paidInvoices,
      unpaidInvoices,
      draftInvoices,
      overdueInvoices,
      paymentRate,
      totalExpenses,
      totalCustomers,
      totalProducts,
      totalBillAmount,
      totalOutstanding,
      totalGST,
      totalSGST,
      totalCGST,
      totalIGST,
      financialYearLabel: getFYLabel(),
    };
  }, [actualInvoices, actualBusinesses, payments]);

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto pb-8">
        {/* Header Section matching Business Portal pattern */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, Admin!
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Here&apos;s what&apos;s happening with your business today.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-3 sm:mt-0">
            <button
              onClick={() => navigate("/super-admin/businesses")}
              className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Create Invoice
            </button>
          </div>
        </header>

        {/* Quick Platform Fleet Nav Strip */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            onClick={() => navigate("/super-admin/businesses")}
            className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-sm hover:border-blue-300 transition-all cursor-pointer flex items-center gap-3"
          >
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase">Businesses</p>
              <p className="text-base font-bold text-slate-900">{actualBusinesses.length}</p>
            </div>
          </div>
          <div
            onClick={() => navigate("/super-admin/branches")}
            className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-sm hover:border-blue-300 transition-all cursor-pointer flex items-center gap-3"
          >
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase">Branches</p>
              <p className="text-base font-bold text-slate-900">
                {actualBusinesses.reduce((s, b) => s + (b.branchesCount || 1), 0)}
              </p>
            </div>
          </div>
          <div
            onClick={() => navigate("/super-admin/godowns")}
            className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-sm hover:border-blue-300 transition-all cursor-pointer flex items-center gap-3"
          >
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Warehouse className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase">Godowns</p>
              <p className="text-base font-bold text-slate-900">
                {actualBusinesses.reduce((s, b) => s + (b.godownsCount || 1), 0)}
              </p>
            </div>
          </div>
          <div
            onClick={() => navigate("/super-admin/pos-terminals")}
            className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-sm hover:border-blue-300 transition-all cursor-pointer flex items-center gap-3"
          >
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase">POS Terminals</p>
              <p className="text-base font-bold text-slate-900">
                {actualBusinesses.reduce((s, b) => s + (b.terminalsCount || 1), 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Main 9-Card Stats Grid (Matching User Screenshot Layout) */}
        <main className="flex flex-col gap-6">
          <StatsGrid stats={stats} />

          {/* Bottom Row: Recent Activity & Invoice Status */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <RecentActivity logs={actualLogs} invoices={actualInvoices} />
            <InvoiceStatusCard stats={stats} />
          </div>
        </main>
      </div>
    </div>
  );
}
