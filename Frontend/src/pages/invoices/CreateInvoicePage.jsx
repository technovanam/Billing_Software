import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoices, useCustomers, useProducts } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";
import CreateInvoiceComponent from "./CreateInvoiceComponent";
import { InvoicePreview } from "./InvoiceManagement.jsx";

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();

  const { customers } = useCustomers();
  const { products, addProduct } = useProducts();
  const { addInvoice, allInvoices } = useInvoices();

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
    isRoundOff: false,
    invoiceNotes: "",
  });

  const [invoiceData, setInvoiceData] = useState(getInitialInvoiceData);
  const [calculations, setCalculations] = useState({
    subtotal: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    roundOffAmount: 0,
    total: 0,
  });

  // Update invoice number once invoices load if default was 001
  useEffect(() => {
    if (allInvoices && allInvoices.length > 0) {
      const nextNum = generateNextInvoiceNumber();
      setInvoiceData((prev) => {
        if (!prev.invoiceNumber || prev.invoiceNumber.startsWith("001/")) {
          return { ...prev, invoiceNumber: nextNum };
        }
        return prev;
      });
    }
  }, [allInvoices]);

  useEffect(() => {
    const itemsArray = invoiceData.items || invoiceData.products || [];
    const subtotal = itemsArray.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.rate || item.price || 0),
      0
    );
    const cgstAmount = (subtotal * invoiceData.cgst) / 100;
    const sgstAmount = (subtotal * invoiceData.sgst) / 100;
    const igstAmount = (subtotal * invoiceData.igst) / 100;
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
  ]);

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
