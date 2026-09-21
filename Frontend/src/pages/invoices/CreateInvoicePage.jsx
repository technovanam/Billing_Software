import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoices, useCustomers, useProducts, useSettings } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";
import CreateInvoiceComponent from "./CreateInvoiceComponent";
import { InvoicePreview } from "./InvoiceManagement.jsx";

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();

  const { customers } = useCustomers();
  const { products, addProduct } = useProducts();
  const { addInvoice, allInvoices } = useInvoices();
  const { settings, updateSettings } = useSettings();

  // Generate next invoice number based on allInvoices
  const generateNextInvoiceNumber = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const financialYearStart = today.getMonth() >= 3 ? currentYear : currentYear - 1;
    const financialYearEnd = financialYearStart + 1;
    const financialYearString = `${financialYearStart}-${financialYearEnd.toString().slice(2)}`;

    const invoicesInCurrentYear = (allInvoices || []).filter((inv) => {
      return inv.invoiceNumber && inv.invoiceNumber.endsWith(`/${financialYearString}`);
    });

    if (invoicesInCurrentYear.length === 0) {
      return `001/${financialYearString}`;
    }

    const maxNumber = invoicesInCurrentYear.reduce((max, invoice) => {
      const match = invoice.invoiceNumber.match(/(\d+)\/\d{4}-\d{2}$/);
      if (match && match[1]) {
        return Math.max(Number.parseInt(match[1], 10), max);
      }
      return max;
    }, 0);

    return `${String(maxNumber + 1).padStart(3, "0")}/${financialYearString}`;
  };

  const getInitialInvoiceData = () => ({
    invoiceNumber: generateNextInvoiceNumber(),
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    poNumber: "",
    poDate: "",
    dcNumber: "",
    dcDate: "",
    clientId: "",
    client: null,
    items: [],
    cgst: 9,
    sgst: 9,
    igst: 0,
    bankDetails: "State Bank Of India",
    status: "Unpaid",
    declaration:
      "We declare that this invoice shows the actual price of the goods Described and that all Particulars are true and correct.",
    isRoundOff: true,
    isGstEnabled: true,
    isAutoInvoice: true,
    invoiceNotes: "",
  });

  const [invoiceData, setInvoiceData] = useState(getInitialInvoiceData);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [calculations, setCalculations] = useState({
    subtotal: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    roundOffAmount: 0,
    total: 0,
  });

  // Sync initial settings from SystemSettings (Firestore)
  useEffect(() => {
    if (settings?.systemSettings?.value?.systemFeatures && !settingsLoaded) {
      const features = settings.systemSettings.value.systemFeatures;
      const isAuto = features.autoInvoice ?? true;
      const isGst = features.gstCalculation ?? true;
      const isRound = features.roundOff ?? true;

      setInvoiceData((prev) => ({
        ...prev,
        isRoundOff: isRound,
        isGstEnabled: isGst,
        isAutoInvoice: isAuto,
        invoiceNumber: isAuto ? generateNextInvoiceNumber() : prev.invoiceNumber,
        cgst: isGst ? (prev.cgst || 9) : 0,
        sgst: isGst ? (prev.sgst || 9) : 0,
        igst: isGst ? (prev.igst || 0) : 0,
      }));
      setSettingsLoaded(true);
    }
  }, [settings, settingsLoaded]);

  // Update invoice number once invoices load if default was 001
  useEffect(() => {
    if (allInvoices && allInvoices.length > 0 && invoiceData.isAutoInvoice) {
      const nextNum = generateNextInvoiceNumber();
      setInvoiceData((prev) => {
        if (!prev.invoiceNumber || prev.invoiceNumber.startsWith("001/")) {
          return { ...prev, invoiceNumber: nextNum };
        }
        return prev;
      });
    }
  }, [allInvoices, invoiceData.isAutoInvoice]);

  // Calculations Effect
  useEffect(() => {
    const itemsArray = invoiceData.items || invoiceData.products || [];
    const subtotal = itemsArray.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.rate || item.price || 0),
      0
    );

    const cgstAmount = invoiceData.isGstEnabled ? (subtotal * invoiceData.cgst) / 100 : 0;
    const sgstAmount = invoiceData.isGstEnabled ? (subtotal * invoiceData.sgst) / 100 : 0;
    const igstAmount = invoiceData.isGstEnabled ? (subtotal * invoiceData.igst) / 100 : 0;

    let total = subtotal + cgstAmount + sgstAmount + igstAmount;
    let roundOffAmount = 0;
    if (invoiceData.isRoundOff) {
      const roundedTotal = Math.round(total);
      roundOffAmount = roundedTotal - total;
      total = roundedTotal;
    }
    setCalculations({
      subtotal,
      cgstAmount,
      sgstAmount,
      igstAmount,
      roundOffAmount,
      total,
    });
  }, [
    invoiceData.items,
    invoiceData.products,
    invoiceData.cgst,
    invoiceData.sgst,
    invoiceData.igst,
    invoiceData.isRoundOff,
    invoiceData.isGstEnabled,
  ]);

  // Bi-directional feature update helper to persist setting to SystemSettings in Firestore
  const updateSystemFeature = async (featureKey, newValue) => {
    try {
      const currentVal = settings?.systemSettings?.value || {};
      const currentFeatures = currentVal.systemFeatures || {
        autoInvoice: true,
        gstCalculation: true,
        roundOff: true,
      };
      const updatedFeatures = {
        ...currentFeatures,
        [featureKey]: newValue,
      };
      await updateSettings(
        "systemSettings",
        {
          systemConfig: currentVal.systemConfig || {
            currency: "INR",
            timeZone: "Asia/Kolkata",
            dateFormat: "DD/MM/YYYY",
            invoicePrefix: "INV",
          },
          systemFeatures: updatedFeatures,
        },
        "System configuration and features"
      );
    } catch (err) {
      console.error("Failed to update system setting:", err);
    }
  };

  const handleToggleRoundOff = (newValue) => {
    setInvoiceData((prev) => ({ ...prev, isRoundOff: newValue }));
    updateSystemFeature("roundOff", newValue);
  };

  const handleToggleGst = (newValue) => {
    setInvoiceData((prev) => ({
      ...prev,
      isGstEnabled: newValue,
      cgst: newValue ? 9 : 0,
      sgst: newValue ? 9 : 0,
      igst: 0,
    }));
    updateSystemFeature("gstCalculation", newValue);
  };

  const handleToggleAutoInvoice = (newValue) => {
    setInvoiceData((prev) => {
      const nextNum = newValue ? generateNextInvoiceNumber() : prev.invoiceNumber;
      return {
        ...prev,
        isAutoInvoice: newValue,
        invoiceNumber: nextNum,
      };
    });
    updateSystemFeature("autoInvoice", newValue);
  };

  const addItem = () => {
    const newItem = {
      id: Date.now(),
      description: "",
      hsnCode: "",
      quantity: 1,
      rate: 0,
      amount: 0,
    };
    setInvoiceData((prev) => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const updateItem = (itemId, field, value) => {
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          if (field === "quantity" || field === "rate") {
            updatedItem.amount =
              (Number.parseFloat(updatedItem.quantity) || 0) *
              (Number.parseFloat(updatedItem.rate) || 0);
          }
          return updatedItem;
        }
        return item;
      }),
    }));
  };

  const removeItem = (itemId) => {
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleClientSelect = (clientId) => {
    if (clientId === null) {
      setInvoiceData((prev) => ({ ...prev, clientId: "", client: null }));
      return;
    }
    const selectedClient = (customers || []).find((c) => c.id === clientId);
    setInvoiceData((prev) => ({
      ...prev,
      clientId: clientId,
      client: selectedClient,
    }));
  };

  const handleAddNewProduct = async (productName, clientId) => {
    if (!productName?.trim()) return;
    try {
      const newProduct = {
        name: productName,
        hsn: "",
        price: 0,
        clientId: clientId || "",
      };
      await addProduct(newProduct);
      toastSuccess(`Product "${productName}" added successfully!`);
    } catch (err) {
      toastError("Failed to add new product.");
    }
  };

  const validateInvoiceForm = () => {
    const { invoiceNumber, invoiceDate, dueDate, clientId, items } = invoiceData;
    const missingFields = [];
    if (!invoiceNumber) missingFields.push("Invoice Number");
    if (!invoiceDate) missingFields.push("Invoice Date");
    if (!dueDate) missingFields.push("Due Date");
    if (!clientId) missingFields.push("Client Information");
    if (!items || items.length === 0) missingFields.push("At least one item");

    if (missingFields.length > 0) {
      toastError(`Please fill in required fields: ${missingFields.join(", ")}`);
      return false;
    }
    return true;
  };

  const saveDraft = async () => {
    try {
      const draftInvoice = {
        ...invoiceData,
        status: "Draft",
        amount: calculations.total,
      };
      const result = await addInvoice(draftInvoice);
      if (result.success) {
        toastSuccess("Invoice saved as draft!");
        navigate("/invoices");
      } else {
        toastError("Failed to save draft invoice.");
      }
    } catch (err) {
      toastError("Error saving draft: " + err.message);
    }
  };

  const saveInvoice = async () => {
    if (!validateInvoiceForm()) return;

    try {
      const newInvoice = {
        ...invoiceData,
        amount: calculations.total,
        status: invoiceData.status || "Unpaid",
      };
      const result = await addInvoice(newInvoice);
      if (result.success) {
        toastSuccess("Invoice created successfully!");
        navigate("/invoices");
      } else {
        toastError("Failed to save invoice.");
      }
    } catch (err) {
      toastError("Error saving invoice: " + err.message);
    }
  };

  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <CreateInvoiceComponent
        invoiceData={invoiceData}
        setInvoiceData={setInvoiceData}
        saveDraft={saveDraft}
        handlePreview={() => setShowPreview(true)}
        saveInvoice={saveInvoice}
        clients={customers || []}
        products={products || []}
        calculations={calculations}
        addItem={addItem}
        updateItem={updateItem}
        removeItem={removeItem}
        handleClientSelect={handleClientSelect}
        handleAddNewProduct={handleAddNewProduct}
        handleToggleRoundOff={handleToggleRoundOff}
        handleToggleGst={handleToggleGst}
        handleToggleAutoInvoice={handleToggleAutoInvoice}
      />
      {showPreview && (
        <InvoicePreview
          invoice={null}
          invoiceData={invoiceData}
          calculations={calculations}
          setShowPreview={setShowPreview}
        />
      )}
    </>
  );
}
