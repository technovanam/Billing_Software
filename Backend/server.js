require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
const PORT = 5000;

// Initialize Firebase Admin if key file is present
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (!admin.apps.length && fs.existsSync(serviceAccountPath)) {
    try {
        admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
    } catch (e) {
        console.warn('Firebase Admin initialization skipped:', e.message);
    }
}
const firestore = () => admin.firestore();
const recipientEmail = process.env.RECURRING_INVOICE_EMAIL || 'mohammedsuhail100506@gmail.com';
const mailer = () => nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
});

function requireAdmin() {
    if (!admin.apps.length) throw new Error('Firebase Admin is not configured. Add Backend/serviceAccountKey.json.');
}

async function authenticateRequest(req, res, next) {
    try {
        requireAdmin();
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!token) return res.status(401).json({ error: 'Authentication required' });
        req.user = await admin.auth().verifyIdToken(token);
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid authentication token' });
    }
}

function addSchedule(date, schedule) {
    const result = new Date(date);
    if (schedule === 'Week') result.setDate(result.getDate() + 7);
    else if (schedule === '2 Weeks') result.setDate(result.getDate() + 14);
    else result.setMonth(result.getMonth() + ({ Month: 1, '2 Months': 2, '3 Months': 3, '6 Months': 6, Year: 12 }[schedule] || 1));
    return result;
}

async function sendRecurringEmail(invoice, profile) {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.warn('Recurring email skipped: SMTP environment variables are not configured.');
        return;
    }
    await mailer().sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: recipientEmail,
        subject: `Recurring Invoice Generated - ${invoice.invoiceNumber}`,
        text: `Hello,\n\nA recurring invoice has been generated successfully.\n\nCustomer: ${invoice.customerName || ''}\nInvoice Number: ${invoice.invoiceNumber}\nInvoice Date: ${invoice.invoiceDate}\nDue Date: ${invoice.dueDate}\nAmount: ₹${invoice.amount}\n\nProfile: ${profile.profileName}\nRepeat Schedule: ${profile.repeatEvery}\n\nRegards,\nTechno Vanam Billing Software`,
    });
    console.log(`Recurring invoice email sent to ${recipientEmail} for ${invoice.invoiceNumber}`);
}

async function processRecurringInvoices(uid) {
    requireAdmin();
    const db = firestore();
    const userIds = uid ? [uid] : (await db.collection('users').get()).docs.map((doc) => doc.id);
    const processed = [];
    for (const userId of userIds) {
        const snapshot = await db.collection('users').doc(userId).collection('recurringInvoices').get();
        for (const doc of snapshot.docs) {
            const profile = doc.data();
            const due = profile.status === 'Active' && profile.nextRunDate && new Date(profile.nextRunDate) <= new Date();
            if (!due || (!profile.neverExpires && profile.endsOn && profile.nextRunDate > profile.endsOn)) continue;
            const lockRef = doc.ref.collection('runs').doc(profile.nextRunDate);
            const lock = await db.runTransaction(async (transaction) => {
                const existing = await transaction.get(lockRef);
                if (existing.exists) return false;
                transaction.create(lockRef, { createdAt: admin.firestore.FieldValue.serverTimestamp() });
                return true;
            });
            if (!lock) continue;
            const invoiceRef = db.collection('users').doc(userId).collection('invoices').doc();
            const invoiceNumber = `REC-${invoiceRef.id.slice(0, 8).toUpperCase()}`;
            const invoice = {
                invoiceNumber,
                invoiceDate: profile.nextRunDate,
                dueDate: profile.paymentTerms === 'Due on Receipt' ? profile.nextRunDate : profile.nextRunDate,
                customerId: profile.customerId,
                customerName: profile.customerName,
                clientId: profile.customerId,
                items: profile.items || [],
                amount: profile.total || 0,
                subtotal: profile.subtotal || 0,
                discount: profile.discount || 0,
                tds: profile.tds || 0,
                status: 'Unpaid',
                invoiceNotes: profile.customerNotes || '',
                termsAndConditions: profile.termsAndConditions || '',
                recurringInvoiceId: doc.id,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            const nextRunDate = addSchedule(new Date(profile.nextRunDate), profile.repeatEvery).toISOString().slice(0, 10);
            await invoiceRef.set(invoice);
            await doc.ref.update({ lastRunDate: profile.nextRunDate, nextRunDate, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            await sendRecurringEmail(invoice, profile);
            processed.push({ profileId: doc.id, invoiceNumber });
        }
    }
    if (processed.length) console.log(`Processed ${processed.length} recurring invoice(s).`);
    return processed;
}

// Razorpay Config
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_Tcxout7GfUZzbE';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '1Q9VWCRrDzSAzeFeOkLCSAuh';

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors());

// Recurring invoice processing endpoints
app.post('/recurring-invoices/process', authenticateRequest, async (req, res) => {
    try {
        res.json({ success: true, processed: await processRecurringInvoices(req.user.uid) });
    } catch (error) {
        console.error('Recurring processing error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/recurring-invoices/test-email', authenticateRequest, async (req, res) => {
    try {
        if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            return res.status(500).json({ error: 'SMTP environment variables are not configured' });
        }
        await mailer().sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: recipientEmail,
            subject: 'Recurring Invoice Test Email',
            text: 'Recurring invoice email delivery is configured correctly.',
        });
        res.json({ success: true, recipient: recipientEmail });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Simple Memory Rate Limiter for Public Endpoints
const rateLimitMap = new Map();
function rateLimiter(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'global';
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 min
    const maxHits = 60;

    const hitData = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
    if (now > hitData.resetTime) {
        hitData.count = 1;
        hitData.resetTime = now + windowMs;
    } else {
        hitData.count += 1;
    }
    rateLimitMap.set(ip, hitData);

    if (hitData.count > maxHits) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
}

// Helper: Find invoice by token or identifier across user subcollections
async function findInvoiceByToken(token) {
    requireAdmin();
    const db = firestore();
    if (!token) return null;

    const rawToken = String(token).trim();
    const decoded = decodeURIComponent(rawToken);
    const normalizedSlash = decoded.replace(/_/g, '/');
    const normalizedUnderscore = decoded.replace(/\//g, '_');

    // 1. Try collectionGroup query
    try {
        let snapshot = await db.collectionGroup('invoices').where('paymentToken', '==', rawToken).get();
        if (snapshot.empty && decoded !== rawToken) {
            snapshot = await db.collectionGroup('invoices').where('paymentToken', '==', decoded).get();
        }
        if (snapshot.empty) {
            snapshot = await db.collectionGroup('invoices').where('invoiceNumber', '==', decoded).get();
        }
        if (snapshot.empty) {
            snapshot = await db.collectionGroup('invoices').where('invoiceNumber', '==', normalizedSlash).get();
        }
        if (snapshot.empty) {
            snapshot = await db.collectionGroup('invoices').where('invoiceNumber', '==', normalizedUnderscore).get();
        }
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            const userId = doc.ref.parent.parent ? doc.ref.parent.parent.id : null;
            return { docRef: doc.ref, docId: doc.id, userId, data };
        }
    } catch (e) {
        console.warn('CollectionGroup index notice, using subcollection scan:', e.message);
    }

    // 2. Robust Fallback: Scan user invoice subcollections directly (no index required!)
    try {
        const usersSnap = await db.collection('users').get();
        for (const userDoc of usersSnap.docs) {
            const userId = userDoc.id;
            const invSnap = await db.collection('users').doc(userId).collection('invoices').get();
            for (const doc of invSnap.docs) {
                const data = doc.data();
                const invNum = data.invoiceNumber || '';
                const invNumUnderscore = invNum.replace(/\//g, '_');
                const pToken = data.paymentToken || '';
                if (
                    doc.id === rawToken ||
                    doc.id === decoded ||
                    pToken === rawToken ||
                    pToken === decoded ||
                    invNum === decoded ||
                    invNum === normalizedSlash ||
                    invNumUnderscore === decoded ||
                    invNumUnderscore === normalizedUnderscore ||
                    (decoded && decoded.includes(invNumUnderscore))
                ) {
                    return { docRef: doc.ref, docId: doc.id, userId, data };
                }
            }
        }
    } catch (err) {
        console.error('User subcollection scan error:', err);
    }

    return null;
}

// -----------------------------------------------------------------------------
// PUBLIC PAYMENT LINK ENDPOINTS
// -----------------------------------------------------------------------------

// 1. Fetch public invoice by token
app.get('/api/public/payment/invoice/:token', rateLimiter, async (req, res) => {
    try {
        const { token } = req.params;
        if (!token) return res.status(400).json({ error: 'Token is required' });

        const inv = await findInvoiceByToken(token);
        if (!inv) {
            return res.status(404).json({ success: false, status: 'INVALID', error: 'INVALID_OR_DISABLED_TOKEN' });
        }

        const data = inv.data;

        // Check if token disabled explicitly
        if (data.paymentTokenStatus === 'DISABLED' || data.paymentLinkDisabled === true) {
            return res.status(403).json({ success: false, status: 'DISABLED', invoiceNumber: data.invoiceNumber, message: 'This payment link has been disabled by the administrator.' });
        }

        // Check if cancelled
        if ((data.status || '').toLowerCase() === 'cancelled') {
            return res.status(400).json({ success: false, status: 'CANCELLED', invoiceNumber: data.invoiceNumber, message: 'This invoice is no longer payable. Please contact company.' });
        }

        // Check if already paid
        const total = Number(data.amount || data.total || 0);
        const paid = Number(data.paidAmount || 0);
        const isPaidStatus = (data.status || '').toLowerCase() === 'paid' || (data.paymentStatus || '').toUpperCase() === 'PAID';

        if (isPaidStatus || paid >= total) {
            return res.json({
                success: false,
                status: 'PAID',
                invoiceNumber: data.invoiceNumber,
                amountPaid: paid || total,
                gatewayPaymentId: data.gatewayPaymentId || data.transactionId || 'pay_completed',
                paidAt: data.paidAt || data.updatedAt || new Date().toISOString(),
            });
        }

        // Check if token / invoice due date expired
        if (data.paymentTokenExpiresAt) {
            const expDate = new Date(data.paymentTokenExpiresAt);
            if (!isNaN(expDate.getTime()) && new Date() > expDate) {
                return res.json({ success: false, status: 'EXPIRED', invoiceNumber: data.invoiceNumber, message: 'This payment link has expired. Please contact the company for a new payment link.' });
            }
        }

        // Fetch company profile for branding
        let companyName = 'ESA ENGINEERING WORKS';
        let logoURL = '';
        let address = '';
        let phone = '';
        let gstin = '';
        if (inv.userId) {
            const userDoc = await firestore().collection('users').doc(inv.userId).get();
            if (userDoc.exists) {
                const uData = userDoc.data();
                companyName = uData.companyName || companyName;
                logoURL = uData.logoURL || logoURL;
                address = uData.address || address;
                phone = uData.phone || phone;
                gstin = uData.gstin || gstin;
            }
        }

        const formatDate = (val) => {
            if (!val) return 'N/A';
            if (typeof val === 'string') return val;
            if (val._seconds) return new Date(val._seconds * 1000).toISOString().slice(0, 10);
            if (typeof val.toDate === 'function') return val.toDate().toISOString().slice(0, 10);
            if (val instanceof Date) return val.toISOString().slice(0, 10);
            return String(val);
        };

        const balanceDue = Math.max(0, total - paid);

        res.json({
            success: true,
            status: 'UNPAID',
            token: data.paymentToken || token,
            invoiceId: inv.docId,
            userId: inv.userId,
            invoiceNumber: data.invoiceNumber,
            invoiceDate: formatDate(data.invoiceDate),
            customerName: data.client?.name || data.clientName || data.customerName || 'Customer',
            client: data.client || { name: data.clientName || data.customerName || 'Customer' },
            items: data.items || data.products || [],
            poNumber: data.poNumber || '',
            dcNumber: data.dcNumber || '',
            cgst: data.cgst || 0,
            sgst: data.sgst || 0,
            igst: data.igst || 0,
            isRoundOff: data.isRoundOff || false,
            amount: total,
            balanceDue,
            dueDate: formatDate(data.dueDate),
            companyName,
            logoURL,
            companyAddress: address,
            companyPhone: phone,
            companyGstin: gstin,
        });
    } catch (error) {
        console.error('Public fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch payment details' });
    }
});

// 2. Create Razorpay order from Token (Server-calculated amount)
app.post('/api/public/payment/create-order', rateLimiter, async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Payment token is required' });

        const inv = await findInvoiceByToken(token);
        if (!inv) return res.status(404).json({ error: 'Invalid or expired payment link' });

        const data = inv.data;

        if (data.paymentTokenStatus === 'DISABLED' || data.paymentLinkDisabled === true) {
            return res.status(403).json({ error: 'Payment link is disabled' });
        }
        if ((data.status || '').toLowerCase() === 'cancelled') {
            return res.status(400).json({ error: 'Invoice is cancelled and cannot be paid' });
        }

        const total = Number(data.amount || data.total || 0);
        const paid = Number(data.paidAmount || 0);
        const serverBalanceDue = Math.max(0, total - paid);

        if ((data.status || '').toLowerCase() === 'paid' || serverBalanceDue <= 0) {
            return res.status(400).json({ error: 'Invoice is already paid in full' });
        }

        // Create Gateway Order with server-side amount
        const orderOptions = {
            amount: Math.round(serverBalanceDue * 100), // amount in paise
            currency: 'INR',
            receipt: `inv_${inv.docId.slice(0, 10)}`,
            notes: {
                token: token,
                invoiceId: inv.docId,
                userId: inv.userId || '',
                invoiceNumber: data.invoiceNumber || '',
            },
        };

        const order = await razorpay.orders.create(orderOptions);

        // Store gatewayOrderId on the invoice
        await inv.docRef.update({
            gatewayOrderId: order.id,
            paymentStatus: 'PROCESSING',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error('Create Payment Order Error:', error);
        res.status(500).json({ error: error.message || 'Failed to create payment order' });
    }
});

// Record public payment (Razorpay online or Manual UTR submission)
app.post('/api/public/payment/record', rateLimiter, async (req, res) => {
    try {
        const { token, invoiceId, userId, amount, paymentMethod, transactionId } = req.body;
        const targetIdentifier = token || invoiceId;
        if (!targetIdentifier) return res.status(400).json({ error: 'Token or invoice ID is required' });

        const inv = await findInvoiceByToken(targetIdentifier);
        if (!inv) return res.status(404).json({ error: 'Invoice not found' });

        const db = firestore();
        const data = inv.data;
        const targetUserId = inv.userId || userId;
        const invoiceTotal = Number(data.amount || data.total || 0);
        const currentPaid = Number(data.paidAmount || 0);
        const amountReceived = Number(amount) || (invoiceTotal - currentPaid);
        const newPaidAmount = currentPaid + amountReceived;

        const isFullyPaid = Math.abs(invoiceTotal - newPaidAmount) < 1 || newPaidAmount >= invoiceTotal;
        const newStatus = isFullyPaid ? 'Paid' : (newPaidAmount > 0 ? 'Partial' : 'Unpaid');

        const todayFormatted = new Date().toLocaleDateString('en-GB');

        // 1. Add payment record to users/{targetUserId}/payments
        if (targetUserId) {
            await db.collection('users').doc(targetUserId).collection('payments').add({
                invoiceId: inv.docId,
                invoiceNumber: data.invoiceNumber || '',
                customerName: data.client?.name || data.clientName || data.customerName || 'Customer',
                clientId: data.clientId || data.client?.id || '',
                amount: amountReceived,
                paymentMethod: paymentMethod || 'Online Payment',
                transactionId: transactionId || `TXN-${Date.now()}`,
                paymentDate: todayFormatted,
                status: 'Completed',
                notes: `Paid via Public Payment Portal (${paymentMethod || 'Online'})`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // 2. Update invoice document
        const updatePayload = {
            status: newStatus,
            paidAmount: newPaidAmount,
            paymentMethod: paymentMethod || 'Online Payment',
            transactionId: transactionId || `TXN-${Date.now()}`,
            paymentDate: todayFormatted,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await inv.docRef.update(updatePayload);

        console.log(`Payment recorded for invoice ${data.invoiceNumber}: ${amountReceived} INR. Status: ${newStatus}`);
        res.json({ success: true, status: newStatus, paidAmount: newPaidAmount });
    } catch (error) {
        console.error('Public payment record error:', error);
        res.status(500).json({ error: error.message || 'Failed to record payment' });
    }
});

// 3. Webhook Endpoint with Signature Verification & Idempotency
const WEBHOOK_SECRET = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_test_secret_key_12345';

app.post('/api/payment/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        if (!signature) {
            return res.status(400).json({ error: 'Missing webhook signature' });
        }

        const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha256', WEBHOOK_SECRET)
            .update(bodyString)
            .digest('hex');

        if (expectedSignature !== signature) {
            console.warn('Invalid Webhook Signature Signature Received:', signature);
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }

        const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        console.log(`Received Webhook Event: ${event.event}`);

        if (event.event === 'payment.captured' || event.event === 'order.paid') {
            const payment = event.payload?.payment?.entity || {};
            const paymentId = payment.id;
            const orderId = payment.order_id;
            const amountInRupees = (payment.amount || 0) / 100;
            const method = payment.method || 'Razorpay';
            const notes = payment.notes || {};
            const token = notes.token;

            if (!paymentId) return res.json({ status: 'ok', message: 'No payment id' });

            const db = firestore();

            // IDEMPOTENCY CHECK: Has this payment already been processed?
            const existingPayments = await db.collectionGroup('payments').where('gatewayPaymentId', '==', paymentId).get();
            if (!existingPayments.empty) {
                console.log(`Webhook Idempotency: Payment ${paymentId} already processed. Skipping.`);
                return res.status(200).json({ status: 'ok', message: 'Already processed' });
            }

            // Find matching invoice
            let inv = null;
            if (token) {
                inv = await findInvoiceByToken(token);
            }
            if (!inv && orderId) {
                const snapshot = await db.collectionGroup('invoices').where('gatewayOrderId', '==', orderId).get();
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    const userId = doc.ref.parent.parent ? doc.ref.parent.parent.id : null;
                    inv = { docRef: doc.ref, docId: doc.id, userId, data: doc.data() };
                }
            }

            if (inv) {
                const invData = inv.data;
                const userId = inv.userId;

                // Add payment record under users/{userId}/payments
                if (userId) {
                    await db.collection('users').doc(userId).collection('payments').add({
                        invoiceId: inv.docId,
                        invoiceNumber: invData.invoiceNumber,
                        customerName: invData.client?.name || invData.customerName || 'Customer',
                        amount: amountInRupees,
                        currency: 'INR',
                        paymentMethod: method,
                        gatewayPaymentId: paymentId,
                        gatewayOrderId: orderId || '',
                        paymentStatus: 'PAID',
                        paidAt: admin.firestore.FieldValue.serverTimestamp(),
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        notes: `Paid via Gateway Webhook (${event.event})`,
                    });
                }

                // Update invoice document status to PAID
                await inv.docRef.update({
                    status: 'Paid',
                    paymentStatus: 'PAID',
                    paidAmount: amountInRupees,
                    gatewayPaymentId: paymentId,
                    gatewayOrderId: orderId || '',
                    paidAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`Invoice ${invData.invoiceNumber} updated to PAID via webhook.`);
            }
        }

        res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({ error: 'Internal Webhook Error' });
    }
});

// Endpoint to create a Razorpay order
app.post('/create-razorpay-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const options = {
      amount: Math.round(amount * 100), // amount in paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    };

    const order = await razorpay.orders.create(options);
    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Razorpay Order Error:', error);
    res.status(500).json({ error: error.message || 'Failed to create Razorpay order' });
  }
});

// Endpoint to verify payment signature
app.post('/verify-razorpay-payment', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      res.json({ success: true, message: 'Payment verified successfully', paymentId: razorpay_payment_id });
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Signature Verification Error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Endpoint to generate PDF
app.post('/generate-pdf', async (req, res) => {
    const { html, css, baseUrl } = req.body;

    if (!html) {
        return res.status(400).send('HTML content is required');
    }

    try {
        console.log('Starting PDF generation...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('Browser launched');
        const page = await browser.newPage();
        console.log('Page created');

        const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          ${baseUrl ? `<base href="${baseUrl}">` : ''}
          <style>
             body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
          ${css || ''}
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

        console.log('Setting page content...');
        await page.setContent(fullHtml, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });
        console.log('Content set. Generating PDF...');

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '15mm',
                right: '15mm',
                bottom: '15mm',
                left: '15mm'
            }
        });

        console.log('PDF generated successfully');
        await browser.close();

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
        });

        res.send(pdfBuffer);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).send('Error generating PDF');
    }
});

app.listen(PORT, () => {
    console.log(`PDF Server running on http://localhost:${PORT}`);
    if (admin.apps.length) {
        cron.schedule('*/5 * * * *', () => processRecurringInvoices().catch((error) => console.error('Recurring scheduler error:', error)));
    }
});
