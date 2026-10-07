import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase/config";
import { useSuperAdminAuth } from "../context/SuperAdminAuthContext";

// Blocks the business portal while system/maintenance is enabled (set from
// Super Admin > Maintenance Mode). An optional schedule limits the window.
// Platform admins pass through when allowSuperAdminBypass is on.
function isActive(m, now) {
  if (!m?.enabled) return false;
  const start = m.scheduledStart ? new Date(m.scheduledStart) : null;
  const end = m.scheduledEnd ? new Date(m.scheduledEnd) : null;
  if (start && !isNaN(start) && now < start) return false;
  if (end && !isNaN(end) && now > end) return false;
  return true;
}

export default function MaintenanceGate({ children }) {
  const { isAuthenticated: isPlatformAdmin } = useSuperAdminAuth();
  const [maintenance, setMaintenance] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "system", "maintenance"),
      (snap) => setMaintenance(snap.exists() ? snap.data() : null),
      () => setMaintenance(null)
    );
    // Re-check every minute so a scheduled window starts and ends on time.
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const blocked = isActive(maintenance, now) && !(isPlatformAdmin && maintenance.allowSuperAdminBypass !== false);
  if (!blocked) return children;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Scheduled maintenance</h1>
        <p className="text-sm text-gray-600">
          {maintenance.bannerMessage || "The platform is down for maintenance. Please try again shortly."}
        </p>
        {maintenance.scheduledEnd && (
          <p className="text-xs text-gray-400 mt-4">Expected back by {new Date(maintenance.scheduledEnd).toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}

MaintenanceGate.propTypes = {
  children: PropTypes.node.isRequired,
};
