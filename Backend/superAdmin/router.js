// /api/super-admin routes: actions the browser cannot do safely on its own
// (creating sign-in accounts, Razorpay refunds, database backups, server health).
// Every route checks that the caller is a platform admin in adminUsers/{uid}.
const express = require('express');
const admin = require('firebase-admin');
const os = require('os');
const fs = require('fs');
const zlib = require('zlib');
const { verifyAuthHeader, AuthError } = require('../auth/verifyToken');

const ADMIN_ROLES = ['Super Admin', 'Platform Admin', 'Finance Admin', 'Support Admin', 'Operations Admin', 'Read Only Admin'];

// Same check as hasPermission() in firestore.rules.
async function loadAdmin(db, uid) {
  const snap = await db.collection('adminUsers').doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (data.status === 'Suspended') return null;
  let permissions = {};
  if (data.role !== 'Super Admin') {
    const roleSnap = await db.collection('adminRoles').doc(String(data.role || 'None')).get();
    permissions = (roleSnap.exists && roleSnap.data().permissions) || {};
  }
  return { ...data, uid, can: (perm) => data.role === 'Super Admin' || permissions[perm] === true };
}

function requirePlatformAdmin(permission) {
  return async (req, res, next) => {
    try {
      const identity = await verifyAuthHeader(req.headers.authorization);
      const adminUser = await loadAdmin(admin.firestore(), identity.uid);
      if (!adminUser) return res.status(403).json({ error: 'Platform admin access required.' });
      if (permission && !adminUser.can(permission)) {
        return res.status(403).json({ error: `Your role does not have the "${permission}" permission.` });
      }
      req.admin = { ...adminUser, email: adminUser.email || identity.email };
      return next();
    } catch (err) {
      if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
      return next(err);
    }
  };
}

function audit(db, req, action, module, targetId, targetName, details) {
  return db.collection('auditLogs').add({
    action,
    module,
    targetId,
    targetName,
    details,
    adminName: req.admin.name || req.admin.email,
    adminEmail: req.admin.email,
    ip: req.ip,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// Plain JSON for a Firestore value (Timestamps, refs, GeoPoints, bytes).
function toPlain(value) {
  if (value == null) return value;
  if (value instanceof admin.firestore.Timestamp) return { __timestamp: value.toDate().toISOString() };
  if (value instanceof admin.firestore.DocumentReference) return { __ref: value.path };
  if (value instanceof admin.firestore.GeoPoint) return { __geo: [value.latitude, value.longitude] };
  if (Buffer.isBuffer(value)) return { __bytes: value.toString('base64') };
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out;
  }
  return value;
}

// Every document in every collection, including subcollections.
async function exportCollections(collections, out) {
  for (const col of collections) {
    const snap = await col.get();
    for (const docSnap of snap.docs) {
      out.push({ path: docSnap.ref.path, data: toPlain(docSnap.data()) });
    }
    // Documents that only hold subcollections are not returned by get().
    const refs = await col.listDocuments();
    for (const ref of refs) {
      await exportCollections(await ref.listCollections(), out);
    }
  }
  return out;
}

function timed(fn) {
  const start = Date.now();
  return Promise.resolve()
    .then(fn)
    .then((detail) => ({ status: 'Healthy', latency: `${Date.now() - start} ms`, detail: detail || '' }))
    .catch((err) => ({ status: 'Down', latency: `${Date.now() - start} ms`, detail: err.message }));
}

// CPU use of this process over a short sample, as a percent of all cores.
function sampleCpu(ms = 200) {
  const startUsage = process.cpuUsage();
  const start = process.hrtime.bigint();
  return new Promise((resolve) => setTimeout(() => {
    const used = process.cpuUsage(startUsage);
    const elapsedMicros = Number(process.hrtime.bigint() - start) / 1000;
    resolve(((used.user + used.system) / (elapsedMicros * os.cpus().length)) * 100);
  }, ms));
}

function createSuperAdminRouter({ razorpay, mailer, emailConfigured }) {
  const router = express.Router();
  const db = () => admin.firestore();

  // Invite a platform admin: creates the sign-in account and adminUsers/{uid},
  // which is what firestore.rules checks. Returns a password-setup link.
  router.post('/admin-users', requirePlatformAdmin(), async (req, res) => {
    if (req.admin.role !== 'Super Admin') return res.status(403).json({ error: 'Only a Super Admin can add admin users.' });
    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim();
    const role = String(req.body.role || '');
    const ipAddress = String(req.body.ipAddress || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (!ADMIN_ROLES.includes(role)) return res.status(400).json({ error: 'Unknown role.' });

    try {
      let user;
      try {
        user = await admin.auth().getUserByEmail(email);
      } catch (err) {
        if (err.code !== 'auth/user-not-found') throw err;
        user = await admin.auth().createUser({ email, displayName: name, emailVerified: false });
      }
      const existingBusiness = await db().collection('users').doc(user.uid).get();
      if (existingBusiness.exists) {
        return res.status(409).json({ error: 'This email already belongs to a business account. Use a different email for the admin.' });
      }
      await db().collection('adminUsers').doc(user.uid).set({
        name,
        email,
        role,
        ipAddress,
        status: 'Active',
        lastLogin: 'Never',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: req.admin.email,
      });
      const setupLink = await admin.auth().generatePasswordResetLink(email);
      await audit(db(), req, 'ADMIN_USER_CREATED', 'Security', user.uid, email, `Added ${role} ${email}`);
      return res.json({ success: true, uid: user.uid, setupLink });
    } catch (err) {
      console.error('Create admin user failed:', err);
      return res.status(500).json({ error: err.message || 'Could not create the admin user.' });
    }
  });

  // Refund a business payment through Razorpay, then mark it refunded.
  router.post('/refunds', requirePlatformAdmin('Process Refund'), async (req, res) => {
    const paymentPath = String(req.body.paymentPath || '');
    const reason = String(req.body.reason || '').slice(0, 200);
    if (!/^users\/[^/]+\/payments\/[^/]+$/.test(paymentPath)) return res.status(400).json({ error: 'Invalid payment.' });

    try {
      const ref = db().doc(paymentPath);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Payment not found.' });
      const payment = snap.data();
      if (payment.status === 'Refunded') return res.status(409).json({ error: 'This payment is already refunded.' });
      const razorpayPaymentId = payment.razorpayPaymentId || payment.razorpay_payment_id || payment.gatewayPaymentId
        || (String(payment.transactionId || '').startsWith('pay_') ? payment.transactionId : null);
      if (!razorpayPaymentId) {
        return res.status(400).json({ error: 'This payment was not made through Razorpay (cash, bank transfer, etc.), so it cannot be refunded online.' });
      }

      const refund = await razorpay.payments.refund(razorpayPaymentId, { speed: 'normal', notes: { reason } });
      await ref.update({
        status: 'Refunded',
        refundId: refund.id,
        refundReason: reason,
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        refundedBy: req.admin.email,
      });
      // The refunded money is no longer paid against the invoice.
      if (payment.invoiceId) {
        const invoiceRef = ref.parent.parent.collection('invoices').doc(String(payment.invoiceId));
        await db().runTransaction(async (tx) => {
          const inv = await tx.get(invoiceRef);
          if (!inv.exists) return;
          const data = inv.data();
          const paid = Math.max(0, Number(data.paidAmount || 0) - Number(payment.amount || 0));
          tx.update(invoiceRef, { paidAmount: paid, status: paid > 0 ? 'Partial' : 'Unpaid' });
        });
      }
      await audit(db(), req, 'PAYMENT_REFUNDED', 'Payments', snap.id, razorpayPaymentId, `Refund ${refund.id}. Reason: ${reason || 'none'}`);
      return res.json({ success: true, refundId: refund.id });
    } catch (err) {
      console.error('Refund failed:', err);
      const message = err?.error?.description || err.message || 'Refund failed.';
      return res.status(502).json({ error: message });
    }
  });

  // Full JSON export of Firestore to Cloud Storage (gzipped).
  router.post('/backups', requirePlatformAdmin(), async (req, res) => {
    if (req.admin.role !== 'Super Admin') return res.status(403).json({ error: 'Only a Super Admin can create backups.' });
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) return res.status(500).json({ error: 'Set FIREBASE_STORAGE_BUCKET in Backend/.env to enable backups.' });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backups/firestore_${stamp}.json.gz`;
    const record = db().collection('systemBackups').doc();
    await record.set({
      filename,
      status: 'Running',
      storage: `gs://${bucketName}`,
      createdDate: new Date().toISOString(),
      createdBy: req.admin.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      const docs = await exportCollections(await db().listCollections(), []);
      const body = zlib.gzipSync(JSON.stringify({ exportedAt: new Date().toISOString(), documents: docs }));
      await admin.storage().bucket(bucketName).file(filename).save(body, {
        contentType: 'application/gzip',
        resumable: false,
        metadata: { metadata: { documents: String(docs.length) } },
      });
      const sizeMb = body.length / (1024 * 1024);
      await record.update({
        status: 'Completed',
        size: sizeMb >= 1 ? `${sizeMb.toFixed(1)} MB` : `${(body.length / 1024).toFixed(1)} KB`,
        bytes: body.length,
        documents: docs.length,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await audit(db(), req, 'BACKUP_CREATED', 'System', record.id, filename, `Exported ${docs.length} documents`);
      return res.json({ success: true, id: record.id, documents: docs.length, filename });
    } catch (err) {
      console.error('Backup failed:', err);
      await record.update({ status: 'Failed', error: err.message }).catch(() => {});
      return res.status(500).json({ error: err.message || 'Backup failed.' });
    }
  });

  // Short-lived download link for a backup file.
  router.get('/backups/:id/download', requirePlatformAdmin(), async (req, res) => {
    if (req.admin.role !== 'Super Admin') return res.status(403).json({ error: 'Only a Super Admin can download backups.' });
    try {
      const snap = await db().collection('systemBackups').doc(req.params.id).get();
      if (!snap.exists || snap.data().status !== 'Completed') return res.status(404).json({ error: 'Backup file not available.' });
      const bucketName = String(snap.data().storage || '').replace(/^gs:\/\//, '');
      const [url] = await admin.storage().bucket(bucketName).file(snap.data().filename)
        .getSignedUrl({ action: 'read', expires: Date.now() + 10 * 60 * 1000 });
      await audit(db(), req, 'BACKUP_DOWNLOADED', 'System', snap.id, snap.data().filename, 'Signed download link issued');
      return res.json({ url });
    } catch (err) {
      console.error('Backup download failed:', err);
      return res.status(500).json({ error: err.message || 'Could not create a download link.' });
    }
  });

  // Live server and dependency status.
  router.get('/health', requirePlatformAdmin(), async (req, res) => {
    const [cpu, firestoreCheck, razorpayCheck, smtpCheck] = await Promise.all([
      sampleCpu(),
      timed(() => db().collection('system').limit(1).get().then(() => 'Read OK')),
      timed(() => razorpay.orders.all({ count: 1 }).then(() => 'API reachable')),
      emailConfigured()
        ? timed(() => mailer().verify().then(() => 'SMTP login OK'))
        : Promise.resolve({ status: 'Not configured', latency: '-', detail: 'Set EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD' }),
    ]);

    let disk = null;
    try {
      const st = fs.statfsSync(process.cwd());
      disk = { total: st.blocks * st.bsize, free: st.bavail * st.bsize };
    } catch (_) {}

    return res.json({
      cpuPercent: Number(cpu.toFixed(1)),
      memory: { total: os.totalmem(), free: os.freemem(), process: process.memoryUsage().rss },
      disk,
      uptimeSeconds: Math.round(process.uptime()),
      services: [
        { name: 'Firestore Database', type: 'Core Database', ...firestoreCheck },
        { name: 'Payment Gateway (Razorpay)', type: 'Payments API', ...razorpayCheck },
        { name: 'SMTP Email (Nodemailer)', type: 'Email Delivery', ...smtpCheck },
      ],
      checkedAt: new Date().toISOString(),
    });
  });

  return router;
}

module.exports = { createSuperAdminRouter, loadAdmin };
