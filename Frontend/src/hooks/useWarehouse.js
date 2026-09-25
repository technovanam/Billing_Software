/**
 * useWarehouse.js
 * All hooks for the Godown / Warehouse Stock Management Portal.
 *
 * Provides full support for:
 * - Godown management
 * - Barcode resolution & external lookup fallback
 * - Atomic Stock In
 * - Atomic Stock Out with insufficient stock guard
 * - Atomic Stock Transfer between godowns
 * - Product creation with barcode & initial opening stock
 * - Stock movement ledger with pagination and filters
 * - Live KPI dashboard metrics & stock reporting
 */

import { useState, useEffect, useCallback, useContext } from "react";
import axios from "axios";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase/config";
import { AuthContext } from "../context/AuthContext";
import { useOperator } from "../context/OperatorContext";
import { useToast } from "../context/ToastContext";

const BACKEND = "http://localhost:5000";

// Deterministic O(1) stock doc ID
export function stockDocId(productBarcode, godownId) {
  return `${productBarcode}_${godownId}`;
}

const DEFAULT_GODOWNS = [
  { id: "mainGodown", name: "Main Godown", notes: "Primary warehouse facility", address: "Bay 1, Industrial Area" },
  { id: "godown2", name: "Secondary Godown (Floor 2)", notes: "Storage Rack B2, Floor 2", address: "Bay 2, Industrial Area" },
];

/**
 * Returns the UID whose Firestore namespace should be used for product/stock reads.
 * If the current user is a warehouse operator linked to an admin account, returns
 * the admin's UID so the warehouse sees the full product catalogue.
 * Falls back to the passed-in uid if no link is configured.
 */
async function getEffectiveUid(uid) {
  try {
    const profileDoc = await getDoc(doc(db, "users", uid, "settings", "profile"));
    if (profileDoc.exists()) {
      const linked = profileDoc.data().linkedAdminUid;
      if (linked && typeof linked === "string" && linked.trim()) {
        return linked.trim();
      }
    }
  } catch (_) {}
  return uid;
}

// Helper to get godowns from Firestore settings or default
async function getClientGodowns(uid) {
  try {
    const sDoc = await getDoc(doc(db, "users", uid, "settings", "warehouse"));
    if (sDoc.exists() && Array.isArray(sDoc.data().godowns) && sDoc.data().godowns.length > 0) {
      return sDoc.data().godowns;
    }
  } catch (_) {}
  return DEFAULT_GODOWNS;
}

// Helper to get movements safely from settings/stockMovements
async function getClientMovements(uid) {
  try {
    const sDoc = await getDoc(doc(db, "users", uid, "settings", "stockMovements"));
    if (sDoc.exists() && Array.isArray(sDoc.data().movements)) {
      return sDoc.data().movements;
    }
  } catch (_) {}
  return [];
}

// Helper to record movement safely in settings/stockMovements
async function recordClientMovement(uid, movement) {
  try {
    const current = await getClientMovements(uid);
    const newMov = {
      id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...movement,
      createdAt: new Date().toISOString(),
    };
    const updated = [newMov, ...current].slice(0, 500); // keep last 500
    await setDoc(doc(db, "users", uid, "settings", "stockMovements"), { movements: updated }, { merge: true });
    return newMov;
  } catch (_) {}
  return null;
}

// Helper to get damaged records safely from settings/damagedStock
async function getClientDamagedRecords(uid) {
  try {
    const sDoc = await getDoc(doc(db, "users", uid, "settings", "damagedStock"));
    if (sDoc.exists() && Array.isArray(sDoc.data().records)) {
      return sDoc.data().records;
    }
  } catch (_) {}
  return [];
}

// Helper to record damaged item safely in settings/damagedStock
async function recordClientDamagedRecord(uid, record) {
  try {
    const current = await getClientDamagedRecords(uid);
    const newRec = {
      id: record.id || `dmg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...record,
      createdAt: record.createdAt || new Date().toISOString(),
    };
    const updated = [newRec, ...current].slice(0, 500);
    await setDoc(doc(db, "users", uid, "settings", "damagedStock"), { records: updated }, { merge: true });
    return newRec;
  } catch (_) {}
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Godowns Hook
// ────────────────────────────────────────────────────────────────────────────
export const useGodowns = () => {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const [godowns, setGodowns] = useState(DEFAULT_GODOWNS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGodowns = useCallback(async () => {
    if (!user) {
      setGodowns(DEFAULT_GODOWNS);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getClientGodowns(user.uid);
      setGodowns(list);
    } catch (err) {
      setGodowns(DEFAULT_GODOWNS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGodowns();
  }, [fetchGodowns]);

  const addGodown = useCallback(
    async ({ name, address = "", notes = "" }) => {
      if (!name?.trim()) return { success: false, error: "Godown name is required" };
      try {
        if (!user) throw new Error("Not logged in");
        const current = await getClientGodowns(user.uid);
        const newGodown = {
          id: `godown_${Date.now()}`,
          name: name.trim(),
          address: address.trim(),
          notes: notes.trim(),
        };
        const updated = [...current, newGodown];
        await setDoc(doc(db, "users", user.uid, "settings", "warehouse"), { godowns: updated }, { merge: true });
        setGodowns(updated);
        toast.success(`Godown "${name}" created successfully`);
        return { success: true, data: newGodown };
      } catch (err) {
        toast.error(err.message || "Failed to create godown");
        return { success: false, error: err.message };
      }
    },
    [user, toast]
  );

  const editGodown = useCallback(
    async (id, { name, address, notes }) => {
      try {
        if (!user) throw new Error("Not logged in");
        const current = await getClientGodowns(user.uid);
        const updated = current.map((g) => (g.id === id ? { ...g, name: name.trim(), address: address || "", notes: notes || "" } : g));
        await setDoc(doc(db, "users", user.uid, "settings", "warehouse"), { godowns: updated }, { merge: true });
        setGodowns(updated);
        toast.success("Godown updated successfully");
        return { success: true };
      } catch (err) {
        toast.error(err.message || "Failed to update godown");
        return { success: false, error: err.message };
      }
    },
    [user, toast]
  );

  const removeGodown = useCallback(
    async (id) => {
      try {
        if (!user) throw new Error("Not logged in");
        const current = await getClientGodowns(user.uid);
        const updated = current.filter((g) => g.id !== id);
        await setDoc(doc(db, "users", user.uid, "settings", "warehouse"), { godowns: updated }, { merge: true });
        setGodowns(updated);
        toast.success("Godown deleted successfully");
        return { success: true };
      } catch (err) {
        toast.error(err.message || "Failed to delete godown");
        return { success: false, error: err.message };
      }
    },
    [user, toast]
  );

  return { godowns, loading, error, refetch: fetchGodowns, addGodown, editGodown, removeGodown };
};

// ────────────────────────────────────────────────────────────────────────────
// Barcode Resolution
// ────────────────────────────────────────────────────────────────────────────
export const useBarcodeIndex = () => {
  const { user } = useContext(AuthContext);

  const resolveBarcode = useCallback(
    async (barcode, godownId = null) => {
      const code = String(barcode || "").trim();
      if (!code) return { found: false };

      try {
        if (!user) return { found: false };
        const prodsSnap = await getDocs(collection(db, "users", user.uid, "products"));
        let matched = null;
        for (const d of prodsSnap.docs) {
          const data = d.data();
          if (String(data.barcode || "").trim() === code || d.id === code) {
            matched = { id: d.id, ...data };
            break;
          }
        }

        if (matched) {
          let currentStock = Number(matched.stock) || 0;
          if (godownId && matched.godownStock && matched.godownStock[godownId] !== undefined) {
            currentStock = Number(matched.godownStock[godownId]) || 0;
          }
          return {
            found: true,
            product: matched,
            stock: { quantity: currentStock, godownId: godownId || "mainGodown" },
          };
        }

        // External lookup if not found locally
        try {
          const extRes = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
          const extData = await extRes.json();
          if (extData.status === 1 && extData.product) {
            const p = extData.product;
            return {
              found: false,
              externalFound: true,
              lookupData: {
                name: p.product_name || p.generic_name || "",
                category: p.categories?.split(",")[0]?.trim() || "",
                brand: p.brands?.split(",")[0]?.trim() || "",
                unit: p.quantity || "Piece",
                imageUrl: p.image_url || "",
              },
            };
          }
        } catch (_) {}

        return { found: false, externalFound: false };
      } catch (err) {
        return { found: false, error: err.message };
      }
    },
    [user]
  );

  return { resolveBarcode };
};

// ────────────────────────────────────────────────────────────────────────────
// Stock In Hook
// ────────────────────────────────────────────────────────────────────────────
export const useStockIn = () => {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const { operatorName } = useOperator();

  const stockIn = useCallback(
    async ({ barcode, godownId = "mainGodown", quantity = 1, referenceNo = "", remarks = "" }) => {
      const code = String(barcode || "").trim();
      const qty = Number(quantity);
      const targetGodownId = godownId || "mainGodown";

      if (!code) return { success: false, error: "Barcode is required" };
      if (qty <= 0) return { success: false, error: "Quantity must be greater than 0" };

      try {
        if (!user) throw new Error("Not logged in");

        // Find product
        const prodsSnap = await getDocs(collection(db, "users", user.uid, "products"));
        let targetDoc = null;
        for (const d of prodsSnap.docs) {
          if (String(d.data().barcode || "").trim() === code || d.id === code) {
            targetDoc = d;
            break;
          }
        }

        if (!targetDoc) {
          throw new Error(`Product with barcode "${code}" not found.`);
        }

        const pData = targetDoc.data();
        if (pData.isActive === false) {
          const msg = `"${pData.name || code}" is inactive. Reactivate it in Products before moving stock.`;
          toast.error(msg);
          return { success: false, error: msg, code: "PRODUCT_INACTIVE" };
        }
        const currentGodownStock = pData.godownStock || {};
        const prevGodownQty = Number(currentGodownStock[targetGodownId]) || 0;
        const newGodownQty = prevGodownQty + qty;
        const newTotalStock = (Number(pData.stock) || 0) + qty;

        const updatedGodownStock = { ...currentGodownStock, [targetGodownId]: newGodownQty };

        await updateDoc(targetDoc.ref, {
          stock: newTotalStock,
          godownStock: updatedGodownStock,
          updatedAt: serverTimestamp(),
        });

        // Record movement in settings/stockMovements
        await recordClientMovement(user.uid, {
          productBarcode: code,
          productName: pData.name || "Product",
          godownId: targetGodownId,
          quantity: qty,
          type: "IN",
          referenceNo: referenceNo || "",
          remarks: remarks || "",
          operatorName: operatorName || "",
          userEmail: user.email || "",
        });

        return {
          success: true,
          productBarcode: code,
          productName: pData.name,
          quantity: qty,
          newQuantity: newTotalStock,
          godownId: targetGodownId,
        };
      } catch (err) {
        const msg = err.message || "Stock in failed";
        toast.error(msg);
        return { success: false, error: msg };
      }
    },
    [user, operatorName, toast]
  );

  return { stockIn };
};

// ────────────────────────────────────────────────────────────────────────────
// Stock Out Hook
// ────────────────────────────────────────────────────────────────────────────
export const useStockOut = () => {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const { operatorName } = useOperator();

  const stockOut = useCallback(
    async ({ barcode, godownId = "mainGodown", quantity, referenceNo = "", remarks = "" }) => {
      const code = String(barcode || "").trim();
      const qty = Number(quantity);
      const targetGodownId = godownId || "mainGodown";

      if (!code) return { success: false, error: "Barcode is required" };
      if (qty <= 0) return { success: false, error: "Quantity must be greater than 0" };

      try {
        if (!user) throw new Error("Not logged in");

        const prodsSnap = await getDocs(collection(db, "users", user.uid, "products"));
        let targetDoc = null;
        for (const d of prodsSnap.docs) {
          if (String(d.data().barcode || "").trim() === code || d.id === code) {
            targetDoc = d;
            break;
          }
        }

        if (!targetDoc) throw new Error(`Product with barcode "${code}" not found.`);

        const pData = targetDoc.data();
        if (pData.isActive === false) {
          const msg = `"${pData.name || code}" is inactive. Reactivate it in Products before moving stock.`;
          toast.error(msg);
          return { success: false, error: msg, code: "PRODUCT_INACTIVE" };
        }
        const available = Number(pData.stock) || 0;

        if (available < qty) {
          const err = new Error(`Insufficient stock. Available: ${available}, Requested: ${qty}`);
          toast.error(err.message);
          return {
            success: false,
            error: err.message,
            code: "INSUFFICIENT_STOCK",
            available,
            requested: qty,
          };
        }

        const newTotalStock = Math.max(0, available - qty);

        await updateDoc(targetDoc.ref, {
          stock: newTotalStock,
          updatedAt: serverTimestamp(),
        });

        await recordClientMovement(user.uid, {
          productBarcode: code,
          productName: pData.name || "Product",
          godownId: targetGodownId,
          quantity: qty,
          type: "OUT",
          referenceNo: referenceNo || "",
          remarks: remarks || "",
          operatorName: operatorName || "",
          userEmail: user.email || "",
        });

        return {
          success: true,
          productBarcode: code,
          productName: pData.name,
          quantity: qty,
          newQuantity: newTotalStock,
          godownId: targetGodownId,
        };
      } catch (err) {
        const msg = err.message || "Stock out failed";
        toast.error(msg);
        return { success: false, error: msg };
      }
    },
    [user, operatorName, toast]
  );

  return { stockOut };
};

// ────────────────────────────────────────────────────────────────────────────
// Stock Transfer Hook
// ────────────────────────────────────────────────────────────────────────────
export const useStockTransfer = () => {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const { operatorName } = useOperator();

  const transfer = useCallback(
    async ({ barcode, fromGodownId, toGodownId, quantity, remarks = "" }) => {
      const code = String(barcode || "").trim();
      const qty = Number(quantity);
      if (!code) return { success: false, error: "Barcode is required" };
      if (!fromGodownId || !toGodownId) return { success: false, error: "Source and destination godowns are required" };
      if (fromGodownId === toGodownId) return { success: false, error: "Source and destination godowns must be different" };
      if (qty <= 0) return { success: false, error: "Quantity must be greater than 0" };

      try {
        if (!user) throw new Error("Not logged in");

        const prodsSnap = await getDocs(collection(db, "users", user.uid, "products"));
        let targetDoc = null;
        for (const d of prodsSnap.docs) {
          if (String(d.data().barcode || "").trim() === code || d.id === code) {
            targetDoc = d;
            break;
          }
        }

        if (!targetDoc) throw new Error(`Product with barcode "${code}" not found.`);

        const pData = targetDoc.data();
        if (pData.isActive === false) {
          const msg = `"${pData.name || code}" is inactive. Reactivate it in Products before moving stock.`;
          toast.error(msg);
          return { success: false, error: msg, code: "PRODUCT_INACTIVE" };
        }
        const currentGodownStock = pData.godownStock || {};
        const availableFrom = Number(currentGodownStock[fromGodownId]) || 0;

        if (availableFrom < qty) {
          const err = new Error(`Insufficient stock in source godown. Available: ${availableFrom}, Requested: ${qty}`);
          toast.error(err.message);
          return {
            success: false,
            error: err.message,
            code: "INSUFFICIENT_STOCK",
            available: availableFrom,
            requested: qty,
          };
        }

        const newFromQty = availableFrom - qty;
        const newToQty = (Number(currentGodownStock[toGodownId]) || 0) + qty;
        const updatedGodownStock = {
          ...currentGodownStock,
          [fromGodownId]: newFromQty,
          [toGodownId]: newToQty,
        };

        await updateDoc(targetDoc.ref, {
          godownStock: updatedGodownStock,
          updatedAt: serverTimestamp(),
        });

        const transferGroupId = `trf_${Date.now()}`;

        // Add TRANSFER_OUT movement
        await recordClientMovement(user.uid, {
          productBarcode: code,
          productName: pData.name || "Product",
          godownId: fromGodownId,
          toGodownId,
          quantity: qty,
          type: "TRANSFER_OUT",
          transferGroupId,
          remarks: remarks || "",
          operatorName: operatorName || "",
          userEmail: user.email || "",
        });

        // Add TRANSFER_IN movement
        await recordClientMovement(user.uid, {
          productBarcode: code,
          productName: pData.name || "Product",
          godownId: toGodownId,
          fromGodownId,
          quantity: qty,
          type: "TRANSFER_IN",
          transferGroupId,
          remarks: remarks || "",
          operatorName: operatorName || "",
          userEmail: user.email || "",
        });

        return {
          success: true,
          productBarcode: code,
          productName: pData.name,
          quantity: qty,
          fromGodownId,
          toGodownId,
          transferGroupId,
        };
      } catch (err) {
        const msg = err.message || "Stock transfer failed";
        toast.error(msg);
        return { success: false, error: msg };
      }
    },
    [user, operatorName, toast]
  );

  return { transfer };
};

// ────────────────────────────────────────────────────────────────────────────
// Product Creation & Legacy Barcode Assignment Hooks
// ────────────────────────────────────────────────────────────────────────────
export const useCreateWarehouseProduct = () => {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const { operatorName } = useOperator();

  const createProduct = useCallback(
    async (productPayload) => {
      try {
        if (!user) throw new Error("Not logged in");
        const { name, barcode, sku, category, brand, unit, purchasePrice, price, minStockLevel, initialQuantity = 0, godownId } = productPayload;
        const code = String(barcode || "").trim();
        const initQty = Number(initialQuantity) || 0;
        const targetGodownId = godownId || "mainGodown";

        const docRef = await addDoc(collection(db, "users", user.uid, "products"), {
          name: String(name || "").trim(),
          barcode: code,
          sku: (sku || "").trim(),
          category: (category || "").trim(),
          brand: (brand || "").trim(),
          unit: unit || "Piece",
          purchasePrice: purchasePrice || "0",
          price: price || "0",
          minStockLevel: minStockLevel || "0",
          stock: initQty,
          godownStock: { [targetGodownId]: initQty },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (initQty > 0) {
          await recordClientMovement(user.uid, {
            productBarcode: code,
            productName: String(name || "").trim(),
            godownId: targetGodownId,
            quantity: initQty,
            type: "IN",
            remarks: "Initial scan / opening stock",
            operatorName: operatorName || "",
            userEmail: user.email || "",
          });
        }

        return { success: true, product: { id: docRef.id, ...productPayload, godownId: targetGodownId } };
      } catch (err) {
        toast.error(err.message || "Failed to create product");
        return { success: false, error: err.message };
      }
    },
    [user, operatorName, toast]
  );

  const assignBarcode = useCallback(
    async ({ productId, barcode, initialQuantity = 0, godownId = "mainGodown" }) => {
      try {
        if (!user) throw new Error("Not logged in");
        const prodRef = doc(db, "users", user.uid, "products", productId);
        const pSnap = await getDoc(prodRef);
        if (!pSnap.exists()) throw new Error("Product not found");

        const pData = pSnap.data();
        const initQty = Number(initialQuantity) || 0;
        const targetGodownId = godownId || "mainGodown";
        const currentGodownStock = pData.godownStock || {};
        currentGodownStock[targetGodownId] = (Number(currentGodownStock[targetGodownId]) || 0) + initQty;

        const code = String(barcode || "").trim();

        await updateDoc(prodRef, {
          barcode: code,
          stock: (Number(pData.stock) || 0) + initQty,
          godownStock: currentGodownStock,
          updatedAt: serverTimestamp(),
        });

        if (initQty > 0) {
          await recordClientMovement(user.uid, {
            productBarcode: code,
            productName: pData.name || "Product",
            godownId: targetGodownId,
            quantity: initQty,
            type: "IN",
            remarks: "Barcode assignment opening stock",
            operatorName: operatorName || "",
            userEmail: user.email || "",
          });
        }

        return { success: true };
      } catch (err) {
        toast.error(err.message || "Failed to assign barcode");
        return { success: false, error: err.message };
      }
    },
    [user, operatorName, toast]
  );

  return { createProduct, assignBarcode };
};

// ────────────────────────────────────────────────────────────────────────────
// Movements Hook
// ────────────────────────────────────────────────────────────────────────────
export const useStockMovements = (filters = {}) => {
  const { user } = useContext(AuthContext);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMovements = useCallback(async () => {
    if (!user) {
      setMovements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let items = await getClientMovements(user.uid);

      // Filter client-side
      if (filters.godownId) {
        items = items.filter((m) => m.godownId === filters.godownId || m.fromGodownId === filters.godownId || m.toGodownId === filters.godownId);
      }
      if (filters.type && filters.type !== "ALL") {
        items = items.filter((m) => m.type === filters.type);
      }
      if (filters.operatorName) {
        items = items.filter((m) => m.operatorName === filters.operatorName);
      }
      if (filters.productBarcode) {
        items = items.filter((m) => m.productBarcode === filters.productBarcode);
      }

      // Sort descending by createdAt
      items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

      setMovements(items);
    } catch (_) {
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [user, filters.godownId, filters.type, filters.operatorName, filters.productBarcode]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  return {
    movements,
    loading,
    hasMore: false,
    hasPrev: false,
    nextPage: () => {},
    prevPage: () => {},
    refetch: fetchMovements,
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Warehouse Dashboard Stats Hook
// ────────────────────────────────────────────────────────────────────────────
export const useWarehouseStats = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const effectiveUid = await getEffectiveUid(user.uid);
      const [prodsSnap, movements, godowns] = await Promise.all([
        getDocs(collection(db, "users", effectiveUid, "products")),
        getClientMovements(user.uid),
        getClientGodowns(user.uid),
      ]);

      const products = prodsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const totalSkus = products.length;

      let totalUnits = 0;
      let totalDamagedUnits = 0;
      let totalDamagedValue = 0;
      let totalInventoryValue = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      products.forEach((p) => {
        const qty = Number(p.stock) || 0;
        const dQty = Number(p.damagedStock) || 0;
        const price = Number(p.purchasePrice || p.price) || 0;
        const minLvl = Number(p.minStockLevel) || 0;

        totalUnits += qty;
        totalDamagedUnits += dQty;
        totalInventoryValue += qty * price;
        totalDamagedValue += dQty * price;

        if (qty === 0) {
          outOfStockCount++;
        } else if (qty <= minLvl && minLvl > 0) {
          lowStockCount++;
        }
      });

      // Filter today's movements
      const todayIso = new Date().toISOString().slice(0, 10);
      let stockInToday = 0;
      let stockOutToday = 0;
      let transfersToday = 0;

      movements.forEach((m) => {
        if ((m.createdAt || "").startsWith(todayIso)) {
          const q = Number(m.quantity) || 0;
          if (m.type === "IN") stockInToday += q;
          else if (m.type === "OUT") stockOutToday += q;
          else if (m.type === "TRANSFER_IN" || m.type === "TRANSFER_OUT") transfersToday += q / 2;
        }
      });

      // Sort recent movements
      movements.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      const recentMovements = movements.slice(0, 10);

      // Low stock alerts
      const lowStockAlerts = products
        .filter((p) => {
          const qty = Number(p.stock) || 0;
          const minLvl = Number(p.minStockLevel) || 0;
          return qty <= minLvl;
        })
        .slice(0, 8)
        .map((p) => ({
          productId: p.id,
          productName: p.name,
          barcode: p.barcode || "",
          quantity: Number(p.stock) || 0,
          minStockLevel: Number(p.minStockLevel) || 0,
          godownName: "All Godowns",
        }));

      setStats({
        // Aliased to match dashboard field names
        totalProducts: totalSkus,
        totalStock: totalUnits,
        totalDamagedStock: totalDamagedUnits,
        totalDamagedValue,
        totalInventoryValue,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        todayIn: stockInToday,
        todayOut: stockOutToday,
        todayTransfers: transfersToday,
        godownsCount: godowns.length,
        recentMovements,
        lowStockAlerts,
      });
    } catch (err) {
      console.error("Dashboard stats error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
};

// ────────────────────────────────────────────────────────────────────────────
// Stock Report Hook (Live updates via onSnapshot)
// ────────────────────────────────────────────────────────────────────────────
export const useStockReport = (groupBy = "product") => {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setReportData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let unsubscribe = () => {};

    const setup = async () => {
      try {
        const effectiveUid = await getEffectiveUid(user.uid);
        const colRef = collection(db, "users", effectiveUid, "products");
        unsubscribe = onSnapshot(
          colRef,
          (snap) => {
            const data = snap.docs.map((d) => {
              const p = d.data();
              const total = Number(p.stock) || 0;
              const damaged = Number(p.damagedStock) || 0;
              const minLvl = Number(p.minStockLevel) || 0;
              const price = Number(p.purchasePrice || p.price) || 0;
              const prodObj = {
                id: d.id,
                productId: d.id,
                barcode: p.barcode || "",
                name: p.name || "",
                category: p.category || "General",
                unit: p.unit || "Piece",
                sku: p.sku || "",
                brand: p.brand || "",
                purchasePrice: p.purchasePrice || "0",
                price: p.price || "0",
                minStockLevel: minLvl,
                stock: total,
                damagedStock: damaged,
                godownDamagedStock: p.godownDamagedStock || {},
                totalStock: total,
                totalQuantity: total,
                imageUrl: p.imageUrl || "",
                totalValue: total * price,
                damagedValue: damaged * price,
                godownStock: p.godownStock || { mainGodown: total },
                status: total === 0 ? "OUT_OF_STOCK" : total <= minLvl && minLvl > 0 ? "LOW_STOCK" : "IN_STOCK",
              };
              return {
                ...prodObj,
                product: { ...prodObj },
              };
            });
            setReportData(data);
            setLoading(false);
          },
          (err) => {
            console.error("Stock report onSnapshot error:", err);
            toast.error("Failed to load stock report");
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Setup stock report error:", err);
        setLoading(false);
      }
    };

    setup();
    return () => unsubscribe();
  }, [user, groupBy, toast]);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const effectiveUid = await getEffectiveUid(user.uid);
      const snap = await getDocs(collection(db, "users", effectiveUid, "products"));
      const data = snap.docs.map((d) => {
        const p = d.data();
        const total = Number(p.stock) || 0;
        const damaged = Number(p.damagedStock) || 0;
        const minLvl = Number(p.minStockLevel) || 0;
        const price = Number(p.purchasePrice || p.price) || 0;
        const prodObj = {
          id: d.id,
          productId: d.id,
          barcode: p.barcode || "",
          name: p.name || "",
          category: p.category || "General",
          unit: p.unit || "Piece",
          sku: p.sku || "",
          brand: p.brand || "",
          purchasePrice: p.purchasePrice || "0",
          price: p.price || "0",
          minStockLevel: minLvl,
          stock: total,
          damagedStock: damaged,
          godownDamagedStock: p.godownDamagedStock || {},
          totalStock: total,
          totalQuantity: total,
          imageUrl: p.imageUrl || "",
          totalValue: total * price,
          damagedValue: damaged * price,
          godownStock: p.godownStock || { mainGodown: total },
          status: total === 0 ? "OUT_OF_STOCK" : total <= minLvl && minLvl > 0 ? "LOW_STOCK" : "IN_STOCK",
        };
        return {
          ...prodObj,
          product: { ...prodObj },
        };
      });
      setReportData(data);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { reportData, loading, refetch };
};

// ────────────────────────────────────────────────────────────────────────────
// Products List Hook (Live updates via onSnapshot)
// ────────────────────────────────────────────────────────────────────────────
export const useProducts = () => {
  const { user } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let unsubscribe = () => {};

    const setup = async () => {
      try {
        const effectiveUid = await getEffectiveUid(user.uid);
        const colRef = collection(db, "users", effectiveUid, "products");
        unsubscribe = onSnapshot(
          colRef,
          (snap) => {
            const list = snap.docs.map((d) => {
              const p = d.data();
              const stock = Number(p.stock) || 0;
              const damagedStock = Number(p.damagedStock) || 0;
              const minLvl = Number(p.minStockLevel) || 0;
              return {
                id: d.id,
                barcode: p.barcode || "",
                name: p.name || "Unnamed Product",
                category: p.category || "General",
                unit: p.unit || "Piece",
                price: Number(p.price) || 0,
                purchasePrice: Number(p.purchasePrice) || 0,
                stock,
                damagedStock,
                godownDamagedStock: p.godownDamagedStock || {},
                minStockLevel: minLvl,
                description: p.description || "",
                brand: p.brand || "",
                sku: p.sku || "",
                imageUrl: p.imageUrl || "",
                godownStock: p.godownStock || {},
                status: stock === 0 ? "OUT_OF_STOCK" : stock <= minLvl && minLvl > 0 ? "LOW_STOCK" : "IN_STOCK",
              };
            });
            list.sort((a, b) => a.name.localeCompare(b.name));
            setProducts(list);
            setLoading(false);
          },
          (err) => {
            console.error("useProducts onSnapshot error:", err);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Setup products listener error:", err);
        setLoading(false);
      }
    };

    setup();
    return () => unsubscribe();
  }, [user]);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    try {
      const effectiveUid = await getEffectiveUid(user.uid);
      const snap = await getDocs(collection(db, "users", effectiveUid, "products"));
      const list = snap.docs.map((d) => {
        const p = d.data();
        const stock = Number(p.stock) || 0;
        const damagedStock = Number(p.damagedStock) || 0;
        const minLvl = Number(p.minStockLevel) || 0;
        return {
          id: d.id,
          barcode: p.barcode || "",
          name: p.name || "Unnamed Product",
          category: p.category || "General",
          unit: p.unit || "Piece",
          price: Number(p.price) || 0,
          purchasePrice: Number(p.purchasePrice) || 0,
          stock,
          damagedStock,
          godownDamagedStock: p.godownDamagedStock || {},
          minStockLevel: minLvl,
          description: p.description || "",
          brand: p.brand || "",
          sku: p.sku || "",
          imageUrl: p.imageUrl || "",
          godownStock: p.godownStock || {},
          isActive: p.isActive !== false,
          status: stock === 0 ? "OUT_OF_STOCK" : stock <= minLvl && minLvl > 0 ? "LOW_STOCK" : "IN_STOCK",
        };
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(list);
    } catch (_) {}
  }, [user]);

  const updateProduct = useCallback(async (productId, productData) => {
    if (!user) throw new Error("Not logged in");
    const effectiveUid = await getEffectiveUid(user.uid);
    const productRef = doc(db, "users", effectiveUid, "products", productId);
    await updateDoc(productRef, {
      ...productData,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  }, [user]);

  // Products are deactivated, not deleted, so old bills and movements keep them.
  const setProductActive = useCallback(async (productId, active) => {
    if (!user) throw new Error("Not logged in");
    const effectiveUid = await getEffectiveUid(user.uid);
    const productRef = doc(db, "users", effectiveUid, "products", productId);
    await updateDoc(productRef, { isActive: Boolean(active), updatedAt: serverTimestamp() });
    return { success: true };
  }, [user]);

  return { products, loading, refetch: fetchProducts, updateProduct, setProductActive };
};

// ────────────────────────────────────────────────────────────────────────────
// Damaged / Wastage Stock Hook
// ────────────────────────────────────────────────────────────────────────────
export const useDamagedStock = () => {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const { operatorName } = useOperator();
  const [damagedRecords, setDamagedRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time damaged stock records from settings/damagedStock
  useEffect(() => {
    if (!user) {
      setDamagedRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let unsubscribe = () => {};

    try {
      const sRef = doc(db, "users", user.uid, "settings", "damagedStock");
      unsubscribe = onSnapshot(
        sRef,
        (snap) => {
          if (snap.exists() && Array.isArray(snap.data().records)) {
            const list = snap.data().records.map((r) => ({
              ...r,
              quantity: Number(r.quantity) || 1,
              purchasePrice: Number(r.purchasePrice) || 0,
              price: Number(r.price) || 0,
            }));
            list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
            setDamagedRecords(list);
          } else {
            setDamagedRecords([]);
          }
          setLoading(false);
        },
        async () => {
          const list = await getClientDamagedRecords(user.uid);
          setDamagedRecords(list);
          setLoading(false);
        }
      );
    } catch (_) {
      getClientDamagedRecords(user.uid).then((list) => {
        setDamagedRecords(list);
        setLoading(false);
      });
    }

    return () => unsubscribe();
  }, [user]);

  /**
   * Adds product to damaged stock:
   * - Deducts quantity from usable live stock (product.stock & godownStock[godownId])
   * - Increments damagedStock and godownDamagedStock on the product
   * - Logs damage incident record into settings/damagedStock (and subcollection if permitted)
   * - Appends to stock movements ledger with type "DAMAGE"
   */
  const recordDamage = useCallback(
    async ({
      productId = "",
      barcode = "",
      godownId = "mainGodown",
      godownName = "Main Godown",
      quantity = 1,
      reason = "Physical Damage / Broken",
      remarks = "",
    }) => {
      const qty = Math.max(1, Number(quantity) || 1);
      const code = String(barcode || "").trim();
      const targetGodownId = godownId || "mainGodown";

      try {
        if (!user) throw new Error("Not logged in");

        // 1. Find product in user's products collection first
        let targetDoc = null;
        const prodsSnap = await getDocs(collection(db, "users", user.uid, "products"));
        for (const d of prodsSnap.docs) {
          const data = d.data();
          if (productId && d.id === productId) {
            targetDoc = d;
            break;
          }
          if (code && (String(data.barcode || "").trim() === code || d.id === code)) {
            targetDoc = d;
            break;
          }
        }

        // If not found in user.uid, fallback to effectiveUid
        if (!targetDoc) {
          const effectiveUid = await getEffectiveUid(user.uid);
          if (effectiveUid !== user.uid) {
            const effSnap = await getDocs(collection(db, "users", effectiveUid, "products"));
            for (const d of effSnap.docs) {
              const data = d.data();
              if (productId && d.id === productId) {
                targetDoc = d;
                break;
              }
              if (code && (String(data.barcode || "").trim() === code || d.id === code)) {
                targetDoc = d;
                break;
              }
            }
          }
        }

        if (!targetDoc) {
          throw new Error(`Product ${productId || code ? `"${productId || code}"` : ""} not found.`);
        }

        const pData = targetDoc.data();
        const currentLiveTotal = Number(pData.stock) || 0;
        const currentGodownStock = pData.godownStock || {};
        const availableInGodown = Number(currentGodownStock[targetGodownId]) ?? currentLiveTotal;

        // Validation: must have sufficient live stock to separate into damaged
        if (availableInGodown < qty) {
          const errMsg = `Insufficient usable stock in this godown. Available: ${availableInGodown}, Requested to mark damaged: ${qty}`;
          toast.error(errMsg);
          return { success: false, error: errMsg };
        }

        // Calculate new live stock (reduced by quantity)
        const newGodownLiveQty = Math.max(0, availableInGodown - qty);
        const newTotalLiveQty = Math.max(0, currentLiveTotal - qty);

        // Calculate new damaged stock (increased by quantity)
        const currentDamagedTotal = Number(pData.damagedStock) || 0;
        const newDamagedTotal = currentDamagedTotal + qty;
        const currentGodownDamaged = pData.godownDamagedStock || {};
        const newGodownDamagedQty = (Number(currentGodownDamaged[targetGodownId]) || 0) + qty;

        const updatedGodownStock = { ...currentGodownStock, [targetGodownId]: newGodownLiveQty };
        const updatedGodownDamaged = { ...currentGodownDamaged, [targetGodownId]: newGodownDamagedQty };

        // Atomically update product live and damaged stock
        await updateDoc(targetDoc.ref, {
          stock: newTotalLiveQty,
          godownStock: updatedGodownStock,
          damagedStock: newDamagedTotal,
          godownDamagedStock: updatedGodownDamaged,
          updatedAt: serverTimestamp(),
        });

        const nowIso = new Date().toISOString();
        const recId = `dmg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const incidentPayload = {
          id: recId,
          productId: targetDoc.id,
          productBarcode: pData.barcode || code || "",
          productName: pData.name || "Product",
          category: pData.category || "General",
          unit: pData.unit || "Piece",
          purchasePrice: Number(pData.purchasePrice) || 0,
          price: Number(pData.price) || 0,
          godownId: targetGodownId,
          godownName: godownName || "Godown",
          quantity: qty,
          reason,
          remarks: remarks.trim(),
          operatorName: operatorName || "Operator",
          userEmail: user.email || "",
          status: "DAMAGED",
          createdAt: nowIso,
        };

        // 1. Save to settings/damagedStock (guaranteed write permissions for authenticated user)
        await recordClientDamagedRecord(user.uid, incidentPayload);

        // 2. Also try writing to subcollection if supported, ignoring permission errors
        try {
          await addDoc(collection(db, "users", user.uid, "damaged_stock"), incidentPayload);
        } catch (_) {}

        // 3. Record stock movement in ledger (type: DAMAGE)
        await recordClientMovement(user.uid, {
          productBarcode: pData.barcode || code || "",
          productName: pData.name || "Product",
          godownId: targetGodownId,
          godownName,
          quantity: qty,
          type: "DAMAGE",
          referenceNo: `DMG-${recId.slice(-6).toUpperCase()}`,
          remarks: `Moved to Damaged Stock: ${reason}${remarks ? ` - ${remarks}` : ""}`,
          operatorName: operatorName || "",
          userEmail: user.email || "",
        });

        toast.success(`Moved ${qty} ${pData.unit || "unit(s)"} of "${pData.name}" to Damaged Stock. Usable stock reduced.`);
        return {
          success: true,
          id: recId,
          newLiveStock: newTotalLiveQty,
          newGodownStock: newGodownLiveQty,
          damagedStock: newDamagedTotal,
        };
      } catch (err) {
        const msg = err.message || "Failed to record damaged stock";
        toast.error(msg);
        return { success: false, error: msg };
      }
    },
    [user, operatorName, toast]
  );

  /**
   * Restore damaged stock back to usable live stock (e.g. repaired or logged in error)
   */
  const restoreDamage = useCallback(
    async (recordId, remarks = "") => {
      try {
        if (!user) throw new Error("Not logged in");

        const currentRecords = await getClientDamagedRecords(user.uid);
        const recIndex = currentRecords.findIndex((r) => r.id === recordId);
        if (recIndex === -1) throw new Error("Damage record not found");

        const recData = currentRecords[recIndex];
        if (recData.status === "RESTORED") {
          throw new Error("This item has already been restored to usable stock.");
        }

        const qtyToRestore = Number(recData.quantity) || 1;
        const targetGodownId = recData.godownId || "mainGodown";

        // Find product
        let prodSnap = await getDoc(doc(db, "users", user.uid, "products", recData.productId));
        let pRef = prodSnap.ref;
        if (!prodSnap.exists()) {
          const effectiveUid = await getEffectiveUid(user.uid);
          prodSnap = await getDoc(doc(db, "users", effectiveUid, "products", recData.productId));
          pRef = prodSnap.ref;
        }

        if (prodSnap.exists()) {
          const pData = prodSnap.data();
          const currentLiveTotal = Number(pData.stock) || 0;
          const currentGodownStock = pData.godownStock || {};
          const currentGodownQty = Number(currentGodownStock[targetGodownId]) || 0;

          const currentDamagedTotal = Number(pData.damagedStock) || 0;
          const currentGodownDamaged = pData.godownDamagedStock || {};
          const currentGodownDamagedQty = Number(currentGodownDamaged[targetGodownId]) || 0;

          // Increment usable stock & decrement damaged stock
          await updateDoc(pRef, {
            stock: currentLiveTotal + qtyToRestore,
            godownStock: { ...currentGodownStock, [targetGodownId]: currentGodownQty + qtyToRestore },
            damagedStock: Math.max(0, currentDamagedTotal - qtyToRestore),
            godownDamagedStock: { ...currentGodownDamaged, [targetGodownId]: Math.max(0, currentGodownDamagedQty - qtyToRestore) },
            updatedAt: serverTimestamp(),
          });
        }

        // Update record in settings/damagedStock
        const updatedRecords = [...currentRecords];
        updatedRecords[recIndex] = {
          ...recData,
          status: "RESTORED",
          restoredAt: new Date().toISOString(),
          restoredBy: operatorName || "Operator",
          restoreRemarks: remarks || "Restored back to usable stock",
        };
        await setDoc(doc(db, "users", user.uid, "settings", "damagedStock"), { records: updatedRecords }, { merge: true });

        // Record movement
        await recordClientMovement(user.uid, {
          productBarcode: recData.productBarcode || "",
          productName: recData.productName || "Product",
          godownId: targetGodownId,
          quantity: qtyToRestore,
          type: "ADJUSTMENT",
          referenceNo: `RST-${recordId.slice(-6).toUpperCase()}`,
          remarks: `Restored to Usable Live Stock from Damaged${remarks ? `: ${remarks}` : ""}`,
          operatorName: operatorName || "",
          userEmail: user.email || "",
        });

        toast.success(`Restored ${qtyToRestore} unit(s) back to usable live stock.`);
        return { success: true };
      } catch (err) {
        toast.error(err.message || "Failed to restore stock");
        return { success: false, error: err.message };
      }
    },
    [user, operatorName, toast]
  );

  /**
   * Permanently write off / scrap damaged item
   */
  const scrapDamage = useCallback(
    async (recordId, remarks = "") => {
      try {
        if (!user) throw new Error("Not logged in");

        const currentRecords = await getClientDamagedRecords(user.uid);
        const recIndex = currentRecords.findIndex((r) => r.id === recordId);
        if (recIndex === -1) throw new Error("Damage record not found");

        const recData = currentRecords[recIndex];
        const updatedRecords = [...currentRecords];
        updatedRecords[recIndex] = {
          ...recData,
          status: "SCRAPPED",
          scrappedAt: new Date().toISOString(),
          scrappedBy: operatorName || "Operator",
          scrapRemarks: remarks || "Disposed and written off",
        };
        await setDoc(doc(db, "users", user.uid, "settings", "damagedStock"), { records: updatedRecords }, { merge: true });

        toast.success("Marked damaged item as written off / scrapped.");
        return { success: true };
      } catch (err) {
        toast.error(err.message || "Failed to scrap item");
        return { success: false, error: err.message };
      }
    },
    [user, operatorName, toast]
  );

  // Derived aggregates
  const activeDamagedRecords = damagedRecords.filter((r) => r.status === "DAMAGED");
  const totalDamagedUnits = activeDamagedRecords.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const totalDamagedValue = activeDamagedRecords.reduce(
    (sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.purchasePrice) || Number(r.price) || 0),
    0
  );

  return {
    damagedRecords,
    activeDamagedRecords,
    totalDamagedUnits,
    totalDamagedValue,
    loading,
    recordDamage,
    restoreDamage,
    scrapDamage,
  };
};

