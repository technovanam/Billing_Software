import React, { createContext, useState, useContext } from "react";
import { useInvoices, useCustomers, useProducts, useExpenses, useAllPayments } from "../hooks/useFirestore";
import { useCompanyProfile } from "./CompanyProfileContext";
import { AuthContext } from "./AuthContext";
import { useToast } from "./ToastContext";

export const AIAssistantContext = createContext();

export function AIAssistantProvider({ children }) {
  const { user } = useContext(AuthContext);
  const { companyProfile } = useCompanyProfile();
  const { allInvoices } = useInvoices();
  const { allCustomers } = useCustomers();
  const { allProducts } = useProducts();
  const { expenses } = useExpenses();
  const { payments } = useAllPayments();
  const { success: toastSuccess } = useToast();

  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);

  const companyName = companyProfile?.companyName || "Techno Vanam";

  // Initial welcoming message
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: `Hello ${user?.displayName || "there"}! 👋 I am your **${companyName} AI Assistant**.\n\nI can analyze your live invoices, revenue, customer payments, GST taxes, and business expenses in real-time.\n\nSelect any question below or type your query!`,
      type: "welcome",
    },
  ]);

  // Data Analyzer Logic
  const generateAIResponse = (userQuery) => {
    const query = userQuery.toLowerCase();

    // 1. Calculate live metrics
    const totalInvoices = allInvoices || [];
    const totalInvoiceCount = totalInvoices.length;

    const paidInvoices = totalInvoices.filter((inv) => (inv.status || "").toLowerCase() === "paid");
    const unpaidInvoices = totalInvoices.filter((inv) => (inv.status || "").toLowerCase() === "unpaid");
    const overdueInvoices = totalInvoices.filter((inv) => {
      const status = (inv.status || "").toLowerCase();
      if (status === "paid") return false;
      if (!inv.dueDate) return false;
      const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today > due;
    });

    const totalRevenue = totalInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const paidRevenue = paidInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    const totalExpenses = (expenses || []).reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    // GST calculation
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    totalInvoices.forEach((inv) => {
      const itemsArray = inv.items || inv.products || [];
      const subtotal = itemsArray.reduce((sum, item) => sum + Number(item.amount || item.total || (item.quantity * item.rate) || 0), 0);
      totalCGST += (subtotal * (inv.cgst || 0)) / 100;
      totalSGST += (subtotal * (inv.sgst || 0)) / 100;
      totalIGST += (subtotal * (inv.igst || 0)) / 100;
    });
    const totalTaxCollected = totalCGST + totalSGST + totalIGST;

    // 2. Query Matching Logic

    // Q1 / Financial Health / Profit / Revenue
    if (query.includes("financial") || query.includes("health") || query.includes("profit") || query.includes("revenue") || query.includes("summary") || query.includes("overview")) {
      return {
        text: `### 📊 Financial Health & Profit Analysis for ${companyName}\n\nHere is your real-time financial report for the current financial year:\n\n` +
          `• **Total Invoiced Revenue**: ₹${totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
          `• **Collected Payments**: ₹${paidRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
          `• **Total Expenses Logged**: ₹${totalExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
          `• **Net Profit**: ₹${netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (${profitMargin}% net margin)\n` +
          `• **Total Invoices Generated**: ${totalInvoiceCount}\n\n` +
          `💡 **AI Financial Insight**: Your net profit margin is sitting at **${profitMargin}%**. ${unpaidAmount > 0 ? `Collecting ₹${unpaidAmount.toLocaleString("en-IN")} in pending receivables will boost your cash reserves.` : "All invoices are fully settled!"}`,
        stats: [
          { label: "Total Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, color: "text-emerald-600" },
          { label: "Total Expenses", value: `₹${totalExpenses.toLocaleString("en-IN")}`, color: "text-amber-600" },
          { label: "Net Profit", value: `₹${netProfit.toLocaleString("en-IN")}`, color: "text-blue-600" },
          { label: "Unpaid Balance", value: `₹${unpaidAmount.toLocaleString("en-IN")}`, color: "text-rose-600" },
        ]
      };
    }

    // Q2 / Unpaid / Overdue / Pending Invoices
    if (query.includes("unpaid") || query.includes("overdue") || query.includes("pending") || query.includes("due")) {
      if (unpaidInvoices.length === 0 && overdueInvoices.length === 0) {
        return {
          text: `### 🎉 Outstanding Payment Status\n\nGreat news! You currently have **0 unpaid or overdue invoices**. All client invoices have been fully paid!`,
        };
      }

      let detailsList = unpaidInvoices.slice(0, 5).map((inv, idx) => {
        const clientName = inv.client?.name || inv.clientName || "Client";
        return `${idx + 1}. **Invoice #${inv.invoiceNumber || inv.id}**: ₹${Number(inv.amount || 0).toLocaleString("en-IN")} — *Customer: ${clientName}* (Due: ${inv.dueDate || "N/A"})`;
      }).join("\n");

      return {
        text: `### ⚠️ Unpaid & Overdue Invoices Breakdown\n\nYou currently have **${unpaidInvoices.length} unpaid invoice(s)** totaling **₹${unpaidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
          `• **Unpaid Invoices Count**: ${unpaidInvoices.length} (₹${unpaidAmount.toLocaleString("en-IN")})\n` +
          `• **Overdue Invoices Count**: ${overdueInvoices.length} (₹${overdueAmount.toLocaleString("en-IN")})\n\n` +
          `#### Pending Invoice Details:\n${detailsList}\n\n` +
          `💡 **Action Recommended**: Follow up with pending customers to expedite invoice settlement.`,
      };
    }

    // Q3 / GST / Tax / CGST / SGST / IGST
    if (query.includes("gst") || query.includes("tax") || query.includes("cgst") || query.includes("sgst") || query.includes("igst")) {
      return {
        text: `### 🧾 Total GST Tax Collected\n\nHere is your live GST tax breakdown collected across all generated invoices for this financial year:\n\n` +
          `• **CGST (9%) Collected**: ₹${totalCGST.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
          `• **SGST (9%) Collected**: ₹${totalSGST.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
          `• **IGST Collected**: ₹${totalIGST.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
          `• **Total GST Collected**: ₹${totalTaxCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n\n` +
          `💡 **Tax Note**: Cross-verify these tax totals with your monthly GSTR-1 & GSTR-3B filings.`,
        stats: [
          { label: "CGST (9%)", value: `₹${totalCGST.toLocaleString("en-IN")}`, color: "text-indigo-600" },
          { label: "SGST (9%)", value: `₹${totalSGST.toLocaleString("en-IN")}`, color: "text-purple-600" },
          { label: "Total Tax", value: `₹${totalTaxCollected.toLocaleString("en-IN")}`, color: "text-emerald-600" },
        ]
      };
    }

    // Q4 / Expenses / Spending / Category
    if (query.includes("expense") || query.includes("cost") || query.includes("spending") || query.includes("spend")) {
      const expenseCount = (expenses || []).length;
      const categoryMap = {};
      (expenses || []).forEach((exp) => {
        const cat = exp.category || "General";
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(exp.amount || 0);
      });

      const categorySummary = Object.entries(categoryMap)
        .map(([cat, amt]) => `• **${cat}**: ₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`)
        .join("\n");

      return {
        text: `### 💰 Total Business Expenses by Category\n\nTotal business expenses recorded this financial year: **₹${totalExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}** across ${expenseCount} transaction(s).\n\n` +
          `#### Category Breakdown:\n${categorySummary || "• No itemized expenses logged yet."}\n\n` +
          `💡 **AI Advice**: Monitor category expenses monthly to optimize operational expenditure.`,
      };
    }

    // Q5 / Products & Customers
    if (query.includes("product") || query.includes("item") || query.includes("customer") || query.includes("client")) {
      const productCount = (allProducts || []).length;
      const customerCount = (allCustomers || []).length;

      const productList = (allProducts || []).slice(0, 5).map((p, i) => `${i + 1}. **${p.name}** — ₹${Number(p.price || 0).toLocaleString("en-IN")}`).join("\n");
      const customerList = (allCustomers || []).slice(0, 5).map((c, i) => `${i + 1}. **${c.name}** (${c.phone || c.email || "Registered"})`).join("\n");

      return {
        text: `### 📦 Products & Customer Overview\n\n` +
          `• **Registered Customers**: ${customerCount} active clients\n` +
          `• **Catalog Products/Services**: ${productCount} items\n\n` +
          (productList ? `#### Top Products:\n${productList}\n\n` : "") +
          (customerList ? `#### Featured Customers:\n${customerList}\n\n` : "") +
          `💡 **Growth Insight**: Maintaining prompt invoicing for active customers ensures recurring revenue.`,
      };
    }

    // Default Response
    return {
      text: `### 🤖 AI Business Assistant\n\nBased on your query regarding "${userQuery}":\n\n` +
        `• **Active Invoices**: ${totalInvoiceCount} generated\n` +
        `• **Gross Invoiced Revenue**: ₹${totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
        `• **Paid Receipts**: ₹${paidRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
        `• **Logged Expenses**: ₹${totalExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n\n` +
        `Select any option above or type a query!`,
    };
  };

  const handleSendMessage = (textToSend) => {
    const query = textToSend || inputMessage;
    if (!query || !query.trim()) return;

    const userMsg = {
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: query.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsTyping(true);

    setTimeout(() => {
      const aiResponseData = generateAIResponse(query);
      const aiMsg = {
        sender: "ai",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: aiResponseData.text,
        stats: aiResponseData.stats,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 500);
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    if (toastSuccess) toastSuccess("Response copied to clipboard!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([
      {
        sender: "ai",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `Chat reset! Select any question below to start an instant analysis.`,
        type: "welcome",
      },
    ]);
  };

  return (
    <AIAssistantContext.Provider
      value={{
        messages,
        isTyping,
        inputMessage,
        setInputMessage,
        copiedIndex,
        showQuickQuestions,
        setShowQuickQuestions,
        handleSendMessage,
        handleCopy,
        handleClearChat,
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
}

export function useAIAssistant() {
  return useContext(AIAssistantContext);
}
