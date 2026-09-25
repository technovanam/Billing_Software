import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Users,
  UserCheck,
  UserX,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  ShieldCheck,
  KeyRound,
  Store,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Lock,
} from "lucide-react";
import { useCashiers } from "../../hooks/useFirestore";
import PosDevicesPanel from "../../components/pos/PosDevicesPanel";
import { useToast } from "../../context/ToastContext";
import Pagination from "../../components/Pagination";

// Modal Wrapper Component
const ModalWrapper = ({ children, onClose, maxWidth = "max-w-md" }) => (
  <div
    className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-fade-in-up"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
  >
    <div
      className={`bg-white rounded-lg shadow-xl w-full ${maxWidth} relative overflow-hidden border border-slate-200`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

ModalWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  onClose: PropTypes.func.isRequired,
  maxWidth: PropTypes.string,
};

// Cashier Form Modal (Create / Edit)
const CashierFormModal = ({
  onClose,
  onSave,
  cashierToEdit,
  nextSuggestedId,
  existingCounters = [],
}) => {
  const [cashierId, setCashierId] = useState(
    cashierToEdit?.cashierId || ""
  );
  const [name, setName] = useState(cashierToEdit?.name || "");
  const [phone, setPhone] = useState(
    (cashierToEdit?.phone || "").replace(/^\+91\s*/, "").replace(/\D/g, "").slice(0, 10)
  );
  const [email, setEmail] = useState(cashierToEdit?.email || "");
  const [counter, setCounter] = useState(cashierToEdit?.counter || "");
  const [isCustomCounter, setIsCustomCounter] = useState(false);
  const [customCounterName, setCustomCounterName] = useState("");
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState(cashierToEdit?.status || "Active");
  const [showPin, setShowPin] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");

    // 1. Phone number validation (10 digits if provided)
    if (phone && phone.length !== 10) {
      setFormError("Phone number must be exactly 10 digits.");
      return;
    }

    // 2. 4-digit PIN validation (new cashiers need one; blank on edit keeps the current PIN)
    if ((pin.trim() || !cashierToEdit) && !/^\d{4}$/.test(pin.trim())) {
      setFormError("PIN / Passcode must be exactly 4 numeric digits (e.g. 1234).");
      return;
    }

    // 3. Counter selection or custom counter
    let assignedCounter = counter;
    if (isCustomCounter || counter === "__NEW_COUNTER__") {
      const trimmedCustom = customCounterName.trim();
      if (!trimmedCustom) {
        setFormError("Please enter a name for the new counter.");
        return;
      }
      assignedCounter = trimmedCustom;
    }

    onSave({
      cashierId: cashierId.trim().toUpperCase(),
      name: name.trim(),
      phone: phone ? `+91 ${phone}` : "",
      email: email.trim(),
      counter: assignedCounter,
      ...(pin.trim() ? { pin: pin.trim() } : {}),
      status,
    });
  };

  return (
    <ModalWrapper onClose={onClose} maxWidth="max-w-lg">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {cashierToEdit ? "Edit Cashier Profile" : "Add New Cashier"}
            </h3>
            <p className="text-xs text-slate-500">Configure counter staff credentials & counter</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4" autoComplete="off">
        {formError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{formError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cashier ID */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Cashier ID *
            </label>
            <input
              type="text"
              name="cashier_id_field"
              autoComplete="off"
              required
              value={cashierId}
              onChange={(e) => setCashierId(e.target.value)}
              placeholder="Enter Cashier ID"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Staff Full Name *
            </label>
            <input
              type="text"
              name="staff_name_field"
              autoComplete="off"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter staff full name"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Phone Number (+91)
            </label>
            <div className="relative flex rounded-lg border border-slate-300 bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
              <span className="inline-flex items-center px-3 text-xs font-bold text-slate-600 bg-slate-100 border-r border-slate-300 select-none">
                +91
              </span>
              <input
                type="tel"
                name="phone_field"
                autoComplete="off"
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setPhone(digits);
                }}
                placeholder="Enter mobile number"
                className="w-full px-3.5 py-2.5 bg-slate-50 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">10-digit Indian mobile number</p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="cashier_email_field"
              autoComplete="new-password"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Assigned Counter & Add New Counter */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Assigned Counter
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCustomCounter(!isCustomCounter);
                  if (!isCustomCounter) {
                    setCounter("__NEW_COUNTER__");
                  } else {
                    setCounter(existingCounters[0] || "Counter 01");
                  }
                }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition"
              >
                {isCustomCounter ? "← Select Existing" : "+ Add New Counter"}
              </button>
            </div>

            {isCustomCounter || counter === "__NEW_COUNTER__" ? (
              <input
                type="text"
                required
                value={customCounterName}
                onChange={(e) => setCustomCounterName(e.target.value)}
                placeholder="e.g. Counter 05 / Express Desk"
                className="w-full px-3.5 py-2.5 bg-white border border-blue-400 rounded-lg text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <select
                value={counter}
                required
                onChange={(e) => {
                  if (e.target.value === "__NEW_COUNTER__") {
                    setIsCustomCounter(true);
                  } else {
                    setCounter(e.target.value);
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>Select Counter</option>
                {existingCounters.map((cnt) => (
                  <option key={cnt} value={cnt}>
                    {cnt}
                  </option>
                ))}
                <option value="__NEW_COUNTER__">+ Add New Counter...</option>
              </select>
            )}
          </div>

          {/* 4-Digit Terminal PIN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              {cashierToEdit ? "New 4-Digit PIN (leave blank to keep the current one)" : "4-Digit PIN / Passcode *"}
            </label>
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                name="cashier_pin_field"
                autoComplete="new-password"
                required={!cashierToEdit}
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPin(digits);
                }}
                placeholder="e.g. 1234"
                className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest tabular-nums"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Exactly 4 numeric digits for POS login</p>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
            Account Status
          </label>
          <div className="flex gap-3">
            {["Active", "Inactive"].map((st) => (
              <label
                key={st}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border cursor-pointer text-xs font-bold transition ${
                  status === st
                    ? st === "Active"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-red-50 border-red-300 text-red-800"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={st}
                  checked={status === st}
                  onChange={() => setStatus(st)}
                  className="hidden"
                />
                <span>{st}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
          >
            {cashierToEdit ? "Save Changes" : "Create Cashier"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

CashierFormModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  cashierToEdit: PropTypes.object,
  nextSuggestedId: PropTypes.string,
  existingCounters: PropTypes.array,
};

// Main Cashier Management Component
export default function CashierManagement() {
  const {
    cashiers,
    allCashiers,
    loading,
    addCashier,
    editCashier,
    removeCashier,
    toggleStatus,
    pinStatus,
  } = useCashiers();

  const { success: toastSuccess, error: toastError } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cashierToEdit, setCashierToEdit] = useState(null);
  const [cashierToDelete, setCashierToDelete] = useState(null);

  // Stats calculation
  const stats = useMemo(() => {
    const total = allCashiers.length;
    const active = allCashiers.filter((c) => (c.status || "Active") === "Active").length;
    const inactive = total - active;
    const uniqueCounters = new Set(allCashiers.map((c) => c.counter || "Counter 01")).size;
    return { total, active, inactive, uniqueCounters };
  }, [allCashiers]);

  // Unique counters list
  const existingCounters = useMemo(() => {
    const counterSet = new Set(["Counter 01", "Counter 02", "Counter 03", "Counter 04"]);
    allCashiers.forEach((c) => {
      if (c.counter) counterSet.add(c.counter);
    });
    return Array.from(counterSet);
  }, [allCashiers]);

  // Next suggested ID e.g. CSH-001, CSH-002...
  const nextSuggestedId = useMemo(() => {
    return `CSH-${String(allCashiers.length + 1).padStart(3, "0")}`;
  }, [allCashiers.length]);

  // Filtered Cashiers
  const filteredCashiers = useMemo(() => {
    let list = Array.isArray(allCashiers) ? [...allCashiers] : [];
    if (statusFilter !== "All") {
      list = list.filter((c) => (c.status || "Active") === statusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.cashierId?.toLowerCase().includes(q) ||
          c.name?.toLowerCase().includes(q) ||
          c.counter?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allCashiers, statusFilter, searchTerm]);

  // Handle Save (Create / Update)
  const handleSave = async (payload) => {
    try {
      if (cashierToEdit) {
        await editCashier(cashierToEdit.id, payload);
        toastSuccess(`Cashier "${payload.name}" updated successfully!`);
      } else {
        await addCashier(payload);
        toastSuccess(`Cashier "${payload.name}" added with ID ${payload.cashierId}!`);
      }
      setIsModalOpen(false);
      setCashierToEdit(null);
    } catch (err) {
      console.error("Save cashier error:", err);
      toastError(err?.message || "Failed to save cashier.");
    }
  };

  // Handle Delete
  const handleDelete = async (id) => {
    try {
      await removeCashier(id);
      toastSuccess("Cashier removed successfully.");
      setCashierToDelete(null);
    } catch (err) {
      console.error("Delete cashier error:", err);
      toastError("Failed to delete cashier.");
    }
  };


  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
      {/* Header Section (Matching Admin Dashboard) */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cashier Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure counter staff, PINs, assigned counters and the devices they can sign in on
          </p>
        </div>

        <div className="flex items-center gap-2 mt-3 sm:mt-0">
          <button
            onClick={() => {
              setCashierToEdit(null);
              setIsModalOpen(true);
            }}
            className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Cashier</span>
          </button>
        </div>
      </header>

      <main className="mt-6 flex flex-col gap-6">
      {/* Stats Grid (Matching Admin Dashboard Stat Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Cashiers</h3>
            <div className="p-1 bg-gray-50 rounded-md"><Users className="text-blue-600" /></div>
          </div>
          <div className="mt-1">
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            <div className="flex items-center gap-2 body-text-small mt-2">
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                Staff with POS access
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-medium text-gray-600">Active Cashiers</h3>
            <div className="p-1 bg-gray-50 rounded-md"><UserCheck className="text-green-500" /></div>
          </div>
          <div className="mt-1">
            <p className="text-xl font-bold text-gray-900">{stats.active}</p>
            <div className="flex items-center gap-2 body-text-small mt-2">
              <span className="bg-green-600 text-white px-2 py-0.5 rounded-full font-medium">
                Ready for counter shifts
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-medium text-gray-600">Inactive Cashiers</h3>
            <div className="p-1 bg-gray-50 rounded-md"><UserX className="text-red-500" /></div>
          </div>
          <div className="mt-1">
            <p className="text-xl font-bold text-gray-900">{stats.inactive}</p>
            <div className="flex items-center gap-2 body-text-small mt-2">
              <span className="bg-red-600 text-white px-2 py-0.5 rounded-full font-medium">
                Disabled accounts
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-medium text-gray-600">Active Counters</h3>
            <div className="p-1 bg-gray-50 rounded-md"><Store className="text-indigo-600" /></div>
          </div>
          <div className="mt-1">
            <p className="text-xl font-bold text-gray-900">{stats.uniqueCounters}</p>
            <div className="flex items-center gap-2 body-text-small mt-2">
              <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">
                Assigned billing desks
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Tabs & Search Bar (Matching Invoices Page) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="w-fit lg:w-auto overflow-x-auto pb-1">
          <div className="flex p-1 bg-white border border-slate-300 rounded-xl whitespace-nowrap shadow-xs">
            {[
              { value: "All", label: "All", count: stats.total },
              { value: "Active", label: "Active", count: stats.active },
              { value: "Inactive", label: "Inactive", count: stats.inactive },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${statusFilter === tab.value
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
                  }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full sm:w-auto flex-1 lg:flex-none">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search cashiers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Cashiers Table */}
      <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Table Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading cashiers...</div>
          ) : filteredCashiers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">No cashiers found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {searchTerm
                  ? "Try another search term"
                  : "Click '+ Add New Cashier' to add counter staff."}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th scope="col" className="px-6 py-3">Cashier ID</th>
                  <th scope="col" className="px-6 py-3">Staff Name</th>
                  <th scope="col" className="px-6 py-3">Assigned Counter</th>
                  <th scope="col" className="px-6 py-3">Contact</th>
                  <th scope="col" className="px-6 py-3">Terminal PIN</th>
                  <th scope="col" className="px-6 py-3">Status</th>
                  <th scope="col" className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCashiers.map((cashier) => {
                  const access = pinStatus[(cashier.cashierId || "").toUpperCase()];

                  return (
                    <tr key={cashier.id} className="transition-colors hover:bg-gray-50">
                      {/* Cashier ID */}
                      <td className="px-6 py-4 font-bold text-slate-900 tabular-nums">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                          {cashier.cashierId || "BAL/086430"}
                        </span>
                      </td>

                      {/* Staff Name & Initials Avatar */}
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                            {(cashier.name || "C")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{cashier.name || "Cashier"}</p>
                            <p className="text-[10px] text-slate-400">Added: {cashier.createdAt ? new Date(cashier.createdAt).toLocaleDateString("en-GB") : "Recently"}</p>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Counter */}
                      <td className="px-6 py-4 text-slate-700 font-medium">
                        <span className="inline-flex items-center gap-1">
                          <Store className="h-3.5 w-3.5 text-slate-400" />
                          <span>{cashier.counter || "Counter 01"}</span>
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4 text-slate-600">
                        <p>{cashier.phone || "—"}</p>
                        {cashier.email && <p className="text-[10px] text-slate-400">{cashier.email}</p>}
                      </td>

                      {/* Terminal PIN: status only; PINs are stored hashed on the server */}
                      <td className="px-6 py-4 text-xs" data-testid="pin-status">
                        {!access ? (
                          <span className="text-slate-400">—</span>
                        ) : access.lockedUntil ? (
                          <span className="font-semibold text-red-700">Locked until {new Date(access.lockedUntil).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                        ) : access.pinSet ? (
                          <span className="font-semibold text-emerald-700">PIN set</span>
                        ) : (
                          <span className="font-semibold text-amber-700">PIN not set: cannot sign in</span>
                        )}
                        {access?.lastLoginAt && <p className="text-[10px] text-slate-400">Last login {new Date(access.lastLoginAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleStatus(cashier.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition ${
                            (cashier.status || "Active") === "Active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                          }`}
                          title="Click to toggle status"
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              (cashier.status || "Active") === "Active"
                                ? "bg-emerald-500"
                                : "bg-red-500"
                            }`}
                          />
                          <span>{cashier.status || "Active"}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setCashierToEdit(cashier);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition shadow-2xs"
                            title="Edit Cashier"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setCashierToDelete(cashier)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition shadow-2xs"
                            title="Delete Cashier"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PosDevicesPanel counters={existingCounters} />
      </main>
      </div>

      {/* Add / Edit Cashier Modal */}
      {isModalOpen && (
        <CashierFormModal
          onClose={() => {
            setIsModalOpen(false);
            setCashierToEdit(null);
          }}
          onSave={handleSave}
          cashierToEdit={cashierToEdit}
          nextSuggestedId={nextSuggestedId}
          existingCounters={existingCounters}
        />
      )}

      {/* Delete Confirmation Modal */}
      {cashierToDelete && (
        <ModalWrapper onClose={() => setCashierToDelete(null)} maxWidth="max-w-sm">
          <div className="p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-600 mx-auto mb-3 border border-red-100">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Remove Cashier?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to remove <strong>{cashierToDelete.name}</strong> ({cashierToDelete.cashierId})? This action cannot be undone.
            </p>
            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setCashierToDelete(null)}
                className="flex-1 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(cashierToDelete.id)}
                className="flex-1 py-2 rounded-lg bg-red-600 text-xs font-bold text-white hover:bg-red-700 transition shadow-sm"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  );
}
