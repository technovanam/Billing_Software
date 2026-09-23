import React, { useState } from "react";
import { BarChart3, Building2, Users, CreditCard, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function PlatformAnalytics() {
  const [activeTab, setActiveTab] = useState("business"); // business | user | transaction | revenue
  const [dateFilter, setDateFilter] = useState("30d");

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

      {/* 1. BUSINESS ANALYTICS */}
      {activeTab === "business" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Total Registered</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">1,248</div>
              <span className="text-xs text-emerald-600 font-semibold">+12.4% MoM</span>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Active Retained</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">1,086</div>
              <span className="text-xs text-emerald-600 font-semibold">87.0% Retention</span>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Trial Conversions</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">68.2%</div>
              <span className="text-xs text-blue-600 font-semibold">Free to Paid</span>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Gross Churn Rate</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">1.8%</div>
              <span className="text-xs text-emerald-600 font-semibold">Industry Benchmark &lt;3%</span>
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
              <div className="text-2xl font-bold text-gray-900 mt-1">6,482</div>
              <span className="text-xs text-emerald-600 font-semibold">+412 this month</span>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Daily Active Users (DAU)</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">4,120</div>
              <span className="text-xs text-cyan-600 font-semibold">Cashiers & Billing Staff</span>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Monthly Active Users (MAU)</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">5,890</div>
              <span className="text-xs text-blue-600 font-semibold">90.8% Active Ratio</span>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Avg Sessions Per User</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">8.4 / day</div>
              <span className="text-xs text-gray-400">Multi-counter shifts</span>
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
              <div className="text-2xl font-bold text-gray-900 mt-1">2.84 Million</div>
              <span className="text-xs text-emerald-600 font-semibold">+18.2% throughput</span>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Gross Sales Volume</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">₹48.90 Cr</div>
              <span className="text-xs text-emerald-600 font-semibold">Across all merchants</span>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Purchase Procurement</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">₹34.12 Cr</div>
              <span className="text-xs text-gray-400">Vendor bills entered</span>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Return & Credit Notes</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">0.62%</div>
              <span className="text-xs text-emerald-600 font-semibold">Ultra low return volume</span>
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
              <div className="text-2xl font-bold text-gray-900 mt-1">₹18.42 Lakhs</div>
              <span className="text-xs text-emerald-600 font-semibold">+14.2% MoM</span>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Annual Run Rate (ARR)</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">₹2.21 Crores</div>
              <span className="text-xs text-emerald-600 font-semibold">Extrapolated base</span>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Average Revenue Per User</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">₹1,476</div>
              <span className="text-xs text-blue-600 font-semibold">Plan blended ARPU</span>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Refund Incidence</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">0.18%</div>
              <span className="text-xs text-emerald-600 font-semibold">Exceptional billing stability</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
