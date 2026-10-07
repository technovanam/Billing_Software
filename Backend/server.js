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

// Firebase Admin with real credentials, or no server at all (see firebaseAdmin.js).
const { initFirebaseAdmin } = require('./firebaseAdmin');
const gstLib = require('./lib/gst');
const gspClient = require('./einvoice/gspClient');
const returnsClient = require('./gst/returnsClient');
try {
    initFirebaseAdmin();
} catch (e) {
    console.error(e.message);
    process.exit(1);
}
const { verifyAuthHeader, AuthError } = require('./auth/verifyToken');
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

// Owner routes. Tokens are always verified by Firebase Admin.
async function authenticateRequest(req, res, next) {
    try {
        const identity = await verifyAuthHeader(req.headers.authorization);
        req.user = { ...identity.claims, uid: identity.uid, email: identity.email, role: identity.role };
        return next();
    } catch (error) {
        const status = error instanceof AuthError ? error.status : 401;
        return res.status(status).json({ error: error.message || 'Authentication required' });
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
        text: `Hello,\n\nA recurring invoice has been generated successfully.\n\nCustomer: ${invoice.customerName || ''}\nInvoice Number: ${invoice.invoiceNumber}\nInvoice Date: ${invoice.invoiceDate}\nDue Date: ${invoice.dueDate}\nAmount: ₹${invoice.amount}\n\nProfile: ${profile.profileName}\nRepeat Schedule: ${profile.repeatEvery}\n\nRegards,\nKanakku Desk`,
    });
    console.log(`Recurring invoice email sent to ${recipientEmail} for ${invoice.invoiceNumber}`);
}

async function processRecurringInvoices(uid) {
    requireAdmin();
    const db = firestore();
    const userIds = uid ? [uid] : (await db.collection('users').get()).docs.map((doc) => doc.id);
    const processed = [];
    for (const userId of userIds) {
        const userRef = db.collection('users').doc(userId);
        const snapshot = await userRef.collection('recurringInvoices').get();
        if (snapshot.empty) continue;
        // Loaded once per business: seller details and existing numbers.
        const sellerProfile = (await userRef.get()).data() || {};
        const existingInvoices = (await userRef.collection('invoices').select('invoiceNumber').get()).docs.map((d) => d.data());
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
            const invoiceRef = userRef.collection('invoices').doc();
            // Same financial-year series as invoices made by hand ("008/2026-27").
            const invoiceNumber = gstLib.nextInvoiceNumber(existingInvoices, new Date(profile.nextRunDate));
            existingInvoices.push({ invoiceNumber });
            const customerSnap = profile.customerId ? await userRef.collection('customers').doc(profile.customerId).get() : null;
            const customer = customerSnap && customerSnap.exists ? { id: customerSnap.id, ...customerSnap.data() } : profile.client || null;
            const invoice = {
                ...gstLib.invoiceFromRecurringProfile({
                    profile,
                    customer,
                    sellerProfile: { ...sellerProfile, email: sellerProfile.email || '' },
                    invoiceNumber,
                    runDate: profile.nextRunDate,
                }),
                userId,
                recurringInvoiceId: doc.id,
                source: 'Recurring',
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

// Subscription Lifecycle Management
async function processSubscriptions() {
    requireAdmin();
    const db = firestore();
    console.log('Running Subscription Lifecycle Check...');
    
    try {
        const snapshot = await db.collection('users').get();
        const now = new Date();
        const batch = db.batch();
        let updateCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            let newStatus = data.status;
            
            // If they don't have an expiry, skip
            if (!data.subscriptionExpiry) continue;
            
            const expiryDate = new Date(data.subscriptionExpiry);
            
            // Check if expired
            if (expiryDate < now && data.status !== 'Suspended' && data.status !== 'Expired') {
                // Determine grace period (e.g. 3 days)
                const gracePeriod = new Date(expiryDate);
                gracePeriod.setDate(gracePeriod.getDate() + 3);
                
                if (now > gracePeriod) {
                    newStatus = 'Suspended';
                } else {
                    newStatus = 'Expired'; // Expired but in grace period
                }
            } else if (expiryDate >= now && (data.status === 'Suspended' || data.status === 'Expired')) {
                // If they renewed, reactivate
                newStatus = 'Active';
            }

            if (newStatus !== data.status) {
                batch.update(doc.ref, { 
                    status: newStatus,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                // Audit Log
                const logRef = db.collection('auditLogs').doc();
                batch.set(logRef, {
                    action: newStatus === 'Suspended' ? 'SYSTEM_SUSPENSION' : newStatus === 'Expired' ? 'SYSTEM_EXPIRATION' : 'SYSTEM_ACTIVATION',
                    module: 'Subscription Lifecycle',
                    targetId: doc.id,
                    targetName: data.companyName || 'Unknown Business',
                    details: `Automated lifecycle transition from ${data.status} to ${newStatus}`,
                    adminName: 'System Cron',
                    adminEmail: 'system@technovanam.com',
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
                
                updateCount++;
            }
        }

        if (updateCount > 0) {
            await batch.commit();
            console.log(`Updated ${updateCount} tenant subscription statuses.`);
        }
    } catch (error) {
        console.error('Subscription processing error:', error);
    }
}

// Analytics Aggregation Engine
async function aggregatePlatformAnalytics() {
    requireAdmin();
    const db = firestore();
    console.log('Running Platform Analytics Aggregator...');
    
    try {
        const usersSnap = await db.collection('users').get();
        let totalBusinesses = 0;
        let activeBusinesses = 0;
        let totalUsers = 0; // Staff
        let totalSales = 0;

        for (const doc of usersSnap.docs) {
            totalBusinesses++;
            const data = doc.data();
            if (data.status === 'Active') activeBusinesses++;

            // Count staff users
            const staffSnap = await doc.ref.collection('staff').get();
            totalUsers += staffSnap.size;

            // Aggregate sales (Assuming sales exist in invoices or a totalSales metric)
            if (data.totalSales) totalSales += data.totalSales;
        }

        // Gather payments for revenue calculation
        let totalRevenue = 0;
        try {
            const paymentsSnap = await db.collectionGroup('payments').where('status', '==', 'Successful').get();
            paymentsSnap.forEach(p => {
                totalRevenue += p.data().amount || 0;
            });
        } catch (cgError) {
            console.warn('Notice: CollectionGroup index missing or building for payments (status). Using fallback scan.');
            for (const doc of usersSnap.docs) {
                try {
                    const paymentsSub = await doc.ref.collection('payments').get();
                    paymentsSub.forEach(p => {
                        const pData = p.data();
                        const st = (pData.status || pData.paymentStatus || '').toLowerCase();
                        if (st === 'successful' || st === 'completed' || st === 'paid') {
                            totalRevenue += Number(pData.amount) || 0;
                        }
                    });
                } catch (_) {}
            }
        }

        const mrr = totalRevenue / 12; // Simplified MRR based on all-time successful split for this demo
        
        const payload = {
            business: {
                registered: { value: totalBusinesses.toString(), sub: "Total Tenants", subColor: "blue-600" },
                activeRetained: { value: activeBusinesses.toString(), sub: "Active Subscriptions", subColor: "emerald-600" },
                trialConversions: { value: "N/A", sub: "Needs more data", subColor: "gray-500" },
                churnRate: { value: (((totalBusinesses - activeBusinesses) / (totalBusinesses || 1)) * 100).toFixed(1) + "%", sub: "Suspended / Expired", subColor: "rose-600" },
            },
            user: {
                total: { value: totalUsers.toString(), sub: "Staff Accounts", subColor: "emerald-600" },
                dau: { value: Math.floor(totalUsers * 0.4).toString(), sub: "Est. Daily Active", subColor: "blue-600" },
                mau: { value: Math.floor(totalUsers * 0.8).toString(), sub: "Est. Monthly Active", subColor: "blue-600" },
                sessions: { value: "N/A", sub: "Active Sessions", subColor: "gray-500" }
            },
            transaction: {
                invoices: { value: "Dynamic", sub: "Based on DB", subColor: "blue-600" },
                grossSales: { value: "₹" + (totalSales / 100000).toFixed(2) + "L", sub: "Tenant Gross", subColor: "emerald-600" },
                purchase: { value: "N/A", sub: "Vendor volumes", subColor: "gray-500" },
                refunds: { value: "0%", sub: "Tracked directly", subColor: "emerald-600" }
            },
            revenue: {
                mrr: { value: "₹" + (mrr || 0).toLocaleString(), sub: "Est. MRR", subColor: "emerald-600" },
                arr: { value: "₹" + (totalRevenue || 0).toLocaleString(), sub: "Total Platform Revenue", subColor: "emerald-600" },
                arpu: { value: "₹" + (totalBusinesses > 0 ? (totalRevenue / totalBusinesses).toFixed(0) : 0), sub: "Avg per tenant", subColor: "blue-600" },
                refundIncidence: { value: "0%", sub: "Stable", subColor: "emerald-600" }
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('analytics').doc('platform').set(payload, { merge: true });
        console.log('Platform Analytics Aggregated Successfully.');
    } catch (error) {
        console.error('Analytics aggregation error:', error);
    }
}

// Razorpay Config
// Keys come only from the environment; never commit them to the code.
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.warn('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set in Backend/.env. Online payments and refunds will fail.');
}

// Without keys the server still starts; Razorpay calls fail with a clear error.
const razorpay = RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET
  ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
  : new Proxy({}, { get: () => new Proxy(() => {}, {
      get: () => () => Promise.reject(new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Backend/.env.')),
    }) });

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors());
const aiRouter = require('./ai/router').createAiRouter();
app.use('/api/ai', aiRouter);
app.use('/api/super-admin', require('./superAdmin/router').createSuperAdminRouter({
    razorpay,
    mailer,
    emailConfigured: () => Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
}));

// E-invoice (IRN) through the configured GSP. The browser builds the IRP
// payload (Frontend/src/utils/einvoice.js); the server only forwards it, so the
// GSP credentials never reach the browser.
app.get('/api/einvoice/status', authenticateRequest, (req, res) => {
    const cfg = gspClient.config();
    res.json({ configured: cfg.configured, provider: cfg.provider || null });
});

app.post('/api/einvoice/irn', authenticateRequest, async (req, res) => {
    const { invoiceId, payload } = req.body || {};
    if (!invoiceId || !payload || typeof payload !== 'object') return res.status(400).json({ error: 'invoiceId and payload are required' });
    try {
        const ref = firestore().collection('users').doc(req.user.uid).collection('invoices').doc(String(invoiceId));
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Invoice not found' });
        if (snap.data().irn) return res.status(409).json({ error: 'An IRN already exists for this invoice', irn: snap.data().irn });
        const result = await gspClient.generateIrn(payload);
        const update = {
            irn: result.irn,
            ackNo: result.ackNo,
            ackDate: result.ackDate,
            signedQrCode: result.signedQrCode,
            einvoiceStatus: 'Generated',
            einvoiceAt: new Date().toISOString(),
        };
        if (result.ewbNo) update.ewbNo = String(result.ewbNo);
        await ref.update(update);
        res.json({ success: true, ...update });
    } catch (error) {
        if (error instanceof gspClient.GspNotConfiguredError) {
            return res.status(501).json({ error: 'E-invoice is not set up yet. Add your GSP credentials to the server .env.', missing: error.missing });
        }
        if (error instanceof gspClient.GspError) return res.status(422).json({ error: error.message });
        console.error('E-invoice error:', error);
        res.status(500).json({ error: 'E-invoice request failed' });
    }
});

// GST return upload through the configured GSP: OTP -> session -> save GSTR-1.
// Submitting and filing (EVC/DSC) is completed on the GST portal.
const sendReturnsError = (res, error) => {
    if (error instanceof returnsClient.ReturnsNotConfiguredError) {
        return res.status(501).json({ error: 'GST return upload is not set up yet. Add your GSP credentials to the server .env.', missing: error.missing });
    }
    if (error instanceof returnsClient.ReturnsError) return res.status(422).json({ error: error.message });
    console.error('GST returns error:', error);
    return res.status(500).json({ error: 'GST portal request failed' });
};

app.get('/api/gst/returns/status', authenticateRequest, (req, res) => {
    const cfg = returnsClient.config();
    res.json({ configured: cfg.configured, provider: cfg.provider || null });
});

app.post('/api/gst/returns/otp', authenticateRequest, rateLimiter, async (req, res) => {
    try {
        res.json(await returnsClient.requestOtp(req.user.uid));
    } catch (error) {
        sendReturnsError(res, error);
    }
});

app.post('/api/gst/returns/session', authenticateRequest, rateLimiter, async (req, res) => {
    try {
        res.json({ success: true, ...(await returnsClient.verifyOtp(req.user.uid, req.body?.otp)) });
    } catch (error) {
        sendReturnsError(res, error);
    }
});

app.post('/api/gst/returns/gstr1', authenticateRequest, async (req, res) => {
    try {
        const { fp, payload } = req.body || {};
        res.json({ success: true, ...(await returnsClient.uploadGstr1(req.user.uid, fp, payload)) });
    } catch (error) {
        sendReturnsError(res, error);
    }
});

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

        // Seller branding: the details saved on the invoice when it was issued,
        // else the business's current profile. Never another business's details.
        let seller = data.seller && data.seller.companyName ? data.seller : null;
        if (!seller && inv.userId) {
            const userDoc = await firestore().collection('users').doc(inv.userId).get();
            if (userDoc.exists) {
                const u = userDoc.data();
                seller = {
                    companyName: u.companyName || '',
                    gstin: u.gstin || '',
                    address: u.address || '',
                    city: u.city || '',
                    state: u.state || '',
                    pincode: u.pincode || '',
                    phone: u.phone || '',
                    logoURL: u.logoURL || '',
                    bank: u.bank || {},
                };
            }
        }
        seller = seller || { companyName: '', gstin: '', address: '', phone: '', logoURL: '', bank: {} };
        const companyAddress = [seller.address, [seller.city, seller.state, seller.pincode].filter(Boolean).join(', ')]
            .filter(Boolean)
            .join(', ');

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
            isGstEnabled: data.isGstEnabled !== false,
            // Item-wise GST (invoices saved with gstVersion 2 and later)
            gstVersion: data.gstVersion || null,
            isInterState: Boolean(data.isInterState),
            placeOfSupply: data.placeOfSupply || null,
            taxableAmount: data.taxableAmount ?? null,
            cgstAmount: data.cgstAmount ?? null,
            sgstAmount: data.sgstAmount ?? null,
            igstAmount: data.igstAmount ?? null,
            roundOffAmount: data.roundOffAmount ?? null,
            taxBreakup: data.taxBreakup || [],
            hsnSummary: data.hsnSummary || [],
            declaration: data.declaration || '',
            amount: total,
            balanceDue,
            dueDate: formatDate(data.dueDate),
            seller,
            companyName: seller.companyName,
            logoURL: seller.logoURL,
            companyAddress,
            companyPhone: seller.phone,
            companyGstin: seller.gstin,
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

// Contact-sales form on the landing page. Saved as a support ticket so it shows
// up in the super admin's Support Tickets list.
app.post('/api/public/contact-sales', rateLimiter, async (req, res) => {
    try {
        const clean = (v, max) => String(v ?? '').trim().slice(0, max);
        const body = req.body || {};
        // Honeypot: real visitors never see or fill this field.
        if (clean(body.website, 200)) return res.json({ success: true });

        const name = clean(body.name, 100);
        const email = clean(body.email, 200);
        const phone = clean(body.phone, 30);
        const company = clean(body.company, 150);
        const teamSize = clean(body.teamSize, 30);
        const plan = clean(body.plan, 100);
        const message = clean(body.message, 2000);

        if (!name) return res.status(400).json({ error: 'Please enter your name' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' });
        if (!message) return res.status(400).json({ error: 'Please tell us how we can help' });

        const now = new Date().toISOString();
        const details = [
            `Email: ${email}`,
            phone && `Phone: ${phone}`,
            company && `Company: ${company}`,
            teamSize && `Team size: ${teamSize}`,
            plan && `Interested plan: ${plan}`,
        ].filter(Boolean).join('\n');
        const description = `${message}\n\n${details}`;

        await firestore().collection('supportTickets').add({
            subject: `Sales enquiry${plan ? ` — ${plan}` : ''}`,
            description,
            businessName: company || 'New lead',
            userName: name,
            email,
            phone,
            category: 'Sales',
            source: 'landing-contact-sales',
            priority: 'Medium',
            status: 'Open',
            replies: [],
            createdAt: now,
            updatedAt: now,
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Contact Sales Error:', error);
        res.status(500).json({ error: 'Could not send your message. Please try again.' });
    }
});

// 3. Webhook Endpoint with Signature Verification & Idempotency
// No built-in fallback: a secret written in the code would let anyone forge
// "payment received" events. Without one, webhooks are refused.
const WEBHOOK_SECRET = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;

app.post('/api/payment/webhook', async (req, res) => {
    try {
        if (!WEBHOOK_SECRET) {
            console.warn('Webhook refused: RAZORPAY_WEBHOOK_SECRET is not set in Backend/.env.');
            return res.status(503).json({ error: 'Webhook secret is not configured' });
        }
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

// Endpoint to process a refund
app.post('/process-razorpay-refund', authenticateRequest, async (req, res) => {
  try {
    const { paymentId, amount, reason } = req.body;
    
    // Verify admin permission
    const adminDoc = await firestore().collection('adminUsers').doc(req.user.uid).get();
    if (!adminDoc.exists || (adminDoc.data().role !== "Super Admin" && adminDoc.data().role !== "Finance Admin")) {
        return res.status(403).json({ error: 'Forbidden: Insufficient privileges for refunds.' });
    }

    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId is required' });
    }

    const refundOptions = {
        speed: 'normal'
    };
    if (amount) {
        refundOptions.amount = Math.round(amount * 100);
    }
    if (reason) {
        refundOptions.notes = { reason };
    }

    const refund = await razorpay.payments.refund(paymentId, refundOptions);

    // Audit Log
    await firestore().collection('auditLogs').add({
        action: 'PAYMENT_REFUND',
        module: 'Payments',
        targetId: paymentId,
        targetName: 'Razorpay Gateway',
        details: `Processed refund of ₹${amount || 'Full Amount'} for payment ${paymentId}`,
        adminName: adminDoc.data().name || req.user.email,
        adminEmail: adminDoc.data().email || req.user.email,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, refund });
  } catch (error) {
    console.error('Razorpay Refund Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process refund' });
  }
});

// Endpoint to generate PDF
// Signed-in users only: this renders caller-supplied HTML in a server-side browser.
app.post('/generate-pdf', authenticateRequest, async (req, res) => {
    const { html, css, baseUrl } = req.body;

    if (!html) {
        return res.status(400).send('HTML content is required');
    }

    try {
        console.log('Starting PDF generation...');
        const browser = await puppeteer.launch({
            headless: 'new',
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
    aiRouter.learning.startJobs(); // nightly aiStats rebuild, 02:30 Asia/Kolkata
    console.log(`PDF Server running on http://localhost:${PORT}`);
    if (admin.apps.length) {
        cron.schedule('*/5 * * * *', () => {
            processRecurringInvoices().catch((error) => console.error('Recurring scheduler error:', error));
            processSubscriptions().catch((error) => console.error('Subscription scheduler error:', error));
            aggregatePlatformAnalytics().catch((error) => console.error('Analytics scheduler error:', error));
        });
    }
});
