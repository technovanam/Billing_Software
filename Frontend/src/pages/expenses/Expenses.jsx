import React, { useState } from "react";
import { Calculator, Edit, FileText, Plus, ReceiptIndianRupee, Trash2, Upload } from "lucide-react";
import { useExpenses } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";

const emptyExpense = {
  title: "",
  category: "",
  amount: "",
  currency: "INR",
  expenseDate: new Date().toISOString().slice(0, 10),
  notes: "",
  itemized: false,
  receiptName: "",
};

const money = (amount) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
}).format(Number(amount) || 0);

const fieldClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function Expenses() {
  const { expenses, loading, error, addExpense, editExpense, removeExpense } = useExpenses();
  const { success, error: showError } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState({ ...emptyExpense });

  const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseCount = expenses.length;
  const averageExpense = expenseCount ? total / expenseCount : 0;
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const openCreate = () => {
    setEditingExpense(null);
    setForm({ ...emptyExpense });
    setShowForm(true);
  };

  const openEdit = (expense) => {
    setEditingExpense(expense);
    setForm({ ...emptyExpense, ...expense, amount: String(expense.amount || "") });
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingExpense(null);
    setForm({ ...emptyExpense });
    setShowForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.category || !amount || amount < 0) {
      showError("Enter a category and a valid amount.");
      return;
    }

    const payload = {
      ...form,
      title: form.title.trim() || form.category,
      amount,
    };

    try {
      if (editingExpense) {
        await editExpense(editingExpense.id, payload);
        success("Expense updated.");
      } else {
        await addExpense(payload);
        success("Expense added.");
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
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
            <p className="mt-1 text-sm text-gray-600">Track business expenses for the current financial year.</p>
          </div>
          {!showForm && (
            <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Add Expense
            </button>
          )}
        </header>

        {showForm ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <form onSubmit={handleSubmit} className="p-5 sm:p-6">
                <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(220px,32%)]">
                  <div className="space-y-5">
                    <div>
                      <label htmlFor="expense-date" className="mb-1 block text-sm font-medium text-slate-700">Date<span className="text-red-500">*</span></label>
                      <input id="expense-date" type="date" value={form.expenseDate} onChange={(event) => update("expenseDate", event.target.value)} className={fieldClass} required />
                    </div>
                    <div>
                      <label htmlFor="expense-category" className="mb-1 block text-sm font-medium text-slate-700">Category Name<span className="text-red-500">*</span></label>
                      <select id="expense-category" value={form.category} onChange={(event) => update("category", event.target.value)} className={fieldClass} required>
                        <option value="">Select Category</option>
                        <option value="Office Supplies">Office Supplies</option>
                        <option value="Travel">Travel</option>
                        <option value="Software">Software</option>
                        <option value="Utilities">Utilities</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="expense-title" className="mb-1 block text-sm font-medium text-slate-700">Expense Title</label>
                      <input id="expense-title" type="text" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Short title (optional)" className={fieldClass} />
                    </div>
                    <div>
                      <label htmlFor="expense-amount" className="mb-1 block text-sm font-medium text-slate-700">Amount<span className="text-red-500">*</span></label>
                      <input id="expense-amount" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => update("amount", event.target.value)} placeholder="0.00" className={fieldClass} required />
                    </div>
                    <div>
                      <label htmlFor="expense-notes" className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                      <textarea id="expense-notes" rows={4} value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Additional notes or payment method" className={fieldClass} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Receipt / Details</h3>
                    <div>
                      <label htmlFor="receipt-name" className="mb-1 block text-xs font-medium text-slate-600">Receipt Name</label>
                      <input id="receipt-name" type="text" value={form.receiptName} onChange={(event) => update("receiptName", event.target.value)} placeholder="e.g. Inv #1042" className={fieldClass} />
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
                  <button type="button" onClick={closeForm} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                  <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">{editingExpense ? "Update Expense" : "Save Expense"}</button>
                </div>
            </form>
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"><div className="mb-2 flex items-start justify-between"><h3 className="text-sm font-medium text-slate-600">Total Expenses</h3><div className="rounded-md bg-orange-50 p-2"><ReceiptIndianRupee className="h-5 w-5 text-orange-500" /></div></div><p className="text-xl font-bold text-slate-900">{money(total)}</p><div className="mt-3 flex items-center gap-2 text-sm"><span className="rounded-full bg-orange-600 px-2 py-0.5 font-medium text-white">Expenses</span><span className="text-slate-500">Current FY</span></div></div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"><div className="mb-2 flex items-start justify-between"><h3 className="text-sm font-medium text-slate-600">Expense Records</h3><div className="rounded-md bg-blue-50 p-2"><FileText className="h-5 w-5 text-blue-600" /></div></div><p className="text-xl font-bold text-slate-900">{expenseCount}</p><p className="mt-3 text-sm text-slate-500">Current FY</p></div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"><div className="mb-2 flex items-start justify-between"><h3 className="text-sm font-medium text-slate-600">Average Expense</h3><div className="rounded-md bg-purple-50 p-2"><Calculator className="h-5 w-5 text-purple-600" /></div></div><p className="text-xl font-bold text-slate-900">{money(averageExpense)}</p><p className="mt-3 text-sm text-slate-500">Current FY</p></div>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">{loading ? <p className="p-6 text-sm text-slate-500">Loading expenses...</p> : expenses.length === 0 ? <div className="p-10 text-center"><p className="font-medium text-slate-700">No expenses recorded yet</p><p className="mt-1 text-sm text-slate-500">Add your first business expense to see it on the dashboard.</p></div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr><th className="px-5 py-3 text-left font-semibold text-slate-600">Expense</th><th className="px-5 py-3 text-left font-semibold text-slate-600">Category</th><th className="px-5 py-3 text-left font-semibold text-slate-600">Date</th><th className="px-5 py-3 text-right font-semibold text-slate-600">Amount</th><th /></tr></thead><tbody className="divide-y divide-slate-100">{expenses.map((expense) => <tr key={expense.id}><td className="px-5 py-4 font-medium text-slate-900">{expense.title || expense.category}</td><td className="px-5 py-4 text-slate-600">{expense.category || "-"}</td><td className="px-5 py-4 text-slate-600">{expense.expenseDate || "-"}</td><td className="px-5 py-4 text-right font-semibold">{money(expense.amount)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => openEdit(expense)} title="Edit expense" className="text-slate-500 hover:text-blue-600"><Edit className="h-4 w-4" /></button><button onClick={() => handleDelete(expense)} title="Delete expense" className="text-slate-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>}</div>
          </>
        )}
      </div>
    </div>
  );
}
