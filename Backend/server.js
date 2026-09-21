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
