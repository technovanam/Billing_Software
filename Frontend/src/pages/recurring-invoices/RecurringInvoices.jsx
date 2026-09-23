import React, { useMemo, useState, useEffect, useRef } from "react";
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
  AlertCircle,
  Filter,
  ChevronDown
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
  const [statusFilter, setStatusFilter] = useState("All Invoices");
  const [showFilters, setShowFilters] = useState(false);
  const [filterFrequency, setFilterFrequency] = useState("All");
  const [filterClientId, setFilterClientId] = useState("");
  const filterRef = useRef(null);
  const [form, setForm] = useState(getInitialForm);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };
    if (showFilters) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFilters]);

  const clearFilters = () => {
    setFilterFrequency("All");
    setFilterClientId("");
  };

  const hasActiveFilters = filterFrequency !== "All" || filterClientId !== "";
  const tabs = ["All Invoices", "Active", "Paused", "Expired"];

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
      if (statusFilter !== "All Invoices" && statusFilter !== "All" && status !== statusFilter) {
        return false;
      }
      if (filterFrequency !== "All" && item.repeatEvery !== filterFrequency) {
        return false;
      }
      if (filterClientId && item.customerId !== filterClientId && item.client?.id !== filterClientId) {
        return false;
      }
      if (search) {
        const query = search.toLowerCase();
        const combined = `${item.profileName || ""} ${item.orderNumber || ""} ${item.customerName || item.client?.name || ""} ${item.repeatEvery || ""}`.toLowerCase();
        return combined.includes(query);
      }
      return true;
    });
  }, [recurringInvoices, search, statusFilter, filterFrequency, filterClientId]);

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
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Recurring Invoices
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage all your invoices in one place
            </p>
          </div>
        </header>

        <main className="mt-6 flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="w-fit lg:w-auto overflow-x-auto pb-1">
              <div className="flex p-1 bg-white border border-slate-300 rounded-xl whitespace-nowrap shadow-xs">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      statusFilter === tab
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              <div className="relative w-full sm:w-auto flex-1 lg:flex-none">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Filter Button & Dropdown */}
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all border shadow-xs ${
                    hasActiveFilters || showFilters
                      ? "bg-blue-50 text-blue-600 border-blue-300"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Filter size={16} />
                  Filter
                  {hasActiveFilters && <span className="w-2 h-2 bg-blue-600 rounded-full"></span>}
                </button>

                {showFilters && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-900">Filters</h3>
                      <button
                        onClick={clearFilters}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Frequency Filter */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Frequency</label>
                        <div className="relative">
                          <select
                            value={filterFrequency}
                            onChange={(e) => setFilterFrequency(e.target.value)}
                            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                          >
                            <option value="All">All Frequencies</option>
                            {schedules.map((sch) => (
                              <option key={sch} value={sch}>{sch}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>

                      {/* Customer Filter */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Customer</label>
                        <div className="relative">
                          <select
                            value={filterClientId}
                            onChange={(e) => setFilterClientId(e.target.value)}
                            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                          >
                            <option value="">All Customers</option>
                            {allCustomers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setShowFilters(false)}
                        className="w-full mt-2 py-2 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={openNew}
                className="w-full sm:w-auto flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl transition-colors hover:bg-blue-700 shadow-xs"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create Invoice
              </button>
            </div>
          </div>

          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full min-w-[800px]">
              <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left">INVOICE NO</th>
                  <th scope="col" className="px-6 py-3 text-left">DATE</th>
                  <th scope="col" className="px-6 py-3 text-left">CLIENT</th>
                  <th scope="col" className="px-6 py-3 text-left">AMOUNT</th>
                  <th scope="col" className="px-6 py-3 text-left">DUE DATE</th>
                  <th scope="col" className="px-6 py-3 text-left">STATUS</th>
                  <th scope="col" className="px-6 py-3 text-left">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-28"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    </tr>
                  ))
                ) : filteredList.length > 0 ? (
                  filteredList.map((item) => {
                    const status = getProfileStatus(item);
                    return (
                      <tr
                        key={item.id}
                        className="text-sm transition-colors hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 font-medium text-gray-900">
                          <span
                            onClick={() => openEdit(item)}
                            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {item.profileName}
                          </span>
                          {item.orderNumber && (
                            <span className="text-xs text-gray-400 block font-normal mt-0.5">
                              #{item.orderNumber}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {item.startOn || item.createdAt?.slice(0, 10) || "—"}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          <div className="font-medium text-gray-900">{item.customerName || item.client?.name || "Unknown"}</div>
                          {item.client?.email && (
                            <div className="text-xs text-gray-400">{item.client.email}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          ₹{Number(item.total || item.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 mr-1">
                              {item.repeatEvery}
                            </span>
                            {item.nextRunDate || calculateNextRunDate(item.startOn, item.repeatEvery) || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-white text-xs font-medium ${
                              status === "Active"
                                ? "bg-green-500"
                                : status === "Paused"
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <button
                              type="button"
                              onClick={() => handleTogglePause(item)}
                              className={`p-1 transition-colors ${
                                status === "Paused"
                                  ? "text-gray-600 hover:text-green-600"
                                  : "text-gray-600 hover:text-amber-600"
                              }`}
                              title={status === "Paused" ? "Resume recurring invoice" : "Pause recurring invoice"}
                            >
                              {status === "Paused" ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="p-1 text-gray-600 transition-colors hover:text-blue-600"
                              title="Edit Recurring Invoice"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemove(item)}
                              className="p-1 text-gray-600 transition-colors hover:text-red-600"
                              title="Delete Recurring Invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="mb-2 text-gray-500 font-medium">
                        No invoices found
                      </div>
                      <p className="text-sm text-gray-400">
                        {search
                          ? "Try adjusting your search terms"
                          : "Create your first invoice to get started"}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
