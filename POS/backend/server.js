// Standalone POS backend: cashier login, POS device registration, cashier
// PINs/status, shifts (/api/pos), the warehouse module (/warehouse) and
// Razorpay for counter payments.
// Independent of the billing website's backend; shares only the Firebase project.
require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { initFirebaseAdmin } = require('./firebaseAdmin');
const { createPosRouter } = require('./pos/router');
const { createWarehouseRouter } = require('./warehouse/router');

try {
  initFirebaseAdmin();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const PORT = Number(process.env.POS_PORT || 5100);
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const razorpay = RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET }) : null;

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

app.get('/health', (req, res) => res.json({ ok: true, service: 'pos-backend' }));
app.use('/api/pos', createPosRouter());
app.use(createWarehouseRouter()); // routes are under /warehouse/*

function requireRazorpay(res) {
  if (razorpay) return true;
  res.status(503).json({ error: 'Online payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in POS/backend/.env.' });
  return false;
}

app.post('/create-razorpay-order', async (req, res) => {
  if (!requireRazorpay(res)) return;
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    });
    return res.json({ success: true, orderId: order.id, amount: order.amount, currency: order.currency, keyId: RAZORPAY_KEY_ID });
  } catch (error) {
    console.error('Razorpay Order Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create Razorpay order' });
  }
});

app.post('/verify-razorpay-payment', (req, res) => {
  if (!requireRazorpay(res)) return;
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (expected === razorpay_signature) {
      return res.json({ success: true, message: 'Payment verified successfully', paymentId: razorpay_payment_id });
    }
    return res.status(400).json({ success: false, message: 'Invalid payment signature' });
  } catch (error) {
    console.error('Signature Verification Error:', error);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
});

app.listen(PORT, () => console.log(`POS backend listening on http://localhost:${PORT}`));
