// POS device registration. A registered device holds a random secret; the
// backend keeps only its SHA-256 hash in posDevices/{deviceId} (no client
// access). A public copy without the hash goes to {business}/terminals so the
// owner and the Super Admin POS Terminals page can see it.
const crypto = require('crypto');
const { businessCollections, getBusinessRef } = require('../ai/businessRef');
const { sha256, revokeCashier, PosError } = require('./cashiers');

async function registerDevice({ db, businessUid, actorUid, name, counter, now = Date.now }) {
  const deviceName = String(name || '').trim().slice(0, 60) || 'POS device';
  const deviceCounter = String(counter || '').trim().slice(0, 40) || null;
  const deviceId = crypto.randomBytes(12).toString('hex');
  const deviceSecret = crypto.randomBytes(32).toString('base64url');
  const nowIso = new Date(now()).toISOString();

  await db.collection('posDevices').doc(deviceId).set({
    businessUid,
    name: deviceName,
    counter: deviceCounter,
    secretHash: sha256(deviceSecret),
    registeredAt: nowIso,
    registeredBy: actorUid,
    lastUsedAt: null,
    lastCashierId: null,
    cashierIds: [],
  });

  let businessName = null;
  try {
    const profile = await getBusinessRef(businessUid, db).get();
    businessName = profile.exists ? profile.data().companyName || null : null;
  } catch (_) {
    // name is cosmetic
  }
  await businessCollections.terminals(businessUid, db).doc(deviceId).set({
    terminalId: `POS-${deviceId.slice(0, 6).toUpperCase()}`,
    device: deviceName,
    deviceName,
    counter: deviceCounter,
    businessName,
    status: 'Active',
    appVersion: 'web',
    registeredAt: nowIso,
    lastPing: null,
    cashier: null,
  });

  // The secret is returned once and stored only on the device.
  return { deviceId, deviceSecret, name: deviceName, counter: deviceCounter, businessUid, registeredAt: nowIso };
}

async function listDevices({ db, businessUid }) {
  const snap = await db.collection('posDevices').where('businessUid', '==', businessUid).get();
  return snap.docs
    .map((d) => {
      const x = d.data();
      return { deviceId: d.id, name: x.name, counter: x.counter, registeredAt: x.registeredAt, lastUsedAt: x.lastUsedAt, lastCashierId: x.lastCashierId };
    })
    .sort((a, b) => String(b.registeredAt).localeCompare(String(a.registeredAt)));
}

async function removeDevice({ db, auth, businessUid, deviceId, actorUid, now = Date.now }) {
  const ref = db.collection('posDevices').doc(String(deviceId));
  const snap = await ref.get();
  if (!snap.exists || snap.data().businessUid !== businessUid) throw new PosError(404, 'Device not found.', 'NO_DEVICE');
  const cashierIds = snap.data().cashierIds || [];
  await ref.delete();
  await businessCollections.terminals(businessUid, db).doc(ref.id).delete();
  // Anyone who signed in on this device is signed out.
  for (const cashierId of cashierIds) {
    await revokeCashier({ db, auth, businessUid, cashierId, reason: 'device_removed', actorUid, now });
  }
  return { revoked: cashierIds };
}

module.exports = { registerDevice, listDevices, removeDevice };
