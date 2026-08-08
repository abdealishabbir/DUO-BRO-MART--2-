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
  - ~~"Order delivered — leave feedback" email (the actual link-in-email flow
    for `/order-feedback/:orderCode` doesn't exist yet — customers only
    reach that page via Account → Orders right now)~~ — **the deeper bug is
    fixed**: `/order-feedback/:orderCode` was never actually SMTP-blocked —
    the page itself was public, but the API behind it
    (`/feedback/`, `/feedback/eligible-orders/`, `/complaints/`) was
    `IsAuthenticated`-only and scoped to `request.user`, so a **guest COD
    customer — most of this platform's orders — could never reach this
    flow at all**, link or no link. Now verified by order_code + the
    email/phone used at checkout (same pattern as `TrackOrderView`/
    `OrderCancelView`), with a "Verify Your Order" gate shown only to
    non-logged-in visitors. `Feedback.customer`/`Complaint.customer` are
    now nullable to support this, mirroring `Order.customer`. What's
    *still* genuinely SMTP-blocked: nothing yet automatically emails the
    customer that link after delivery — they'd need to know their own
    order code and visit `/order-feedback/DBM-XXXX-XXXX` directly (or use
    Account → Orders if logged in) until that email trigger exists.
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
- ~~No vendor storefront page~~ — **built**: public `/store/:vendorId` page
  (shop name/logo/description, aggregate rating, product count, "selling
  since" year, full paginated + sortable product grid). Vendor Settings
  gets a real "Storefront Profile" editor (logo upload, name, about text).
  `shop_name`/`shop_logo`/`shop_description` added to `User` — no separate
  profile table, matching how `phone_number` etc. already work there.
- ~~No wishlist / save-for-later~~ — **built**: heart-icon toggle on every
  product card site-wide (Home's 3 sections, Shop, Product Detail),
  backed by a real `Wishlist` model, not localStorage — ties to the
  account so it's the same list on any device. Dedicated `/wishlist` page
  + header nav badge.
- ~~No search autocomplete~~ — **built**: the header search box was
  actually just a static, non-functional `<input>` before this — no
  onChange, no submit, nothing. Now a real debounced dropdown (product
  thumbnails + price, matching categories, recent searches via
  localStorage), full keyboard nav, and Shop.jsx now actually reads/writes
  the `?search=` URL param it was silently ignoring.
- ~~Shop lost its rating filter when the mock catalog was ripped out~~ —
  **fixed**: `min_rating` filter + `sort=rating` re-added to the catalog
  endpoint (DB-level annotation matching `Product.average_rating` exactly),
  plus a "Minimum Rating" filter and "Highest Rated" sort in the Shop UI.
  Caught a real bug along the way: the `Avg()` annotation was silently
  defeating the model's default ordering — the exact thing Django's
  `UnorderedObjectListWarning` flags — fixed by making it explicit.
- ~~Rating stars missing from Home/Shop product cards~~ — **fixed**: added
  using the same data ProductDetail already displayed.
- ~~Multi-vendor cart/checkout doesn't show a per-vendor cost breakdown~~ —
  **turned out to already be built**: `OrderSummarySidebar.jsx` +
  `groupLinesByVendor()` already handle this across Cart, CheckoutShipping,
  CheckoutPayment, and CheckoutConfirmation. This bullet was stale.
- ~~No customer-initiated order cancellation~~ — **built**, with a
  deliberate scope call rather than a silent assumption: self-service
  cancel only works while the order is still `pending` (matches real
  COD/courier practice — once a vendor starts processing/packing, a
  simple status flip can't undo real-world dispatch). Past that point,
  it's an admin/support action instead. Restocks every item and reverses
  coupon usage. Works for both guests (order code + email/phone, same
  verification `TrackOrder` already used) and logged-in customers
  (one-click from Account → Orders, no re-entering contact info). 10 new
  tests covering both ownership paths, restocking, coupon reversal, and
  the pending-only boundary.
- ~~No sitemap.xml or per-page meta tags~~ — **both already existed or now
  fixed**: `sitemap.xml` and `robots.txt` were already registered and
  working (bullet was stale on that half). Per-page `Meta`
  (react-helmet-async) was already on Home/Shop/ProductDetail/
  VendorStorefront/Cart/Checkout/Wishlist; added it to the three remaining
  public pages this session (Terms, VendorTerms, BecomeVendor). Auth/
  account pages deliberately skipped — not SEO targets.
- ~~Checkout isn't idempotent — a slow network + retry could theoretically
  create two real orders~~ — **fixed**: `Order.idempotency_key`, generated
  once per checkout attempt on the frontend (`crypto.randomUUID()`, reused
  across retries of that same attempt, cleared only after success). A
  retry with the same key returns the original order (200) instead of
  creating a duplicate (201). Race-safe: two near-simultaneous requests
  with the same key are serialized by the existing `select_for_update()`
  stock lock, and the loser's stock decrement rolls back cleanly via the
  DB's unique constraint + the transaction that was already wrapping
  order creation. 5 new tests, including a genuine double-submit
  simulation and the multi-NULL-key edge case.
- ~~No admin audit log~~ — **built**, scope flagged rather than assumed:
  logs approve/reject decisions (products, price/deal change requests,
  stock-increase requests, vendor applications, banner applications),
  vendor suspend/reinstate, order status changes (only when the status
  actually changes — a courier-name-only edit doesn't spam an entry),
  and payout mark-paid. Deliberately NOT logged: routine CRUD (editing a
  coupon, tweaking settings) — those are normal admin work, not a
  decision worth auditing. New `AdminAuditLog` page + nav link, filterable
  by action/target type. 10 new unit tests + 2 cross-app integration
  tests (confirming the hooks are actually wired, not just unit-tested
  in isolation). Caught a real bug during this build: forgot to import
  the logging helper in `apps/orders/views.py`, causing a `NameError` on
  every payout mark-paid call — only caught because I ran the actual
  test suite rather than trusting the compile check.

## Feedback page
- ~~Photo upload on the feedback form is UI-only~~ — **built**: real
  `FeedbackImage` model, up to 5 photos, validated (format/size/min
  dimensions), whole submission rolls back atomically if any photo fails
  validation. Dropzone now actually uploads — drag/drop or click, thumbnail
  previews, remove button.
- No loyalty points / rewards system exists. (Checked: there's no "Earn
  points" copy anywhere in the actual frontend or PRD either — that was
  a reference-mockup idea that never made it into this build. Nothing to
  clean up; would be a genuine net-new feature if ever wanted.)

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
- ~~Accessibility pass was a spot-fix, not an audit~~ — **audited**: no
  keyboard-inaccessible clickable `<div>`s, no missing `alt` text, and
  every icon-only table row action already had `aria-label`s. 6 real
  gaps found and fixed: icon-only search-submit buttons (admin
  Orders/Products), icon-only refresh buttons (Analytics pages), and —
  the most important one — two upload/remove buttons that were only
  *visible* on mouse hover with no `focus`/`focus-visible` fallback,
  making them genuinely undiscoverable for keyboard-only users
  (OrderFeedback photo-remove, vendor Settings shop-logo upload).
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
- ~~Payout schedule is platform-wide, not per-vendor~~ — **built**:
  `payout_hold_days_override`/`payout_cycle_days_override` nullable fields
  on `User` (null = use the platform default, same pattern as
  `shop_name`/`shop_logo`). Admin Vendors page gets click-to-edit Hold/
  Cycle columns showing "(default)" vs "(override)" with a one-click
  reset. 12 new tests confirming isolation (one vendor's override doesn't
  touch another's eligibility).
- ~~No payout failure/retry handling~~ — **built**: a Paid batch can be
  reopened as `FAILED` (with a required reason, logged to the audit
  trail), then retried via the same `mark_paid` action with a corrected
  reference — same batch, same `PayoutItem`s, no risk of double-paying.
  Vendors see the failure reason on their own Payouts page/CSV, read-only.
- **Traffic-source detection is referrer-based only** — no UTM parameter
  capture, no campaign tracking, no session/cookie-level attribution. It's
  a coarse direct/search/social/other bucket, good enough for a directional
  read, not for real marketing attribution.
- **Conversion rate is a simple ratio** (orders in range ÷ views in range),
  not a true session-to-purchase funnel — a customer who views on Monday
  and buys Thursday still counts, and there's no per-session linkage.
- **No returning-vs-new-visitor split, no geographic breakdown** — nothing
  captures visitor identity or location at all (deliberately — kept PII-free).
- ~~Analytics/Payouts admin views have no CSV export and the date range is
  fixed to 7/30/90-day tabs, no custom picker~~ — **built**: Vendor
  Analytics turned out to already have both (found while auditing this
  item — the bullet was stale for that page). The real gap was that
  there was no platform-wide Admin Analytics page at all, only a fixed
  month-over-month Dashboard — built a new Admin Analytics page mirroring
  the vendor one (custom date range, CSV export, top products, top
  vendors, platform commission). Also fixed a real bug found while
  auditing: Vendor Analytics' CSV export crashed with `NameError:
  timedelta` on the default/preset-range path (only the custom-range path
  had imported it) — had zero test coverage before, which is exactly how
  it shipped unnoticed.
