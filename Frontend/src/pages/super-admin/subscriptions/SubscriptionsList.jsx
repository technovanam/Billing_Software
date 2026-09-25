import React, { useState } from "react";
import { usePlatformBusinesses } from "../../../hooks/useSuperAdminFirestore";
import { db } from "../../../lib/firebase/config";
import { doc, updateDoc } from "firebase/firestore";
import { CreditCard, Search, Clock, Play, Pause, XCircle, CheckCircle2, ChevronRight, Layers } from "lucide-react";

export default function SubscriptionsList() {
  const { businesses, loading } = usePlatformBusinesses();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const handleAction = async (id, actionType) => {
    const bus = businesses.find((b) => b.id === id);
    if (!bus) return;

    try {
      if (actionType === "extend") {
        const d = new Date(bus.subscriptionExpiry || Date.now());
        d.setDate(d.getDate() + 30);
        const newExp = d.toISOString().slice(0, 10);
        await updateDoc(doc(db, "users", id), { subscriptionExpiry: newExp });
        alert(`Extended subscription for ${bus.name} by 30 days.`);
      } else if (actionType === "pause") {
        await updateDoc(doc(db, "users", id), { status: "Suspended" });
        alert(`Paused subscription for ${bus.name}.`);
      } else if (actionType === "resume") {
        await updateDoc(doc(db, "users", id), { status: "Active" });
        alert(`Resumed subscription for ${bus.name}.`);
      } else if (actionType === "cancel") {
        if (confirm(`Cancel subscription for ${bus.name}?`)) {
          await updateDoc(doc(db, "users", id), { status: "Suspended" });
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error updating subscription status.");
    }
  };

  const filtered = businesses.filter((b) => {
    if (statusFilter !== "All" && b.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q) || b.planName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Active Subscriptions</h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Manage recurring subscription terms, lifecycle pauses, manual extensions, and plan upgrades.
        </p>
      </div>

      <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search business, ID, or plan…"
            className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 shadow-sm focus:outline-none w-full sm:w-auto cursor-pointer"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Trial">Trial</option>
          <option value="Suspended">Suspended / Paused</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3.5 px-4">BUSINESS NAME</th>
                <th className="p-3.5 px-4">PLAN</th>
                <th className="p-3.5 px-4">BILLING CYCLE</th>
                <th className="p-3.5 px-4">RENEWAL DATE</th>
                <th className="p-3.5 px-4">ESTIMATED ARR</th>
                <th className="p-3.5 px-4">STATUS</th>
                <th className="p-3.5 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((bus) => (
                <tr key={bus.id} className="text-sm transition-colors hover:bg-gray-50 group">
                  <td className="p-3.5 px-4">
                    <div className="font-bold text-gray-900">{bus.name}</div>
                    <div className="text-[10px] font-mono text-gray-400">{bus.id}</div>
                  </td>
                  <td className="p-3.5 px-4"><span className="px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-gray-700">{bus.planName}</span></td>
                  <td className="p-3.5 px-4 text-gray-600">{bus.billingCycle}</td>
                  <td className="p-3.5 px-4 font-mono text-emerald-600 font-semibold">{bus.subscriptionExpiry}</td>
                  <td className="p-3.5 px-4 font-mono font-bold text-gray-900">
                    {bus.planName === "Enterprise" ? "₹1,20,000" : bus.planName === "Business" ? "₹59,988" : "₹23,988"}
                  </td>
                  <td className="p-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        bus.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          : bus.status === "Trial"
                          ? "bg-amber-50 text-amber-700 border-amber-200/60"
                          : "bg-rose-50 text-rose-700 border-rose-200/60"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          bus.status === "Active"
                            ? "bg-emerald-500"
                            : bus.status === "Trial"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                      />
                      {bus.status}
                    </span>
                  </td>
                  <td className="p-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAction(bus.id, "extend")}
                        title="Extend 30 Days"
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-gray-600 hover:text-gray-900 border border-slate-200 transition"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                      {bus.status === "Active" ? (
                        <button
                          type="button"
                          onClick={() => handleAction(bus.id, "pause")}
                          title="Pause Subscription"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 text-amber-600 border border-slate-200 transition"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAction(bus.id, "resume")}
                          title="Resume Subscription"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-emerald-600 border border-slate-200 transition"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAction(bus.id, "cancel")}
                        title="Cancel Subscription"
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-rose-600 border border-slate-200 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
