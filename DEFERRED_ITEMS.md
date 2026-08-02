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
  - Low-stock admin alerts (logic is wired, §7.2, but goes nowhere real
    without SMTP configured — see note above)
  - The 4 notification toggles in Admin Settings (§7.7 — New Order, New
    Vendor Application, Low-Stock, Payout Requests) are now all wired to
    real triggers (previously only Low-Stock was). Still subject to the
    same "no SMTP configured" limitation as everything else on this list.
- **No SMS notifications** — common expectation in the Pakistani market
  (order confirmation/delivery updates via SMS), not built at all.

## Payments
- Card gateway (Stripe or similar) — UI exists, not connected to a real
  processor.
- JazzCash / EasyPaisa — same; selection UI exists, no real gateway
  integration.
- Only Cash on Delivery is a "real" payment method end-to-end.

## Security (recap from the audit — see chat history for full detail)
- ~~Rate limiting is narrower than it looks~~ — **fixed**: `order-create`,
  `order-track`, and `public-catalog` all have `ScopedRateThrottle` rates
  set (see config/settings.py `DEFAULT_THROTTLE_RATES`). The rates
  themselves are still rough/unvalidated guesses, not tuned against real
  traffic — that's the one genuine caveat left, see the rate-limits bullet
  further down this file.
- ~~`SECRET_KEY` has an insecure dev fallback with no startup check~~ —
  **fixed**: config/settings.py raises `ImproperlyConfigured` at startup
  if `DEBUG=False` and the key is still the dev default.
- ~~No production security headers~~ — **fixed** in code (HSTS, SSL
  redirect, nosniff, secure cookies, all conditional on `DEBUG`). Only
  caveat: exercised via `DEBUG=False` unit checks, not a real HTTPS
  deployment yet.
- **CSRF protection on the cookie-JWT auth class** — now has real test
  coverage (`CsrfCookieAttributeTests`): confirms the auth cookies are
  issued with `HttpOnly` + `SameSite=Lax`, which is what actually
  prevents CSRF here. Important limitation, not a gap: SameSite
  enforcement happens in the *browser*, not the server, so no unit test
  can simulate an actual cross-origin request being blocked — that would
  need a real browser-based test (Playwright) or manual verification.
- ~~No MFA on admin accounts~~ — **built**: opt-in TOTP two-factor
  (Admin Settings → Security). An admin scans a QR code with any
  authenticator app, confirms one code to enable, and gets 8 single-use
  recovery codes shown exactly once. Login becomes two-step only for
  admins who've turned it on — password first, then a short-lived
  pending token that a correct TOTP/recovery code exchanges for the real
  session. Disabling 2FA requires both the account password AND a valid
  code, so a stolen logged-in session alone can't turn it off. 17 tests
  covering setup, confirm, login, lockout after repeated wrong codes,
  disable, and recovery-code regeneration.
- ~~reCAPTCHA is scaffolded but not wired up~~ — **already wired**
  (`verify_recaptcha()` is called on signup); it no-ops (passes) until
  `RECAPTCHA_SECRET_KEY` is set in `.env`. Getting real Google reCAPTCHA
  keys is on the user, same as the SMTP/payment-gateway credentials above
  — not a code gap.
- ~~CNIC images in vendor applications aren't validated~~ — **fixed**:
  `validate_cnic_image()` (apps/accounts/models.py) now checks file type
  (PNG/JPEG), a 5MB size cap, and a legibility-driven minimum dimension,
  mirroring the existing banner-image validator.

## Feature gaps flagged during the marketplace-UX survey
- No vendor storefront page (click a vendor name → see everything they sell).
- No wishlist / save-for-later.
- No search autocomplete.
- ~~Shop lost its rating filter when the mock catalog was ripped out~~ —
  **fixed**: `min_rating` filter + `sort=rating` re-added to the catalog
  endpoint (DB-level annotation matching `Product.average_rating` exactly),
  plus a "Minimum Rating" filter and "Highest Rated" sort in the Shop UI.
  Caught a real bug along the way: the `Avg()` annotation was silently
  defeating the model's default ordering — the exact thing Django's
  `UnorderedObjectListWarning` flags — fixed by making it explicit.
- ~~Rating stars missing from Home/Shop product cards~~ — **fixed**: added
  using the same data ProductDetail already displayed.
- Multi-vendor cart/checkout doesn't show a per-vendor cost breakdown.
- No customer-initiated order cancellation (only admin can change status).
- ~~No 404 page, no robots.txt/sitemap/meta tags, no favicon~~ — **partially
  stale**: 404 page, favicon, and robots.txt all already exist. Sitemap
  and meta tags genuinely still don't.
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
~~Not started — the one deliberately-postponed piece of Phase 7.~~ **This
was stale — already fully built**: `apps/products/consumers.py`,
`routing.py`, `config/asgi.py`, Django Channels + Redis channel layer,
with `InventoryWebSocketTests` passing.

## Quick follow-ups (no external config needed — cheap, do anytime)
- ~~Add rating stars + count to Shop/Home product cards~~ — **done, see above**.
- ~~Re-add Shop's rating filter/sort~~ — **done, see above**.

## Phase 8 additions (this session)
- ~~**Admin coupons UI**~~ — **built**: `Coupons.jsx` (list, create, edit,
  delete, active/expired/inactive status). Backend CRUD was already real
  and tested.
- **Accessibility pass was a spot-fix, not an audit** — only the highest-
  traffic pages got aria-labels (global header search, Shop view toggle,
  ProductDetail carousel/stepper). Admin panel, vendor panel, and the
  checkout flow's icon-only buttons haven't been reviewed. A real
  accessibility audit (screen reader pass, keyboard nav, color contrast,
  skip-to-content link) is still outstanding.
- ~~**CheckoutConfirmation/OrderSummarySidebar don't display coupon
  discounts**~~ — **fixed**: `CheckoutConfirmation.jsx` and `TrackOrder.jsx`
  now show the real subtotal/coupon-discount/shipping breakdown from the
  actual order data (the coupon-code input itself, and the backend
  validation, were already real and working — this was purely a display
  gap on two pages).
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
