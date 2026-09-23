import React, { useState } from "react";
import { TrendingUp, CreditCard, ArrowUpRight, DollarSign, RotateCcw, AlertTriangle, BarChart2 } from "lucide-react";

export default function RevenueAnalytics() {
  const [period, setPeriod] = useState("6m");

  const revenueKPIs = [
    { label: "Monthly Recurring Revenue (MRR)", value: "₹18.42 Lakhs", sub: "+14.2% MoM growth", positive: true },
    { label: "Annual Run Rate (ARR)", value: "₹2.21 Crores", sub: "Annualized subscription base", positive: true },
    { label: "Total Net Revenue (YTD)", value: "₹1.18 Crores", sub: "FY 2026-27 Collections", positive: true },
    { label: "Average Revenue Per Business (ARPU)", value: "₹1,476", sub: "+5.1% expansion", positive: true },
    { label: "Refund Volume", value: "₹24,990", sub: "0.18% platform refund rate", positive: true },
    { label: "Payment Gateway Success Rate", value: "98.8%", sub: "Nominal gateway SLA", positive: true },
  ];

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
          <p className="text-xs text-gray-500 mb-6">Historical subscription inflow in Lakhs (₹)</p>

          <div className="h-56 flex items-end justify-between gap-3 px-2 border-b border-gray-100 pb-2">
            {[
              { m: "Apr", val: 12.4, newR: 2.1 },
              { m: "May", val: 13.8, newR: 2.4 },
              { m: "Jun", val: 14.9, newR: 2.8 },
              { m: "Jul", val: 16.1, newR: 3.2 },
              { m: "Aug", val: 17.2, newR: 3.5 },
              { m: "Sep", val: 18.4, newR: 4.1 },
            ].map((col, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="w-full flex flex-col items-center justify-end h-full">
                  <div
                    style={{ height: `${col.val * 4.5}%` }}
                    className="w-8 bg-blue-600 rounded-t group-hover:bg-blue-700 transition"
                  />
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold text-gray-900 block">₹{col.val}L</span>
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
            {[
              { name: "Professional Plan (₹2,499/mo)", amount: "₹8.85 Lakhs", share: 48, color: "bg-blue-600" },
              { name: "Business Plan (₹4,999/mo)", amount: "₹5.44 Lakhs", share: 30, color: "bg-indigo-600" },
              { name: "Enterprise Plan (₹12,999/mo)", amount: "₹2.70 Lakhs", share: 15, color: "bg-purple-600" },
              { name: "Starter Plan (₹999/mo)", amount: "₹1.43 Lakhs", share: 7, color: "bg-cyan-600" },
            ].map((tier, i) => (
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
