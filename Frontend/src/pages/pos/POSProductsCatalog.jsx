import React, { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Package, Search, QrCode, Plus, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProducts } from "../../hooks/useFirestore";

export default function POSProductsCatalog() {
  const navigate = useNavigate();
  const { products, loading } = useProducts();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = useMemo(() => {
    let list = Array.isArray(products) ? [...products] : [];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.hsn?.toLowerCase().includes(q) ||
          p.id?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Products & QR Code Catalog</h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse all products and their scan barcodes / QR codes for fast checkout
          </p>
        </div>

        <button
          onClick={() => navigate("/pos/billing")}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer shrink-0"
        >
          <span>Open Billing Terminal</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products by name, HSN code, or ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200 shrink-0">
          {filteredProducts.length} Items Listed
        </div>
      </div>

      {/* Products Grid with Large QR Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-lg border border-slate-200 p-8">
            <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No products found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Try searching with a different keyword</p>
          </div>
        ) : (
          filteredProducts.map((prod) => {
            const priceVal =
              typeof prod.price === "number"
                ? prod.price
                : parseFloat(String(prod.price || "0").replace(/[^0-9.-]+/g, "")) || 0;

            const qrPayload = JSON.stringify({
              id: prod.id,
              name: prod.name,
              hsn: prod.hsn,
              price: priceVal,
            });

            return (
              <div
                key={prod.id}
                className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs hover:border-blue-400 hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] tabular-nums font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                      HSN: {prod.hsn || "151800"}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {prod.unit || "Nos"}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 line-clamp-2">{prod.name}</h3>
                  <p className="text-lg font-bold text-slate-900 mt-1">₹{priceVal.toFixed(2)}</p>
                </div>

                {/* QR Code Center */}
                <div className="my-4 flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    <QRCodeSVG value={qrPayload} size={84} level="M" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-2">
                    Scan to Add in POS
                  </span>
                </div>

                <button
                  onClick={() => navigate("/pos/billing")}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Bill this Item</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
