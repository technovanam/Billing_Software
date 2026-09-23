import React, { useState } from "react";
import { Calculator, Edit, FileText, Plus, ReceiptIndianRupee, Trash2, Upload, X, Check, ChevronDown } from "lucide-react";
import { useExpenses, useCustomers } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";

const emptyExpense = {
  title: "",
  category: "",
  amount: "",
  currency: "INR",
  expenseDate: new Date().toISOString().slice(0, 10),
  invoiceNumber: "",
  notes: "",
  customerId: "",
  customerName: "",
  itemized: false,
  receiptName: "",
};

const CATEGORIES = [
  "Advertising & Marketing",
  "Automobile Expense",
  "Bank Fees and Charges",
  "Consultant Expense",
  "Credit Card Charges",
  "General & Administrative Expenses",
  "IT and Internet Expenses",
  "Office Supplies",
  "Postage & Delivery",
  "Printing and Stationery",
  "Rent Expense",
  "Repairs and Maintenance",
  "Salaries and Employee Wages",
  "Software",
  "Telephone Expense",
  "Travel Expense",
  "Utilities",
  "Other Expenses",
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "SGD", "CAD", "AUD"];

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors placeholder:text-slate-400";

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors cursor-pointer appearance-none pr-10";

export default function Expenses() {
  const { expenses, loading, error, addExpense, editExpense, removeExpense } = useExpenses();
  const { allCustomers } = useCustomers();
  const { success, error: showError } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState({ ...emptyExpense });
  const [fileObject, setFileObject] = useState(null);

  const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseCount = expenses.length;
  const averageExpense = expenseCount ? total / expenseCount : 0;
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const openCreate = () => {
    setEditingExpense(null);
    setForm({ ...emptyExpense });
    setFileObject(null);
    setShowForm(true);
  };

  const openEdit = (expense) => {
    setEditingExpense(expense);
    setForm({
      ...emptyExpense,
      ...expense,
      amount: String(expense.amount || ""),
      expenseDate: expense.expenseDate || new Date().toISOString().slice(0, 10),
    });
    setFileObject(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingExpense(null);
    setForm({ ...emptyExpense });
    setFileObject(null);
    setShowForm(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showError("File size exceeds maximum 10MB limit.");
      return;
    }
    setFileObject(file);
    update("receiptName", file.name);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.category) {
      showError("Please select a category.");
      return;
    }
    if (!amount || amount <= 0) {
      showError("Please enter a valid amount.");
      return;
    }

    const payload = {
      ...form,
      title: form.title?.trim() || form.category,
      amount,
    };

    try {
      if (editingExpense) {
        await editExpense(editingExpense.id, payload);
        success("Expense updated successfully.");
      } else {
        await addExpense(payload);
        success("Expense saved successfully.");
      }
      closeForm();
    } catch (submitError) {
      showError(submitError.message || "Unable to save expense.");
    }
  };

  const handleDelete = async (expense) => {
    if (!window.confirm(`Delete ${expense.title || expense.category}?`)) return;
    try {
      await removeExpense(expense.id);
      success("Expense deleted.");
    } catch (deleteError) {
      showError(deleteError.message || "Unable to delete expense.");
    }
  };

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
            <p className="mt-1 text-sm text-gray-600">Track business expenses for the current financial year.</p>
          </div>
          {!showForm && (
            <button
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Expense
            </button>
          )}
        </header>

        {showForm ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
                {/* Left Column — Form Inputs */}
                <div className="space-y-5">
                  {/* Date */}
                  <div>
                    <label htmlFor="expense-date" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Date<span className="text-red-500">*</span>
                    </label>
                    <input
                      id="expense-date"
                      type="date"
                      max="9999-12-31"
                      value={form.expenseDate}
                      onChange={(e) => update("expenseDate", e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>

                  {/* Category Name */}
                  <div>
                    <label htmlFor="expense-category" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Category Name<span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="expense-category"
                        value={form.category}
                        onChange={(e) => update("category", e.target.value)}
                        className={selectClass}
                        required
                      >
                        <option value="">Select Category</option>
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                    </div>
                  </div>

                  {/* Itemize Checkbox */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      type="checkbox"
                      id="itemize-checkbox"
                      checked={form.itemized}
                      onChange={(e) => update("itemized", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="itemize-checkbox" className="text-sm font-medium text-blue-600 cursor-pointer select-none">
                      Itemize
                    </label>
                  </div>

                  {/* Amount */}
                  <div>
                    <label htmlFor="expense-amount" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Amount<span className="text-red-500">*</span>
                    </label>
                    <div className="flex rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-colors">
                      <div className="relative bg-slate-50 border-r border-slate-300 flex items-center">
                        <select
                          value={form.currency}
                          onChange={(e) => update("currency", e.target.value)}
                          className="bg-transparent pl-3.5 pr-7 py-3 text-sm font-semibold text-slate-700 outline-none cursor-pointer appearance-none"
                        >
                          {CURRENCIES.map((curr) => (
                            <option key={curr} value={curr}>
                              {curr}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" />
                      </div>
                      <input
                        id="expense-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => update("amount", e.target.value)}
                        placeholder=""
                        className="w-full px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                        required
                      />
                    </div>
                  </div>

                  {/* Invoice# */}
                  <div>
                    <label htmlFor="expense-invoice-number" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Invoice#
                    </label>
                    <input
                      id="expense-invoice-number"
                      type="text"
                      value={form.invoiceNumber || ""}
                      onChange={(e) => update("invoiceNumber", e.target.value)}
                      placeholder=""
                      className={inputClass}
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label htmlFor="expense-notes" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Notes
                    </label>
                    <textarea
                      id="expense-notes"
                      rows={4}
                      maxLength={500}
                      value={form.notes}
                      onChange={(e) => update("notes", e.target.value)}
                      placeholder="Max. 500 characters"
                      className={`${inputClass} resize-y`}
                    />
                  </div>

                  {/* Customer Name */}
                  <div>
                    <label htmlFor="expense-customer" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Customer Name
                    </label>
                    <div className="relative">
                      <select
                        id="expense-customer"
                        value={form.customerId || ""}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const found = allCustomers.find((c) => c.id === selectedId);
                          update("customerId", selectedId);
                          update("customerName", found?.name || "");
                        }}
                        className={selectClass}
                      >
                        <option value="">Select or add a customer</option>
                        {allCustomers.map((cust) => (
                          <option key={cust.id} value={cust.id}>
                            {cust.name || cust.companyName}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                    </div>
                  </div>
                </div>

                {/* Right Column — Drag & Drop Receipts */}
                <div className="flex flex-col h-full">
                  <div className="flex-1 rounded-2xl border-2 border-dashed border-blue-200/90 bg-blue-50/20 p-8 flex flex-col items-center justify-center text-center min-h-[360px]">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Upload className="h-7 w-7 text-blue-600" strokeWidth={2} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">Drag or Drop your Receipts</h4>
                    <p className="text-xs text-slate-400 mb-6">Maximum file size allowed is 10MB</p>

                    {form.receiptName ? (
                      <div className="flex items-center gap-2 bg-white border border-green-200 rounded-xl px-4 py-2 text-xs font-semibold text-green-700 shadow-sm mb-4">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="truncate max-w-[180px]">{form.receiptName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            update("receiptName", "");
                            setFileObject(null);
                          }}
                          className="text-slate-400 hover:text-red-500 ml-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}

                    <label className="cursor-pointer inline-flex items-center justify-center px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition-colors">
                      Upload your Files
                      <input type="file" onChange={handleFileChange} accept="image/*,.pdf" className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-8 flex justify-end items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
                >
                  {editingExpense ? "Update Expense" : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="text-sm font-medium text-slate-600">Total Expenses</h3>
                  <div className="rounded-md bg-orange-50 p-2">
                    <ReceiptIndianRupee className="h-5 w-5 text-orange-500" />
                  </div>
                </div>
                <p className="text-xl font-bold text-slate-900">{money(total)}</p>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="rounded-full bg-orange-600 px-2 py-0.5 font-medium text-white">Expenses</span>
                  <span className="text-slate-500">Current FY</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="text-sm font-medium text-slate-600">Expense Records</h3>
                  <div className="rounded-md bg-blue-50 p-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-xl font-bold text-slate-900">{expenseCount}</p>
                <p className="mt-3 text-sm text-slate-500">Current FY</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="text-sm font-medium text-slate-600">Average Expense</h3>
                  <div className="rounded-md bg-purple-50 p-2">
                    <Calculator className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <p className="text-xl font-bold text-slate-900">{money(averageExpense)}</p>
                <p className="mt-3 text-sm text-slate-500">Current FY</p>
              </div>
            </div>

            {/* Expenses Table */}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {loading ? (
                <p className="p-6 text-sm text-slate-500">Loading expenses...</p>
              ) : expenses.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="font-medium text-slate-700">No expenses recorded yet</p>
                  <p className="mt-1 text-sm text-slate-500">Add your first business expense to see it on the dashboard.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 text-left font-semibold text-slate-600">Expense</th>
                        <th className="px-5 py-3 text-left font-semibold text-slate-600">Category</th>
                        <th className="px-5 py-3 text-left font-semibold text-slate-600">Invoice#</th>
                        <th className="px-5 py-3 text-left font-semibold text-slate-600">Customer</th>
                        <th className="px-5 py-3 text-left font-semibold text-slate-600">Date</th>
                        <th className="px-5 py-3 text-right font-semibold text-slate-600">Amount</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-4 font-medium text-slate-900">{expense.title || expense.category}</td>
                          <td className="px-5 py-4 text-slate-600">{expense.category || "-"}</td>
                          <td className="px-5 py-4 text-slate-600">{expense.invoiceNumber || "-"}</td>
                          <td className="px-5 py-4 text-slate-600">{expense.customerName || "-"}</td>
                          <td className="px-5 py-4 text-slate-600">{expense.expenseDate || "-"}</td>
                          <td className="px-5 py-4 text-right font-semibold">{money(expense.amount)}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => openEdit(expense)} title="Edit expense" className="text-slate-500 hover:text-blue-600">
                                <Edit className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDelete(expense)} title="Delete expense" className="text-slate-500 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
