import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { superAdminService } from "../../../services/superAdminDataService";
import { usePlatformBusinesses, usePlatformInvoices, usePlatformPayments } from "../../../hooks/useSuperAdminFirestore";
import {
  Building2,
  Users,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Smartphone,
  ChevronRight,
  Layers,
  ArrowRight,
  Activity,
  AlertOctagon,
  DollarSign,
  Receipt,
} from "lucide-react";

export default function SuperAdminDashboard() {
  const [timeRange, setTimeRange] = useState("30d");
  const navigate = useNavigate();

  // Dynamic values from live Firestore hooks
  const { businesses, loading: businessesLoading } = usePlatformBusinesses();
  const { invoices, loading: invoicesLoading } = usePlatformInvoices();
  const { payments, loading: paymentsLoading } = usePlatformPayments();

  // Mock data for unimplemented platform features
  const tickets = useMemo(() => superAdminService.getTickets(), []);
  const auditLogs = useMemo(() => superAdminService.getAuditLogs(), []);
  const plans = useMemo(() => superAdminService.getPlans(), []);

  // Compute stats
  const activeCount = businesses.filter((b) => b.status === "Active").length;
  const trialCount = businesses.filter((b) => b.status === "Trial").length;
  const suspendedCount = businesses.filter((b) => b.status === "Suspended").length;
  
  // Calculate total invoice revenue
  const totalRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.amount || inv.total) || 0), 0);
  
  // Platform users count (sum of all tenant users)
  const totalUsers = businesses.reduce((sum, bus) => sum + (Number(bus.usersCount) || 1), 0);
  
  const failedPaymentsCount = payments.filter((p) => p.status === "Failed").length;

  const kpis = [
    {
      label: "Total Businesses",
      value: businessesLoading ? "..." : businesses.length.toString(),
      sub: "Platform total",
      pillText: "All Tenants",
      pillClass: "bg-blue-600 text-white",
      icon: Building2,
      iconColor: "text-blue-600",
      link: "/super-admin/businesses",
    },
    {
      label: "Active Businesses",
      value: businessesLoading ? "..." : activeCount.toString(),
      sub: "Healthy tenant fleet",
      pillText: "Active Fleet",
      pillClass: "bg-emerald-600 text-white",
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      link: "/super-admin/businesses?status=Active",
    },
    {
      label: "Trial Businesses",
      value: businessesLoading ? "..." : trialCount.toString(),
      sub: "Active 14-day trials",
      pillText: "14-Day Trials",
      pillClass: "bg-amber-500 text-white",
      icon: Clock,
      iconColor: "text-amber-500",
      link: "/super-admin/businesses?status=Trial",
    },
    {
      label: "Suspended Businesses",
      value: businessesLoading ? "..." : suspendedCount.toString(),
      sub: "Overdue / Action required",
      pillText: "Suspended",
      pillClass: "bg-rose-500 text-white",
      icon: XCircle,
      iconColor: "text-rose-500",
      link: "/super-admin/businesses?status=Suspended",
    },
    {
      label: "Total Platform Users",
      value: businessesLoading ? "..." : totalUsers.toLocaleString(),
      sub: "Across all tenants",
      pillText: "Platform Users",
      pillClass: "bg-purple-600 text-white",
      icon: Users,
      iconColor: "text-purple-600",
      link: "/super-admin/users",
    },
    {
      label: "Total Invoiced (Platform)",
      value: invoicesLoading ? "..." : `₹${totalRevenue.toLocaleString("en-IN")}`,
      sub: "All time total",
      pillText: "Platform Revenue",
      pillClass: "bg-emerald-600 text-white",
      icon: TrendingUp,
      iconColor: "text-emerald-600",
      link: "/super-admin/revenue",
    },
    {
      label: "Total Invoices Created",
      value: invoicesLoading ? "..." : invoices.length.toLocaleString(),
      sub: "Across all counters",
      pillText: "All Terminals",
      pillClass: "bg-blue-600 text-white",
      icon: CreditCard,
      iconColor: "text-blue-600",
      link: "/super-admin/payments",
    },
    {
      label: "Failed Payments",
      value: paymentsLoading ? "..." : failedPaymentsCount.toString(),
      sub: "Attention needed",
      pillText: "Failed Invoices",
      pillClass: "bg-rose-500 text-white",
      icon: AlertTriangle,
      iconColor: "text-rose-500",
      link: "/super-admin/payments",
    },
  ];

  // Subscription Breakdown Data
  const planDistribution = [
    { name: "Professional", count: 512, percent: 41, color: "bg-blue-600" },
    { name: "Starter", count: 342, percent: 27, color: "bg-indigo-600" },
    { name: "Business", count: 218, percent: 18, color: "bg-cyan-600" },
    { name: "Enterprise", count: 92, percent: 7, color: "bg-purple-600" },
    { name: "Free Trial", count: 84, percent: 7, color: "bg-amber-500" },
  ];

  // Recent Activity Feed
  const recentActivities = [
    {
      time: "3:42 PM",
      title: "ABC Traders subscription upgraded",
      desc: "Upgraded from Starter to Professional (Annual Plan)",
      path: "/super-admin/businesses/BUS-00124",
      tag: "Subscription",
      color: "text-blue-700 bg-blue-50 border-blue-200/60",
      dot: "bg-blue-500",
    },
    {
      time: "3:35 PM",
      title: "New business registered",
      desc: "Royal Spices & Dryfruits initiated 14-day free trial",
      path: "/super-admin/businesses/BUS-00127",
      tag: "Onboarding",
      color: "text-emerald-700 bg-emerald-50 border-emerald-200/60",
      dot: "bg-emerald-500",
    },
    {
      time: "3:22 PM",
      title: "Platform payment received",
      desc: "₹49,990 received from Kaveri Supermarket Chain",
      path: "/super-admin/payments",
      tag: "Payment",
      color: "text-cyan-700 bg-cyan-50 border-cyan-200/60",
      dot: "bg-cyan-500",
    },
    {
      time: "3:10 PM",
      title: "Support ticket created",
      desc: "#TCK-4082 opened by Sundar Rajan (Warehouse Quota)",
      path: "/super-admin/support",
      tag: "Support",
      color: "text-amber-700 bg-amber-50 border-amber-200/60",
      dot: "bg-amber-500",
    },
    {
      time: "2:58 PM",
      title: "Business user created",
      desc: "Cashier assigned to POS Terminal 02 at Anna Salai",
      path: "/super-admin/users",
      tag: "Security",
      color: "text-purple-700 bg-purple-50 border-purple-200/60",
      dot: "bg-purple-500",
    },
    {
      time: "2:41 PM",
      title: "Subscription expired",
      desc: "Prime Hardware & Electricals marked past due",
      path: "/super-admin/businesses/BUS-00128",
      tag: "Billing",
      color: "text-rose-700 bg-rose-50 border-rose-200/60",
      dot: "bg-rose-500",
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header with Title and Quick Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Welcome back, Super Admin!
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Here's what's happening with your SaaS platform and tenant fleet today.
          </p>
        </div>

        {/* Global Range Filter (Segmented Pills matching Billing Portal) */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200/60 text-xs font-semibold self-start sm:self-auto">
          {[
            { id: "7d", label: "7 Days" },
            { id: "30d", label: "30 Days" },
            { id: "3m", label: "3 Months" },
            { id: "6m", label: "6 Months" },
            { id: "1y", label: "1 Year" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTimeRange(item.id)}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === item.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Critical Actionable Alerts (Light Badges) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Failed Payments Alert */}
        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900">Failed Payments</h4>
              <p className="text-xs text-rose-700/90 mt-0.5">17 subscription payments failed during billing renewal cycle.</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-rose-100/80 flex items-center justify-between">
            <span className="text-[11px] text-rose-600/80 font-medium">Action Required</span>
            <Link
              to="/super-admin/payments"
              className="text-xs font-bold text-rose-700 hover:text-rose-800 flex items-center gap-1"
            >
              <span>View Payments</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Expiring Subscriptions Alert */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">Expiring Subscriptions</h4>
              <p className="text-xs text-amber-700/90 mt-0.5">32 businesses expire within the next 7 calendar days.</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-amber-100/80 flex items-center justify-between">
            <span className="text-[11px] text-amber-600/80 font-medium">Renewal Campaign</span>
            <Link
              to="/super-admin/subscriptions"
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
            >
              <span>View Subscriptions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* System Alert */}
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-blue-900">Gateway Telemetry</h4>
              <p className="text-xs text-blue-700/90 mt-0.5">Payment gateway API response time is nominal (184ms).</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-100/80 flex items-center justify-between">
            <span className="text-[11px] text-blue-600/80 font-medium">Operational</span>
            <Link
              to="/super-admin/system-health"
              className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View System Health</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 8 Main KPI Cards (Matching exact pattern from user's Billing dashboard screenshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              onClick={() => navigate(kpi.link)}
              className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-sm font-medium text-gray-600">{kpi.label}</h3>
                <div className="p-1 bg-gray-50 rounded-md">
                  <Icon className={`w-5 h-5 flex-shrink-0 ${kpi.iconColor}`} />
                </div>
              </div>

              <div className="mt-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition">
                      {kpi.value}
                    </p>
                    <p className="text-xs mt-0.5 text-gray-500 flex items-center gap-0.5">
                      {kpi.sub}
                      <ArrowUpRight className="w-3 h-3 text-gray-400 group-hover:text-blue-600 transition" />
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-xs mt-2">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${kpi.pillClass}`}>
                    {kpi.pillText}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Primary Visual Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Growth & Velocity */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Business Growth & Tenant Velocity</h3>
              <p className="text-xs text-gray-500 mt-0.5">New merchant onboardings vs active platform retention</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-gray-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Active
              </span>
              <span className="flex items-center gap-1.5 text-gray-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> New
              </span>
              <span className="flex items-center gap-1.5 text-gray-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Churn
              </span>
            </div>
          </div>

          {/* Simulated Chart Bars */}
          <div className="h-64 flex items-end justify-between gap-2 pt-8 pb-2 px-2 border-b border-gray-100">
            {[
              { month: "Apr", active: 82, newBiz: 18, suspended: 2 },
              { month: "May", active: 90, newBiz: 22, suspended: 3 },
              { month: "Jun", active: 104, newBiz: 28, suspended: 2 },
              { month: "Jul", active: 118, newBiz: 34, suspended: 4 },
              { month: "Aug", active: 135, newBiz: 42, suspended: 3 },
              { month: "Sep", active: 158, newBiz: 48, suspended: 5 },
            ].map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="w-full flex items-end justify-center gap-1 h-full">
                  <div
                    style={{ height: `${bar.active}%` }}
                    className="w-4 bg-emerald-500 group-hover:bg-emerald-600 rounded-t transition"
                    title={`Active: ${bar.active * 10}`}
                  />
                  <div
                    style={{ height: `${bar.newBiz}%` }}
                    className="w-4 bg-blue-600 group-hover:bg-blue-700 rounded-t transition"
                    title={`New: ${bar.newBiz * 10}`}
                  />
                  <div
                    style={{ height: `${bar.suspended * 5}%` }}
                    className="w-4 bg-rose-400 group-hover:bg-rose-500 rounded-t transition"
                    title={`Suspended: ${bar.suspended}`}
                  />
                </div>
                <span className="text-[11px] font-semibold text-gray-500 group-hover:text-gray-900 transition">
                  {bar.month}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <span>Aggregated Tenant Lifecycle</span>
            <Link to="/super-admin/businesses" className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold">
              Explore All Businesses <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Subscription Distribution */}
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Subscription Distribution</h3>
            <p className="text-xs text-gray-500 mt-0.5">Distribution across SaaS commercial tiers</p>

            <div className="my-6 space-y-3.5">
              {planDistribution.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-gray-700">{item.name}</span>
                    <span className="text-gray-500">
                      {item.count} <span className="text-[10px] text-gray-400">({item.percent}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div style={{ width: `${item.percent}%` }} className={`h-full rounded-full ${item.color}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">Total Active Subscriptions</span>
            <strong className="text-gray-900 font-bold">1,248</strong>
          </div>
        </div>
      </div>

      {/* Secondary Row: Platform Activity & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Platform Operations Telemetry */}
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h3 className="text-base font-bold text-gray-900 mb-1">Platform Activity Metrics</h3>
          <p className="text-xs text-gray-500 mb-5">Real-time throughput processed across merchants</p>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">Total Invoices Generated</div>
                  <div className="text-[10px] text-gray-400">Past 30 days</div>
                </div>
              </div>
              <strong className="text-sm font-black text-gray-900 font-mono">184,920</strong>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">POS Terminal Transactions</div>
                  <div className="text-[10px] text-gray-400">Fast checkout lanes</div>
                </div>
              </div>
              <strong className="text-sm font-black text-gray-900 font-mono">612,480</strong>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">B2B Purchase Bills</div>
                  <div className="text-[10px] text-gray-400">Vendor procurement</div>
                </div>
              </div>
              <strong className="text-sm font-black text-gray-900 font-mono">42,110</strong>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">Active Concurrent Staff</div>
                  <div className="text-[10px] text-gray-400">Logged in right now</div>
                </div>
              </div>
              <strong className="text-sm font-black text-emerald-600 font-mono">1,489</strong>
            </div>
          </div>
        </div>

        {/* Recent Platform Activity Timeline (Matching Recent Activity pattern from Billing dashboard) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Recent Activity</h3>
              <p className="text-xs text-gray-500 mt-0.5">Latest updates and notifications across tenants</p>
            </div>
            <Link to="/super-admin/audit-logs" className="text-xs font-bold text-blue-600 hover:text-blue-700">
              View Audit Logs →
            </Link>
          </div>

          <div className="space-y-3">
            {recentActivities.map((act, idx) => (
              <div
                key={idx}
                onClick={() => navigate(act.path)}
                className="p-3 rounded-xl bg-slate-50/60 hover:bg-slate-100/80 border border-slate-100 transition cursor-pointer flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${act.dot} flex-shrink-0`} />
                  <span className="text-[11px] font-mono font-semibold text-gray-400 flex-shrink-0 w-16">{act.time}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition truncate">
                      {act.title}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">{act.desc}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${act.color}`}>{act.tag}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-700 transition" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
