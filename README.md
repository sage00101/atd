# Lustre Mobile Detailing — Concept Site

A React + Tailwind (v4) rebuild of the original template, restructured for a mobile
car detailing business. Light theme, sage-green accent, Fraunces + Inter type.

## Run it

```bash
npm install
npm run dev
```

Booking lifecycle regression tests use Node's experimental module mocking:

```bash
node --experimental-test-module-mocks --test server/test/booking-lifecycle.test.js server/test/service-address-continuation.test.js
```

## Monthly client management email

The Business Manager's **Monthly Clients** tab stores a customer's contact
details and package with their monthly entitlement. Individual and bulk access
code emails use the existing Resend integration (`RESEND_API_KEY` and
`RESEND_FROM_EMAIL`). Set `SITE_URL` to the public booking-page URL so the email
button opens checkout with the customer's package preselected.

Bulk sends require an on-screen recipient preview and confirmation. Each send
is recorded in Redis; provider acceptance is distinct from delivery. To record
delivery, configure a Resend webhook for `email.delivered`, `email.bounced`,
`email.failed`, and `email.complained` at `/api/webhooks/resend`, and set the
webhook signing secret as `RESEND_WEBHOOK_SECRET` in the deployment environment.

## Booking workflow

Customers submit a booking request and choose secure Yoco checkout or payment on
arrival. Requests reserve their chosen slot while awaiting review. Once approved,
on-site bookings and covered Monthly Clients washes are confirmed when the customer
continues; online bookings are confirmed by the Yoco payment webhook. Booking
receipts are sent after confirmation. Returning from a cancelled or failed online
checkout releases its pending slot and updates the request in the Business Manager.
Failed-payment webhooks also release pending slots. If a customer abandons checkout
without returning or a payment event, the hold expires automatically. Appointments
require at least one hour's notice in South African time.

New booking requests are emailed to the customer and to
`BOOKING_REQUEST_EMAIL` (default: `bookings@a10tion.co.za`), including any
contract attachment on the business copy. Approval, decline, and confirmation
emails go to the customer only; SMS notifications remain separate.

Both checkout forms accept a manually entered service address without a map or
distance restriction. Optional address suggestions use the free public Photon
service and send the typed search to it; availability and coverage are not
guaranteed, and manual entry remains available if lookup fails.

Single-wash promo codes are checked live while the customer enters them; a valid
code immediately updates the displayed total. This preview does not reserve the
code, which is checked and reserved again when the approved booking is completed.
Codes are redeemed after Yoco confirms payment or an on-site payment is recorded.
The Business Manager continues to manage promo
batches, Monthly Clients, booking requests and calendar availability. Pending
request and checkout holds expire automatically within three days.

The **Monthly Clients** manager tracks a customer's package, random access code,
payment history, prepaid wash-credit balance, reservations, and confirmed
bookings. A confirmed first monthly-package payment automatically creates the
customer's profile, generates an access code, and includes the code in the
payment receipt. Website purchases grant all credits for the selected
term, less one credit for the initial booked wash. Each booking reserves one
credit and confirmation consumes it; cancelled or expired reservations restore
the credit.

The booking cap is 1 wash per calendar month for Business Standard, 2 for
Private Standard, and 4 for Private Premium. It resets on the first of each
calendar month and is independent of the contract start date. Unused credits
roll over indefinitely, including after the contract ends, but do not increase
the monthly booking cap.

Later monthly payments are recorded manually in the Monthly Clients manager.
Recording a renewal requires the payment date, amount, and term; it extends the
paid-through date and adds that term's package credits without clearing rollover
credits. A payment for a customer who already has an entitlement is queued for
manager review instead of creating a duplicate profile; apply it to the
matching customer record in the manager. Package changes are available only
when the existing balance and reservations are both zero. A manager-assigned
package grants all credits for its selected term without deducting an initial
wash. Legacy accounts without a credit ledger initialize with the unused
allowance for the current calendar month; older pre-migration periods are not
reconstructed as additional credits. Email delivery requires the configured
Resend integration.

The protected Business Manager calendar shows the customer's email on booked
slots when available. Public availability calendars never receive these emails.
Existing bookings can be cancelled there even if their time is no longer offered;
the customer cancellation email must be sent before the slot is released.

The booking availability, cancellation, on-site, on-site payment confirmation, and Yoco
checkout endpoints are routed through one Vercel function to stay within the
Hobby plan's 12-function deployment limit. Keep the Vercel project root
directory set to `server` so `server/vercel.json` rewrites are applied. Continue
using the configured `SITE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`YOCO_SECRET_KEY`, `YOCO_WEBHOOK_SECRET`, and Upstash Redis credentials.

For SMS alerts, configure `SMSMESSENGER_EMAIL`, `SMSMESSENGER_API_KEY`, and
`BUSINESS_SMS` in the backend's Vercel environment and redeploy after changes.
In Business Manager, open **Promo codes** and use **Send test SMS** with the
requested details. The result confirms provider acceptance, not delivery to the phone.
When a booking request is accepted, approval SMS messages go to the customer
and business numbers. They describe the requested wash and remind the customer
to complete the booking using the email link. The manager reports any notification
failure; provider acceptance does not guarantee delivery.
When a request is declined, the customer receives an email with the reason and
an SMS directing them to that email. The manager reports failures independently.

Google review ages are calculated from Google's original publication timestamp
when the website loads. Use **Fetch Google reviews** in Business Manager to
refresh timestamp metadata for previously approved reviews; reviews without a
valid publication timestamp are shown without a guessed age.

## Vacancy applications with Formspree

The vacancies form submits through Formspree. To connect applications to the
company email address:

1. Create a form at [formspree.io](https://formspree.io/) and verify the email
  address that should receive applications in the Formspree dashboard.
2. Copy the form endpoint, which looks like `https://formspree.io/f/xxxxx`.
3. Add it to a local `.env` file as:

```bash
VITE_FORMSPREE_VACANCIES_URL=https://formspree.io/f/your-form-id
```

4. Restart Vite after changing `.env`. The applicant's email is sent as
  Formspree's reply-to address, and the uploaded CV is included as `cv_file`.

The form accepts PDF CVs up to 5 MB. Do not commit `.env`; the endpoint belongs
in each deployment environment.

## Structure

```
src/
  App.jsx                     page assembly / section order
  index.css                   design tokens (@theme), reveal + gleam animation utilities
  hooks/use-reveal.js         shared scroll-reveal IntersectionObserver hook
  components/
    navbar.jsx                 sticky nav + mobile menu
    footer.jsx                 policy links, business/B-BBEE info
    section-title.jsx          reusable eyebrow + heading + description
    before-after-slider.jsx    draggable before/after comparison widget
    lenis-scroll.jsx           smooth-scroll wrapper
  sections/
    hero-section.jsx
    about-section.jsx
    services-section.jsx
    gallery-section.jsx
    booking-section.jsx        date/time booking and customer checkout
    monthly-checkout-page.jsx  monthly entitlement booking flow
    reviews-section.jsx        static mockup — see integration notes below
    service-area-section.jsx
    contact-section.jsx
    promo-section.jsx          QR code, discount code, promo video placeholder
```

## Placeholder content to replace before launch

- **Phone / email / WhatsApp** (`contact-section.jsx`) — currently `+27 21 000 0000`
  and `hello@lustredetailing.co.za`.
- **Business banking details** (`contact-section.jsx`) — bank, account name/number,
  branch code are all placeholders.
- **Business registration, VAT & B-BBEE details** (`footer.jsx`).
- **Footer policy links** (`footer.jsx`) — `/privacy-policy`, `/terms-and-conditions`,
  `/cancellation-policy`, `/no-show-policy`, `/grace-period` currently point to routes
  that don't exist yet; wire these up once the policy pages are written, and fold the
  actual grace-period length and no-show/cancellation terms into that copy.
- **Discount code** (`promo-section.jsx`) — `FIRSTSHINE10` is illustrative.
- **QR code target** (`promo-section.jsx`) — `SITE_URL` currently points at a
  placeholder domain; the QR image itself is generated live via api.qrserver.com,
  so updating `SITE_URL` is enough to regenerate it.

## Integration points (currently design-only, per brief)

- **Booking** — appointment slots and direct confirmations are enforced by the
  Redis-backed booking APIs. Rescheduling is not currently provided.
- **Reviews (`reviews-section.jsx`)** — `reviews` is a static array today. Replace
  with a live Google Places/Reviews API response (or a small serverless proxy) once
  the business has a Google Business Profile connected. Keep the same shape
  (`initial`, `name`, `date`, `quote`) or adjust `ReviewCard` accordingly.
- **Promo video (`promo-section.jsx`)** — the "Promo video · Coming soon" tile is a
  placeholder card; swap its contents for an embedded video/ad unit when ready.

## Imagery

All photography is temporary stock (Pexels, royalty-free) for presentation purposes
only — swap for the client's own vehicle photography before launch, particularly the
Before & After gallery, which should use real client work once available.
