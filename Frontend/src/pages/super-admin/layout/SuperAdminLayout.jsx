import React, { useState, useEffect, useMemo, useRef } from "react";
import { Outlet, NavLink, useLocation, useNavigate, Link } from "react-router-dom";
import { useSuperAdminAuth } from "../../../context/SuperAdminAuthContext";
import AIAssistantWidget from "../../../components/AIAssistantWidget";
import {
  LayoutDashboard,
  Building2,
  GitBranch,
  Users,
  Smartphone,
  Warehouse,
  CreditCard,
  Layers,
  Receipt,
  TrendingUp,
  TicketPercent,
  BarChart3,
  HelpCircle,
  Megaphone,
  Shield,
  KeyRound,
  FileText,
  Clock,
  Laptop,
  Activity,
  Settings,
  Database,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  ExternalLink,
  Store,
} from "lucide-react";
import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";

function getFYLabel() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1} FY`;
}

export default function SuperAdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const navRef = useRef(null);

  const handleSidebarWheel = (e) => {
    if (navRef.current && !navRef.current.contains(e.target)) {
      navRef.current.scrollTop += e.deltaY;
    }
  };

  const { adminUser, logout } = useSuperAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  // Keyboard shortcut for Command Palette (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navGroups = useMemo(
    () => [
      {
        title: "CORE",
        items: [{ to: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
      },
      {
        title: "PLATFORM FLEET",
        items: [
          { to: "/super-admin/businesses", label: "Businesses", icon: Building2 },
          { to: "/super-admin/branches", label: "Branches", icon: GitBranch },
          { to: "/super-admin/users", label: "Users", icon: Users },
          { to: "/super-admin/pos-terminals", label: "POS Terminals", icon: Smartphone },
          { to: "/super-admin/godowns", label: "Godowns", icon: Warehouse },
        ],
      },
      {
        title: "SUBSCRIPTIONS & BILLING",
        items: [
          { to: "/super-admin/plans", label: "Plans", icon: Layers },
          { to: "/super-admin/subscriptions", label: "Subscriptions", icon: CreditCard },
          { to: "/super-admin/payments", label: "Payments", icon: Receipt },
          { to: "/super-admin/revenue", label: "Revenue", icon: TrendingUp },
          { to: "/super-admin/coupons", label: "Coupons", icon: TicketPercent },
        ],
      },
      {
        title: "ANALYTICS & SUPPORT",
        items: [
          { to: "/super-admin/analytics", label: "Platform Analytics", icon: BarChart3 },
          { to: "/super-admin/support", label: "Support Tickets", icon: HelpCircle },
          { to: "/super-admin/announcements", label: "Announcements", icon: Megaphone },
        ],
      },
      {
        title: "SECURITY & ACCESS",
        items: [
          { to: "/super-admin/admin-users", label: "Admin Users", icon: Shield },
          { to: "/super-admin/roles", label: "Roles & Permissions", icon: KeyRound },
          { to: "/super-admin/audit-logs", label: "Audit Logs", icon: FileText },
          { to: "/super-admin/login-activity", label: "Login Activity", icon: Clock },
          { to: "/super-admin/sessions", label: "Active Sessions", icon: Laptop },
        ],
      },
      {
        title: "SYSTEM & BACKUPS",
        items: [
          { to: "/super-admin/system-health", label: "System Health", icon: Activity },
          { to: "/super-admin/settings", label: "Settings", icon: Settings },
          { to: "/super-admin/backups", label: "Backups", icon: Database },
          { to: "/super-admin/maintenance", label: "Maintenance", icon: AlertOctagon },
        ],
      },
    ],
    []
  );

  const portalShortcuts = [
    { name: "Business Portal", path: "/dashboard", icon: Store, badge: "Admin" },
    { name: "POS Counter", path: "/pos/billing", icon: Smartphone, badge: "POS" },
    { name: "Warehouse Hub", path: "/warehouse", icon: Warehouse, badge: "Stock" },
  ];

  // Search items for command palette
  const searchableItems = useMemo(() => {
    const list = [];
    navGroups.forEach((g) => {
      g.items.forEach((item) => {
        list.push({ title: item.label, category: g.title, path: item.to, icon: item.icon });
      });
    });
    portalShortcuts.forEach((p) => {
      list.push({ title: p.name, category: "Portals", path: p.path, icon: p.icon });
    });
    return list;
  }, [navGroups, portalShortcuts]);

  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return searchableItems.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return searchableItems.filter((i) => i.title.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [searchableItems, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-mazzard flex antialiased">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar - Matching Business Admin Portal Header UI Pattern */}
      <aside
        data-lenis-prevent="true"
        data-lenis-prevent-wheel="true"
        onWheel={handleSidebarWheel}
        className={`fixed top-0 left-0 z-50 h-screen bg-white border-r border-slate-200 shadow-sm transition-all duration-300 flex flex-col overflow-hidden ${
          collapsed ? "w-20" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/Icon@4x-8.png"
              alt="Techno Vanam Logo"
              className="h-10 w-10 object-contain rounded-lg flex-shrink-0"
            />
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900 truncate">Techno Vanam</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-600">
                  Super Admin
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-slate-100 transition"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items list */}
        <nav
          ref={navRef}
          data-lenis-prevent="true"
          data-lenis-prevent-wheel="true"
          className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4 scrollbar-thin"
        >
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!collapsed && (
                <p className="px-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.to ||
                  (item.to !== "/super-admin/dashboard" && location.pathname.startsWith(item.to));
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm font-semibold"
                        : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                    } ${collapsed ? "justify-center px-0" : ""}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}

          {/* Switch Portals Section */}
          {!collapsed && (
            <div className="pt-3 pb-1 border-t border-slate-100">
              <p className="px-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Other Portals
              </p>
              {portalShortcuts.map((portal) => {
                const Icon = portal.icon;
                return (
                  <Link
                    key={portal.path}
                    to={portal.path}
                    className="flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-blue-700 transition-all duration-200"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className="h-3.5 w-3.5 text-slate-500" />
                      <span className="truncate">{portal.name}</span>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                      {portal.badge}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Sidebar Footer with FY Badge & Profile Card */}
        <div className="px-3 pb-4 border-t border-slate-100 pt-3 flex-shrink-0 bg-white">
          {!collapsed && (
            <div className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-semibold text-blue-700 border border-blue-100">
              {getFYLabel()}
            </div>
          )}

          <div
            className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left ${
              collapsed ? "justify-center p-2" : ""
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shrink-0">
              SA
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {adminUser?.name || "Chief Platform Admin"}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {adminUser?.email || "admin@technovanam.com"}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={logout}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Sign out"
                aria-label="Sign out"
              >
                <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          collapsed ? "lg:ml-20" : "lg:ml-64"
        }`}
      >
        <main className="flex-1 w-full max-w-full p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* AI Assistant Widget in bottom right */}
      <AIAssistantWidget />

      {/* Global Command Palette Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Jump to business, module, ticket, or system setting…"
                className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {filteredSearchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No matching platform resources found.
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredSearchResults.map((res, idx) => {
                    const Icon = res.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          navigate(res.path);
                          setSearchOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-left transition group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center transition">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition">
                              {res.title}
                            </div>
                            <div className="text-[10px] text-gray-400">{res.category}</div>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-gray-500">
              <span>Navigate with arrow keys</span>
              <span>Press ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
