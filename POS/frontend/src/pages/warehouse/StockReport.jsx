import React, { useState, useMemo } from "react";
import {
  FileBarChart2, Download, AlertTriangle, Package, RefreshCw,
  Search, AlertCircle, CheckCircle2,
} from "lucide-react";
import { useStockReport } from "../../hooks/useWarehouse";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PageContainer, PageHeader, StatCard, StatGrid, Card, TableCard, EmptyRow, SkeletonRows,
  btnPrimary, btnSecondary, inputClass, labelClass, theadClass, thClass, tbodyClass,
} from "../../components/warehouse/WarehouseUI";

// ─── Excel Export ────────────────────────────────────────────────────────────
async function exportToExcel(rows, totals) {
  const XLSX = await import("xlsx");

  const data = rows.map((r, idx) => ({
    "#": idx + 1,
    "Product Name": r.name,
    "Barcode": r.barcode || "—",
    "Category": r.category || "—",
    "Stock": r.totalStock,
    "Unit": r.unit || "Piece",
    "Purchase Price (₹)": r.purchasePrice > 0 ? r.purchasePrice : 0,
    "Stock Value (₹)": r.stockValue > 0 ? r.stockValue : 0,
    "Min Level": r.minStockLevel || 0,
    "Status": r.totalStock === 0 ? "Out of Stock" : r.isLow ? "Low Stock" : "In Stock",
  }));

  // Summary row
  data.push({
    "#": "",
    "Product Name": `TOTAL (${rows.length} Products)`,
    "Barcode": "",
    "Category": "",
    "Stock": totals.totalStock,
    "Unit": "",
    "Purchase Price (₹)": "",
    "Stock Value (₹)": totals.totalStockValue,
    "Min Level": "",
    "Status": "",
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stock Report");
  XLSX.writeFile(wb, `stock-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── PDF Export ──────────────────────────────────────────────────────────────
function exportToPdf(rows, totals) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Stock Report", 14, 15);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [["#", "Product Name", "Barcode", "Category", "Stock", "Unit", "Purchase Price (₹)", "Stock Value (₹)", "Min Level", "Status"]],
    body: rows.map((r, i) => [
      (i + 1).toString(),
      r.name,
      r.barcode || "—",
      r.category || "—",
      (r.totalStock || 0).toString(),
      r.unit || "Piece",
      r.purchasePrice > 0 ? `₹${Number(r.purchasePrice).toLocaleString("en-IN")}` : "—",
      r.stockValue > 0 ? `₹${Number(r.stockValue).toLocaleString("en-IN")}` : "—",
      (r.minStockLevel || 0).toString(),
      r.totalStock === 0 ? "OUT OF STOCK" : r.isLow ? "LOW STOCK" : "IN STOCK",
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    didParseCell: (data) => {
      const status = data.row.raw?.[9];
      if (data.column.index === 9) {
        if (status === "OUT OF STOCK") data.cell.styles.textColor = [220, 38, 38];
        else if (status === "LOW STOCK") data.cell.styles.textColor = [217, 119, 6];
        else data.cell.styles.textColor = [5, 150, 105];
      }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const finalY = doc.lastAutoTable?.finalY || 160;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Total Products: ${rows.length}   |   Total Stock: ${totals.totalStock.toLocaleString("en-IN")}   |   Total Stock Value: Rs. ${totals.totalStockValue.toLocaleString("en-IN")}`,
    14,
    Math.min(195, finalY + 10)
  );

  doc.save(`stock-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function StockReport() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const { reportData, loading, refetch } = useStockReport("product");

  // Transform reportData with proper report fields
  const reportRows = useMemo(() => {
    return (reportData || []).map((item) => {
      const p = item.product || item || {};
      const name = item.name || p.name || "Product";
      const barcode = item.barcode || p.barcode || "";
      const sku = item.sku || p.sku || "";
      const category = item.category || p.category || "General";
      const brand = item.brand || p.brand || "";
      const unit = item.unit || p.unit || "Piece";
      const purchasePrice = Number(item.purchasePrice || p.purchasePrice) || 0;
      const min = Number(item.minStockLevel ?? p.minStockLevel ?? 0);
      const total = Number(item.totalStock ?? item.totalQuantity ?? item.stock ?? p.stock ?? 0);

      const isLow = total === 0 || (min > 0 && total <= min);
      const stockValue = total * purchasePrice;

      return {
        id: item.id || item.productId || p.id || barcode,
        name,
        barcode,
        sku,
        category,
        brand,
        unit,
        purchasePrice,
        minStockLevel: min,
        totalStock: total,
        stockValue,
        isLow,
      };
    });
  }, [reportData]);

  // Filtered rows
  const filtered = useMemo(() => {
    return reportRows.filter((r) => {
      const matchSearch =
        !search ||
        r.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.barcode?.toLowerCase().includes(search.toLowerCase()) ||
        r.sku?.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        filterStatus === "ALL" ||
        (filterStatus === "OK" && !r.isLow && r.totalStock > 0) ||
        (filterStatus === "LOW" && r.isLow && r.totalStock > 0) ||
        (filterStatus === "OUT" && r.totalStock === 0);

      return matchSearch && matchStatus;
    });
  }, [reportRows, search, filterStatus]);

  // Aggregate totals
  const totals = useMemo(() => {
    const totalStock = filtered.reduce((s, r) => s + r.totalStock, 0);
    const totalStockValue = filtered.reduce((s, r) => s + r.stockValue, 0);
    const lowCount = filtered.filter((r) => r.isLow || r.totalStock === 0).length;
    return { totalStock, totalStockValue, lowCount };
  }, [filtered]);

  const COLS = 10;

  const renderTableBody = () => {
    if (loading) return <SkeletonRows cols={COLS} />;
    if (filtered.length === 0) return <EmptyRow colSpan={COLS} message="No products match your filters." />;
    return filtered.map((row, idx) => (
      <tr
        key={row.id}
        className={`hover:bg-gray-50 transition-colors ${
          row.totalStock === 0 ? "bg-red-50/30" : row.isLow ? "bg-amber-50/30" : ""
        }`}
      >
        <td className="px-4 sm:px-6 py-4 text-sm text-gray-500">{idx + 1}</td>
        <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">{row.name}</td>
        <td className="px-4 sm:px-6 py-4">
          <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{row.barcode || "—"}</span>
        </td>
        <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{row.category || "—"}</td>
        <td className="px-4 sm:px-6 py-4 text-right">
          <span
            className={`text-sm font-bold ${
              row.totalStock === 0 ? "text-red-600" : row.isLow ? "text-amber-600" : "text-gray-900"
            }`}
          >
            {row.totalStock}
          </span>
        </td>
        <td className="px-4 sm:px-6 py-4 text-sm text-gray-500">{row.unit || "Piece"}</td>
        <td className="px-4 sm:px-6 py-4 text-right text-sm text-gray-700">
          {row.purchasePrice > 0 ? `₹${row.purchasePrice.toLocaleString("en-IN")}` : "—"}
        </td>
        <td className="px-4 sm:px-6 py-4 text-right text-sm font-medium text-gray-900">
          {row.stockValue > 0 ? `₹${row.stockValue.toLocaleString("en-IN")}` : "—"}
        </td>
        <td className="px-4 sm:px-6 py-4 text-right text-sm text-gray-500">{row.minStockLevel || "—"}</td>
        <td className="px-4 sm:px-6 py-4 text-center">
          {row.totalStock === 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium whitespace-nowrap">
              <AlertCircle size={11} /> Out of Stock
            </span>
          ) : row.isLow ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium whitespace-nowrap">
              <AlertTriangle size={11} /> Low Stock
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium whitespace-nowrap">
              <CheckCircle2 size={11} /> In Stock
            </span>
          )}
        </td>
      </tr>
    ));
  };

  return (
    <PageContainer>
      <PageHeader
        title="Stock Report"
        subtitle="Current inventory valuation and stock levels"
        actions={
          <>
            <button onClick={() => refetch && refetch()} disabled={loading} className={btnSecondary} title="Refresh Stock Data">
              <RefreshCw size={16} className={loading ? "animate-spin text-blue-600" : "text-gray-500"} />
              Refresh
            </button>
            <button onClick={() => exportToPdf(filtered, totals)} disabled={loading || filtered.length === 0} className={btnSecondary}>
              <Download size={16} className="text-red-600" />
              Export PDF
            </button>
            <button onClick={() => exportToExcel(filtered, totals)} disabled={loading || filtered.length === 0} className={btnPrimary}>
              <Download size={16} />
              Export Excel
            </button>
          </>
        }
      />

      <StatGrid cols={3}>
        <StatCard
          title="Products in Report"
          value={filtered.length}
          valueLabel={filterStatus === "ALL" && !search ? "All products" : "Matching filters"}
          icon={<Package className="w-5 h-5 text-purple-600" />}
        />
        <StatCard
          title="Total Stock Units"
          value={totals.totalStock.toLocaleString("en-IN")}
          secondaryValue={`₹${totals.totalStockValue.toLocaleString("en-IN")}`}
          secondaryValueLabel="Stock value"
          icon={<FileBarChart2 className="w-5 h-5 text-blue-500" />}
        />
        <StatCard
          title="Needs Attention"
          value={totals.lowCount}
          valueLabel="Low or out of stock"
          icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
        />
      </StatGrid>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="sr-status" className={labelClass}>Status</label>
            <select id="sr-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputClass}>
              <option value="ALL">All Items</option>
              <option value="OK">In Stock (Healthy)</option>
              <option value="LOW">Low Stock</option>
              <option value="OUT">Out of Stock</option>
            </select>
          </div>
          <div>
            <label htmlFor="sr-search" className={labelClass}>Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="sr-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Product name, barcode or SKU…"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>
        </div>
      </Card>

      <TableCard minWidth="min-w-[1000px]">
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={thClass}>#</th>
            <th scope="col" className={thClass}>Product Name</th>
            <th scope="col" className={thClass}>Barcode</th>
            <th scope="col" className={thClass}>Category</th>
            <th scope="col" className={`${thClass} text-right`}>Stock</th>
            <th scope="col" className={thClass}>Unit</th>
            <th scope="col" className={`${thClass} text-right`}>Purchase Price (₹)</th>
            <th scope="col" className={`${thClass} text-right`}>Stock Value (₹)</th>
            <th scope="col" className={`${thClass} text-right`}>Min Level</th>
            <th scope="col" className={`${thClass} text-center`}>Status</th>
          </tr>
        </thead>
        <tbody className={tbodyClass}>{renderTableBody()}</tbody>
        {!loading && filtered.length > 0 && (
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200 text-sm font-semibold text-gray-900">
              <td colSpan={4} className="px-4 sm:px-6 py-3">Total ({filtered.length} Products)</td>
              <td className="px-4 sm:px-6 py-3 text-right font-bold">{totals.totalStock.toLocaleString("en-IN")}</td>
              <td className="px-4 sm:px-6 py-3" />
              <td className="px-4 sm:px-6 py-3 text-right text-gray-500">—</td>
              <td className="px-4 sm:px-6 py-3 text-right font-bold text-green-700">
                ₹{totals.totalStockValue.toLocaleString("en-IN")}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </TableCard>
    </PageContainer>
  );
}
