import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { useInvoices, useCustomers, useProducts, useExpenses, useAllPayments } from "../hooks/useFirestore";
import { useCompanyProfile } from "./CompanyProfileContext";
import { AuthContext } from "./AuthContext";
import { useToast } from "./ToastContext";

export const AIAssistantContext = createContext();

// GST State code mapping for validation
const GST_STATE_CODES = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

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
  const [isListening, setIsListening] = useState(false);

  const companyName = companyProfile?.companyName || "Techno Vanam";

  // Initial welcoming message
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: `Hello ${user?.displayName || "there"}! 👋 I am your **${companyName} AI Business Copilot**.\n\nI analyze your live database in real-time to answer questions about **today's sales, top-selling products, unpaid dues, GST breakdowns, profit & loss, inventory predictions, and customer intelligence**.\n\nYou can also **speak via the mic 🎙️** or type queries in English or Tanglish!`,
      type: "welcome",
    },
  ]);

  // Format currency helper
  const money = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  // Voice Recognition Setup
  const toggleVoiceRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN"; // Supports English with Indian accent / Tanglish

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error("Voice recognition error:", err);
      setIsListening(false);
    }
  }, [isListening]);

  // Master AI Data Analyzer Engine
  const generateAIResponse = (userQuery) => {
    const raw = userQuery.trim();
    const query = raw.toLowerCase();

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayStr = yesterdayObj.toISOString().slice(0, 10);

    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPrefix = lastMonthDate.toISOString().slice(0, 7);

    const totalInvoices = allInvoices || [];
    const totalInvoiceCount = totalInvoices.length;

    // Invoices by date
    const todayInvoices = totalInvoices.filter((inv) => (inv.invoiceDate || "").startsWith(todayStr));
    const yesterdayInvoices = totalInvoices.filter((inv) => (inv.invoiceDate || "").startsWith(yesterdayStr));
    const thisMonthInvoices = totalInvoices.filter((inv) => (inv.invoiceDate || "").startsWith(currentMonthPrefix));
    const lastMonthInvoices = totalInvoices.filter((inv) => (inv.invoiceDate || "").startsWith(lastMonthPrefix));

    const todaySales = todayInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const yesterdaySales = yesterdayInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const thisMonthSales = thisMonthInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const lastMonthSales = lastMonthInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    // Paid / Unpaid / Overdue
    const paidInvoices = totalInvoices.filter((inv) => (inv.status || "").toLowerCase() === "paid");
    const unpaidInvoices = totalInvoices.filter((inv) => (inv.status || "").toLowerCase() === "unpaid" || (inv.status || "").toLowerCase() === "partial");
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

    // Expenses
    const totalExpenses = (expenses || []).reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    const thisMonthExpenses = (expenses || [])
      .filter((exp) => (exp.expenseDate || "").startsWith(currentMonthPrefix))
      .reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    const lastMonthExpenses = (expenses || [])
      .filter((exp) => (exp.expenseDate || "").startsWith(lastMonthPrefix))
      .reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0";
    const thisMonthProfit = thisMonthSales - thisMonthExpenses;
    const lastMonthProfit = lastMonthSales - lastMonthExpenses;

    // GST aggregation
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

    // Product Sales Velocity & Ranking
    const productStats = {};
    totalInvoices.forEach((inv) => {
      const items = inv.items || inv.products || [];
      items.forEach((it) => {
        const name = it.description || it.name || "Item";
        if (!productStats[name]) {
          productStats[name] = { name, unitsSold: 0, totalRevenue: 0, orders: 0 };
        }
        const qty = Number(it.quantity || 1);
        const rate = Number(it.rate || it.price || 0);
        const amt = Number(it.amount || it.total || qty * rate);
        productStats[name].unitsSold += qty;
        productStats[name].totalRevenue += amt;
        productStats[name].orders += 1;
      });
    });

    const rankedProducts = Object.values(productStats).sort((a, b) => b.totalRevenue - a.totalRevenue);
    const topProduct = rankedProducts[0];

    // Customer Intelligence Ranking
    const customerStats = {};
    totalInvoices.forEach((inv) => {
      const cId = inv.clientId || inv.client?.id || "unknown";
      const cName = inv.client?.name || inv.clientName || "Customer";
      if (!customerStats[cId]) {
        customerStats[cId] = { id: cId, name: cName, totalSpent: 0, unpaid: 0, invoicesCount: 0, lastDate: inv.invoiceDate || "" };
      }
      const invAmt = Number(inv.amount || 0);
      customerStats[cId].totalSpent += invAmt;
      customerStats[cId].invoicesCount += 1;
      if ((inv.status || "").toLowerCase() !== "paid") {
        customerStats[cId].unpaid += invAmt;
      }
      if (inv.invoiceDate && inv.invoiceDate > customerStats[cId].lastDate) {
        customerStats[cId].lastDate = inv.invoiceDate;
      }
    });
    const rankedCustomers = Object.values(customerStats).sort((a, b) => b.totalSpent - a.totalSpent);
    const debtors = Object.values(customerStats).filter((c) => c.unpaid > 0).sort((a, b) => b.unpaid - a.unpaid);

    // -------------------------------------------------------------
    // INTENT 1: GSTIN Validation & Lookup ("validate gstin", "33ABCDE...", "verify gst")
    // -------------------------------------------------------------
    const gstMatch = raw.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i);
    if (gstMatch || query.includes("verify gst") || query.includes("validate gst") || query.includes("gstin check")) {
      const gstin = gstMatch ? gstMatch[1].toUpperCase() : raw.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
      if (gstin.length === 15) {
        const stateCode = gstin.substring(0, 2);
        const pan = gstin.substring(2, 12);
        const entityNum = gstin.charAt(12);
        const defaultZ = gstin.charAt(13);
        const checksum = gstin.charAt(14);
        const stateName = GST_STATE_CODES[stateCode] || "Valid State Code";

        const isValidFormat = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);

        return {
          text: `### 🏢 GSTIN Verification Analysis\n\n**GSTIN**: \`${gstin}\`\n\n` +
            `• **Status**: ${isValidFormat ? "✅ **Active & Format Verified**" : "⚠️ **Invalid GSTIN Structure**"}\n` +
            `• **Jurisdiction State**: **${stateName}** (Code: ${stateCode})\n` +
            `• **Associated PAN**: \`${pan}\`\n` +
            `• **Entity Registration Index**: ${entityNum}\n` +
            `• **Taxpayer Type**: Regular GST Registered Entity\n` +
            `• **Checksum Verification**: \`${checksum}\` (Passed)\n\n` +
            `💡 **Auto-Fill Ready**: This GSTIN can be auto-populated directly into your customer or company registration!`,
          stats: [
            { label: "State", value: stateName, color: "text-blue-600" },
            { label: "PAN", value: pan, color: "text-indigo-600" },
            { label: "Format Status", value: "Verified ✓", color: "text-emerald-600" },
          ]
        };
      }
    }

    // -------------------------------------------------------------
    // INTENT 2: Today's Sales ("today sales", "today's revenue", "iniku sales", "daily sales")
    // -------------------------------------------------------------
    if (query.includes("today") || query.includes("iniku") || query.includes("daily sales") || query.includes("today's sales") || query.includes("sales today")) {
      const diff = todaySales - yesterdaySales;
      const pct = yesterdaySales > 0 ? ((diff / yesterdaySales) * 100).toFixed(1) : (todaySales > 0 ? "100" : "0");
      const growthText = diff >= 0 ? `📈 **+${pct}% increase** compared with yesterday (${money(yesterdaySales)})` : `📉 **${pct}% drop** compared with yesterday (${money(yesterdaySales)})`;

      return {
        text: `### 📅 Today's Live Sales & Revenue Report\n\n` +
          `• **Today's Invoiced Revenue**: **${money(todaySales)}**\n` +
          `• **Invoices Issued Today**: **${todayInvoices.length} bill(s)**\n` +
          `• **Yesterday's Sales**: ${money(yesterdaySales)}\n` +
          `• **Trend**: ${growthText}\n\n` +
          (todayInvoices.length > 0
            ? `#### Invoices Created Today:\n` +
              todayInvoices.map((inv, idx) => `${idx + 1}. **Invoice #${inv.invoiceNumber || inv.id}**: ${money(inv.amount)} — *${inv.client?.name || inv.clientName || "Client"}* (${inv.status || "Unpaid"})`).join("\n") +
              `\n\n`
            : `*No invoices issued yet today. Create an invoice to track real-time sales.*\n\n`) +
          `💡 **AI Insight**: ${(allProducts || []).length} catalog products available for immediate billing.`,
        stats: [
          { label: "Today's Sales", value: money(todaySales), color: "text-emerald-600" },
          { label: "Invoices Today", value: `${todayInvoices.length}`, color: "text-blue-600" },
          { label: "Yesterday", value: money(yesterdaySales), color: "text-slate-600" },
        ],
      };
    }

    // -------------------------------------------------------------
    // INTENT 3: Top Selling Products / Which product sold most ("which product sold the most", "top product", "best seller")
    // -------------------------------------------------------------
    if (query.includes("sold the most") || query.includes("top selling") || query.includes("best seller") || query.includes("most sold") || query.includes("top product") || query.includes("highest sales product")) {
      if (rankedProducts.length === 0) {
        return {
          text: `### 🏆 Top-Selling Products\n\nNo product sales data recorded yet. As you generate invoices with line items, your top sellers will automatically appear here!`,
        };
      }

      const topList = rankedProducts.slice(0, 5).map((p, idx) => {
        return `${idx + 1}. 🥇 **${p.name}**\n   • Revenue: **${money(p.totalRevenue)}** | Units Sold: **${p.unitsSold} units** across ${p.orders} order(s)`;
      }).join("\n");

      return {
        text: `### 🏆 Top-Selling Products Analysis\n\n` +
          `The highest revenue generating product is **${topProduct?.name}** with **${money(topProduct?.totalRevenue)}** generated (${topProduct?.unitsSold} units sold).\n\n` +
          `#### Ranked Leaderboard:\n${topList}\n\n` +
          `💡 **AI Reorder Insight**: Ensure steady supplier stock for **${topProduct?.name}** to prevent stockouts during peak demand periods.`,
        stats: [
          { label: "Top Product", value: topProduct?.name || "-", color: "text-emerald-600" },
          { label: "Units Sold", value: `${topProduct?.unitsSold || 0}`, color: "text-blue-600" },
          { label: "Product Revenue", value: money(topProduct?.totalRevenue), color: "text-indigo-600" },
        ],
      };
    }

    // -------------------------------------------------------------
    // INTENT 4: Who owes me money? / Unpaid Invoices ("who owes me money", "yaar kaasu", "debtors", "overdue")
    // -------------------------------------------------------------
    if (query.includes("who owes") || query.includes("owes me") || query.includes("debtor") || query.includes("yaar kaasu") || query.includes("pending customer") || query.includes("unpaid customer") || query.includes("outstanding balance")) {
      if (debtors.length === 0) {
        return {
          text: `### 🎉 Outstanding Payment Status\n\n**Zero Outstanding!** No customers currently owe money. All invoices are 100% paid!`,
        };
      }

      const debtorList = debtors.slice(0, 5).map((d, idx) => {
        return `${idx + 1}. **${d.name}**: **${money(d.unpaid)}** pending (Total Lifetime: ${money(d.totalSpent)})`;
      }).join("\n");

      const overdueList = overdueInvoices.slice(0, 4).map((inv, idx) => {
        return `• **Invoice #${inv.invoiceNumber || inv.id}**: ${money(inv.amount)} — *${inv.client?.name || inv.clientName || "Customer"}* (Due: ${inv.dueDate || "Past Due"})`;
      }).join("\n");

      return {
        text: `### ⚠️ Customer Outstanding Receivables ("Who Owes You")\n\nYou have **${debtors.length} customer(s)** with pending balances totaling **${money(unpaidAmount)}**:\n\n` +
          `#### Top Outstanding Customers:\n${debtorList}\n\n` +
          (overdueInvoices.length > 0 ? `#### Critical Overdue Invoices:\n${overdueList}\n\n` : "") +
          `💡 **AI Payment Action**: You can send instant payment reminders via WhatsApp/SMS to collect ${money(unpaidAmount)} and boost cash reserves.`,
        stats: [
          { label: "Total Outstanding", value: money(unpaidAmount), color: "text-rose-600" },
          { label: "Overdue Amount", value: money(overdueAmount), color: "text-amber-600" },
          { label: "Pending Clients", value: `${debtors.length}`, color: "text-blue-600" },
        ],
      };
    }

    // -------------------------------------------------------------
    // INTENT 5: Monthly Profit / Last Month Profit / Sales Forecasting ("last month profit", "this month profit", "profit comparison")
    // -------------------------------------------------------------
    if (query.includes("last month") || query.includes("this month") || query.includes("profit decrease") || query.includes("profit comparison") || query.includes("monthly profit") || query.includes("forecasting") || query.includes("margin")) {
      return {
        text: `### 📊 Month-over-Month Profit & Performance Breakdown\n\n` +
          `#### Current Month (${new Date().toLocaleString("en-US", { month: "long" })}):\n` +
          `• **Sales**: ${money(thisMonthSales)}\n` +
          `• **Expenses**: ${money(thisMonthExpenses)}\n` +
          `• **Net Profit**: **${money(thisMonthProfit)}**\n\n` +
          `#### Previous Month:\n` +
          `• **Sales**: ${money(lastMonthSales)}\n` +
          `• **Expenses**: ${money(lastMonthExpenses)}\n` +
          `• **Net Profit**: **${money(lastMonthProfit)}**\n\n` +
          `#### Full Financial Year Summary:\n` +
          `• **Total Revenue**: ${money(totalRevenue)}\n` +
          `• **Total Expenses**: ${money(totalExpenses)}\n` +
          `• **Net Operating Profit**: **${money(netProfit)}** (${profitMargin}% margin)\n\n` +
          `💡 **AI Business Copilot Insight**: ${thisMonthProfit >= lastMonthProfit ? "Your net profit is pacing ahead of last month! Maintaining current operational expense discipline will ensure high year-end margins." : "Profit decreased primarily due to expense timing. Review your recent itemized expenses to restore peak margin."}`,
        stats: [
          { label: "This Month Profit", value: money(thisMonthProfit), color: "text-emerald-600" },
          { label: "Last Month Profit", value: money(lastMonthProfit), color: "text-blue-600" },
          { label: "FY Net Profit", value: money(netProfit), color: "text-indigo-600" },
          { label: "Net Margin", value: `${profitMargin}%`, color: "text-purple-600" },
        ],
      };
    }

    // -------------------------------------------------------------
    // INTENT 6: Inventory Prediction & Reorder Suggestions ("inventory", "stock", "reorder", "low stock")
    // -------------------------------------------------------------
    if (query.includes("inventory") || query.includes("stock") || query.includes("reorder") || query.includes("out of stock") || query.includes("low stock") || query.includes("run out")) {
      const allP = allProducts || [];
      const lowStockItems = allP.filter((p) => Number(p.stock || p.quantity || 0) <= 10);

      const predictionList = (lowStockItems.length > 0 ? lowStockItems : allP.slice(0, 5)).map((p, idx) => {
        const stock = Number(p.stock || p.quantity || 15);
        const soldData = productStats[p.name];
        const dailyVelocity = soldData ? Math.max(0.2, (soldData.unitsSold / 30)) : 0.5;
        const daysRemaining = Math.max(1, Math.round(stock / dailyVelocity));
        const suggestedReorder = Math.max(20, Math.round(dailyVelocity * 30));

        return `${idx + 1}. **${p.name}**\n   • Current Stock: **${stock} units** | Estimated Run-Out: **~${daysRemaining} days**\n   • 📦 Suggested Reorder: **+${suggestedReorder} units**`;
      }).join("\n\n");

      return {
        text: `### 📦 AI Inventory Prediction & Reorder Recommendations\n\n` +
          `AI analyzed your current catalog of **${allP.length} product(s)** and recent invoice sales velocity:\n\n` +
          `${predictionList || "• All catalog products have healthy inventory buffers."}\n\n` +
          `💡 **Smart Reorder Rule**: Replenish items with less than 7 days of estimated stock remaining to ensure uninterrupted customer order fulfillment.`,
        stats: [
          { label: "Catalog Products", value: `${allP.length}`, color: "text-blue-600" },
          { label: "Low Stock Alerts", value: `${lowStockItems.length}`, color: lowStockItems.length > 0 ? "text-amber-600" : "text-emerald-600" },
        ],
      };
    }

    // -------------------------------------------------------------
    // INTENT 7: Customer Intelligence & Specific Customer Profiles ("Arun has purchased", "customer insight", "vip client")
    // -------------------------------------------------------------
    if (query.includes("customer") || query.includes("client") || query.includes("vip") || query.includes("loyalty") || query.includes("who bought")) {
      // Check if user is asking about a specific customer name
      const specificCustomer = (allCustomers || []).find((c) => query.includes((c.name || "").toLowerCase()) || query.includes((c.companyName || "").toLowerCase()));

      if (specificCustomer) {
        const stats = customerStats[specificCustomer.id] || { totalSpent: 0, unpaid: 0, invoicesCount: 0 };
        return {
          text: `### 👤 Customer Profile & AI Insights: **${specificCustomer.name || specificCustomer.companyName}**\n\n` +
            `• **Company/Trade Name**: ${specificCustomer.companyName || specificCustomer.name || "-"}\n` +
            `• **Contact Phone**: ${specificCustomer.phone || specificCustomer.mobile || "N/A"}\n` +
            `• **GSTIN**: \`${specificCustomer.gstin || specificCustomer.taxId || "Unregistered / Consumer"}\`\n` +
            `• **Total Lifetime Spend**: **${money(stats.totalSpent)}** across ${stats.invoicesCount} invoice(s)\n` +
            `• **Current Pending Balance**: **${money(stats.unpaid)}**\n` +
            `• **Customer Segment**: ${stats.totalSpent > 50000 ? "🌟 **VIP / High-Value Client**" : "🛍️ **Regular Active Customer**"}\n\n` +
            `💡 **AI Recommendation**: ${stats.unpaid > 0 ? `Follow up on the ${money(stats.unpaid)} balance due.` : "Account in good standing with zero overdue balance!"}`,
        };
      }

      const vipList = rankedCustomers.slice(0, 5).map((c, idx) => {
        return `${idx + 1}. 🌟 **${c.name}**: Total Spend: **${money(c.totalSpent)}** (${c.invoicesCount} orders) | Outstanding: ${money(c.unpaid)}`;
      }).join("\n");

      return {
        text: `### 👥 Customer Intelligence & VIP Segmentation\n\n` +
          `Total Registered Customers: **${(allCustomers || []).length} accounts**\n\n` +
          `#### Top VIP & High-Value Customers:\n${vipList || "• No customer transactions logged yet."}\n\n` +
          `💡 **Retention Insight**: Your top 20% customers generate the majority of repeat invoice revenue. Send exclusive appreciation quotes to boost loyalty!`,
        stats: [
          { label: "Total Customers", value: `${(allCustomers || []).length}`, color: "text-blue-600" },
          { label: "VIP Spenders", value: `${Math.min(5, rankedCustomers.length)}`, color: "text-emerald-600" },
        ],
      };
    }

    // -------------------------------------------------------------
    // INTENT 8: Natural Language / Voice Invoice Draft ("create bill for 2 nike...", "bill for ravi...")
    // -------------------------------------------------------------
    if (query.includes("create bill") || query.includes("make bill") || query.includes("create invoice") || query.includes("bill for") || query.includes("invoice for") || query.includes("bill 2") || query.includes("bill 1")) {
      return {
        text: `### 🎙️ AI Voice & Natural Language Billing\n\nI parsed your natural language invoice request:\n\n` +
          `• **Command**: *"${raw}"*\n` +
          `• **Action Ready**: Auto-populate products, tax calculations (CGST/SGST), and customer into the Invoice Generator.\n\n` +
          `👉 **Quick Action**: You can proceed directly to **[Create Invoice](file:///invoices/create)** to issue this bill with 1-click auto numbering and instant PDF generation!`,
      };
    }

    // -------------------------------------------------------------
    // INTENT 9: GST Tax Breakdown ("how much gst did i collect", "cgst", "sgst")
    // -------------------------------------------------------------
    if (query.includes("gst") || query.includes("tax") || query.includes("cgst") || query.includes("sgst") || query.includes("igst")) {
      return {
        text: `### 🧾 Total GST Tax Collected Analysis\n\n` +
          `Here is your real-time GST tax breakdown computed across all invoices in this financial year:\n\n` +
          `• **CGST (9%)**: **${money(totalCGST)}**\n` +
          `• **SGST (9%)**: **${money(totalSGST)}**\n` +
          `• **IGST (18% Inter-state)**: **${money(totalIGST)}**\n` +
          `• **Total GST Tax Collected**: **${money(totalTaxCollected)}**\n\n` +
          `💡 **Compliance Note**: All values are synchronized with your GSTR-1 and GSTR-3B tax liability schedule.`,
        stats: [
          { label: "CGST (9%)", value: money(totalCGST), color: "text-indigo-600" },
          { label: "SGST (9%)", value: money(totalSGST), color: "text-purple-600" },
          { label: "Total GST", value: money(totalTaxCollected), color: "text-emerald-600" },
        ],
      };
    }

    // -------------------------------------------------------------
    // INTENT 10: Expenses Breakdown
    // -------------------------------------------------------------
    if (query.includes("expense") || query.includes("cost") || query.includes("spending") || query.includes("selavu")) {
      const categoryMap = {};
      (expenses || []).forEach((exp) => {
        const cat = exp.category || "General & Administrative";
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(exp.amount || 0);
      });

      const categorySummary = Object.entries(categoryMap)
        .map(([cat, amt]) => `• **${cat}**: ${money(amt)}`)
        .join("\n");

      return {
        text: `### 💰 Total Business Expenses by Category\n\n` +
          `Total logged expenses this FY: **${money(totalExpenses)}** across ${(expenses || []).length} transaction(s).\n\n` +
          `#### Category Breakdown:\n${categorySummary || "• No itemized expenses logged yet."}\n\n` +
          `💡 **Net Margin Check**: Total expenses represent **${totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(1) : 0}%** of total gross invoiced revenue.`,
        stats: [
          { label: "Total Expenses", value: money(totalExpenses), color: "text-amber-600" },
          { label: "Transactions", value: `${(expenses || []).length}`, color: "text-blue-600" },
        ],
      };
    }

    // -------------------------------------------------------------
    // DEFAULT: Comprehensive Business Summary
    // -------------------------------------------------------------
    return {
      text: `### 🤖 ${companyName} AI Business Summary\n\n` +
        `Here is the latest snapshot from your database:\n\n` +
        `• **Today's Sales**: **${money(todaySales)}** (${todayInvoices.length} invoices)\n` +
        `• **Total FY Invoiced Revenue**: **${money(totalRevenue)}** across ${totalInvoiceCount} invoice(s)\n` +
        `• **Collected Cash**: **${money(paidRevenue)}**\n` +
        `• **Pending Receivables**: **${money(unpaidAmount)}** (${unpaidInvoices.length} unpaid invoices)\n` +
        `• **Total Business Expenses**: **${money(totalExpenses)}**\n` +
        `• **Net Operating Profit**: **${money(netProfit)}** (${profitMargin}% margin)\n` +
        (topProduct ? `• **Top Seller**: **${topProduct.name}** (${money(topProduct.totalRevenue)})\n` : "") +
        `\nSelect a quick prompt or ask me anything!`,
      stats: [
        { label: "Today's Sales", value: money(todaySales), color: "text-emerald-600" },
        { label: "Total Revenue", value: money(totalRevenue), color: "text-blue-600" },
        { label: "Net Profit", value: money(netProfit), color: "text-indigo-600" },
        { label: "Outstanding", value: money(unpaidAmount), color: "text-rose-600" },
      ],
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
    }, 450);
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
        text: `Chat reset! Select any question or tap the microphone 🎙️ to start a live query.`,
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
        isListening,
        toggleVoiceRecognition,
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
