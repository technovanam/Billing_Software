import React, { useState, useMemo } from "react";
import { TrendingUp, CreditCard, ArrowUpRight, DollarSign, RotateCcw, AlertTriangle, BarChart2 } from "lucide-react";
import { usePlatformAnalytics, usePlatformPayments, usePlatformBusinesses } from "../../../hooks/useSuperAdminFirestore";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PERIOD_MONTHS = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 };
const PLAN_COLORS = ["bg-blue-600", "bg-indigo-600", "bg-purple-600", "bg-cyan-600", "bg-emerald-600", "bg-amber-500"];

const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const formatINR = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function RevenueAnalytics() {
  const [period, setPeriod] = useState("6m");
  const { analytics } = usePlatformAnalytics();
  const { payments } = usePlatformPayments();
  const { businesses } = usePlatformBusinesses();

  const revenue = analytics?.revenue || {};
  const metric = (m) => (m ? { value: m.value, sub: m.sub } : { value: "—", sub: "No data yet" });

  const successful = useMemo(
    () => payments.filter((p) => p.status === "Successful" || p.status === "Completed"),
    [payments]
  );
  const refunded = useMemo(() => payments.filter((p) => p.status === "Refunded"), [payments]);

  const revenueKPIs = [
    { label: "Monthly Recurring Revenue (MRR)", ...metric(revenue.mrr) },
    { label: "Total Platform Revenue", ...metric(revenue.arr) },
    { label: "Average Revenue Per Business (ARPU)", ...metric(revenue.arpu) },
    {
      label: "Refund Volume",
      value: formatINR(refunded.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)),
      sub: `${refunded.length} refunded payment${refunded.length === 1 ? "" : "s"}`,
    },
    {
      label: "Payment Success Rate",
      value: payments.length ? `${((successful.length / payments.length) * 100).toFixed(1)}%` : "—",
      sub: `${successful.length} of ${payments.length} payments`,
    },
  ];

  // Successful payment totals per month for the selected period
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const count = PERIOD_MONTHS[period];
    const buckets = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ m: MONTHS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), total: 0 });
    }
    successful.forEach((p) => {
      const d = toDate(p.date || p.createdAt);
      if (!d || isNaN(d)) return;
      const b = buckets.find((x) => x.year === d.getFullYear() && x.month === d.getMonth());
      if (b) b.total += Number(p.amount) || 0;
    });
    const max = Math.max(1, ...buckets.map((b) => b.total));
    return buckets.map((b) => ({ ...b, pct: (b.total / max) * 100 }));
  }, [successful, period]);

  // Successful payment totals grouped by the paying business's plan
  const planBreakdown = useMemo(() => {
    const planByBusiness = Object.fromEntries(businesses.map((b) => [b.id, b.planName || b.plan]));
    const totals = {};
    successful.forEach((p) => {
      const plan = p.planName || planByBusiness[p.businessId] || "Unassigned";
      totals[plan] = (totals[plan] || 0) + (Number(p.amount) || 0);
    });
    const grand = Object.values(totals).reduce((a, b) => a + b, 0);
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount], i) => ({
        name,
        amount: formatINR(amount),
        share: grand ? Math.round((amount / grand) * 100) : 0,
        color: PLAN_COLORS[i % PLAN_COLORS.length],
      }));
  }, [successful, businesses]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Revenue & Billing Analytics</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Subscription ARR tracking, MRR expansion, plan contribution, and transaction health.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200/60 text-xs font-semibold">
          {["1m", "3m", "6m", "1y"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg uppercase transition ${
                period === p ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {revenueKPIs.map((kpi, i) => (
          <div key={i} className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500">{kpi.label}</span>
            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 font-mono">{kpi.value}</div>
              <span className="text-xs font-semibold text-emerald-600">{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Visual Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Monthly Recurring Revenue Trajectory</h3>
          <p className="text-xs text-gray-500 mb-6">Successful payments per month (₹)</p>

          <div className="h-56 flex items-end justify-between gap-3 px-2 border-b border-gray-100 pb-2">
            {monthlyRevenue.map((col, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="w-full flex flex-col items-center justify-end h-full">
                  <div
                    style={{ height: `${col.pct}%` }}
                    className="w-8 bg-blue-600 rounded-t group-hover:bg-blue-700 transition"
                  />
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold text-gray-900 block">{formatINR(col.total)}</span>
                  <span className="text-[10px] text-gray-400">{col.m}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Plan */}
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Revenue Contribution by Plan</h3>
          <p className="text-xs text-gray-500 mb-6">Commercial tier weightage</p>

          <div className="space-y-4">
            {planBreakdown.length === 0 && (
              <p className="text-xs text-gray-400">No successful payments yet.</p>
            )}
            {planBreakdown.map((tier, i) => (
              <div key={i} className="space-y-1 text-xs">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-gray-700">{tier.name}</span>
                  <span className="text-gray-900 font-mono">
                    {tier.amount} <span className="text-gray-400 font-normal">({tier.share}%)</span>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div style={{ width: `${tier.share}%` }} className={`h-full rounded-full ${tier.color}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
