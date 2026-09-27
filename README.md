# Lustre Mobile Detailing — Concept Site

A React + Tailwind (v4) rebuild of the original template, restructured for a mobile
car detailing business. Light theme, sage-green accent, Fraunces + Inter type.

## Run it

```bash
npm install
npm run dev
```

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
    booking-section.jsx        static mockup — see integration notes below
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

- **Booking (`booking-section.jsx`)** — the calendar/time-slot grid is static markup.
  Swap it for a real scheduling integration that enforces: 1.5-hour appointment
  blocks, no double-bookings, confirmation emails/SMS, self-service cancellation and
  rescheduling. The surrounding layout and copy are written to make that swap
  drop-in — the widget card is a single self-contained block.
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
