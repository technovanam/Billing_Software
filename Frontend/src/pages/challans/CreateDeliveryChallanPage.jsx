import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useChallans, useCustomers, useProducts } from "../../hooks/useFirestore";
import { useToast } from "../../context/ToastContext";
import CreateDeliveryChallanComponent from "./CreateDeliveryChallanComponent";
import { ChallanPreview } from "./DeliveryChallanManagement";

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
    cgst: 9,
    sgst: 9,
    igst: 0,
    status: "Sent",
    declaration:
      "We declare that this delivery challan shows the actual price of the goods Described and that all Particulars are true and correct.",
    isRoundOff: false,
    notes: "",
    invoiceNotes: "",
  });

  const [challanData, setChallanData] = useState(getInitialChallanData);
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
        setChallanData(JSON.parse(JSON.stringify(existing)));
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

  useEffect(() => {
    const itemsArray = challanData.items || challanData.products || [];
    const subtotal = itemsArray.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.rate || item.price || 0),
      0
    );
    const cgstAmount = (subtotal * (challanData.cgst || 0)) / 100;
    const sgstAmount = (subtotal * (challanData.sgst || 0)) / 100;
    const igstAmount = (subtotal * (challanData.igst || 0)) / 100;
    let total = subtotal + cgstAmount + sgstAmount + igstAmount;
    let roundOffAmount = 0;
    if (challanData.isRoundOff) {
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
    challanData.items,
    challanData.products,
    challanData.cgst,
    challanData.sgst,
    challanData.igst,
    challanData.isRoundOff,
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
    setChallanData((prev) => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const updateItem = (itemId, field, value) => {
    setChallanData((prev) => ({
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
    setChallanData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleClientSelect = (clientId) => {
    if (clientId === null) {
      setChallanData((prev) => ({ ...prev, clientId: "", client: null }));
      return;
    }
    const selectedClient = (customers || []).find((c) => c.id === clientId);
    setChallanData((prev) => ({
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
      const draftChallan = {
        ...challanData,
        status: "Draft",
        amount: calculations.total,
      };
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
      const newChallan = {
        ...challanData,
        amount: calculations.total,
        status: challanData.status || "Sent",
      };
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
