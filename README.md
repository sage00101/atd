# Lustre Mobile Detailing — Concept Site

A React + Tailwind (v4) rebuild of the original template, restructured for a mobile
car detailing business. Light theme, sage-green accent, Fraunces + Inter type.

## Run it

```bash
npm install
npm run dev
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

## Booking approval workflow

Website bookings are saved as Redis-backed requests before payment or final
confirmation. Review them in the Business Manager's **Booking requests** tab:
approving sends the customer a secure continuation link, and declining releases
the temporary appointment slot and any monthly wash reservation. Single-wash
codes are reserved only when an approved customer starts checkout and are
redeemed after Yoco confirms payment. Monthly entitlement washes are reserved
while approval is pending and counted only when the booking is confirmed.
Customers choose Yoco or on-site card-machine payment after approval. Requests
are not confirmed and no payment is taken while they await review. Decline
reasons are included in outcome emails and the secure status page.
Customers can cancel only while a request is still pending; approval or decline
closes that option. Cancellation releases the held appointment slot and monthly
wash reservation, returning that wash to the entitlement's available allowance.
It does not revoke the customer's monthly entitlement code. A single-wash promo
code is reserved at checkout and redeemed only after successful payment, so
cancelling a pending request does not consume that code.
If an outcome email cannot be sent, the manager can retry it from the request
card. A checkout interrupted during startup can be retried from the customer's
secure status page after the in-progress attempt becomes stale. Active requests
remain available in a dismissible status drawer and a navbar shortcut appears
once the request is approved or checkout has started.

The **Monthly Clients** manager tracks a customer's package, random access code,
payment history, prepaid wash-credit balance, reservations, and confirmed
bookings. A confirmed first monthly-package payment automatically creates the
entitlement, grants its 2 (Standard) or 4 (Premium) wash credits, and emails the
code. Each booking reserves one credit, confirmation consumes it, and
cancellation or an expired request restores it. Unused credits roll over while
the entitlement remains active and paid through. The booking cap is still 2 or
4 confirmed/reserved appointments in each billing period, anchored to the
customer's payment date; rollover credits do not increase that per-period cap.

Later monthly payments are recorded manually in the Monthly Clients manager.
Recording a renewal extends the paid-through date, adds that package's washes
without clearing rollover credits, records the payment reference, and emails
the existing code. A payment for a customer who already has an entitlement is
queued for manager review instead of creating a duplicate code; apply it to the
matching customer record in the manager. Email delivery requires the configured
Resend integration. Existing entitlements are migrated with the remaining
allowance in their current billing period as the initial credit balance; their
older historical monthly periods are not retroactively converted into rollover
credits.

The request API is `/api/bookings/requests`; approval actions are protected by
the existing `ADMIN_API_KEY` or `CALENDAR_API_KEY` at
`/api/admin/booking-requests`. Requests and their event history are retained in
Upstash Redis; temporary requests/reservations expire after three days. Keep
`BOOKING_TOKEN_ENCRYPTION_KEY` stable across deployments while requests are
active (if absent, the backend falls back to `ADMIN_API_KEY`). Continue using
the configured `SITE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`YOCO_SECRET_KEY`, `YOCO_WEBHOOK_SECRET`, and Upstash Redis credentials.

The booking availability, request, on-site, on-site payment confirmation, and
Yoco checkout endpoints are routed through one Vercel function to stay within
the Hobby plan's 12-function deployment limit. Keep the Vercel project root
directory set to `server` so `server/vercel.json` rewrites are applied.

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
    booking-section.jsx        date/time booking request and customer checkout
    monthly-checkout-page.jsx  monthly entitlement booking flow
    booking-request-page.jsx   secure request status and continuation page
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

- **Booking** — appointment slots and approval are enforced by the Redis-backed
  booking APIs. Customers can cancel pending requests; rescheduling is not currently
  provided.
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
