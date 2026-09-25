import React, { useState, useEffect, useMemo, useRef, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Search,
  Camera,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  Trash2,
  Receipt,
  ShoppingCart,
  CheckCircle2,
  Clock,
  User,
  Package,
  TrendingUp,
  RotateCcw,
  LogOut,
  Barcode,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Banknote,
  Smartphone,
  ExternalLink,
  Users,
  Phone,
  UserPlus,
  X,
  PauseCircle,
  PlayCircle,
  Bookmark,
  WifiOff,
} from "lucide-react";
import { useProducts, useInvoices, useCustomers } from "../../hooks/useFirestore";
import { calculatePosCartSummary, buildPosCartItem } from "../../utils/invoiceTotals";
import AICommandBar from "../../components/ai-command/AICommandBar";
import useAICommand from "../../components/ai-command/useAICommand";
import { enqueueBill, getPendingBills, logSyncError } from "../../services/posBillQueue";

// F2 already focuses POS search, so the AI bar uses Ctrl+K (Cmd+K on Mac).
const isCtrlK = (e) => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
const AI_PAYMENT_MODE = { cash: "Cash", upi: "Online", card: "Online", bank: "Online" };
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { AuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import QRScannerModal from "./QRScannerModal";
import ThermalReceipt from "./ThermalReceipt";

export default function POSPage() {
  const navigate = useNavigate();
  const { user, signOut } = useContext(AuthContext);
  const { companyProfile } = useCompanyProfile();
  const { products, loading: productsLoading, addProduct } = useProducts();
  const { addInvoice, allInvoices } = useInvoices();
  const { customers, addCustomer } = useCustomers();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const companyName = companyProfile?.companyName || "Techno Vanam";
  const companyLogo = companyProfile?.logoURL || "/Icon@4x-8.png";

  // Customer State (Independent for each bill)
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustFormName, setNewCustFormName] = useState("");
  const [newCustFormPhone, setNewCustFormPhone] = useState("+91 ");
  const [isSavingNewCustomer, setIsSavingNewCustomer] = useState(false);
  const customerDropdownRef = useRef(null);

  // Cart & Product State
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState([]);
  const [cashReceived, setCashReceived] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash"); // "Cash" | "Online"
  const [onlinePaymentDetails, setOnlinePaymentDetails] = useState(null); // { paymentId, orderId }
  const [cgstRate, setCgstRate] = useState(2.5);
  const [sgstRate, setSgstRate] = useState(2.5);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isInvoiceSaved, setIsInvoiceSaved] = useState(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  // "idle" | "saving" | "saved" | "pending" | "failed"
  const [billSyncStatus, setBillSyncStatus] = useState("idle");
  const [pendingBillLocalId, setPendingBillLocalId] = useState(null);
  const [isProcessingRazorpay, setIsProcessingRazorpay] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCatalogDrawer, setShowCatalogDrawer] = useState(false);

  // Paused / Held Bills State
  const [pausedBills, setPausedBills] = useState(() => {
    try {
      const saved = localStorage.getItem("pos_paused_bills");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isPausedDrawerOpen, setIsPausedDrawerOpen] = useState(false);

  // Sync paused bills with localStorage
  useEffect(() => {
    try {
      localStorage.setItem("pos_paused_bills", JSON.stringify(pausedBills));
    } catch (_) {}
  }, [pausedBills]);

  const searchInputRef = useRef(null);
  const summaryScrollRef = useRef(null);

  // Unified list of all past customers from Firestore & Invoices
  const knownCustomers = useMemo(() => {
    const map = new Map();

    // From invoices
    (allInvoices || []).forEach((inv) => {
      const name = inv.customerName || inv.client?.name || "";
      const phone = inv.customerPhone || inv.client?.phone || "";
      if (name && name !== "Walk-in Counter Customer") {
        const key = phone || name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { id: inv.id || key, name, phone: phone || "-" });
        }
      }
    });

    // From registered customers
    (customers || []).forEach((c) => {
      const name = c.name || c.clientName || "";
      const phone = c.phone || c.mobile || "";
      if (name) {
        const key = phone || name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { id: c.id || key, name, phone: phone || "-" });
        }
      }
    });

    return Array.from(map.values());
  }, [allInvoices, customers]);

  // Filter known customers based on input
  const filteredCustomerSuggestions = useMemo(() => {
    if (!customerName.trim() && !customerPhone.trim()) return [];
    const qName = customerName.toLowerCase().trim();
    const qPhone = customerPhone.replace(/[^0-9]/g, "");

    return knownCustomers.filter((c) => {
      const matchName = qName && c.name.toLowerCase().includes(qName);
      const matchPhone = qPhone && c.phone.replace(/[^0-9]/g, "").includes(qPhone);
      return matchName || matchPhone;
    }).slice(0, 8);
  }, [knownCustomers, customerName, customerPhone]);

  // Handle selecting an existing customer
  const handleSelectCustomer = (cust) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone === "-" ? "" : cust.phone);
    setSelectedCustomerId(cust.id);
    setIsCustomerDropdownOpen(false);
    toastInfo(`Selected customer: ${cust.name}`);
  };

  // Reset/Clear Customer for a new bill
  const handleResetCustomer = () => {
    setCustomerName("");
    setCustomerPhone("");
    setSelectedCustomerId(null);
    setIsCustomerDropdownOpen(false);
  };

  // Handle creating & registering a new customer instantly via Modal
  const handleSaveNewCustomerModal = async (e) => {
    e?.preventDefault();
    if (!newCustFormName.trim()) {
      toastError("Customer name is required.");
      return;
    }

    const cleanDigits = newCustFormPhone.replace(/[^0-9]/g, "");
    if (cleanDigits.length < 10) {
      toastError("Please enter a valid 10-digit phone number.");
      return;
    }

    setIsSavingNewCustomer(true);
    try {
      const custData = {
        name: newCustFormName.trim(),
        phone: newCustFormPhone.trim(),
        email: "",
        address: "Store Walk-in",
        totalRevenue: 0,
        totalInvoices: 0,
      };

      if (addCustomer) {
        const res = await addCustomer(custData);
        setSelectedCustomerId(res?.id || `cust_${Date.now()}`);
      }

      setCustomerName(newCustFormName.trim());
      setCustomerPhone(newCustFormPhone.trim());
      setIsAddCustomerModalOpen(false);
      setNewCustFormName("");
      setNewCustFormPhone("+91 ");
      toastSuccess(`Customer "${custData.name}" added and selected for billing!`);
    } catch (err) {
      console.error("Error creating customer:", err);
      // Fallback setting customer locally so cashier can still proceed seamlessly
      setCustomerName(newCustFormName.trim());
      setCustomerPhone(newCustFormPhone.trim());
      setIsAddCustomerModalOpen(false);
      toastSuccess(`Customer "${newCustFormName.trim()}" selected for billing!`);
    } finally {
      setIsSavingNewCustomer(false);
    }
  };

  // Live Digital Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard Shortcuts: F2: Search/Barcode focus, F8: Live Camera Scanner, F9: Generate Bill
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F8") {
        e.preventDefault();
        setIsScannerOpen((prev) => !prev);
      } else if (e.key === "F9" && cart.length > 0) {
        e.preventDefault();
        setIsReceiptOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length]);

  // Generate Unique Bill Number (pending bills get a temporary PENDING- prefix)
  const billNumber = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const count = String((allInvoices?.length || 0) + 1).padStart(4, "0");
    return `${year}${month}${day}-${count}`;
  }, [allInvoices?.length]);

  // Live pending bill count from queue (refreshes on event, online, or every 5 s)
  const [pendingCount, setPendingCount] = useState(() => getPendingBills().length);
  useEffect(() => {
    const update = () => setPendingCount(getPendingBills().length);
    const id = setInterval(update, 5000);
    window.addEventListener("pos_queue_updated", update);
    window.addEventListener("online", update);
    return () => {
      clearInterval(id);
      window.removeEventListener("pos_queue_updated", update);
      window.removeEventListener("online", update);
    };
  }, []);

  // Read cashier shift session from localStorage
  const cashierSession = useMemo(() => {
    try {
      const saved = localStorage.getItem("pos_cashier_session");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  // A signed-in cashier bills under the ID in their token (Firestore rules check it).
  const cashierId = (user?.role === "cashier" ? user.cashierId : cashierSession?.cashierId) || "CSH-001";

  const handleEndShift = async () => {
    localStorage.removeItem("pos_cashier_session");
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (user?.role === "cashier") {
      await signOut();
      navigate("/pos/login", { replace: true });
      return;
    }
    navigate("/signin", { replace: true });
  };

  // Calculate Today's POS Stats
  const todayStats = useMemo(() => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const todaysInvoices = (allInvoices || []).filter((inv) => {
        if (!inv) return false;
        let d = inv.invoiceDate;
        if (d && typeof d.toDate === "function") d = d.toDate().toISOString().split("T")[0];
        if (typeof d === "string") d = d.split("T")[0];
        return d === todayStr;
      });
      const totalTodaySales = todaysInvoices.reduce(
        (sum, inv) => sum + Number(inv?.amount || inv?.totalAmount || 0),
        0
      );
      return {
        count: todaysInvoices.length,
        revenue: totalTodaySales,
      };
    } catch {
      return { count: 0, revenue: 0 };
    }
  }, [allInvoices]);

  // Filtered Products for search suggestions & catalog
  const filteredProducts = useMemo(() => {
    let list = Array.isArray(products) ? [...products] : [];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.hsn?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.productNo?.toLowerCase().includes(q) ||
          p.id?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, searchTerm]);

  // Real-Time Cart Calculations (Subtotal, CGST, SGST, Total, Round-Off, Balance)
  const cartSummary = useMemo(
    () => calculatePosCartSummary({ cart, cgstRate, sgstRate, cashReceived, paymentMode }),
    [cart, cgstRate, sgstRate, cashReceived, paymentMode]
  );

  // Add or increment item in cart
  const addToCart = useCallback(
    (product) => {
      const newItem = buildPosCartItem(product, 1);
      const productIdentifier = newItem.productNo;

      setCart((prev) => {
        const existingIdx = prev.findIndex(
          (item) => item.id === product.id || item.productNo === productIdentifier
        );
        if (existingIdx >= 0) {
          const updated = [...prev];
          const currentQty = Number(updated[existingIdx].qty || 1);
          const nextQty = currentQty + 1;
          updated[existingIdx] = {
            ...updated[existingIdx],
            qty: nextQty,
            total: nextQty * updated[existingIdx].rate,
          };
          return updated;
        } else {
          return [newItem, ...prev];
        }
      });

      toastInfo(`Added "${product.name}" to bill table`);
    },
    [toastInfo]
  );

  // Update item quantity (+ / - delta)
  const updateQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = Math.max(0, Number(item.qty || 1) + delta);
            return nextQty > 0 ? { ...item, qty: nextQty, total: nextQty * item.rate } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  // Direct manual quantity edit
  const setDirectQuantity = (id, newQtyVal) => {
    const parsed = parseFloat(newQtyVal);
    if (isNaN(parsed) || parsed <= 0) return;
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, qty: parsed, total: parsed * item.rate };
        }
        return item;
      })
    );
  };

  // Remove item from cart
  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  // Pause / Hold the active bill so waiting customers can be billed immediately
  const handlePauseBill = () => {
    if (cart.length === 0) {
      toastError("Cannot pause an empty bill. Add products first.");
      return;
    }

    const pausedItem = {
      id: `paused_${Date.now()}`,
      savedAt: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
      customerName: customerName.trim() || "Walk-in Customer",
      customerPhone: customerPhone.trim() || "-",
      selectedCustomerId: selectedCustomerId,
      cart: [...cart],
      totalItems: cartSummary.totalItems,
      totalAmount: paymentMode === "Cash" ? cartSummary.roundedTotalAmount : cartSummary.exactTotalAmount,
      cashReceived: cashReceived,
      paymentMode: paymentMode,
      cgstRate: cgstRate,
      sgstRate: sgstRate,
    };

    setPausedBills((prev) => [pausedItem, ...prev]);

    // Clear current workstation for the next customer
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setSelectedCustomerId(null);
    setCashReceived("");
    setPaymentMode("Cash");
    setOnlinePaymentDetails(null);
    setIsInvoiceSaved(false);
    setSearchTerm("");

    toastSuccess(`Bill for "${pausedItem.customerName}" held/paused! Ready for next customer.`);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  // Resume a held/paused bill when the customer returns
  const handleResumeBill = (pausedBill) => {
    if (cart.length > 0) {
      // If current terminal already has items, ask to hold the current one first or switch
      const confirmSwitch = window.confirm(
        "Current workstation has items. Would you like to pause the current bill and resume this customer's bill?"
      );
      if (!confirmSwitch) return;

      // Auto-pause current active bill
      const currentPaused = {
        id: `paused_${Date.now()}`,
        savedAt: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
        customerName: customerName.trim() || "Walk-in Customer",
        customerPhone: customerPhone.trim() || "-",
        selectedCustomerId: selectedCustomerId,
        cart: [...cart],
        totalItems: cartSummary.totalItems,
        totalAmount: paymentMode === "Cash" ? cartSummary.roundedTotalAmount : cartSummary.exactTotalAmount,
        cashReceived: cashReceived,
        paymentMode: paymentMode,
        cgstRate: cgstRate,
        sgstRate: sgstRate,
      };
      setPausedBills((prev) => [currentPaused, ...prev.filter((b) => b.id !== pausedBill.id)]);
    } else {
      // Remove from paused list
      setPausedBills((prev) => prev.filter((b) => b.id !== pausedBill.id));
    }

    // Load paused bill data into workstation
    setCart(pausedBill.cart || []);
    setCustomerName(pausedBill.customerName === "Walk-in Customer" ? "" : pausedBill.customerName);
    setCustomerPhone(pausedBill.customerPhone === "-" ? "" : pausedBill.customerPhone);
    setSelectedCustomerId(pausedBill.selectedCustomerId || null);
    setCashReceived(pausedBill.cashReceived || "");
    setPaymentMode(pausedBill.paymentMode || "Cash");
    if (pausedBill.cgstRate) setCgstRate(pausedBill.cgstRate);
    if (pausedBill.sgstRate) setSgstRate(pausedBill.sgstRate);
    setIsInvoiceSaved(false);
    setIsPausedDrawerOpen(false);

    toastSuccess(`Resumed bill for "${pausedBill.customerName}" with ${pausedBill.cart?.length || 0} item(s)!`);
  };

  // Delete a paused bill
  const handleDeletePausedBill = (id, e) => {
    e?.stopPropagation();
    setPausedBills((prev) => prev.filter((b) => b.id !== id));
    toastInfo("Held bill removed from list.");
  };

  // Clear Cart
  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setCashReceived("");
    setIsInvoiceSaved(false);
    toastInfo("Billing table cleared");
  };

  // Handle Scan Success from Camera or Barcode Scanner
  const handleScanSuccess = (decodedText) => {
    if (!decodedText) return;

    let targetProduct = null;

    // Check if JSON structured QR
    try {
      const parsed = JSON.parse(decodedText);
      if (parsed.id) {
        targetProduct = products?.find((p) => p.id === parsed.id);
      }
      if (!targetProduct && parsed.name) {
        targetProduct = products?.find(
          (p) => p.name?.toLowerCase() === parsed.name.toLowerCase()
        );
      }
      if (!targetProduct && parsed.name && parsed.price) {
        targetProduct = {
          id: parsed.id || `custom_${Date.now()}`,
          productNo: parsed.productNo || parsed.hsn || `PRD-${Date.now().toString().slice(-4)}`,
          name: parsed.name,
          hsn: parsed.hsn || "151800",
          price: parsed.price,
          unit: parsed.unit || "Nos",
        };
      }
    } catch (_) {
      // Plain text barcode, HSN, productNo, or name match
    }

    if (!targetProduct && products && products.length > 0) {
      targetProduct = products.find(
        (p) =>
          p.id === decodedText ||
          p.hsn === decodedText ||
          p.barcode === decodedText ||
          p.productNo === decodedText ||
          p.name?.toLowerCase() === decodedText.toLowerCase()
      );
    }

    if (targetProduct) {
      addToCart(targetProduct);
      toastSuccess(`Scanned & Added: ${targetProduct.name}`);
    } else {
      toastError(`No product found for barcode "${decodedText}"`);
    }
  };

  // Handle Barcode Scanner Enter Key from Search Bar
  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchTerm.trim()) {
      e.preventDefault();
      const term = searchTerm.trim();
      const exactMatch = products?.find(
        (p) =>
          p.id?.toLowerCase() === term.toLowerCase() ||
          p.hsn?.toLowerCase() === term.toLowerCase() ||
          p.barcode?.toLowerCase() === term.toLowerCase() ||
          p.productNo?.toLowerCase() === term.toLowerCase() ||
          p.name?.toLowerCase() === term.toLowerCase()
      );

      if (exactMatch) {
        addToCart(exactMatch);
      } else if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
      } else {
        handleScanSuccess(term);
      }
      setSearchTerm("");
    }
  };

  // Quick Cash Tender Buttons
  const handleQuickCash = (amount) => {
    setCashReceived(String(amount));
  };

  // Launch Razorpay Checkout Modal for Online Payment
  const handleRazorpayPayment = async () => {
    if (cart.length === 0) {
      toastError("Billing table is empty. Add products first.");
      return;
    }

    const payableAmount = cartSummary.exactTotalAmount;
    if (payableAmount <= 0) {
      toastError("Bill amount must be greater than zero.");
      return;
    }

    setIsProcessingRazorpay(true);

    try {
      // 1. Create order on backend
      const response = await fetch("http://localhost:5000/create-razorpay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: payableAmount,
          currency: "INR",
          receipt: billNumber,
          notes: {
            billNumber,
            cashier: cashierId,
            company: companyName,
          },
        }),
      });

      const orderData = await response.json();

      if (!orderData.success || !orderData.orderId) {
        throw new Error(orderData.error || "Failed to create Razorpay payment order");
      }

      // 2. Open Razorpay Checkout modal
      const options = {
        key: orderData.keyId || "rzp_test_Tcxout7GfUZzbE",
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: companyName,
        description: `POS Bill #${billNumber} (${cartSummary.totalItems} items)`,
        image: companyLogo || "/Icon@4x-8.png",
        order_id: orderData.orderId,
        handler: async (response) => {
          try {
            // Verify payment
            const verifyRes = await fetch("http://localhost:5000/verify-razorpay-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setOnlinePaymentDetails({
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                method: "Razorpay UPI/Card/Netbanking",
              });
              toastSuccess(`Online Payment Successful! (Txn ID: ${response.razorpay_payment_id})`);
              // Automatically open receipt
              setIsReceiptOpen(true);
            } else {
              toastError("Payment verification failed.");
            }
          } catch (err) {
            console.error("Verification error:", err);
            toastError("Error verifying payment.");
          } finally {
            setIsProcessingRazorpay(false);
          }
        },
        prefill: {
          name: "Counter Customer",
          email: "customer@technovanam.com",
          contact: "9999999999",
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: () => {
            setIsProcessingRazorpay(false);
            toastInfo("Online payment window closed.");
          },
        },
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (failResponse) {
          console.error("Payment failed:", failResponse.error);
          toastError(`Payment Failed: ${failResponse.error?.description || "Transaction cancelled"}`);
          setIsProcessingRazorpay(false);
        });
        rzp.open();
      } else {
        toastError("Razorpay SDK not loaded. Please refresh the page.");
        setIsProcessingRazorpay(false);
      }
    } catch (err) {
      console.error("Razorpay error:", err);
      toastError(err.message || "Failed to initiate online payment.");
      setIsProcessingRazorpay(false);
    }
  };

  // Save Bill as Official Invoice in Firestore
  const handleSaveInvoice = async () => {
    if (cart.length === 0) return;
    setIsSavingInvoice(true);
    setBillSyncStatus("saving");
    try {
      const isOnline = paymentMode === "Online";
      const finalAmount = isOnline ? cartSummary.exactTotalAmount : cartSummary.roundedTotalAmount;
      const finalCustomerName = customerName.trim() || "Walk-in Counter Customer";
      const finalCustomerPhone = customerPhone.trim() || "-";

      const localId = `inv_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

      const payload = {
        localId,
        // Invoice number is PENDING until Firestore assigns the real sequential one.
        invoiceNumber: `PENDING-${localId.slice(-8)}`,
        invoiceDate: new Date().toISOString().split("T")[0],
        client: {
          name: finalCustomerName,
          phone: finalCustomerPhone,
          address: "Counter Sale",
        },
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone,
        items: cart.map((item) => ({
          productId: item.id && !String(item.id).startsWith("prod_") ? item.id : null,
          name: item.name,
          description: item.name,
          hsn: item.hsn,
          qty: item.qty,
          rate: item.rate,
          amount: item.total,
        })),
        cgst: cgstRate,
        sgst: sgstRate,
        igst: 0,
        subtotal: cartSummary.subtotal,
        cgstAmount: cartSummary.cgstAmount,
        sgstAmount: cartSummary.sgstAmount,
        roundOff: !isOnline ? cartSummary.roundOffDiff : 0,
        amount: finalAmount,
        status: "Paid",
        paymentMode: isOnline ? "Online (Razorpay)" : "Cash",
        onlinePaymentDetails: isOnline ? onlinePaymentDetails : null,
        cashier: cashierId,
        source: "POS Counter Terminal",
      };

      let saveResult = null;
      try {
        saveResult = await addInvoice(payload);
        if (!saveResult?.success) throw new Error("Firestore did not confirm the save.");
        if (saveResult.id) ai.markSaved(saveResult.id);
        setBillSyncStatus("saved");
        toastSuccess("Bill saved to cloud ✓");
        setPendingCount(getPendingBills().length);
      } catch (firestoreErr) {
        // Firestore unavailable — queue locally and inform the cashier clearly.
        const queuedLocalId = enqueueBill(payload);
        setPendingBillLocalId(queuedLocalId);
        setBillSyncStatus("pending");
        setPendingCount(getPendingBills().length);
        // Log for owner visibility.
        logSyncError(user?.uid || user?.businessUid, { localId: queuedLocalId, payload, retries: 0, queuedAt: new Date().toISOString() }, firestoreErr);
        // Do NOT show a success toast — show inline status only.
        console.warn("POS bill queued locally (Firestore unavailable):", firestoreErr);
      }

      // Allow printing regardless of sync status (customer is waiting).
      setIsInvoiceSaved(true);

      // Auto-register new customer
      if (customerName.trim() && !selectedCustomerId && addCustomer) {
        try {
          await addCustomer({
            name: finalCustomerName,
            phone: finalCustomerPhone,
            totalRevenue: finalAmount,
            totalInvoices: 1,
            notes: "Added via POS Counter",
          });
        } catch (custErr) {
          console.warn("Auto customer registry info:", custErr);
        }
      }
    } catch (err) {
      console.error("Unexpected error saving POS invoice:", err);
      setBillSyncStatus("failed");
      toastError("Could not save bill. Please try again.");
    } finally {
      setIsSavingInvoice(false);
    }
  };

  // Completely reset the workstation for the next customer
  const resetForNextCustomer = useCallback(() => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setSelectedCustomerId(null);
    setIsCustomerDropdownOpen(false);
    setCashReceived("");
    setPaymentMode("Cash");
    setOnlinePaymentDetails(null);
    setIsInvoiceSaved(false);
    setIsReceiptOpen(false);
    setSearchTerm("");
    setBillSyncStatus("idle");
    setPendingBillLocalId(null);
    toastSuccess("POS workstation ready for next customer!");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, [toastSuccess]);


  // AI command bar: builds a draft that is merged into the cart on Confirm.
  const ai = useAICommand({ context: "pos", addProduct });

  const draftToCartItems = (draft) =>
    draft.items
      .filter((it) => it.status === "matched" && it.qty > 0)
      .map((it) =>
        buildPosCartItem(
          { id: it.product.id, name: it.product.name, hsn: it.product.hsn, price: it.product.pricePaise / 100, unit: it.product.unitLabel || undefined },
          it.qty
        )
      );

  const aiDraftTotals = (() => {
    const draftCart = draftToCartItems(ai.draft);
    if (!draftCart.length) return null;
    const mode = AI_PAYMENT_MODE[ai.draft.payment?.mode] || paymentMode;
    const t = calculatePosCartSummary({ cart: draftCart, cgstRate, sgstRate, cashReceived: "", paymentMode: mode });
    const money = (n) => `₹${Number(n || 0).toFixed(2)}`;
    const rows = [
      { label: "Subtotal", value: money(t.subtotal) },
      { label: `CGST (${cgstRate}%)`, value: money(t.cgstAmount) },
      { label: `SGST (${sgstRate}%)`, value: money(t.sgstAmount) },
    ];
    if (mode === "Cash") rows.push({ label: "Round off", value: money(t.roundOffDiff) });
    rows.push({ label: `Draft total (${mode})`, value: money(t.payableTotal), strong: true });
    return rows;
  })();

  const applyAiDraft = (draft) => {
    const incoming = draftToCartItems(draft);
    setCart((prev) => {
      const next = [...prev];
      for (const item of incoming) {
        const idx = next.findIndex((c) => c.id === item.id);
        if (idx >= 0) {
          const qty = Number(next[idx].qty || 0) + item.qty;
          next[idx] = { ...next[idx], qty, total: qty * next[idx].rate };
        } else {
          next.unshift(item);
        }
      }
      return next;
    });
    if (draft.customer?.status === "matched") {
      const known = (customers || []).find((c) => c.id === draft.customer.id);
      handleSelectCustomer({ id: draft.customer.id, name: draft.customer.name, phone: known?.phone || "" });
    } else if (draft.customer?.status === "new" && draft.customer.name) {
      setCustomerName(draft.customer.name);
      setSelectedCustomerId(null);
    }
    if (draft.payment?.mode && AI_PAYMENT_MODE[draft.payment.mode]) setPaymentMode(AI_PAYMENT_MODE[draft.payment.mode]);
    ai.markConfirmed();
    toastSuccess(`Added ${incoming.length} item${incoming.length === 1 ? "" : "s"} from the AI draft.`);
  };

  return (
    <div className="flex flex-1 h-full min-h-0 flex-col bg-slate-100 text-slate-800 overflow-hidden font-mazzard">
      {/* ================= PAGE HEADER (Matching Admin Dashboard) ================= */}
      <header className="flex shrink-0 flex-col lg:flex-row justify-between items-start lg:items-center gap-3 px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        {/* Left: Branding & Terminal Title */}
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={companyLogo}
            alt="Logo"
            className="h-10 w-10 object-contain rounded-lg bg-white p-1 border border-gray-200 shadow-sm"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 truncate">POS Billing</h1>
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                POS Terminal
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1 truncate">
              {companyName} · Billing & Barcode Workstation
            </p>
          </div>
        </div>

        {/* Right: Today's Sales, Cashier Info & Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden md:flex items-center gap-2 rounded-lg bg-white px-3 py-2 border border-gray-200 shadow-sm text-sm text-gray-700">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="font-semibold text-gray-900">Today: ₹{todayStats.revenue.toLocaleString("en-IN")}</span>
            <span className="text-xs text-gray-500">({todayStats.count} bills)</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 border border-gray-200 shadow-sm text-sm text-gray-600">
            <User className="h-4 w-4 text-gray-400" />
            <span>
              Cashier: <strong className="font-semibold text-gray-900">{cashierId}</strong>
            </span>
          </div>

          {/* Pending Unsynced Bills Warning */}
          {pendingCount > 0 && (
            <div
              className="flex items-center gap-1.5 rounded-lg border border-orange-400 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 shadow-sm animate-pulse"
              title="These bills are saved on this device but not yet synced to the cloud. They will sync automatically when connection is restored."
            >
              <WifiOff className="h-4 w-4 text-orange-600" />
              <span>{pendingCount} unsynced</span>
            </div>
          )}

          {/* Resume Bills (Held Bills) Counter Button */}
          <button
            onClick={() => setIsPausedDrawerOpen(true)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors shadow-sm cursor-pointer ${
              pausedBills.length > 0
                ? "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 ring-2 ring-amber-400/30 animate-pulse"
                : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            }`}
            title="View and resume held customer bills"
          >
            <Bookmark className={`h-4 w-4 ${pausedBills.length > 0 ? "text-amber-600" : "text-gray-400"}`} />
            <span>Resume Bills ({pausedBills.length})</span>
          </button>

          {/* Barcode Scanner Button */}
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
            title="Open barcode / QR scanner (F8)"
          >
            <Barcode className="h-4 w-4" />
            <span className="hidden sm:inline">Barcode Scanner</span>
          </button>
        </div>
      </header>

      {/* ================= MAIN SPLIT BILLING WORKSTATION ================= */}
      <div className="flex flex-1 min-h-0 overflow-hidden px-4 sm:px-6 lg:px-8 pb-6 gap-6">
        {/* ================= LEFT COLUMN: CUSTOMER BAR, SEARCH & PRODUCTS BILLING TABLE ================= */}
        <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
          
          {/* 1. TOP CUSTOMER INFORMATION & LOOKUP BAR (Above Product Search) */}
          <div className="p-3.5 border-b border-slate-200 bg-blue-50/40 relative z-20 shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Customer Icon & Badge */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Users className="h-4 w-4" />
                </div>
                <div className="hidden md:block">
                  <p className="text-[11px] font-bold text-slate-900 leading-tight">Customer</p>
                  <p className="text-[9.5px] text-slate-500">Select or add new</p>
                </div>
              </div>

              {/* Customer Name Input with Dynamic Search Suggestions */}
              <div className="relative flex-1" ref={customerDropdownRef}>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={customerName}
                    readOnly={Boolean(selectedCustomerId)}
                    onChange={(e) => {
                      if (selectedCustomerId) return;
                      setCustomerName(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (!selectedCustomerId) setIsCustomerDropdownOpen(true);
                    }}
                    placeholder="Search existing customer by name..."
                    className={`w-full rounded-lg border pl-9 pr-4 py-2 text-xs font-semibold shadow-2xs transition ${
                      selectedCustomerId
                        ? "bg-slate-50 border-slate-200 text-slate-800 cursor-default"
                        : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    }`}
                  />
                </div>

                {/* Existing Customer Autocomplete Dropdown */}
                {!selectedCustomerId && isCustomerDropdownOpen && filteredCustomerSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                      <span>Matching Customers ({filteredCustomerSuggestions.length})</span>
                      <span className="text-[9px] text-slate-400">Click to select</span>
                    </div>
                    {filteredCustomerSuggestions.map((cust) => (
                      <div
                        key={cust.id}
                        onClick={() => handleSelectCustomer(cust)}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between gap-2 transition text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{cust.name}</p>
                          <p className="text-[10px] text-slate-500 tabular-nums flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5 text-slate-400" />
                            {cust.phone}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md shrink-0">
                          Select
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Phone Number Input */}
              <div className="relative w-full sm:w-44 shrink-0">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="tel"
                  maxLength="14"
                  value={customerPhone}
                  readOnly={Boolean(selectedCustomerId)}
                  onChange={(e) => {
                    if (selectedCustomerId) return;
                    setCustomerPhone(e.target.value);
                    setIsCustomerDropdownOpen(true);
                  }}
                  placeholder="Phone (+91...)"
                  className={`w-full rounded-lg border pl-9 pr-3 py-2 text-xs font-semibold tabular-nums shadow-2xs transition ${
                    selectedCustomerId
                      ? "bg-slate-50 border-slate-200 text-slate-800 cursor-default"
                      : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  }`}
                />
              </div>

              {/* + Add New Customer Button (Enabled ONLY when no customer is chosen) */}
              {!customerName.trim() && !selectedCustomerId ? (
                <button
                  type="button"
                  onClick={() => {
                    setNewCustFormName("");
                    setNewCustFormPhone("+91 ");
                    setIsAddCustomerModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer shrink-0"
                  title="Add a new customer to directory"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">+ Add Customer</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Customer Linked</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Product Barcode & Search Bar */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center gap-3 shrink-0">
            <div className="relative flex-1">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none text-slate-400">
                <Barcode className="h-4 w-4 text-blue-600" />
                <Search className="h-3.5 w-3.5" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Scan product barcode or search product name / product no (F2)..."
                className="w-full rounded-lg border border-slate-300 bg-white pl-14 pr-16 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 shadow-xs transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Catalog Browse Toggle */}
            <button
              onClick={() => setShowCatalogDrawer(!showCatalogDrawer)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-bold transition cursor-pointer shrink-0 ${
                showCatalogDrawer
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Product Catalog</span>
              {showCatalogDrawer ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Collapsible Quick Product Catalog Grid */}
          {showCatalogDrawer && (
            <div className="border-b border-slate-200 bg-slate-50/60 p-3 max-h-56 overflow-y-auto shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Quick Select Products ({filteredProducts.length} items)
                </span>
                <span className="text-[10px] text-slate-400">Click card to add to billing table</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {filteredProducts.slice(0, 12).map((prod) => {
                  const rateVal =
                    typeof prod.price === "number"
                      ? prod.price
                      : parseFloat(String(prod.price || prod.rate || "0").replace(/[^0-9.-]+/g, "")) || 0;
                  return (
                    <div
                      key={prod.id}
                      onClick={() => addToCart(prod)}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-blue-500 hover:shadow-sm transition cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{prod.name}</p>
                        <p className="text-[10px] tabular-nums text-slate-400 truncate">
                          {prod.productNo || prod.hsn || "151800"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-slate-900">₹{rateVal.toFixed(2)}</p>
                        <span className="text-[10px] text-blue-600 font-bold">+ Add</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Scanned Products Billing Table */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider z-10 shadow-2xs">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 w-32 whitespace-nowrap">Product No</th>
                  <th className="py-3 px-4 min-w-[260px]">Product Name</th>
                  <th className="py-3 px-4 w-28 text-right whitespace-nowrap">Price</th>
                  <th className="py-3 px-4 w-36 text-center whitespace-nowrap">Qnty</th>
                  <th className="py-3 px-4 w-32 text-right whitespace-nowrap">Amount</th>
                  <th className="py-3 px-3 w-16 text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-3 border border-blue-100 shadow-2xs">
                          <Barcode className="h-8 w-8" />
                        </div>
                        <h4 className="text-base font-bold text-slate-800">Billing Table is Empty</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Scan product barcode with a barcode scanner gun, use Barcode Scanner, or type in the search bar above to add items to this bill.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  cart.map((item, index) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition">
                      {/* S.No */}
                      <td className="py-3.5 px-4 text-center text-slate-400 font-medium">
                        {index + 1}
                      </td>

                      {/* Product No / HSN (Plain text format in one line) */}
                      <td className="py-3.5 px-4 tabular-nums font-semibold text-slate-700 text-xs whitespace-nowrap">
                        {item.productNo || item.hsn || `PRD-${String(index + 1).padStart(3, "0")}`}
                      </td>

                      {/* Product Name (Increased width) */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex flex-col">
                          <span className="text-slate-900 text-sm font-semibold">{item.name}</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            Unit: {item.unit || "Nos"} {item.hsn && `• HSN: ${item.hsn}`}
                          </span>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-800">
                        ₹{Number(item.rate).toFixed(2)}
                      </td>

                      {/* Quantity Stepper (on right side next to Amount) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-2xs">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="h-6 w-6 flex items-center justify-center rounded bg-white text-slate-700 hover:bg-slate-200 shadow-2xs transition font-bold"
                            title="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => setDirectQuantity(item.id, e.target.value)}
                            className="w-12 text-center text-xs font-bold text-slate-900 bg-transparent focus:outline-none"
                          />
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="h-6 w-6 flex items-center justify-center rounded bg-white text-slate-700 hover:bg-slate-200 shadow-2xs transition font-bold"
                            title="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 text-sm">
                        ₹{Number(item.total).toFixed(2)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          title="Remove product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Count Bar */}
          <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600 shrink-0">
            <span>
              Total Scanned Lines: <strong>{cart.length}</strong>
            </span>
            <span>
              Total Pieces / Quantity: <strong>{cartSummary.totalQty} units</strong>
            </span>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: SUMMARY, TAXES & SETTLEMENT ================= */}
        <div
          onWheel={(e) => {
            if (summaryScrollRef.current) {
              summaryScrollRef.current.scrollTop += e.deltaY;
            }
          }}
          className="w-96 lg:w-[420px] shrink-0 flex flex-col h-full min-h-0 rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
        >
          {/* Header (Clean Header without Clear button) */}
          <div className="border-b border-gray-200 px-4 py-3.5 bg-gray-50/50 shrink-0">
            <h3 className="text-lg font-semibold text-gray-900">Billing Summary</h3>
            <p className="text-[11px] tabular-nums text-slate-500 font-semibold">Bill No: {billNumber}</p>
          </div>

          {/* Calculation Body - Smooth Native Mouse Wheel & Touch Scrolling */}
          <div
            ref={summaryScrollRef}
            className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5"
            style={{ overscrollBehavior: "contain" }}
          >
            {/* 1. Item Count & Subtotal */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Items:</span>
                <span className="font-bold text-slate-900">{cartSummary.totalItems} items</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Quantity:</span>
                <span className="font-bold text-slate-900">{cartSummary.totalQty} units</span>
              </div>
              <div className="flex justify-between text-slate-700 pt-1.5 border-t border-slate-200">
                <span className="font-semibold">Subtotal (Taxable Value):</span>
                <span className="font-bold text-slate-900">₹{cartSummary.subtotal.toFixed(2)}</span>
              </div>
            </div>

            {/* 2. Taxes Breakdown (CGST, SGST, Total GST) */}
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>CGST ({cgstRate.toFixed(2)}%):</span>
                <span className="font-semibold text-slate-800">₹{cartSummary.cgstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST ({sgstRate.toFixed(2)}%):</span>
                <span className="font-semibold text-slate-800">₹{cartSummary.sgstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-blue-900 font-bold pt-1.5 border-t border-blue-200/80">
                <span>Total GST Amount ({(cgstRate + sgstRate).toFixed(2)}%):</span>
                <span>₹{cartSummary.gstTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* 3. Prominent Net Payable Total Amount & Round-Off Indicator */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  {paymentMode === "Cash" ? "Net Payable (Cash Round-off)" : "Total Amount (Exact Decimal)"}
                </span>
                <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-medium text-white">
                  {paymentMode === "Cash" ? "Rounded" : "Exact"}
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-1 tracking-tight">
                ₹{paymentMode === "Cash" ? cartSummary.roundedTotalAmount.toFixed(2) : cartSummary.exactTotalAmount.toFixed(2)}
              </p>
              {paymentMode === "Cash" && cartSummary.exactTotalAmount > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                  <span>Exact Total: ₹{cartSummary.exactTotalAmount.toFixed(2)}</span>
                  <span>
                    Round Off: {cartSummary.roundOffDiff >= 0 ? "+" : ""}
                    ₹{cartSummary.roundOffDiff.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* 4. Payment Method Tabs: CASH vs ONLINE */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Select Payment Mode
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPaymentMode("Cash")}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    paymentMode === "Cash"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Banknote className="h-4 w-4" />
                  <span>Cash Payment</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("Online")}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    paymentMode === "Online"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Online Payment</span>
                </button>
              </div>
            </div>

            {/* 5A. CASH PAYMENT SECTION */}
            {paymentMode === "Cash" && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-3 animate-fade-in">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Amount Received from Customer (Cash)
                    </label>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder={cartSummary.roundedTotalAmount > 0 ? String(cartSummary.roundedTotalAmount) : "0"}
                      className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-4 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Quick Cash Buttons */}
                <div className="flex items-center gap-1.5">
                  {[100, 200, 500, 2000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickCash(amt)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white py-1 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition shadow-2xs cursor-pointer"
                    >
                      ₹{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleQuickCash(cartSummary.roundedTotalAmount)}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs cursor-pointer"
                  >
                    Exact
                  </button>
                </div>

                {/* Balance Returned by Cashier */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Balance Returned by Cashier:
                  </span>
                  <span
                    className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                      cartSummary.balancePaid > 0
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : cartSummary.amountDue > 0 && cart.length > 0
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-slate-200 text-slate-800"
                    }`}
                  >
                    {cartSummary.balancePaid > 0
                      ? `₹${cartSummary.balancePaid.toFixed(2)}`
                      : cartSummary.amountDue > 0 && cart.length > 0
                      ? `₹${cartSummary.amountDue.toFixed(2)} (Due)`
                      : `₹0.00`}
                  </span>
                </div>
              </div>
            )}

            {/* 5B. ONLINE PAYMENT (RAZORPAY) SECTION */}
            {paymentMode === "Online" && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">Razorpay Payment Gateway</span>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                    UPI / Card / NetBanking
                  </span>
                </div>

                <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Payable Total:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      ₹{cartSummary.exactTotalAmount.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Customer can pay exact amount including paisa (.50, .47, etc.) seamlessly via Razorpay.
                  </p>
                </div>

                {onlinePaymentDetails ? (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div className="truncate">
                      <p className="font-bold">Payment Verified</p>
                      <p className="text-[10px] tabular-nums text-emerald-700 truncate">
                        ID: {onlinePaymentDetails.paymentId}
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRazorpayPayment}
                    disabled={cart.length === 0 || isProcessingRazorpay}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-3 text-xs font-bold shadow-sm disabled:opacity-40 transition cursor-pointer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>{isProcessingRazorpay ? "Processing..." : "Pay"}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sync Status Banner */}
          {billSyncStatus === "pending" && (
            <div className="mx-4 mb-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs font-semibold text-amber-800 flex items-center justify-between shadow-xs">
              <span className="flex items-center gap-1.5">
                <WifiOff className="h-4 w-4 text-amber-600 animate-pulse" />
                Saved on this device, not yet synced
              </span>
              <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Queued</span>
            </div>
          )}
          {billSyncStatus === "saved" && (
            <div className="mx-4 mb-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 flex items-center gap-1.5 shadow-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Saved to cloud ✓</span>
            </div>
          )}
          {billSyncStatus === "failed" && (
            <div className="mx-4 mb-2 rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs font-semibold text-red-800 flex items-center gap-1.5 shadow-xs">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span>Save failed — check connection and retry</span>
            </div>
          )}

          {/* 6. Footer: Pause Bill & Generate / Print Bill */}
          <div className="p-4 border-t border-slate-200 bg-white shrink-0 flex items-center gap-3">
            {/* Pause / Hold Bill Button */}
            <button
              type="button"
              onClick={handlePauseBill}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 py-3.5 px-4 text-xs font-bold shadow-xs disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer shrink-0"
              title="Pause this bill to attend waiting customers"
            >
              <PauseCircle className="h-4 w-4 text-amber-600" />
              <span className="whitespace-nowrap">Pause Bill</span>
            </button>

            {/* Generate & Print Bill Button */}
            <button
              type="button"
              onClick={() => setIsReceiptOpen(true)}
              disabled={cart.length === 0}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-3.5 text-sm font-medium disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
            >
              <Receipt className="h-4 w-4" />
              <span>Generate & Print Bill (F9)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}

      {/* 0. Resume Customer Bills Drawer Modal */}
      {isPausedDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-amber-50/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Bookmark className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Resume Customer Bills</h3>
                  <p className="text-[11px] text-slate-500">
                    Resume any customer's bill once they return with their items
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPausedDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List of Resume Bills */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {pausedBills.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Bookmark className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-700">No Paused Bills</p>
                  <p className="text-xs text-slate-400 mt-1">
                    When a customer steps away to pick another item, click "Pause Bill" to hold their cart.
                  </p>
                </div>
              ) : (
                pausedBills.map((pb, idx) => (
                  <div
                    key={pb.id}
                    className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:bg-amber-50 hover:shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{pb.customerName}</h4>
                        <span className="text-[10px] font-semibold text-slate-400 tabular-nums bg-white px-2 py-0.5 rounded border border-slate-200">
                          {pb.savedAt}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 pl-8">
                        {pb.customerPhone && pb.customerPhone !== "-" && (
                          <span className="flex items-center gap-1 tabular-nums">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {pb.customerPhone}
                          </span>
                        )}
                        <span>•</span>
                        <span>{pb.totalItems || pb.cart?.length || 0} item(s)</span>
                        <span>•</span>
                        <span className="font-bold text-slate-900">₹{Number(pb.totalAmount || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 sm:self-center self-end pl-8 sm:pl-0">
                      <button
                        type="button"
                        onClick={(e) => handleDeletePausedBill(pb.id, e)}
                        className="p-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs transition cursor-pointer"
                        title="Delete bill"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResumeBill(pb)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                      >
                        <PlayCircle className="h-4 w-4" />
                        <span>Resume Bill</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Total Resume Bills: <strong className="font-bold text-slate-800">{pausedBills.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsPausedDrawerOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Camera QR / Barcode Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(decodedText) => {
          handleScanSuccess(decodedText);
        }}
      />

      {/* 2. D-Mart Styled Thermal Receipt Modal */}
      {isReceiptOpen && (
        <ThermalReceipt
          billData={{
            billNo: billNumber,
            billDate: currentTime,
            cashier: cashierId,
            customerName: customerName.trim() || "Walk-in Counter Customer",
            customerPhone: customerPhone.trim() || "-",
            items: cart,
            totalItems: cartSummary.totalItems,
            totalQty: cartSummary.totalQty,
            subtotal: cartSummary.subtotal,
            cgstRate: cgstRate,
            sgstRate: sgstRate,
            cgstAmount: cartSummary.cgstAmount,
            sgstAmount: cartSummary.sgstAmount,
            cessAmount: 0,
            roundOff: paymentMode === "Cash" ? cartSummary.roundOffDiff : 0,
            totalAmount: paymentMode === "Cash" ? cartSummary.roundedTotalAmount : cartSummary.exactTotalAmount,
            paymentMode: paymentMode,
            cashReceived:
              paymentMode === "Cash"
                ? parseFloat(cashReceived) || cartSummary.roundedTotalAmount
                : cartSummary.exactTotalAmount,
            balancePaid: paymentMode === "Cash" ? cartSummary.balancePaid : 0,
            onlinePaymentDetails: onlinePaymentDetails,
          }}
          companyProfile={companyProfile}
          onClose={() => {
            if (isInvoiceSaved) {
              resetForNextCustomer();
            } else {
              setIsReceiptOpen(false);
            }
          }}
          onSaveInvoice={handleSaveInvoice}
          onResetForNextCustomer={resetForNextCustomer}
          isSaved={isInvoiceSaved}
          saving={isSavingInvoice}
          syncStatus={billSyncStatus}
        />
      )}

      {/* 3. + Add New Customer Quick Modal */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add New Customer</h3>
                  <p className="text-[11px] text-slate-500">Save to store directory & link to this bill</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveNewCustomerModal} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Customer Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={newCustFormName}
                    onChange={(e) => setNewCustFormName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={newCustFormPhone}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (!val.startsWith("+91")) val = "+91 " + val.replace(/^\+91\s*/, "");
                      setNewCustFormPhone(val);
                    }}
                    placeholder="+91 98765 43210"
                    maxLength="15"
                    className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 py-2.5 text-xs font-semibold tabular-nums text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Default +91 with 10-digit mobile number</p>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingNewCustomer}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm disabled:opacity-40 transition cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{isSavingNewCustomer ? "Saving..." : "Save & Link Customer"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <AICommandBar
        ai={ai}
        shortcut={isCtrlK}
        shortcutLabel="Ctrl+K"
        customers={customers || []}
        totals={aiDraftTotals}
        onConfirm={applyAiDraft}
      />
    </div>
  );
}
