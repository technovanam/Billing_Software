import React, { useMemo, useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Edit, 
  Pause, 
  Play, 
  Plus, 
  Search, 
  Trash2, 
  FileText, 
  Save, 
  Calendar, 
  Clock, 
  Repeat, 
  User, 
  CheckCircle, 
  AlertCircle 
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCustomers, useProducts, useRecurringInvoices, useSettings } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";
import { ClientAutocomplete, ProductAutocomplete } from "../../components/InvoiceAutocomplete";

const schedules = [
  "Minutes",
  "Week", 
  "2 Weeks", 
  "Month", 
  "2 Months", 
  "3 Months", 
  "6 Months", 
  "Year"
];

const paymentTermsList = [
  "Due on Receipt", 
  "Net 7", 
  "Net 15", 
  "Net 30", 
  "Net 45", 
  "Net 60"
];

const emptyItem = {
  id: "item_1",
  productId: "",
  description: "",
  hsnCode: "",
  quantity: 1,
  rate: 0,
  amount: 0,
};

const getInitialForm = () => ({
  profileName: "",
  orderNumber: "",
  repeatEvery: "Month",
  startOn: new Date().toISOString().slice(0, 10),
  endsOn: "",
  neverExpires: true,
  paymentTerms: "Due on Receipt",
  salesperson: "",
  customerId: "",
  client: null,
  items: [{ ...emptyItem, id: `item_${Date.now()}` }],
  isGstEnabled: true,
  cgst: 9,
  sgst: 9,
  igst: 0,
  discount: 0,
  tds: 0,
  adjustment: 0,
  isRoundOff: true,
  customerNotes: "Thanks for your business. Generated via recurring schedule.",
  termsAndConditions: "Payment is due according to the specified payment terms.",
});

function calculateNextRunDate(startOn, repeatEvery) {
  if (!startOn) return "";
  const date = new Date(`${startOn}T00:00:00`);
  if (isNaN(date.getTime())) return "";
  
  if (repeatEvery === "Minutes") {
    // Return current time + 2 minutes to show an immediate run
    const now = new Date();
    now.setMinutes(now.getMinutes() + 2);
    return now.toLocaleString();
  }
  if (repeatEvery === "Week") date.setDate(date.getDate() + 7);
  else if (repeatEvery === "2 Weeks") date.setDate(date.getDate() + 14);
  else {
    const months = { Month: 1, "2 Months": 2, "3 Months": 3, "6 Months": 6, Year: 12 }[repeatEvery] || 1;
    date.setMonth(date.getMonth() + months);
  }
  return date.toISOString().slice(0, 10);
}

function getProfileStatus(profile) {
  if (profile.status === "Paused") return "Paused";
  if (!profile.neverExpires && profile.endsOn && new Date(profile.endsOn) < new Date()) {
    return "Expired";
  }
  return "Active";
}

/* ──────────────────────────────────────────────────────────────────────────
   RECURRING INVOICE FORM (MATCHES CREATE INVOICE ALIGNMENT & DESIGN)
   ────────────────────────────────────────────────────────────────────────── */
function RecurringInvoiceForm({
  form,
  setForm,
  products,
  customers,
  editingId,
  onSave,
  onCancel,
  addProduct,
}) {
  // Sync selected client
  const handleClientSelect = (clientId) => {
    if (!clientId) {
      setForm((prev) => ({ ...prev, customerId: "", client: null }));
      return;
    }
    const found = customers.find((c) => c.id === clientId);
    setForm((prev) => ({
      ...prev,
      customerId: clientId,
      client: found || null,
    }));
  };

  // Add Item
  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { ...emptyItem, id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` },
      ],
    }));
  };

  // Update Item
  const updateItem = (itemId, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        if (it.id === itemId) {
          const updated = { ...it, [field]: value };
          const q = field === "quantity" ? Number(value) || 0 : Number(it.quantity) || 0;
          const r = field === "rate" ? Number(value) || 0 : Number(it.rate) || 0;
          updated.amount = q * r;
          return updated;
        }
        return it;
      }),
    }));
  };

  // Remove Item
  const removeItem = (itemId) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== itemId),
    }));
  };

  // Add new product via autocomplete
  const handleAddNewProduct = async (productName) => {
    if (!addProduct) return;
    try {
      const res = await addProduct({
        name: productName,
        price: 0,
        hsn: "998314",
        category: "General",
      });
      if (res?.success) {
        // If there's an empty item, populate it
        const emptyIdx = form.items.findIndex((it) => !it.description);
        if (emptyIdx >= 0) {
          updateItem(form.items[emptyIdx].id, "description", productName);
          updateItem(form.items[emptyIdx].id, "hsnCode", "998314");
          updateItem(form.items[emptyIdx].id, "rate", 0);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Dynamic Financial Calculations
  const calculations = useMemo(() => {
    const subtotal = form.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
    
    // Taxes
    const isGst = form.isGstEnabled !== false;
    const cgstAmount = isGst && form.cgst > 0 ? (subtotal * Number(form.cgst)) / 100 : 0;
    const sgstAmount = isGst && form.sgst > 0 ? (subtotal * Number(form.sgst)) / 100 : 0;
    const igstAmount = isGst && form.igst > 0 ? (subtotal * Number(form.igst)) / 100 : 0;
    const taxTotal = cgstAmount + sgstAmount + igstAmount;

    // Discount & TDS
    const discountAmount = form.discount > 0 ? (subtotal * Number(form.discount)) / 100 : 0;
    const tdsAmount = form.tds > 0 ? ((subtotal - discountAmount) * Number(form.tds)) / 100 : 0;
    
    const adjustmentAmount = Number(form.adjustment) || 0;
    const rawTotal = subtotal + taxTotal - discountAmount - tdsAmount + adjustmentAmount;
    
    let roundOffAmount = 0;
    let total = rawTotal;
    if (form.isRoundOff) {
      total = Math.round(rawTotal);
      roundOffAmount = total - rawTotal;
    }

    return {
      subtotal,
      cgstAmount,
      sgstAmount,
      igstAmount,
      taxTotal,
      discountAmount,
      tdsAmount,
      roundOffAmount,
      total,
    };
  }, [form]);

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        {/* Top Header Bar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <button
              type="button"
              onClick={onCancel}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
              title="Go back to list"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {editingId ? "Edit Recurring Invoice" : "Create Recurring Invoice"}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {editingId
                  ? "Update recurring schedule and invoice parameters"
                  : "Set up a profile to periodically generate invoices automatically"}
              </p>
            </div>
          </div>
          
          {/* Top Actions */}
          <div className="flex items-center space-x-3 text-sm font-medium">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => onSave(e, { ...form, ...calculations, isDraft: true })}
              className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Save className="w-4 h-4 mr-2 text-gray-500" />
              Save Draft
            </button>
            <button
              type="button"
              onClick={(e) => onSave(e, { ...form, ...calculations })}
              className="flex items-center px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm font-semibold"
            >
              <FileText className="w-4 h-4 mr-2" />
              {editingId ? "Update Profile" : "Save Recurring Invoice"}
            </button>
          </div>
        </div>

        {/* Main 3-Column Grid */}
        <main className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns */}
          <div className="col-span-1 lg:col-span-2 space-y-6">
            
            {/* Section 1: Recurring Schedule Details */}
            <div className="bg-white p-4 lg:p-5 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Recurring Schedule Details
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                  Next Run: {calculateNextRunDate(form.startOn, form.repeatEvery) || "—"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Profile Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Monthly Software Retainer"
                    value={form.profileName}
                    onChange={(e) => setForm((prev) => ({ ...prev, profileName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Order / PO Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., PO-2025-001"
                    value={form.orderNumber}
                    onChange={(e) => setForm((prev) => ({ ...prev, orderNumber: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Repeat Every <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={form.repeatEvery}
                    onChange={(e) => setForm((prev) => ({ ...prev, repeatEvery: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {schedules.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Start On Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    max="9999-12-31"
                    value={form.startOn}
                    onChange={(e) => setForm((prev) => ({ ...prev, startOn: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm text-gray-700">
                      Ends On Date
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-blue-600 font-medium select-none">
                      <input
                        type="checkbox"
                        checked={form.neverExpires}
                        onChange={(e) => setForm((prev) => ({ ...prev, neverExpires: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Never Expires
                    </label>
                  </div>
                  <input
                    type="date"
                    max="9999-12-31"
                    disabled={form.neverExpires}
                    value={form.endsOn}
                    onChange={(e) => setForm((prev) => ({ ...prev, endsOn: e.target.value }))}
                    className={`w-full px-3 py-2 text-sm border-0 rounded-lg focus:outline-none ${
                      form.neverExpires ? "bg-gray-100/60 text-gray-400 cursor-not-allowed" : "bg-gray-100 focus:ring-2 focus:ring-blue-500/20"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={form.paymentTerms}
                    onChange={(e) => setForm((prev) => ({ ...prev, paymentTerms: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {paymentTermsList.map((term) => (
                      <option key={term} value={term}>{term}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Salesperson (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Alex Johnson"
                    value={form.salesperson}
                    onChange={(e) => setForm((prev) => ({ ...prev, salesperson: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Client Information */}
            <div className="bg-white p-4 lg:p-5 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Client Information <span className="text-red-500">*</span>
                </h3>
              </div>
              
              <ClientAutocomplete
                clients={customers}
                selectedClient={form.client || customers.find((c) => c.id === form.customerId)}
                onSelect={handleClientSelect}
              />

              {/* Selected Client Card Badge */}
              {form.client && (
                <div className="mt-3 p-3 bg-blue-50/60 border border-blue-100 rounded-lg grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900 block">{form.client.name}</span>
                    <span className="text-slate-500">{form.client.email || "No email provided"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Phone: {form.client.phone || "—"}</span>
                    <span className="text-slate-500 block">GSTIN: {form.client.taxId || form.client.gstin || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Address: {form.client.address || "—"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Items & Services Table */}
            <div className="bg-white p-4 lg:p-5 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Items & Services <span className="text-red-500">*</span>
                </h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center px-3 py-1.5 text-white bg-blue-600 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px]">
                  <thead className="text-xs uppercase font-semibold text-gray-500 border-b">
                    <tr>
                      <th className="p-2 text-left w-[5%]">S.No</th>
                      <th className="p-2 text-left w-[35%]">Description</th>
                      <th className="p-2 text-left w-[12%]">HSN</th>
                      <th className="p-2 text-left w-[12%]">Qty</th>
                      <th className="p-2 text-left w-[14%]">Rate (₹)</th>
                      <th className="p-2 text-left w-[16%]">Amount (₹)</th>
                      <th className="p-2 text-center w-[6%]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, index) => (
                      <tr key={item.id} className="border-t hover:bg-gray-50/50">
                        <td className="p-3 text-sm text-gray-500 align-top">{index + 1}</td>
                        <td className="p-2">
                          <ProductAutocomplete
                            products={products}
                            value={item.description || item.name || ""}
                            onSelect={(product) => {
                              updateItem(item.id, "productId", product.id);
                              updateItem(item.id, "description", product.name);
                              updateItem(item.id, "hsnCode", product.hsn || "");
                              updateItem(item.id, "rate", product.price || 0);
                            }}
                            onChange={(val) => updateItem(item.id, "description", val)}
                            onAddNewProduct={handleAddNewProduct}
                            clientId={form.customerId}
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="text"
                            placeholder="HSN"
                            value={item.hsnCode || ""}
                            onChange={(e) => updateItem(item.id, "hsnCode", e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity || 0}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="number"
                            min="0"
                            value={item.rate || 0}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateItem(item.id, "rate", Number(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="text"
                            value={(item.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            readOnly
                            className="w-full px-3 py-2 text-sm bg-gray-200/80 border-0 rounded-lg text-gray-700 font-medium"
                          />
                        </td>
                        <td className="p-2 align-top text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            disabled={form.items.length <= 1}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-sm text-gray-700 mb-1 font-medium">
                    Customer / Invoice Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Notes to appear on generated invoices"
                    value={form.customerNotes}
                    onChange={(e) => setForm((prev) => ({ ...prev, customerNotes: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1 font-medium">
                    Terms & Conditions
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter business terms and conditions"
                    value={form.termsAndConditions}
                    onChange={(e) => setForm((prev) => ({ ...prev, termsAndConditions: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Tax & Calculation Summary Sidebar */}
          <div className="space-y-6">
            <div className="p-5 lg:p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-gray-900">
                Tax & Calculation
              </h3>

              {/* GST Toggle */}
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
                    form.isGstEnabled !== false ? "bg-blue-600" : "bg-gray-300"
                  }`}
                  onClick={() => setForm((prev) => ({ ...prev, isGstEnabled: !prev.isGstEnabled }))}
                  title="Toggle GST Calculation"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      form.isGstEnabled !== false ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* GST Percentages */}
              {form.isGstEnabled !== false ? (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="block mb-1 text-xs font-medium text-gray-700">CGST (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.cgst}
                      onChange={(e) => setForm((prev) => ({ ...prev, cgst: Number(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-medium text-gray-700">SGST (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.sgst}
                      onChange={(e) => setForm((prev) => ({ ...prev, sgst: Number(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-medium text-gray-700">IGST (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.igst}
                      onChange={(e) => setForm((prev) => ({ ...prev, igst: Number(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
                  GST calculation is disabled.
                </div>
              )}

              {/* Discount, TDS, Adjustment */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.discount}
                    onChange={(e) => setForm((prev) => ({ ...prev, discount: Number(e.target.value) || 0 }))}
                    className="w-full px-2.5 py-1.5 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">TDS (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.tds}
                    onChange={(e) => setForm((prev) => ({ ...prev, tds: Number(e.target.value) || 0 }))}
                    className="w-full px-2.5 py-1.5 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              {/* Round Off Toggle */}
              <div className="flex items-center justify-between py-2.5 border-t border-gray-100">
                <div>
                  <span className="text-sm font-semibold text-gray-800 select-none block">
                    Enable Round Off
                  </span>
                  <span className="text-xs text-gray-500">Round off total invoice amount</span>
                </div>
                <button
                  type="button"
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    form.isRoundOff ? "bg-blue-600" : "bg-gray-300"
                  }`}
                  onClick={() => setForm((prev) => ({ ...prev, isRoundOff: !prev.isRoundOff }))}
                  title="Toggle Round Off"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      form.isRoundOff ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Summary Calculations Box */}
              <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 mt-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-semibold text-slate-900">
                    ₹{calculations.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {calculations.cgstAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">CGST ({form.cgst}%):</span>
                    <span className="font-semibold text-slate-900">
                      ₹{calculations.cgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {calculations.sgstAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">SGST ({form.sgst}%):</span>
                    <span className="font-semibold text-slate-900">
                      ₹{calculations.sgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {calculations.igstAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">IGST ({form.igst}%):</span>
                    <span className="font-semibold text-slate-900">
                      ₹{calculations.igstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {calculations.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Discount ({form.discount}%):</span>
                    <span className="font-semibold">
                      -₹{calculations.discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {calculations.tdsAmount > 0 && (
                  <div className="flex justify-between text-sm text-amber-700">
                    <span>TDS ({form.tds}%):</span>
                    <span className="font-semibold">
                      -₹{calculations.tdsAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {form.isRoundOff && calculations.roundOffAmount !== 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Round Off:</span>
                    <span className="font-semibold text-slate-900">
                      {calculations.roundOffAmount > 0 ? "+" : ""}
                      ₹{calculations.roundOffAmount.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="pt-3 mt-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-base font-bold text-gray-900">Total / Cycle:</span>
                  <span className="text-2xl font-bold text-green-600">
                    ₹{calculations.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Bottom Action Submit Button */}
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={(e) => onSave(e, { ...form, ...calculations })}
                  className="w-full flex items-center justify-center py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm shadow transition-colors"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {editingId ? "Update Recurring Invoice" : "Save Recurring Invoice"}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-2 px-4 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   ALL RECURRING INVOICES LIST VIEW (MATCHES INVOICE MANAGEMENT ALIGNMENT)
   ────────────────────────────────────────────────────────────────────────── */
export default function RecurringInvoices() {
  const location = useLocation();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const {
    recurringInvoices,
    loading,
    error,
    addRecurringInvoice,
    editRecurringInvoice,
    removeRecurringInvoice,
    refetch,
  } = useRecurringInvoices();

  const { allCustomers } = useCustomers();
  const { allProducts, addProduct } = useProducts();

  const isFormPage = location.pathname.endsWith("/new");
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [form, setForm] = useState(getInitialForm);

  const openNew = () => {
    setEditingId(null);
    setForm(getInitialForm());
    navigate("/recurring-invoices/new");
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      ...getInitialForm(),
      ...item,
      items: item.items?.length
        ? item.items.map((it) => ({
            ...it,
            id: it.id || `item_${Math.random().toString(36).substr(2, 6)}`,
            description: it.description || it.productName || it.name || "",
            hsnCode: it.hsnCode || it.hsn || "",
          }))
        : [{ ...emptyItem, id: `item_${Date.now()}` }],
    });
    navigate("/recurring-invoices/new");
  };

  const handleSave = async (event, payload) => {
    if (event) event.preventDefault();

    if (!payload.profileName?.trim()) {
      showError("Please enter a profile name.");
      return;
    }
    if (!payload.customerId) {
      showError("Please select a client for this recurring invoice.");
      return;
    }
    if (!payload.items || !payload.items.some((it) => it.description?.trim() && Number(it.quantity) > 0)) {
      showError("Please add at least one line item with description and quantity.");
      return;
    }
    if (!payload.neverExpires && (!payload.endsOn || payload.endsOn <= payload.startOn)) {
      showError("Ends On date must be after Start On date.");
      return;
    }

    const customer = allCustomers.find((c) => c.id === payload.customerId) || payload.client;
    const data = {
      ...payload,
      customerName: customer?.name || payload.customerName || "Customer",
      client: customer || payload.client,
      status: payload.status || "Active",
      nextRunDate: calculateNextRunDate(payload.startOn, payload.repeatEvery),
      lastRunDate: payload.lastRunDate || "",
    };

    try {
      if (editingId) {
        await editRecurringInvoice(editingId, data);
        success("Recurring invoice updated successfully.");
      } else {
        await addRecurringInvoice(data);
        success("Recurring invoice created successfully.");
      }
      navigate("/recurring-invoices");
    } catch (err) {
      showError(err.message || "Failed to save recurring invoice.");
    }
  };

  const handleRemove = async (item) => {
    if (!window.confirm(`Are you sure you want to delete profile "${item.profileName}"?`)) {
      return;
    }
    try {
      await removeRecurringInvoice(item.id);
      success("Recurring invoice deleted.");
    } catch (e) {
      showError(e.message || "Failed to delete recurring invoice.");
    }
  };

  const handleTogglePause = async (item) => {
    const currentStatus = getProfileStatus(item);
    if (currentStatus === "Expired") {
      showError("Cannot resume an expired recurring invoice.");
      return;
    }
    const newStatus = currentStatus === "Paused" ? "Active" : "Paused";
    try {
      await editRecurringInvoice(item.id, { status: newStatus });
      success(`Recurring invoice ${newStatus === "Paused" ? "paused" : "resumed"}.`);
    } catch (e) {
      showError(e.message || "Failed to update status.");
    }
  };

  // Filter and search
  const filteredList = useMemo(() => {
    return recurringInvoices.filter((item) => {
      const status = getProfileStatus(item);
      if (statusFilter !== "All" && status !== statusFilter) {
        return false;
      }
      if (search) {
        const query = search.toLowerCase();
        const combined = `${item.profileName} ${item.customerName} ${item.repeatEvery}`.toLowerCase();
        return combined.includes(query);
      }
      return true;
    });
  }, [recurringInvoices, search, statusFilter]);

  // If on create/edit form page
  if (isFormPage) {
    return (
      <RecurringInvoiceForm
        form={form}
        setForm={setForm}
        products={allProducts}
        customers={allCustomers}
        editingId={editingId}
        onSave={handleSave}
        onCancel={() => navigate("/recurring-invoices")}
        addProduct={addProduct}
      />
    );
  }

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recurring Invoices</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage profiles that automatically generate and schedule invoices.
            </p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="flex items-center px-4 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Recurring Invoice
          </button>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            {/* Status Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              {["All", "Active", "Paused", "Expired"].map((tab) => {
                const count =
                  tab === "All"
                    ? recurringInvoices.length
                    : recurringInvoices.filter((it) => getProfileStatus(it) === tab).length;
                const isActive = statusFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tab}
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive ? "bg-blue-700 text-white" : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by profile or client name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>

        {/* Main Table Content */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 shadow-sm">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
            <p className="text-sm font-medium">Loading recurring invoices...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <Repeat className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No Recurring Invoices Found</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
              {search || statusFilter !== "All"
                ? "Try adjusting your search or filter options."
                : "Set up a recurring schedule to automatically bill customers on a weekly, monthly, or custom basis."}
            </p>
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Profile
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/80 text-gray-600 text-xs uppercase font-semibold border-b">
                  <tr>
                    <th className="px-5 py-3.5">Profile Name</th>
                    <th className="px-5 py-3.5">Client</th>
                    <th className="px-5 py-3.5">Frequency</th>
                    <th className="px-5 py-3.5">Next Run Date</th>
                    <th className="px-5 py-3.5 text-right">Amount (₹)</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredList.map((item) => {
                    const status = getProfileStatus(item);
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-5 py-4 font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-600 font-bold hover:underline cursor-pointer" onClick={() => openEdit(item)}>
                              {item.profileName}
                            </span>
                            {item.orderNumber && (
                              <span className="text-[11px] text-gray-400">({item.orderNumber})</span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-gray-900 font-medium">{item.customerName || item.client?.name || "—"}</div>
                          {item.client?.email && (
                            <div className="text-xs text-gray-500">{item.client.email}</div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            <Clock className="w-3 h-3 mr-1 text-gray-500" />
                            {item.repeatEvery}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-gray-600 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {item.nextRunDate || calculateNextRunDate(item.startOn, item.repeatEvery) || "—"}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-gray-900">
                          ₹{Number(item.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              status === "Active"
                                ? "bg-green-100 text-green-800"
                                : status === "Paused"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {status === "Active" && <CheckCircle className="w-3 h-3 mr-1" />}
                            {status === "Paused" && <AlertCircle className="w-3 h-3 mr-1" />}
                            {status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => handleTogglePause(item)}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                status === "Paused"
                                  ? "text-green-600 border-green-200 hover:bg-green-50"
                                  : "text-amber-600 border-amber-200 hover:bg-amber-50"
                              }`}
                              title={status === "Paused" ? "Resume recurring invoice" : "Pause recurring invoice"}
                            >
                              {status === "Paused" ? (
                                <Play className="w-4 h-4" />
                              ) : (
                                <Pause className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="p-1.5 text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit recurring invoice"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemove(item)}
                              className="p-1.5 text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete recurring invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
