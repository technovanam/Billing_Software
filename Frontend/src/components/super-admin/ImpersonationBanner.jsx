import React from "react";
import { useSuperAdminAuth } from "../../context/SuperAdminAuthContext";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Building2 } from "lucide-react";

export default function ImpersonationBanner() {
  const { isImpersonating, impersonatedBusiness, stopImpersonation } = useSuperAdminAuth();
  const navigate = useNavigate();

  if (!isImpersonating || !impersonatedBusiness) {
    return null;
  }

  const handleExit = () => {
    const busId = impersonatedBusiness.id;
    stopImpersonation();
    navigate(`/super-admin/businesses/${busId}`, { replace: true });
  };

  return (
    <aside
      aria-label="Super Admin Impersonation Alert"
      className="sticky top-0 z-[9999] w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-medium border-b border-amber-500/40 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
        </span>
        <div className="flex items-center gap-1.5 font-bold tracking-wide uppercase">
          <ShieldAlert className="w-4 h-4 text-white" />
          <span>Super Admin Mode Active</span>
        </div>
        <span className="hidden sm:inline text-amber-200">|</span>
        <div className="flex items-center gap-1 text-white">
          <Building2 className="w-3.5 h-3.5 text-amber-200" />
          <span>Viewing:</span>
          <strong className="underline decoration-amber-300 font-semibold">{impersonatedBusiness.name}</strong>
          <span className="opacity-80">({impersonatedBusiness.id})</span>
        </div>
        {impersonatedBusiness.reason && (
          <span className="hidden md:inline text-amber-100/90 text-xs italic">
            — &quot;{impersonatedBusiness.reason}&quot;
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/super-admin/dashboard")}
          className="px-2.5 py-1 rounded bg-black/20 hover:bg-black/35 text-white text-xs font-semibold transition-colors flex items-center gap-1"
        >
          Portal Dashboard
        </button>
        <button
          type="button"
          onClick={handleExit}
          className="px-3 py-1 rounded-md bg-white text-amber-900 hover:bg-amber-50 font-bold text-xs shadow transition-transform active:scale-95 flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" />
          Exit Business Mode
        </button>
      </div>
    </aside>
  );
}
