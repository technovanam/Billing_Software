import React, { useState, useRef, useEffect, useContext, useMemo, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Eye,
  Edit,
  X,
  FileText,
  Phone,
  Mail,
  TrendingUp,
  AlertCircle,
  MapPin,
  User,
} from "lucide-react";
import Pagination from "../../components/Pagination";
import { AuthContext } from "../../context/AuthContext";
import { useCustomers, useInvoices } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";
import PropTypes from "prop-types";
const ClientManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(null);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isCustomerCreatePage = location.pathname === "/customers/new";

  useEffect(() => {
    if (location.pathname === "/customers/new") {
      setShowAddModal(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!showAddModal || isCustomerCreatePage) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showAddModal, isCustomerCreatePage]);

  // Get authentication context
  // Get authentication context
	// ...existing code...
  const { success, error: showError, warning } = useToast();

  // Use data hooks
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Use data hooks
  const { customers, loading, error, pagination, addCustomer, editCustomer, removeCustomer } =
    useCustomers({
      search: searchTerm,
      page: currentPage,
      limit: itemsPerPage,
      sortBy: 'serialNumber', // Sort by serial number, not name
      sortDirection: 'asc'
    });

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Fetch all invoices for calculating client statistics
  const { allInvoices } = useInvoices();



  // Memoized calculation of all client statistics to avoid re-calculation on every render
  const clientStatsMap = useMemo(() => {
    if (!allInvoices || allInvoices.length === 0) return {};

    const stats = {};
    const today = new Date();
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(today.getMonth() - 3); // Get start of 4 months window

    allInvoices.forEach(invoice => {
      // Handle both customerId and clientId
      const clientId = invoice.customerId || invoice.clientId;
      if (!clientId) return;

      if (!stats[clientId]) {
        stats[clientId] = {
          totalInvoices: 0,
          totalRevenue: 0,
          outstanding: 0,
          amountPaid: 0,
          invoicesCount: 0,
          paidInvoicesCount: 0,
          totalInvoicesValue: 0,
          dates: [],
          monthlyRevenue: {} // Key: "Mon YY", Value: Amount
        };
      }

      const invoiceAmount = Number.parseFloat(invoice.totalAmount || invoice.amount || invoice.total) || 0;
      const paidAmount = Number.parseFloat(invoice.paidAmount || 0) || 0;
      const amountReceived = Number.parseFloat(invoice.received || 0) || 0;
      // Prefer paidAmount, fallback to received if paidAmount is 0/missing and status implies paid
      const effectivePaid = paidAmount > 0 ? paidAmount : amountReceived;

      const isPaidByStatus = invoice.status === 'Paid' || invoice.status === 'paid';

      stats[clientId].totalInvoices += 1;
      stats[clientId].totalInvoicesValue += invoiceAmount;

      // Track dates
      if (invoice.invoiceDate || invoice.date) {
        stats[clientId].dates.push(new Date(invoice.invoiceDate || invoice.date));
      }

      // Track Monthly Revenue (based on paid amounts)
      if (invoice.invoiceDate || invoice.date) {
        const d = new Date(invoice.invoiceDate || invoice.date);
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' }); // e.g., "Dec 24"
        if (!stats[clientId].monthlyRevenue[key]) stats[clientId].monthlyRevenue[key] = 0;
        stats[clientId].monthlyRevenue[key] += effectivePaid;
      }

      // Total Revenue = All amounts that have been paid (regardless of status)
      // Outstanding = Invoice total minus what has been paid
      const unpaidAmount = Math.max(0, invoiceAmount - effectivePaid);
      
      stats[clientId].totalRevenue += effectivePaid;
      stats[clientId].amountPaid += effectivePaid;
      stats[clientId].outstanding += unpaidAmount;

      // Count as paid if status is Paid OR if fully paid
      if (isPaidByStatus || effectivePaid >= invoiceAmount - 1) {
        stats[clientId].paidInvoicesCount += 1;
      }
    });

    // Finalize stats (averages, min/max dates, revenue array)
    Object.keys(stats).forEach(clientId => {
      const s = stats[clientId];

      // Avg Invoice
      s.avgInvoice = s.totalInvoices > 0 ? Math.round(s.totalInvoicesValue / s.totalInvoices) : 0;

      // Payment Rate
      s.paymentRate = s.totalInvoices > 0 ? ((s.paidInvoicesCount / s.totalInvoices) * 100).toFixed(1) + '%' : '0%';

      // Dates
      if (s.dates.length > 0) {
        const sortedDates = s.dates.sort((a, b) => a - b);
        s.firstInvoice = sortedDates[0].toLocaleDateString('en-GB');
        s.lastInvoice = sortedDates[sortedDates.length - 1].toLocaleDateString('en-GB');
      } else {
        s.firstInvoice = '-';
        s.lastInvoice = '-';
      }

      // Revenue Data (last 4 months)
      // Hardcode months or dynamic? Dynamic last 4 months
      const revenueData = [];
      for (let i = 3; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        revenueData.push({
          month: key,
          label: key,
          value: s.monthlyRevenue[key] || 0
        });
      }
      s.revenueData = revenueData;
    });

    return stats;
  }, [allInvoices]);


  // Helper to safely get stats for a client
  const getClientStats = (clientId) => {
    return clientStatsMap[clientId] || {
      totalInvoices: 0,
      totalRevenue: 0,
      outstanding: 0,
      amountPaid: 0,
      firstInvoice: '-',
      lastInvoice: '-',
      avgInvoice: 0,
      paymentRate: '0%',
      revenueData: []
    };
  };




  const [formData, setFormData] = useState({
    customerType: "Business",
    salutation: "",
    firstName: "",
    lastName: "",
    companyName: "",
    displayName: "",
    gstin: "",
    phone: "",
    mobile: "",
    email: "",
    address: "",
    customerLanguage: "English",
    notes: "",
  });

  const [editFormData, setEditFormData] = useState({
    name: "",
    gstin: "",
    phone: "",
    email: "",
    address: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddClient = async () => {
    const customerName =
      formData.displayName?.trim() ||
      [formData.firstName, formData.lastName].filter(Boolean).join(" ") ||
      formData.name ||
      "";

    if (!customerName || !formData.email) {
      showError("Please fill in required fields (Display Name and Email)");
      return;
    }

    const clientName = customerName;
    const clientEmail = formData.email;
    const clientPhone = formData.phone || formData.mobile || "";
    const clientAddress = formData.address;
    const clientGstin = formData.gstin;

    setFormData({
      customerType: "Business",
      salutation: "",
      firstName: "",
      lastName: "",
      companyName: "",
      displayName: "",
      gstin: "",
      phone: "",
      mobile: "",
      email: "",
      address: "",
      customerLanguage: "English",
      notes: "",
    });
    setShowAddModal(false);
    if (location.pathname === "/customers/new") {
      navigate("/clients", { replace: true });
    }

    success(`Customer "${clientName}" added successfully!`, "Added");

    const result = await addCustomer({
      name: clientName,
      email: clientEmail,
      phone: clientPhone,
      address: clientAddress,
      company: formData.companyName || clientGstin,
      taxId: clientGstin,
      customerType: formData.customerType,
      salutation: formData.salutation,
      firstName: formData.firstName,
      lastName: formData.lastName,
      displayName: formData.displayName,
      mobile: formData.mobile,
      customerLanguage: formData.customerLanguage,
      notes: formData.notes,
    });

    if (!result.success) {
      showError(`Failed to add customer: ${result.error}`, "Error");
    }
  };

  const handleCancel = () => {
    setFormData({
      customerType: "Business",
      salutation: "",
      firstName: "",
      lastName: "",
      companyName: "",
      displayName: "",
      gstin: "",
      phone: "",
      mobile: "",
      email: "",
      address: "",
      customerLanguage: "English",
      notes: "",
    });
    setShowAddModal(false);
    if (location.pathname === "/customers/new") {
      navigate("/clients");
    }
  };

  const handleViewClient = (client) => {
    const stats = getClientStats(client.id);
    setSelectedClient({ ...client, ...stats });
    setShowDetailsModal(true);
  };

  const handleCloseDetails = () => {
    setSelectedClient(null);
    setShowDetailsModal(false);
  };

  const handleEditClient = (client) => {
    setSelectedClient(client);
    setEditFormData({
      name: client.name,
      gstin: client.taxId || client.company || "",
      phone: client.phone,
      email: client.email,
      address: client.address,
    });
    setShowEditModal(true);
    setDropdownOpen(null);
  };

  const handleUpdateClient = async () => {
    if (editFormData.name && editFormData.email && selectedClient) {
      // Save form data to variables BEFORE clearing
      const clientName = editFormData.name;
      const clientEmail = editFormData.email;
      const clientPhone = editFormData.phone;
      const clientAddress = editFormData.address;
      const clientGstin = editFormData.gstin;

      // Optimistic UI: Close modal and show notification immediately
      setShowEditModal(false);
      setSelectedClient(null);
      setEditFormData({
        name: "",
        gstin: "",
        phone: "",
        email: "",
        address: "",
      });

      // Update = Yellow (Warning style)
      warning(`Client "${clientName}" updated successfully!`, "Updated");

      const result = await editCustomer(selectedClient.id, {
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        address: clientAddress,
        company: clientGstin,
        taxId: clientGstin,
      });

      // Handle failure
      if (!result.success) {
        showError(`Failed to update client: ${result.error}`, "Error");
      }
    } else {
      showError("Please fill in required fields (Name and Email)");
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setSelectedClient(null);
    setEditFormData({ name: "", gstin: "", phone: "", email: "", address: "" });
  };

  // const toggleDropdown = (clientId) => {
  //   setDropdownOpen(dropdownOpen === clientId ? null : clientId);
  // };


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);





  const renderTableBody = () => {
    if (loading) {
      return Array.from({ length: 5 }).map((_, i) => (
        <tr key={`skeleton-${i}`} className="animate-pulse">
          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
          <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
        </tr>
      ));
    }

    if (error) {
      return (
        <tr>
          <td colSpan="8" className="px-4 py-8 text-center">
            <div className="text-red-600">
              <p>Error loading clients: {error}</p>
              <button
                onClick={() => globalThis.location.reload()}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </td>
        </tr>
      );
    }

    if (customers && customers.length > 0) {
      return customers.map((client, index) => {
        const stats = getClientStats(client.id);
        // Use the permanent serialNumber from the client data
        const serialNumber = client.serialNumber || String(index + 1).padStart(2, '0');

        return (
          <ClientRow
            key={client.id}
            client={client}
            stats={stats}
            serialNumber={serialNumber}
            onView={handleViewClient}
            onEdit={handleEditClient}
          />
        );
      });
    }

    return (
      <tr>
        <td
          colSpan="8"
          className="px-4 py-8 text-center text-gray-500"
        >
          No clients found.{" "}
          {searchTerm && "Try adjusting your search criteria."}
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              Customer Management
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage your customer relationships and track business performance
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto mt-4 lg:mt-0">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-80 bg-gray-100 rounded-lg pl-9 pr-4 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => navigate("/customers/new")}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Add Customer
            </button>
          </div>
        </header>

        <main className={`${isCustomerCreatePage ? "hidden" : "mt-6 flex flex-col gap-6"}`}>
          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full min-w-[800px]">
              <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left">S.No</th>
                  <th scope="col" className="px-6 py-3 text-left">Client Name</th>
                  <th scope="col" className="px-6 py-3 text-left">GST Number</th>
                  <th scope="col" className="px-6 py-3 text-left">Phone Number</th>
                  <th scope="col" className="px-6 py-3 text-left">Total Invoices</th>
                  <th scope="col" className="px-6 py-3 text-left">Total Revenue</th>
                  <th scope="col" className="px-6 py-3 text-left">Outstanding</th>
                  <th scope="col" className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {renderTableBody()}
              </tbody>
            </table>
          </div>
          {pagination && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={pagination.total}
              startIndex={(pagination.page - 1) * pagination.limit}
              endIndex={pagination.page * pagination.limit}
            />
          )}
        </main>
      </div>

      {/* --- MODALS --- */}

      {showAddModal && isCustomerCreatePage && (
        <div className={isCustomerCreatePage ? "mt-6 w-full" : "fixed inset-0 bg-black bg-opacity-50 modal-backdrop flex items-start justify-center z-50 overflow-hidden p-4 sm:p-6"}>
          <div
            onWheel={(event) => event.stopPropagation()}
            className={isCustomerCreatePage ? "bg-white rounded-lg border border-gray-200 shadow-sm w-full max-w-6xl mx-auto relative" : "bg-white rounded-lg shadow-xl w-full max-w-xl mx-auto relative h-auto max-h-[90vh] overflow-y-auto overscroll-contain"}
          >
            <button
              onClick={handleCancel}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              title="Close"
            >
              <X size={18} />
            </button>
            <div className="p-5 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Add New Customer
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">Customer Type</label>
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="customerType"
                        value="Business"
                        checked={formData.customerType === "Business"}
                        onChange={handleInputChange}
                      />
                      Business
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="customerType"
                        value="Individual"
                        checked={formData.customerType === "Individual"}
                        onChange={handleInputChange}
                      />
                      Individual
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Salutation</label>
                    <select
                      name="salutation"
                      value={formData.salutation}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select</option>
                      <option value="Mr.">Mr.</option>
                      <option value="Mrs.">Mrs.</option>
                      <option value="Ms.">Ms.</option>
                      <option value="Dr.">Dr.</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Display Name *</label>
                  <input
                    type="text"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleInputChange}
                    placeholder="Select or type to add"
                    className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Phone</label>
                    <div className="flex gap-2">
                      <select
                        name="phoneCode"
                        value={formData.phoneCode || "+91"}
                        onChange={handleInputChange}
                        className="w-24 px-2 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="+91">+91</option>
                        <option value="+1">+1</option>
                        <option value="+44">+44</option>
                      </select>
                      <input
                        type="text"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="flex-1 px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Mobile</label>
                    <input
                      type="text"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Customer Language</label>
                  <select
                    name="customerLanguage"
                    value={formData.customerLanguage}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Marathi">Marathi</option>
                    <option value="Gujarati">Gujarati</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    name="gstin"
                    value={formData.gstin}
                    onChange={handleInputChange}
                    placeholder="e.g., 27ABCDE1234F1Z5"
                    className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Enter full address"
                    className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Remarks</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-900 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddClient}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Add Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto relative">
            <button
              onClick={handleCancelEdit}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              title="Close"
            >
              <X size={18} />
            </button>
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Edit Client
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditInputChange}
                      className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      GSTIN *
                    </label>
                    <input
                      type="text"
                      name="gstin"
                      value={editFormData.gstin}
                      onChange={handleEditInputChange}
                      className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Contact
                    </label>
                    <input
                      type="text"
                      name="phone"
                      value={editFormData.phone}
                      onChange={handleEditInputChange}
                      className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      E-mail
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={editFormData.email}
                      onChange={handleEditInputChange}
                      className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Address *
                  </label>
                  <textarea
                    name="address"
                    value={editFormData.address}
                    onChange={handleEditInputChange}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-900 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateClient}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Update Client
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client Details Modal */}
      {showDetailsModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-auto relative overflow-hidden my-8">
            <div className="bg-blue-50 px-6 py-4 flex items-center gap-3 relative">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText size={16} className="text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {selectedClient.name}
              </h2>
              <button
                onClick={handleCloseDetails}
                className="absolute top-3 right-3 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
                title="Close"
              >
                <X size={16} className="text-gray-600" />
              </button>
            </div>
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Statistics Cards */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-2xl font-bold text-gray-900">
                          {getClientStats(selectedClient.id).totalInvoices}
                        </div>
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText size={16} className="text-blue-600" />
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">Total Invoices</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-2xl font-bold text-gray-900">
                          ₹{getClientStats(selectedClient.id).totalRevenue.toLocaleString('en-IN')}
                        </div>
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <span className="text-green-600 font-bold text-lg">
                            ₹
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">Total Revenue</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-2xl font-bold text-gray-900">
                          <span className={getClientStats(selectedClient.id).outstanding > 0 ? "text-red-600" : "text-green-600"}>
                            ₹{getClientStats(selectedClient.id).outstanding.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                          <span className="text-red-600 font-bold text-lg">₹</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">Outstanding</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-2xl font-bold text-gray-900">
                          ₹{getClientStats(selectedClient.id).amountPaid.toLocaleString('en-IN')}
                        </div>
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <TrendingUp size={16} className="text-green-600" />
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">Amount Paid</div>
                    </div>
                  </div>
                </div>
                {/* Right Column - Contact Info and Business Statistics */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3">
                      Contact Information
                    </h3>
                    <div className="space-y-3 text-sm text-gray-700">
                      <div className="flex items-center gap-3">
                        <User
                          size={16}
                          className="text-gray-400 flex-shrink-0"
                        />
                        <span className="font-medium">{selectedClient.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <FileText
                          size={16}
                          className="text-gray-400 flex-shrink-0"
                        />
                        <span>
                          GSTIN: {selectedClient.taxId || selectedClient.company || selectedClient.gstin || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone size={16} className="text-gray-400 flex-shrink-0" />
                        <span>{selectedClient.phone}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail size={16} className="text-gray-400 flex-shrink-0" />
                        <span>{selectedClient.email}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin
                          size={16}
                          className="text-gray-400 flex-shrink-0 mt-0.5"
                        />
                        <span>{selectedClient.address}</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>


            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ClientRow = memo(({
  client,
  stats,
  serialNumber,
  onView,
  onEdit
}) => {
  return (
    <tr
      key={client.id}
      className="text-sm transition-colors hover:bg-gray-50"
    >
      <td className="px-6 py-4 font-medium text-gray-900">
        {serialNumber}
      </td>
      <td className="px-6 py-4">
        <div className="font-medium text-gray-900">
          {client.name}
        </div>
        <div className="text-gray-500 text-xs">
          {client.email}
        </div>
      </td>
      <td className="px-6 py-4 text-gray-700">
        {client.taxId || client.company || "-"}
      </td>
      <td className="px-6 py-4 text-gray-700">
        {client.phone || "-"}
      </td>
      <td className="px-6 py-4 text-gray-700">
        {stats.totalInvoices}
      </td>
      <td className="px-6 py-4 font-medium text-gray-900">
        ₹{stats.totalRevenue.toLocaleString('en-IN')}
      </td>
      <td className="px-6 py-4 text-gray-700">
        <span className={stats.outstanding > 0 ? "text-red-600 font-medium" : "text-green-600"}>
          ₹{stats.outstanding.toLocaleString('en-IN')}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onView(client)}
            className="p-1 text-gray-600 transition-colors hover:text-blue-600"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(client)}
            className="p-1 text-gray-600 transition-colors hover:text-green-600"
            title="Edit Client"
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});

ClientRow.displayName = 'ClientRow';

ClientRow.propTypes = {
  client: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    email: PropTypes.string,
    taxId: PropTypes.string,
    company: PropTypes.string,
    phone: PropTypes.string,
  }).isRequired,
  stats: PropTypes.shape({
    totalInvoices: PropTypes.number,
    totalRevenue: PropTypes.number,
    outstanding: PropTypes.number,
  }).isRequired,
  serialNumber: PropTypes.string.isRequired,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
};

export default ClientManagement;
