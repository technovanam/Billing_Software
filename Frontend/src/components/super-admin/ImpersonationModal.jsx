import React, { useState } from "react";
import PropTypes from "prop-types";
import { ShieldAlert, X, AlertTriangle, Building, ArrowRight } from "lucide-react";

export default function ImpersonationModal({ business, isOpen, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!isOpen || !business) return null;

  const handleContinue = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide an administrative reason for auditing purposes.");
      return;
    }
    setError("");
    onConfirm(business, reason.trim());
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Login as Business Confirmation</h3>
              <p className="text-xs text-slate-500">Super Admin Impersonation Protocol</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Notice */}
        <div className="mt-4 p-3.5 bg-amber-50 rounded-xl border border-amber-200/80 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong className="font-semibold block mb-0.5">High-Audit Administrative Action:</strong>
            You are about to access the live tenant environment. Every action performed during this session will be
            strictly monitored and appended to the immutable platform audit trail.
          </div>
        </div>

        {/* Target Details */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2.5 mb-2">
            <Building className="w-4 h-4 text-slate-600" />
            <span className="text-xs text-slate-500 font-medium">Target Organization:</span>
          </div>
          <p className="text-base font-bold text-slate-900">{business.name}</p>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200/70 text-xs text-slate-600">
            <div>
              <span className="text-slate-400">Business ID: </span>
              <strong className="font-mono text-slate-800">{business.id}</strong>
            </div>
            <div>
              <span className="text-slate-400">Owner: </span>
              <strong className="text-slate-800">{business.ownerName}</strong>
            </div>
          </div>
        </div>

        {/* Reason Form */}
        <form onSubmit={handleContinue} className="mt-4 space-y-3">
          <div>
            <label htmlFor="reason" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reason for Impersonation <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="reason"
              rows={3}
              required
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g., Investigating thermal receipt printing margin issue reported in Ticket #TCK-4081"
              className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 placeholder:text-slate-400 transition"
            />
            {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-bold shadow-md hover:from-amber-700 hover:to-orange-700 flex items-center gap-2 transition active:scale-95"
            >
              <span>Continue to Business</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

ImpersonationModal.propTypes = {
  business: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};
