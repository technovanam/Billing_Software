import React, { useState } from "react";
import { useSubscriptionPlans } from "../../../hooks/useSuperAdminFirestore";
import { db } from "../../../lib/firebase/config";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Plus, Check, X, Edit2, Shield, Trash2, Copy, Loader2 } from "lucide-react";

const AVAILABLE_FEATURES = [
  { id: "pos", name: "POS Cashier Mode" },
  { id: "billing", name: "Billing & E-Way Bill" },
  { id: "multiBranch", name: "Multi-Outlet Sync" },
  { id: "reports", name: "Advanced Reports" },
  { id: "whatsapp", name: "WhatsApp Delivery" },
  { id: "api", name: "API Access" },
  { id: "crm", name: "CRM Module" },
  { id: "inventory", name: "Advanced Inventory" }
];

export default function SubscriptionPlans() {
  const { plans, loading } = useSubscriptionPlans();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const getEmptyPlan = () => ({
    id: `plan_${Date.now()}`,
    name: "",
    description: "",
    price: 0,
    monthlyPrice: 0,
    annualPrice: 0,
    status: "Active",
    isCustom: false,
    activeSubscribers: 0,
    limits: {
      users: 1,
      branches: 1,
      godowns: 1,
      terminals: 1,
      products: 100,
      invoices: 500
    },
    featuresObject: {},
    addons: []
  });

  const openCreateModal = () => {
    setEditingPlan(getEmptyPlan());
    setIsModalOpen(true);
  };

  const openEditModal = (plan) => {
    // Convert array features to object if needed for the UI toggle
    const featuresObj = {};
    if (Array.isArray(plan.features)) {
       plan.features.forEach(f => featuresObj[f.toLowerCase()] = true);
    } else if (plan.features) {
       Object.assign(featuresObj, plan.features);
    }

    setEditingPlan({ ...plan, featuresObject: featuresObj });
    setIsModalOpen(true);
  };

  const handleDeletePlan = async (id) => {
    if (window.confirm("Are you sure you want to delete this plan?")) {
      try {
        await deleteDoc(doc(db, "subscriptionPlans", id));
      } catch (err) {
        console.error(err);
        alert("Failed to delete plan.");
      }
    }
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!editingPlan) return;
    setIsSaving(true);

    try {
      // Convert featuresObject back to expected format
      const planToSave = { ...editingPlan };
      planToSave.features = planToSave.featuresObject;
      delete planToSave.featuresObject;

      // Extract ID
      const { id, ...data } = planToSave;
      
      await setDoc(doc(db, "subscriptionPlans", id), {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setIsModalOpen(false);
      setEditingPlan(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save plan.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleFeature = (featId) => {
    setEditingPlan(prev => ({
      ...prev,
      featuresObject: {
        ...prev.featuresObject,
        [featId]: !prev.featuresObject[featId]
      }
    }));
  };

  const renderFeatureToggle = (featId, label) => (
    <label key={featId} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-blue-50/50 cursor-pointer transition">
      <div className={`w-5 h-5 rounded flex items-center justify-center border transition ${
        editingPlan.featuresObject[featId] ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"
      }`}>
        {editingPlan.featuresObject[featId] && <Check className="w-3.5 h-3.5 text-white" />}
      </div>
      <span className="text-xs font-semibold text-gray-700">{label}</span>
    </label>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Subscription Plans</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Configure pricing, resource quotas, limits, and feature entitlements.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create New Plan
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Loading subscription plans...</p>
        </div>
      ) : (
        <>
          {/* Plan Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`p-6 rounded-2xl bg-white border flex flex-col relative transition shadow-[0_2px_12px_rgba(0,0,0,0.03)] ${
              plan.popular
                ? "border-blue-500 ring-2 ring-blue-500/20"
                : "border-slate-200 hover:shadow-md"
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                Most Popular
              </span>
            )}

            {plan.isCustom && (
              <span className="absolute top-4 right-4 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                Custom
              </span>
            )}

            <div className="flex-1">
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">{plan.name}</h3>
              <p className="text-xs text-gray-500 min-h-[32px] mb-4">{plan.description || "No description provided."}</p>

              <div className="mb-6 pb-6 border-b border-gray-100">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-gray-900">₹{(plan.monthlyPrice || plan.price || 0).toLocaleString()}</span>
                  <span className="text-xs font-semibold text-gray-400">/mo</span>
                </div>
                <div className="text-[11px] font-semibold text-gray-400 mt-1">
                  ₹{(plan.annualPrice || ((plan.price||0) * 10)).toLocaleString()}/year billed annually
                </div>
              </div>

              {/* Resource Quotas */}
              <div className="space-y-2.5 text-xs mb-6">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Usage Limits</div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">User Seats:</span>
                  <strong className="font-bold text-gray-900">{plan.limits?.users || 1}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Branches:</span>
                  <strong className="font-bold text-gray-900">{plan.limits?.branches || 1}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">POS Terminals:</span>
                  <strong className="font-bold text-gray-900">{plan.limits?.terminals || 1}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Products Limit:</span>
                  <strong className="font-bold text-gray-900">{(plan.limits?.products || 50).toLocaleString()}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Monthly Invoices:</span>
                  <strong className="font-bold text-gray-900">{(plan.limits?.invoices || 100).toLocaleString()}</strong>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="space-y-2 text-xs">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2 mt-4">Entitlements</div>
                {AVAILABLE_FEATURES.map((feat) => {
                   // Compatibility with array or object features
                   let enabled = false;
                   if (Array.isArray(plan.features)) {
                     enabled = plan.features.some(f => f.toLowerCase() === feat.id.toLowerCase() || f.toLowerCase() === feat.name.toLowerCase());
                   } else if (plan.features) {
                     enabled = !!plan.features[feat.id];
                   }
                   
                   return (
                     <div key={feat.id} className="flex items-center gap-2.5">
                       {enabled ? (
                         <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                           <Check className="w-2.5 h-2.5 text-emerald-600" />
                         </div>
                       ) : (
                         <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                           <X className="w-2.5 h-2.5 text-slate-400" />
                         </div>
                       )}
                       <span className={enabled ? "text-gray-800 font-semibold" : "text-gray-400 font-medium line-through"}>{feat.name}</span>
                     </div>
                   );
                })}
              </div>
            </div>

            <div className="mt-8 flex items-center gap-2">
              <button
                onClick={() => openEditModal(plan)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs transition"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Plan
              </button>
              <button
                onClick={() => handleDeletePlan(plan.id)}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                title="Delete Plan"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            </div>
          ))}
          </div>
        </>
      )}

      {/* Create / Edit Plan Modal */}
      {isModalOpen && editingPlan && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{editingPlan.id.startsWith("plan_") && editingPlan.name ? "Edit Plan" : "Create New Plan"}</h3>
                <p className="text-xs text-gray-500">Configure comprehensive pricing, limits, and features.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-700 bg-white rounded-xl shadow-sm border border-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              <form id="plan-form" onSubmit={handleSavePlan} className="space-y-8">
                
                {/* Basic Info */}
                <section>
                  <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" /> Basic Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Plan Name</label>
                      <input
                        type="text"
                        required
                        value={editingPlan.name}
                        onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-semibold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                        placeholder="e.g., Starter, Professional, Enterprise"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Description (Optional)</label>
                      <input
                        type="text"
                        value={editingPlan.description || ""}
                        onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:bg-white focus:border-blue-500 outline-none transition"
                        placeholder="Brief summary of who this plan is for..."
                      />
                    </div>
                    <div className="flex items-center gap-3 sm:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={editingPlan.popular} 
                          onChange={(e) => setEditingPlan({...editingPlan, popular: e.target.checked})}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                        />
                        <span className="text-sm font-medium text-gray-700">Mark as "Most Popular"</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer ml-6">
                        <input 
                          type="checkbox" 
                          checked={editingPlan.isCustom} 
                          onChange={(e) => setEditingPlan({...editingPlan, isCustom: e.target.checked})}
                          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" 
                        />
                        <span className="text-sm font-medium text-gray-700">Custom Plan (Hidden from public pricing)</span>
                      </label>
                    </div>
                  </div>
                </section>

                <hr className="border-gray-100" />

                {/* Pricing */}
                <section>
                  <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-green-100 text-green-700 flex items-center justify-center text-xs">₹</span> Pricing
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Monthly Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={editingPlan.monthlyPrice || editingPlan.price || 0}
                        onChange={(e) => setEditingPlan({ ...editingPlan, monthlyPrice: Number(e.target.value), price: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Annual Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={editingPlan.annualPrice || (editingPlan.price * 10) || 0}
                        onChange={(e) => setEditingPlan({ ...editingPlan, annualPrice: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-bold focus:bg-white focus:border-blue-500 outline-none transition"
                      />
                    </div>
                  </div>
                </section>

                <hr className="border-gray-100" />

                {/* Limits & Quotas */}
                <section>
                  <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-600" /> Resource Quotas & Limits
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { key: "users", label: "Max User Seats" },
                      { key: "branches", label: "Max Branches" },
                      { key: "godowns", label: "Max Godowns" },
                      { key: "terminals", label: "Max POS Terminals" },
                      { key: "products", label: "Max Products" },
                      { key: "invoices", label: "Monthly Invoices" },
                    ].map((limit) => (
                      <div key={limit.key}>
                        <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">{limit.label}</label>
                        <input
                          type="number"
                          min="-1"
                          value={editingPlan.limits?.[limit.key] || 0}
                          onChange={(e) =>
                            setEditingPlan({
                              ...editingPlan,
                              limits: { ...(editingPlan.limits || {}), [limit.key]: Number(e.target.value) },
                            })
                          }
                          className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-semibold focus:bg-white focus:border-blue-500 outline-none transition"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 font-medium">* Tip: Use a very high number (e.g., 999999) for unlimited resources.</p>
                </section>

                <hr className="border-gray-100" />

                {/* Features */}
                <section>
                  <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Feature Entitlements
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {AVAILABLE_FEATURES.map((feat) => renderFeatureToggle(feat.id, feat.name))}
                  </div>
                </section>

              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-200 font-bold text-sm transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                form="plan-form"
                type="submit" 
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white text-sm shadow-sm transition flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isSaving ? "Saving..." : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
