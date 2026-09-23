import React, { useState, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { superAdminService } from "../../../services/superAdminDataService";
import { useSuperAdminAuth } from "../../../context/SuperAdminAuthContext";
import ImpersonationModal from "../../../components/super-admin/ImpersonationModal";
import {
  Building2,
  Search,
  Filter,
  Download,
  Eye,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  ExternalLink,
  ChevronDown,
  Layers,
  ArrowUpDown,
  Plus,
} from "lucide-react";

export default function BusinessesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "All";

  const [businesses, setBusinesses] = useState(() => superAdminService.getBusinesses());
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [planFilter, setPlanFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Impersonation modal state
  const [selectedForImpersonate, setSelectedForImpersonate] = useState(null);

  const { startImpersonation } = useSuperAdminAuth();
  const navigate = useNavigate();

  // Status Filter Tabs
  const statusTabs = ["All", "Active", "Trial", "Suspended", "Expired"];

  // Toggle Suspend / Activate
  const handleToggleStatus = (id, currentStatus) => {
    const nextStatus = currentStatus === "Active" ? "Suspended" : "Active";
    const updated = superAdminService.toggleBusinessStatus(id, nextStatus);
    if (updated) {
      setBusinesses(superAdminService.getBusinesses());
    }
  };

  // Extend Subscription
  const handleExtend = (id) => {
    const bus = businesses.find((b) => b.id === id);
    if (!bus) return;
    const currentExp = new Date(bus.subscriptionExpiry || Date.now());
    currentExp.setDate(currentExp.getDate() + 30);
    const newExp = currentExp.toISOString().slice(0, 10);
    superAdminService.updateBusiness(id, { subscriptionExpiry: newExp });
    setBusinesses(superAdminService.getBusinesses());
    alert(`Extended subscription for ${bus.name} by 30 days to ${newExp}`);
  };

  // Filter & Search & Sort
  const filteredList = useMemo(() => {
    return businesses
      .filter((b) => {
        if (statusFilter !== "All" && b.status !== statusFilter) return false;
        if (planFilter !== "All" && b.planName !== planFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = b.name.toLowerCase().includes(q);
          const matchId = b.id.toLowerCase().includes(q);
          const matchOwner = b.ownerName.toLowerCase().includes(q);
          const matchEmail = b.ownerEmail.toLowerCase().includes(q);
          const matchCity = (b.city || "").toLowerCase().includes(q);
          if (!matchName && !matchId && !matchOwner && !matchEmail && !matchCity) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField] || "";
        let valB = b[sortField] || "";
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [businesses, statusFilter, planFilter, searchQuery, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedItems = filteredList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // CSV Export
  const handleExportCSV = () => {
    const headers = ["Business ID,Name,Owner,Email,Phone,GSTIN,Plan,Status,Expiry,Sales,Branches,Users\n"];
    const rows = filteredList.map((b) =>
      `"${b.id}","${b.name}","${b.ownerName}","${b.ownerEmail}","${b.phone}","${b.gstin}","${b.planName}","${b.status}","${b.subscriptionExpiry}","${b.totalSales}","${b.branchesCount}","${b.usersCount}"`
    );
    const blob = new Blob([headers.concat(rows.join("\n"))], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `technovanam_businesses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Impersonation Start
  const handleConfirmImpersonation = (business, reason) => {
    startImpersonation(business, reason);
    setSelectedForImpersonate(null);
    navigate("/dashboard");
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Businesses Management</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manage and monitor {businesses.length} registered business tenants across your platform.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold flex items-center gap-2 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Status Filter Tabs + Search + Plan Selector */}
      <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-4">
        {/* Status Tabs (Segmented pills matching Delivery Challan screenshot) */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200/60 w-fit">
          {statusTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setStatusFilter(tab);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === tab
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search Bar + Secondary Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by business name, ID, owner, email, or city…"
              className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Plan Filter */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 shadow-sm">
              <Layers className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={planFilter}
                onChange={(e) => {
                  setPlanFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs text-gray-800 focus:outline-none cursor-pointer"
              >
                <option value="All">All Plans</option>
                <option value="Free Trial">Free Trial</option>
                <option value="Starter">Starter</option>
                <option value="Professional">Professional</option>
                <option value="Business">Business</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>

            {/* Sort field selector */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 shadow-sm">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="bg-transparent text-xs text-gray-800 focus:outline-none cursor-pointer"
              >
                <option value="name">Sort: Name</option>
                <option value="totalSales">Sort: Sales</option>
                <option value="usersCount">Sort: Users</option>
                <option value="subscriptionExpiry">Sort: Expiry</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Businesses Table (Pure White Card with Light Headers) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700 border-collapse">
            <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="py-3.5 px-4">BUSINESS</th>
                <th className="py-3.5 px-4">OWNER CONTACT</th>
                <th className="py-3.5 px-4">PLAN</th>
                <th className="py-3.5 px-4">BRANCHES</th>
                <th className="py-3.5 px-4">USERS</th>
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-4">EXPIRY DATE</th>
                <th className="py-3.5 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    No businesses found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((bus) => (
                  <tr key={bus.id} className="text-sm transition-colors hover:bg-gray-50 group">
                    {/* Business Name & ID */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                          {bus.name.charAt(0)}
                        </div>
                        <div>
                          <Link
                            to={`/super-admin/businesses/${bus.id}`}
                            className="font-bold text-gray-900 hover:text-blue-600 transition"
                          >
                            {bus.name}
                          </Link>
                          <div className="text-[10px] font-mono text-gray-400">{bus.id} • {bus.city}</div>
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-900">{bus.ownerName}</div>
                      <div className="text-[10px] text-gray-400">{bus.ownerEmail}</div>
                    </td>

                    {/* Plan */}
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200/60 text-[11px] font-semibold text-gray-700">
                        {bus.planName}
                      </span>
                    </td>

                    {/* Branches */}
                    <td className="py-3.5 px-4 font-mono font-medium text-gray-700">{bus.branchesCount}</td>

                    {/* Users */}
                    <td className="py-3.5 px-4 font-mono font-medium text-gray-700">{bus.usersCount}</td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          bus.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                            : bus.status === "Trial"
                            ? "bg-amber-50 text-amber-700 border-amber-200/60"
                            : "bg-rose-50 text-rose-700 border-rose-200/60"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            bus.status === "Active"
                              ? "bg-emerald-500"
                              : bus.status === "Trial"
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                        />
                        {bus.status}
                      </span>
                    </td>

                    {/* Expiry */}
                    <td className="py-3.5 px-4 font-mono text-gray-600">{bus.subscriptionExpiry}</td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Login as Business */}
                        <button
                          type="button"
                          onClick={() => setSelectedForImpersonate(bus)}
                          title="Login as Business (Impersonate for Support)"
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 text-[11px] font-semibold transition flex items-center gap-1"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">Login as Business</span>
                        </button>

                        {/* View Details */}
                        <Link
                          to={`/super-admin/businesses/${bus.id}`}
                          title="View Business Details"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-gray-600 hover:text-gray-900 border border-slate-200/60 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>

                        {/* Suspend / Activate Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(bus.id, bus.status)}
                          title={bus.status === "Active" ? "Suspend Business" : "Activate Business"}
                          className={`p-1.5 rounded-lg border transition ${
                            bus.status === "Active"
                              ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                              : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                          }`}
                        >
                          {bus.status === "Active" ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>

                        {/* Extend Subscription */}
                        <button
                          type="button"
                          onClick={() => handleExtend(bus.id)}
                          title="Extend 30 Days"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-gray-600 hover:text-gray-900 border border-slate-200/60 transition"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-white border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, filteredList.length)} of {filteredList.length} businesses
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm font-medium"
            >
              Previous
            </button>
            <span className="font-semibold text-gray-800">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Impersonation Confirmation Modal */}
      <ImpersonationModal
        business={selectedForImpersonate}
        isOpen={!!selectedForImpersonate}
        onClose={() => setSelectedForImpersonate(null)}
        onConfirm={handleConfirmImpersonation}
      />
    </div>
  );
}
