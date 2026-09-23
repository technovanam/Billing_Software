import React, { useState } from "react";
import { superAdminService } from "../../../services/superAdminDataService";
import { TicketPercent, Plus, Search, Calendar, Tag, CheckCircle2, X } from "lucide-react";

export default function CouponsManagement() {
  const [coupons, setCoupons] = useState(() => superAdminService.getCoupons());
  const [modalOpen, setModalOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(20);
  const [fixedDiscount, setFixedDiscount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(100);
  const [expiry, setExpiry] = useState("2026-12-31");

  const handleCreateCoupon = (e) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    superAdminService.addCoupon({
      code: newCode.trim().toUpperCase(),
      discountPercentage: Number(discountPercent) || 0,
      fixedDiscount: Number(fixedDiscount) || 0,
      maxDiscount: 5000,
      usageLimit: Number(usageLimit) || 100,
      expiry,
      applicablePlans: ["plan_professional", "plan_business"],
    });

    setCoupons(superAdminService.getCoupons());
    setModalOpen(false);
    setNewCode("");
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Coupons & Promo Codes</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Create discount vouchers, promo campaigns, and usage redemption caps.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white shadow-sm flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create Coupon</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="p-3.5 px-4">PROMO CODE</th>
              <th className="p-3.5 px-4">DISCOUNT OFFER</th>
              <th className="p-3.5 px-4">REDEMPTIONS</th>
              <th className="p-3.5 px-4">USAGE LIMIT</th>
              <th className="p-3.5 px-4">VALID UNTIL</th>
              <th className="p-3.5 px-4">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {coupons.map((c) => (
              <tr key={c.id} className="text-sm transition-colors hover:bg-gray-50 group">
                <td className="p-3.5 px-4 font-mono font-bold text-sm text-blue-600 flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  <span>{c.code}</span>
                </td>
                <td className="p-3.5 px-4 font-bold text-gray-900">
                  {c.discountPercentage > 0 ? `${c.discountPercentage}% OFF` : `₹${c.fixedDiscount} FLAT OFF`}
                </td>
                <td className="p-3.5 px-4 font-mono text-gray-700">{c.usedCount} claims</td>
                <td className="p-3.5 px-4 font-mono text-gray-500">{c.usageLimit} max</td>
                <td className="p-3.5 px-4 font-mono text-gray-600">{c.expiry}</td>
                <td className="p-3.5 px-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Coupon Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-base font-bold text-gray-900">Create New Promo Voucher</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-600 font-medium mb-1">Coupon Code (Uppercase)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., FESTIVE30"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Discount %</label>
                  <input
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Usage Cap</label>
                  <input
                    type="number"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:text-gray-900 font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-sm">
                  Publish Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
