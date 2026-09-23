import React, { useState } from "react";
import {
  ClipboardList, Filter, ChevronLeft, ChevronRight, RefreshCw,
  ArrowDown, ArrowUp, ArrowLeftRight, Package, User,
} from "lucide-react";
import { useStockMovements, useGodowns } from "../../hooks/useWarehouse";
import { useProducts } from "../../hooks/useFirestore";
import { useOperator } from "../../context/OperatorContext";

const TYPE_STYLES = {
  IN:           { label: "IN",           cls: "bg-emerald-100 text-emerald-700", Icon: ArrowDown },
  OUT:          { label: "OUT",          cls: "bg-rose-100 text-rose-700",       Icon: ArrowUp   },
  TRANSFER_IN:  { label: "TRANSFER IN",  cls: "bg-blue-100 text-blue-700",       Icon: ArrowDown },
  TRANSFER_OUT: { label: "TRANSFER OUT", cls: "bg-violet-100 text-violet-700",   Icon: ArrowUp   },
  ADJUSTMENT:   { label: "ADJUSTMENT",   cls: "bg-amber-100 text-amber-700",     Icon: Package   },
};

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts?._seconds ? new Date(ts._seconds * 1000) : (ts?.toDate ? ts.toDate() : new Date(ts));
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function StockMovements() {
  const { godowns } = useGodowns();
  const { allProducts } = useProducts({});
  const { staffList } = useOperator();

  const [filterGodown, setFilterGodown] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterOperator, setFilterOperator] = useState("");
  const [filterBarcode, setFilterBarcode] = useState("");

  const { movements, loading, hasMore, hasPrev, nextPage, prevPage, refetch } = useStockMovements({
    godownId: filterGodown || undefined,
    type: filterType === "ALL" ? undefined : filterType,
    operatorName: filterOperator || undefined,
    productBarcode: filterBarcode || undefined,
  });

  return (
    <div className="space-y-6">


      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700">
            <ClipboardList size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Stock Movements Ledger</h1>
            <p className="text-sm text-slate-500">Append-only audit trail of all warehouse stock events</p>
          </div>
        </div>
        <button
          onClick={refetch}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Godown</label>
            <select
              value={filterGodown}
              onChange={(e) => setFilterGodown(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Godowns</option>
              {godowns.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Movement Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Types</option>
              {Object.keys(TYPE_STYLES).map((t) => (
                <option key={t} value={t}>{TYPE_STYLES[t].label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Operator</label>
            <input
              type="text"
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              placeholder="Filter by operator…"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Barcode</label>
            <input
              type="text"
              value={filterBarcode}
              onChange={(e) => setFilterBarcode(e.target.value)}
              placeholder="Filter by barcode…"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : movements.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <ClipboardList className="mx-auto mb-2 text-slate-300" size={40} />
            <p className="text-sm">No stock movements found matching criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-xs border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5 font-bold">Timestamp</th>
                  <th className="px-5 py-3.5 font-bold">Product</th>
                  <th className="px-5 py-3.5 font-bold">Godown</th>
                  <th className="px-5 py-3.5 font-bold">Type</th>
                  <th className="px-5 py-3.5 font-bold text-right">Quantity</th>
                  <th className="px-5 py-3.5 font-bold">Operator</th>
                  <th className="px-5 py-3.5 font-bold">Reference / Transfer ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => {
                  const style = TYPE_STYLES[m.type] || { label: m.type, cls: "bg-slate-100 text-slate-700", Icon: Package };
                  const Icon = style.Icon;
                  const isPositive = m.quantity > 0;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(m.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900 truncate max-w-xs">{m.productName || "Product"}</p>
                        {m.productBarcode && (
                          <p className="text-xs text-slate-400 font-mono">{m.productBarcode}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium">
                        {m.godownName || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${style.cls}`}>
                          <Icon size={12} />
                          {style.label}
                        </span>
                      </td>
                      <td className={`px-5 py-3.5 text-right font-extrabold text-sm whitespace-nowrap ${
                        isPositive ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {isPositive ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {m.operatorName ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg">
                            <User size={11} className="text-slate-500" />
                            {m.operatorName}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 max-w-xs">
                        {m.transferGroupId ? (
                          <span className="font-mono text-[11px] text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md" title={`Group ID: ${m.transferGroupId}`}>
                            TX-{m.transferGroupId.slice(0, 8)}
                          </span>
                        ) : (
                          m.referenceNo || m.remarks || "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Cursor Pagination Controls */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-500">
            Showing {movements.length} movements
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={prevPage}
              disabled={!hasPrev}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <button
              onClick={nextPage}
              disabled={!hasMore}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
