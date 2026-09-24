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

// Initialize Firebase Admin if key file is present, or with projectId fallback
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (!admin.apps.length) {
    if (fs.existsSync(serviceAccountPath)) {
        try {
            admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
        } catch (e) {
            console.warn('Firebase Admin initialization skipped:', e.message);
        }
    } else {
        try {
            admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'billing-software-19d79' });
        } catch (e) {
            console.warn('Firebase Admin default project initialization skipped:', e.message);
        }
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
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!token) return res.status(401).json({ error: 'Authentication required' });

        if (fs.existsSync(serviceAccountPath)) {
            requireAdmin();
            req.user = await admin.auth().verifyIdToken(token);
            return next();
        }

        try {
            req.user = await admin.auth().verifyIdToken(token);
            return next();
        } catch (authErr) {
            // Development fallback: decode JWT claims when serviceAccountKey.json is absent locally
            const parts = token.split('.');
            if (parts.length === 3) {
                try {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                    if (payload && (payload.user_id || payload.sub)) {
                        req.user = {
                            uid: payload.user_id || payload.sub,
                            email: payload.email || '',
                            ...payload,
                        };
                        return next();
                    }
                } catch (_) {}
            }
            throw authErr;
        }
    } catch (error) {
        res.status(401).json({ error: 'Invalid authentication token: ' + error.message });
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
        let totalUsers = 0; // Cashiers/staff
        let totalSales = 0;
        let activeTerminals = 0;

        for (const doc of usersSnap.docs) {
            totalBusinesses++;
            const data = doc.data();
            if (data.status === 'Active') activeBusinesses++;

            // Count users (cashiers)
            const staffSnap = await doc.ref.collection('cashiers').get();
            totalUsers += staffSnap.size;

            // Aggregate sales (Assuming sales exist in invoices or a totalSales metric)
            if (data.totalSales) totalSales += data.totalSales;
            
            // Count terminals
            const terminalSnap = await doc.ref.collection('terminals').get();
            activeTerminals += terminalSnap.size;
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
                sessions: { value: activeTerminals.toString(), sub: "Active POS Lanes", subColor: "gray-600" }
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

// ─── Warehouse: Barcode Lookup & Management Endpoints ──────────────────────
// Helper: timeout-bound fetch
async function fetchWithTimeout(url, timeoutMs = 4000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

// 1. Resolve Barcode (O(1) via barcodeIndex -> product -> stock, fallback to external lookup)
app.post('/warehouse/barcode/resolve', authenticateRequest, async (req, res) => {
    try {
        const { barcode, godownId } = req.body;
        if (!barcode || typeof barcode !== 'string') {
            return res.status(400).json({ success: false, error: 'barcode is required' });
        }
        const code = barcode.trim();
        const db = firestore();
        const uid = req.user.uid;

        // Step 1: O(1) Check barcodeIndex/{barcode}
        const indexRef = db.collection('users').doc(uid).collection('barcodeIndex').doc(code);
        const indexSnap = await indexRef.get();
        if (indexSnap.exists) {
            const { productId, productCollectionPath } = indexSnap.data();
            const prodRef = productCollectionPath
                ? db.doc(`${productCollectionPath}/${productId}`)
                : db.collection('users').doc(uid).collection('products').doc(productId);
            const prodSnap = await prodRef.get();
            if (prodSnap.exists) {
                const product = { id: prodSnap.id, ...prodSnap.data() };
                let stock = { quantity: 0 };
                if (godownId) {
                    const stockDocId = `${code}_${godownId}`;
                    const stockSnap = await db.collection('users').doc(uid).collection('stock').doc(stockDocId).get();
                    if (stockSnap.exists) {
                        stock = stockSnap.data();
                    }
                }
                return res.json({ success: true, status: 'found', product, stock });
            }
        }

        // Direct check on products/{code} if not in barcodeIndex yet
        const directProdRef = db.collection('users').doc(uid).collection('products').doc(code);
        const directProdSnap = await directProdRef.get();
        if (directProdSnap.exists) {
            const product = { id: directProdSnap.id, ...directProdSnap.data() };
            let stock = { quantity: 0 };
            if (godownId) {
                const stockDocId = `${code}_${godownId}`;
                const stockSnap = await db.collection('users').doc(uid).collection('stock').doc(stockDocId).get();
                if (stockSnap.exists) {
                    stock = stockSnap.data();
                }
            }
            return res.json({ success: true, status: 'found', product, stock });
        }

        // Step 2: Check barcodeCache/{code} (30-day TTL)
        const cacheRef = db.collection('users').doc(uid).collection('barcodeCache').doc(code);
        const cacheSnap = await cacheRef.get();
        if (cacheSnap.exists) {
            const cacheData = cacheSnap.data();
            const cachedAt = cacheData.cachedAt?.toDate ? cacheData.cachedAt.toDate() : new Date(cacheData.cachedAt || 0);
            if (Date.now() - cachedAt.getTime() < 30 * 24 * 60 * 60 * 1000) {
                return res.json({ success: true, status: 'external_found', lookupData: cacheData.lookupData });
            }
        }

        // Step 3: Fallback external lookup: Open Food Facts -> UPCItemDB
        let externalData = null;
        try {
            const r = await fetchWithTimeout(`https://world.openfoodfacts.org/api/v0/product/${code}.json`, 4000);
            if (r.ok) {
                const data = await r.json();
                if (data.status === 1 && data.product) {
                    const p = data.product;
                    const name = (p.product_name || p.product_name_en || '').trim();
                    if (name) {
                        externalData = {
                            name,
                            brand: (p.brands || '').trim(),
                            category: (p.categories_tags?.[0] || '').replace(/^[a-z]+:/, '').trim(),
                            imageUrl: p.image_front_url || p.image_url || '',
                            barcode: code,
                        };
                    }
                }
            }
        } catch (_) {}

        if (!externalData) {
            try {
                const r = await fetchWithTimeout(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, 4000);
                if (r.ok) {
                    const data = await r.json();
                    if (data.code === 'OK' && data.items?.length) {
                        const item = data.items[0];
                        const name = (item.title || '').trim();
                        if (name) {
                            externalData = {
                                name,
                                brand: (item.brand || '').trim(),
                                category: (item.category || '').trim(),
                                imageUrl: item.images?.[0] || '',
                                barcode: code,
                            };
                        }
                    }
                }
            } catch (_) {}
        }

        if (externalData) {
            await cacheRef.set({
                lookupData: externalData,
                source: externalData.brand ? 'external' : 'lookup',
                cachedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            return res.json({ success: true, status: 'external_found', lookupData: externalData });
        }

        return res.json({ success: true, status: 'not_found', barcode: code });
    } catch (err) {
        console.error('Resolve barcode error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// 2. Stock In (Atomic WriteBatch / runTransaction: increment stock and record IN movement)
app.post('/warehouse/stock/in', authenticateRequest, async (req, res) => {
    try {
        const { barcode, godownId, quantity, referenceNo, remarks, operatorName } = req.body;
        const qty = Number(quantity);
        if (!barcode || typeof barcode !== 'string') return res.status(400).json({ error: 'Valid barcode is required' });
        if (!godownId || typeof godownId !== 'string') return res.status(400).json({ error: 'Valid godownId is required' });
        if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'Quantity must be a positive integer' });

        const db = firestore();
        const uid = req.user.uid;
        const code = barcode.trim();

        const result = await db.runTransaction(async (transaction) => {
            // Find product
            let productId = code;
            let productData = null;
            const indexRef = db.collection('users').doc(uid).collection('barcodeIndex').doc(code);
            const indexSnap = await transaction.get(indexRef);
            if (indexSnap.exists) {
                productId = indexSnap.data().productId;
                const prodRef = db.collection('users').doc(uid).collection('products').doc(productId);
                const prodSnap = await transaction.get(prodRef);
                if (prodSnap.exists) productData = prodSnap.data();
            } else {
                const prodRef = db.collection('users').doc(uid).collection('products').doc(code);
                const prodSnap = await transaction.get(prodRef);
                if (prodSnap.exists) productData = prodSnap.data();
            }

            if (!productData) {
                throw new Error(`Product not found for barcode ${code}`);
            }

            // Verify godown
            const godownRef = db.collection('users').doc(uid).collection('godowns').doc(godownId);
            const godownSnap = await transaction.get(godownRef);
            if (!godownSnap.exists) {
                throw new Error(`Godown not found: ${godownId}`);
            }
            const godownName = godownSnap.data().name || 'Godown';

            // Atomic stock update & movement in the exact same transaction
            const stockId = `${code}_${godownId}`;
            const stockRef = db.collection('users').doc(uid).collection('stock').doc(stockId);
            const stockSnap = await transaction.get(stockRef);
            const currentStock = stockSnap.exists ? (stockSnap.data().quantity || 0) : 0;
            const newQuantity = currentStock + qty;

            const movRef = db.collection('users').doc(uid).collection('stockMovements').doc();

            transaction.set(stockRef, {
                productBarcode: code,
                productId,
                productName: productData.name || '',
                godownId,
                godownName,
                quantity: newQuantity,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            transaction.set(movRef, {
                productBarcode: code,
                productName: productData.name || '',
                godownId,
                godownName,
                quantity: qty,
                type: 'IN',
                referenceNo: referenceNo || '',
                remarks: remarks || '',
                userId: uid,
                userEmail: req.user.email || '',
                operatorName: operatorName || '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return { newQuantity, movementId: movRef.id, productName: productData.name, godownName };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Stock in error:', error);
        res.status(400).json({ error: error.message });
    }
});

// 3. Stock Out (runTransaction with INSUFFICIENT_STOCK guard)
app.post('/warehouse/stock/out', authenticateRequest, async (req, res) => {
    try {
        const { barcode, godownId, quantity, referenceNo, remarks, operatorName } = req.body;
        const qty = Number(quantity);
        if (!barcode || typeof barcode !== 'string') return res.status(400).json({ error: 'Valid barcode is required' });
        if (!godownId || typeof godownId !== 'string') return res.status(400).json({ error: 'Valid godownId is required' });
        if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'Quantity must be a positive integer' });

        const db = firestore();
        const uid = req.user.uid;
        const code = barcode.trim();

        const result = await db.runTransaction(async (transaction) => {
            let productId = code;
            let productData = null;
            const indexRef = db.collection('users').doc(uid).collection('barcodeIndex').doc(code);
            const indexSnap = await transaction.get(indexRef);
            if (indexSnap.exists) {
                productId = indexSnap.data().productId;
                const prodRef = db.collection('users').doc(uid).collection('products').doc(productId);
                const prodSnap = await transaction.get(prodRef);
                if (prodSnap.exists) productData = prodSnap.data();
            } else {
                const prodRef = db.collection('users').doc(uid).collection('products').doc(code);
                const prodSnap = await transaction.get(prodRef);
                if (prodSnap.exists) productData = prodSnap.data();
            }

            if (!productData) throw new Error(`Product not found for barcode ${code}`);

            const godownRef = db.collection('users').doc(uid).collection('godowns').doc(godownId);
            const godownSnap = await transaction.get(godownRef);
            if (!godownSnap.exists) throw new Error(`Godown not found: ${godownId}`);
            const godownName = godownSnap.data().name || 'Godown';

            const stockId = `${code}_${godownId}`;
            const stockRef = db.collection('users').doc(uid).collection('stock').doc(stockId);
            const stockSnap = await transaction.get(stockRef);
            const currentStock = stockSnap.exists ? (stockSnap.data().quantity || 0) : 0;

            if (currentStock < qty) {
                const err = new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${qty}`);
                err.code = 'INSUFFICIENT_STOCK';
                err.available = currentStock;
                err.requested = qty;
                throw err;
            }

            const newQuantity = currentStock - qty;
            const movRef = db.collection('users').doc(uid).collection('stockMovements').doc();

            transaction.set(stockRef, {
                productBarcode: code,
                productId,
                productName: productData.name || '',
                godownId,
                godownName,
                quantity: newQuantity,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            transaction.set(movRef, {
                productBarcode: code,
                productName: productData.name || '',
                godownId,
                godownName,
                quantity: -qty,
                type: 'OUT',
                referenceNo: referenceNo || '',
                remarks: remarks || '',
                userId: uid,
                userEmail: req.user.email || '',
                operatorName: operatorName || '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return { newQuantity, movementId: movRef.id, productName: productData.name, godownName };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Stock out error:', error);
        res.status(400).json({ error: error.message, code: error.code, available: error.available, requested: error.requested });
    }
});

// 4. Stock Transfer (runTransaction across source & dest godowns with transferGroupId)
app.post('/warehouse/stock/transfer', authenticateRequest, async (req, res) => {
    try {
        const { barcode, fromGodownId, toGodownId, quantity, remarks, operatorName } = req.body;
        const qty = Number(quantity);
        if (!barcode) return res.status(400).json({ error: 'Valid barcode is required' });
        if (!fromGodownId || !toGodownId) return res.status(400).json({ error: 'fromGodownId and toGodownId are required' });
        if (fromGodownId === toGodownId) return res.status(400).json({ error: 'Source and destination godowns must be different' });
        if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'Quantity must be a positive integer' });

        const db = firestore();
        const uid = req.user.uid;
        const code = barcode.trim();

        const result = await db.runTransaction(async (transaction) => {
            let productId = code;
            let productData = null;
            const indexRef = db.collection('users').doc(uid).collection('barcodeIndex').doc(code);
            const indexSnap = await transaction.get(indexRef);
            if (indexSnap.exists) {
                productId = indexSnap.data().productId;
                const prodRef = db.collection('users').doc(uid).collection('products').doc(productId);
                const prodSnap = await transaction.get(prodRef);
                if (prodSnap.exists) productData = prodSnap.data();
            } else {
                const prodRef = db.collection('users').doc(uid).collection('products').doc(code);
                const prodSnap = await transaction.get(prodRef);
                if (prodSnap.exists) productData = prodSnap.data();
            }

            if (!productData) throw new Error(`Product not found for barcode ${code}`);

            const srcGRef = db.collection('users').doc(uid).collection('godowns').doc(fromGodownId);
            const dstGRef = db.collection('users').doc(uid).collection('godowns').doc(toGodownId);
            const [srcGSnap, dstGSnap] = await Promise.all([transaction.get(srcGRef), transaction.get(dstGRef)]);
            if (!srcGSnap.exists) throw new Error(`Source godown not found: ${fromGodownId}`);
            if (!dstGSnap.exists) throw new Error(`Destination godown not found: ${toGodownId}`);

            const srcStockId = `${code}_${fromGodownId}`;
            const dstStockId = `${code}_${toGodownId}`;
            const srcStockRef = db.collection('users').doc(uid).collection('stock').doc(srcStockId);
            const dstStockRef = db.collection('users').doc(uid).collection('stock').doc(dstStockId);

            const [srcStockSnap, dstStockSnap] = await Promise.all([transaction.get(srcStockRef), transaction.get(dstStockRef)]);
            const srcCurrent = srcStockSnap.exists ? (srcStockSnap.data().quantity || 0) : 0;
            const dstCurrent = dstStockSnap.exists ? (dstStockSnap.data().quantity || 0) : 0;

            if (srcCurrent < qty) {
                const err = new Error(`Insufficient stock in ${srcGSnap.data().name}. Available: ${srcCurrent}, Requested: ${qty}`);
                err.code = 'INSUFFICIENT_STOCK';
                err.available = srcCurrent;
                err.requested = qty;
                throw err;
            }

            const srcNewQty = srcCurrent - qty;
            const dstNewQty = dstCurrent + qty;
            const transferGroupId = crypto.randomUUID();

            const movOutRef = db.collection('users').doc(uid).collection('stockMovements').doc();
            const movInRef = db.collection('users').doc(uid).collection('stockMovements').doc();

            transaction.set(srcStockRef, {
                productBarcode: code,
                productId,
                productName: productData.name || '',
                godownId: fromGodownId,
                godownName: srcGSnap.data().name,
                quantity: srcNewQty,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            transaction.set(dstStockRef, {
                productBarcode: code,
                productId,
                productName: productData.name || '',
                godownId: toGodownId,
                godownName: dstGSnap.data().name,
                quantity: dstNewQty,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            transaction.set(movOutRef, {
                productBarcode: code,
                productName: productData.name || '',
                godownId: fromGodownId,
                godownName: srcGSnap.data().name,
                linkedGodownId: toGodownId,
                linkedGodownName: dstGSnap.data().name,
                quantity: -qty,
                type: 'TRANSFER_OUT',
                transferGroupId,
                remarks: remarks || '',
                userId: uid,
                userEmail: req.user.email || '',
                operatorName: operatorName || '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            transaction.set(movInRef, {
                productBarcode: code,
                productName: productData.name || '',
                godownId: toGodownId,
                godownName: dstGSnap.data().name,
                linkedGodownId: fromGodownId,
                linkedGodownName: srcGSnap.data().name,
                quantity: qty,
                type: 'TRANSFER_IN',
                transferGroupId,
                remarks: remarks || '',
                userId: uid,
                userEmail: req.user.email || '',
                operatorName: operatorName || '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return { transferGroupId, sourceQty: srcNewQty, destQty: dstNewQty };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Transfer error:', error);
        res.status(400).json({ error: error.message, code: error.code, available: error.available, requested: error.requested });
    }
});

// 5. Product Creation with Barcode (runTransaction: barcodeIndex + product doc + opening stock + initial IN movement all in one commit)
app.post('/warehouse/products', authenticateRequest, async (req, res) => {
    try {
        const {
            barcode, name, sku = '', category = '', brand = '', unit = 'Piece',
            purchasePrice = '', price = '0', minStockLevel = '0', imageUrl = '',
            initialQuantity = 1, godownId = 'mainGodown', hsn = '', description = '', operatorName = ''
        } = req.body;

        const code = String(barcode || '').trim();
        const prodName = String(name || '').trim();
        const targetGodownId = String(godownId || 'mainGodown').trim();

        if (!code) return res.status(400).json({ error: 'Barcode is required' });
        if (!prodName) return res.status(400).json({ error: 'Product name is required' });

        const initQty = Number(initialQuantity) || 0;
        if (initQty < 0) return res.status(400).json({ error: 'Initial quantity cannot be negative' });

        const db = firestore();
        const uid = req.user.uid;

        const result = await db.runTransaction(async (transaction) => {
            const indexRef = db.collection('users').doc(uid).collection('barcodeIndex').doc(code);
            const indexSnap = await transaction.get(indexRef);
            if (indexSnap.exists) {
                throw new Error(`This barcode (${code}) is already registered to another product.`);
            }

            const prodRef = db.collection('users').doc(uid).collection('products').doc(code);
            const prodSnap = await transaction.get(prodRef);
            if (prodSnap.exists) {
                throw new Error(`Product with barcode (${code}) already exists.`);
            }

            let godownName = 'Main Godown';
            if (targetGodownId) {
                try {
                    const gSnap = await transaction.get(db.collection('users').doc(uid).collection('godowns').doc(targetGodownId));
                    if (gSnap.exists) godownName = gSnap.data().name || 'Main Godown';
                } catch (_) {}
            }

            const ts = admin.firestore.FieldValue.serverTimestamp();
            const productData = {
                name: name.trim(),
                barcode: code,
                sku: (sku || '').trim(),
                category: (category || '').trim(),
                brand: (brand || '').trim(),
                unit: unit || 'Piece',
                purchasePrice: purchasePrice || '',
                price: price || '0',
                minStockLevel: minStockLevel || '0',
                imageUrl: imageUrl || '',
                hsn: hsn || '',
                description: description || '',
                createdAt: ts,
                updatedAt: ts,
            };

            // 1. Write barcodeIndex
            transaction.set(indexRef, {
                productId: code,
                productCollectionPath: `users/${uid}/products`,
                createdAt: ts,
            });

            // 2. Write product doc
            transaction.set(prodRef, productData);

            // 3. Write opening stock and initial IN movement if initQty > 0
            if (initQty > 0 && godownId) {
                const stockId = `${code}_${godownId}`;
                const stockRef = db.collection('users').doc(uid).collection('stock').doc(stockId);
                const movRef = db.collection('users').doc(uid).collection('stockMovements').doc();

                transaction.set(stockRef, {
                    productBarcode: code,
                    productId: code,
                    productName: productData.name,
                    godownId,
                    godownName,
                    quantity: initQty,
                    updatedAt: ts,
                }, { merge: true });

                transaction.set(movRef, {
                    productBarcode: code,
                    productName: productData.name,
                    godownId,
                    godownName,
                    quantity: initQty,
                    type: 'IN',
                    referenceNo: '',
                    remarks: 'Initial scan / opening stock',
                    userId: uid,
                    userEmail: req.user.email || '',
                    operatorName: operatorName || '',
                    createdAt: ts,
                });
            }

            return { id: code, ...productData, initialQuantity: initQty };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(400).json({ error: error.message });
    }
});

// 6. Assign Barcode to Legacy Product (runTransaction: barcodeIndex + update product + stock init + initial IN movement)
app.post('/warehouse/products/assign-barcode', authenticateRequest, async (req, res) => {
    try {
        const { productId, barcode, initialQuantity = 0, godownId, operatorName = '' } = req.body;
        if (!productId) return res.status(400).json({ error: 'productId is required' });
        if (!barcode || typeof barcode !== 'string') return res.status(400).json({ error: 'Valid barcode is required' });

        const initQty = Number(initialQuantity) || 0;
        const db = firestore();
        const uid = req.user.uid;
        const code = barcode.trim();

        const result = await db.runTransaction(async (transaction) => {
            const indexRef = db.collection('users').doc(uid).collection('barcodeIndex').doc(code);
            const indexSnap = await transaction.get(indexRef);
            if (indexSnap.exists) {
                throw new Error(`This barcode (${code}) is already assigned to product ${indexSnap.data().productId}`);
            }

            const prodRef = db.collection('users').doc(uid).collection('products').doc(productId);
            const prodSnap = await transaction.get(prodRef);
            if (!prodSnap.exists) throw new Error(`Product not found: ${productId}`);
            const product = prodSnap.data();

            let godownName = '';
            if (godownId) {
                const gSnap = await transaction.get(db.collection('users').doc(uid).collection('godowns').doc(godownId));
                if (gSnap.exists) godownName = gSnap.data().name || 'Godown';
            }

            const ts = admin.firestore.FieldValue.serverTimestamp();

            // 1. Write barcodeIndex
            transaction.set(indexRef, {
                productId,
                productCollectionPath: `users/${uid}/products`,
                createdAt: ts,
            });

            // 2. Update product barcode
            transaction.update(prodRef, {
                barcode: code,
                updatedAt: ts,
            });

            // 3. Init stock if requested
            if (initQty > 0 && godownId) {
                const stockId = `${code}_${godownId}`;
                const stockRef = db.collection('users').doc(uid).collection('stock').doc(stockId);
                const movRef = db.collection('users').doc(uid).collection('stockMovements').doc();

                transaction.set(stockRef, {
                    productBarcode: code,
                    productId,
                    productName: product.name || '',
                    godownId,
                    godownName,
                    quantity: initQty,
                    updatedAt: ts,
                }, { merge: true });

                transaction.set(movRef, {
                    productBarcode: code,
                    productName: product.name || '',
                    godownId,
                    godownName,
                    quantity: initQty,
                    type: 'IN',
                    referenceNo: '',
                    remarks: 'Barcode assignment / opening stock',
                    userId: uid,
                    userEmail: req.user.email || '',
                    operatorName: operatorName || '',
                    createdAt: ts,
                });
            }

            return { productId, barcode: code, initialQuantity: initQty };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Assign barcode error:', error);
        res.status(400).json({ error: error.message });
    }
});

// 7. Warehouse Dashboard KPIs
app.get('/warehouse/dashboard', authenticateRequest, async (req, res) => {
    try {
        const db = firestore();
        const uid = req.user.uid;

        const [prodSnap, stockSnap, godownSnap, movSnap] = await Promise.all([
            db.collection('users').doc(uid).collection('products').get(),
            db.collection('users').doc(uid).collection('stock').get(),
            db.collection('users').doc(uid).collection('godowns').get(),
            db.collection('users').doc(uid).collection('stockMovements').orderBy('createdAt', 'desc').limit(20).get(),
        ]);

        const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const stockItems = stockSnap.docs.map(d => d.data());

        const totalStock = stockItems.reduce((acc, s) => acc + (s.quantity || 0), 0);

        // Sum quantity across all godowns per product
        const perProductStock = {};
        for (const s of stockItems) {
            const key = s.productBarcode || s.productId;
            perProductStock[key] = (perProductStock[key] || 0) + (s.quantity || 0);
        }

        let lowStock = 0;
        let outOfStock = 0;
        for (const p of products) {
            const total = perProductStock[p.barcode || p.id] || 0;
            const min = Number(p.minStockLevel || 0);
            if (total === 0) outOfStock++;
            else if (min > 0 && total <= min) lowStock++;
        }

        // Today's IN / OUT movements
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let todayIn = 0;
        let todayOut = 0;

        const movements = movSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        for (const m of movements) {
            const mDate = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt || 0);
            if (mDate >= today) {
                if (m.type === 'IN' || m.type === 'TRANSFER_IN') todayIn += Math.abs(m.quantity || 0);
                if (m.type === 'OUT' || m.type === 'TRANSFER_OUT') todayOut += Math.abs(m.quantity || 0);
            }
        }

        res.json({
            success: true,
            data: {
                totalProducts: products.length,
                totalStock,
                lowStock,
                outOfStock,
                todayIn,
                todayOut,
                godownsCount: godownSnap.size,
                recentMovements: movements.slice(0, 10),
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 8. Movements Ledger with Cursor-based pagination & operatorName filter
app.get('/warehouse/movements', authenticateRequest, async (req, res) => {
    try {
        const { cursor, limit = 50, productBarcode, godownId, type, operatorName, dateFrom, dateTo } = req.query;
        const db = firestore();
        const uid = req.user.uid;
        const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

        let q = db.collection('users').doc(uid).collection('stockMovements');

        if (godownId) q = q.where('godownId', '==', godownId);
        if (type && type !== 'ALL') q = q.where('type', '==', type);
        if (productBarcode) q = q.where('productBarcode', '==', productBarcode);
        if (operatorName) q = q.where('operatorName', '==', operatorName);

        q = q.orderBy('createdAt', 'desc');

        if (cursor) {
            const cursorDoc = await db.collection('users').doc(uid).collection('stockMovements').doc(cursor).get();
            if (cursorDoc.exists) {
                q = q.startAfter(cursorDoc);
            }
        }

        q = q.limit(pageSize + 1);

        const snap = await q.get();
        const hasMore = snap.docs.length > pageSize;
        const docs = snap.docs.slice(0, pageSize);
        const movements = docs.map(d => ({ id: d.id, ...d.data() }));
        const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

        res.json({
            success: true,
            data: {
                movements,
                nextCursor,
                hasMore,
            }
        });
    } catch (error) {
        console.error('Movements error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 9. Stock Report Endpoint
app.get('/warehouse/stock/report', authenticateRequest, async (req, res) => {
    try {
        const { groupBy = 'product', format = 'json' } = req.query;
        const db = firestore();
        const uid = req.user.uid;

        const [prodSnap, stockSnap, godownSnap] = await Promise.all([
            db.collection('users').doc(uid).collection('products').get(),
            db.collection('users').doc(uid).collection('stock').get(),
            db.collection('users').doc(uid).collection('godowns').get(),
        ]);

        const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const stockItems = stockSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const godowns = godownSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const productMap = Object.fromEntries(products.map(p => [p.barcode || p.id, p]));
        const godownMap = Object.fromEntries(godowns.map(g => [g.id, g]));

        if (groupBy === 'godown') {
            const grouped = {};
            for (const g of godowns) {
                grouped[g.id] = { godown: g, items: [], totalQuantity: 0 };
            }
            for (const s of stockItems) {
                if (grouped[s.godownId]) {
                    const prod = productMap[s.productBarcode || s.productId] || {};
                    grouped[s.godownId].items.push({
                        ...s,
                        productName: s.productName || prod.name || 'Unknown',
                        category: prod.category || '',
                        brand: prod.brand || '',
                    });
                    grouped[s.godownId].totalQuantity += s.quantity || 0;
                }
            }
            return res.json({ success: true, data: Object.values(grouped) });
        }

        // Default: group by product
        const grouped = {};
        for (const p of products) {
            const key = p.barcode || p.id;
            grouped[key] = {
                product: p,
                totalStock: 0,
                godownStock: {},
            };
        }
        for (const s of stockItems) {
            const key = s.productBarcode || s.productId;
            if (grouped[key]) {
                grouped[key].totalStock += s.quantity || 0;
                grouped[key].godownStock[s.godownId] = s.quantity || 0;
            }
        }

        res.json({ success: true, data: Object.values(grouped) });
    } catch (error) {
        console.error('Stock report error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 10. Godowns CRUD
app.get('/warehouse/godowns', authenticateRequest, async (req, res) => {
    try {
        const db = firestore();
        const uid = req.user.uid;
        const snap = await db.collection('users').doc(uid).collection('godowns').get();

        if (snap.empty) {
            // Auto-seed Main Godown
            const mainRef = db.collection('users').doc(uid).collection('godowns').doc('mainGodown');
            const data = {
                name: 'Main Godown',
                notes: 'Default warehouse godown — auto-created',
                address: '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            await mainRef.set(data);
            return res.json({ success: true, data: [{ id: 'mainGodown', ...data }] });
        }

        const godowns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ success: true, data: godowns });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/warehouse/godowns', authenticateRequest, async (req, res) => {
    try {
        const { name, address = '', notes = '' } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Godown name is required' });

        const db = firestore();
        const uid = req.user.uid;
        const ts = admin.firestore.FieldValue.serverTimestamp();
        const ref = await db.collection('users').doc(uid).collection('godowns').add({
            name: name.trim(),
            address: address.trim(),
            notes: notes.trim(),
            createdAt: ts,
            updatedAt: ts,
        });

        res.json({ success: true, data: { id: ref.id, name: name.trim(), address: address.trim(), notes: notes.trim() } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/warehouse/godowns/:id', authenticateRequest, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, notes } = req.body;
        const db = firestore();
        const uid = req.user.uid;

        const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (name !== undefined) updateData.name = name.trim();
        if (address !== undefined) updateData.address = address.trim();
        if (notes !== undefined) updateData.notes = notes.trim();

        await db.collection('users').doc(uid).collection('godowns').doc(id).update(updateData);
        res.json({ success: true, data: { id, ...updateData } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/warehouse/godowns/:id', authenticateRequest, async (req, res) => {
    try {
        const { id } = req.params;
        const db = firestore();
        const uid = req.user.uid;

        // Block delete if godown has any stock > 0
        const stockSnap = await db.collection('users').doc(uid).collection('stock').where('godownId', '==', id).get();
        const hasStock = stockSnap.docs.some(d => (d.data().quantity || 0) > 0);
        if (hasStock) {
            return res.status(400).json({ error: 'Cannot delete godown with non-zero stock. Transfer or clear all stock first.' });
        }

        await db.collection('users').doc(uid).collection('godowns').doc(id).delete();
        res.json({ success: true, message: 'Godown deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 11. Staff CRUD (for operator picker)
app.get('/warehouse/staff', authenticateRequest, async (req, res) => {
    try {
        const db = firestore();
        const uid = req.user.uid;
        const snap = await db.collection('users').doc(uid).collection('staff').get();
        const staff = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ success: true, data: staff });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/warehouse/staff', authenticateRequest, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Staff name is required' });

        const db = firestore();
        const uid = req.user.uid;
        const ref = await db.collection('users').doc(uid).collection('staff').add({
            name: name.trim(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ success: true, data: { id: ref.id, name: name.trim() } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// Warehouse: Link admin UID to warehouse user
// Called once by the ADMIN user (with their token) to write their UID into the
// warehouse user's Firestore settings/profile so the warehouse can read their products.
// ────────────────────────────────────────────────────────────────────────────
app.post('/warehouse/link-admin', authenticateRequest, async (req, res) => {
    try {
        const adminUid = req.user.uid;
        const { warehouseEmail } = req.body;

        if (!warehouseEmail) {
            return res.status(400).json({ error: 'warehouseEmail is required' });
        }

        // Look up the warehouse user by email
        let warehouseUid;
        try {
            const warehouseUser = await admin.auth().getUserByEmail(warehouseEmail.trim().toLowerCase());
            warehouseUid = warehouseUser.uid;
        } catch (lookupErr) {
            return res.status(404).json({ error: `Warehouse user "${warehouseEmail}" not found: ${lookupErr.message}` });
        }

        // Write linkedAdminUid to warehouse user's settings/profile
        const db = firestore();
        await db.doc(`users/${warehouseUid}/settings/profile`).set({
            linkedAdminUid: adminUid,
            linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        res.json({
            success: true,
            message: `Warehouse user (${warehouseEmail}) linked to admin UID ${adminUid}`,
            adminUid,
            warehouseUid,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`PDF Server running on http://localhost:${PORT}`);
    if (admin.apps.length) {
        cron.schedule('*/5 * * * *', () => {
            processRecurringInvoices().catch((error) => console.error('Recurring scheduler error:', error));
            processSubscriptions().catch((error) => console.error('Subscription scheduler error:', error));
            aggregatePlatformAnalytics().catch((error) => console.error('Analytics scheduler error:', error));
        });
    }
});
