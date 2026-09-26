// Cashier identities: PIN login with lockout, custom tokens, and revocation.
// The public cashier list (names, counters, status) stays in settings/app;
// PIN hashes and lockout state live in cashierSecrets, which no client can read.
const crypto = require('crypto');
const { businessCollections } = require('../ai/businessRef');
const { hashPin, verifyPin, isValidPin } = require('./pins');

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

class PosError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const normalizeCashierId = (id) => String(id || '').trim().toUpperCase().slice(0, 40);
const cashierUid = (businessUid, cashierId) => `csh_${businessUid}_${normalizeCashierId(cashierId)}`.slice(0, 128);
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

function safeEqualHex(a, b) {
  const x = Buffer.from(String(a || ''), 'hex');
  const y = Buffer.from(String(b || ''), 'hex');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

async function readCashierList(db, businessUid) {
  const snap = await businessCollections.settings(businessUid, db).doc('app').get();
  const data = snap.exists ? snap.data() : {};
  const raw = data?.cashiers?.value || data?.cashiers || [];
  return Array.isArray(raw) ? raw : [];
}

function findCashier(list, identifier) {
  if (!list || !Array.isArray(list)) return null;
  const raw = String(identifier || '').trim().toLowerCase();
  const id = normalizeCashierId(identifier);
  const digits = raw.replace(/\D/g, '');
  return (
    list.find((c) => {
      if (normalizeCashierId(c.cashierId) === id) return true;
      if (c.email && String(c.email).trim().toLowerCase() === raw) return true;
      if (digits.length >= 10 && c.phone && String(c.phone).replace(/\D/g, '').endsWith(digits.slice(-10))) return true;
      return false;
    }) || null
  );
}

async function logSecurity(db, businessUid, entry, now) {
  try {
    await businessCollections.securityLogs(businessUid, db).add({ ...entry, at: new Date(now()).toISOString() });
  } catch (err) {
    console.error('securityLogs write failed:', err.message);
  }
}

// Ends a cashier's sessions: refresh tokens revoked (no new ID tokens) and a
// validAfter mark that Firestore rules and the backend check for current ones.
async function revokeCashier({ db, auth, businessUid, cashierId, reason, actorUid = null, now = Date.now }) {
  const id = normalizeCashierId(cashierId);
  const uid = cashierUid(businessUid, id);
  const validAfterSec = Math.floor(now() / 1000);
  await businessCollections.cashierSecrets(businessUid, db).doc(id).set({ validAfterSec, updatedAt: new Date(now()).toISOString() }, { merge: true });
  try {
    await auth.revokeRefreshTokens(uid);
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err; // never signed in: nothing to revoke
  }
  await logSecurity(db, businessUid, { type: 'cashier_sessions_revoked', cashierId: id, reason, actorUid }, now);
  return { uid, validAfterSec };
}

async function setCashierPin({ db, auth, businessUid, cashierId, pin, actorUid, now = Date.now }) {
  if (!isValidPin(pin)) throw new PosError(400, 'The PIN must be exactly 4 digits.', 'BAD_PIN');
  const id = normalizeCashierId(cashierId);
  const list = await readCashierList(db, businessUid);
  if (!findCashier(list, id)) throw new PosError(404, `No cashier ${id}.`, 'NO_CASHIER');
  await businessCollections.cashierSecrets(businessUid, db).doc(id).set(
    { pinHash: await hashPin(pin), pinSetAt: new Date(now()).toISOString(), failedCount: 0, lockedUntil: null },
    { merge: true }
  );
  await revokeCashier({ db, auth, businessUid, cashierId: id, reason: 'pin_changed', actorUid, now });
}

async function setCashierActive({ db, auth, businessUid, cashierId, active, actorUid, now = Date.now }) {
  const id = normalizeCashierId(cashierId);
  await businessCollections.cashierSecrets(businessUid, db).doc(id).set({ active: Boolean(active), updatedAt: new Date(now()).toISOString() }, { merge: true });
  if (!active) await revokeCashier({ db, auth, businessUid, cashierId: id, reason: 'deactivated', actorUid, now });
}

async function removeCashierSecrets({ db, auth, businessUid, cashierId, actorUid, now = Date.now }) {
  const id = normalizeCashierId(cashierId);
  await revokeCashier({ db, auth, businessUid, cashierId: id, reason: 'removed', actorUid, now });
  await businessCollections.cashierSecrets(businessUid, db).doc(id).set({ active: false, pinHash: null }, { merge: true });
}

async function cashierStatuses({ db, businessUid, now = Date.now }) {
  const list = await readCashierList(db, businessUid);
  const snaps = await Promise.all(list.map((c) => businessCollections.cashierSecrets(businessUid, db).doc(normalizeCashierId(c.cashierId)).get()));
  return list.map((c, i) => {
    const s = snaps[i].exists ? snaps[i].data() : {};
    const lockedUntil = s.lockedUntil && Date.parse(s.lockedUntil) > now() ? s.lockedUntil : null;
    return {
      cashierId: normalizeCashierId(c.cashierId),
      pinSet: Boolean(s.pinHash),
      active: s.active !== false && (c.status || 'Active') !== 'Inactive',
      lockedUntil,
      lastLoginAt: s.lastLoginAt || null,
    };
  });
}

/**
 * Checks device + cashier ID + PIN and returns a Firebase custom token.
 * Wrong PINs count towards a 15-minute lock after 5 failures; every failure is logged.
 */
async function loginCashier({ db, auth, deviceId, deviceSecret, cashierId, pin, ip = null, userAgent = null, now = Date.now }) {
  const deviceRef = db.collection('posDevices').doc(String(deviceId || 'none').slice(0, 64));
  const deviceSnap = await deviceRef.get();
  const device = deviceSnap.exists ? deviceSnap.data() : null;
  if (!device || !safeEqualHex(sha256(deviceSecret), device.secretHash)) {
    throw new PosError(401, 'This device is not registered for POS. Ask the owner to register it in Cashier Management.', 'DEVICE_NOT_REGISTERED');
  }
  const businessUid = device.businessUid;
  let id = normalizeCashierId(cashierId);
  const base = { cashierId: id, deviceId: deviceRef.id, ip, userAgent };
  const fail = async (status, message, code, extra = {}) => {
    await logSecurity(db, businessUid, { type: 'cashier_login_failed', reason: code, ...base, ...extra }, now);
    throw new PosError(status, message, code);
  };

  const cashier = findCashier(await readCashierList(db, businessUid), cashierId);
  if (!cashier) return fail(401, 'Wrong cashier ID or PIN.', 'BAD_CREDENTIALS');

  id = normalizeCashierId(cashier.cashierId);
  base.cashierId = id;
  const secretRef = businessCollections.cashierSecrets(businessUid, db).doc(id);
  const secret = (await secretRef.get()).data() || {};
  if (secret.lockedUntil && Date.parse(secret.lockedUntil) > now()) {
    const mins = Math.ceil((Date.parse(secret.lockedUntil) - now()) / 60000);
    return fail(423, `Too many wrong PINs. ${id} is locked for ${mins} more minute${mins === 1 ? '' : 's'}.`, 'LOCKED');
  }
  if ((cashier.status || 'Active') === 'Inactive' || secret.active === false) return fail(403, `Cashier ${id} is inactive. Ask the owner to reactivate it.`, 'INACTIVE');
  if (!secret.pinHash) return fail(403, `No PIN is set for ${id}. Ask the owner to set one in Cashier Management.`, 'PIN_NOT_SET');

  const ok = await verifyPin(pin, secret.pinHash);
  if (!ok) {
    // Count the failure atomically; lock on the 5th.
    const outcome = await db.runTransaction(async (tx) => {
      const cur = (await tx.get(secretRef)).data() || {};
      const failed = (Number(cur.failedCount) || 0) + 1;
      if (failed >= MAX_FAILED) {
        tx.set(secretRef, { failedCount: 0, lockedUntil: new Date(now() + LOCK_MS).toISOString() }, { merge: true });
        return { locked: true, failed };
      }
      tx.set(secretRef, { failedCount: failed }, { merge: true });
      return { locked: false, failed };
    });
    if (outcome.locked) return fail(423, `Too many wrong PINs. ${id} is locked for 15 minutes.`, 'LOCKED_NOW', { attempt: outcome.failed });
    return fail(401, `Wrong cashier ID or PIN. ${MAX_FAILED - outcome.failed} attempt${MAX_FAILED - outcome.failed === 1 ? '' : 's'} left before a 15-minute lock.`, 'BAD_CREDENTIALS', { attempt: outcome.failed });
  }

  const nowIso = new Date(now()).toISOString();
  const counter = device.counter || cashier.counter || null;
  await secretRef.set({ failedCount: 0, lockedUntil: null, lastLoginAt: nowIso, lastDeviceId: deviceRef.id }, { merge: true });
  const cashierIds = Array.from(new Set([...(device.cashierIds || []), id])).slice(-50);
  await deviceRef.set({ lastUsedAt: nowIso, lastCashierId: id, cashierIds }, { merge: true });
  await businessCollections.terminals(businessUid, db).doc(deviceRef.id).set({ lastPing: nowIso, cashier: cashier.name || id, status: 'Active' }, { merge: true });
  await logSecurity(db, businessUid, { type: 'cashier_login', ...base }, now);

  const uid = cashierUid(businessUid, id);
  const claims = { role: 'cashier', businessUid, cashierId: id, cashierName: String(cashier.name || id).slice(0, 40), counter, deviceId: deviceRef.id };
  const token = await auth.createCustomToken(uid, claims);
  return { token, claims, cashier: { cashierId: id, name: cashier.name || id, counter } };
}

module.exports = {
  PosError,
  MAX_FAILED,
  LOCK_MS,
  normalizeCashierId,
  cashierUid,
  sha256,
  readCashierList,
  revokeCashier,
  setCashierPin,
  setCashierActive,
  removeCashierSecrets,
  cashierStatuses,
  loginCashier,
};
