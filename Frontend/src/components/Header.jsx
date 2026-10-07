import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate, NavLink, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useCompanyProfile } from "../context/CompanyProfileContext";
import AIAssistantWidget from "./AIAssistantWidget";
import {
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightStartOnRectangleIcon,
  PhoneIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import {
  LayoutDashboard,
  FileText,
  Truck,
  Users,
  Package,
  BarChart3,
  CreditCard,
  Receipt,
  Bot,
  Settings,
  Repeat,
  ShoppingCart,
  ShoppingBag,
  FileMinus,
  FilePlus,
  Building2,
  ChevronDown,
  BookOpen,
  Landmark, ClipboardList, ClipboardCheck, HandCoins, Tags, Factory } from "lucide-react";

// Sidebar: single links plus collapsible groups (Tally-style Sales / Purchases).
// Only the group holding the current page is open, so the menu fits without scrolling.
const billingNav = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  {
    name: "Sales",
    icon: ShoppingCart,
    children: [
      { name: "Quotations", path: "/quotations", icon: ClipboardList },
      { name: "Sales Orders", path: "/sales-orders", icon: ClipboardCheck },
      { name: "Invoices", path: "/invoices", icon: FileText },
      { name: "Credit Notes", path: "/credit-notes", icon: FileMinus },
      { name: "Delivery Challans", path: "/challans", icon: Truck },
      { name: "Recurring Invoices", path: "/recurring-invoices", icon: Repeat },
      { name: "Customers", path: "/clients", icon: Users },
      { name: "Payments", path: "/payments", icon: CreditCard },
      { name: "Advance Receipts", path: "/advance-receipts", icon: HandCoins },
      { name: "Cheques", path: "/cheques", icon: Landmark },
    ],
  },
  {
    name: "Purchases",
    icon: ShoppingBag,
    children: [
      { name: "Purchase Orders", path: "/purchase-orders", icon: ClipboardList },
      { name: "Purchase Bills", path: "/purchases", icon: FilePlus },
      { name: "Debit Notes", path: "/debit-notes", icon: FileMinus },
      { name: "Suppliers", path: "/suppliers", icon: Building2 },
      { name: "Expenses", path: "/expenses", icon: Receipt },
    ],
  },
  {
    name: "Inventory",
    icon: Package,
    children: [
      { name: "Products", path: "/products", icon: Package },
      { name: "Price Lists", path: "/price-lists", icon: Tags },
      { name: "Manufacturing", path: "/manufacturing", icon: Factory },
    ],
  },
  {
    name: "Accounts",
    icon: BookOpen,
    children: [
      { name: "Books & Statements", path: "/accounts", icon: Landmark },
      { name: "GST Returns", path: "/gst-returns", icon: FileText },
      { name: "Payroll", path: "/payroll", icon: Users },
      { name: "Reports", path: "/reports", icon: BarChart3 },
    ],
  },
  { name: "AI Assistant", path: "/ai-assistant", icon: Bot },
  { name: "Settings", path: "/settings", icon: Settings },
];

const itemClass = (isActive, nested) =>
  `flex items-center gap-3 rounded-xl ${nested ? "pl-9 pr-3.5" : "px-3.5"} py-2.5 [@media(max-height:820px)]:py-2 text-sm font-medium transition-all duration-200 ${
    isActive ? "bg-blue-600 text-white shadow-sm font-semibold" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
  }`;

function NavGroup({ group, open, onToggle, activePath }) {
  const Icon = group.icon;
  const containsActive = group.children.some((c) => activePath.startsWith(c.path));
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 [@media(max-height:820px)]:py-2 text-sm font-medium transition-all duration-200 ${
          containsActive && !open ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{group.name}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {group.children.map((item) => {
            const ChildIcon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => itemClass(isActive, true)}>
                <ChildIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getFYLabel() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1} FY`;
}

export default function Header() {
  const { user, signOut } = useContext(AuthContext);
  const { companyProfile } = useCompanyProfile();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dropdownRef = useRef(null);

  // The group containing the current page opens automatically.
  const activeGroup = billingNav.find((g) => g.children?.some((c) => pathname.startsWith(c.path)))?.name || null;
  const [openGroup, setOpenGroup] = useState(activeGroup);
  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
  }, [activeGroup]);
  const navRef = useRef(null);

  const handleSidebarWheel = (e) => {
    if (navRef.current && !navRef.current.contains(e.target)) {
      navRef.current.scrollTop += e.deltaY;
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      setIsDropdownOpen(false);
      navigate("/signin");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const displayName = companyProfile?.ownerName || user?.displayName || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
  const headerLogo = companyProfile?.logoURL || "/Icon@4x-8.png";
  const headerCompanyName = companyProfile?.companyName || "Kanakku Desk";

  return (
    <>
      <aside
        data-lenis-prevent="true"
        data-lenis-prevent-wheel="true"
        onWheel={handleSidebarWheel}
        className="fixed left-0 top-0 h-screen w-64 border-r border-slate-200 bg-white shadow-sm z-40 flex flex-col"
      >
        <div className="flex items-center gap-3 px-5 py-5 [@media(max-height:820px)]:py-4 border-b border-slate-200">
          <img
            src={headerLogo}
            alt={`${headerCompanyName} Logo`}
            className="h-10 w-10 object-contain rounded-lg"
          />
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 truncate">{headerCompanyName}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-600">Admin Portal</p>
          </div>
        </div>

        <nav
          ref={navRef}
          data-lenis-prevent="true"
          data-lenis-prevent-wheel="true"
          className="flex-1 min-h-0 px-3 py-4 space-y-1.5 [@media(max-height:820px)]:py-3 [@media(max-height:820px)]:space-y-1 overflow-y-auto overscroll-contain scrollbar-hide"
        >
          {/* ── Admin / Billing Navigation ── */}
          {billingNav.map((item) => {
            if (item.children) {
              return (
                <NavGroup
                  key={item.name}
                  group={item}
                  activePath={pathname}
                  open={openGroup === item.name}
                  onToggle={() => setOpenGroup((g) => (g === item.name ? null : item.name))}
                />
              );
            }
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => itemClass(isActive, false)}>
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="flex-1 truncate">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 pb-4 [@media(max-height:820px)]:pb-3">
          <div className="mb-3 [@media(max-height:820px)]:mb-2 rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-semibold text-blue-700 border border-blue-100">
            {getFYLabel()}
          </div>

          {user && (
            <div className="relative" ref={dropdownRef}>
              <div className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
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
                  <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
                </button>
              </div>

              {isDropdownOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-full rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 space-y-2">
                    {companyProfile?.companyName && (
                      <div className="flex items-center gap-2">
                        <BuildingOffice2Icon className="h-4 w-4 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-800 truncate">{companyProfile.companyName}</p>
                      </div>
                    )}
                    {companyProfile?.phone && (
                      <div className="flex items-center gap-2">
                        <PhoneIcon className="h-4 w-4 text-slate-400" />
                        <p className="text-xs text-slate-600 truncate">{companyProfile.phone}</p>
                      </div>
                    )}
                  </div>

                  <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                        isActive ? "bg-blue-50 text-blue-600" : "text-slate-700 hover:bg-slate-50"
                      }`
                    }
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <UserCircleIcon className="h-4 w-4" />
                    <span>Your Profile</span>
                  </NavLink>

                  <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                        isActive ? "bg-blue-50 text-blue-600" : "text-slate-700 hover:bg-slate-50"
                      }`
                    }
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <Cog6ToothIcon className="h-4 w-4" />
                    <span>Settings</span>
                  </NavLink>

                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <AIAssistantWidget />
    </>
  );
}
