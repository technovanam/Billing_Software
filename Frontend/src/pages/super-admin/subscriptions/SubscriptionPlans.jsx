import React, { useState } from "react";
import { superAdminService } from "../../../services/superAdminDataService";
import { Layers, Check, X, Edit2, Zap, Shield, Sparkles, Building, HardDrive, Receipt } from "lucide-react";

export default function SubscriptionPlans() {
  const [plans, setPlans] = useState(() => superAdminService.getPlans());
  const [editingPlan, setEditingPlan] = useState(null);

  const handleSavePlan = (e) => {
    e.preventDefault();
    if (!editingPlan) return;
    superAdminService.updatePlan(editingPlan.id, editingPlan);
    setPlans(superAdminService.getPlans());
    setEditingPlan(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Subscription Plans</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Configure feature entitlement flags, resource quotas, and commercial pricing across tiers.
          </p>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`p-5 rounded-2xl bg-white border flex flex-col justify-between relative transition shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
              plan.popular
                ? "border-blue-500 ring-2 ring-blue-500/20"
                : "border-slate-100 hover:shadow-md"
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                Most Popular
              </span>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-extrabold text-gray-900">{plan.name}</h3>
                <button
                  type="button"
                  onClick={() => setEditingPlan(plan)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-slate-100 transition"
                  title="Edit Plan Limits"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-gray-500 min-h-[32px] mb-4 leading-relaxed">{plan.description}</p>

              <div className="mb-4 pb-4 border-b border-gray-100">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">₹{plan.monthlyPrice.toLocaleString()}</span>
                  <span className="text-xs text-gray-400">/mo</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  ₹{plan.annualPrice.toLocaleString()}/year billed annually
                </div>
              </div>

              {/* Resource Quotas */}
              <div className="space-y-2 text-xs mb-6 text-gray-700">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-400">User Seats:</span>
                  <strong className="font-mono text-gray-800">{plan.limits.users}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-400">Branches:</span>
                  <strong className="font-mono text-gray-800">{plan.limits.branches}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-400">Godowns:</span>
                  <strong className="font-mono text-gray-800">{plan.limits.godowns}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-400">POS Terminals:</span>
                  <strong className="font-mono text-gray-800">{plan.limits.terminals}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-400">Products limit:</span>
                  <strong className="font-mono text-gray-800">{plan.limits.products.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-400">Invoices/mo:</span>
                  <strong className="font-mono text-gray-800">{plan.limits.invoices.toLocaleString()}</strong>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="space-y-1.5 text-xs">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Entitlements</div>
                {Object.entries({
                  "POS Cashier Mode": plan.features.pos,
                  "Billing & E-Way Bill": plan.features.billing,
                  "Multi-Outlet Sync": plan.features.multiBranch,
                  "Advanced Reports": plan.features.reports,
                  "WhatsApp Delivery": plan.features.whatsapp,
                  "API Access": plan.features.api,
                }).map(([feat, enabled], i) => (
                  <div key={i} className="flex items-center gap-2">
                    {enabled ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    )}
                    <span className={enabled ? "text-gray-800 font-medium" : "text-gray-400"}>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
              <span>Subscribers</span>
              <strong className="font-bold text-gray-900 font-mono">{plan.activeSubscribers}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Edit Plan: {editingPlan.name}</h3>
            <p className="text-xs text-gray-500 mb-4">Modify pricing and quota allocations</p>

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Monthly Price (₹)</label>
                  <input
                    type="number"
                    value={editingPlan.monthlyPrice}
                    onChange={(e) => setEditingPlan({ ...editingPlan, monthlyPrice: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Annual Price (₹)</label>
                  <input
                    type="number"
                    value={editingPlan.annualPrice}
                    onChange={(e) => setEditingPlan({ ...editingPlan, annualPrice: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Max Users</label>
                  <input
                    type="number"
                    value={editingPlan.limits.users}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        limits: { ...editingPlan.limits, users: Number(e.target.value) },
                      })
                    }
                    className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Max Branches</label>
                  <input
                    type="number"
                    value={editingPlan.limits.branches}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        limits: { ...editingPlan.limits, branches: Number(e.target.value) },
                      })
                    }
                    className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Max Terminals</label>
                  <input
                    type="number"
                    value={editingPlan.limits.terminals}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        limits: { ...editingPlan.limits, terminals: Number(e.target.value) },
                      })
                    }
                    className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-sm">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
