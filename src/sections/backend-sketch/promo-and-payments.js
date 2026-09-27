/**
 * A10tion To Detail — backend sketch
 * ----------------------------------
 * Drop into an Express (or similar) API that already serves your Vite app.
 * Requires: express, multer (for monthly contract files), node-fetch or native fetch,
 *           a DB (example uses a simple in-memory Map — replace with Postgres/Mongo),
 *           optional: nodemailer / Resend, Twilio for SMS.
 *
 * Env:
 *   YOCO_SECRET_KEY=sk_test_... or sk_live_...
 *   YOCO_WEBHOOK_SECRET=...   (from Yoco webhook settings)
 *   SITE_URL=https://a10tion.co.za
 *   BUSINESS_EMAIL=bookings@a10tion.co.za
 *   BUSINESS_SMS=+27...
 *   RESEND_API_KEY=...        (or SMTP)
 *   TWILIO_ACCOUNT_SID=...
 *   TWILIO_AUTH_TOKEN=...
 *   TWILIO_FROM=+27...
 */

import express from 'express';
import crypto from 'crypto';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ---------------------------------------------------------------------------
// In-memory stores (replace with real DB)
// ---------------------------------------------------------------------------
/** @type {Map<string, { code: string, vehicleRegistration: string, email: string, usedAt: string|null, createdAt: string }>} */
const promoCodes = new Map();

/** @type {Map<string, object>} */
const pendingBookings = new Map(); // keyed by yoco checkout id

const SINGLE_WASH_CENTS = {
  'Sedan / Hatchback': 65000,
  'SUV / Bakkie': 85000,
  'Minibus / Van': 110000,
};

const PROMO_DISCOUNT_RATE = 0.1; // 10%

function normaliseReg(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]/g, '');
}

function looksLikeVehicleRegistration(value) {
  const cleaned = normaliseReg(value);
  if (cleaned.length < 5 || cleaned.length > 12) return false;
  if (!/^[A-Z0-9]+$/.test(cleaned)) return false;
  if (!/[A-Z]/.test(cleaned) || !/[0-9]/.test(cleaned)) return false;
  return true;
}

/** Generate a human-friendly one-time code: A10-XXXXXXXX */
export function generatePromoCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let body = '';
  for (let i = 0; i < 8; i += 1) {
    body += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `A10-${body}`;
}

/**
 * Call this after you approve a vehicle promo registration
 * (from Formspree email, admin UI, etc.)
 */
export function issuePromoForRegistration({ vehicleRegistration, email }) {
  if (!looksLikeVehicleRegistration(vehicleRegistration)) {
    throw new Error('Invalid registration format');
  }
  const code = generatePromoCode();
  const record = {
    code,
    vehicleRegistration: normaliseReg(vehicleRegistration),
    email: String(email || '').trim().toLowerCase(),
    usedAt: null,
    createdAt: new Date().toISOString(),
  };
  promoCodes.set(code, record);
  return record;
}

// ---------------------------------------------------------------------------
// POST /api/promos/verify
// Body: { promoCode, vehicleRegistration, email, purchaseType }
// ---------------------------------------------------------------------------
router.post('/promos/verify', express.json(), (req, res) => {
  const promoCode = String(req.body?.promoCode || '').trim().toUpperCase();
  const vehicleRegistration = normaliseReg(req.body?.vehicleRegistration);
  const purchaseType = req.body?.purchaseType || 'single';

  if (purchaseType !== 'single') {
    return res.status(400).json({ valid: false, message: 'Promo codes apply to single washes only.' });
  }
  if (!promoCode) {
    return res.status(400).json({ valid: false, message: 'Enter a promo code.' });
  }
  if (!looksLikeVehicleRegistration(vehicleRegistration)) {
    return res.status(400).json({ valid: false, message: 'Enter a valid-looking vehicle registration number.' });
  }

  const record = promoCodes.get(promoCode);
  if (!record) {
    return res.status(404).json({ valid: false, message: 'This promo code was not found.' });
  }
  if (record.usedAt) {
    return res.status(410).json({ valid: false, message: 'This promo code has already been used.' });
  }
  if (record.vehicleRegistration !== vehicleRegistration) {
    return res.status(400).json({
      valid: false,
      message: 'This promo code is not linked to the registration number you entered.',
    });
  }

  return res.json({
    valid: true,
    discountPercent: 10,
    message: 'Promo verified. A 10% single-wash discount will be applied securely at checkout. The code becomes invalid after a successful purchase.',
  });
});

// ---------------------------------------------------------------------------
// POST /api/payments/yoco/checkout
// multipart: field "booking" (JSON string) + optional contract_files
// ---------------------------------------------------------------------------
router.post('/payments/yoco/checkout', upload.array('contract_files', 10), async (req, res) => {
  try {
    let booking;
    try {
      booking = JSON.parse(req.body.booking || '{}');
    } catch {
      return res.status(400).json({ message: 'Invalid booking payload.' });
    }

    const {
      purchaseType,
      packageId,
      packageName,
      vehicleType,
      bookingDate,
      bookingTime,
      promoCode,
      customer,
      serviceAreaAccepted,
      termsAccepted,
    } = booking;

    if (!serviceAreaAccepted || !termsAccepted) {
      return res.status(400).json({ message: 'Required confirmations missing.' });
    }
    if (!bookingDate || !bookingTime) {
      return res.status(400).json({ message: 'Choose a date and time.' });
    }
    if (!looksLikeVehicleRegistration(customer?.registration)) {
      return res.status(400).json({ message: 'Invalid vehicle registration format.' });
    }

    // --- Amount (single wash example; extend for monthly packages) ---
    let amountCents;
    let discountCents = 0;
    let appliedPromo = null;

    if (purchaseType === 'single') {
      amountCents = SINGLE_WASH_CENTS[vehicleType];
      if (!amountCents) {
        return res.status(400).json({ message: 'Unknown vehicle type.' });
      }

      if (promoCode) {
        const code = String(promoCode).trim().toUpperCase();
        const record = promoCodes.get(code);
        const reg = normaliseReg(customer.registration);
        if (
          record
          && !record.usedAt
          && record.vehicleRegistration === reg
        ) {
          discountCents = Math.round(amountCents * PROMO_DISCOUNT_RATE);
          amountCents -= discountCents;
          appliedPromo = code;
        }
        // If promo invalid, still allow full-price checkout (or reject — your choice)
      }
    } else {
      // TODO: look up monthly package price by packageId + vehicle / contract
      return res.status(400).json({ message: 'Monthly package pricing must be calculated server-side.' });
    }

    const yocoSecret = process.env.YOCO_SECRET_KEY;
    if (!yocoSecret) {
      return res.status(500).json({ message: 'Payment gateway not configured.' });
    }

    const siteUrl = process.env.SITE_URL || 'https://a10tion.co.za';
    const idempotencyKey = crypto.randomUUID();

    const yocoRes = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${yocoSecret}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: 'ZAR',
        successUrl: `${siteUrl}/booking/success`,
        cancelUrl: `${siteUrl}/#booking`,
        failureUrl: `${siteUrl}/#booking`,
        metadata: {
          packageId,
          packageName,
          purchaseType,
          vehicleType: vehicleType || '',
          bookingDate,
          bookingTime,
          registration: normaliseReg(customer.registration),
          promoCode: appliedPromo || '',
          customerEmail: customer.email,
          customerMobile: customer.mobile,
          customerName: `${customer.firstName} ${customer.surname}`.trim(),
        },
      }),
    });

    const yocoBody = await yocoRes.json().catch(() => ({}));
    if (!yocoRes.ok || !yocoBody.redirectUrl) {
      console.error('Yoco error', yocoBody);
      return res.status(502).json({ message: yocoBody.message || 'Could not start secure payment.' });
    }

    // Store pending booking until webhook confirms payment
    pendingBookings.set(yocoBody.id, {
      ...booking,
      amountCents,
      discountCents,
      appliedPromo,
      yocoCheckoutId: yocoBody.id,
      createdAt: new Date().toISOString(),
    });

    return res.json({ redirectUrl: yocoBody.redirectUrl, checkoutId: yocoBody.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Secure payment could not be started.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/payments/yoco/webhook
// Mark promo used, save booking, send receipt email + business email + SMS
// ---------------------------------------------------------------------------
router.post('/payments/yoco/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Verify signature if Yoco provides webhook-signature header
  // const signature = req.headers['webhook-signature'];
  // ... HMAC check with YOCO_WEBHOOK_SECRET ...

  let event;
  try {
    event = JSON.parse(typeof req.body === 'string' ? req.body : req.body.toString('utf8'));
  } catch {
    return res.status(400).send('bad payload');
  }

  if (event.type !== 'payment.succeeded') {
    return res.status(200).send('ignored');
  }

  const checkoutId = event.payload?.metadata?.checkoutId
    || event.payload?.id
    || event.payload?.checkoutId;

  const pending = checkoutId ? pendingBookings.get(checkoutId) : null;
  const meta = event.payload?.metadata || pending || {};

  // 1) Mark promo used (only after successful payment)
  const promo = meta.promoCode || pending?.appliedPromo;
  if (promo && promoCodes.has(promo)) {
    const record = promoCodes.get(promo);
    if (!record.usedAt) {
      record.usedAt = new Date().toISOString();
      promoCodes.set(promo, record);
    }
  }

  // 2) Persist booking in your real DB here
  // await db.bookings.insert({ ...pending, paidAt: new Date(), yocoEvent: event });

  // 3) Build receipt
  const amountCents = pending?.amountCents || event.payload?.amount || 0;
  const amountZar = `R${(amountCents / 100).toFixed(2)}`;
  const receipt = {
    bookingDate: meta.bookingDate || pending?.bookingDate,
    bookingTime: meta.bookingTime || pending?.bookingTime,
    packageName: meta.packageName || pending?.packageName,
    vehicleType: meta.vehicleType || pending?.vehicleType,
    registration: meta.registration || pending?.customer?.registration,
    customerName: meta.customerName || `${pending?.customer?.firstName || ''} ${pending?.customer?.surname || ''}`.trim(),
    customerEmail: meta.customerEmail || pending?.customer?.email,
    customerMobile: meta.customerMobile || pending?.customer?.mobile,
    address: pending?.customer?.address,
    amountZar,
    promoCode: promo || null,
    yocoRef: checkoutId || event.id,
  };

  // 4) Emails (implement with Resend / Nodemailer)
  await sendReceiptEmails(receipt).catch(console.error);

  // 5) SMS to business
  await sendBusinessSms(
    `New booking: ${receipt.bookingDate} ${receipt.bookingTime} · ${receipt.customerName} · ${receipt.registration} · ${receipt.packageName} · ${receipt.amountZar}`
  ).catch(console.error);

  if (checkoutId) pendingBookings.delete(checkoutId);
  return res.status(200).send('ok');
});

async function sendReceiptEmails(receipt) {
  const business = process.env.BUSINESS_EMAIL;
  const html = `
    <h2>A10tion To Detail — booking receipt</h2>
    <p><strong>Ref:</strong> ${receipt.yocoRef}</p>
    <p><strong>Date / time:</strong> ${receipt.bookingDate} at ${receipt.bookingTime}</p>
    <p><strong>Package:</strong> ${receipt.packageName}${receipt.vehicleType ? ` · ${receipt.vehicleType}` : ''}</p>
    <p><strong>Registration:</strong> ${receipt.registration}</p>
    <p><strong>Customer:</strong> ${receipt.customerName}<br/>
       ${receipt.customerEmail} · ${receipt.customerMobile}</p>
    <p><strong>Address:</strong> ${receipt.address || '—'}</p>
    <p><strong>Amount paid:</strong> ${receipt.amountZar}${receipt.promoCode ? ` (promo ${receipt.promoCode})` : ''}</p>
    <p>1.5-hour service · 1-hour travel buffer</p>
  `;

  // Example with Resend:
  // await fetch('https://api.resend.com/emails', {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     from: 'A10tion <bookings@a10tion.co.za>',
  //     to: [receipt.customerEmail],
  //     bcc: business ? [business] : [],
  //     subject: `Booking confirmed — ${receipt.bookingDate} ${receipt.bookingTime}`,
  //     html,
  //   }),
  // });

  console.log('[receipt email]', receipt.customerEmail, business, html.slice(0, 120));
}

async function sendBusinessSms(body) {
  const to = process.env.BUSINESS_SMS;
  if (!to) return;
  // Twilio example:
  // const sid = process.env.TWILIO_ACCOUNT_SID;
  // const token = process.env.TWILIO_AUTH_TOKEN;
  // const from = process.env.TWILIO_FROM;
  // await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
  //   method: 'POST',
  //   headers: {
  //     Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
  //     'Content-Type': 'application/x-www-form-urlencoded',
  //   },
  //   body: new URLSearchParams({ To: to, From: from, Body: body }),
  // });
  console.log('[business SMS]', to, body);
}

export default router;

/**
 * Mount in your main server:
 *
 *   import paymentsRouter from './backend-sketch/promo-and-payments.js';
 *   app.use('/api', paymentsRouter);
 *
 * Yoco dashboard:
 *   - Create Checkout API keys
 *   - Add webhook URL: https://your-domain/api/payments/yoco/webhook
 *   - Subscribe to payment.succeeded
 *
 * After Formspree vehicle registration is approved by staff:
 *   import { issuePromoForRegistration } from './backend-sketch/promo-and-payments.js';
 *   const { code } = issuePromoForRegistration({ vehicleRegistration, email });
 *   // email/SMS the code to the customer
 */
