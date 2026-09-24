import React, { useState } from "react";
import { useActiveSessions } from "../../../hooks/useSuperAdminFirestore";
import { Laptop, Trash2, ShieldAlert, CheckCircle, Clock, Loader2 } from "lucide-react";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase/config";

export default function ActiveSessions() {
  const { activeSessions: sessions, loading } = useActiveSessions();

  const handleTerminate = async (id) => {
    try {
      await deleteDoc(doc(db, "activeSessions", id));
      alert("Session revoked successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to revoke session.");
    }
  };

  const handleTerminateAll = async () => {
    if (confirm("Terminate all other Super Admin sessions except this active browser window?")) {
      try {
        const promises = sessions.map(sess => {
            if (!sess.current) {
                return deleteDoc(doc(db, "activeSessions", sess.id));
            }
            return Promise.resolve();
        });
        await Promise.all(promises);
        alert("All other sessions revoked successfully.");
      } catch (err) {
        console.error(err);
        alert("Failed to revoke some sessions.");
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Active Admin Sessions</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Real-time inspection of authenticated control center sessions and remote device revocation.
          </p>
        </div>

        {sessions.length > 1 && (
          <button
            type="button"
            onClick={handleTerminateAll}
            className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-2 transition shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Terminate All Other Sessions</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Loading active sessions from Firebase...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <Laptop className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No active sessions</h3>
          <p className="text-sm text-gray-500">There are currently no active authenticated sessions found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className={`p-5 rounded-2xl bg-white border flex flex-col justify-between shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
                sess.current ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-100"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-gray-900">{sess.device || "Unknown Device"}</span>
                  </div>
                  {sess.current && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
                      Current Window
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-gray-600">
                  <div>Admin Operator: <strong className="text-gray-900">{sess.admin || "Unknown Admin"}</strong></div>
                  <div>Browser: <span className="text-gray-700">{sess.browser || "Unknown Browser"}</span></div>
                  <div>IP Address: <span className="font-mono text-gray-800">{sess.ip || "N/A"}</span></div>
                  <div>Session Started: <span className="font-mono text-gray-500">{sess.loginTime || sess.createdAt || "N/A"}</span></div>
                  <div>Last Telemetry: <span className="text-emerald-600 font-semibold">{sess.lastActivity || "Just now"}</span></div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-gray-100 flex justify-end">
                {!sess.current ? (
                  <button
                    type="button"
                    onClick={() => handleTerminate(sess.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke Session</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-400 italic">Active authenticated window</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
