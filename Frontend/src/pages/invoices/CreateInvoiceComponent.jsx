
import React from "react";
import { Save, Eye, FileText, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { 
  ClientAutocomplete, 
  ProductAutocomplete 
} from "../../components/InvoiceAutocomplete.jsx";

// Import or define ClientAutocomplete and ProductAutocomplete as in InvoiceManagement.jsx
// For brevity, assume they are imported or defined above

export default function CreateInvoiceComponent({
  editingInvoice,
  invoiceData,
  clients = [],
  products = [],
  calculations = {},
  setCurrentPage,
  saveDraft,
  handlePreview,
  setShowPreview,
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
  handleToggleAutoInvoice,
}) {
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 font-medium select-none">Auto Numbering</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleAutoInvoice
                            ? handleToggleAutoInvoice(!invoiceData.isAutoInvoice)
                            : setInvoiceData((prev) => ({ ...prev, isAutoInvoice: !prev.isAutoInvoice }))
                        }
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          invoiceData.isAutoInvoice !== false ? "bg-blue-600" : "bg-gray-300"
                        }`}
                        title="Toggle Auto Invoice Numbering (Synced with System Settings)"
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            invoiceData.isAutoInvoice !== false ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
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
                  {invoiceData.isAutoInvoice !== false && (
                    <p className="text-[11px] text-blue-600 mt-1 flex items-center gap-1 font-medium">
                      ✓ Auto-numbered (Synced with System Settings)
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
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
              <div>
                <table className="w-full">
                  <thead className="text-xs uppercase font-semibold text-gray-500">
                    <tr>
                      <th className="p-2 text-left w-[5%]">S.No</th>
                      <th className="p-2 text-left w-[35%]">Description</th>
                      <th className="p-2 text-left w-[10%]">HSN</th>
                      <th className="p-2 text-left w-[10%]">Qty</th>
                      <th className="p-2 text-left w-[10%]">Rate (₹)</th>
                      <th className="p-2 text-left w-[12%]">Amount (₹)</th>
                      <th className="p-2 text-left w-[5%]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoiceData.items || invoiceData.products || []).map((item, index) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-4 text-sm align-top">{index + 1}</td>
                        <td className="p-2">
                          <ProductAutocomplete
                            products={products}
                            value={item.description || item.name || ''}
                            onSelect={(product) => {
                              updateItem(item.id, "description", product.name);
                              updateItem(item.id, "hsnCode", product.hsn);
                              updateItem(item.id, "rate", product.price);
                            }}
                            onChange={(val) =>
                              updateItem(item.id, "description", val)
                            }
                            onAddNewProduct={handleAddNewProduct}
                            clientId={invoiceData.clientId}
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="text"
                            placeholder="HSN"
                            value={item.hsnCode || item.hsn || ''}
                            onChange={(e) =>
                              updateItem(item.id, "hsnCode", e.target.value)
                            }
                            className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="number"
                            value={item.quantity || 0}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "quantity",
                                Number.parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                            min="0"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="number"
                            value={item.rate || item.price || 0}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "rate",
                                Number.parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                            min="0"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="text"
                            value={(item.amount || item.total || 0).toLocaleString()}
                            readOnly
                            className="w-full px-3 py-2 text-sm bg-gray-200 border-0 rounded-lg text-gray-600"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded"
                          >
                            <Trash2 className="w-4 h-7" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <label className="block text-sm text-gray-700 mb-1">
                  Invoice Notes (Optional)
                </label>
                <textarea
                  placeholder="e.g., For labour charges only"
                  value={invoiceData.invoiceNotes}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      invoiceNotes: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg resize-none h-16 focus:outline-none focus:ring-0"
                />
              </div>
            </div>
          </div>
          <div className="space-y-8">
            <div className="p-6 bg-white rounded-xl border border-gray-200">
              <h3 className="mb-4 text-lg font-bold text-gray-900">
                Tax & Calculation
              </h3>

              {/* GST Calculation Toggle */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div>
                  <span className="text-sm font-semibold text-gray-800 select-none block">
                    Enable GST Calculation
                  </span>
                  <span className="text-xs text-gray-500">Auto calculate CGST, SGST & IGST</span>
                </div>
                <button
                  type="button"
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    invoiceData.isGstEnabled !== false ? "bg-blue-600" : "bg-gray-300"
                  }`}
                  onClick={() =>
                    handleToggleGst
                      ? handleToggleGst(!invoiceData.isGstEnabled)
                      : setInvoiceData((prev) => ({ ...prev, isGstEnabled: !prev.isGstEnabled }))
                  }
                  title="Toggle GST Calculation (Synced with System Settings)"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      invoiceData.isGstEnabled !== false ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {invoiceData.isGstEnabled !== false ? (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label htmlFor="cgstInput" className="block mb-1 text-sm text-gray-700">
                      CGST (%)
                    </label>
                    <input
                      id="cgstInput"
                      type="number"
                      value={invoiceData.cgst}
                      onChange={(e) =>
                        setInvoiceData((prev) => ({
                          ...prev,
                          cgst: Number.parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label htmlFor="sgstInput" className="block mb-1 text-sm text-gray-700">
                      SGST (%)
                    </label>
                    <input
                      id="sgstInput"
                      type="number"
                      value={invoiceData.sgst}
                      onChange={(e) =>
                        setInvoiceData((prev) => ({
                          ...prev,
                          sgst: Number.parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label htmlFor="igstInput" className="block mb-1 text-sm text-gray-700">
                      IGST (%)
                    </label>
                    <input
                      id="igstInput"
                      type="number"
                      value={invoiceData.igst}
                      onChange={(e) =>
                        setInvoiceData((prev) => ({
                          ...prev,
                          igst: Number.parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
                  ⚠️ GST calculation is disabled (Synced with System Settings).
                </div>
              )}

              {/* Round Off Toggle */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <span className="text-sm font-semibold text-gray-800 select-none block">
                    Enable Round Off
                  </span>
                  <span className="text-xs text-gray-500">Round off total invoice amount</span>
                </div>
                <button
                  type="button"
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    invoiceData.isRoundOff ? "bg-blue-600" : "bg-gray-300"
                  }`}
                  onClick={() =>
                    handleToggleRoundOff
                      ? handleToggleRoundOff(!invoiceData.isRoundOff)
                      : setInvoiceData((prev) => ({ ...prev, isRoundOff: !prev.isRoundOff }))
                  }
                  title="Toggle Round Off (Synced with System Settings)"
                >
                  <span className="sr-only">Enable Round Off</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      invoiceData.isRoundOff ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="p-6 bg-gray-50 rounded-xl border border-gray-100 mt-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-semibold text-slate-900">
                      ₹
                      {calculations.subtotal?.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {invoiceData.cgst > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">
                        CGST ({invoiceData.cgst}%):
                      </span>
                      <span className="font-semibold text-slate-900">
                        ₹
                        {calculations.cgstAmount?.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {invoiceData.sgst > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">
                        SGST ({invoiceData.sgst}%):
                      </span>
                      <span className="font-semibold text-slate-900">
                        ₹
                        {calculations.sgstAmount?.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {invoiceData.igst > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">
                        IGST ({invoiceData.igst}%):
                      </span>
                      <span className="font-semibold text-slate-900">
                        ₹
                        {calculations.igstAmount?.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {invoiceData.isRoundOff && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Round Off:</span>
                      <span className="font-semibold text-slate-900">
                        ₹
                        {calculations.roundOffAmount?.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  <div className="pt-4 mt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center text-lg font-bold text-slate-900">
                      <span>Total Amount:</span>
                      <span>
                        ₹
                        {calculations.total?.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-white rounded-xl border border-gray-200">
              <h3 className="mb-4 text-lg font-bold text-gray-900">
                Payment & Notes
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm text-gray-700">
                    Bank Details
                  </label>
                  <div className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-0">
                    State Bank Of India
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-sm text-gray-700">
                    Declaration
                  </label>
                  <textarea
                    value={invoiceData.declaration}
                    onChange={(e) =>
                      setInvoiceData((prev) => ({
                        ...prev,
                        declaration: e.target.value,
                      }))
                    }
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
