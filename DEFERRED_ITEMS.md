# DEFERRED ITEMS — revisit once all phases are done

Things intentionally left unconfigured, mocked, or empty because they need
real-world resources (SMTP credentials, payment gateway keys, a domain,
hosting decisions, etc.) that aren't available during development. Nothing
here is a bug — it's a known list to work through together at the end,
alongside the security/market recommendations already discussed.

## Email / Notifications
- **No SMTP configured** — all "email" sending currently just logs to the
  console in dev (Django's default backend). This blocks:
  - Vendor approval credentials email (works in dev/console, not in real inboxes)
  - Password reset emails
  - "Order delivered — leave feedback" email (the actual link-in-email flow
    for `/order-feedback/:orderCode` doesn't exist yet — customers only
    reach that page via Account → Orders right now)
  - Low-stock admin alerts (logic is wired, §7.2, but goes nowhere real)
  - The 4 notification toggles in Admin Settings (§7.7 — New Order, New
    Vendor Application, Low-Stock, Payout Requests) save correctly but
    don't trigger any actual email yet; called out explicitly in the PRD
    itself now rather than left implicit
- **No SMS notifications** — common expectation in the Pakistani market
  (order confirmation/delivery updates via SMS), not built at all.

## Payments
- Card gateway (Stripe or similar) — UI exists, not connected to a real
  processor.
- JazzCash / EasyPaisa — same; selection UI exists, no real gateway
  integration.
- Only Cash on Delivery is a "real" payment method end-to-end.

## Security (recap from the audit — see chat history for full detail)
- Rate limiting is narrower than it looks — only auth endpoints are
  throttled; product listing, order creation, and especially
  `/orders/track/` (guessable code + contact lookup) are not.
- `SECRET_KEY` has an insecure dev fallback with no startup check
  preventing accidental production use.
- No production security headers (HSTS, SSL redirect, content-type-nosniff).
- CSRF protection on the custom cookie-JWT auth class hasn't been
  explicitly tested (SameSite=Lax likely mitigates it, but unverified).
- No MFA on admin accounts.
- reCAPTCHA is scaffolded (settings key exists) but not wired up.
- CNIC images in vendor applications aren't validated for file
  type/size the way banner images already are.

## Feature gaps flagged during the marketplace-UX survey
- No vendor storefront page (click a vendor name → see everything they sell).
- No wishlist / save-for-later.
- No search autocomplete; Shop lost its rating filter when the mock catalog
  was ripped out (real rating data exists now — cheap to re-add).
- Multi-vendor cart/checkout doesn't show a per-vendor cost breakdown.
- No customer-initiated order cancellation (only admin can change status).
- No 404 page, no robots.txt/sitemap/meta tags, no favicon.
- Checkout isn't idempotent — a slow network + retry could theoretically
  create two real orders (no idempotency key yet).
- No admin audit log (who approved/rejected what, and when) — a few
  scattered fields exist (`decided_by`, `resolved_by`) but nothing unified.

## Feedback page (§7.3, this session)
- Photo upload on the feedback form is UI-only — the dropzone renders,
  nothing is actually stored.
- No loyalty points / rewards system exists (the "Earn 50 points" copy in
  the reference UI wasn't implemented as a real feature).

## Real-time inventory sync (§7.1)
- Not started — the one deliberately-postponed piece of Phase 7. Needs a
  real architecture decision (Django Channels + ASGI + Redis channel
  layer, docker-compose changes) before implementation.

## Quick follow-ups (no external config needed — cheap, do anytime)
- Add rating stars + count to Shop/Home product cards (ProductDetail
  already shows it; `average_rating`/`rating_count` exist on the API).
- Re-add Shop's rating filter/sort (removed when mock catalog was ripped
  out since there was no real rating data yet — that data exists now).

## Phase 8 additions (this session)
- **Admin coupons UI** — backend CRUD (`/api/orders/admin/coupons/`) is real
  and tested, but there's no `Coupons.jsx` admin page yet. Creating/editing
  codes currently needs direct API calls (Postman, Django admin, etc.).
- **Accessibility pass was a spot-fix, not an audit** — only the highest-
  traffic pages got aria-labels (global header search, Shop view toggle,
  ProductDetail carousel/stepper). Admin panel, vendor panel, and the
  checkout flow's icon-only buttons haven't been reviewed. A real
  accessibility audit (screen reader pass, keyboard nav, color contrast,
  skip-to-content link) is still outstanding.
- **CheckoutConfirmation/OrderSummarySidebar don't display coupon
  discounts** — the backend applies and returns `discount_amount`/
  `coupon_code` correctly (tested), but the confirmation page and cart
  sidebar UI weren't updated to show a "Coupon applied: -Rs. X" line.
- **Security headers/HSTS/SSL-redirect are configured but unverified in a
  real deployment** — they're correct Django settings, but have only been
  exercised via `DEBUG=False` unit checks, not a real HTTPS environment.
- **Rate limits (order-track/order-create/public-catalog) use rough,
  unvalidated numbers** — reasonable guesses, not tuned against real
  traffic patterns.

## Vendor Orders, Payouts & Analytics (this session)
Real Orders page, real Payouts ledger (vendor + admin), and real Analytics
(revenue/views/conversion/traffic-source) replaced the old "Phase 6+"
placeholders. What's still genuinely missing, not faked or stubbed:

- **No live bank/wallet transfer integration** — "Generate Payouts" creates
  correct batches from real delivered-order data, but "Mark Paid" is a
  manual admin action with a free-text reference field. No NayaPay/
  Easypaisa/bank payout API is called. This is the single biggest gap
  standing between what's built and an actual working payout system.
- **Payout schedule is platform-wide, not per-vendor** — one hold period +
  one cycle length (Admin Settings) applies to every vendor. A real system
  would likely let vendors choose their own cadence (Etsy-style) or let
  admin set tiers by vendor trust level.
- **No payout failure/retry handling** — if a "Paid" batch's transfer
  actually failed outside the platform, there's no way to reopen it; an
  admin would have to fix it directly in Django admin.
- **Traffic-source detection is referrer-based only** — no UTM parameter
  capture, no campaign tracking, no session/cookie-level attribution. It's
  a coarse direct/search/social/other bucket, good enough for a directional
  read, not for real marketing attribution.
- **Conversion rate is a simple ratio** (orders in range ÷ views in range),
  not a true session-to-purchase funnel — a customer who views on Monday
  and buys Thursday still counts, and there's no per-session linkage.
- **No returning-vs-new-visitor split, no geographic breakdown** — nothing
  captures visitor identity or location at all (deliberately — kept PII-free).
- **Analytics/Payouts admin views have no CSV export** and the date range
  is fixed to 7/30/90-day tabs, no custom picker.
