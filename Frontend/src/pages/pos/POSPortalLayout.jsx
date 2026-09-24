import React, { useState, useEffect, useRef } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Users,
  Zap,
  RotateCcw,
  Clock,
  LogOut,
  Store,
} from "lucide-react";
import { useCompanyProfile } from "../../context/CompanyProfileContext";

const posNavItems = [
  { name: "POS Billing", path: "/pos/billing", icon: Zap },
  { name: "Customers", path: "/pos/customers", icon: Users },
  { name: "Sales Return", path: "/pos/returns", icon: RotateCcw },
  { name: "Shift Management", path: "/pos/shifts", icon: Clock },
];

export default function POSPortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { companyProfile } = useCompanyProfile();
  const navRef = useRef(null);

  const handleSidebarWheel = (e) => {
    if (navRef.current && !navRef.current.contains(e.target)) {
      navRef.current.scrollTop += e.deltaY;
    }
  };

  const [cashierSession, setCashierSession] = useState(() => {
    try {
      const saved = localStorage.getItem("pos_cashier_session");
      return saved ? JSON.parse(saved) : { cashierId: "CSH-001", counterNumber: "Counter 01" };
    } catch {
      return { cashierId: "CSH-001", counterNumber: "Counter 01" };
    }
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("pos_cashier_session");
    navigate("/signin", { replace: true });
  };

  const companyName = companyProfile?.companyName || "Techno Vanam";
  const companyLogo = companyProfile?.logoURL || "/Icon@4x-8.png";
  const cashierId = cashierSession?.cashierId || "CSH-001";
  const cashierName = cashierSession?.cashierName || "Cashier Staff";

  return (
    <div className="h-screen w-screen bg-slate-100 flex overflow-hidden font-mazzard select-none">
      {/* ================= CASHIER SIDEBAR ================= */}
      <aside
        data-lenis-prevent="true"
        data-lenis-prevent-wheel="true"
        onWheel={handleSidebarWheel}
        className="w-64 h-full border-r border-slate-200 bg-white shadow-xs z-40 flex flex-col shrink-0"
      >
        {/* Top Branding */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 shrink-0">
          <img
            src={companyLogo}
            alt={`${companyName} Logo`}
            className="h-10 w-10 object-contain rounded-lg"
          />
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 truncate">{companyName}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-600">Cashier Portal</p>
          </div>
        </div>

        {/* Navigation items: 1. Customers, 2. POS Billing */}
        <nav
          ref={navRef}
          data-lenis-prevent="true"
          data-lenis-prevent-wheel="true"
          className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto scrollbar-thin"
        >
          {posNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm font-semibold"
                      : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                  }`
                }
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="flex-1 truncate">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Cashier Session Profile */}
        <div className="px-3 pb-4 shrink-0">
          <div className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-semibold text-blue-700 border border-blue-100">
            <div className="flex items-center justify-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span>
                {currentTime.toLocaleTimeString("en-US", { hour12: true })}
              </span>
            </div>
          </div>

          <div className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shrink-0">
              {cashierName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .substring(0, 2) || "CS"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{cashierName}</p>
              <p className="truncate text-[11px] text-slate-500 tabular-nums">
                {cashierId}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MAIN CASHIER PORTAL OUTLET ================= */}
      <main data-lenis-prevent className="flex-1 h-full min-h-0 overflow-hidden flex flex-col">
        <Outlet context={{ cashierSession, cashierId }} />
      </main>
    </div>
  );
}
