import React, { useState, useEffect, useMemo } from "react";
import { Outlet, NavLink, useLocation, useNavigate, Link } from "react-router-dom";
import { useSuperAdminAuth } from "../../../context/SuperAdminAuthContext";
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
  Bell,
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
  Menu,
  X,
  Search,
  LogOut,
  User,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

export default function SuperAdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { adminUser, logout } = useSuperAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setProfileMenuOpen(false);
    setNotificationsOpen(false);
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
        title: "DASHBOARD",
        items: [{ to: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
      },
      {
        title: "PLATFORM",
        items: [
          { to: "/super-admin/businesses", label: "Businesses", icon: Building2 },
          { to: "/super-admin/branches", label: "Branches", icon: GitBranch },
          { to: "/super-admin/users", label: "Users", icon: Users },
          { to: "/super-admin/pos-terminals", label: "POS Terminals", icon: Smartphone },
          { to: "/super-admin/godowns", label: "Godowns", icon: Warehouse },
        ],
      },
      {
        title: "SUBSCRIPTIONS",
        items: [
          { to: "/super-admin/plans", label: "Plans", icon: Layers },
          { to: "/super-admin/subscriptions", label: "Subscriptions", icon: CreditCard },
          { to: "/super-admin/payments", label: "Payments", icon: Receipt },
          { to: "/super-admin/revenue", label: "Revenue", icon: TrendingUp },
          { to: "/super-admin/coupons", label: "Coupons", icon: TicketPercent },
        ],
      },
      {
        title: "ANALYTICS",
        items: [{ to: "/super-admin/analytics", label: "Platform Analytics", icon: BarChart3 }],
      },
      {
        title: "SUPPORT",
        items: [
          { to: "/super-admin/support", label: "Tickets", icon: HelpCircle },
          { to: "/super-admin/announcements", label: "Announcements", icon: Megaphone },
        ],
      },
      {
        title: "SECURITY",
        items: [
          { to: "/super-admin/admin-users", label: "Admin Users", icon: Shield },
          { to: "/super-admin/roles", label: "Roles & Permissions", icon: KeyRound },
          { to: "/super-admin/audit-logs", label: "Audit Logs", icon: FileText },
          { to: "/super-admin/login-activity", label: "Login Activity", icon: Clock },
          { to: "/super-admin/sessions", label: "Active Sessions", icon: Laptop },
        ],
      },
      {
        title: "SYSTEM",
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

  // Search items for command palette
  const searchableItems = useMemo(() => {
    const list = [];
    navGroups.forEach((g) => {
      g.items.forEach((item) => {
        list.push({ title: item.label, category: g.title, path: item.to, icon: item.icon });
      });
    });
    list.push(
      { title: "ABC Traders & Electronics (BUS-00124)", category: "Business", path: "/super-admin/businesses/BUS-00124", icon: Building2 },
      { title: "Kaveri Supermarket Chain (BUS-00125)", category: "Business", path: "/super-admin/businesses/BUS-00125", icon: Building2 },
      { title: "Ticket #TCK-4081 (Thermal printer issue)", category: "Support Ticket", path: "/super-admin/support", icon: HelpCircle },
      { title: "Create Platform Backup", category: "System Action", path: "/super-admin/backups", icon: Database }
    );
    return list;
  }, [navGroups]);

  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return searchableItems.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return searchableItems.filter((i) => i.title.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [searchableItems, searchQuery]);

  // Current page title
  const currentTitle = useMemo(() => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (location.pathname === item.to || location.pathname.startsWith(item.to + "/")) {
          return item.label;
        }
      }
    }
    return "Super Admin Portal";
  }, [location.pathname, navGroups]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-mazzard flex antialiased">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar - Pure White Light Theme Matching Billing Portal */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen bg-white border-r border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all duration-300 flex flex-col overflow-hidden ${
          collapsed ? "w-20" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 flex-shrink-0 shadow-md shadow-blue-500/20">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            {!collapsed && (
              <div className="truncate">
                <div className="text-sm font-black tracking-tight text-gray-900 truncate">Techno Vanam</div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">
                  Super Admin
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items list */}
        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 py-4 space-y-6 scrollbar-thin">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx}>
              {!collapsed && (
                <div className="px-3 mb-2 text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">
                  {group.title}
                </div>
              )}
              <div className="space-y-1">
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
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                          : "text-gray-600 hover:text-gray-900 hover:bg-slate-50"
                      } ${collapsed ? "justify-center px-0" : ""}`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer User Card */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <div
            className={`flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200/80 shadow-sm ${
              collapsed ? "justify-center p-2" : ""
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
              SA
            </div>
            {!collapsed && (
              <div className="truncate flex-1">
                <div className="text-xs font-bold text-gray-900 truncate">{adminUser?.name || "Super Admin"}</div>
                <div className="text-[10px] text-gray-500 truncate">{adminUser?.role || "Chief Admin"}</div>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={logout}
                title="Log out"
                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        {/* Top Header - Pure White Light Theme */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-4 shadow-sm">
          {/* Left: Mobile menu toggle + Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-900"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Link to="/super-admin/dashboard" className="hover:text-blue-600 transition">
                  Super Admin
                </Link>
                <span>/</span>
                <span className="text-gray-700 font-medium">{currentTitle}</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-none mt-0.5">{currentTitle}</h1>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Admin Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                  SA
                </div>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-fadeIn text-xs">
                  <div className="p-3 border-b border-slate-100">
                    <div className="font-bold text-gray-900">{adminUser?.name || "Chief Admin"}</div>
                    <div className="text-gray-500 truncate text-[11px]">{adminUser?.email}</div>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <Link
                      to="/super-admin/admin-users"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 hover:bg-slate-50 transition font-medium"
                    >
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span>My Profile</span>
                    </Link>
                    <Link
                      to="/super-admin/roles"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 hover:bg-slate-50 transition font-medium"
                    >
                      <Shield className="w-3.5 h-3.5 text-gray-400" />
                      <span>Security & Permissions</span>
                    </Link>
                    <Link
                      to="/super-admin/sessions"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 hover:bg-slate-50 transition font-medium"
                    >
                      <Laptop className="w-3.5 h-3.5 text-gray-400" />
                      <span>Active Sessions</span>
                    </Link>
                    <Link
                      to="/super-admin/settings"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 hover:bg-slate-50 transition font-medium"
                    >
                      <Settings className="w-3.5 h-3.5 text-gray-400" />
                      <span>Platform Settings</span>
                    </Link>
                  </div>

                  <div className="pt-1 mt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={logout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 w-full max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

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
                <div className="py-8 text-center text-xs text-gray-400">No matching platform resources found.</div>
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
