import React, { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  usePlatformBusinesses, 
  usePlatformBusinessUsers, 
  usePlatformBranches, 
  usePlatformGodowns, 
  usePlatformTerminals, 
  usePlatformPayments 
} from "../../../hooks/useSuperAdminFirestore";
import { useSuperAdminAuth } from "../../../context/SuperAdminAuthContext";
import ImpersonationModal from "../../../components/super-admin/ImpersonationModal";
import { Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { db } from "../../../lib/firebase/config";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  Building2,
  Users,
  GitBranch,
  Warehouse,
  Smartphone,
  CreditCard,
  Receipt,
  Activity,
  HelpCircle,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Layers,
  ShoppingBag,
  TrendingUp,
  FileText,
} from "lucide-react";

export default function BusinessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { startImpersonation } = useSuperAdminAuth();

  const [activeTab, setActiveTab] = useState("overview");
  const [impersonateModalOpen, setImpersonateModalOpen] = useState(false);
  const [isUpdatingFeatures, setIsUpdatingFeatures] = useState(false);

  // Firestore hooks
  const { businesses, loading: loadingBus } = usePlatformBusinesses();
  const { users, loading: loadingUsers } = usePlatformBusinessUsers();
  const { branches, loading: loadingBranches } = usePlatformBranches();
  const { godowns, loading: loadingGodowns } = usePlatformGodowns();
  const { terminals, loading: loadingTerminals } = usePlatformTerminals();
  const { payments, loading: loadingPayments } = usePlatformPayments();
  
  // We can just use empty arrays for tickets and logs if we don't have dedicated hooks yet, 
  // or fetch them. Since we migrated them, they exist but we might not have exposed them globally here.
  const allTickets = [];
  const allLogs = [];

  // Business data
  const business = useMemo(() => {
    if (!businesses.length) return null;
    return businesses.find(b => b.id === id);
  }, [id, businesses]);

  // Associated platform data
  const allUsers = useMemo(() => users.filter((u) => u.path.includes(id)), [users, id]);
  const allBranches = useMemo(() => branches.filter((b) => b.path.includes(id)), [branches, id]);
  const allGodowns = useMemo(() => godowns.filter((g) => g.path.includes(id)), [godowns, id]);
  const allTerminals = useMemo(() => terminals.filter((t) => t.path.includes(id)), [terminals, id]);
  const allPayments = useMemo(() => payments.filter((p) => p.path.includes(id)), [payments, id]);

  const isLoading = loadingBus || loadingUsers || loadingBranches || loadingGodowns || loadingTerminals || loadingPayments;

  const AVAILABLE_FEATURES = [
    { id: "pos", name: "POS Cashier Mode" },
    { id: "billing", name: "Billing & E-Way Bill" },
    { id: "multiBranch", name: "Multi-Outlet Sync" },
    { id: "reports", name: "Advanced Reports" },
    { id: "whatsapp", name: "WhatsApp Delivery" },
    { id: "api", name: "API Access" },
    { id: "crm", name: "CRM Module" },
    { id: "inventory", name: "Advanced Inventory" }
  ];

  const handleToggleFeatureOverride = async (featId) => {
    if (!business) return;
    setIsUpdatingFeatures(true);
    try {
      const currentOverrides = business.customFeatures || {};
      const newOverrides = { ...currentOverrides, [featId]: !currentOverrides[featId] };
      await updateDoc(doc(db, "users", id), {
        customFeatures: newOverrides,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      alert("Failed to update feature override.");
    } finally {
      setIsUpdatingFeatures(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-gray-400 flex flex-col items-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-base font-bold text-gray-900 mb-2">Loading Business Details...</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-12 text-center text-gray-400">
        <p className="text-base font-bold text-gray-900 mb-2">Business not found</p>
        <Link to="/super-admin/businesses" className="text-xs text-blue-600 hover:underline">
          Return to directory
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "users", label: "Users", icon: Users, count: allUsers.length },
    { id: "branches", label: "Branches", icon: GitBranch, count: allBranches.length },
    { id: "godowns", label: "Godowns", icon: Warehouse, count: allGodowns.length },
    { id: "terminals", label: "POS Terminals", icon: Smartphone, count: allTerminals.length },
    { id: "subscription", label: "Subscription", icon: Layers },
    { id: "payments", label: "Payments", icon: Receipt, count: allPayments.length },
    { id: "activity", label: "Activity", icon: Activity, count: allLogs.length },
    { id: "support", label: "Support", icon: HelpCircle, count: allTickets.length },
  ];

  const handleConfirmImpersonation = (bus, reason) => {
    startImpersonation(bus, reason);
    setImpersonateModalOpen(false);
    navigate("/dashboard");
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back button & quick navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/super-admin/businesses"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Businesses Directory</span>
        </Link>
      </div>

      {/* Top Business Card Header (White Card) */}
      <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Business identity */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-md shadow-blue-500/20 flex-shrink-0">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center font-black text-xl text-blue-600">
                {business.name.charAt(0)}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">{business.name}</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    business.status === "Active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                      : business.status === "Trial"
                      ? "bg-amber-50 text-amber-700 border-amber-200/60"
                      : "bg-rose-50 text-rose-700 border-rose-200/60"
                  }`}
                >
                  ● {business.status}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200/60 text-[10px] font-semibold text-gray-700">
                  Plan: {business.planName}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 mt-3 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 font-medium">ID:</span>
                  <span className="font-mono text-gray-800 font-semibold">{business.id}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 font-medium">Owner:</span>
                  <span className="text-gray-800 font-medium">{business.ownerName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-700">{business.ownerEmail}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-700">{business.ownerPhone}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 font-medium">GSTIN:</span>
                  <span className="font-mono text-gray-800 font-semibold">{business.gstin}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-700">{business.city}, {business.state}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-3 lg:self-start flex-shrink-0">
            <button
              type="button"
              onClick={() => setImpersonateModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm shadow-amber-500/20 transition flex items-center gap-2 active:scale-95"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Login as Business</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-gray-200 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span className="px-1.5 py-0.2 rounded-full bg-gray-100 border border-gray-200 text-[10px] text-gray-600">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {/* 1. OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Total Platform Sales</span>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                ₹{(business.totalSales / 100000).toFixed(2)}L
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold">Processed via Billing</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Total Purchases</span>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                ₹{(business.totalPurchases / 100000).toFixed(2)}L
              </div>
              <span className="text-[10px] text-gray-400">Vendor Outflows</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Catalog Items</span>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{business.productsCount}</div>
              <span className="text-[10px] text-blue-600 font-semibold">Active SKUs</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="text-xs text-gray-500 font-semibold">Subscription Expiry</span>
              <div className="text-base sm:text-lg font-bold font-mono text-gray-900 mt-1">{business.subscriptionExpiry}</div>
              <span className="text-[10px] text-gray-400">Renewal Cycle: {business.billingCycle}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Merchant Operational Footprint</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-gray-500">Operating Branches</div>
                  <div className="text-lg font-bold text-gray-900 mt-0.5">{business.branchesCount} Outlets</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-gray-500">Active Warehouses</div>
                  <div className="text-lg font-bold text-gray-900 mt-0.5">{business.godownsCount} Godowns</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-gray-500">POS Counters</div>
                  <div className="text-lg font-bold text-gray-900 mt-0.5">{business.terminalsCount} Terminals</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-gray-500">Authorized Users</div>
                  <div className="text-lg font-bold text-gray-900 mt-0.5">{business.usersCount} Staff Members</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Compliance & Registered Office</h3>
              <div className="space-y-2 text-xs text-gray-600">
                <p><strong>Registered Address:</strong> {business.address}</p>
                <p><strong>City & Pincode:</strong> {business.city}, {business.state} - {business.pincode}</p>
                <p><strong>GST Identification Number:</strong> <span className="font-mono text-blue-600 font-semibold">{business.gstin}</span></p>
                <p><strong>Account Created:</strong> {new Date(business.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. USERS */}
      {activeTab === "users" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Business Users & Operators</h3>
          </div>
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3.5 px-4">USER NAME</th>
                <th className="p-3.5 px-4">EMAIL ADDRESS</th>
                <th className="p-3.5 px-4">ROLE</th>
                <th className="p-3.5 px-4">BRANCH</th>
                <th className="p-3.5 px-4">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allUsers.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">No users listed.</td></tr>
              ) : (
                allUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-blue-50/20">
                    <td className="p-3.5 px-4 font-bold text-gray-900">{u.name}</td>
                    <td className="p-3.5 px-4 text-gray-500">{u.email}</td>
                    <td className="p-3.5 px-4"><span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-gray-700 text-[11px] font-medium">{u.role}</span></td>
                    <td className="p-3.5 px-4 text-gray-700">{u.branch}</td>
                    <td className="p-3.5 px-4"><span className="text-emerald-600 font-bold">● {u.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. BRANCHES */}
      {activeTab === "branches" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Store Locations & Outlets</h3>
          </div>
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3.5 px-4">BRANCH NAME</th>
                <th className="p-3.5 px-4">LOCATION</th>
                <th className="p-3.5 px-4">MANAGER</th>
                <th className="p-3.5 px-4">TERMINALS</th>
                <th className="p-3.5 px-4">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allBranches.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">No branches registered.</td></tr>
              ) : (
                allBranches.map((br) => (
                  <tr key={br.id} className="hover:bg-blue-50/20">
                    <td className="p-3.5 px-4 font-bold text-gray-900">{br.name}</td>
                    <td className="p-3.5 px-4 text-gray-500">{br.location}</td>
                    <td className="p-3.5 px-4 text-gray-700">{br.manager}</td>
                    <td className="p-3.5 px-4 font-mono text-gray-700">{br.terminalsCount}</td>
                    <td className="p-3.5 px-4"><span className="text-emerald-600 font-bold">● {br.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. GODOWNS */}
      {activeTab === "godowns" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Inventory Warehouses & Godowns</h3>
          </div>
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3.5 px-4">GODOWN NAME</th>
                <th className="p-3.5 px-4">ASSIGNED BRANCH</th>
                <th className="p-3.5 px-4">MANAGER</th>
                <th className="p-3.5 px-4">STOCK UNITS</th>
                <th className="p-3.5 px-4">VALUATION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allGodowns.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">No godowns configured.</td></tr>
              ) : (
                allGodowns.map((gdn) => (
                  <tr key={gdn.id} className="hover:bg-blue-50/20">
                    <td className="p-3.5 px-4 font-bold text-gray-900">{gdn.name}</td>
                    <td className="p-3.5 px-4 text-gray-500">{gdn.branch}</td>
                    <td className="p-3.5 px-4 text-gray-700">{gdn.manager}</td>
                    <td className="p-3.5 px-4 font-mono">{gdn.stockQuantity.toLocaleString()} units</td>
                    <td className="p-3.5 px-4 font-mono font-bold text-emerald-600">₹{(gdn.stockValue / 100000).toFixed(2)}L</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. POS TERMINALS */}
      {activeTab === "terminals" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">POS Lane Terminals</h3>
          </div>
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3.5 px-4">TERMINAL ID</th>
                <th className="p-3.5 px-4">DEVICE / OS</th>
                <th className="p-3.5 px-4">BRANCH</th>
                <th className="p-3.5 px-4">ASSIGNED CASHIER</th>
                <th className="p-3.5 px-4">APP VERSION</th>
                <th className="p-3.5 px-4">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allTerminals.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">No terminals active.</td></tr>
              ) : (
                allTerminals.map((t) => (
                  <tr key={t.id} className="hover:bg-blue-50/20">
                    <td className="p-3.5 px-4 font-mono font-bold text-blue-600">{t.id}</td>
                    <td className="p-3.5 px-4 text-gray-700">{t.device}</td>
                    <td className="p-3.5 px-4 text-gray-500">{t.branch}</td>
                    <td className="p-3.5 px-4 text-gray-800">{t.assignedCashier}</td>
                    <td className="p-3.5 px-4 font-mono">{t.appVersion}</td>
                    <td className="p-3.5 px-4">
                      <span className={`font-bold ${t.status === "Online" ? "text-emerald-600" : "text-gray-400"}`}>
                        ● {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. SUBSCRIPTION */}
      {activeTab === "subscription" && (
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Commercial Subscription Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-gray-500">Current Plan</span>
              <div className="text-lg font-bold text-gray-900 mt-1">{business.planName}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-gray-500">Billing Cycle</span>
              <div className="text-lg font-bold text-gray-900 mt-1">{business.billingCycle}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-gray-500">Renewal / Expiry Date</span>
              <div className="text-lg font-bold font-mono text-emerald-600 mt-1">{business.subscriptionExpiry}</div>
            </div>
          </div>
          
          {/* Feature Overrides */}
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Company-Level Feature Overrides</h3>
                <p className="text-[11px] text-gray-500 mt-1">Enable or disable specific modules independently of the base plan.</p>
              </div>
              {isUpdatingFeatures && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {AVAILABLE_FEATURES.map((feat) => {
                const isEnabled = business.customFeatures?.[feat.id] === true;
                return (
                  <button
                    key={feat.id}
                    onClick={() => handleToggleFeatureOverride(feat.id)}
                    disabled={isUpdatingFeatures}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition ${
                      isEnabled ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className={`text-xs font-semibold ${isEnabled ? "text-blue-700" : "text-gray-600"}`}>
                      {feat.name}
                    </span>
                    {isEnabled ? (
                      <ToggleRight className="w-5 h-5 text-blue-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 7. PAYMENTS */}
      {activeTab === "payments" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Platform Billing Invoices & Payments</h3>
          </div>
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3.5 px-4">PAYMENT ID</th>
                <th className="p-3.5 px-4">INVOICE NO</th>
                <th className="p-3.5 px-4">AMOUNT</th>
                <th className="p-3.5 px-4">METHOD</th>
                <th className="p-3.5 px-4">STATUS</th>
                <th className="p-3.5 px-4">DATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allPayments.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">No payment records found.</td></tr>
              ) : (
                allPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50/20">
                    <td className="p-3.5 px-4 font-mono font-bold text-blue-600">{p.id}</td>
                    <td className="p-3.5 px-4 font-mono text-gray-700">{p.invoiceNo}</td>
                    <td className="p-3.5 px-4 font-bold text-gray-900">₹{p.amount.toLocaleString()}</td>
                    <td className="p-3.5 px-4 text-gray-500">{p.paymentMethod}</td>
                    <td className="p-3.5 px-4"><span className="text-emerald-600 font-bold">● {p.status}</span></td>
                    <td className="p-3.5 px-4 text-gray-500">{p.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 8. ACTIVITY / AUDIT */}
      {activeTab === "activity" && (
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
          <h3 className="text-sm font-bold text-gray-900 mb-2">Audit History for this Tenant</h3>
          {allLogs.length === 0 ? (
            <div className="text-xs text-gray-400">No logged administrative actions on this tenant yet.</div>
          ) : (
            <div className="space-y-2">
              {allLogs.map((log) => (
                <div key={log.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-gray-900">{log.action}</span>
                    <span className="text-gray-500 ml-2">by {log.admin}</span>
                    <p className="text-gray-500 text-[11px] mt-0.5">{log.details}</p>
                  </div>
                  <span className="font-mono text-gray-400 text-[10px]">{log.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9. SUPPORT */}
      {activeTab === "support" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Support Tickets</h3>
          </div>
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3.5 px-4">TICKET ID</th>
                <th className="p-3.5 px-4">SUBJECT</th>
                <th className="p-3.5 px-4">PRIORITY</th>
                <th className="p-3.5 px-4">STATUS</th>
                <th className="p-3.5 px-4">UPDATED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allTickets.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">No support tickets logged.</td></tr>
              ) : (
                allTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-blue-50/20">
                    <td className="p-3.5 px-4 font-mono font-bold text-blue-600">{t.id}</td>
                    <td className="p-3.5 px-4 font-semibold text-gray-900">{t.subject}</td>
                    <td className="p-3.5 px-4"><span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-gray-700">{t.priority}</span></td>
                    <td className="p-3.5 px-4"><span className="text-amber-600 font-bold">● {t.status}</span></td>
                    <td className="p-3.5 px-4 text-gray-500">{t.updatedAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Impersonation Modal */}
      <ImpersonationModal
        business={business}
        isOpen={impersonateModalOpen}
        onClose={() => setImpersonateModalOpen(false)}
        onConfirm={handleConfirmImpersonation}
      />
    </div>
  );
}
