// POS shifts in Firestore ({business}/posShifts). Opening a shift takes two
// lock documents in one transaction (one per cashier, one per counter), so a
// cashier or a counter can have only one open shift at a time.
const { businessCollections } = require('../ai/businessRef');
const { PosError, normalizeCashierId } = require('./cashiers');

const counterKey = (counter) => `counter_${String(counter || 'none').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
const cashierKey = (cashierId) => `cashier_${normalizeCashierId(cashierId)}`;
const money = (v) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);

function describeOpen(lock) {
  const since = lock.openedAt ? new Date(lock.openedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }) : 'earlier';
  return `shift #${lock.shiftNumber} (${lock.cashierName || lock.cashierId}, ${lock.counter || 'no counter'}, open since ${since})`;
}

async function openShift({ db, businessUid, cashier, counter, openingCash, notes = '', now = Date.now }) {
  const cashierId = normalizeCashierId(cashier.cashierId);
  const locks = businessCollections.posShiftLocks(businessUid, db);
  const cashierLockRef = locks.doc(cashierKey(cashierId));
  const counterLockRef = locks.doc(counterKey(counter));
  const seqRef = locks.doc('_sequence');
  const shiftRef = businessCollections.posShifts(businessUid, db).doc();

  return db.runTransaction(async (tx) => {
    const [cashierLock, counterLock, seq] = await Promise.all([tx.get(cashierLockRef), tx.get(counterLockRef), tx.get(seqRef)]);
    if (cashierLock.exists) {
      throw new PosError(409, `You already have an open ${describeOpen(cashierLock.data())}. Close it before opening another.`, 'CASHIER_SHIFT_OPEN');
    }
    if (counterLock.exists) {
      throw new PosError(409, `${counter} already has an open ${describeOpen(counterLock.data())}. It must be closed first.`, 'COUNTER_SHIFT_OPEN');
    }
    const shiftNumber = (seq.exists ? Number(seq.data().last) || 100 : 100) + 1;
    const openedAt = new Date(now()).toISOString();
    const shift = {
      shiftNumber,
      cashierId,
      cashierName: cashier.name || cashierId,
      counter: counter || null,
      status: 'Open',
      openedAt,
      closedAt: null,
      openingCash: money(openingCash),
      cashSales: 0,
      upiSales: 0,
      cardSales: 0,
      refunds: 0,
      closingCash: null,
      notes: String(notes || '').slice(0, 300),
    };
    const lock = { shiftId: shiftRef.id, shiftNumber, cashierId, cashierName: shift.cashierName, counter: shift.counter, openedAt };
    tx.set(shiftRef, shift);
    tx.set(cashierLockRef, lock);
    tx.set(counterLockRef, lock);
    tx.set(seqRef, { last: shiftNumber });
    return { id: shiftRef.id, ...shift };
  });
}

async function closeShift({ db, businessUid, actor, shiftId, closingCash, totals = {}, notes, now = Date.now }) {
  const shiftRef = businessCollections.posShifts(businessUid, db).doc(String(shiftId));
  const locks = businessCollections.posShiftLocks(businessUid, db);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(shiftRef);
    if (!snap.exists) throw new PosError(404, 'Shift not found.', 'NO_SHIFT');
    const shift = snap.data();
    if (actor.role === 'cashier' && shift.cashierId !== normalizeCashierId(actor.cashierId)) throw new PosError(403, 'You can only close your own shift.', 'NOT_YOUR_SHIFT');
    if (shift.status !== 'Open') throw new PosError(409, `Shift #${shift.shiftNumber} is already closed.`, 'ALREADY_CLOSED');
    const cashierLockRef = locks.doc(cashierKey(shift.cashierId));
    const counterLockRef = locks.doc(counterKey(shift.counter));
    const [cl, ctl] = await Promise.all([tx.get(cashierLockRef), tx.get(counterLockRef)]);
    const update = {
      status: 'Closed',
      closedAt: new Date(now()).toISOString(),
      closingCash: money(closingCash),
      cashSales: money(totals.cashSales ?? shift.cashSales),
      upiSales: money(totals.upiSales ?? shift.upiSales),
      cardSales: money(totals.cardSales ?? shift.cardSales),
      ...(notes ? { notes: String(notes).slice(0, 300) } : {}),
    };
    tx.update(shiftRef, update);
    if (cl.exists && cl.data().shiftId === shiftRef.id) tx.delete(cashierLockRef);
    if (ctl.exists && ctl.data().shiftId === shiftRef.id) tx.delete(counterLockRef);
    return { id: shiftRef.id, ...shift, ...update };
  });
}

// Adds a refund to the cashier's open shift (used by sales returns).
async function addRefund({ db, businessUid, cashierId, amount }) {
  const lockRef = businessCollections.posShiftLocks(businessUid, db).doc(cashierKey(cashierId));
  return db.runTransaction(async (tx) => {
    const lock = await tx.get(lockRef);
    if (!lock.exists) return null; // no open shift: the return is still recorded on the bill side
    const shiftRef = businessCollections.posShifts(businessUid, db).doc(lock.data().shiftId);
    const shift = await tx.get(shiftRef);
    if (!shift.exists) return null;
    const refunds = money((Number(shift.data().refunds) || 0) + money(amount));
    tx.update(shiftRef, { refunds });
    return { id: shiftRef.id, refunds };
  });
}

// One-time copy of shifts saved in a device's browser. Only closed shifts are
// imported; the old built-in demo shifts are skipped.
async function importShifts({ db, businessUid, cashier, shifts }) {
  const col = businessCollections.posShifts(businessUid, db);
  let imported = 0;
  for (const s of (Array.isArray(shifts) ? shifts : []).slice(0, 50)) {
    if (!s || s.status === 'Open' || s.isDemo || [101, 102].includes(Number(s.shiftNumber))) continue;
    const id = `import_${normalizeCashierId(cashier.cashierId)}_${String(s.id || s.shiftNumber).replace(/[^\w-]/g, '').slice(0, 40)}`;
    await col.doc(id).set({
      shiftNumber: Number(s.shiftNumber) || null,
      cashierId: normalizeCashierId(cashier.cashierId),
      cashierName: s.cashierName || cashier.name || cashier.cashierId,
      counter: s.counterNumber || s.counter || null,
      status: 'Closed',
      openedAt: s.openedAt || s.startTime || null,
      closedAt: s.closedAt || s.endTime || null,
      openingCash: money(s.openingCash),
      cashSales: money(s.cashSales),
      upiSales: money(s.upiSales),
      cardSales: money(s.cardSales),
      refunds: money(s.refunds),
      closingCash: s.closingCash === undefined ? null : money(s.closingCash),
      imported: true,
    });
    imported += 1;
  }
  return { imported };
}

module.exports = { openShift, closeShift, addRefund, importShifts, counterKey, cashierKey };
