import React from "react";
import { Link } from "react-router-dom";
import { Save, Eye, FileText, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { GST_RATES, STATES, SUPPLY_TYPES, CURRENCIES, isExport, forcesInterState, inrFactor } from "../../utils/gst.js";
import { withPlaceOfSupply, sellerHasState, withSupplyType } from "../../utils/invoiceForm.js";
import { ClientAutocomplete, ProductAutocomplete } from "../../components/InvoiceAutocomplete.jsx";
import { useCostCentres, useGodowns } from "../../hooks/useFirestore";

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cellInput = "w-full px-2.5 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";


export default function CreateInvoiceComponent({
  editingInvoice,
  invoiceData,
  clients = [],
  products = [],
  calculations = {},
  setCurrentPage,
  saveDraft,
  handlePreview,
  updateInvoice,
  saveInvoice,
  setInvoiceData,
  handleClientSelect,
  handleAddNewProduct,
  addItem,
  updateItem,
  removeItem,
  handleToggleRoundOff,
  handleToggleGst,
  applyProductToItem,
}) {
  const { companyProfile } = useCompanyProfile();
  const { names: costCentres } = useCostCentres();
  const { names: godowns } = useGodowns();
  const bank = companyProfile?.bank || {};
  const items = invoiceData.items || invoiceData.products || [];
  const calc = calculations || {};
  const gstOn = invoiceData.isGstEnabled !== false;
  const isInterState = Boolean(invoiceData.isInterState);
  const supplyType = invoiceData.supplyType || "REGULAR";
  const exportBill = isExport(invoiceData);
  const cur = invoiceData.currency && invoiceData.currency !== "INR" ? invoiceData.currency : "₹";
  const setField = (k) => (e) => setInvoiceData((prev) => ({ ...prev, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <button
              onClick={() => setCurrentPage ? setCurrentPage("management") : window.history.back()}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {editingInvoice ? "Edit Invoice" : "Create Invoice"}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {editingInvoice
                  ? "Update details for an existing invoice"
                  : "Create a new invoice for your client"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 text-sm font-medium">
            <button
              onClick={() => setCurrentPage ? setCurrentPage("management") : window.history.back()}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={saveDraft}
              className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </button>
            <button
              onClick={handlePreview}
              className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </button>
            <button
              onClick={editingInvoice ? updateInvoice : saveInvoice}
              className="flex items-center px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              {editingInvoice ? "Update Invoice" : "Save Invoice"}
            </button>
          </div>
        </div>
        <main className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 lg:col-span-2 space-y-6">
            <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Invoice Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm text-gray-700">
                      Invoice Number <span className="text-red-500">*</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={invoiceData.invoiceNumber}
                    onChange={(e) =>
                      setInvoiceData((prev) => ({
                        ...prev,
                        invoiceNumber: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    max="9999-12-31"
                    value={invoiceData.invoiceDate}
                    onChange={(e) =>
                      setInvoiceData((prev) => ({
                        ...prev,
                        invoiceDate: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    P.O. Number
                  </label>
                  <input
                    type="text"
                    value={invoiceData.poNumber}
                    onChange={(e) =>
                      setInvoiceData((prev) => ({
                        ...prev,
                        poNumber: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    P.O. Date
                  </label>
                  <input
                    type="date"
                    max="9999-12-31"
                    value={invoiceData.poDate}
                    onChange={(e) =>
                      setInvoiceData((prev) => ({
                        ...prev,
                        poDate: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    D.O. Number
                  </label>
                  <input
                    type="text"
                    value={invoiceData.dcNumber}
                    onChange={(e) =>
                      setInvoiceData((prev) => ({
                        ...prev,
                        dcNumber: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    D.O. Date
                  </label>
                  <input
                    type="date"
                    max="9999-12-31"
                    value={invoiceData.dcDate}
                    onChange={(e) =>
                      setInvoiceData((prev) => ({
                        ...prev,
                        dcDate: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    max="9999-12-31"
                    value={invoiceData.dueDate}
                    onChange={(e) =>
                      setInvoiceData((prev) => ({
                        ...prev,
                        dueDate: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                  />
                </div>
                {godowns.length > 1 && (
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Dispatch from godown</label>
                    <select
                      value={invoiceData.godown || "Main Location"}
                      onChange={(e) => setInvoiceData((prev) => ({ ...prev, godown: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                    >
                      {godowns.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                )}
                {costCentres.length > 0 && (
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Cost centre</label>
                    <select
                      value={invoiceData.costCentre || ""}
                      onChange={(e) => setInvoiceData((prev) => ({ ...prev, costCentre: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                    >
                      <option value="">None</option>
                      {costCentres.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Client Information <span className="text-red-500">*</span>
              </h3>
              {/* ClientAutocomplete should be imported or defined above */}
              <ClientAutocomplete
                clients={clients}
                selectedClient={invoiceData.client}
                onSelect={handleClientSelect}
              />
            </div>
            <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Items & Services <span className="text-red-500">*</span>
                </h3>
                <button
                  onClick={addItem}
                  className="flex items-center px-3 py-1.5 text-white bg-blue-600 rounded-lg text-xs font-medium hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="text-xs uppercase font-semibold text-gray-500">
                    <tr>
                      <th className="p-2 text-left w-[4%]">#</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-left w-[10%]">HSN/SAC</th>
                      <th className="p-2 text-left w-[8%]">Qty</th>
                      <th className="p-2 text-left w-[11%]">Rate ({cur})</th>
                      <th className="p-2 text-left w-[8%]">Disc %</th>
                      <th className="p-2 text-left w-[9%]">GST %</th>
                      <th className="p-2 text-right w-[12%]">Taxable ({cur})</th>
                      <th className="p-2 w-[4%]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2 pt-4 text-sm align-top text-gray-500">{index + 1}</td>
                        <td className="p-2 align-top">
                          <ProductAutocomplete
                            products={products}
                            value={item.description || item.name || ""}
                            onSelect={(product) => (applyProductToItem ? applyProductToItem(item.id, product) : updateItem(item.id, "description", product.name))}
                            onChange={(val) => {
                              updateItem(item.id, "description", val);
                              // Typed text no longer refers to a picked product.
                              updateItem(item.id, "productId", null);
                            }}
                            onAddNewProduct={handleAddNewProduct}
                            clientId={invoiceData.clientId}
                          />
                          {item.unit && <p className="text-[11px] text-gray-400 mt-1 px-1">Unit: {item.unit}</p>}
                          {item.trackBatches && (
                            <div className="flex gap-1.5 mt-1.5">
                              <input value={item.batchNo || ""} onChange={(e) => updateItem(item.id, "batchNo", e.target.value)} placeholder="Batch" aria-label="Batch number" className="w-1/2 px-2 py-1 text-xs bg-amber-50 border border-amber-200 rounded" />
                              <input type="date" max="9999-12-31" value={item.expiryDate || ""} onChange={(e) => updateItem(item.id, "expiryDate", e.target.value)} aria-label="Expiry date" title="Expiry" className="w-1/2 px-2 py-1 text-xs bg-amber-50 border border-amber-200 rounded" />
                            </div>
                          )}
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="text"
                            placeholder="HSN"
                            value={item.hsnCode || item.hsn || ""}
                            onChange={(e) => updateItem(item.id, "hsnCode", e.target.value)}
                            className={cellInput}
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="number"
                            value={item.quantity ?? 0}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateItem(item.id, "quantity", Number.parseFloat(e.target.value) || 0)}
                            className={cellInput}
                            min="0"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="number"
                            value={item.rate ?? item.price ?? 0}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateItem(item.id, "rate", Number.parseFloat(e.target.value) || 0)}
                            className={cellInput}
                            min="0"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="number"
                            value={item.discount ?? 0}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateItem(item.id, "discount", Math.min(100, Math.max(0, Number.parseFloat(e.target.value) || 0)))}
                            className={cellInput}
                            min="0"
                            max="100"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <select
                            value={String(item.gstRate ?? 0)}
                            onChange={(e) => updateItem(item.id, "gstRate", Number(e.target.value))}
                            disabled={!gstOn}
                            className={`${cellInput} disabled:opacity-50`}
                          >
                            {GST_RATES.map((r) => (
                              <option key={r} value={String(r)}>
                                {r}%
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 pt-4 align-top text-right text-sm font-semibold text-gray-900 tabular-nums">
                          {money(item.amount)}
                        </td>
                        <td className="p-2 align-top">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="flex items-center text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded"
                            title="Remove item"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-sm text-gray-500 border-t">
                          No items yet. Click <span className="font-semibold">Add Item</span> to start.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {gstOn && calc.hsnSummary?.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">HSN / SAC summary</p>
                  <table className="w-full min-w-[560px] text-xs border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="p-2 text-left">HSN/SAC</th>
                        <th className="p-2 text-right">Taxable</th>
                        <th className="p-2 text-right">Rate</th>
                        {isInterState ? <th className="p-2 text-right">IGST</th> : <><th className="p-2 text-right">CGST</th><th className="p-2 text-right">SGST</th></>}
                        <th className="p-2 text-right">Total tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calc.hsnSummary.map((h) => (
                        <tr key={`${h.hsn}-${h.gstRate}`} className="border-t border-gray-100 tabular-nums">
                          <td className="p-2">{h.hsn || "—"}</td>
                          <td className="p-2 text-right">{money(h.taxable)}</td>
                          <td className="p-2 text-right">{h.gstRate}%</td>
                          {isInterState ? (
                            <td className="p-2 text-right">{money(h.igst)}</td>
                          ) : (
                            <>
                              <td className="p-2 text-right">{money(h.cgst)}</td>
                              <td className="p-2 text-right">{money(h.sgst)}</td>
                            </>
                          )}
                          <td className="p-2 text-right font-semibold">{money(h.tax)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-sm text-gray-700 mb-1">Invoice Notes (Optional)</label>
                <textarea
                  placeholder="e.g., For labour charges only"
                  value={invoiceData.invoiceNotes}
                  onChange={(e) => setInvoiceData((prev) => ({ ...prev, invoiceNotes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg resize-none h-16 focus:outline-none focus:ring-0"
                />
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="p-6 bg-white rounded-xl border border-gray-200">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Tax & Calculation</h3>

              {/* GST Calculation Toggle */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div>
                  <span className="text-sm font-semibold text-gray-800 select-none block">Enable GST</span>
                  <span className="text-xs text-gray-500">Item-wise GST from each product&apos;s rate</span>
                </div>
                <Toggle
                  on={gstOn}
                  onClick={() =>
                    handleToggleGst ? handleToggleGst(!gstOn) : setInvoiceData((prev) => ({ ...prev, isGstEnabled: !gstOn }))
                  }
                  title="Toggle GST (synced with System Settings)"
                />
              </div>

              {gstOn && (
                <div className="mb-4 space-y-3 pb-4 border-b border-gray-100">
                  <label className="block">
                    <span className="block text-sm text-gray-700 mb-1">Supply type</span>
                    <select
                      value={supplyType}
                      onChange={(e) => setInvoiceData((prev) => withSupplyType(prev, e.target.value, companyProfile))}
                      className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {SUPPLY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!forcesInterState(invoiceData) && (
                    <label className="flex items-start gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={Boolean(invoiceData.reverseCharge)} onChange={setField("reverseCharge")} className="mt-0.5 w-4 h-4 accent-blue-600" />
                      <span>
                        Reverse charge applies
                        <span className="block text-xs text-gray-500">GST is shown but paid by the buyer, not added to this bill.</span>
                      </span>
                    </label>
                  )}
                  {exportBill && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="block text-xs text-gray-600 mb-1">Currency</span>
                        <select value={invoiceData.currency || "INR"} onChange={setField("currency")} className="w-full px-2.5 py-1.5 text-sm bg-gray-100 border-0 rounded-lg">
                          {CURRENCIES.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="block text-xs text-gray-600 mb-1">₹ per 1 {invoiceData.currency || "INR"}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={invoiceData.exchangeRate ?? 1}
                          disabled={(invoiceData.currency || "INR") === "INR"}
                          onChange={(e) => setInvoiceData((prev) => ({ ...prev, exchangeRate: Number.parseFloat(e.target.value) || 0 }))}
                          className="w-full px-2.5 py-1.5 text-sm bg-gray-100 border-0 rounded-lg disabled:opacity-50"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-xs text-gray-600 mb-1">Country code</span>
                        <input value={invoiceData.countryCode || ""} onChange={setField("countryCode")} maxLength={2} placeholder="US" className="w-full px-2.5 py-1.5 text-sm bg-gray-100 border-0 rounded-lg uppercase" />
                      </label>
                      <label className="block">
                        <span className="block text-xs text-gray-600 mb-1">Port code</span>
                        <input value={invoiceData.portCode || ""} onChange={setField("portCode")} placeholder="INMAA1" className="w-full px-2.5 py-1.5 text-sm bg-gray-100 border-0 rounded-lg uppercase" />
                      </label>
                      <label className="block">
                        <span className="block text-xs text-gray-600 mb-1">Shipping bill no.</span>
                        <input value={invoiceData.shippingBillNo || ""} onChange={setField("shippingBillNo")} className="w-full px-2.5 py-1.5 text-sm bg-gray-100 border-0 rounded-lg" />
                      </label>
                      <label className="block">
                        <span className="block text-xs text-gray-600 mb-1">Shipping bill date</span>
                        <input type="date" value={invoiceData.shippingBillDate || ""} onChange={setField("shippingBillDate")} className="w-full px-2.5 py-1.5 text-sm bg-gray-100 border-0 rounded-lg" />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {gstOn ? (
                <div className="mb-4 space-y-2">
                  <label htmlFor="placeOfSupply" className="block text-sm text-gray-700">
                    Place of supply
                  </label>
                  <select
                    id="placeOfSupply"
                    value={invoiceData.placeOfSupply?.code || ""}
                    onChange={(e) => setInvoiceData((prev) => withPlaceOfSupply(prev, e.target.value, companyProfile))}
                    disabled={exportBill}
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  >
                    <option value="">Select state</option>
                    {exportBill && <option value="96">96 – Other Country</option>}
                    {STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} – {s.name}
                      </option>
                    ))}
                  </select>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      isInterState ? "bg-purple-50 text-purple-700" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {calc.zeroRated
                      ? "Zero-rated · no IGST (LUT / bond)"
                      : invoiceData.reverseCharge
                        ? "Reverse charge · tax paid by buyer"
                        : isInterState
                          ? "Inter-state supply · IGST"
                          : "Intra-state supply · CGST + SGST"}
                  </span>
                  {!sellerHasState(companyProfile) && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      Add your GSTIN or state in{" "}
                      <Link to="/settings" className="font-semibold underline">
                        Settings → Business
                      </Link>{" "}
                      so CGST/SGST vs IGST is chosen correctly.
                    </p>
                  )}
                </div>
              ) : (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
                  GST is off for this bill (synced with System Settings).
                </div>
              )}

              {/* TCS (income tax, section 206C) */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <span className="text-sm font-semibold text-gray-800 select-none block">TCS %</span>
                  <span className="text-xs text-gray-500">Tax collected at source on the bill value (sec. 206C)</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={invoiceData.tcsRate || ""}
                  onChange={(e) => setInvoiceData((prev) => ({ ...prev, tcsRate: Number.parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  aria-label="TCS rate"
                  className="w-20 px-2 py-1.5 text-sm text-right bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Round Off Toggle */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <span className="text-sm font-semibold text-gray-800 select-none block">Round off</span>
                  <span className="text-xs text-gray-500">Round the total to the nearest rupee</span>
                </div>
                <Toggle
                  on={Boolean(invoiceData.isRoundOff)}
                  onClick={() =>
                    handleToggleRoundOff
                      ? handleToggleRoundOff(!invoiceData.isRoundOff)
                      : setInvoiceData((prev) => ({ ...prev, isRoundOff: !prev.isRoundOff }))
                  }
                  title="Toggle round off (synced with System Settings)"
                />
              </div>

              <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 mt-4 space-y-2.5 text-sm tabular-nums">
                {calc.discountAmount > 0 && (
                  <>
                    <Row label="Gross amount" value={money(calc.grossAmount)} />
                    <Row label="Discount" value={`− ${money(calc.discountAmount)}`} />
                  </>
                )}
                <Row label="Taxable value" value={money(calc.taxableAmount ?? calc.subtotal)} strong />
                {gstOn &&
                  (calc.taxBreakup || []).map((b) =>
                    isInterState ? (
                      <Row key={`i${b.gstRate}`} label={`IGST @ ${b.gstRate}%`} value={money(b.igst)} />
                    ) : (
                      <React.Fragment key={`c${b.gstRate}`}>
                        <Row label={`CGST @ ${b.gstRate / 2}%`} value={money(b.cgst)} />
                        <Row label={`SGST @ ${b.gstRate / 2}%`} value={money(b.sgst)} />
                      </React.Fragment>
                    )
                  )}
                {calc.cessAmount > 0 && <Row label="Cess" value={money(calc.cessAmount)} />}
                {calc.tcsAmount > 0 && <Row label={`TCS @ ${calc.tcsRate}%`} value={money(calc.tcsAmount)} />}
                {invoiceData.isRoundOff && <Row label="Round off" value={money(calc.roundOffAmount)} />}
                <div className="pt-3 mt-1 border-t border-gray-200 flex justify-between items-center text-lg font-bold text-slate-900">
                  <span>Total</span>
                  <span>
                    {cur === "₹" ? "₹" : `${cur} `}
                    {money(calc.total)}
                  </span>
                </div>
                {cur !== "₹" && <p className="text-xs text-gray-500 text-right">≈ ₹{money(calc.total * inrFactor(invoiceData))} at {invoiceData.exchangeRate}</p>}
                {invoiceData.reverseCharge && calc.totalTax > 0 && (
                  <p className="text-xs text-amber-700">GST of ₹{money(calc.totalTax)} is payable by the buyer under reverse charge.</p>
                )}
              </div>
            </div>

            <div className="p-6 bg-white rounded-xl border border-gray-200">
              <h3 className="mb-4 text-lg font-bold text-gray-900">Payment & Notes</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="block text-sm text-gray-700">Bank details</span>
                    <Link to="/settings" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                      Edit
                    </Link>
                  </div>
                  {bank.bankName || bank.accountNumber ? (
                    <div className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg space-y-0.5">
                      <p className="font-semibold text-gray-900">{bank.bankName}</p>
                      {bank.accountNumber && <p className="text-gray-600">A/c {bank.accountNumber}</p>}
                      {bank.ifsc && <p className="text-gray-600">IFSC {bank.ifsc}</p>}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      No bank account yet. Add it in Settings → Business to print it on invoices.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block mb-1 text-sm text-gray-700">Declaration</label>
                  <textarea
                    value={invoiceData.declaration}
                    onChange={(e) => setInvoiceData((prev) => ({ ...prev, declaration: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg resize-none h-20 focus:outline-none focus:ring-0"
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={strong ? "font-bold text-slate-900" : "font-semibold text-slate-900"}>{strong ? `₹${value}` : value}</span>
    </div>
  );
}

function Toggle({ on, onClick, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        on ? "bg-blue-600" : "bg-gray-300"
      }`}
      onClick={onClick}
      title={title}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
