/**
 * posBillQueue.js — Manages offline POS bills that failed to reach Firestore.
 *
 * Design:
 *  - Firestore document ID = localId (inv_<ts>_<rand>); setDoc retries are idempotent.
 *  - Human invoice number assigned via atomic counter transaction at sync time.
 *  - After MAX_RETRIES failures the bill is dropped and written to syncErrors.
 */

import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';

let _defaultDb = null;
async function resolveDb(passedDb) {
  if (passedDb) return passedDb;
  if (_defaultDb) return _defaultDb;
  try {
    const mod = await import('../lib/firebase/config.js');
    _defaultDb = mod.db;
  } catch (_) {}
  return _defaultDb;
}

const QUEUE_KEY = 'pos_pending_bills';
const MAX_RETRIES = 5;

function fyLabel() {
  const now = new Date();
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return fyYear + '-' + String(fyYear + 1).slice(-2);
}

function makeLocalId() {
  const rand = Math.random().toString(36).slice(2, 6);
  return 'inv_' + Date.now() + '_' + rand;
}

export function getPendingBills() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}

function savePendingBills(bills) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(bills)); } catch (_) {}
}

export function enqueueBill(payload) {
  const localId = payload.localId || makeLocalId();
  const bill = { localId, payload: { ...payload, localId }, queuedAt: new Date().toISOString(), retries: 0, lastError: null };
  const queue = getPendingBills();
  if (!queue.some((b) => b.localId === localId)) savePendingBills([...queue, bill]);
  return localId;
}

export function dequeueBill(localId) {
  savePendingBills(getPendingBills().filter((b) => b.localId !== localId));
}

async function assignInvoiceNumber(uid, localId, dbInstance) {
  const targetDb = await resolveDb(dbInstance);
  if (!targetDb) throw new Error("Firestore instance not available for invoice counter");
  const counterRef = doc(targetDb, 'users', uid, 'meta', 'invoiceCounter');
  const invoiceRef = doc(targetDb, 'users', uid, 'invoices', localId);
  return await runTransaction(targetDb, async (txn) => {
    const snap = await txn.get(counterRef);
    const next = (snap.exists() ? snap.data().value : 0) + 1;
    const label = next + '/' + fyLabel();
    txn.set(counterRef, { value: next }, { merge: true });
    txn.update(invoiceRef, { invoiceNumber: label });
    return label;
  });
}

export async function logSyncError(uid, bill, error, dbInstance) {
  if (!uid) return;
  try {
    const targetDb = await resolveDb(dbInstance);
    if (!targetDb) return;
    const ref = doc(collection(targetDb, 'users', uid, 'syncErrors'));
    await setDoc(ref, {
      localId: bill.localId,
      invoiceNumber: bill.payload?.invoiceNumber || null,
      customerName: bill.payload?.customerName || null,
      amount: bill.payload?.amount || null,
      cashier: bill.payload?.cashier || null,
      queuedAt: bill.queuedAt || null,
      retries: bill.retries || 0,
      error: error?.message || String(error),
      resolvedAt: serverTimestamp(),
      type: 'pos_sync_failure',
    });
  } catch (_) {}
}

export async function flushQueue(uid, dbInstance) {
  if (!uid) return { synced: 0, failed: 0 };
  const queue = getPendingBills();
  if (queue.length === 0) return { synced: 0, failed: 0 };
  const targetDb = await resolveDb(dbInstance);
  if (!targetDb) return { synced: 0, failed: queue.length };
  let synced = 0, failed = 0;
  const updatedBills = [];
  for (const bill of queue) {
    try {
      const { localId, payload } = bill;
      const invoiceRef = doc(targetDb, 'users', uid, 'invoices', localId);
      await setDoc(invoiceRef, { ...payload, invoiceNumber: null, userId: uid, syncedAt: serverTimestamp(), createdAt: serverTimestamp() });
      await assignInvoiceNumber(uid, localId, targetDb);
      dequeueBill(localId);
      synced++;
    } catch (err) {
      const updated = { ...bill, retries: (bill.retries || 0) + 1, lastError: err?.message || String(err) };
      if (updated.retries >= MAX_RETRIES) {
        await logSyncError(uid, updated, err, targetDb);
        dequeueBill(bill.localId);
      } else {
        updatedBills.push(updated);
      }
      failed++;
    }
  }
  if (updatedBills.length > 0) {
    const current = getPendingBills();
    savePendingBills(current.map((b) => updatedBills.find((r) => r.localId === b.localId) || b));
  }
  return { synced, failed };
}
