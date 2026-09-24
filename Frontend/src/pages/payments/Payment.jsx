import React, { useState, useMemo, useEffect, useContext, useCallback, memo } from "react";
import {
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Check,
  Save,
  X,
  Edit,
  Filter,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { useInvoices, useAllPayments, usePayments, useCustomers } from "../../hooks/useFirestore";
import { AuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import PropTypes from "prop-types";
import TransactionHistoryModal from "./TransactionHistoryModal";
import Pagination from "../../components/Pagination";

// CHANGE: Updated modal to handle transaction ID
const PaymentMethodModal = ({ isOpen, onClose, onConfirm, existingTds = 0 }) => {
  const [method, setMethod] = useState("UPI");
  const [transactionId, setTransactionId] = useState("");
  const [tdsAmount, setTdsAmount] = useState("");
  const { error: showError } = useToast();

  if (!isOpen) return null;

  const handleConfirm = () => {
    // Require transaction ID for UPI and Bank Transfer
    if (
      (method === "UPI" || method === "Bank Transfer") &&
      !transactionId.trim()
    ) {
      showError("Please enter a Transaction ID for this payment method.");
      return;
    }

    // Validate TDS amount
    const tds = parseFloat(tdsAmount) || 0;
    if (tds < 0) {
      showError("TDS Amount cannot be negative.");
      return;
    }

    onConfirm(method, transactionId, tds);
  };

  // Clear transaction ID when switching to Cash
  const handleMethodChange = (newMethod) => {
    setMethod(newMethod);
    if (newMethod === "Cash") {
      setTransactionId("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
        <div className="flex justify-between items-center">
          <h3 className="heading-section">Confirm Payment</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        <p className="body-text text-gray-600 mt-2">
          Select the method used for this payment.
        </p>

        {/* Payment method options */}
        <div className="mt-4 space-y-2">
          <label
            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${method === "UPI"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300"
              }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="UPI"
              checked={method === "UPI"}
              onChange={() => handleMethodChange("UPI")}
              className="form-radio text-blue-600"
            />
            <span className="heading-subsection">UPI</span>
          </label>
          <label
            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${method === "Bank Transfer"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300"
              }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="Bank Transfer"
              checked={method === "Bank Transfer"}
              onChange={() => handleMethodChange("Bank Transfer")}
              className="form-radio text-blue-600"
            />
            <span className="heading-subsection">Bank Transfer</span>
          </label>
          <label
            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${method === "Cash"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300"
              }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="Cash"
              checked={method === "Cash"}
              onChange={() => handleMethodChange("Cash")}
              className="form-radio text-blue-600"
            />
            <span className="heading-subsection">Cash</span>
          </label>
        </div>

        {/* TDS Amount Input - Only show if no TDS recorded yet */}
        {existingTds > 0 ? (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">TDS Recorded:</span> ₹{existingTds}
            </p>
            <p className="text-xs text-gray-500 mt-1">TDS has already been deducted for this invoice.</p>
          </div>
        ) : (
          <div className="mt-4">
            <label htmlFor="tdsAmount" className="block text-sm font-medium text-gray-700 mb-1">
              TDS Amount (Optional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">₹</span>
              </div>
              <input
                id="tdsAmount"
                type="number"
                min="0"
                value={tdsAmount}
                onChange={(e) => setTdsAmount(e.target.value)}
                placeholder="Enter TDS Amount"
                className="w-full pl-8 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">This amount is deducted by client and not part of revenue.</p>
          </div>
        )}

        {/* Transaction ID input */}
        {(method === "UPI" || method === "Bank Transfer") && (
          <div className="mt-4">
            <label htmlFor="transactionId" className="block text-sm font-medium text-gray-700 mb-1">
              Transaction ID
            </label>
            <input
              id="transactionId"
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Enter Transaction ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none"
            />
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 w-full"
          >
            Confirm and Mark as Paid
          </button>
        </div>
      </div>
    </div>
  );
};

// Edit Payment Modal for updating method and status
const EditPaymentModal = ({ isOpen, onClose, onSave, payment }) => {
  const [method, setMethod] = useState(payment?.method || "UPI");
  const [status, setStatus] = useState(payment?.status || "Paid");
  const [transactionId, setTransactionId] = useState(payment?.transactionId || "");

  useEffect(() => {
    if (payment) {
      setMethod(payment.method || "UPI");
      setStatus(payment.status || "Paid");
      setTransactionId(payment.transactionId || "");
    }
  }, [payment]);

  if (!isOpen || !payment) return null;

  const handleSave = () => {
    onSave({
      ...payment,
      method,
      status,
      transactionId,
    });
  };

  const handleMethodChange = (newMethod) => {
    setMethod(newMethod);
    if (newMethod === "Cash") {
      setTransactionId("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center">
          <h3 className="heading-section">Edit Payment</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        <p className="body-text text-gray-600 mt-2">
          Update payment method and status for invoice {payment.invoiceNo}.
        </p>

        {/* Status options */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Status
          </label>
          <div className="space-y-2">
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${status === "Paid" ? "border-green-500 bg-green-50" : "border-gray-300"
              }`}>
              <input
                type="radio"
                name="status"
                value="Paid"
                checked={status === "Paid"}
                onChange={() => setStatus("Paid")}
                className="form-radio text-green-600"
              />
              <span className="heading-subsection">Paid</span>
            </label>
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${status === "Unpaid" ? "border-yellow-500 bg-yellow-50" : "border-gray-300"
              }`}>
              <input
                type="radio"
                name="status"
                value="Unpaid"
                checked={status === "Unpaid"}
                onChange={() => setStatus("Unpaid")}
                className="form-radio text-yellow-600"
              />
              <span className="heading-subsection">Unpaid</span>
            </label>
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${status === "Partial" ? "border-purple-500 bg-purple-50" : "border-gray-300"
              }`}>
              <input
                type="radio"
                name="status"
                value="Partial"
                checked={status === "Partial"}
                onChange={() => setStatus("Partial")}
                className="form-radio text-purple-600"
              />
              <span className="heading-subsection">Partial</span>
            </label>
          </div>
        </div>

        {/* Payment method options */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Method
          </label>
          <div className="space-y-2">
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${method === "UPI" ? "border-blue-500 bg-blue-50" : "border-gray-300"
              }`}>
              <input
                type="radio"
                name="paymentMethod"
                value="UPI"
                checked={method === "UPI"}
                onChange={() => handleMethodChange("UPI")}
                className="form-radio text-blue-600"
              />
              <span className="heading-subsection">UPI</span>
            </label>
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${method === "Bank Transfer" ? "border-blue-500 bg-blue-50" : "border-gray-300"
              }`}>
              <input
                type="radio"
                name="paymentMethod"
                value="Bank Transfer"
                checked={method === "Bank Transfer"}
                onChange={() => handleMethodChange("Bank Transfer")}
                className="form-radio text-blue-600"
              />
              <span className="heading-subsection">Bank Transfer</span>
            </label>
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${method === "Cash" ? "border-blue-500 bg-blue-50" : "border-gray-300"
              }`}>
              <input
                type="radio"
                name="paymentMethod"
                value="Cash"
                checked={method === "Cash"}
                onChange={() => handleMethodChange("Cash")}
                className="form-radio text-blue-600"
              />
              <span className="heading-subsection">Cash</span>
            </label>
          </div>
        </div>

        {/* Transaction ID input */}
        {(method === "UPI" || method === "Bank Transfer") && (
          <div className="mt-4">
            <label htmlFor="editTransactionId" className="block text-sm font-medium text-gray-700 mb-1">
              Transaction ID
            </label>
            <input
              id="editTransactionId"
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Enter Transaction ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none"
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, amount, subtitle, icon: Icon, iconBgColor }) => (
  <div className="bg-white p-3 lg:p-4 border border-gray-200 rounded-lg shadow-sm flex justify-between items-center">
    <div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xl font-bold text-gray-900">{amount}</p>
      <p className="text-xs mt-0.5 text-gray-500">{subtitle}</p>
    </div>
    <div
      className={`w-8 h-8 flex items-center justify-center ${iconBgColor} rounded-full`}
    >
      <Icon size={16} className="text-white" />
    </div>
  </div>
);

const StatusBadge = ({ status, overdueDays }) => {
  const styles = {
    Paid: "bg-green-100 text-green-700",
    Unpaid: "bg-yellow-100 text-yellow-700",
    Overdue: "bg-red-100 text-red-700",
    Partial: "bg-purple-100 text-purple-700"
  };

  const className = `text-xs font-medium px-2.5 py-1 rounded-full ${styles[status] || ""}`;

  if (!styles[status]) return null;

  return (
    <span className={className}>
      {status} {status === "Overdue" ? `(${overdueDays}d)` : ""}
    </span>
  );
};

// PERFORMANCE: Memoized PaymentRow to prevent unnecessary re-renders
const PaymentRow = memo(({
  id,
  invoiceNo,
  client,
  amount,
  received,
  pending,
  dueDate,
  status,
  overdueDays,
  onEdit,
  onViewHistory,
}) => {
  const isOverdue = status === "Overdue";

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      <td className="py-3 px-4 text-sm font-medium text-gray-900">
        {invoiceNo}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800">{client}</td>
      <td className="py-3 px-4 text-sm">
        <p className="font-semibold text-gray-900">{amount}</p>
        {received && (
          <p className="text-xs text-emerald-600 font-medium mt-0.5">Received: {received}</p>
        )}
        {pending && (
          <p className="text-xs text-red-600 font-bold mt-0.5">Balance Due: {pending}</p>
        )}
      </td>
      <td
        className={`py-3 px-4 text-sm ${isOverdue ? "text-red-500" : "text-gray-600"
          }`}
      >
        {dueDate}
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={status} overdueDays={overdueDays} />
      </td>
      <td className="py-4 px-4 flex gap-2 items-center">
        <button
          onClick={() => onViewHistory({ id, invoiceNo, amount })}
          /* Note: invoiceNo is used as ID in some places but we really need the doc ID for querying payments. 
             Wait, PaymentRow consumes 'invoiceNo' but inside PaymentsPage it maps 'id' to 'id'. 
             We need to pass 'id' here or ensure 'invoiceNo' is sufficient query? 
             Actually, the PaymentsPage map function (line 684) passes `id: inv.id`.
             But PaymentRow destructures `invoiceNo`. It doesn't seem to get `id`.
             We need to update PaymentRow props to include `id`.
          */
          className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
          title="View History"
        >
          <Clock size={16} />
        </button>
        {onEdit && (
          <button
            onClick={() => onEdit({ invoiceNo, client, amount, received, dueDate, status, overdueDays })}
            className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
            title="Edit Payment"
          >
            <Edit size={16} />
          </button>
        )}
      </td>
    </tr>
  );
});

PaymentRow.displayName = 'PaymentRow';

// PERFORMANCE: Memoized PendingPaymentCard to prevent unnecessary re-renders
const PendingPaymentCard = memo(({
  invoice,
  onMarkPaid,
  editingPaymentId,
  setEditingPaymentId,
  onInitiatePayment,
  onViewHistory,
}) => {
  const { invoiceNo, client, amount, received, dueDate, status } = invoice;
  const [paidAmount, setPaidAmount] = useState("");

  // TDS input removed from here, will be handled in confirmation modal
  const isEditing = editingPaymentId === invoiceNo;

  // Calculate remaining amount more accurately
  const currentPaidAmount = Number.parseFloat(received || 0) || 0;
  const currentTdsAmount = Number.parseFloat(invoice.tdsAmount || 0) || 0; // Assuming we will pass tdsAmount in invoice prop
  const invoiceAmount = Number.parseFloat(amount || 0) || 0;

  // Remaining amount = Total - Paid - TDS
  const remainingAmount = Math.max(0, invoiceAmount - currentPaidAmount - currentTdsAmount);

  const getStatusColor = (status) => {
    switch (status) {
      case "Overdue": return "bg-red-500";
      case "Partial": return "bg-purple-500";
      default: return "bg-yellow-500";
    }
  };
  const iconBgColor = getStatusColor(status);
  const Icon = status === "Overdue" ? AlertCircle : Clock;

  const handleEnterAmountClick = () => {
    setEditingPaymentId(invoiceNo);
    setPaidAmount("");
  };
  const handleCancel = () => {
    setEditingPaymentId(null);
    setPaidAmount("");
  };
  const handleSave = () => {
    // Validate amounts
    const pAmount = parseFloat(paidAmount) || 0;

    if (pAmount <= 0) {
      // Ideally should show error, but we'll let parent handle or assume simple click
      return;
    }

    // Instead of saving directly, initiate payment flow to get Method
    // We pass 0 for TDS here as it will be collected in the modal
    onInitiatePayment(invoiceNo, paidAmount, 0);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div
          className={`w-11 h-11 ${iconBgColor} rounded-lg flex items-center justify-center flex-shrink-0`}
        >
          <Icon size={24} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900">{invoiceNo}</p>
          <p className="text-sm text-gray-600">{client}</p>
          <p
            className={`text-sm ${status === "Overdue"
              ? "text-red-600 font-medium"
              : "text-gray-500"
              }`}
          >
            Due: {dueDate}
          </p>
        </div>
      </div>
      <div className="w-full md:w-auto flex flex-col items-end md:flex-row md:items-center gap-3">
        <div className="text-right md:mr-6">
          <p className="text-xl font-bold text-gray-900">
            ₹{remainingAmount.toLocaleString()}
          </p>
          {currentPaidAmount > 0 || currentTdsAmount > 0 ? (
            <p className="text-xs text-gray-500">
              Paid: ₹{currentPaidAmount.toLocaleString()}
              {currentTdsAmount > 0 && ` | TDS: ₹${currentTdsAmount.toLocaleString()}`}
              {` | Total: ₹${(invoiceAmount - currentTdsAmount).toLocaleString()}`}
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Total: ₹{invoiceAmount.toLocaleString()}
            </p>
          )}
        </div>

        <button
          onClick={() => onViewHistory({ id: invoice.id, invoiceNo, amount })}
          className="mr-2 p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
          title="View History"
        >
          <Clock size={20} />
        </button>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="Amount Paid"
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm w-32 focus:outline-none"
            />
            {/* TDS input removed from here */}
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              <Save size={16} /> Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleEnterAmountClick}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700"
            >
              Enter Amount Paid
            </button>
            <button
              onClick={() => onMarkPaid(invoiceNo)}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600"
            >
              <Check size={16} /> Mark Paid
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

PendingPaymentCard.displayName = 'PendingPaymentCard';

// PERFORMANCE: Memoized PaidPaymentRow to prevent unnecessary re-renders
const PaidPaymentRow = memo(({
  id,
  invoiceNo,
  client,
  amount,
  received,
  paymentDate,
  method,
  transactionId,
  status,
  onEdit,
  onViewHistory,
}) => {
  const numAmount = Number(amount) || 0;
  const numReceived = Number(received) || 0;
  const isPartial = status === "Partial" || (numReceived > 0 && numReceived < numAmount);

  return (
    <tr className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
      <td className="py-3 px-4 text-sm font-medium text-gray-900">{invoiceNo}</td>
      <td className="py-3 px-4 text-sm text-gray-800">{client}</td>
      <td className="py-3 px-4 text-sm font-medium">
        {isPartial ? (
          <div>
            <p className="font-semibold text-gray-900">₹{numAmount.toLocaleString('en-IN')}</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Received: ₹{numReceived.toLocaleString('en-IN')}</p>
            <p className="text-xs text-red-600 font-bold mt-0.5">Balance Due: ₹{Math.max(0, numAmount - numReceived).toLocaleString('en-IN')}</p>
            <span className="inline-block mt-1 text-[10px] font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              Partial Payment
            </span>
          </div>
        ) : (
          <p className="font-bold text-emerald-600">₹{numAmount.toLocaleString('en-IN')}</p>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-gray-600">{paymentDate || "-"}</td>
      <td className="py-3 px-4 text-sm text-gray-800">{method || "Cash"}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-mono">
        {transactionId || "-"}
      </td>
      <td className="py-3 px-4 flex items-center gap-2">
        {onViewHistory && (
          <button
            onClick={() => onViewHistory({ id, invoiceNo, amount: numAmount })}
            className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
            title="View History"
          >
            <Clock size={16} />
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit({ id, invoiceNo, client, amount: numAmount, received: numReceived, paymentDate, method, transactionId, status })}
            className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
            title="Edit Payment"
          >
            <Edit size={16} />
          </button>
        )}
      </td>
    </tr>
  );
});

PaidPaymentRow.displayName = 'PaidPaymentRow';

const PaymentsPage = () => {
  const [activeTab, setActiveTab] = useState("All Payments");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [paymentToMarkPaid, setPaymentToMarkPaid] = useState(null); // Can be string (ID) or object { id, type, amounts, currentTds }
  const [editingPayment, setEditingPayment] = useState(null);

  const [viewingHistoryFor, setViewingHistoryFor] = useState(null); // { id, invoiceNo, amount }

  // Filter States
  const currentYear = new Date().getFullYear();
  const [showFilters, setShowFilters] = useState(false);
  const [filterReportType, setFilterReportType] = useState("All Time");
  const [filterTimePeriod, setFilterTimePeriod] = useState(currentYear.toString());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [filterClientId, setFilterClientId] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const tabs = ["All Payments", "Overdue", "Pending", "Paid"];
  const filterRef = React.useRef(null); // Add Ref

  // Get authentication context
  const { user } = useContext(AuthContext);
  const { success, error: showError } = useToast();

  // Use data hooks
  const {
    allInvoices = [],
    error: invoicesError,
    editInvoice,
  } = useInvoices();

  const { payments: allPayments = [], error: paymentsError, refetch: refetchPayments } = useAllPayments();
  const { addPayment } = usePayments();
  const { customers } = useCustomers();

  // Debug logging
  useEffect(() => {
    console.log('Payment Page - allInvoices:', allInvoices?.length);
    console.log('Payment Page - allPayments:', allPayments?.length);
  }, [allInvoices, allPayments]);

  // Handle errors gracefully


  // Close filter dropdown when clicking outside
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
    setFilterReportType("All Time");
    setFilterTimePeriod(currentYear.toString());
    setFilterFromDate("");
    setFilterToDate("");
    setFilterClientId("");
    setShowFilters(false);
  };

  // Only show active filters if user changed from default (All Time) or selected a client
  const hasActiveFilters =
    (filterReportType !== "All Time") ||
    filterClientId;

  const getDynamicInvoiceStatus = useCallback((invoice) => {
    if (invoice.status === "Draft" || invoice.status === "draft") return "Draft";

    const received = Number(invoice.paidAmount || invoice.received || 0);
    const total = Number(invoice.total || invoice.amount || 0);
    const tds = Number(invoice.tdsAmount || 0);

    if (total > 0 && (received + tds >= total || Math.abs(total - (received + tds)) < 1)) {
      return "Paid";
    }

    if (invoice.status === "Paid" || invoice.status === "paid") return "Paid";

    if (received > 0 && received + tds < total) {
      return "Partial";
    }

    const today = new Date();
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    if (dueDate && !isNaN(dueDate.getTime())) {
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      if (today > dueDate) return "Overdue";
    }

    return "Unpaid";
  }, []);

  // Memoized calculation of paymentsState from invoices and payments
  const paymentsState = useMemo(() => {
    console.log('Computing paymentsState from allInvoices:', allInvoices?.length);
    return (allInvoices || []).map((inv) => {
      const invoiceNo = inv.invoiceNumber || inv.displayId || inv.id;
      const client =
        inv.client?.name ||
        inv.customerName ||
        inv.customer ||
        "Unknown Client";
      const amount = Number.parseFloat(inv.total || inv.amount || 0) || 0;

      // Calculate received amount - use paidAmount from invoice as primary source
      let received = 0;
      if (inv.paidAmount !== undefined && inv.paidAmount !== null) {
        received = Number.parseFloat(inv.paidAmount) || 0;
      } else {
        // Fallback: Calculate from payments subcollection
        const safePayments = Array.isArray(allPayments) ? allPayments : [];
        const invoicePayments = safePayments.filter(
          (payment) => payment.invoiceId === inv.id || payment.invoiceNo === invoiceNo
        );
        received = invoicePayments.reduce(
          (sum, payment) => sum + (payment.amount || 0),
          0
        );
      }

      const safePayments = Array.isArray(allPayments) ? allPayments : [];
      const invoicePayments = safePayments.filter(
        (p) => p.invoiceId === inv.id || p.invoiceNo === invoiceNo
      );
      const latestPayment = invoicePayments.length > 0 ? invoicePayments[invoicePayments.length - 1] : null;

      let pDate = inv.paymentDate || latestPayment?.paymentDate || null;
      if (!pDate && received > 0 && inv.updatedAt) {
        if (typeof inv.updatedAt === 'string') {
          pDate = inv.updatedAt;
        } else if (inv.updatedAt?.toDate) {
          pDate = inv.updatedAt.toDate().toLocaleDateString('en-GB');
        }
      }

      const paymentDate = pDate || "-";
      const method = inv.paymentMethod || latestPayment?.method || (received > 0 ? "Cash" : "-");
      const transactionId = inv.transactionId || latestPayment?.transactionId || "-";
      const tdsAmount = inv.tdsAmount || 0;
      const dueDate = inv.dueDate || "-";
      const status = getDynamicInvoiceStatus(inv);

      return {
        invoiceNo,
        client,
        amount,
        received,
        tdsAmount,
        dueDate,
        status,
        paymentDate,
        method,
        transactionId,
        id: inv.id,
        clientId: inv.clientId || inv.client?.id,
        invoiceDate: inv.invoiceDate || inv.createdAt,
      };
    });
  }, [allInvoices, allPayments, getDynamicInvoiceStatus]);

  const parseDateDDMMYYYY = (dateString) => {
    const [day, month, year] = dateString.split("/");
    return new Date(year, month - 1, day);
  };

  const getDynamicStatus = (payment) => {
    if (payment.status === "Paid") return payment;
    if (payment.status === "Partial") {
      // Check if partial payment is now overdue
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = parseDateDDMMYYYY(payment.dueDate);
      const diffTime = today - dueDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0)
        return { ...payment, status: "Overdue", overdueDays: diffDays };
      return { ...payment, overdueDays: 0 };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = parseDateDDMMYYYY(payment.dueDate);
    const diffTime = today - dueDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0)
      return { ...payment, status: "Overdue", overdueDays: diffDays };
    return { ...payment, overdueDays: 0 };
  };

  // When user clicks "Mark Paid" (Full Payment intent)
  const handleMarkAsPaid = (invoiceNo) => {
    setPaymentToMarkPaid({
      invoiceNo,
      type: 'full',
      currentTds: allInvoices.find(i => i.invoiceNumber === invoiceNo)?.tdsAmount || 0
    });
  };

  // When user enters partial amount and clicks Save (Partial Payment intent)
  const handleInitiatePartialPayment = (invoiceNo, paidAmount, tdsAmount) => {
    setPaymentToMarkPaid({
      invoiceNo,
      type: 'partial',
      amounts: {
        paid: parseFloat(paidAmount),
        tds: parseFloat(tdsAmount) || 0
      },
      // Pass current TDS to know if we should ask again
      currentTds: allInvoices.find(i => i.invoiceNumber === invoiceNo)?.tdsAmount || 0
    });
  };

  const handleViewHistory = (item) => {
    // We need to ensure we have the correct ID for the invoice to query sub-collection or filtered list
    // 'item' should have { id, invoiceNo, amount }
    setViewingHistoryFor(item);
  };

  const handleEditPayment = (payment) => setEditingPayment(payment);

  const handleSaveEditedPayment = async (updatedPayment) => {
    try {
      const today = new Date().toLocaleDateString("en-GB");

      // Find the invoice to update
      const invoiceToUpdate = allInvoices.find(
        (inv) => inv.invoiceNumber === updatedPayment.invoiceNo
      );

      if (invoiceToUpdate) {
        const invoiceAmount = Number.parseFloat(invoiceToUpdate.total || invoiceToUpdate.amount || invoiceToUpdate.totalAmount) || 0;

        // Determine paid amount based on status
        let paidAmount;
        if (updatedPayment.status === "Paid") {
          paidAmount = invoiceAmount; // Full amount if paid
        } else if (updatedPayment.status === "Partial") {
          // Keep existing paid amount or calculate based on some logic
          paidAmount = Number.parseFloat(invoiceToUpdate.paidAmount || 0) || 0;
        } else {
          paidAmount = 0; // No amount paid if unpaid
        }

        // Update invoice with new payment details
        const updateData = {
          status: updatedPayment.status,
          paidAmount: paidAmount,
          paymentMethod: updatedPayment.method,
          transactionId: updatedPayment.transactionId,
        };

        // Only set paymentDate if invoice is fully paid
        if (updatedPayment.status === "Paid") {
          updateData.paymentDate = today;
        }

        await editInvoice(invoiceToUpdate.id, updateData);

        success("Payment updated successfully!");
        setEditingPayment(null);
      }
    } catch (error) {
      showError("Error updating payment: " + error.message);
    }
  };

  // Function handles both Full and Partial Payment Confirmations
  const confirmMarkAsPaid = async (method, transactionId, tdsAmountInput = 0) => {
    try {
      const today = new Date().toLocaleDateString("en-GB");

      const targetInvoiceNo = paymentToMarkPaid?.invoiceNo || paymentToMarkPaid;
      const isPartial = paymentToMarkPaid?.type === 'partial';
      const partialAmounts = paymentToMarkPaid?.amounts || {};

      // Find the invoice to mark as paid
      const invoiceToUpdate = allInvoices.find(
        (inv) => inv.invoiceNumber === targetInvoiceNo
      );

      if (invoiceToUpdate) {
        const invoiceAmount = Number.parseFloat(invoiceToUpdate.total || invoiceToUpdate.amount || invoiceToUpdate.totalAmount) || 0;
        const currentPaid = Number.parseFloat(invoiceToUpdate.paidAmount || 0) || 0;
        const currentTds = Number.parseFloat(invoiceToUpdate.tdsAmount || 0) || 0;

        let newPaidAmount = 0;
        let newTdsAmount = 0;
        let amountToRecord = 0;
        let tdsForDisplay = 0;

        if (isPartial) {
          // Partial Payment Logic
          amountToRecord = partialAmounts.paid;

          // Use TDS input from the modal (tdsAmountInput)
          // Only add TDS if there's no existing TDS (TDS should be deducted only once per invoice)
          const enteredTds = Number.parseFloat(tdsAmountInput) || 0;
          tdsForDisplay = enteredTds;

          newPaidAmount = currentPaid + amountToRecord;
          // Only add TDS if currentTds is 0 (first time TDS is being recorded)
          newTdsAmount = currentTds === 0 ? enteredTds : currentTds;

        } else {
          // Full Payment Logic
          // Only add TDS if there's no existing TDS (TDS should be deducted only once per invoice)
          const enteredTds = Number.parseFloat(tdsAmountInput) || 0;
          tdsForDisplay = enteredTds;
          // Only add TDS if currentTds is 0 (first time TDS is being recorded)
          newTdsAmount = currentTds === 0 ? enteredTds : currentTds;

          // Calculate remaining payable
          const remainingToPay = Math.max(0, invoiceAmount - newTdsAmount - currentPaid);

          amountToRecord = remainingToPay;
          newPaidAmount = currentPaid + amountToRecord;
        }

        // Validation
        if ((newPaidAmount + newTdsAmount) > invoiceAmount + 5) {
          showError("Total Paid + TDS exceeds Invoice Amount.");
          return;
        }

        // Determine New Status
        let newStatus = "Unpaid";
        const totalCovered = newPaidAmount + newTdsAmount;
        if (Math.abs(invoiceAmount - totalCovered) < 5) {
          newStatus = "Paid";
        } else if (totalCovered > 0) {
          newStatus = "Partial";
        }

        // Update Invoice
        const updateData = {
          status: newStatus,
          paidAmount: newPaidAmount,
          tdsAmount: newTdsAmount,
          paymentMethod: method,
          paymentDate: today,
        };

        if (transactionId) updateData.transactionId = transactionId;
        if (newStatus === "Paid") updateData.paymentDate = today;

        await editInvoice(invoiceToUpdate.id, updateData);

        // Record Payment
        if (amountToRecord > 0) {
          await addPayment({
            invoiceId: invoiceToUpdate.id,
            amount: amountToRecord,
            method: method,
            transactionId: transactionId,
            paymentDate: today,
            status: "completed",
          });
        }

        const clientName = invoiceToUpdate.client?.name || invoiceToUpdate.customerName || "Client";
        success(`Payment recorded: ₹${amountToRecord.toLocaleString('en-IN')} (TDS: ₹${tdsForDisplay}) via ${method}`, "Success");

        // Refresh payments data
        refetchPayments();
      }
    } catch (error) {
      showError("Error recording payment: " + error.message);
    } finally {
      setPaymentToMarkPaid(null);
      setEditingPaymentId(null);
    }
  };

  const handleSavePayment = async (invoiceNo, paidAmountStr, tdsAmountStr) => {
    const enteredPaidAmount = Number.parseFloat(paidAmountStr);
    const enteredTdsAmount = Number.parseFloat(tdsAmountStr) || 0;

    if (Number.isNaN(enteredPaidAmount) || enteredPaidAmount <= 0) {
      // Allow 0 paid amount only if there is TDS amount? No, generally prompt for at least *some* action. 
      // But user might want to just record TDS? Let's assume paid amount can be 0 if TDS > 0, but user said "if i going to make as paid or enter the amount it needs to ask for tds amount"
      // Let's stick to positive paid amount for "Partial Payment" logic unless TDS covers the rest?
      // For simplicity/safety, require paid amount > 0 OR TDS > 0 to proceed
      if (enteredPaidAmount <= 0 && enteredTdsAmount <= 0) {
        showError("Please enter a valid paid amount or TDS amount.");
        return;
      }
    }

    // Safety check for negative input
    if (enteredPaidAmount < 0 || enteredTdsAmount < 0) {
      showError("Amounts cannot be negative.");
      return;
    }

    try {
      const today = new Date().toLocaleDateString("en-GB");

      // Find the invoice to update
      const invoiceToUpdate = allInvoices.find(
        (inv) => inv.invoiceNumber === invoiceNo
      );

      if (!invoiceToUpdate) {
        showError("Invoice not found.");
        return;
      }

      const invoiceAmount = Number.parseFloat(invoiceToUpdate.total || invoiceToUpdate.amount || invoiceToUpdate.totalAmount) || 0;
      const currentPaidAmount = Number.parseFloat(invoiceToUpdate.paidAmount || 0) || 0;
      const currentTdsAmount = Number.parseFloat(invoiceToUpdate.tdsAmount || 0) || 0;

      const newTotalPaidAmount = currentPaidAmount + enteredPaidAmount;
      // Only add TDS if currentTdsAmount is 0 (first time TDS is being recorded)
      // TDS should only be deducted once per invoice, not on every partial payment
      const newTotalTdsAmount = currentTdsAmount === 0 ? enteredTdsAmount : currentTdsAmount;

      const totalCovered = newTotalPaidAmount + newTotalTdsAmount;

      // Validation: Total Paid + Total TDS cannot exceed Invoice Total (approx, allowing for small float errors or user override if really needed?)
      // User said: "Mainly the amount should no go to minus" (Pending amount)
      if (totalCovered > invoiceAmount) {
        // Warning but maybe allow? Or block? Safe to block for now to prevent negative pending.
        showError(`Total paid + TDS (₹${totalCovered}) exceeds Invoice amount (₹${invoiceAmount}).`);
        return;
      }

      // Determine new status based on payment amount
      let newStatus;
      if (Math.abs(invoiceAmount - totalCovered) < 1) { // Floating point safety
        newStatus = "Paid"; // Fully paid
      } else if (newTotalPaidAmount > 0 || (enteredTdsAmount > 0 && totalCovered < invoiceAmount)) {
        newStatus = "Partial"; // Partially paid
      } else {
        newStatus = "Unpaid"; // Not paid (shouldn't really happen here if inputs are validated)
      }

      // Update invoice with new payment information
      const updateData = {
        paidAmount: newTotalPaidAmount,
        tdsAmount: newTotalTdsAmount,
        status: newStatus,
        paymentDate: today,
      };

      // Only set paymentDate if invoice is fully paid
      if (newStatus === "Paid") {
        updateData.paymentDate = today;
      }

      await editInvoice(invoiceToUpdate.id, updateData);

      // Create a payment record for this partial payment IF amount > 0
      if (enteredPaidAmount > 0) {
        await addPayment({
          invoiceId: invoiceToUpdate.id,
          amount: enteredPaidAmount,
          method: "Partial Payment", // We can enhance this later with a method selection
          transactionId: `PARTIAL-${Date.now()}`, // Generate a unique ID for partial payments
          paymentDate: today,
          status: "completed",
        });
      }

      const clientName = invoiceToUpdate.client?.name || invoiceToUpdate.customerName || "Client";
      success(`Partial payment recorded. Paid: ₹${enteredPaidAmount}, TDS: ₹${enteredTdsAmount}`, "Payment Recorded");
      setEditingPaymentId(null);

    } catch (error) {
      showError("Error recording payment: " + error.message);
    }
  };

  const paymentsWithDynamicStatus = useMemo(() => {
    const result = paymentsState.map(getDynamicStatus);
    console.log('paymentsWithDynamicStatus:', result?.length);
    return result;
  }, [paymentsState]);

  // PERFORMANCE: Filter and sort payments with secondary sorting for stability
  const filteredPayments = useMemo(() => {
    const filtered = paymentsWithDynamicStatus.filter((payment) => {
      // First check search term match (only filter if search term exists)
      if (searchTerm) {
        const matchesSearch =
          payment.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payment.client.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;
      }

      // Check tab-specific status requirements
      if (activeTab === "Paid" && payment.status !== "Paid" && (payment.received || 0) <= 0) return false;
      if (activeTab === "Overdue" && payment.status !== "Overdue") return false;
      if (activeTab === "Pending" && payment.status !== "Unpaid" && payment.status !== "Partial") return false;
      // "All Payments" tab doesn't filter by status

      // Filter by Client
      if (filterClientId && payment.clientId !== filterClientId) {
        return false;
      }

      // Filter by Date Range
      if (filterReportType !== "All Time") {
        let startDate, endDate;
        if (filterReportType === "Monthly Report") {
          startDate = new Date(filterYear, filterMonth, 1);
          endDate = new Date(filterYear, filterMonth + 1, 0);
        } else if (filterReportType === "Yearly Report") {
          const year = parseInt(filterTimePeriod);
          startDate = new Date(year, 3, 1); // April 1st
          endDate = new Date(year + 1, 2, 31); // March 31st
        } else if (filterReportType === "Custom Report") {
          if (filterFromDate && filterToDate) {
            startDate = new Date(filterFromDate);
            endDate = new Date(filterToDate);
          }
        }

        if (startDate && endDate) {
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);

          // Determine which date to check based on tab
          let dateToCheckStr = null;
          if (activeTab === "Paid") {
            dateToCheckStr = payment.paymentDate;
            // If we don't have paymentDate (legacy), maybe fallback to invoiceDate
            if (!dateToCheckStr) dateToCheckStr = payment.invoiceDate;
          } else if (activeTab === "Overdue" || activeTab === "Pending") {
            dateToCheckStr = payment.dueDate;
          } else {
            // All Payments - use invoiceDate as primary anchor
            dateToCheckStr = payment.invoiceDate;
          }

          if (!dateToCheckStr || dateToCheckStr === "-") return false;

          // Handle Firestore Timestamp, Date object, or date string
          let d;
          if (dateToCheckStr?.toDate && typeof dateToCheckStr.toDate === 'function') {
            // Firestore Timestamp
            d = dateToCheckStr.toDate();
          } else if (dateToCheckStr instanceof Date) {
            // Already a Date object
            d = dateToCheckStr;
          } else {
            // String - try to parse it (handles DD/MM/YYYY format)
            if (typeof dateToCheckStr === 'string' && dateToCheckStr.includes('/')) {
              // Parse DD/MM/YYYY format
              const parts = dateToCheckStr.split('/');
              if (parts.length === 3) {
                d = new Date(parts[2], parts[1] - 1, parts[0]);
              } else {
                d = new Date(dateToCheckStr);
              }
            } else {
              d = new Date(dateToCheckStr);
            }
          }

          // If invalid date, return false
          if (isNaN(d.getTime())) return false;

          // Check if date is within range
          if (d < startDate || d > endDate) return false;
        }
      }

      return true;
    });

    console.log('filteredPayments length:', filtered?.length, 'activeTab:', activeTab);

    // Sort with secondary sorting for stable ordering
    return [...filtered].sort((a, b) => {
      // Primary sort by invoice number (descending - newest first)
      // Extract numeric part from invoice number (e.g., "001/2025-26" -> 1)
      const extractInvoiceNum = (invoiceNo) => {
        const match = (invoiceNo || '').match(/(\d+)\/\d{4}-\d{2}$/);
        return match ? parseInt(match[1], 10) : 0;
      };
      
      const numA = extractInvoiceNum(a.invoiceNo);
      const numB = extractInvoiceNum(b.invoiceNo);
      const invoiceCompare = numB - numA; // Descending order (newest first)
      
      if (invoiceCompare !== 0) return invoiceCompare;

      // Secondary sort by due date for stability
      const aDate = a.dueDate || '';
      const bDate = b.dueDate || '';
      return bDate.localeCompare(aDate);
    });
  }, [paymentsWithDynamicStatus, searchTerm, activeTab, filterClientId, filterReportType, filterTimePeriod, filterMonth, filterYear, filterFromDate, filterToDate]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, filterReportType, filterTimePeriod, filterMonth, filterYear, filterFromDate, filterToDate, filterClientId]);

  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayments, currentPage, itemsPerPage]);

  const overdueCount = paymentsWithDynamicStatus.filter(
    (p) => p.status === "Overdue"
  ).length;


  const renderContent = () => {
    if (activeTab === "Overdue" || activeTab === "Pending") {
      const isOverdueTab = activeTab === "Overdue";
      return (
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="p-6">
            <h2
              className={`text-lg font-bold text-gray-900 flex items-center gap-2`}
            >
              {isOverdueTab ? (
                <AlertCircle className="text-red-500" />
              ) : (
                <Clock className="text-yellow-500" />
              )}
              {isOverdueTab ? "Overdue Payments" : "Pending Payments"}
            </h2>
            <p className="text-sm text-gray-500">
              {isOverdueTab
                ? "Invoices past due date requiring immediate attention"
                : "Invoices awaiting payment within due date"}
            </p>
          </div>
          <div className="p-6 space-y-4">
            {paginatedPayments.length > 0 ? (
              paginatedPayments.map((payment) => (
                <PendingPaymentCard
                  key={payment.invoiceNo}
                  invoice={payment}
                  onMarkPaid={handleMarkAsPaid}
                  editingPaymentId={editingPaymentId}
                  setEditingPaymentId={setEditingPaymentId}
                  onInitiatePayment={handleInitiatePartialPayment}
                  onViewHistory={handleViewHistory}
                />
              ))
            ) : (
              <div className="text-center py-16">
                <AlertCircle className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No {isOverdueTab ? "overdue" : "pending"} payments
                </h3>
                <p className="text-sm text-gray-600">
                  There are no {isOverdueTab ? "overdue" : "pending"} payments at the moment.
                </p>
              </div>
            )}
          </div>

          {
            filteredPayments.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredPayments.length / itemsPerPage)}
                totalItems={filteredPayments.length}
                startIndex={(currentPage - 1) * itemsPerPage}
                endIndex={currentPage * itemsPerPage}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            )
          }
        </div>
      );
    }

    if (activeTab === "Paid") {
      return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <div className="p-6">
            <h2 className="text-lg font-bold text-gray-900">
              Completed Payments
            </h2>
            <p className="text-sm text-gray-500">
              Successfully received payments
            </p>
          </div>
          {/* CHANGE: Added Transaction ID to the table header */}
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Payment Date</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPayments.map((payment) => (
                <PaidPaymentRow
                  key={payment.invoiceNo}
                  {...payment}
                  onEdit={handleEditPayment}
                  onViewHistory={handleViewHistory}
                />
              ))}
            </tbody>
          </table>
          {filteredPayments.length === 0 && (
            <div className="text-center py-16">
              <CheckCircle2 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No paid payments
              </h3>
              <p className="text-sm text-gray-600">
                No completed payments found in the selected period.
              </p>
            </div>
          )}

          {filteredPayments.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredPayments.length / itemsPerPage)}
              totalItems={filteredPayments.length}
              startIndex={(currentPage - 1) * itemsPerPage}
              endIndex={currentPage * itemsPerPage}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </div>
      );
    }

    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900">Payment Tracker</h2>
          <p className="text-sm text-gray-500">
            Monitor all payment statuses and due dates
          </p>
        </div>
        <table className="w-full min-w-[1000px]">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200">
            <tr>
              <th className="py-3 px-4">Invoice No</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-5">Status</th>
              <th className="py-3 px-5">Transaction History</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPayments.map((payment) => {
              const pendingBal = Math.max(0, (payment.amount || 0) - (payment.received || 0) - (payment.tdsAmount || 0));
              return (
                <PaymentRow
                  key={payment.invoiceNo}
                  {...payment}
                  amount={`₹${payment.amount.toLocaleString()}`}
                  received={
                    payment.received
                      ? `₹${payment.received.toLocaleString()}`
                      : null
                  }
                  pending={
                    payment.received && pendingBal > 0
                      ? `₹${pendingBal.toLocaleString()}`
                      : null
                  }
                  onEdit={null} // No edit action in All Payments view
                  onViewHistory={handleViewHistory}
                  id={payment.id} // Pass ID for history query
                />
              );
            })}
          </tbody>
        </table>
        {filteredPayments.length === 0 && (
          <div className="text-center py-16">
            <Search className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No payments found
            </h3>
            <p className="text-sm text-gray-600">
              {searchTerm
                ? `No payments match "${searchTerm}"`
                : `No payments found for "${activeTab}"`}
            </p>
          </div>
        )}

        {
          filteredPayments.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredPayments.length / itemsPerPage)}
              totalItems={filteredPayments.length}
              startIndex={(currentPage - 1) * itemsPerPage}
              endIndex={currentPage * itemsPerPage}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )
        }
      </div>
    );
  };

  // Show error state
  if (invoicesError || !user) {
    return (
      <div className="min-h-screen bg-gray-50 font-mazzard">
        <div className="max-w-full mx-auto px-8 pb-8 pt-32">
          <div className="text-center py-20">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load payments</h3>
            <p className="text-sm text-gray-600 mb-4">{invoicesError || "Please sign in to view payment data"}</p>
            <button
              onClick={() => globalThis.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <PaymentMethodModal
        isOpen={!!paymentToMarkPaid}
        onClose={() => setPaymentToMarkPaid(null)}
        onConfirm={confirmMarkAsPaid}
        existingTds={paymentToMarkPaid?.currentTds || 0}
      />
      <TransactionHistoryModal
        isOpen={!!viewingHistoryFor}
        onClose={() => setViewingHistoryFor(null)}
        invoiceId={viewingHistoryFor?.id}
        invoiceNo={viewingHistoryFor?.invoiceNo}
        totalAmount={viewingHistoryFor?.amount}
      />
      <EditPaymentModal
        isOpen={!!editingPayment}
        onClose={() => setEditingPayment(null)}
        onSave={handleSaveEditedPayment}
        payment={editingPayment}
      />
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="mb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Payment Management
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Track payments, manage overdue invoices, and send reminders
            </p>
          </div>

          {/* Filter Button & Dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all border shadow-xs ${hasActiveFilters || showFilters
                ? "bg-blue-50 text-blue-600 border-blue-300"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
            >
              <Filter size={16} />
              Filter
              {(hasActiveFilters) && <span className="w-2 h-2 bg-blue-600 rounded-full"></span>}
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
                  {/* Report Type Filter */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Report Type
                    </label>
                    <div className="relative">
                      <select
                        value={filterReportType}
                        onChange={(e) => setFilterReportType(e.target.value)}
                        className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                      >
                        <option>All Time</option>
                        <option>Monthly Report</option>
                        <option>Yearly Report</option>
                        <option>Custom Report</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Date Selectors based on Report Type */}
                  {filterReportType === "Monthly Report" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Month</label>
                        <div className="relative">
                          <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                          >
                            {Array.from({ length: 12 }, (_, i) => (
                              <option key={i} value={i}>
                                {new Date(0, i).toLocaleString("default", { month: "long" })}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Year</label>
                        <div className="relative">
                          <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(parseInt(e.target.value))}
                            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                          >
                            {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(
                              (year) => (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              )
                            )}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {filterReportType === "Yearly Report" && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Financial Year</label>
                      <div className="relative">
                        <select
                          value={filterTimePeriod}
                          onChange={(e) => setFilterTimePeriod(e.target.value)}
                          className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                        >
                          <option value="2024">2024-25</option>
                          <option value="2025">2025-26</option>
                          <option value="2023">2023-24</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                          <ChevronDown size={14} />
                        </div>
                      </div>
                    </div>
                  )}

                  {filterReportType === "Custom Report" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">From</label>
                        <div className="relative">
                          <input
                            type="date"
                            max="9999-12-31"
                            value={filterFromDate}
                            onChange={(e) => setFilterFromDate(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">To</label>
                        <div className="relative">
                          <input
                            type="date"
                            max="9999-12-31"
                            value={filterToDate}
                            onChange={(e) => setFilterToDate(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Client Filter */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Client
                    </label>
                    <select
                      value={filterClientId}
                      onChange={(e) => setFilterClientId(e.target.value)}
                      className="w-full text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="">All Clients</option>
                      {(customers || []).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => setShowFilters(false)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
        <main className="mt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {(() => {
              // Calculate statistics from ALL payments, not just filtered ones
              const totalAmount = paymentsWithDynamicStatus.reduce(
                (s, p) => s + (p.amount || 0),
                0
              );
              const amountReceived = paymentsWithDynamicStatus.reduce(
                (s, p) => s + (p.received || 0),
                0
              );
              // Overdue Amount = sum of remaining amounts for overdue invoices
              const overdueAmount = paymentsWithDynamicStatus
                .filter((p) => p.status === "Overdue")
                .reduce((s, p) => {
                  const remaining = Math.max(0, (p.amount || 0) - (p.received || 0) - (p.tdsAmount || 0));
                  return s + remaining;
                }, 0);
              // Pending Amount = sum of remaining amounts for all non-paid invoices (Unpaid, Partial, Overdue)
              const pendingAmount = paymentsWithDynamicStatus
                .filter((p) => p.status === "Unpaid" || p.status === "Partial" || p.status === "Overdue")
                .reduce((s, p) => {
                  const remaining = Math.max(0, (p.amount || 0) - (p.received || 0) - (p.tdsAmount || 0));
                  return s + remaining;
                }, 0);
              return (
                <>
                  <StatCard
                    title="Total Amount"
                    amount={`₹${totalAmount.toLocaleString()}`}
                    subtitle={<Tooltip text="The sum of all invoice amounts for every bill you have created. This is the total value billed to clients.">All invoices</Tooltip>}
                    icon={IndianRupee}
                    iconBgColor="bg-blue-500"
                  />
                  <StatCard
                    title="Amount Received"
                    amount={`₹${amountReceived.toLocaleString()}`}
                    subtitle={<Tooltip text="The sum of all payments actually received from clients. This shows how much money has come in.">{totalAmount > 0
                      ? Math.round((amountReceived / totalAmount) * 100)
                      : 0
                      }% of total</Tooltip>}
                    icon={CheckCircle2}
                    iconBgColor="bg-green-500"
                  />
                  <StatCard
                    title="Overdue Amount"
                    amount={`₹${overdueAmount.toLocaleString()}`}
                    subtitle={<Tooltip text="The total unpaid amount for invoices that are past their due date. These bills need urgent attention.">Needs attention</Tooltip>}
                    icon={AlertCircle}
                    iconBgColor="bg-red-500"
                  />
                  <StatCard
                    title="Pending Amount"
                    amount={`₹${pendingAmount.toLocaleString()}`}
                    subtitle={<Tooltip text="The total unpaid amount for all invoices that are not fully paid (includes Unpaid, Partial, and Overdue). This is the money you are still waiting to receive.">Awaiting payment</Tooltip>}
                    icon={Clock}
                    iconBgColor="bg-yellow-500"
                  />
                </>
              );
            })()}
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <div className="relative w-full md:w-96">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                size={16}
              />
              <input
                type="text"
                placeholder="Search by invoice number or client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto overflow-hidden">
              <div className="bg-white border border-slate-300 rounded-xl p-1 flex items-center space-x-1 w-full md:w-auto overflow-x-auto shadow-xs">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
                      }`}
                  >
                    {tab}
                    {tab === "Overdue" && overdueCount > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                        {overdueCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

// Tooltip component for hover info
function Tooltip({ text, children }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      <span style={{
        visibility: 'hidden',
        background: '#222',
        color: '#fff',
        textAlign: 'left',
        borderRadius: '4px',
        padding: '6px 10px',
        position: 'absolute',
        zIndex: 10,
        bottom: '125%',
        left: '50%',
        transform: 'translateX(-50%)',
        whiteSpace: 'pre-line',
        fontSize: '13px',
        minWidth: '180px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        opacity: 0,
        transition: 'opacity 0.2s',
      }} className="card-tooltip">
        {text}
      </span>
      <span
        style={{
          marginLeft: 6,
          color: '#2563eb',
          fontWeight: 'bold',
          cursor: 'pointer',
          fontSize: '16px',
          verticalAlign: 'middle',
        }}
        onMouseEnter={e => {
          const tip = e.target.previousSibling;
          tip.style.visibility = 'visible';
          tip.style.opacity = 1;
        }}
        onMouseLeave={e => {
          const tip = e.target.previousSibling;
          tip.style.visibility = 'hidden';
          tip.style.opacity = 0;
        }}
      >ⓘ</span>
    </span>
  );
}
PaymentMethodModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

EditPaymentModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  payment: PropTypes.shape({
    method: PropTypes.string,
    status: PropTypes.string,
    transactionId: PropTypes.string,
    invoiceNo: PropTypes.string,
  }),
};

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  subtitle: PropTypes.string,
  icon: PropTypes.elementType.isRequired, // For components like Icons
  iconBgColor: PropTypes.string,
};

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  overdueDays: PropTypes.number,
};

PaymentRow.propTypes = {
  invoiceNo: PropTypes.string.isRequired,
  client: PropTypes.string.isRequired,
  amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  received: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  dueDate: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
  overdueDays: PropTypes.number,
  onEdit: PropTypes.func,
};

PendingPaymentCard.propTypes = {
  invoice: PropTypes.shape({
    invoiceNo: PropTypes.string.isRequired,
    client: PropTypes.string.isRequired,
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    received: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    dueDate: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
  }).isRequired,
  onMarkPaid: PropTypes.func.isRequired,
  editingPaymentId: PropTypes.string,
  setEditingPaymentId: PropTypes.func.isRequired,
  onInitiatePayment: PropTypes.func.isRequired,
};

PaidPaymentRow.propTypes = {
  id: PropTypes.string,
  invoiceNo: PropTypes.string.isRequired,
  client: PropTypes.string.isRequired,
  amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  received: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  paymentDate: PropTypes.string,
  method: PropTypes.string,
  transactionId: PropTypes.string,
  status: PropTypes.string,
  onEdit: PropTypes.func.isRequired,
  onViewHistory: PropTypes.func,
};

export default PaymentsPage;
