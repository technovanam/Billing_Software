// POS shifts from Firestore ({business}/posShifts). Cashiers see their own
// shifts; the owner sees all. Opening/closing goes through the backend, which
// allows only one open shift per cashier and per counter.
import { useCallback, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase/config";
import { AuthContext } from "../context/AuthContext";
import { openShift, closeShift, importShifts } from "../services/posService";

const LEGACY_KEY = "pos_cashier_shifts";
const IMPORTED_KEY = "pos_cashier_shifts_imported";

// The shift screen's field names.
function toView(id, d) {
  return {
    id,
    ...d,
    status: d.status === "Open" ? "Active" : "Closed",
    closingCashDeclared: d.closingCash ?? null,
  };
}

export default function usePosShifts() {
  const { user } = useContext(AuthContext);
  const businessUid = user?.businessUid || user?.uid || null;
  const isCashier = user?.role === "cashier";
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!businessUid || !user?.uid) {
      setShifts([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const col = collection(db, "users", businessUid, "posShifts");
    const q = isCashier ? query(col, where("cashierId", "==", user.cashierId)) : col;
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => toView(d.id, d.data()));
        list.sort((a, b) => String(b.openedAt || "").localeCompare(String(a.openedAt || "")));
        setShifts(list.slice(0, 100));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
  }, [businessUid, isCashier, user?.uid, user?.cashierId]);

  // One-time copy of shifts that older builds kept in this browser.
  useEffect(() => {
    if (!user?.uid || localStorage.getItem(IMPORTED_KEY)) return;
    let legacy = [];
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
    } catch (_) {
      legacy = [];
    }
    const mine = (Array.isArray(legacy) ? legacy : []).filter((s) => !isCashier || !s.cashierId || s.cashierId === user.cashierId);
    if (!mine.length) {
      localStorage.setItem(IMPORTED_KEY, "1");
      return;
    }
    importShifts(mine)
      .then(() => {
        localStorage.setItem(IMPORTED_KEY, "1");
        localStorage.removeItem(LEGACY_KEY);
      })
      .catch((err) => console.warn("Old shift import skipped:", err.message));
  }, [user?.uid, user?.cashierId, isCashier]);

  const activeShift = shifts.find((s) => s.status === "Active" && (!isCashier || s.cashierId === user?.cashierId)) || null;

  const open = useCallback((openingCash, notes) => openShift({ openingCash, notes }).then((s) => toView(s.id, s)), []);
  const close = useCallback((shiftId, closingCash, totals, notes) => closeShift(shiftId, { closingCash, totals, notes }).then((s) => toView(s.id, s)), []);

  return { shifts, activeShift, loading, error, open, close };
}
