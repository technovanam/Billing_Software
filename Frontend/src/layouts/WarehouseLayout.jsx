import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate, NavLink, Outlet, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { AuthContext } from "../context/AuthContext";
import { useCompanyProfile } from "../context/CompanyProfileContext";
import {
  Warehouse,
  Package,
  ScanBarcode,
  FileBarChart2,
  LogOut,
  Trash2,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Building2,
  Clock,
  Settings,
  Menu,
  X,
} from "lucide-react";

const warehouseNavItems = [
  { name: "Warehouse Dashboard", path: "/warehouse", icon: Warehouse, end: true, badge: "Live" },
  { name: "Products", path: "/warehouse/products", icon: Package },
  { name: "Scan Barcode", path: "/warehouse/scan", icon: ScanBarcode },
  { name: "Stock In", path: "/warehouse/stock-in", icon: ArrowDownToLine },
  { name: "Stock Out", path: "/warehouse/stock-out", icon: ArrowUpFromLine },
  { name: "Stock Transfer", path: "/warehouse/transfer", icon: ArrowLeftRight },
  { name: "Godowns", path: "/warehouse/godowns", icon: Building2 },
  { name: "Damaged Stock", path: "/warehouse/damaged", icon: Trash2 },
  { name: "Stock Movements", path: "/warehouse/movements", icon: Clock },
  { name: "Stock Report", path: "/warehouse/reports", icon: FileBarChart2 },
  { name: "Warehouse Setup", path: "/warehouse/setup", icon: Settings },
];

function getFYLabel() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1} FY`;
}

export default function WarehouseLayout({ children }) {
  const { user, signOut } = useContext(AuthContext);
  const { companyProfile } = useCompanyProfile();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const profileRef = useRef(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Close the mobile sidebar whenever the route changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/signin");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const displayName = companyProfile?.ownerName || user?.displayName || user?.email?.split("@")[0] || "Warehouse User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  const headerLogo = companyProfile?.logoURL || "/Icon@4x-8.png";
  const headerCompanyName = companyProfile?.companyName || "Techno Vanam";

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* ── Mobile backdrop ── */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Admin-Portal-Style White Sidebar ── */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 border-r border-slate-200 bg-white shadow-sm z-40 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200">
          <img
            src={headerLogo}
            alt={`${headerCompanyName} Logo`}
            className="h-10 w-10 object-contain rounded-lg"
          />
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 truncate">{headerCompanyName}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-600">Warehouse Portal</p>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto scrollbar-thin">
          {warehouseNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm font-semibold"
                      : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                  }`
                }
              >
                <div className="flex items-center gap-3 truncate">
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Section: FY and Profile */}
        <div className="px-3 pb-4">
          <div className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-semibold text-blue-700 border border-blue-100">
            {getFYLabel()}
          </div>

          {user && (
            <div className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left" ref={profileRef}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{displayName}</p>
                <p className="truncate text-[11px] text-slate-500">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0 bg-slate-100 min-h-screen">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src={headerLogo} alt="" className="h-7 w-7 object-contain rounded" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{headerCompanyName}</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-600">Warehouse Portal</p>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}

WarehouseLayout.propTypes = {
  children: PropTypes.node,
};
