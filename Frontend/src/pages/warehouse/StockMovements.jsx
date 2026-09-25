import React, { useState } from "react";
import {
  Filter, ChevronLeft, ChevronRight, RefreshCw,
  ArrowDown, ArrowUp, ArrowLeftRight, Package, User, Trash2,
} from "lucide-react";
import { useStockMovements } from "../../hooks/useWarehouse";
import { useProducts } from "../../hooks/useFirestore";
import { useOperator } from "../../context/OperatorContext";
import {
  PageContainer, PageHeader, Card, TableCard, EmptyRow, SkeletonRows,
  btnSecondary, btnIcon, inputClass, labelClass, theadClass, thClass, tbodyClass,
} from "../../components/warehouse/WarehouseUI";

const TYPE_STYLES = {
  IN:           { label: "IN",           cls: "bg-green-100 text-green-800", Icon: ArrowDown },
  OUT:          { label: "OUT",          cls: "bg-red-100 text-red-800",       Icon: ArrowUp   },
  TRANSFER_IN:  { label: "TRANSFER IN",  cls: "bg-blue-100 text-blue-700",       Icon: ArrowDown },
  TRANSFER_OUT: { label: "TRANSFER OUT", cls: "bg-violet-100 text-violet-700",   Icon: ArrowUp   },
  ADJUSTMENT:   { label: "ADJUSTMENT",   cls: "bg-amber-100 text-amber-700",     Icon: Package   },
  DAMAGE:       { label: "DAMAGED",      cls: "bg-red-100 text-red-700",         Icon: Trash2    },
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
  const { allProducts } = useProducts({});
  const { staffList } = useOperator();

  const [filterType, setFilterType] = useState("ALL");
  const [filterOperator, setFilterOperator] = useState("");
  const [filterBarcode, setFilterBarcode] = useState("");

  const { movements, loading, hasMore, hasPrev, nextPage, prevPage, refetch } = useStockMovements({
    type: filterType === "ALL" ? undefined : filterType,
    operatorName: filterOperator || undefined,
    productBarcode: filterBarcode || undefined,
  });

  const COLS = 6;

  const renderTableBody = () => {
    if (loading) return <SkeletonRows cols={COLS} />;
    if (movements.length === 0) {
      return <EmptyRow colSpan={COLS} message="No stock movements found matching criteria." />;
    }
    return movements.map((m) => {
      const style = TYPE_STYLES[m.type] || { label: m.type, cls: "bg-gray-100 text-gray-700", Icon: Package };
      const Icon = style.Icon;
      const isPositive = m.quantity > 0;

      return (
        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
          <td className="px-4 sm:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(m.createdAt)}</td>
          <td className="px-4 sm:px-6 py-4">
            <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{m.productName || "Product"}</p>
            {m.productBarcode && <p className="text-xs text-gray-400 font-mono">{m.productBarcode}</p>}
          </td>
          <td className="px-4 sm:px-6 py-4">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${style.cls}`}>
              <Icon size={12} />
              {style.label}
            </span>
          </td>
          <td className={`px-4 sm:px-6 py-4 text-right font-bold text-sm whitespace-nowrap ${isPositive ? "text-green-600" : "text-red-600"}`}>
            {isPositive ? `+${m.quantity}` : m.quantity}
          </td>
          <td className="px-4 sm:px-6 py-4">
            {m.operatorName ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-100 text-gray-800 px-2 py-0.5 rounded-lg whitespace-nowrap">
                <User size={11} className="text-gray-500" />
                {m.operatorName}
              </span>
            ) : (
              <span className="text-gray-400 text-sm">—</span>
            )}
          </td>
          <td className="px-4 sm:px-6 py-4 text-sm text-gray-500 max-w-xs">
            {m.transferGroupId ? (
              <span className="font-mono text-xs text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md" title={`Group ID: ${m.transferGroupId}`}>
                TX-{m.transferGroupId.slice(0, 8)}
              </span>
            ) : (
              m.referenceNo || m.remarks || "—"
            )}
          </td>
        </tr>
      );
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Stock Movements"
        subtitle="Audit trail of all warehouse stock events"
        actions={
          <button onClick={refetch} className={btnIcon} title="Refresh" aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="sm-type" className={labelClass}>Movement Type</label>
            <select id="sm-type" value={filterType} onChange={(e) => setFilterType(e.target.value)} className={inputClass}>
              <option value="ALL">All Types</option>
              {Object.keys(TYPE_STYLES).map((t) => (
                <option key={t} value={t}>{TYPE_STYLES[t].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sm-operator" className={labelClass}>Operator</label>
            <input id="sm-operator" type="text" value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)} placeholder="Filter by operator…" className={inputClass} />
          </div>
          <div>
            <label htmlFor="sm-barcode" className={labelClass}>Barcode</label>
            <input id="sm-barcode" type="text" value={filterBarcode} onChange={(e) => setFilterBarcode(e.target.value)} placeholder="Filter by barcode…" className={`${inputClass} font-mono`} />
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <TableCard minWidth="min-w-[860px]">
          <thead className={theadClass}>
            <tr>
              <th scope="col" className={thClass}>Timestamp</th>
              <th scope="col" className={thClass}>Product</th>
              <th scope="col" className={thClass}>Type</th>
              <th scope="col" className={`${thClass} text-right`}>Quantity</th>
              <th scope="col" className={thClass}>Operator</th>
              <th scope="col" className={thClass}>Reference / Transfer ID</th>
            </tr>
          </thead>
          <tbody className={tbodyClass}>{renderTableBody()}</tbody>
        </TableCard>

        {/* Cursor Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-600">Showing {movements.length} movements</p>
          <div className="flex items-center gap-2">
            <button onClick={prevPage} disabled={!hasPrev} className={btnSecondary}>
              <ChevronLeft size={16} />
              Previous
            </button>
            <button onClick={nextPage} disabled={!hasMore} className={btnSecondary}>
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
