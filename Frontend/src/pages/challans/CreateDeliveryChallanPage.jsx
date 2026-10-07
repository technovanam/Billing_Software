import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useChallans, useCustomers, useProducts } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";
import CreateDeliveryChallanComponent from "./CreateDeliveryChallanComponent";
import { ChallanPreview } from "./DeliveryChallanManagement";
import { useSettings } from "../../hooks/useFirestore";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { calculateInvoiceTotals } from "../../utils/invoiceTotals";
import { invoiceTaxSettings } from "../../utils/invoiceFromDraft";
import { ITEMWISE_DEFAULTS, newInvoiceItem, applyItemChange, applyProduct, withClient, prepareForEdit, invoiceForSave } from "../../utils/invoiceForm";

export default function CreateDeliveryChallanPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { success: toastSuccess, error: toastError } = useToast();

  const { customers } = useCustomers();
  const { products, addProduct } = useProducts();
  const { addChallan, editChallan, allChallans } = useChallans();

  const generateNextChallanNumber = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const financialYearStart = today.getMonth() >= 3 ? currentYear : currentYear - 1;
    const financialYearEnd = financialYearStart + 1;
    const financialYearString = `${financialYearStart}-${financialYearEnd.toString().slice(2)}`;

    const challansInCurrentYear = (allChallans || []).filter((c) => {
      const num = c.challanNumber || c.dcNumber || "";
      return num.endsWith(`/${financialYearString}`) || num.startsWith("DC-");
    });

    if (challansInCurrentYear.length === 0) {
      return `DC-001/${financialYearString}`;
    }

    const maxNumber = challansInCurrentYear.reduce((max, challan) => {
      const num = challan.challanNumber || challan.dcNumber || "";
      const match = num.match(/DC-(\d+)/i) || num.match(/(\d+)\/\d{4}-\d{2}$/);
      if (match && match[1]) {
        return Math.max(Number.parseInt(match[1], 10), max);
      }
      return max;
    }, 0);

    return `DC-${String(maxNumber + 1).padStart(3, "0")}/${financialYearString}`;
  };

  const getInitialChallanData = () => ({
    challanNumber: generateNextChallanNumber(),
    dcNumber: generateNextChallanNumber(),
    challanDate: new Date().toISOString().split("T")[0],
    referenceNumber: "",
    poNumber: "",
    poDate: "",
    challanType: "Others",
    vehicleNumber: "",
    clientId: "",
    client: null,
    items: [],
    ...ITEMWISE_DEFAULTS,
    isGstEnabled: true,
    status: "Sent",
    declaration:
      "We declare that this delivery challan shows the actual price of the goods Described and that all Particulars are true and correct.",
    isRoundOff: false,
    notes: "",
    invoiceNotes: "",
  });

  const [challanData, setChallanData] = useState(getInitialChallanData);
  const { companyProfile } = useCompanyProfile();
  const { settings } = useSettings();
  const { defaultGstRate } = invoiceTaxSettings(settings);
  const [calculations, setCalculations] = useState({
    subtotal: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    roundOffAmount: 0,
    total: 0,
  });

  useEffect(() => {
    if (isEditMode && allChallans && allChallans.length > 0) {
      const existing = allChallans.find((c) => c.id === id);
      if (existing) {
        setChallanData(prepareForEdit(existing, companyProfile));
      }
    } else if (!isEditMode && allChallans && allChallans.length > 0) {
      const nextNum = generateNextChallanNumber();
      setChallanData((prev) => {
        if (!prev.challanNumber || prev.challanNumber.startsWith("DC-001/")) {
          return { ...prev, challanNumber: nextNum, dcNumber: nextNum };
        }
        return prev;
      });
    }
  }, [id, isEditMode, allChallans]);

  // Place of supply starts at the business's own state until a customer is picked.
  useEffect(() => {
    if (companyProfile && !challanData.placeOfSupply && !isEditMode) {
      setChallanData((prev) => (prev.placeOfSupply ? prev : withClient(prev, prev.client, companyProfile)));
    }
  }, [companyProfile, challanData.placeOfSupply, isEditMode]);

  // Same GST engine as invoices.
  useEffect(() => {
    setCalculations(calculateInvoiceTotals(challanData));
  }, [challanData]);

  const addItem = () => {
    setChallanData((prev) => ({ ...prev, items: [...(prev.items || []), newInvoiceItem(defaultGstRate)] }));
  };

  const updateItem = (itemId, field, value) => {
    setChallanData((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? applyItemChange(item, field, value) : item)),
    }));
  };

  const applyProductToItem = (itemId, product) => {
    setChallanData((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? applyProduct(item, product, defaultGstRate) : item)),
    }));
  };

  const removeItem = (itemId) => {
    setChallanData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleClientSelect = (clientId) => {
    const selectedClient = clientId === null ? null : (customers || []).find((c) => c.id === clientId) || null;
    setChallanData((prev) => withClient(prev, selectedClient, companyProfile));
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

  const validateChallanForm = () => {
    const { challanNumber, challanDate, clientId, items } = challanData;
    const missingFields = [];
    if (!challanNumber && !challanData.dcNumber) missingFields.push("Delivery Challan Number");
    if (!challanDate) missingFields.push("Delivery Challan Date");
    if (!clientId) missingFields.push("Customer Name");
    if (!items || items.length === 0) missingFields.push("At least one item");

    if (missingFields.length > 0) {
      toastError(`Please fill in required fields: ${missingFields.join(", ")}`);
      return false;
    }
    return true;
  };

  const saveDraft = async () => {
    try {
      const draftChallan = invoiceForSave(challanData, companyProfile, { status: "Draft" });
      const result = isEditMode
        ? await editChallan(id, draftChallan)
        : await addChallan(draftChallan);
      if (result.success) {
        toastSuccess(isEditMode ? "Delivery Challan draft updated!" : "Delivery Challan saved as draft!");
        navigate("/delivery-challans");
      } else {
        toastError("Failed to save draft.");
      }
    } catch (err) {
      toastError("Error saving draft: " + err.message);
    }
  };

  const saveChallan = async () => {
    if (!validateChallanForm()) return;

    try {
      const newChallan = invoiceForSave(challanData, companyProfile, { status: challanData.status || "Sent" });
      const result = isEditMode
        ? await editChallan(id, newChallan)
        : await addChallan(newChallan);
      if (result.success) {
        toastSuccess(isEditMode ? "Delivery Challan updated successfully!" : "Delivery Challan created successfully!");
        navigate("/delivery-challans");
      } else {
        toastError("Failed to save delivery challan.");
      }
    } catch (err) {
      toastError("Error saving delivery challan: " + err.message);
    }
  };

  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <CreateDeliveryChallanComponent
        challanData={challanData}
        setChallanData={setChallanData}
        saveDraft={saveDraft}
        handlePreview={() => setShowPreview(true)}
        saveChallan={saveChallan}
        clients={customers || []}
        products={products || []}
        calculations={calculations}
        applyProductToItem={applyProductToItem}
        addItem={addItem}
        updateItem={updateItem}
        removeItem={removeItem}
        handleClientSelect={handleClientSelect}
        handleAddNewProduct={handleAddNewProduct}
        onCancel={() => navigate("/delivery-challans")}
        isEditMode={isEditMode}
      />
      {showPreview && (
        <ChallanPreview
          challan={null}
          challanData={challanData}
          calculations={calculations}
          setShowPreview={setShowPreview}
        />
      )}
    </>
  );
}
