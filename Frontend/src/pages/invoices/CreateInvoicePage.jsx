import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useInvoices, useCustomers, useProducts, usePriceLists, useSettings, usePatchDoc } from "../../hooks/useFirestore";
import { priceListFor } from "../../utils/priceLists";
import { invoicePatchFromOrder } from "../../utils/vouchers";
import { useToast } from "../../context/ToastContext";
import CreateInvoiceComponent from "./CreateInvoiceComponent";
import { calculateInvoiceTotals } from "../../utils/invoiceTotals";
import { nextInvoiceNumber, draftToInvoiceItems, invoiceTaxSettings } from "../../utils/invoiceFromDraft";
import { ITEMWISE_DEFAULTS, newInvoiceItem, applyItemChange, applyProduct, withClient, invoiceForSave } from "../../utils/invoiceForm";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import AICommandBar from "../../components/ai-command/AICommandBar";
import useAICommand from "../../components/ai-command/useAICommand";

const isF2 = (e) => e.key === "F2";
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
import { InvoicePreview } from "./InvoiceManagement.jsx";

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();

  const { customers } = useCustomers();
  const { products, addProduct } = useProducts();
  const { priceLists } = usePriceLists();
  const { addInvoice, allInvoices } = useInvoices();
  const { settings, updateSettings } = useSettings();
  const { companyProfile } = useCompanyProfile();
  const { defaultGstRate } = invoiceTaxSettings(settings);

  const generateNextInvoiceNumber = () => nextInvoiceNumber(allInvoices);

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
    ...ITEMWISE_DEFAULTS,
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
  const patchDoc = usePatchDoc();
  const location = useLocation();

  // "Convert to invoice" from a quotation / sales order.
  const fromOrder = location.state?.fromOrder;
  useEffect(() => {
    if (!fromOrder || !companyProfile) return;
    const client = (customers || []).find((c) => c.id === fromOrder.partyId) || fromOrder.party;
    setInvoiceData((prev) => withClient({ ...prev, ...invoicePatchFromOrder(fromOrder) }, client, companyProfile));
    navigate(location.pathname, { replace: true, state: null });
  }, [fromOrder, companyProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const markOrderConverted = async (invoiceNumber) => {
    const ref = invoiceData.orderRef;
    if (ref?.id) await patchDoc(ref.collection, ref.id, { status: "Converted", convertedTo: { type: "invoice", number: invoiceNumber } });
  };
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

  // Place of supply defaults to the business's own state until a customer is picked.
  useEffect(() => {
    if (companyProfile && !invoiceData.placeOfSupply) {
      setInvoiceData((prev) => (prev.placeOfSupply ? prev : withClient(prev, prev.client, companyProfile)));
    }
  }, [companyProfile, invoiceData.placeOfSupply]);

  // Calculations Effect
  useEffect(() => {
    setCalculations(calculateInvoiceTotals(invoiceData));
  }, [invoiceData]);

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
    setInvoiceData((prev) => ({ ...prev, items: [...prev.items, newInvoiceItem(defaultGstRate)] }));
  };

  const updateItem = (itemId, field, value) => {
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? applyItemChange(item, field, value) : item)),
    }));
  };

  const applyProductToItem = (itemId, product) => {
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? applyProduct(item, product, defaultGstRate, priceListFor(prev.client, priceLists)) : item)),
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
      setInvoiceData((prev) => withClient(prev, null, companyProfile));
      return;
    }
    const selectedClient = (customers || []).find((c) => c.id === clientId);
    setInvoiceData((prev) => withClient(prev, selectedClient, companyProfile));
  };

  const handleAddNewProduct = async (productName, clientId) => {
    if (!productName?.trim()) return;
    try {
      const newProduct = {
        name: productName,
        hsn: "",
        price: 0,
        gstRate: defaultGstRate,
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
      const draftInvoice = invoiceForSave(invoiceData, companyProfile, { status: "Draft" });
      const result = await addInvoice(draftInvoice);
      if (result.success) {
        ai.markSaved(result.id);
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
      const newInvoice = invoiceForSave(invoiceData, companyProfile, { status: invoiceData.status || "Unpaid" });
      const result = await addInvoice(newInvoice);
      if (result.success) {
        ai.markSaved(result.id);
        await markOrderConverted(newInvoice.invoiceNumber);
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

  // AI command bar: builds a draft that is copied into this form on Confirm.
  const ai = useAICommand({ context: "invoice", addProduct });

  const draftTotals = (() => {
    const items = draftToInvoiceItems(ai.draft, defaultGstRate);
    if (!items.length) return null;
    const t = calculateInvoiceTotals({ ...invoiceData, items });
    const rows = [{ label: "Taxable value", value: money(t.taxableAmount) }];
    if (invoiceData.isGstEnabled) {
      if (t.cgstAmount) rows.push({ label: "CGST", value: money(t.cgstAmount) });
      if (t.sgstAmount) rows.push({ label: "SGST", value: money(t.sgstAmount) });
      if (t.igstAmount) rows.push({ label: "IGST", value: money(t.igstAmount) });
    }
    if (invoiceData.isRoundOff) rows.push({ label: "Round off", value: money(t.roundOffAmount) });
    rows.push({ label: "Draft total", value: money(t.total), strong: true });
    return rows;
  })();

  const applyAiDraft = (draft) => {
    const newItems = draftToInvoiceItems(draft, defaultGstRate);
    setInvoiceData((prev) => {
      const next = {
        ...prev,
        // Drop empty placeholder rows, keep anything the user already entered.
        items: [...(prev.items || []).filter((it) => it.description || Number(it.rate) > 0), ...newItems],
      };
      if (draft.dueInDays !== null && draft.dueInDays !== undefined) {
        const due = new Date(prev.invoiceDate || new Date());
        due.setDate(due.getDate() + draft.dueInDays);
        next.dueDate = due.toISOString().split("T")[0];
      }
      if (draft.notes) next.invoiceNotes = [prev.invoiceNotes, draft.notes].filter(Boolean).join("\n");
      return next;
    });
    if (draft.customer?.status === "matched" && draft.customer.id) handleClientSelect(draft.customer.id);
    ai.markConfirmed();
    toastSuccess(`Added ${newItems.length} item${newItems.length === 1 ? "" : "s"} from the AI draft. Review and save.`);
  };

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
        applyProductToItem={applyProductToItem}
      />
      {showPreview && (
        <InvoicePreview
          invoice={null}
          invoiceData={invoiceData}
          calculations={calculations}
          setShowPreview={setShowPreview}
        />
      )}
      <AICommandBar
        ai={ai}
        shortcut={isF2}
        shortcutLabel="F2"
        customers={customers || []}
        totals={draftTotals}
        onConfirm={applyAiDraft}
      />
    </>
  );
}
