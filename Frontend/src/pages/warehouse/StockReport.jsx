import React, { useState, useMemo } from "react";
import {
  FileBarChart2, Download, AlertTriangle, Package, RefreshCw,
  Search, AlertCircle, CheckCircle2,
} from "lucide-react";
import { useStockReport } from "../../hooks/useWarehouse";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

  return (
    <div className="w-full space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700">
            <FileBarChart2 size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Stock Report</h1>
            <p className="text-sm text-slate-500">Current inventory valuation and stock levels</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch && refetch()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh Stock Data"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : "text-slate-500"} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => exportToPdf(filtered, totals)}
            disabled={loading || filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-40 transition-colors shadow-sm"
          >
            <Download size={15} />
            Export PDF
          </button>
          <button
            onClick={() => exportToExcel(filtered, totals)}
            disabled={loading || filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
          >
            <Download size={15} />
            Export Excel
          </button>
        </div>
      </div>

      {/* ── Clean Filter Bar ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Items</option>
              <option value="OK">In Stock (Healthy)</option>
              <option value="LOW">Low Stock</option>
              <option value="OUT">Out of Stock</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Product name, barcode or SKU…"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Proper Stock Report Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Package size={40} className="mb-3 text-slate-300" />
            <p className="font-medium text-slate-600">No products match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Barcode</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Purchase Price (₹)</th>
                  <th className="px-4 py-3 text-right">Stock Value (₹)</th>
                  <th className="px-4 py-3 text-right">Min Level</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      row.totalStock === 0
                        ? "bg-rose-50/25"
                        : row.isLow
                        ? "bg-amber-50/25"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {row.barcode || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{row.category || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold ${
                        row.totalStock === 0
                          ? "text-rose-600"
                          : row.isLow
                          ? "text-amber-600"
                          : "text-slate-900"
                      }`}>
                        {row.totalStock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{row.unit || "Piece"}</td>
                    <td className="px-4 py-3 text-right text-slate-700 text-xs">
                      {row.purchasePrice > 0 ? `₹${row.purchasePrice.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 text-xs">
                      {row.stockValue > 0 ? `₹${row.stockValue.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">
                      {row.minStockLevel || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.totalStock === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          <AlertCircle size={10} /> OUT OF STOCK
                        </span>
                      ) : row.isLow ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          <AlertTriangle size={10} /> LOW STOCK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle2 size={10} /> IN STOCK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                  <td colSpan={5} className="px-4 py-3 uppercase tracking-wider text-slate-700">
                    Total ({filtered.length} Products)
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 font-extrabold text-sm">
                    {totals.totalStock.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-slate-500">—</td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-extrabold text-sm">
                    ₹{totals.totalStockValue.toLocaleString("en-IN")}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
