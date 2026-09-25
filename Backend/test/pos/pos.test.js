// Backend authentication, cashier logins, lockout, revocation, devices, shifts.
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { createFakeFirestore, createFakeAuth } = require('../helpers/fakeFirebase');
const { verifyAuthHeader, requireAuth } = require('../../auth/verifyToken');
const { initFirebaseAdmin } = require('../../firebaseAdmin');
const { hashPin, verifyPin, isValidPin } = require('../../pos/pins');
const cashiers = require('../../pos/cashiers');
const devices = require('../../pos/devices');
const shifts = require('../../pos/shifts');
const { createPosRouter } = require('../../pos/router');
const { canUseContext, canRunIntent, canManageAliases } = require('../../ai/permissions');

const BIZ = 'owner_uid_1';
const T0 = Date.parse('2026-09-26T10:00:00Z');

function setup() {
  let t = T0;
  const clock = { now: () => t, advance: (ms) => (t += ms) };
  const db = createFakeFirestore();
  const auth = createFakeAuth({ now: clock.now });
  return { db, auth, clock };
}

async function seedBusiness(db, { pin1 = '1234' } = {}) {
  await db.doc(`users/${BIZ}/settings/app`).set({
    cashiers: {
      value: [
        { cashierId: 'CSH-001', name: 'Arun', counter: 'Counter 01', status: 'Active' },
        { cashierId: 'CSH-002', name: 'Bala', counter: 'Counter 02', status: 'Inactive' },
        { cashierId: 'CSH-003', name: 'Chitra', counter: 'Counter 03', status: 'Active' },
      ],
    },
  });
  if (pin1) await db.doc(`users/${BIZ}/cashierSecrets/CSH-001`).set({ pinHash: await hashPin(pin1) });
  await db.doc(`users/${BIZ}/cashierSecrets/CSH-002`).set({ pinHash: await hashPin('2222') });
}

async function device(db, clock) {
  return devices.registerDevice({ db, businessUid: BIZ, actorUid: BIZ, name: 'Front counter tablet', counter: 'Counter 01', now: clock.now });
}

const login = (env, dev, cashierId, pin) =>
  cashiers.loginCashier({ db: env.db, auth: env.auth, deviceId: dev.deviceId, deviceSecret: dev.deviceSecret, cashierId, pin, ip: '10.0.0.5', now: env.clock.now });

const failures = (db) => Object.values(db.dump(`users/${BIZ}/securityLogs/`)).filter((l) => l.type === 'cashier_login_failed');

describe('token verification', () => {
  test('missing or malformed header is 401', async () => {
    const auth = createFakeAuth();
    await assert.rejects(verifyAuthHeader(undefined, { auth }), (e) => e.status === 401 && e.code === 'NO_TOKEN');
    await assert.rejects(verifyAuthHeader('tok_1', { auth }), (e) => e.status === 401, 'no Bearer prefix');
  });

  test('an unverifiable token is rejected; its claims are never trusted', async () => {
    const auth = createFakeAuth();
    // A hand-made JWT the old fallback would have decoded and trusted:
    const forged = ['e30', Buffer.from(JSON.stringify({ user_id: 'victim', email: 'x@y.z' })).toString('base64'), 'sig'].join('.');
    await assert.rejects(verifyAuthHeader(`Bearer ${forged}`, { auth }), (e) => e.status === 401 && e.code === 'INVALID_TOKEN');
  });

  test('owner, warehouse and cashier identities come from verified claims', async () => {
    const auth = createFakeAuth();
    const owner = await verifyAuthHeader(`Bearer ${auth.issue({ uid: 'o1', email: 'shop@x.in' })}`, { auth });
    assert.deepEqual([owner.role, owner.businessUid], ['owner', 'o1']);
    const wh = await verifyAuthHeader(`Bearer ${auth.issue({ uid: 'w1', email: 'wh.store@x.in' })}`, { auth });
    assert.equal(wh.role, 'warehouse');
    const cashier = await verifyAuthHeader(`Bearer ${auth.issue({ uid: 'csh_o1_CSH-001', role: 'cashier', businessUid: 'o1', cashierId: 'CSH-001', counter: 'Counter 01' })}`, { auth });
    assert.deepEqual([cashier.role, cashier.businessUid, cashier.cashierId, cashier.counter], ['cashier', 'o1', 'CSH-001', 'Counter 01']);
  });

  test('requireAuth enforces roles', async () => {
    const auth = createFakeAuth();
    const app = express();
    app.get('/owner-only', requireAuth({ roles: ['owner'], auth }), (req, res) => res.json({ ok: true }));
    const server = app.listen(0);
    const url = `http://localhost:${server.address().port}/owner-only`;
    try {
    const cashierTok = auth.issue({ uid: 'c', role: 'cashier', businessUid: 'o1', cashierId: 'CSH-001' });
    const ownerTok = auth.issue({ uid: 'o1', email: 'o@x.in' });
    assert.equal((await fetch(url, { headers: { authorization: `Bearer ${cashierTok}` } })).status, 403);
    assert.equal((await fetch(url, { headers: { authorization: `Bearer ${ownerTok}` } })).status, 200);
    assert.equal((await fetch(url)).status, 401);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });

  test('server.js has no unverified-token fallback left', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');
    assert.equal(/Development fallback|payload\.user_id|Buffer\.from\(parts\[1\]/.test(src), false);
    assert.equal(/initializeApp\(\{\s*projectId/.test(src), false, 'no credential-less init');
  });
});

describe('startup credentials', () => {
  const fakeAdmin = () => {
    const calls = [];
    return {
      calls,
      apps: [],
      credential: { cert: (x) => ({ cert: x }), applicationDefault: () => ({ adc: true }) },
      initializeApp: (opts) => calls.push(opts),
    };
  };
  test('refuses to start without credentials', () => {
    const admin = fakeAdmin();
    assert.throws(() => initFirebaseAdmin({ admin, fs: { existsSync: () => false }, env: {} }), (e) => e.code === 'NO_CREDENTIALS' && /README/.test(e.message));
    assert.equal(admin.calls.length, 0);
  });
  test('uses the service account key file when present', () => {
    const admin = fakeAdmin();
    initFirebaseAdmin({ admin, fs: { existsSync: () => true, readFileSync: () => '{"project_id":"dev"}' }, env: {}, keyPath: 'k.json' });
    assert.deepEqual(admin.calls[0], { credential: { cert: { project_id: 'dev' } } });
  });
  test('or GOOGLE_APPLICATION_CREDENTIALS', () => {
    const admin = fakeAdmin();
    initFirebaseAdmin({ admin, fs: { existsSync: (p) => p === '/keys/dev.json' }, env: { GOOGLE_APPLICATION_CREDENTIALS: '/keys/dev.json' }, keyPath: 'missing.json' });
    assert.deepEqual(admin.calls[0], { credential: { adc: true } });
  });
});

describe('PINs', () => {
  test('stored as bcrypt hashes and verified', async () => {
    const hash = await hashPin('4321');
    assert.match(hash, /^\$2[aby]\$10\$/);
    assert.equal(hash.includes('4321'), false);
    assert.equal(await verifyPin('4321', hash), true);
    assert.equal(await verifyPin('1234', hash), false);
    assert.equal(await verifyPin('4321', null), false);
  });
  test('must be exactly 4 digits', () => {
    for (const ok of ['0000', '1234']) assert.equal(isValidPin(ok), true);
    for (const bad of ['123', '12345', 'abcd', '', null]) assert.equal(isValidPin(bad), false);
  });
});

describe('cashier login and lockout', () => {
  let env;
  let dev;
  beforeEach(async () => {
    env = setup();
    await seedBusiness(env.db);
    dev = await device(env.db, env.clock);
  });

  test('correct PIN returns a custom token with cashier claims', async () => {
    const out = await login(env, dev, 'csh-001', '1234');
    assert.equal(out.token, `custom_csh_${BIZ}_CSH-001`);
    assert.deepEqual(env.auth.customTokens[0].claims, { role: 'cashier', businessUid: BIZ, cashierId: 'CSH-001', cashierName: 'Arun', counter: 'Counter 01', deviceId: dev.deviceId });
  });

  test('unregistered device or wrong device secret is refused', async () => {
    await assert.rejects(login(env, { ...dev, deviceSecret: 'nope' }, 'CSH-001', '1234'), (e) => e.code === 'DEVICE_NOT_REGISTERED');
    await assert.rejects(login(env, { deviceId: 'unknown', deviceSecret: 'x' }, 'CSH-001', '1234'), (e) => e.code === 'DEVICE_NOT_REGISTERED');
  });

  test('5 wrong PINs lock the ID for 15 minutes; every failure is logged', async () => {
    for (let i = 1; i <= 4; i += 1) await assert.rejects(login(env, dev, 'CSH-001', '0000'), (e) => e.code === 'BAD_CREDENTIALS' && e.message.includes(`${5 - i} attempt`));
    await assert.rejects(login(env, dev, 'CSH-001', '0000'), (e) => e.status === 423 && e.code === 'LOCKED_NOW');
    await assert.rejects(login(env, dev, 'CSH-001', '1234'), (e) => e.status === 423 && e.code === 'LOCKED', 'the right PIN is refused while locked');
    assert.equal(failures(env.db).length, 6);
    assert.ok(failures(env.db).every((f) => f.cashierId === 'CSH-001' && f.ip === '10.0.0.5' && f.at));

    env.clock.advance(14 * 60 * 1000);
    await assert.rejects(login(env, dev, 'CSH-001', '1234'), (e) => e.code === 'LOCKED' && /1 more minute/.test(e.message));
    env.clock.advance(61 * 1000);
    assert.ok((await login(env, dev, 'CSH-001', '1234')).token, 'unlocked after 15 minutes');
  });

  test('a successful login resets the failure count', async () => {
    for (let i = 0; i < 4; i += 1) await assert.rejects(login(env, dev, 'CSH-001', '0000'));
    await login(env, dev, 'CSH-001', '1234');
    for (let i = 0; i < 4; i += 1) await assert.rejects(login(env, dev, 'CSH-001', '0000'), (e) => e.code === 'BAD_CREDENTIALS');
  });

  test('inactive cashiers cannot log in, even with the right PIN', async () => {
    await assert.rejects(login(env, dev, 'CSH-002', '2222'), (e) => e.status === 403 && e.code === 'INACTIVE');
    await cashiers.setCashierActive({ db: env.db, auth: env.auth, businessUid: BIZ, cashierId: 'CSH-001', active: false, actorUid: BIZ, now: env.clock.now });
    await assert.rejects(login(env, dev, 'CSH-001', '1234'), (e) => e.code === 'INACTIVE');
  });

  test('a cashier without a PIN is blocked until the owner sets one', async () => {
    await assert.rejects(login(env, dev, 'CSH-003', '1234'), (e) => e.code === 'PIN_NOT_SET');
    await cashiers.setCashierPin({ db: env.db, auth: env.auth, businessUid: BIZ, cashierId: 'CSH-003', pin: '9876', actorUid: BIZ, now: env.clock.now });
    assert.ok((await login(env, dev, 'CSH-003', '9876')).token);
  });

  test('unknown cashier IDs get the same message and are logged', async () => {
    await assert.rejects(login(env, dev, 'CSH-999', '1234'), (e) => e.message === 'Wrong cashier ID or PIN.');
    assert.equal(failures(env.db)[0].cashierId, 'CSH-999');
  });

  test('no plain-text PIN is written anywhere', async () => {
    await cashiers.setCashierPin({ db: env.db, auth: env.auth, businessUid: BIZ, cashierId: 'CSH-003', pin: '5555', actorUid: BIZ, now: env.clock.now });
    await login(env, dev, 'CSH-003', '5555');
    assert.equal(JSON.stringify(env.db.dump()).includes('5555'), false);
  });
});

describe('token revocation', () => {
  let env;
  let dev;
  beforeEach(async () => {
    env = setup();
    await seedBusiness(env.db);
    dev = await device(env.db, env.clock);
  });

  async function signedInCashier() {
    await login(env, dev, 'CSH-001', '1234');
    return env.auth.issue({ uid: `csh_${BIZ}_CSH-001`, role: 'cashier', businessUid: BIZ, cashierId: 'CSH-001' });
  }
  const accepted = (tok) => verifyAuthHeader(`Bearer ${tok}`, { auth: env.auth }).then(() => true, (e) => (e.code === 'REVOKED' ? false : Promise.reject(e)));

  for (const [label, act] of [
    ['deactivating the cashier', () => cashiers.setCashierActive({ db: env.db, auth: env.auth, businessUid: BIZ, cashierId: 'CSH-001', active: false, actorUid: BIZ, now: env.clock.now })],
    ['changing their PIN', () => cashiers.setCashierPin({ db: env.db, auth: env.auth, businessUid: BIZ, cashierId: 'CSH-001', pin: '4444', actorUid: BIZ, now: env.clock.now })],
    ['removing the device they used', () => devices.removeDevice({ db: env.db, auth: env.auth, businessUid: BIZ, deviceId: dev.deviceId, actorUid: BIZ, now: env.clock.now })],
  ]) {
    test(`${label} revokes their sessions`, async () => {
      const tok = await signedInCashier();
      assert.equal(await accepted(tok), true);
      env.clock.advance(1000);
      await act();
      assert.deepEqual(env.auth.revokeCalls, [`csh_${BIZ}_CSH-001`]);
      assert.equal(await accepted(tok), false, 'the existing ID token is refused by the backend');
      const secret = (await env.db.doc(`users/${BIZ}/cashierSecrets/CSH-001`).get()).data();
      assert.equal(secret.validAfterSec, Math.floor(env.clock.now() / 1000), 'Firestore rules cut-off is set');
      assert.ok(Object.values(env.db.dump(`users/${BIZ}/securityLogs/`)).some((l) => l.type === 'cashier_sessions_revoked'));
    });
  }

  test('reactivating does not revoke', async () => {
    await cashiers.setCashierActive({ db: env.db, auth: env.auth, businessUid: BIZ, cashierId: 'CSH-001', active: true, actorUid: BIZ, now: env.clock.now });
    assert.equal(env.auth.revokeCalls.length, 0);
  });
});

describe('devices', () => {
  test('only a hash of the secret is stored; terminals copy has no secret', async () => {
    const env = setup();
    const dev = await device(env.db, env.clock);
    const all = JSON.stringify(env.db.dump());
    assert.equal(all.includes(dev.deviceSecret), false);
    const terminal = (await env.db.doc(`users/${BIZ}/terminals/${dev.deviceId}`).get()).data();
    assert.equal('secretHash' in terminal, false);
    assert.equal(terminal.device, 'Front counter tablet');
    const list = await devices.listDevices({ db: env.db, businessUid: BIZ });
    assert.deepEqual(Object.keys(list[0]).sort(), ['counter', 'deviceId', 'lastCashierId', 'lastUsedAt', 'name', 'registeredAt']);
  });

  test("an owner cannot remove another business's device", async () => {
    const env = setup();
    const dev = await device(env.db, env.clock);
    await assert.rejects(devices.removeDevice({ db: env.db, auth: env.auth, businessUid: 'other', deviceId: dev.deviceId, actorUid: 'other' }), (e) => e.status === 404);
  });
});

describe('shifts', () => {
  const arun = { cashierId: 'CSH-001', name: 'Arun' };
  const bala = { cashierId: 'CSH-002', name: 'Bala' };

  test('one open shift per cashier and per counter', async () => {
    const { db, clock } = setup();
    const s1 = await shifts.openShift({ db, businessUid: BIZ, cashier: arun, counter: 'Counter 01', openingCash: 2000, now: clock.now });
    assert.equal(s1.shiftNumber, 101);
    await assert.rejects(
      shifts.openShift({ db, businessUid: BIZ, cashier: arun, counter: 'Counter 02', openingCash: 0, now: clock.now }),
      (e) => e.status === 409 && e.code === 'CASHIER_SHIFT_OPEN' && /shift #101 \(Arun, Counter 01/.test(e.message)
    );
    await assert.rejects(
      shifts.openShift({ db, businessUid: BIZ, cashier: bala, counter: 'Counter 01', openingCash: 0, now: clock.now }),
      (e) => e.code === 'COUNTER_SHIFT_OPEN' && /Counter 01 already has an open shift #101 \(Arun/.test(e.message)
    );
    const s2 = await shifts.openShift({ db, businessUid: BIZ, cashier: bala, counter: 'Counter 02', openingCash: 0, now: clock.now });
    assert.equal(s2.shiftNumber, 102);
  });

  test('closing frees the cashier and the counter; cashiers close only their own', async () => {
    const { db, clock } = setup();
    const s1 = await shifts.openShift({ db, businessUid: BIZ, cashier: arun, counter: 'Counter 01', openingCash: 1000, now: clock.now });
    await assert.rejects(shifts.closeShift({ db, businessUid: BIZ, actor: { role: 'cashier', cashierId: 'CSH-002' }, shiftId: s1.id, closingCash: 0 }), (e) => e.code === 'NOT_YOUR_SHIFT');
    const closed = await shifts.closeShift({ db, businessUid: BIZ, actor: { role: 'cashier', cashierId: 'CSH-001' }, shiftId: s1.id, closingCash: 5400, totals: { cashSales: 4400 }, now: clock.now });
    assert.deepEqual([closed.status, closed.closingCash, closed.cashSales], ['Closed', 5400, 4400]);
    await assert.rejects(shifts.closeShift({ db, businessUid: BIZ, actor: { role: 'owner' }, shiftId: s1.id, closingCash: 0 }), (e) => e.code === 'ALREADY_CLOSED');
    assert.ok(await shifts.openShift({ db, businessUid: BIZ, cashier: bala, counter: 'Counter 01', openingCash: 0, now: clock.now }));
  });

  test('refunds go to the open shift', async () => {
    const { db, clock } = setup();
    const s1 = await shifts.openShift({ db, businessUid: BIZ, cashier: arun, counter: 'Counter 01', openingCash: 0, now: clock.now });
    await shifts.addRefund({ db, businessUid: BIZ, cashierId: 'CSH-001', amount: 120.5 });
    await shifts.addRefund({ db, businessUid: BIZ, cashierId: 'CSH-001', amount: 30 });
    assert.equal((await db.doc(`users/${BIZ}/posShifts/${s1.id}`).get()).data().refunds, 150.5);
    assert.equal(await shifts.addRefund({ db, businessUid: BIZ, cashierId: 'CSH-002', amount: 10 }), null, 'no open shift');
  });

  test('import skips open shifts and the old demo rows', async () => {
    const { db } = setup();
    const out = await shifts.importShifts({
      db,
      businessUid: BIZ,
      cashier: arun,
      shifts: [
        { id: 'a', shiftNumber: 101, status: 'Closed' },
        { id: 'b', shiftNumber: 102, status: 'Closed' },
        { id: 'c', shiftNumber: 103, status: 'Open' },
        { id: 'd', shiftNumber: 104, status: 'Closed', cashSales: 900 },
      ],
    });
    assert.equal(out.imported, 1);
  });
});

describe('/api/pos routes', () => {
  async function start() {
    const env = setup();
    await seedBusiness(env.db);
    const app = express();
    app.use(express.json());
    app.use('/api/pos', createPosRouter({ db: env.db, auth: env.auth, now: env.clock.now, loginLimit: 8 }));
    const server = app.listen(0);
    const base = `http://localhost:${server.address().port}/api/pos`;
    const call = (method, p, { token, body } = {}) =>
      fetch(`${base}${p}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined });
    const stop = () => {
      server.closeAllConnections();
      server.close();
    };
    return { env, server, call, stop };
  }

  test('owner registers a device, cashier logs in, cashier is kept out of owner routes', async () => {
    const { env, call, stop } = await start();
    try {
      const owner = env.auth.issue({ uid: BIZ, email: 'shop@x.in' });
      const reg = await call('POST', '/devices', { token: owner, body: { name: 'Till 1', counter: 'Counter 01' } });
      assert.equal(reg.status, 201);
      const dev = await reg.json();

      const ok = await call('POST', '/cashier-login', { body: { deviceId: dev.deviceId, deviceSecret: dev.deviceSecret, cashierId: 'CSH-001', pin: '1234' } });
      assert.equal(ok.status, 200);
      assert.equal((await ok.json()).cashier.name, 'Arun');

      const cashier = env.auth.issue({ uid: `csh_${BIZ}_CSH-001`, role: 'cashier', businessUid: BIZ, cashierId: 'CSH-001', counter: 'Counter 01' });
      for (const [m, p] of [['GET', '/devices'], ['GET', '/cashiers'], ['POST', '/cashiers/CSH-001/pin'], ['POST', '/cashiers/CSH-001/status'], ['DELETE', `/devices/${dev.deviceId}`]]) {
        assert.equal((await call(m, p, { token: cashier, body: {} })).status, 403, `${m} ${p}`);
      }
      const open = await call('POST', '/shifts/open', { token: cashier, body: { openingCash: 500 } });
      assert.equal(open.status, 201);
      assert.equal((await open.json()).shift.counter, 'Counter 01', 'counter comes from the token');
      const again = await call('POST', '/shifts/open', { token: cashier, body: { openingCash: 500 } });
      assert.equal(again.status, 409);
    } finally {
      stop();
    }
  });

  test('login is rate limited per IP on top of the per-cashier lock', async () => {
    const { call, stop } = await start();
    try {
      let last;
      for (let i = 0; i < 9; i += 1) last = await call('POST', '/cashier-login', { body: { deviceId: 'x', deviceSecret: 'y', cashierId: `CSH-${i}`, pin: '0000' } });
      assert.equal(last.status, 429);
    } finally {
      stop();
    }
  });

  test('the owner sees PIN status but never PINs', async () => {
    const { env, call, stop } = await start();
    try {
      const owner = env.auth.issue({ uid: BIZ, email: 'shop@x.in' });
      const body = await (await call('GET', '/cashiers', { token: owner })).json();
      assert.deepEqual(body.cashiers.map((c) => [c.cashierId, c.pinSet, c.active]), [['CSH-001', true, true], ['CSH-002', true, false], ['CSH-003', false, true]]);
      assert.equal(JSON.stringify(body).includes('pinHash'), false);
    } finally {
      stop();
    }
  });
});

describe('AI role permissions', () => {
  test('cashiers: POS billing only; owners: everything; warehouse: nothing', () => {
    assert.equal(canUseContext('cashier', 'pos'), true);
    assert.equal(canUseContext('cashier', 'invoice'), false);
    assert.equal(canRunIntent('cashier', 'query'), false, 'no business questions (revenue) for cashiers');
    assert.equal(canRunIntent('owner', 'query'), true);
    assert.equal(canUseContext('warehouse', 'pos'), false);
  });
  test('only owners remove aliases', () => {
    assert.deepEqual(['owner', 'cashier', 'warehouse'].map(canManageAliases), [true, false, false]);
  });
});

describe('PIN migration plan', () => {
  const { planPinMigration } = require('../../pos/migratePins');
  test('hashes valid PINs, reports missing/invalid ones, and strips PINs from the list', () => {
    const plan = planPinMigration(
      [
        { cashierId: 'csh-001', pin: '1234', name: 'A' },
        { cashierId: 'CSH-002', name: 'B' },
        { cashierId: 'CSH-003', pin: '12', name: 'C' },
        { cashierId: 'CSH-004', pin: '9999' },
      ],
      { 'CSH-004': { pinHash: 'already' } }
    );
    assert.deepEqual(plan.toHash, [{ cashierId: 'CSH-001', pin: '1234' }]);
    assert.deepEqual(plan.noPin, ['CSH-002']);
    assert.deepEqual(plan.invalidPin, ['CSH-003']);
    assert.deepEqual(plan.alreadyHashed, ['CSH-004']);
    assert.equal(plan.cleanedList.some((c) => 'pin' in c), false);
  });
  test('running it again finds nothing to do', () => {
    const plan = planPinMigration([{ cashierId: 'CSH-001', name: 'A' }], { 'CSH-001': { pinHash: 'h' } });
    assert.deepEqual([plan.toHash.length, plan.listHasPins], [0, false]);
  });
});
