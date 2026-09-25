// State for one AI draft conversation on the invoice or POS page: send commands,
// resolve ambiguous matches, and record what the user corrected.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseCommand, saveProductAlias, updateAiLogs } from "../../services/aiCommandService";

const emptyDraft = () => ({ customer: null, items: [], dueInDays: null, payment: null, notes: null });
const newSessionId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const normalize = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function lineTotalPaise(product, qty) {
  return product && qty > 0 ? Math.round(product.pricePaise * qty) : null;
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export default function useAICommand({ context, addProduct }) {
  const isOnline = useOnlineStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [clarification, setClarification] = useState(null);
  const [messages, setMessages] = useState([]);
  const [logIds, setLogIds] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [aliasNotice, setAliasNotice] = useState(null);
  const sessionIdRef = useRef(newSessionId());
  // Logs of a confirmed draft, waiting for the invoice ID once the bill is saved.
  const pendingLogIdsRef = useRef([]);

  const record = useCallback((correction) => setCorrections((prev) => [...prev, correction].slice(-100)), []);

  const submit = useCallback(
    async (commandText) => {
      const value = (commandText ?? text).trim();
      if (!value || loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await parseCommand({ text: value, context, currentDraft: draft, sessionId: sessionIdRef.current });
        setDraft(res.draft || emptyDraft());
        setClarification(res.clarification || null);
        setMessages(res.messages || []);
        if (res.logId) setLogIds((prev) => [...prev, res.logId]);
        setText("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [text, loading, context, draft]
  );

  // Every pick is a learning signal; the backend also saves it as an alias
  // when the spoken name differs from the product name.
  const saveAlias = useCallback(
    async (spokenName, product) => {
      if (!spokenName) return;
      const customerId = draft.customer?.status === "matched" ? draft.customer.id : null;
      try {
        const res = await saveProductAlias({ productId: product.id, alias: spokenName, source: context, commandLogId: logIds[logIds.length - 1] || null, customerId });
        if (res?.aliasSaved) setAliasNotice(`Next time "${spokenName}" will match ${product.name}.`);
      } catch (err) {
        if (normalize(spokenName) !== normalize(product.name)) setAliasNotice(`Could not remember "${spokenName}": ${err.message}`);
      }
    },
    [context, logIds, draft.customer]
  );

  const updateItem = useCallback((key, patch) => {
    setDraft((prev) => ({ ...prev, items: prev.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }));
  }, []);

  const pickProduct = useCallback(
    (key, candidate) => {
      const item = draft.items.find((it) => it.key === key);
      if (!item || !candidate) return;
      const product = { id: candidate.id, name: candidate.name, brand: candidate.brand, unit: candidate.unit, unitLabel: candidate.unitLabel, hsn: candidate.hsn, pricePaise: candidate.pricePaise };
      updateItem(key, { status: "matched", source: "user", product, lineTotalPaise: lineTotalPaise(product, item.qty) });
      record({ type: "pick_product", itemKey: key, spokenName: item.spokenName, from: item.status, to: candidate.id });
      saveAlias(item.spokenName, product);
    },
    [draft.items, updateItem, record, saveAlias]
  );

  const createProduct = useCallback(
    async (key, { name, priceRupees, hsn, unit }) => {
      const item = draft.items.find((it) => it.key === key);
      if (!item) return { success: false };
      const price = Number(priceRupees) || 0;
      const res = await addProduct({ name: name.trim(), price, hsn: hsn || "", unit: unit || "" });
      if (!res?.success || !res.id) return { success: false };
      const product = { id: res.id, name: name.trim(), brand: "", unit: null, unitLabel: unit || "", hsn: hsn || "", pricePaise: Math.round(price * 100) };
      updateItem(key, { status: "matched", source: "created", product, candidates: [], lineTotalPaise: lineTotalPaise(product, item.qty) });
      record({ type: "create_product", itemKey: key, spokenName: item.spokenName, from: item.status, to: res.id });
      saveAlias(item.spokenName, product);
      return { success: true };
    },
    [draft.items, addProduct, updateItem, record, saveAlias]
  );

  const setItemQty = useCallback(
    (key, qty) => {
      const item = draft.items.find((it) => it.key === key);
      const value = Number(qty);
      if (!item || !(value > 0)) return;
      updateItem(key, { qty: value, lineTotalPaise: lineTotalPaise(item.product, value) });
      record({ type: "change_qty", itemKey: key, spokenName: item.spokenName, from: item.qty, to: value });
    },
    [draft.items, updateItem, record]
  );

  const removeItem = useCallback(
    (key) => {
      const item = draft.items.find((it) => it.key === key);
      setDraft((prev) => ({ ...prev, items: prev.items.filter((it) => it.key !== key) }));
      if (item) record({ type: "remove_item", itemKey: key, spokenName: item.spokenName, from: item.product?.id || null });
    },
    [draft.items, record]
  );

  const pickCustomer = useCallback(
    (customer) => {
      const before = draft.customer;
      record({ type: "pick_customer", spokenName: before?.spokenName || null, from: before?.status || null, to: customer?.id || null });
      const next = customer
        ? { spokenName: before?.spokenName || customer.name, status: "matched", id: customer.id, name: customer.name, candidates: [] }
        : null;
      setDraft((prev) => ({ ...prev, customer: next }));
    },
    [draft.customer, record]
  );

  const clearSession = useCallback(() => {
    setDraft(emptyDraft());
    setClarification(null);
    setMessages([]);
    setLogIds([]);
    setCorrections([]);
    setError(null);
    setAliasNotice(null);
    sessionIdRef.current = newSessionId();
  }, []);

  const discard = useCallback(() => {
    if (logIds.length) updateAiLogs({ context, logIds, corrections, status: "discarded" }).catch(() => {});
    clearSession();
  }, [context, logIds, corrections, clearSession]);

  // Call after the draft has been copied into the page form.
  const markConfirmed = useCallback(() => {
    if (logIds.length) {
      pendingLogIdsRef.current = logIds;
      // What was confirmed, for learning and the training export (no prices).
      const finalDraft = {
        customerId: draft.customer?.status === "matched" ? draft.customer.id : null,
        customerName: draft.customer?.name || null,
        items: draft.items.map((it) => ({
          key: it.key,
          productId: it.product?.id || null,
          productName: it.product?.name || null,
          qty: it.qty ?? null,
          spokenName: it.spokenName || null,
        })),
      };
      updateAiLogs({ context, logIds, corrections, status: "confirmed", finalDraft }).catch(() => {});
    }
    clearSession();
    setIsOpen(false);
  }, [context, logIds, corrections, draft, clearSession]);

  // Call when the page saves the bill, to link the AI logs to the invoice.
  const markSaved = useCallback(
    (invoiceId) => {
      const ids = pendingLogIdsRef.current;
      if (!ids.length || !invoiceId) return;
      pendingLogIdsRef.current = [];
      updateAiLogs({ context, logIds: ids, finalInvoiceId: invoiceId, status: "saved" }).catch(() => {});
    },
    [context]
  );

  const blockers = useMemo(() => {
    const list = [];
    if (!draft.items.length) list.push("Add at least one item.");
    const unresolved = draft.items.filter((it) => it.status !== "matched");
    if (unresolved.length) list.push(`Choose or create a product for ${unresolved.map((it) => `"${it.spokenName}"`).join(", ")}.`);
    if (draft.items.some((it) => !(it.qty > 0))) list.push("Every item needs a quantity.");
    if (draft.customer?.status === "ambiguous") list.push("Choose which customer you mean.");
    return list;
  }, [draft]);

  return {
    context,
    isOnline,
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((v) => !v),
    text,
    setText,
    loading,
    error,
    draft,
    clarification,
    messages,
    aliasNotice,
    submit,
    pickProduct,
    createProduct,
    setItemQty,
    removeItem,
    pickCustomer,
    discard,
    markConfirmed,
    markSaved,
    blockers,
    canConfirm: blockers.length === 0,
  };
}
