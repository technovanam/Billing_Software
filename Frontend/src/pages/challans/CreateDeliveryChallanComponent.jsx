import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Eye, Save, ArrowLeft, FileText, Settings, X } from "lucide-react";
import PropTypes from "prop-types";

const ChallanPreferencesModal = ({
  isOpen,
  onClose,
  onSave,
  initialPreferences = { mode: "auto", prefix: "DC-", nextNumber: "00001" },
}) => {
  const [mode, setMode] = useState(initialPreferences.mode || "auto");
  const [prefix, setPrefix] = useState(initialPreferences.prefix || "DC-");
  const [nextNumber, setNextNumber] = useState(
    initialPreferences.nextNumber || "00001"
  );

  useEffect(() => {
    if (initialPreferences) {
      setMode(initialPreferences.mode || "auto");
      setPrefix(initialPreferences.prefix || "DC-");
      setNextNumber(initialPreferences.nextNumber || "00001");
    }
  }, [initialPreferences, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ mode, prefix, nextNumber });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">
            Configure Delivery Challan# Preferences
          </h3>
          <button
            onClick={onClose}
            className="text-red-500 hover:text-red-700 text-xl font-bold leading-none p-1"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-sm text-gray-700">
          <p className="text-xs text-gray-600 leading-relaxed">
            Your delivery challan numbers are set on auto-generate mode to save
            your time. Are you sure about changing this setting?
          </p>

          <div className="space-y-4 pt-1">
            {/* Option 1 */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="challanNumMode"
                  value="auto"
                  checked={mode === "auto"}
                  onChange={() => setMode("auto")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-gray-900 flex items-center gap-1">
                  Continue auto-generating delivery challan numbers
                  <span className="text-gray-400 text-xs inline-block ml-0.5" title="Auto increment number">ⓘ</span>
                </span>
              </label>

              {mode === "auto" && (
                <div className="pl-6 flex items-center gap-4">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">
                      Prefix
                    </label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      placeholder="DC-"
                      className="w-28 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">
                      Next Number
                    </label>
                    <input
                      type="text"
                      value={nextNumber}
                      onChange={(e) => setNextNumber(e.target.value)}
                      placeholder="00001"
                      className="w-44 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Option 2 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="challanNumMode"
                value="manual"
                checked={mode === "manual"}
                onChange={() => setMode("manual")}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-800">
                Enter delivery challan numbers manually
              </span>
            </label>
          </div>
        </div>

        {/* Modal Footer (Left-aligned Save & Cancel buttons) */}
        <div className="flex items-center justify-start gap-2.5 px-6 py-4 border-t border-gray-100 bg-white">
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors shadow-sm"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 transition-colors shadow-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const ClientAutocomplete = ({ clients, selectedClient, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (selectedClient) {
      setSearchTerm(selectedClient.name);
    } else {
      setSearchTerm("");
    }
  }, [selectedClient]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsFocused(false);
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value) {
      const filteredSuggestions = clients.filter((client) =>
        client.name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
      onSelect(null);
    }
  };

  const handleSelectSuggestion = (client) => {
    onSelect(client.id);
    setSearchTerm(client.name);
    setSuggestions([]);
    setIsFocused(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label htmlFor="client-search" className="block text-sm font-medium text-gray-700 mb-1">
        Customer Name<span className="text-red-500">*</span>
      </label>
      <input
        id="client-search"
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setIsFocused(true)}
        placeholder="Select or add a customer..."
        className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
      />
      {isFocused && searchTerm && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.length > 0 ? (
            suggestions.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(client)}
                  className="w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                >
                  {client.name}
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-2 text-sm text-gray-500">No customer found</li>
          )}
        </ul>
      )}
    </div>
  );
};

ClientAutocomplete.propTypes = {
  clients: PropTypes.array.isRequired,
  selectedClient: PropTypes.object,
  onSelect: PropTypes.func.isRequired,
};

const ProductAutocomplete = ({
  products,
  value,
  onSelect,
  onChange,
  onAddNewProduct,
  clientId,
}) => {
  const [searchTerm, setSearchTerm] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  const updateDropdownPosition = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: `${rect.bottom}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      });
    }
  };

  useEffect(() => {
    if (isFocused) {
      updateDropdownPosition();
      window.addEventListener("scroll", updateDropdownPosition, true);
      window.addEventListener("resize", updateDropdownPosition);
    }
    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
    };
  }, [isFocused]);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(event.target))
      ) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleInputChange = (e) => {
    const inputValue = e.target.value;
    setSearchTerm(inputValue);
    onChange(inputValue);

    if (inputValue) {
      const filteredSuggestions = products.filter((product) =>
        product.name.toLowerCase().includes(inputValue.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
    }
  };

  const handleAddNewProduct = () => {
    if (onAddNewProduct && searchTerm.trim()) {
      onAddNewProduct(searchTerm.trim(), clientId);
      setSearchTerm("");
      setSuggestions([]);
      setIsFocused(false);
    }
  };

  const handleSelectSuggestion = (product) => {
    onSelect(product);
    setSearchTerm(product.name);
    setSuggestions([]);
    setIsFocused(false);
  };

  const Dropdown = () => {
    const exactMatch = products.find(
      (p) => p.name.toLowerCase() === searchTerm.toLowerCase()
    );
    const showAddOption = searchTerm.trim() && !exactMatch && onAddNewProduct;

    return (
      <ul
        ref={dropdownRef}
        style={{ ...dropdownStyle, position: "fixed" }}
        className="z-50 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
      >
        {suggestions.length > 0 ? (
          suggestions.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => handleSelectSuggestion(product)}
                className="w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                {product.name} - ₹{product.price}
              </button>
            </li>
          ))
        ) : (
          !showAddOption && (
            <li className="px-4 py-2 text-sm text-gray-500">
              No item found
            </li>
          )
        )}
        {showAddOption && (
          <li>
            <button
              type="button"
              onClick={handleAddNewProduct}
              className="w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-blue-100 border-t border-gray-200 text-blue-600 font-medium focus:outline-none focus:bg-blue-100"
            >
              + Add "{searchTerm}" as new product
            </button>
          </li>
        )}
      </ul>
    );
  };

  return (
    <div ref={wrapperRef}>
      <input
        type="text"
        placeholder="Type or click to select an item..."
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setIsFocused(true)}
        className="w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-0 focus:bg-white border border-transparent focus:border-blue-500"
      />
      {isFocused &&
        searchTerm &&
        createPortal(<Dropdown />, document.body)}
    </div>
  );
};

ProductAutocomplete.propTypes = {
  products: PropTypes.array.isRequired,
  value: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onAddNewProduct: PropTypes.func,
  clientId: PropTypes.string,
};

export default function CreateDeliveryChallanComponent({
  challanData,
  setChallanData,
  saveDraft,
  handlePreview,
  saveChallan,
  clients = [],
  products = [],
  calculations = { subtotal: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, roundOffAmount: 0, total: 0 },
  addItem,
  updateItem,
  removeItem,
  handleClientSelect,
  handleAddNewProduct,
  onCancel,
  isEditMode = false,
}) {
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [preferences, setPreferences] = useState({
    mode: "auto",
    prefix: "DC-",
    nextNumber: "00001",
  });

  const handleSavePreferences = (newPrefs) => {
    setPreferences(newPrefs);
    if (newPrefs.mode === "auto") {
      const generated = `${newPrefs.prefix}${newPrefs.nextNumber}`;
      setChallanData((prev) => ({
        ...prev,
        challanNumber: generated,
        dcNumber: generated,
      }));
    }
  };

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        {/* Header matching Create Invoice exactly */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <button
              type="button"
              onClick={onCancel}
              className="mr-4 p-2 text-gray-600 hover:bg-gray-200/60 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditMode ? "Edit Delivery Challan" : "Create Delivery Challan"}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {isEditMode
                  ? "Update details for an existing delivery challan"
                  : "Create a new delivery challan for your customer"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 text-sm font-medium">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveDraft}
              className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </button>
            <button
              type="button"
              onClick={handlePreview}
              className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </button>
            <button
              type="button"
              onClick={saveChallan}
              className="flex items-center px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm"
            >
              <FileText className="w-4 h-4 mr-2" />
              {isEditMode ? "Update Delivery Challan" : "Save Delivery Challan"}
            </button>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Left Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Challan Header Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Delivery Challan Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ClientAutocomplete
                clients={clients}
                selectedClient={challanData.client}
                onSelect={handleClientSelect}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Challan#<span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={challanData.challanNumber || challanData.dcNumber || ""}
                    onChange={(e) => setChallanData((prev) => ({ ...prev, challanNumber: e.target.value, dcNumber: e.target.value }))}
                    placeholder="DC-00001"
                    disabled={preferences.mode === "auto"}
                    className="w-full pr-10 px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:bg-gray-100 disabled:text-gray-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPreferencesModal(true)}
                    className="absolute right-2 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Configure Delivery Challan# Preferences"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference#
                </label>
                <input
                  type="text"
                  value={challanData.referenceNumber || challanData.poNumber || ""}
                  onChange={(e) => setChallanData((prev) => ({ ...prev, referenceNumber: e.target.value, poNumber: e.target.value }))}
                  placeholder="Enter Ref/PO number"
                  className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Challan Date<span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={challanData.challanDate || ""}
                  onChange={(e) => setChallanData((prev) => ({ ...prev, challanDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Challan Type
                </label>
                <select
                  value={challanData.challanType || "Others"}
                  onChange={(e) => setChallanData((prev) => ({ ...prev, challanType: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="Supply on Approval">Supply on Approval</option>
                  <option value="Job Work">Job Work</option>
                  <option value="Supply for Exhibition">Supply for Exhibition</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  value={challanData.vehicleNumber || ""}
                  onChange={(e) => setChallanData((prev) => ({ ...prev, vehicleNumber: e.target.value }))}
                  placeholder="e.g., TN 37 AB 1234"
                  className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Items & Services Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">
                Items & Services <span className="text-red-500">*</span>
              </h2>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>

            {/* Item Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                    <th className="py-2.5 px-2 w-12 text-center">S.NO</th>
                    <th className="py-2.5 px-3">DESCRIPTION</th>
                    <th className="py-2.5 px-3 w-28 text-center">HSN</th>
                    <th className="py-2.5 px-3 w-20 text-center">QTY</th>
                    <th className="py-2.5 px-3 w-28 text-right">RATE (₹)</th>
                    <th className="py-2.5 px-3 w-32 text-right">AMOUNT (₹)</th>
                    <th className="py-2.5 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {challanData.items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="py-2 px-2 text-center text-gray-500 font-medium">
                        {index + 1}
                      </td>
                      <td className="py-2 px-3">
                        <ProductAutocomplete
                          products={products}
                          value={item.description || item.name}
                          clientId={challanData.clientId}
                          onAddNewProduct={handleAddNewProduct}
                          onChange={(val) => updateItem(item.id, "description", val)}
                          onSelect={(product) => {
                            updateItem(item.id, "description", product.name);
                            updateItem(item.id, "hsnCode", product.hsn || "");
                            updateItem(item.id, "rate", product.price || 0);
                          }}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.hsnCode || item.hsn || ""}
                          onChange={(e) => updateItem(item.id, "hsnCode", e.target.value)}
                          placeholder="HSN"
                          className="w-full px-2 py-1.5 text-sm bg-gray-100 border-0 rounded text-center focus:bg-white focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", Math.max(1, Number(e.target.value)))}
                          className="w-full px-2 py-1.5 text-sm bg-gray-100 border-0 rounded text-center focus:bg-white focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate || item.price || 0}
                          onChange={(e) => updateItem(item.id, "rate", Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-sm bg-gray-100 border-0 rounded text-right focus:bg-white focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-gray-900">
                        ₹{(item.amount || (item.quantity * (item.rate || 0))).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {challanData.items.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-gray-500">
                        No items added yet. Click "+ Add Item" above to add items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add New Row button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                + Add New Row
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar Section */}
        <div className="space-y-6">
          {/* Tax & Total Summary Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
            <h3 className="text-md font-bold text-gray-900 border-b pb-2">Amount Summary</h3>

            <div className="flex justify-between text-sm py-1">
              <span className="text-gray-600">Sub Total</span>
              <span className="font-semibold">₹{calculations.subtotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-gray-600">CGST (9%)</span>
              <span className="font-medium">₹{calculations.cgstAmount.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-gray-600">SGST (9%)</span>
              <span className="font-medium">₹{calculations.sgstAmount.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-gray-600">IGST (0%)</span>
              <span className="font-medium">₹{calculations.igstAmount.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-sm py-1 border-t pt-2">
              <label className="flex items-center space-x-2 text-gray-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={challanData.isRoundOff || false}
                  onChange={(e) => setChallanData((prev) => ({ ...prev, isRoundOff: e.target.checked }))}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Round Off</span>
              </label>
              <span className="font-medium text-gray-700">₹{calculations.roundOffAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-base font-bold py-3 border-t border-b border-gray-200 text-gray-900">
              <span>Total ( ₹ )</span>
              <span className="text-xl text-blue-600">₹{calculations.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Declaration Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Declaration</h2>

            {/* Declaration Textbox */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Terms & Declaration
              </label>
              <textarea
                rows="3"
                value={challanData.declaration}
                onChange={(e) => setChallanData((prev) => ({ ...prev, declaration: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>
        </div>
      </div>
      </div>
      <ChallanPreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        onSave={handleSavePreferences}
        initialPreferences={preferences}
      />
    </div>
  );
}

CreateDeliveryChallanComponent.propTypes = {
  challanData: PropTypes.object.isRequired,
  setChallanData: PropTypes.func.isRequired,
  saveDraft: PropTypes.func.isRequired,
  handlePreview: PropTypes.func.isRequired,
  saveChallan: PropTypes.func.isRequired,
  clients: PropTypes.array,
  products: PropTypes.array,
  calculations: PropTypes.object,
  addItem: PropTypes.func.isRequired,
  updateItem: PropTypes.func.isRequired,
  removeItem: PropTypes.func.isRequired,
  handleClientSelect: PropTypes.func.isRequired,
  handleAddNewProduct: PropTypes.func,
  onCancel: PropTypes.func.isRequired,
};
