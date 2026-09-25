import React, { useState, useEffect } from "react";
import { usePlatformAnalytics } from "../../../hooks/useSuperAdminFirestore";
import { BarChart3, Building2, Users, CreditCard, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";

const EMPTY_METRIC = { value: "—", sub: "No data yet", subColor: "gray-400" };

export default function PlatformAnalytics() {
  const { analytics: dbAnalytics, loading } = usePlatformAnalytics();
  const [activeTab, setActiveTab] = useState("business"); // business | user | transaction | revenue
  const [dateFilter, setDateFilter] = useState("30d");

  // Empty placeholders until the analytics/platform document is populated
  const [analytics, setAnalytics] = useState({
    business: {
      registered: EMPTY_METRIC,
      activeRetained: EMPTY_METRIC,
      trialConversions: EMPTY_METRIC,
      churnRate: EMPTY_METRIC,
    },
    user: {
      total: EMPTY_METRIC,
      dau: EMPTY_METRIC,
      mau: EMPTY_METRIC,
      sessions: EMPTY_METRIC,
    },
    transaction: {
      invoices: EMPTY_METRIC,
      grossSales: EMPTY_METRIC,
      purchase: EMPTY_METRIC,
      refunds: EMPTY_METRIC,
    },
    revenue: {
      mrr: EMPTY_METRIC,
      arr: EMPTY_METRIC,
      arpu: EMPTY_METRIC,
      refundIncidence: EMPTY_METRIC,
    }
  });

  useEffect(() => {
    if (dbAnalytics) {
      // Merge db analytics with fallback structurally
      setAnalytics(prev => ({
        ...prev,
        ...dbAnalytics
      }));
    }
  }, [dbAnalytics]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Platform Analytics</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Aggregate usage patterns, checkout velocity, and growth across all commerce tiers.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200/60 text-xs font-semibold">
          {["7d", "30d", "3m", "1y"].map((p) => (
            <button
              key={p}
              onClick={() => setDateFilter(p)}
              className={`px-3 py-1.5 rounded-lg uppercase transition ${
                dateFilter === p ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        {[
          { id: "business", label: "Business Analytics", icon: Building2 },
          { id: "user", label: "User Analytics", icon: Users },
          { id: "transaction", label: "Transaction Analytics", icon: CreditCard },
          { id: "revenue", label: "Revenue Analytics", icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 hover:text-gray-900 border border-gray-200 shadow-sm"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Aggregating real-time analytics...</p>
        </div>
      ) : (
        <>
          {/* 1. BUSINESS ANALYTICS */}
          {activeTab === "business" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Total Registered</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.business.registered.value}</div>
                  <span className={`text-xs text-${analytics.business.registered.subColor} font-semibold`}>{analytics.business.registered.sub}</span>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Active Retained</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.business.activeRetained.value}</div>
                  <span className={`text-xs text-${analytics.business.activeRetained.subColor} font-semibold`}>{analytics.business.activeRetained.sub}</span>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Trial Conversions</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.business.trialConversions.value}</div>
                  <span className={`text-xs text-${analytics.business.trialConversions.subColor} font-semibold`}>{analytics.business.trialConversions.sub}</span>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Gross Churn Rate</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.business.churnRate.value}</div>
                  <span className={`text-xs text-${analytics.business.churnRate.subColor} font-semibold`}>{analytics.business.churnRate.sub}</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. USER ANALYTICS */}
          {activeTab === "user" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Total Platform Users</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.user.total.value}</div>
                  <span className={`text-xs text-${analytics.user.total.subColor} font-semibold`}>{analytics.user.total.sub}</span>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Daily Active Users (DAU)</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.user.dau.value}</div>
                  <span className={`text-xs text-${analytics.user.dau.subColor} font-semibold`}>{analytics.user.dau.sub}</span>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Monthly Active Users (MAU)</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.user.mau.value}</div>
                  <span className={`text-xs text-${analytics.user.mau.subColor} font-semibold`}>{analytics.user.mau.sub}</span>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Avg Sessions Per User</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.user.sessions.value}</div>
                  <span className={`text-xs text-${analytics.user.sessions.subColor} font-semibold`}>{analytics.user.sessions.sub}</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. TRANSACTION ANALYTICS */}
          {activeTab === "transaction" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Total B2C & B2B Invoices</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.transaction.invoices.value}</div>
                  <span className={`text-xs text-${analytics.transaction.invoices.subColor} font-semibold`}>{analytics.transaction.invoices.sub}</span>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Gross Sales Volume</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.transaction.grossSales.value}</div>
                  <span className={`text-xs text-${analytics.transaction.grossSales.subColor} font-semibold`}>{analytics.transaction.grossSales.sub}</span>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Purchase Procurement</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.transaction.purchase.value}</div>
                  <span className={`text-xs text-${analytics.transaction.purchase.subColor} font-semibold`}>{analytics.transaction.purchase.sub}</span>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Return & Credit Notes</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.transaction.refunds.value}</div>
                  <span className={`text-xs text-${analytics.transaction.refunds.subColor} font-semibold`}>{analytics.transaction.refunds.sub}</span>
                </div>
              </div>
            </div>
          )}

          {/* 4. REVENUE ANALYTICS */}
          {activeTab === "revenue" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">MRR Run Rate</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.revenue.mrr.value}</div>
                  <span className={`text-xs text-${analytics.revenue.mrr.subColor} font-semibold`}>{analytics.revenue.mrr.sub}</span>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Annual Run Rate (ARR)</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.revenue.arr.value}</div>
                  <span className={`text-xs text-${analytics.revenue.arr.subColor} font-semibold`}>{analytics.revenue.arr.sub}</span>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Average Revenue Per User</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.revenue.arpu.value}</div>
                  <span className={`text-xs text-${analytics.revenue.arpu.subColor} font-semibold`}>{analytics.revenue.arpu.sub}</span>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-xs text-gray-500 font-semibold">Refund Incidence</span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{analytics.revenue.refundIncidence.value}</div>
                  <span className={`text-xs text-${analytics.revenue.refundIncidence.subColor} font-semibold`}>{analytics.revenue.refundIncidence.sub}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
