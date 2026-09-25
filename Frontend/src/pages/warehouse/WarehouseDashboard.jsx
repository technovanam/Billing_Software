import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Warehouse, ScanBarcode,
  Package, TrendingDown, AlertTriangle, RefreshCw,
  Plus, ArrowRight, FileBarChart2, Link2, Trash2,
} from "lucide-react";
import { useWarehouseStats, useProducts } from "../../hooks/useWarehouse";
import { useOperator } from "../../context/OperatorContext";
import {
  PageContainer, PageHeader, StatCard, Card, Spinner, btnPrimary, btnSecondary, btnIcon,
} from "../../components/warehouse/WarehouseUI";

const TYPE_DOT_COLORS = {
  IN:           "bg-green-500",
  OUT:          "bg-red-500",
  TRANSFER_IN:  "bg-blue-500",
  TRANSFER_OUT: "bg-purple-500",
  ADJUSTMENT:   "bg-yellow-500",
  DAMAGE:       "bg-red-600",
};

function getTimeAgo(date) {
  if (!date) return "";
  const d = date?._seconds
    ? new Date(date._seconds * 1000)
    : date?.toDate
    ? date.toDate()
    : new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// ─── Main Warehouse Dashboard ────────────────────────────────────────────────
export default function WarehouseDashboard() {
  const { stats, loading, refetch } = useWarehouseStats();
  const { products, refetch: refetchProducts } = useProducts();
  const { operatorName } = useOperator();
  const navigate = useNavigate();

  // Derived totals
  const totalProds = products.length || stats?.totalProducts || 0;

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${operatorName || "Admin"}!`}
        subtitle="Here's what's happening with your inventory today."
        actions={
          <>
            <button
              onClick={() => navigate("/warehouse/damaged")}
              className="inline-flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              Damaged Stock
            </button>
            <button onClick={() => navigate("/warehouse/products")} className={btnSecondary}>
              <Package className="w-4 h-4 text-blue-600" />
              Manage Products
            </button>
            <button onClick={() => navigate("/warehouse/scan")} className={btnPrimary}>
              <ScanBarcode className="w-4 h-4" />
              Scan &amp; Stock In
            </button>
            <button
              onClick={() => {
                refetch();
                refetchProducts();
              }}
              className={btnIcon}
              title="Refresh Dashboard"
              aria-label="Refresh Dashboard"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </>
        }
      />

      {/* ── Stats Grid (5-Card Layout) ── */}
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6">
          <StatCard
            title="Total Products"
            value={totalProds}
            icon={<Package className="w-5 h-5 text-purple-600" />}
            subtext="View Catalog →"
            subtextColor="blue"
            onClick={() => navigate("/warehouse/products")}
          />
          <StatCard
            title="Usable Live Stock"
            value={(stats?.totalStock ?? 0).toLocaleString("en-IN")}
            icon={<Warehouse className="w-5 h-5 text-blue-500" />}
            subtext="Available Live"
            subtextColor="blue"
          />
          <StatCard
            title="Damaged / Wastage"
            value={(stats?.totalDamagedStock ?? 0).toLocaleString("en-IN")}
            valueLabel="Units separated"
            secondaryValue={stats?.totalDamagedValue > 0 ? `₹${(stats.totalDamagedValue).toLocaleString("en-IN")}` : undefined}
            secondaryValueLabel={stats?.totalDamagedValue > 0 ? "Est. Loss" : undefined}
            isSecondaryValueRed={true}
            icon={<Trash2 className="w-5 h-5 text-red-500" />}
            subtext="Damaged Pool →"
            subtextColor="orange"
            onClick={() => navigate("/warehouse/damaged")}
          />
          <StatCard
            title="Low Stock Items"
            value={stats?.lowStock ?? 0}
            icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
            onClick={() => navigate("/warehouse/products")}
            footer={
              <div className="flex items-center gap-2 text-xs">
                <span className="bg-orange-600 text-white px-2 py-0.5 rounded-full font-medium">
                  Attention
                </span>
                <span className="text-slate-500">At or below reorder level</span>
              </div>
            }
          />
          <StatCard
            title="Out of Stock Items"
            value={stats?.outOfStock ?? 0}
            icon={<TrendingDown className="w-5 h-5 text-purple-600" />}
            onClick={() => navigate("/warehouse/products")}
            footer={
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`${
                    (stats?.outOfStock ?? 0) > 0 ? "bg-red-600" : "bg-emerald-600"
                  } text-white px-2 py-0.5 rounded-full font-medium`}
                >
                  {(stats?.outOfStock ?? 0) > 0 ? "Depleted" : "All Available"}
                </span>
                <span className="text-slate-500">Zero units remaining</span>
              </div>
            }
          />
        </div>
      )}

      {/* ── Quick Navigation & Operations Shortcuts ── */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => navigate("/warehouse/products")}
          className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Package size={18} />
            </div>
            <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-sm font-semibold text-slate-800">Products Catalog</p>
          <p className="text-xs text-slate-400 mt-0.5">{totalProds} active items</p>
        </button>

        <button
          onClick={() => navigate("/warehouse/scan")}
          className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ScanBarcode size={18} />
            </div>
            <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-sm font-semibold text-slate-800">Scan &amp; Stock In</p>
          <p className="text-xs text-slate-400 mt-0.5">Quick barcode intake</p>
        </button>

        <button
          onClick={() => navigate("/warehouse/reports")}
          className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <FileBarChart2 size={18} />
            </div>
            <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-sm font-semibold text-slate-800">Stock Reports</p>
          <p className="text-xs text-slate-400 mt-0.5">Inventory reports & valuation</p>
        </button>

        <button
          onClick={() => navigate("/warehouse/damaged")}
          className="p-4 rounded-lg border border-red-200 bg-red-50/40 shadow-sm hover:shadow-md hover:border-red-400 transition-all text-left group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <Trash2 size={18} />
            </div>
            <ArrowRight size={14} className="text-slate-300 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-sm font-semibold text-slate-800">Damaged / Wastage</p>
          <p className="text-xs text-red-600 font-medium mt-0.5">Separate from live stock</p>
        </button>
      </div>

      {/* ── Recent Activity ── */}
      <Card
        title="Recent Activity"
        subtitle="Latest updates and notifications"
        actions={
          <button
            onClick={() => navigate("/warehouse/movements")}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            View All Movements →
          </button>
        }
      >
        <ul className="space-y-2">
          {!stats?.recentMovements?.length ? (
            <li className="flex items-start gap-3 p-3 rounded-lg">
              <div className="w-2 h-2 bg-gray-300 rounded-full mt-1.5 flex-shrink-0"></div>
              <div>
                <p className="text-sm text-gray-500">No recent activity</p>
                <p className="text-xs text-slate-400">Activity will appear here as you use the system</p>
              </div>
            </li>
          ) : (
            stats.recentMovements.slice(0, 5).map((m) => {
              const dotColor = TYPE_DOT_COLORS[m.type] || "bg-blue-500";
              const isPositive = m.quantity > 0;
              return (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-2 h-2 ${dotColor} rounded-full mt-1.5 flex-shrink-0`}></div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {isPositive ? `+${m.quantity}` : m.quantity} {m.productName || "Product"} (
                        {m.type})
                      </p>
                      <p className="text-xs text-slate-400">
                        {m.operatorName ? `by ${m.operatorName}` : "Stock movement"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap pl-2">
                    {getTimeAgo(m.createdAt)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </Card>
    </PageContainer>
  );
}
