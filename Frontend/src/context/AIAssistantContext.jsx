import React, { createContext, useState, useContext, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { useInvoices, useCustomers, useProducts, useExpenses, useSettings, usePayments, useStockLevels, useChallans } from "../hooks/useFirestore";
import { useCompanyProfile } from "./CompanyProfileContext";
import { AuthContext } from "./AuthContext";
import { useToast } from "./ToastContext";
import useAICommand from "../components/ai-command/useAICommand";
import { buildInvoiceFromDraft, buildChallanFromDraft, draftTotals as computeDraftTotals, invoiceTaxSettings } from "../utils/invoiceFromDraft";
import { classify } from "../chatbot/intents.js";
import { respond, money } from "../chatbot/responses.js";
import { invoiceAfterPayment } from "../chatbot/analytics.js";
import { applyEdit, isConfirmWord, isCancelWord } from "../chatbot/edits.js";
import { renderPending } from "../chatbot/cards.js";

export const AIAssistantContext = createContext();

// The business assistant behind the chat widget. Everything runs on this
// business's own data: questions are answered by src/chatbot (rule-based,
// offline), bills go through the backend's local parser, and every change is
// shown as a preview card that must be confirmed before anything is saved.

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const todayLabel = () => new Date().toLocaleDateString("en-GB"); // DD/MM/YYYY, as the Payments page stores it
let nextId = 1;
const msg = (fields) => ({ id: nextId++, sender: "ai", timestamp: now(), ...fields });

// Messages that start something new instead of editing the open card.
const FRESH_COMMANDS = new Set([
  "create_invoice", "create_challan", "add_customer", "add_product", "add_expense", "record_payment", "mark_paid",
  "update_customer", "update_product", "deactivate_product", "navigate", "help", "greeting",
]);

export function AIAssistantProvider({ children }) {
  const { user } = useContext(AuthContext);
  const { companyProfile } = useCompanyProfile();
  const { allInvoices, addInvoice, editInvoice } = useInvoices();
  const { allCustomers, addCustomer, editCustomer } = useCustomers();
  const { allProducts, addProduct, editProduct, deactivateProduct } = useProducts({ includeInactive: true });
  const { allChallans, addChallan } = useChallans();
  const { expenses, addExpense } = useExpenses({ allYears: true });
  const { payments, addPayment, refetch: refetchPayments } = usePayments();
  const { stock } = useStockLevels();
  const { settings } = useSettings();
  const { success: toastSuccess } = useToast();

  // Chat billing: commands go to the backend's local parser (no third-party AI),
  // which matches them against this business's customers and products.
  const billAI = useAICommand({ context: "invoice", addProduct });
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  // The open bill card saves an invoice or a delivery challan.
  const [billMode, setBillMode] = useState("invoice");
  const [busyActionId, setBusyActionId] = useState(null);
  const lastTopicRef = useRef(null);

  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);
  const [isListening, setIsListening] = useState(false);

  const companyName = companyProfile?.companyName || "Kanakku Desk";

  const welcome = () =>
    msg({
      type: "welcome",
      text:
        `Hello ${user?.displayName || "there"}! 👋 I'm your **${companyName} business assistant**. I work only with your own data, so nothing is sent to an outside AI.\n\n` +
        `Ask about **sales, dues, profit, GST, expenses or stock**, or tell me to **create a bill, record a payment, or add a customer, product or expense**. I always show a preview before saving.\n\n` +
        `Say **help** to see everything I can do.`,
    });
  const [messages, setMessages] = useState(() => [welcome()]);

  const push = useCallback((m) => setMessages((prev) => [...prev, m]), []);
  const patchMessage = useCallback((id, patch) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m))), []);

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
      recognition.lang = "en-IN"; // English with Indian accent / Tanglish
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (err) {
      console.error("Voice recognition error:", err);
      setIsListening(false);
    }
  }, [isListening]);

  const data = {
    invoices: allInvoices || [],
    customers: allCustomers || [],
    products: allProducts || [],
    expenses: expenses || [],
    payments: payments || [],
    stock: stock || [],
    companyName,
  };

  // ---- bill drafts (backend local parser) ------------------------------------

  const closeDraftCard = (text) => {
    setMessages((prev) => [...prev.filter((m) => m.type !== "invoiceDraft"), ...(text ? [msg({ text })] : [])]);
  };

  const draftActive = billAI.draft.items.length > 0 || Boolean(billAI.draft.customer);

  const sendToBillParser = async (text, mode = billMode) => {
    // The parser reads challan commands like bills; drop the word so it is not taken as an item.
    const res = await billAI.submit(text.replace(/\b(delivery\s+)?(challan|dc)\b/gi, "bill"));
    if (res?.error) {
      push(msg({ text: `### ⚠️ Could not read that bill\n\n${res.error}` }));
      return true;
    }
    const touched = res && (res.draft?.items?.length > 0 || res.draft?.customer);
    if (!draftActive && (!touched || ["query", "unknown"].includes(res?.intent))) return false;
    // Say what happened: a question back ("Which item should I remove?"),
    // notes from the parser, or that the change was not understood.
    const notes = (res?.messages || []).filter(Boolean);
    if (res?.clarification) notes.push(`❓ **${res.clarification}**`);
    else if (draftActive && ["unknown", "query"].includes(res?.intent)) {
      notes.push('❓ **I did not understand that change.** Try "add 10 more", "add 2 kg sugar", "remove sugar" or "make it 15".');
    }
    setMessages((prev) => [
      ...prev.filter((m) => m.type !== "invoiceDraft"),
      msg({
        type: "invoiceDraft",
        text: [
          mode === "challan" ? "### 🚚 Delivery challan preview" : "### 🧾 Bill preview",
          `Check the customer and items, then press **${mode === "challan" ? "Create challan" : "Create invoice"}** or say "yes". Keep typing to change it, e.g. "add 10 more", "add 1 kg sugar" or "remove sugar".`,
          ...notes,
        ].join("\n"),
      }),
    ]);
    return true;
  };

  // ---- sending a message -----------------------------------------------------

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage || "").trim();
    if (!query) return;
    push({ id: nextId++, sender: "user", timestamp: now(), text: query });
    setInputMessage("");
    setIsTyping(true);
    try {
      const cls = classify(query, { customers: data.customers, products: data.products, last: lastTopicRef.current });

      if (!user?.uid && !["help", "greeting", "thanks", "gstin_check", "empty"].includes(cls.intent)) {
        push(msg({ text: "Please sign in to your business account so I can read your data." }));
        return;
      }

      // The card the user is looking at: the newest open preview (action or bill).
      const openCard = [...messages].reverse().find((m) => (m.type === "action" && m.status === "pending") || m.type === "invoiceDraft");
      const freshCommand = FRESH_COMMANDS.has(cls.intent);

      // "yes" / "save" / "no" / "cancel" answer the open card.
      if (openCard && !freshCommand && (isConfirmWord(query) || isCancelWord(query))) {
        const yes = isConfirmWord(query);
        if (openCard.type === "action") {
          if (yes) await confirmAction(openCard.id);
          else cancelAction(openCard.id);
        } else if (!yes) {
          cancelDraft();
        } else if (billAI.blockers.length || draftCustomerBlockers.length) {
          push(msg({ text: `Not yet: ${[...billAI.blockers, ...draftCustomerBlockers].join(" ")}` }));
        } else {
          await createInvoiceFromDraft();
        }
        return;
      }

      // Follow-up edits to an open preview card: "phone 98765 43210", "price 450", "make it 2000".
      if (openCard?.type === "action" && !freshCommand) {
        const edit = applyEdit(openCard.pending, query, data);
        if (edit?.error) {
          push(msg({ text: `⚠️ ${edit.error}` }));
          return;
        }
        if (edit) {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== openCard.id),
            msg({ type: "action", status: "pending", pending: edit.pending, text: `${renderPending(edit.pending, data)}\n\n✏️ Changed: ${edit.changed}` }),
          ]);
          return;
        }
      }

      // Bills and challans, and follow-ups while one is open ("add 2 kg sugar", "remove nails").
      const billFollowUp = openCard?.type === "invoiceDraft" && !freshCommand;
      if (cls.intent === "create_invoice" || cls.intent === "create_challan" || billFollowUp) {
        if (cls.intent === "create_invoice" || cls.intent === "create_challan") {
          if (draftActive) billAI.discard();
          setBillMode(cls.intent === "create_challan" ? "challan" : "invoice");
        }
        if (await sendToBillParser(query, cls.intent === "create_challan" ? "challan" : cls.intent === "create_invoice" ? "invoice" : billMode)) return;
      }

      const reply = respond(cls, data);
      if (reply.topic) lastTopicRef.current = reply.topic;
      push(
        msg({
          text: reply.text,
          stats: reply.stats,
          buttons: reply.buttons,
          navigateTo: reply.navigateTo,
          ...(reply.pending ? { type: "action", pending: reply.pending, status: "pending" } : {}),
        })
      );
    } catch (err) {
      console.error("Assistant error:", err);
      push(msg({ text: `Sorry, something went wrong: ${err.message}` }));
    } finally {
      setIsTyping(false);
    }
  };

  // ---- confirming actions ----------------------------------------------------

  const runPayment = async (p) => {
    const done = [];
    for (const line of p.lines) {
      const inv = line.invoice;
      await editInvoice(inv.id, invoiceAfterPayment(inv, line.amount, p.mode, todayLabel()));
      await addPayment({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber || "",
        customerName: p.customerName,
        clientId: inv.clientId || inv.client?.id || "",
        amount: line.amount,
        method: p.mode,
        paymentMethod: p.mode,
        transactionId: "",
        paymentDate: todayLabel(),
        status: "completed",
        notes: "Recorded from the assistant",
      });
      done.push(`• #${inv.invoiceNumber}: ${money(line.amount)}${line.clears ? " (now fully paid)" : ""}`);
    }
    refetchPayments();
    return `### ✅ Payment recorded\n\n${money(p.amount)} from **${p.customerName}** by ${p.mode}:\n${done.join("\n")}`;
  };

  const confirmAction = async (id) => {
    const m = messages.find((x) => x.id === id);
    if (!m?.pending || m.status !== "pending") return;
    const p = m.pending;
    setBusyActionId(id);
    try {
      let result;
      if (p.kind === "payment") {
        result = await runPayment(p);
      } else if (p.kind === "customer") {
        const res = await addCustomer(p.payload);
        if (!res.success) throw new Error(res.error || "Could not save the customer.");
        result = `### ✅ Customer added\n\n**${p.payload.name}** is now in your customer list. You can bill them right away.`;
      } else if (p.kind === "product") {
        const res = await addProduct(p.payload);
        if (!res?.success) throw new Error(res?.error || "Could not save the product.");
        result = `### ✅ Product added\n\n**${p.payload.name}** at ${money(p.payload.price)}${p.payload.unit ? ` per ${p.payload.unit}` : ""}.`;
      } else if (p.kind === "customer_update") {
        const res = await editCustomer(p.id, p.patch);
        if (!res?.success) throw new Error("Could not update the customer.");
        result = `### ✅ Customer updated\n\n**${p.patch.name || p.name}** has been updated.`;
      } else if (p.kind === "product_update") {
        const patch = { ...p.patch };
        // Same price history the Products page keeps.
        const oldPrice = Number(p.before?.price);
        if (patch.price !== undefined && Number.isFinite(oldPrice) && oldPrice !== patch.price) {
          patch.oldPrice = oldPrice;
          patch.priceHistory = [{ price: oldPrice, date: new Date().toISOString() }, ...(p.before?.priceHistory || [])];
        }
        const res = await editProduct(p.id, patch);
        if (!res?.success) throw new Error("Could not update the product.");
        result = `### ✅ Product updated\n\n**${p.patch.name || p.name}** has been updated${patch.price !== undefined ? ` (price ${money(patch.price)})` : ""}.`;
      } else if (p.kind === "product_deactivate") {
        const res = await deactivateProduct(p.id);
        if (!res?.success) throw new Error("Could not deactivate the product.");
        result = `### ✅ ${p.name} deactivated\n\nIt no longer appears on new bills. Reactivate it from the Products page.`;
      } else if (p.kind === "expense") {
        const res = await addExpense(p.payload);
        if (!res?.success) throw new Error("Could not save the expense.");
        result = `### ✅ Expense saved\n\n${money(p.payload.amount)} for ${p.payload.title} (${p.payload.category}).`;
      }
      patchMessage(id, { status: "done", text: result, stats: undefined });
      if (toastSuccess) toastSuccess("Saved");
    } catch (err) {
      console.error("Assistant action failed:", err);
      patchMessage(id, { status: "failed", text: `${m.text}\n\n⚠️ **Not saved**: ${err.message}` });
    } finally {
      setBusyActionId(null);
    }
  };

  const cancelAction = (id) => patchMessage(id, { status: "cancelled", text: "Cancelled. Nothing was saved." });

  // ---- bill card actions -----------------------------------------------------

  const draftTotalRows = (() => {
    if (!billAI.draft.items.some((it) => it.status === "matched" && it.qty > 0)) return null;
    const tax = invoiceTaxSettings(settings);
    const draftCustomer = (allCustomers || []).find((c) => c.id === billAI.draft.customer?.id) || null;
    const t = computeDraftTotals(billAI.draft, settings, companyProfile, draftCustomer);
    const rows = [{ label: "Taxable value", value: money(t.taxableAmount) }];
    if (tax.isGstEnabled) {
      if (t.cgstAmount) rows.push({ label: "CGST", value: money(t.cgstAmount) });
      if (t.sgstAmount) rows.push({ label: "SGST", value: money(t.sgstAmount) });
      if (t.igstAmount) rows.push({ label: "IGST", value: money(t.igstAmount) });
    }
    if (tax.isRoundOff) rows.push({ label: "Round off", value: money(t.roundOffAmount) });
    rows.push({ label: "Total", value: money(t.total), strong: true });
    return rows;
  })();

  // The chat saves the bill itself, so it needs a real customer record.
  const draftCustomerBlockers = billAI.draft.customer?.status === "matched" ? [] : ["Choose or add the customer for this bill."];

  const addCustomerFromDraft = async (name) => {
    const clean = String(name || "").trim();
    if (!clean) return;
    const res = await addCustomer({ name: clean, displayName: clean, customerType: "Business" });
    if (res.success) billAI.pickCustomer({ id: res.id, name: clean });
    else push(msg({ text: `### ⚠️ Could not add customer\n\n${res.error}` }));
  };

  const createInvoiceFromDraft = async () => {
    const customer = (allCustomers || []).find((c) => c.id === billAI.draft.customer?.id);
    if (!customer) {
      push(msg({ text: "That customer is still loading. Try again in a moment." }));
      return;
    }
    setCreatingInvoice(true);
    if (billMode === "challan") {
      const challan = buildChallanFromDraft({ draft: billAI.draft, customer, allChallans, settings, seller: companyProfile });
      const res = await addChallan(challan).catch((err) => ({ success: false, error: err.message }));
      setCreatingInvoice(false);
      if (!res?.success) {
        push(msg({ text: `### ⚠️ Challan not saved\n\n${res?.error || "Unknown error"}` }));
        return;
      }
      billAI.markConfirmed();
      const lines = challan.items.map((it) => `• ${it.description} × ${it.quantity}`);
      closeDraftCard([`### ✅ Delivery challan ${challan.challanNumber} created`, "", `**Customer**: ${customer.name || customer.companyName || customer.displayName}`, ...lines, "", `**Value**: ${money(challan.amount)}`].join("\n"));
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, buttons: [{ label: "Open Challans", to: "/challans" }] }];
      });
      if (toastSuccess) toastSuccess(`Challan ${challan.challanNumber} created`);
      return;
    }
    const invoice = buildInvoiceFromDraft({ draft: billAI.draft, customer, allInvoices, settings, seller: companyProfile });
    const res = await addInvoice(invoice);
    setCreatingInvoice(false);
    if (!res.success) {
      push(msg({ text: `### ⚠️ Invoice not saved\n\n${res.error}` }));
      return;
    }
    // Teach the matcher from this confirmed bill.
    billAI.markConfirmed();
    billAI.markSaved(res.id);
    const lines = invoice.items.map((it) => `• ${it.description} × ${it.quantity} = ${money(it.amount)}`);
    closeDraftCard(
      [`### ✅ Invoice ${invoice.invoiceNumber} created`, "", `**Customer**: ${customer.name || customer.companyName || customer.displayName}`, ...lines, "", `**Total**: ${money(invoice.amount)} (due ${invoice.dueDate})`].join("\n")
    );
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { ...last, buttons: [{ label: "Open Invoices", to: "/invoices" }] }];
    });
    if (toastSuccess) toastSuccess(`Invoice ${invoice.invoiceNumber} created`);
  };

  const cancelDraft = () => {
    billAI.discard();
    closeDraftCard("Bill cancelled. Nothing was saved.");
  };

  // ---- misc ------------------------------------------------------------------

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    if (toastSuccess) toastSuccess("Response copied to clipboard!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearChat = () => {
    if (draftActive) billAI.discard();
    lastTopicRef.current = null;
    setMessages([msg({ type: "welcome", text: "Chat cleared. Ask me anything, or say **help**." })]);
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
        confirmAction,
        cancelAction,
        busyActionId,
        billAI,
        draftTotalRows,
        draftCustomerBlockers,
        creatingInvoice,
        createInvoiceFromDraft,
        addCustomerFromDraft,
        cancelDraft,
        billMode,
        allCustomers: allCustomers || [],
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
}

AIAssistantProvider.propTypes = { children: PropTypes.node };

export function useAIAssistant() {
  return useContext(AIAssistantContext);
}
