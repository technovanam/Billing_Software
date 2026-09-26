// /api/pos: cashier login, device registration, cashier PIN/status, shifts.
const express = require('express');
const admin = require('firebase-admin');
const { z } = require('zod');
const { requireAuth } = require('../auth/verifyToken');
const { createUserRateLimiter } = require('../ai/rateLimit');
const cashiers = require('./cashiers');
const devices = require('./devices');
const shifts = require('./shifts');

const LoginSchema = z.object({
  deviceId: z.string().min(1).max(64),
  deviceSecret: z.string().min(1).max(200),
  cashierId: z.string().trim().min(1).max(100),
  pin: z.string().max(10),
});
const DeviceSchema = z.object({ name: z.string().trim().min(1).max(60), counter: z.string().trim().max(40).optional().nullable() });
const PinSchema = z.object({ pin: z.string() });
const StatusSchema = z.object({ active: z.boolean() });
const OpenSchema = z.object({ openingCash: z.number().min(0).max(10_000_000), counter: z.string().trim().max(40).optional().nullable(), notes: z.string().max(300).optional() });
const CloseSchema = z.object({
  closingCash: z.number().min(0).max(10_000_000),
  totals: z.object({ cashSales: z.number().min(0), upiSales: z.number().min(0), cardSales: z.number().min(0) }).partial().optional(),
  notes: z.string().max(300).optional(),
});
const RefundSchema = z.object({ amount: z.number().min(0).max(10_000_000) });
const ImportSchema = z.object({ shifts: z.array(z.record(z.string(), z.any())).max(50) });

function createPosRouter({ db = null, auth = null, now = Date.now, loginLimit = 20 } = {}) {
  const router = express.Router();
  const getDb = () => db || admin.firestore();
  const getAuth = () => auth || admin.auth();
  const ipLimiter = createUserRateLimiter({ limit: loginLimit, windowMs: 60 * 1000, now });

  const owner = requireAuth({ roles: ['owner'], auth: auth || undefined });
  const ownerOrCashier = requireAuth({ roles: ['owner', 'cashier'], auth: auth || undefined });

  const handle = (fn) => async (req, res) => {
    try {
      return await fn(req, res);
    } catch (err) {
      if (err instanceof cashiers.PosError) return res.status(err.status).json({ error: err.message, code: err.code });
      if (err?.name === 'ZodError') return res.status(400).json({ error: 'Invalid request.' });
      console.error('POS route error:', err);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };

  router.post(
    '/cashier-login',
    handle(async (req, res) => {
      const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const { allowed, retryAfterSec } = ipLimiter.check(`ip:${ip}`);
      if (!allowed) {
        res.set('Retry-After', String(retryAfterSec));
        return res.status(429).json({ error: `Too many login attempts from this device. Try again in ${retryAfterSec}s.` });
      }
      const body = LoginSchema.parse(req.body);
      const result = await cashiers.loginCashier({ db: getDb(), auth: getAuth(), ...body, ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 200), now });
      return res.json({ token: result.token, cashier: result.cashier });
    })
  );

  // ---- owner: devices ----
  router.post('/devices', owner, handle(async (req, res) => {
    const body = DeviceSchema.parse(req.body);
    const device = await devices.registerDevice({ db: getDb(), businessUid: req.identity.businessUid, actorUid: req.identity.uid, ...body, now });
    return res.status(201).json(device);
  }));
  router.get('/devices', owner, handle(async (req, res) => res.json({ devices: await devices.listDevices({ db: getDb(), businessUid: req.identity.businessUid }) })));
  router.delete('/devices/:deviceId', owner, handle(async (req, res) => {
    const out = await devices.removeDevice({ db: getDb(), auth: getAuth(), businessUid: req.identity.businessUid, deviceId: req.params.deviceId, actorUid: req.identity.uid, now });
    return res.json({ ok: true, ...out });
  }));

  // ---- owner: cashiers ----
  router.get('/cashiers', owner, handle(async (req, res) => res.json({ cashiers: await cashiers.cashierStatuses({ db: getDb(), businessUid: req.identity.businessUid, now }) })));
  router.post('/cashiers/:cashierId/pin', owner, handle(async (req, res) => {
    const { pin } = PinSchema.parse(req.body);
    await cashiers.setCashierPin({ db: getDb(), auth: getAuth(), businessUid: req.identity.businessUid, cashierId: req.params.cashierId, pin, actorUid: req.identity.uid, now });
    return res.json({ ok: true });
  }));
  router.post('/cashiers/:cashierId/status', owner, handle(async (req, res) => {
    const { active } = StatusSchema.parse(req.body);
    await cashiers.setCashierActive({ db: getDb(), auth: getAuth(), businessUid: req.identity.businessUid, cashierId: req.params.cashierId, active, actorUid: req.identity.uid, now });
    return res.json({ ok: true });
  }));
  router.delete('/cashiers/:cashierId', owner, handle(async (req, res) => {
    await cashiers.removeCashierSecrets({ db: getDb(), auth: getAuth(), businessUid: req.identity.businessUid, cashierId: req.params.cashierId, actorUid: req.identity.uid, now });
    return res.json({ ok: true });
  }));

  // ---- shifts (cashier: their own; owner: as "OWNER" or closing any) ----
  const shiftActor = (identity, body = {}) =>
    identity.role === 'cashier'
      ? { cashierId: identity.cashierId, name: identity.claims.cashierName || identity.cashierId, counter: identity.counter || body.counter || null }
      : { cashierId: 'OWNER', name: 'Owner', counter: body.counter || 'Owner counter' };

  router.post('/shifts/open', ownerOrCashier, handle(async (req, res) => {
    const body = OpenSchema.parse(req.body);
    const actor = shiftActor(req.identity, body);
    const shift = await shifts.openShift({ db: getDb(), businessUid: req.identity.businessUid, cashier: actor, counter: actor.counter, openingCash: body.openingCash, notes: body.notes, now });
    return res.status(201).json({ shift });
  }));
  router.post('/shifts/:shiftId/close', ownerOrCashier, handle(async (req, res) => {
    const body = CloseSchema.parse(req.body);
    const shift = await shifts.closeShift({ db: getDb(), businessUid: req.identity.businessUid, actor: req.identity, shiftId: req.params.shiftId, closingCash: body.closingCash, totals: body.totals, notes: body.notes, now });
    return res.json({ shift });
  }));
  router.post('/shifts/refund', ownerOrCashier, handle(async (req, res) => {
    const { amount } = RefundSchema.parse(req.body);
    const actor = shiftActor(req.identity);
    return res.json({ shift: await shifts.addRefund({ db: getDb(), businessUid: req.identity.businessUid, cashierId: actor.cashierId, amount }) });
  }));
  router.post('/shifts/import', ownerOrCashier, handle(async (req, res) => {
    const body = ImportSchema.parse(req.body);
    return res.json(await shifts.importShifts({ db: getDb(), businessUid: req.identity.businessUid, cashier: shiftActor(req.identity), shifts: body.shifts }));
  }));

  return router;
}

module.exports = { createPosRouter };
