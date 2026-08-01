# DUO BRO MART — Research & Development (R&D) + Product Requirements Document (PRD)

| Field | Detail |
|---|---|
| **Project Name** | Duo Bro Mart — Multi-Vendor E-Commerce Platform |
| **Document Type** | Combined R&D Report + PRD (Workflow / Phase-wise Format) |
| **Version** | 1.0 |
| **Date** | July 14, 2026 |
| **Target Market** | Pakistan (Primary), PKR Currency |
| **Frontend** | React.js |
| **Backend** | Python (Django + Django REST Framework) |
| **Database** | PostgreSQL |
| **Reference Platforms** | Daraz, Amazon, Alibaba, Temu, eBay, Shopify |

---

# TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [R&D — Market Research & Competitor Analysis](#2-rd--market-research--competitor-analysis)
3. [System Overview — The Three Channels](#3-system-overview--the-three-channels)
4. [Authentication & Security Architecture](#4-authentication--security-architecture)
5. [PRD — Customer Channel (Detailed)](#5-prd--customer-channel-detailed)
6. [PRD — Vendor Channel (Detailed)](#6-prd--vendor-channel-detailed)
7. [PRD — Admin Panel (Detailed)](#7-prd--admin-panel-detailed)
8. [Real-Time Inventory Synchronization](#8-real-time-inventory-synchronization)
9. [Post-Delivery Feedback & Complaint System](#9-post-delivery-feedback--complaint-system)
10. [Technical Architecture & Database Design](#10-technical-architecture--database-design)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Monetization Strategies (Revenue Model)](#12-monetization-strategies-revenue-model)
13. [Traffic & Growth Strategies (Marketing)](#13-traffic--growth-strategies-marketing)
14. [Development Workflow — Phase-Wise Roadmap](#14-development-workflow--phase-wise-roadmap)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Success Metrics (KPIs)](#16-success-metrics-kpis)
17. [Glossary](#17-glossary)

---

# 1. EXECUTIVE SUMMARY

**Duo Bro Mart** is a multi-vendor e-commerce marketplace built for the Pakistani market. It operates on a **three-channel model**:

1. **Customers** — browse, filter, purchase products securely, track orders, and give post-delivery feedback.
2. **Vendors** — local businesses that apply to sell, manage their own products, request pricing/discount changes, and purchase promotional banner slots.
3. **Admin** — the platform owner with the highest authority: approves vendors and products, manages banners, orders, pricing, shipping/payment gateways, and platform-wide settings.

The platform follows the **marketplace-with-approval model** (like Daraz and Amazon Seller Central): vendors cannot publish anything to customers without admin approval. Revenue is generated primarily via **commission on every sale** (vendor price + platform commission = listed price), plus **banner advertising fees**, and later, shipping margin and value-added services.

The core differentiators for the Pakistani context:
- **Cash on Delivery (COD)** as a first-class payment method (dominant in Pakistan, ~85%+ of e-commerce orders).
- **Local wallets** — NayaPay, Easypaisa, JazzCash — alongside card payments.
- **Rural delivery handling** — customers in areas without courier coverage can nominate a *nearest landmark / nearest courier branch* for pickup.
- **PKR-native pricing, city/province dropdowns for Pakistan**, and distance-based shipping calculation beyond 500 km.

---

# 2. R&D — MARKET RESEARCH & COMPETITOR ANALYSIS

## 2.1 Why This Research Matters

Before writing a single line of code, we need to understand **what already works** in marketplaces at scale, and what fails. Every feature in Duo Bro Mart maps to a proven pattern from one of the six reference platforms below.

## 2.2 Competitor Deep-Dive

### 2.2.1 Daraz (Pakistan / South Asia — closest competitor)

| Aspect | What Daraz Does | Lesson for Duo Bro Mart |
|---|---|---|
| **Business model** | Multi-vendor marketplace; commission per category (5–15%) + payment handling fee | Adopt category-based commission; keep it transparent to vendors |
| **Seller onboarding** | Free signup → CNIC/NTN verification → bank details → training (Daraz University) | Our vendor application (CNIC images, business details) mirrors this; add a simple vendor help/FAQ section |
| **COD** | Core payment method; COD fee applies | COD must be default-on and reliable; consider small COD handling fee later |
| **Flash sales** | "Mega deals," 11.11, 12.12 campaigns with countdown timers | Our Flash Deals section with stock-scarcity messaging ("only X left") copies this psychology |
| **Delivery** | Daraz Express (DEX) + 3rd-party couriers; delivery estimates shown at checkout | We use 3rd-party couriers (TCS, Leopards, M&P, PostEx, Trax) with 3 speed tiers |
| **Ratings** | Post-delivery review prompts via app/email; seller ratings affect visibility | Our email-triggered feedback flow after delivery confirmation is the same pattern |
| **Weakness to exploit** | Poor seller support, high commission complaints, counterfeit issues | Faster vendor approval (4–5 days promised), human review of products, responsive support |

### 2.2.2 Amazon (Global gold standard)

| Aspect | What Amazon Does | Lesson for Duo Bro Mart |
|---|---|---|
| **Buy Box / instant purchase** | "Buy Now" bypasses cart, one-click checkout | Our "Buy Now" button goes straight to checkout — exactly this |
| **Product discovery** | Featured (best sellers), New Releases, Deals of the Day | Home page sections: Flash Deals, Featured (top-selling), New Arrivals |
| **Search & filters** | Category + price range + brand + rating (4★ & up) filters | Shop page filter panel: category, min–max price, brand, 5→1 star rating |
| **Pagination** | Results split into pages (~16–48 per page) | Shop page: max 20 products per page with pagination |
| **Trust badges** | A-to-Z Guarantee, easy returns, secure payment icons | Home page "attributes" strip: fast delivery, secure payments, 24/7 support, returns |
| **Order tracking** | Order ID → live status timeline | Order confirmation generates a tracking-capable Order ID |
| **Review system** | Verified Purchase reviews, star breakdown by dimension | Feedback form rates: product quality, packaging, service, overall |

### 2.2.3 Alibaba (B2B / vendor-centric)

| Aspect | What Alibaba Does | Lesson for Duo Bro Mart |
|---|---|---|
| **Supplier verification** | Gold Supplier / Verified Supplier paid tiers, on-site checks | Our admin manually verifies CNIC + business details before approving vendors |
| **Vendor storefronts** | Each supplier gets a mini-shop with their brand | Every approved vendor's **brand name automatically becomes a filter option** in the shop — this is our version of vendor identity |
| **Negotiated pricing** | Price changes and quotes flow through the platform | Our Pricing section: vendors *request* price/discount changes → admin approves → site updates |
| **Terms separation** | Different agreements for buyers vs suppliers | We maintain **separate Terms & Conditions for customers and vendors** |

### 2.2.4 Temu (Aggressive growth playbook)

| Aspect | What Temu Does | Lesson for Duo Bro Mart |
|---|---|---|
| **Gamified urgency** | Countdown timers, "almost sold out," spinning-wheel discounts | Flash Deals section uses discount % + low-stock urgency |
| **Referral virality** | Massive referral credits ("invite friends, get items free") | Affiliate/referral program (footer link) — phase 3 growth lever |
| **Ultra-low first-order pricing** | Loss-leader first purchase to acquire users | New-customer coupon strategy (see Monetization §12.6) |
| **Free shipping threshold** | Free shipping above a cart value | Our free-shipping threshold (e.g., PKR 5,000) set in admin Settings |

### 2.2.5 eBay (Marketplace mechanics)

| Aspect | What eBay Does | Lesson for Duo Bro Mart |
|---|---|---|
| **Seller performance metrics** | Defect rate, late shipment rate → seller level → visibility | Active Vendors table tracks total sales + rating; repeated complaints → admin **Suspend** action |
| **Dispute resolution** | Structured "item not as described" flows with reason codes | Our wrong-product complaint flow with fixed reason options (wrong color, wrong brand, missing part, damaged, wrong size) is exactly this |
| **Promoted listings** | Sellers pay for placement | Our paid hero/promo banner system is the equivalent |

### 2.2.6 Shopify (Platform & checkout excellence)

| Aspect | What Shopify Does | Lesson for Duo Bro Mart |
|---|---|---|
| **Checkout flow** | Cart → Information → Shipping → Payment, with persistent order summary sidebar | Our 4-level checkout (Cart → Shipping → Payment → Confirmation) with order-summary "virtual bill" on every step is the Shopify pattern |
| **Saved payment (Shop Pay)** | Tokenized card saving for one-tap repeat checkout | "Remember card for future purchases" option — must be done via **gateway tokenization, never raw card storage** |
| **Abandoned cart recovery** | Automated email sequences recover 5–15% of abandoned carts | Phase 3 marketing feature; requires cart persistence per logged-in user |
| **Admin settings** | Store name, currency, shipping zones/rates, payment provider toggles, notification prefs | Our admin Settings section is modeled on Shopify's settings area |

## 2.3 Pakistan E-Commerce Market Context (R&D Findings)

- **Payment reality:** COD dominates (estimates 80–90% of orders). Card penetration is low; mobile wallets (Easypaisa ~50M+ users, JazzCash ~44M+ users, NayaPay growing) are the practical digital option. → *All three payment modes are mandatory; admin must be able to toggle gateways off during bank outages (a real, recurring event in Pakistan).*
- **Logistics reality:** Major couriers (TCS, Leopards, M&P, Trax, PostEx, BlueEx) cover cities well but **rural coverage is weak**. → *The "nearest landmark / courier branch pickup" flow for rural customers is a genuine competitive differentiator; Daraz handles this poorly.*
- **Trust deficit:** Pakistani consumers fear fake products and prepayment fraud. → *Admin approval of every product, visible return policy, COD option, and post-delivery verification emails directly address this.*
- **Mobile-first:** 80%+ of traffic will be mobile. → *React frontend must be fully responsive; mobile UX is the primary design target.*
- **Seasonal spikes:** Ramadan/Eid, 11.11, 12.12, wedding season drive massive traffic. → *Banner/flash-deal system must support campaign scheduling.*

## 2.4 Feature Gap Matrix (What We Adopt From Whom)

| Feature | Daraz | Amazon | Alibaba | Temu | eBay | Shopify | Duo Bro Mart |
|---|---|---|---|---|---|---|---|
| Multi-vendor + commission | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Admin product approval | ✅ | Partial | ✅ | ✅ | ❌ | ❌ | ✅ (strict) |
| COD | ✅ | Partial | ❌ | ❌ | ❌ | Plugin | ✅ (core) |
| Local wallets (Easypaisa/JazzCash/NayaPay) | ✅ | ❌ | ❌ | ❌ | ❌ | Plugin | ✅ (core) |
| Rural landmark delivery | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ **(unique)** |
| Paid banner slots for vendors | ✅ | ✅ (ads) | ✅ | ❌ | ✅ | ❌ | ✅ |
| Vendor price-change approval | ❌ | ❌ | Partial | ✅ | ❌ | ❌ | ✅ (strict) |
| Wrong-product complaint reasons | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Free shipping threshold | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |

---

# 3. SYSTEM OVERVIEW — THE THREE CHANNELS

## 3.1 Role Hierarchy & Authority

```
                    ┌─────────────────────┐
                    │        ADMIN        │  ← Highest priority / full control
                    │  (Platform Owner)   │
                    └──────────┬──────────┘
                               │ approves, moderates, configures
              ┌────────────────┴────────────────┐
              │                                 │
    ┌─────────▼─────────┐             ┌─────────▼─────────┐
    │      VENDOR       │             │     CUSTOMER      │
    │ (Approved Seller) │──products──▶│      (Buyer)      │
    └───────────────────┘  (only after└───────────────────┘
                            admin approval)
```

### Admin (highest authority)
- Add / edit / **delete any product** (deletion cascades to vendor panel and customer storefront in real time).
- View all customer details and orders.
- View all vendor details and their products.
- Approve/reject vendor applications, product listings, price changes, discounts, and banner requests.
- Publish and schedule hero/promo banners.
- Configure shipping rates and toggle payment gateways per situation (e.g., bank server outage → disable cards/wallets, keep COD).

### Customer
- Buys products with strong guarantees on **data security** — no leaking or misplacement of personal data (see §4.4 and §11).
- Sign up via email, Google, or Facebook; persistent credentials; password recovery.
- Browse, filter, cart, checkout, track orders, give feedback.

### Vendor
- Applies via the "Become a Vendor" page; approved by admin in 4–5 business days.
- Adds products with price, details, stock, category, brand → **admin approval required before going live**.
- Requests discounts/deals and price changes → admin approval required.
- Buys banner advertising slots (daily/weekly pricing).

## 3.2 Page/Screen Inventory (Master List)

| # | Page | Channel | URL Pattern (proposed) |
|---|---|---|---|
| 1 | Customer Login / Signup | Customer | `/login`, `/signup` (default landing auth) |
| 2 | Forgot Password | Customer | `/forgot-password` |
| 3 | Home | Customer | `/` |
| 4 | Shop (listing + filters + pagination) | Customer | `/shop` |
| 5 | Product Detail | Customer | `/product/:slug` |
| 6 | Cart (Level 1) | Customer | `/cart` |
| 7 | Checkout — Shipping (Level 2) | Customer | `/checkout/shipping` |
| 8 | Checkout — Payment (Level 3) | Customer | `/checkout/payment` |
| 9 | Order Confirmation (Level 4) | Customer | `/checkout/confirmation` |
| 10 | Order Tracking | Customer | `/track-order` |
| 11 | Terms & Conditions (Customer) | Customer | `/terms` |
| 12 | Terms & Conditions (Vendor) | Vendor/Public | `/vendor-terms` |
| 13 | Account / Profile | Customer | `/account` |
| 14 | Become a Vendor (info + application + FAQ) | Public | `/become-a-vendor` |
| 15 | Feedback / Complaint Form | Customer | `/feedback/:orderId` |
| 16 | Vendor Login | Vendor | `/vendor/login` (hidden, separate URL) |
| 17 | Vendor Panel | Vendor | `/vendor/*` |
| 18 | Admin Login | Admin | `/admin/login` (hidden, separate URL) |
| 19 | Admin Panel (7 sections) | Admin | `/admin/*` |

> **Routing rule:** `duobromart.com` always lands normal visitors on the **customer** experience. Vendor and admin login pages exist on separate, unadvertised URLs and are never linked from customer-facing navigation (except "Become a Vendor" → which links vendor login only for *approved* vendors).

---

# 4. AUTHENTICATION & SECURITY ARCHITECTURE

## 4.1 Three Separate Auth Portals

| Portal | URL | Who | Signup? | Redirect After Login |
|---|---|---|---|---|
| Customer | `/login`, `/signup` | Public shoppers | Yes — email, Google, Facebook | **Shop page** |
| Vendor | `/vendor/login` | Approved vendors only | No — credentials issued by admin after approval | **Vendor Panel** |
| Admin | `/admin/login` | Site owner/staff | No — provisioned manually | **Admin Panel** |

## 4.2 Customer Signup & Login (Functional Requirements)

**Signup form fields:**
1. Full Name (required)
2. Phone Number (required, Pakistani format validation `+92 / 03XX-XXXXXXX`)
3. Email Address (required, unique, verified via confirmation email)
4. Password (min 8 chars, at least 1 uppercase, 1 number — strength meter shown)
5. Confirm Password (must match)
6. ☑ "I agree to the Terms & Conditions and Privacy Policy" (required checkbox, links to `/terms`)

**Social signup:** Google OAuth 2.0 and Facebook Login. On first social login, an account record is created and the user may be asked to add a phone number to complete their profile.

**Login form:** Email + Password, "Keep me logged in" checkbox (extends refresh-token life to 30 days vs. session-only), "Sign in with Google" button, "Forgot password?" link, and "Don't have an account? Create one" link.

**Forgot password flow:**
1. User enters email → system sends a time-limited (30 min), single-use reset link.
2. Link opens a reset form → new password + confirm → all existing sessions invalidated.
3. Generic success message shown regardless of whether email exists (prevents account enumeration).

## 4.3 Vendor & Admin Auth

- **Vendor:** After admin approves the application, the system generates a temporary password and emails vendor credentials. Vendor **must change password on first login** and can change it any time in their panel settings.
- **Admin:** Superuser created via Django management command; strongly recommend enabling **TOTP two-factor authentication** for admin accounts. Admin login page is rate-limited and IP-loggable.

## 4.4 Customer Data Protection (explicit requirement: no leaking/misplacing data)

1. **Passwords:** Argon2/PBKDF2 hashing (Django default) — never stored in plaintext.
2. **Card data:** **Never stored on our servers.** "Remember my card" uses **gateway tokenization** (the payment gateway stores the card, we store only a token). This keeps us out of full PCI-DSS scope.
3. **Transport:** HTTPS/TLS everywhere; HSTS enabled; secure, HttpOnly, SameSite cookies.
4. **Access control:** Role-based access control (RBAC) enforced at the API layer — a vendor can only ever read/write their own products/orders; customers only their own data.
5. **PII minimization:** Only collect what checkout needs. CNIC images (vendors only) stored in private object storage with signed, expiring URLs — never publicly accessible.
6. **Auditing:** Admin actions (delete product, suspend vendor, change settings) are written to an immutable audit log.
7. **Backups:** Automated encrypted PostgreSQL backups (daily) with tested restore procedure — protection against data *misplacement/loss*.
8. **Rate limiting & lockout:** Login endpoints throttled; temporary lockout after repeated failures; CAPTCHA on signup to block bots.

---

# 5. PRD — CUSTOMER CHANNEL (DETAILED)

## 5.1 Global Navigation (Navbar)

Present on Home, Shop, Terms, and content pages (consistent everywhere):

| Item | Behavior |
|---|---|
| **Home** | → `/` |
| **Shop** | → `/shop` |
| **Deals** (on Shop page navbar) | → shop pre-filtered to discounted products only |
| **Terms & Conditions** | → `/terms` |
| **Become a Vendor** | → `/become-a-vendor` |
| **Profile / Account** | Logged in → `/account`; logged out → redirected to `/signup` |
| **Cart icon** (with live item-count badge) | → `/cart`; visible on home page and all shop pages |

## 5.2 Home Page (`/`) — Section by Section

### 5.2.1 Hero Banner Carousel
- **5 hero banner slots** (admin-published, vendor-paid — see §7.4).
- Auto-advances every **5 seconds** (sleep timer), loops infinitely; manual arrows + dot indicators; pauses on hover.
- Each banner: image, title, subtitle, and a **CTA link** that deep-links to a brand's category page or a specific product page.

### 5.2.2 Promo Banners
- **3 promo banner slots** positioned **Left / Center / Right** below (or beside) the hero, also vendor-paid and admin-managed.

### 5.2.3 Flash Deals
- Products that are **discounted AND running low on stock** — urgency-driven ("Hurry, only 3 left!", countdown timer optional).
- Card shows: image, name, original price struck through, discounted price, discount % badge, stock-left indicator, **Add to Cart** + **Buy Now**.
- Purpose (per Temu/Daraz psychology): scarcity + discount → instant purchase.

### 5.2.4 Featured Products
- **Top-selling products** of the platform (computed from order data, refreshed daily or curated by admin).

### 5.2.5 New Arrivals
- **Most recently approved/added products**, newest first. Vendor products land here automatically after admin approval.

### 5.2.6 Product Card Standard (used across all sections)
Every product card everywhere must offer **both**:
- **Add to Cart** → adds item to cart (badge count updates), user stays where they are (toast confirmation).
- **Buy Now** → item goes straight to **checkout** (cart Level 1 skipped / single-item express flow).

### 5.2.7 Featured / All Categories Grid
- Clickable category tiles (e.g., Electronics, Fashion, Home & Kitchen, Beauty, Sports, Groceries, Toys, Automotive…).
- One click → `/shop?category=X` — the customer lands directly on that category's products **without any interruption** (no intermediate pages, no popups).

### 5.2.8 Trust Attributes Strip
Icon row communicating platform values:
- 🚚 Fast Delivery • 🔒 Secure Payments • 🕐 24/7 Availability & Reliability • ↩ Return Policy • 🎧 Customer Support

### 5.2.9 Footer (identical across all customer pages)
Links & info:
- Contact email, Terms & Conditions (Customer), **Vendor Terms & Conditions (separate document)**, Discount Deals, New Arrivals, Gift Coupons / Gift Cards, Refunds & Returns, **Track Order**, **Become a Vendor** (if the visitor already has a vendor account → direct link to Vendor Dashboard login), **Affiliate Program**, social media links, copyright.

## 5.3 Shop Page (`/shop`)

### 5.3.1 Shop Navbar
Home • Shop • **Deals** (only currently discounted/deal products) • Cart • Account (logged-in → profile with signup info; logged-out → signup page).

### 5.3.2 Top Strips
- **Trending This Week** — most viewed/purchased in last 7 days.
- **Best Deals** — highest discounts; supports promo mechanics such as *gift-card-eligible* items and **Buy One Get One (BOGO / "one on one free")** offers, each with a clear badge.

### 5.3.3 Filter Panel
| Filter | Control | Behavior |
|---|---|---|
| **Category** | Checkbox list / tree | Same category taxonomy as home page grid |
| **Price Range** | Min–Max inputs + slider (PKR) | Inclusive range |
| **Brand** | Checkbox list with search | **Every approved vendor's brand automatically appears here** (§6.4) |
| **Rating** | 5★ → 1★ ("4★ & up" style) | From aggregated customer feedback |

Filters combine (AND logic); active filters shown as removable chips; "Clear all" resets.

### 5.3.4 Product Grid & Pagination
- Default (no filter/category): **all products sorted A→Z** by name.
- **Max 20 products per page**; numbered pagination (carousel-style page controls: ← 1 2 3 … →); page state reflected in URL (`?page=3`) so links are shareable and back-button works.
- Sort dropdown (phase 2 nice-to-have): A–Z, price low→high, price high→low, newest, best rated.

### 5.3.5 Product Detail Page
Image gallery, name, brand, category, price (+discount if any), stock status (live), quantity selector, **Add to Cart**, **Buy Now**, description, specifications, vendor/brand name, ratings & review list, related products.

## 5.4 Cart & Checkout — The 4-Level Flow

A persistent **Order Summary ("virtual bill")** panel appears on every level:

```
Order Summary
─────────────────────────
Subtotal (items × qty)     PKR  X,XXX
Discount                  –PKR    XXX
Shipping / Delivery        PKR    XXX
Tax (if applicable)        PKR    XXX
─────────────────────────
TOTAL                      PKR  X,XXX
```

### Level 1 — Cart (`/cart`)
- Line items: product image, name, unit price, **quantity stepper (+/–)**, line total = `unit price × qty`, remove (🗑).
- **Discounts applied per line** (struck-through original price) and reflected in summary.
- Order Summary as above.
- Buttons: **Proceed to Checkout** → Level 2 • **Continue Shopping** → Home page.
- Footer at bottom.
- Cart persists per logged-in user (DB-backed) and for guests (localStorage, merged on login).

### Level 2 — Shipping (`/checkout/shipping`)
**All fields mandatory:**

| Field | Control | Validation |
|---|---|---|
| Full Name | text | required |
| Contact No. | text | required, PK phone format |
| Email Address | email | required, valid format |
| Delivery Address | multiline text | required — street no., building, flat no., floor |
| Province | **dropdown** (Punjab, Sindh, KPK, Balochistan, Gilgit-Baltistan, AJK, Islamabad Capital Territory) | required |
| City | **dropdown** (filtered by province) | required |
| Area type | City / **Rural** toggle | required |
| **Nearest Landmark** (rural only) | text | required if Rural — e.g., "rural area near Lahore, nearest landmark: Main Bazaar Kot Radha Kishan" |

> **Rural delivery rule:** Where door-to-door delivery isn't possible (no advanced courier coverage), the customer writes their **nearest landmark**; the courier delivers to its **nearest branch**, and the customer collects from there. The confirmation email/page must clearly state "Collect from nearest courier branch: …".

**Delivery Method (radio selection, priced):**

| Method | Time | Cost tier |
|---|---|---|
| **Standard Delivery** | 5–7 business days | Economical (default, e.g., PKR 250 base) |
| **Express Delivery** | 3–4 business days | Moderate (higher than standard) |
| **Urgent Delivery** | 24–48 hours | Highest |

Selecting a method live-updates the shipping line in the Order Summary.

- Buttons: **Back to Cart** • **Continue to Payment** → Level 3.
- Order Summary (same product details + virtual bill) shown on this level; footer at bottom.

### Level 3 — Payment (`/checkout/payment`)
Three payment options (each can be **toggled on/off by admin** — §7.8):

1. **Credit / Debit Card** — fields: card number, expiry date, CVV, cardholder name. Optional ☑ **"Save this card for future purchases"** → stored as **gateway token only** (§4.4). 3-D Secure where supported.
2. **Online Wallets** — NayaPay, Easypaisa, JazzCash (select wallet → gateway redirect/OTP flow).
3. **Cash on Delivery (COD)** — pay courier on receipt.

**Billing Address:** ☑ *Same as shipping address* (default) OR customize with a separate billing form.

- Buttons: **Back to Shipping** • **Place Order**.
- Order Summary + footer, as before.

**On Place Order:** payment authorized (or COD order accepted) → order record created atomically → **stock decremented** (§8) → confirmation email queued → redirect to Level 4.

### Level 4 — Order Confirmation (`/checkout/confirmation`)
- ✅ "Thank you, **{Customer Name}**! Your order is confirmed." (gratitude message with customer's name).
- **Order ID generated** (human-friendly, e.g., `DBM-2026-000123`) — used for tracking.
- **Estimated delivery date/window** computed from the delivery method chosen at Level 2 (e.g., Urgent → "expected within 24–48 hours").
- Full Order Summary repeated (items + virtual bill).
- Buttons: **Track Order** (→ `/track-order` prefilled with the Order ID) • **Continue Shopping** (→ Home page).
- Footer at bottom.

### Order Tracking (`/track-order`)
Enter Order ID (+ email/phone for verification) → status timeline: `Pending → Processing → Shipped → Delivered` (or `Cancelled`), with estimated delivery date and courier info when shipped.

## 5.5 Terms & Conditions Page (`/terms`)
- Same navbar as home (unchanged), footer at bottom.
- **Two distinct documents:** Customer T&C and Vendor T&C (separate page `/vendor-terms`).
- Content modeled on Daraz / Shopify / Alibaba T&Cs, covering:
  - **Customer T&C:** account responsibilities, order acceptance, pricing & payment, shipping & delivery (incl. rural branch-pickup terms), returns & refunds policy, cancellations, gift cards/coupons, prohibited conduct, privacy & data use, limitation of liability, governing law (Pakistan), dispute resolution, T&C change policy.
  - **Vendor T&C:** eligibility & verification (CNIC), listing rules & prohibited items, product authenticity guarantee, **commission structure & payout schedule**, pricing/discount approval requirement, banner advertising terms & auto-expiry on non-payment, order fulfillment SLAs, packaging standards, returns handling & chargebacks, suspension/termination conditions, tax responsibilities, confidentiality.

## 5.6 Account Page (`/account`)
For logged-in customers — displays and lets them edit the info collected at signup: name, phone number, email; plus: change password, saved addresses, saved (tokenized) cards management, **order history with statuses**, and logout.

## 5.7 Become a Vendor Page (`/become-a-vendor`)
Structure top-to-bottom:
1. **Why sell on Duo Bro Mart** — value pitch (reach, COD network, banner promotion, fair commission).
2. **How it works** — steps: *Fill application → Verification & review → Approval in 4–5 business days → Receive vendor login credentials → Start selling.*
3. **Application Form:**

| Field | Type | Required |
|---|---|---|
| Business Name | text | ✅ |
| Owner Name | text | ✅ |
| Email Address | email | ✅ |
| Contact Number | phone | ✅ |
| Business Type | dropdown (Retailer, Wholesaler, Manufacturer, Home Business, …) | ✅ |
| CNIC / ID Card images (front & back) | file upload, **JPG** | ✅ |
| Business Description ("what do you sell?") | textarea | ✅ |
| Social Media Page Links (Facebook/Instagram/TikTok/website) | url(s) | Optional |

   Submit → "Application received — you'll be verified and receive vendor panel login access within **4–5 business days**."
4. **FAQ (accordion):** How do I register? • What does it cost to sell on Duo Bro Mart? (commission model explained) • How long does approval take? • How do I get paid? • Can I run discounts? (yes, with admin approval) • How do banner promotions work? • What products are prohibited?
5. **Already a vendor?** → link to Vendor Login (`/vendor/login`).
6. Footer.

---

# 6. PRD — VENDOR CHANNEL (DETAILED)

## 6.1 Vendor Panel Overview
Approved vendors log in at `/vendor/login` with admin-issued credentials (password change forced on first login) and land on the Vendor Panel.

## 6.2 Product Management (Vendor Side)
Vendor can create a product with:
- Product name, description, images
- **Category** (must select from platform taxonomy — mandatory, so the system auto-places it into the right category on the storefront and in filters)
- **Brand name** (mandatory — feeds the brand filter; see 6.4)
- **Price** (vendor's base price; customer sees *vendor price + platform commission* — §7.7)
- **Stock quantity** (pieces available)
- Attributes/specs (size, color, model, etc.)

**Approval workflow:**
```
Vendor submits product (status: Draft/Pending)
        → Admin reviews (Products section)
        → APPROVED  → product goes live → appears in "New Arrivals" + its category
        → REJECTED  → returned to vendor with reason
```

## 6.3 Discounts, Deals & Price Changes
- Vendor may propose: discount %, deal type (flash deal, BOGO, gift-card-eligible), or a price change.
- **Every change requires admin approval** (routed to Admin → Pricing section) before it reflects on the site.

## 6.4 Brand-as-Filter Rule
**Every newly approved vendor's brand name is automatically added to the Shop page's Brand filter** (and to the category/brand area). This gives each vendor built-in discoverability — Duo Bro Mart's equivalent of Alibaba's supplier storefronts.

## 6.5 Stock Management
- Vendor sets initial stock; sales **decrement stock automatically in real time** across all three panels (§8).
- **Decrement:** automatic, no approval needed.
- **Increment (restock):** vendor submits a stock-increase request → **admin approval required** → stock updates everywhere. (Prevents vendors from faking availability.)

## 6.6 Banner Advertising (Vendor Side)
Vendor applies for a banner slot from their panel with:
- Banner image (per size spec), **banner title**, **description/subtitle**
- **Desired position:** Hero carousel (5 slots) or Promo (Left / Center / Right)
- **Duration in days** (any number, vendor's preference)
- **Price = daily rate for that position × number of days** (e.g., 3 days = 3 × daily rate); weekly packages available.

Application goes to Admin → Banner section for review, payment confirmation, and publishing (§7.4).

## 6.7 Vendor Orders, Analytics & Payouts *(built beyond original roadmap — see §7.8)*
Vendor sees orders containing **their** products only: order ID, items, quantity, status, and per-item earnings after commission — pulled from the real Order backend (not the mock/localStorage checkout the earlier draft of this section assumed).

**Analytics:** real revenue, units sold, and top-products for a selected date range (7/30/90 days), plus product-view counts and a best-effort traffic-source breakdown (Direct / Search / Social / Other, inferred from referrer — not full UTM tracking) and a conversion rate (orders ÷ views). Views are logged automatically on every storefront product-detail page load.

**Payouts ledger** *(replaces the old "Phase 2" placeholder — this is now built, see §7.8 for the admin side)*: delivered-order earnings accrue as a running balance. An order's earnings become payout-eligible a configurable number of days after delivery (**payout hold period**, default 3 days — covers the return/complaint window), then get batched into a payout covering everything eligible since the vendor's last batch, on a configurable minimum cycle (**payout cycle**, default 7 days). The vendor's Payouts page shows: current accruing (not-yet-batched) balance, lifetime paid total, when their next batch is eligible, and full history of past batches (period, amount, status, paid date).

**Explicitly out of scope for now** (no live bank/wallet transfer integration exists — batches are marked paid manually by an admin once the transfer has actually been sent outside the platform): automatic NayaPay/Easypaisa/bank disbursement, payout failure retries, vendor-selectable payout schedule (currently platform-wide, not per-vendor), and full click/session-level analytics (returning-vs-new visitors, funnels, geographic breakdown).

## 6.8 Vendor Settings
Change password, update contact info, view own application details, view commission rate, read Vendor T&C.

---

# 7. PRD — ADMIN PANEL (DETAILED — 7 ORIGINAL SECTIONS + §7.8 PAYOUTS ADDED POST-LAUNCH-PLANNING)

Admin logs in at `/admin/login` (separate hidden URL). Panel layout: left sidebar with the 7 sections + **Logout at the bottom of the page**.

## 7.1 Section 1 — Dashboard
**Top KPI cards:**
- 💰 **Total Revenue** (PKR)
- 📦 **Total Orders**
- 🛍 **Active Products** (across all categories & vendors)
- 🧑‍💼 **Vendors** — split counts: *new applications pending* AND *verified vendors with items awaiting approval* (product launches / discount requests)

**Recent Orders table:** Order ID • Customer Name • Product Name(s) • Amount • Status badge (`Delivered` / `Processing` / `Pending` / `Cancelled`).

**Analytics:** graph + chart of **best-selling products this week and this month** (bar/line chart, toggle week/month).

## 7.2 Section 2 — Products
- **Search bar** — find any product by name/ID/vendor.
- **Category tabs/filter** — same taxonomy as the shop page for easy distinction between fields.
- **Product table columns:**

| Column | Notes |
|---|---|
| Product Image | thumbnail |
| Product Name | |
| Category | |
| Price | final customer price (vendor price + commission) |
| **Stock** | pieces the vendor has listed — **live, real-time synced** with vendor panel and customer storefront (§8) |
| Approval Status | `Active` / `Draft (pending approval)` |
| Actions | **Approve**, Edit, **Delete** |

- **Delete cascade:** if a vendor no longer sells a product (or it violates policy), admin deletes it here → it is **immediately eliminated from the vendor panel and the customer storefront** as well.

## 7.3 Section 3 — Banners
Manages the home page **hero carousel (5 slots)** and **promo banners (Left / Center / Right — 3 slots)**.

**Workflow:**
1. Vendor banner applications arrive (image, title, description, desired position, number of days).
2. Admin reviews → confirms application & payment.
3. Admin publishes: uploads the banner image from the application, sets **title, subtitle, position** → the system feeds it directly into the specified slot on the home page.
4. **CTA link** is attached: click → the relevant **brand's category page**, or if the banner promotes a specific product → that **product's page**.

**Active banner management:**
- List of live banners: position, vendor, start date, **expiry date/time**, payment status.
- **Auto-expiry scheduling:** each banner has an expiry timestamp (e.g., *"after 27 July, 12:00 AM"*) — the system **auto-removes it** at that moment (scheduled job).
- **Manual delete** available any time — e.g., if the vendor's payment is not made by the due date.

**Pricing config:** daily rate per position (hero vs promo L/C/R), weekly package rates.

## 7.4 Section 4 — Orders
All orders table: **Order ID • Date • Customer Name • No. of Items • Payment Method • Delivery Status**.

**5 filter tabs (filtering on delivery status only):**
`All` • `Delivered` • `Pending` • `Processing` • `Cancelled`

Clicking an order opens full detail (items, vendor(s), shipping address incl. rural landmark, delivery method, payment state) and allows the admin to advance the status (`Pending → Processing → Shipped → Delivered`, or `Cancel`). Status changes trigger customer email notifications and — on Delivered — the feedback email (§9).

## 7.5 Section 5 — Vendors
Two tabs:

**(a) Pending Applications**
- Every field the vendor submitted (business name, owner, email, contact, business type, CNIC images, description, social links) + **application date** + status control: **Approve** ✅ / **Reject** ❌ (with reason).
- Approve → system creates vendor account, generates temp password, emails credentials.

**(b) Active Vendors**
| Column | Notes |
|---|---|
| Business Name | |
| Owner Name | |
| No. of Products on site | |
| Total Sales | PKR |
| Rating | aggregated from customer feedback on their products |
| **Action: Suspend** | used when a vendor accumulates complaints (product quality etc.) — suspension hides all their products from the storefront and locks their panel |

## 7.6 Section 6 — Pricing
- Queue of vendor requests: **price changes** and **discount/deal applications**.
- Each request: product, current price, requested price/discount, vendor note → Admin **Approve** (change pushed live to site) / **Reject** (vendor notified with reason).
- **Commission rule (platform-wide):** *Customer price = Vendor price + platform commission.* Commission % configured here (global and/or per category). Every listed price on the site always includes commission automatically.

## 7.7 Section 7 — Settings
**(a) General:** Website name, website contact email, **currency (PKR)**.

**(b) Shipping Settings:**
- **Default shipping rate: PKR 250** (city-to-city standard).
- Custom rates by distance/courier: **beyond 500 km, price is no longer the default — calculated as price-per-km** (admin sets the per-km rate). Courier-specific overrides allowed.
- Rate multipliers per delivery method (Standard / Express / Urgent).
- **Free-shipping threshold:** e.g., cart ≥ **PKR 5,000 → shipping free** (value editable here).

**(c) Notification Settings (admin email alerts, individually toggleable):**
| Alert | Toggle |
|---|---|
| 📧 New Order received | On/Off |
| 📧 New Vendor Application | On/Off |
| 📧 Low-Stock Alert (product below threshold) | On/Off |
| 📧 Payout Requests | On/Off |

> Example: admin wants only vendor-application emails → turns that ON and the other two OFF; only those emails are generated.
>
> **Implementation note:** all four toggles are now wired to a real trigger — New Order (fires on checkout), New Vendor Application (fires on §5.7 submission), Low-Stock (fires once as a product crosses the threshold), and Payout Requests (fires once per "Generate Payouts" run — one summary email listing every new batch, not one per vendor). All four respect their toggle and fail silently so a missed alert email never blocks the customer/vendor-facing action that triggered it.

**(d) Payment Settings (gateway toggles):**
- Independent On/Off switches: **Cards** • **E-Wallets (NayaPay/Easypaisa/JazzCash)** • **COD**.
- Situational use: *if banking servers are down, admin turns off Cards and E-Wallets → checkout shows only COD.* Toggles reflect on the customer payment page instantly.

**(e) Payout Schedule** *(new — see §6.7/§7.8)*:
- **Hold period (days after delivery):** default 3 — how long after delivery before that order's vendor earnings become payout-eligible.
- **Payout cycle (days):** default 7 — minimum gap between payout batches for the same vendor.

**(f) Logout** — at the very end/bottom of the panel.

---

## 7.8 Section 8 — Payouts *(new — built beyond the original 7-section design, same way §7.3 Banners grew out of a vendor-side feature)*
The admin counterpart to §6.7's vendor payout ledger.

- **Batch list:** every payout ever generated — vendor, period covered, item count, amount, status (`Pending` / `Processing` / `Paid`), created date, and (once paid) the bank/wallet reference the admin entered.
- **"Generate Payouts" action:** runs the eligibility engine — for every vendor with delivered-order earnings past the hold period and outside their cycle cooldown, creates one new payout batch covering everything currently eligible. An order line is claimed by exactly one batch, ever — it cannot be paid out twice even across separate generation runs.
- **"Mark Paid" action:** opens the batch's line items (order + product + amount) for review, takes a bank/wallet transaction reference, and flips the batch to `Paid` with a timestamp. This is a manual admin action because no live transfer integration exists yet (see §6.7's "explicitly out of scope" list).
- Filterable by status and by vendor.

---

# 8. REAL-TIME INVENTORY SYNCHRONIZATION

**Requirement:** Stock is a single source of truth shared live by all three panels (Admin ⇄ Vendor ⇄ Customer storefront).

| Event | Effect | Approval needed? |
|---|---|---|
| Customer places order | Stock **decrements** instantly everywhere | No (automatic) |
| Order cancelled/refunded | Stock restored | No (automatic) |
| Vendor requests restock (**increment**) | Pending → admin approves → stock increases everywhere | **Yes** |
| Admin edits stock | Immediate | Is the approval |
| Stock hits 0 | Product shows "Out of Stock", Buy buttons disabled | — |
| Stock below threshold | Low-stock email to admin (if toggle on) + flash-deal eligibility | — |

**Implementation approach:**
- PostgreSQL row-level locking (`SELECT … FOR UPDATE`) inside the order transaction prevents overselling under concurrency.
- **Django Channels (WebSockets)** push stock updates live to open admin/vendor dashboards; the customer storefront re-validates stock at add-to-cart and again at place-order.
- Celery + Redis handle async jobs (emails, banner auto-expiry, low-stock checks).

---

# 9. POST-DELIVERY FEEDBACK & COMPLAINT SYSTEM

**Trigger:** Order status → `Delivered` → automated **email** to the customer: *"Was the correct product delivered?"* with two paths:

### Path A — Correct product ✅ → Feedback Form
Customer rates (1–5 stars each):
1. Quality of Service
2. Packaging
3. Product Quality
4. Customer Service
5. Overall Rating
6. **Written feedback** — free-text experience description

→ Submit → **Continue Shopping** button → Home page.
→ Ratings & feedback are saved to the database, update the **product rating** (shop filter), the **vendor rating** (admin Vendors section), and are visible in the admin panel.

### Path B — Wrong/problem product ❌ → Complaint Form
Reason (radio, one of):
- Wrong product (entirely different item)
- Right product, **wrong color**
- Right product, **wrong brand**
- **Missing part/accessory**
- **Damaged / broken**
- **Wrong size**

- **Description field** (e.g., *"I ordered a black gaming mouse but a white one was delivered"*), optional photo upload.
- Complaint → admin panel queue → drives refund/replacement handling and counts against the vendor (repeated complaints → Suspend, §7.5).

---

# 10. TECHNICAL ARCHITECTURE & DATABASE DESIGN

## 10.1 Stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | **React.js** (+ React Router, Redux Toolkit/Query, Tailwind CSS) | 3 SPAs / route groups: storefront, vendor panel, admin panel |
| Backend | **Python — Django + Django REST Framework** | REST APIs, RBAC, business logic |
| Real-time | Django Channels + Redis | Live stock sync, dashboard updates |
| Async jobs | Celery + Redis | Emails, banner auto-expiry, scheduled reports |
| Database | **PostgreSQL** | Single source of truth |
| Auth | JWT (SimpleJWT) + OAuth2 (Google, Facebook) | Separate token scopes per role |
| Payments | Local gateway aggregator (e.g., PayFast PK / Safepay / XPay) + wallet APIs (Easypaisa, JazzCash, NayaPay) | Tokenized cards, wallet flows, COD flag |
| Media | Object storage (S3-compatible) | Product images, banners, private CNIC uploads |
| Email | Transactional email service (SMTP/SendGrid/SES) | Verification, order, feedback, admin alerts |
| Deploy | Docker + Nginx + Gunicorn/Daphne; CDN for static | |

## 10.2 High-Level Architecture

```
 [Customer SPA]   [Vendor SPA]   [Admin SPA]        (React.js)
       │               │              │
       └───────────────┼──────────────┘
                       ▼
             ┌──────────────────┐        ┌─────────────┐
             │  Django REST API  │◄──────►│ Redis        │
             │  + Channels (WS)  │        │ (cache/queue)│
             └───────┬──────────┘        └──────┬──────┘
                     │                          │
             ┌───────▼────────┐         ┌───────▼───────┐
             │  PostgreSQL     │         │ Celery workers │→ emails, banner
             └────────────────┘         └───────────────┘   expiry, alerts
                     │
      [Payment Gateways]  [Courier APIs]  [S3 Media]
```

## 10.3 Core Database Entities (ERD Outline)

```
User(id, role[customer|vendor|admin], name, email, phone, password_hash,
     oauth_provider, is_active, created_at)

VendorApplication(id, business_name, owner_name, email, contact, business_type,
     cnic_front_img, cnic_back_img, description, social_links[], applied_at,
     status[pending|approved|rejected], reviewed_by, reviewed_at)

Vendor(id, user_id FK, application_id FK, brand_name UNIQUE, rating_avg,
     total_sales, status[active|suspended])

Category(id, name, slug, parent_id nullable, image)

Brand(id, name UNIQUE, vendor_id FK)          -- auto-created on vendor approval

Product(id, vendor_id FK, category_id FK, brand_id FK, name, slug, description,
     base_price, commission_pct, final_price (computed), stock_qty,
     status[draft|pending|active|rejected|deleted], rating_avg, created_at)

ProductImage(id, product_id FK, url, sort_order)

DealRequest / PriceChangeRequest(id, product_id FK, vendor_id FK,
     type[discount|price_change|bogo|flash], requested_value, note,
     status[pending|approved|rejected], reviewed_by)

Discount(id, product_id FK, pct, deal_type, starts_at, ends_at, active)

Cart(id, user_id FK) ── CartItem(id, cart_id FK, product_id FK, qty)

Order(id, order_code 'DBM-YYYY-XXXXXX', user_id FK, subtotal, discount_total,
     shipping_fee, tax, grand_total, payment_method[card|wallet|cod],
     payment_status, delivery_status[pending|processing|shipped|delivered|cancelled],
     delivery_method[standard|express|urgent], estimated_delivery_date, created_at)

OrderItem(id, order_id FK, product_id FK, vendor_id FK, qty, unit_price,
     line_total, commission_amount)

Payout(id, vendor_id FK, period_start, period_end, total_amount,
     status[pending|processing|paid], reference, admin_notes, paid_at, created_at)
     -- new (§6.7/§7.8): a batch of one vendor's eligible earnings

PayoutItem(id, payout_id FK, order_item_id FK UNIQUE, amount)
     -- new: one delivered order line folded into a batch; UNIQUE on
     -- order_item_id is the double-payment guard — an item can belong to
     -- at most one Payout, ever

ProductView(id, product_id FK, source[direct|search|social|other], viewed_at)
     -- new (§6.7 Analytics): one row per storefront product-detail page load

ShippingAddress(id, order_id FK, full_name, contact, email, address_text,
     province, city, is_rural BOOL, nearest_landmark nullable)

SavedCardToken(id, user_id FK, gateway_token, last4, brand, expiry)  -- token ONLY

BannerApplication(id, vendor_id FK, image, title, description,
     position[hero1..5|promo_left|promo_center|promo_right], days, quoted_price,
     status[pending|approved|rejected|paid])

Banner(id, application_id FK, image, title, subtitle, position, cta_link,
     starts_at, expires_at, is_active)   -- Celery job deactivates at expires_at

Feedback(id, order_id FK, product_id FK, q_service, q_packaging, q_product,
     q_customer_service, q_overall, text, created_at)

Complaint(id, order_id FK, reason[wrong_product|wrong_color|wrong_brand|
     missing_part|damaged|wrong_size], description, photo, status, created_at)

Setting(key, value)   -- site_name, email, currency=PKR, default_ship=250,
                      -- per_km_rate, free_ship_threshold=5000,
                      -- payout_hold_days=3, payout_cycle_days=7,
                      -- notify_new_order, notify_vendor_app, notify_low_stock,
                      -- pay_card_on, pay_wallet_on, pay_cod_on

AuditLog(id, admin_id, action, entity, entity_id, before, after, at)
```

## 10.4 Key API Groups (REST)

- `POST /api/auth/{signup|login|social|forgot|reset}` — per-role login endpoints
- `GET /api/home/` (banners + flash deals + featured + new arrivals + categories)
- `GET /api/products/?category=&brand=&min_price=&max_price=&rating=&page=` (20/page)
- `POST /api/cart/items/` • `POST /api/orders/` • `GET /api/orders/track/{code}/`
- `POST /api/vendor/apply/` • vendor CRUD: `/api/vendor/products/`, `/api/vendor/deals/`, `/api/vendor/banners/`, `/api/vendor/restock/`
- `GET /api/orders/vendor/` (orders with this vendor's items) • `GET /api/orders/vendor/payouts/` (balance + history) • `GET /api/products/vendor/analytics/?range=7d|30d|90d`
- Admin: `/api/admin/dashboard/`, `/api/admin/products/`, `/api/admin/banners/`, `/api/admin/orders/`, `/api/admin/vendors/`, `/api/admin/pricing/`, `/api/admin/settings/`
- `GET /api/orders/admin/payouts/` • `POST /api/orders/admin/payouts/generate/` • `POST /api/orders/admin/payouts/<id>/mark-paid/`
- `POST /api/feedback/{order_code}/` • `POST /api/complaints/{order_code}/`
- WebSocket: `/ws/stock/` (live inventory), `/ws/admin/dashboard/`

---

# 11. NON-FUNCTIONAL REQUIREMENTS

| Category | Requirement |
|---|---|
| **Security** | Everything in §4.4: TLS, hashed passwords, tokenized cards, RBAC, private CNIC storage, audit logs, rate limiting, CAPTCHA, OWASP Top-10 hardening (CSRF, XSS, SQLi via ORM) |
| **Performance** | Page load < 3s on 3G mobile; API p95 < 300ms; image CDN + lazy loading; Redis caching of home page & category data |
| **Availability** | 24/7 target 99.5%+; graceful degradation (e.g., gateway down → COD-only via admin toggle) |
| **Scalability** | Stateless API behind load balancer; PostgreSQL read replicas when needed; pagination everywhere |
| **Responsiveness** | Mobile-first responsive UI (majority of Pakistani traffic is mobile) |
| **Data integrity** | ACID transactions for orders + stock; row locking to prevent overselling; daily encrypted backups |
| **Localization-ready** | PKR formatting; architecture allows adding Urdu later |
| **SEO** | Clean slugs, meta tags, sitemap, structured data (Product schema) for organic traffic (§13.2) |
| **Auditability** | All admin actions logged; order state history retained |

---

# 12. MONETIZATION STRATEGIES (REVENUE MODEL)

Ranked by expected contribution, with references to who proved each model:

### 12.1 Commission on Every Sale (primary — Daraz/Amazon model)
- **Customer price = vendor base price + commission.** Commission is invisible friction-free revenue on every transaction.
- Start with a flat 8–12%, then move to **category-based rates** (electronics lower ~5–8%, fashion/beauty higher ~12–15%) like Daraz.
- Commission handled automatically at listing time (§7.7) — vendors always see exactly what they'll earn.

### 12.2 Banner Advertising (secondary — already designed in)
- 5 hero slots + 3 promo slots × daily/weekly rates × 365 days = predictable ad inventory.
- Price hero > promo center > promo left/right. Surge-price during Ramadan/Eid/11.11.
- Later: sponsored product placements in search results (Amazon Ads / eBay Promoted Listings model) — much higher ceiling than banners alone.

### 12.3 Shipping Margin
- Negotiate bulk courier rates (e.g., PKR 180/parcel) while charging the default PKR 250 → margin per order.
- Urgent delivery tier carries the highest markup.

### 12.4 Featured Vendor / Subscription Tiers (Alibaba Gold Supplier model — Phase 3)
- "Verified Plus" vendor badge, priority approval, better placement, lower commission — monthly fee.

### 12.5 Gift Cards & Coupons
- Gift cards are prepaid float (cash upfront, ~10–20% never fully redeemed = breakage revenue).
- Coupons funded by vendors (they discount, we keep full commission) drive volume at no platform cost.

### 12.6 Strategic Loss-Leaders (Temu model — use carefully)
- First-order discount codes (e.g., PKR 200 off) to convert new signups; cost of acquisition, not a loss if repeat rate holds.

### 12.7 Later-Stage Streams
- COD handling fee (small, like Daraz), payment processing spread, vendor services (photography, listing optimization), affiliate program margins, and data/analytics dashboards for vendors (paid tier).

**Revenue guardrail:** never sacrifice trust for short-term revenue — counterfeit products or hidden fees killed early trust for others in this market; strict admin approval is both a quality system and a monetization moat.

---

# 13. TRAFFIC & GROWTH STRATEGIES (MARKETING)

### 13.1 Social Commerce First (Pakistan-specific)
- Pakistan's buying journey starts on **Facebook, Instagram, TikTok, and WhatsApp** — not Google.
- TikTok product demo videos + influencer unboxings (micro-influencers, 10k–100k followers, are cheap and convert well locally).
- Facebook/Instagram catalog ads retargeting cart abandoners.
- WhatsApp Business for order updates → doubles as a re-engagement channel.

### 13.2 SEO (compounding organic traffic — Amazon/Daraz playbook)
- Product pages with clean slugs, meta descriptions, `Product` structured data (price, rating, availability → rich results in Google).
- Category landing pages targeting queries like "gaming mouse price in Pakistan".
- Blog/buying-guide content ("Best budget smartphones in Pakistan 2026") funneling to categories.

### 13.3 Campaign Calendar (Daraz playbook)
- Own the spikes: **Ramadan/Eid sales, 11.11, 12.12, Independence Day (14 Aug), wedding season**.
- Flash Deals + countdowns + themed hero banners per campaign; email blasts before each event.

### 13.4 Referral & Affiliate Program (Temu/Amazon Associates model)
- Referral: give PKR X to referrer and referee on first completed order.
- Affiliate program (already in footer): bloggers/YouTubers get a % of sales they drive via tracked links.

### 13.5 Email & Retention
- Lifecycle emails: welcome + first-order coupon → abandoned-cart (1h/24h) → delivery feedback (§9) → win-back after 30 days of inactivity.
- Retention is cheaper than acquisition: repeat-purchase coupons, "back in stock" alerts.

### 13.6 Vendors as a Growth Engine (marketplace flywheel)
- Every vendor promotes their own Duo Bro Mart listings to their existing social audience → free traffic.
- Give vendors shareable product links + "Available on Duo Bro Mart" badge assets.
- More vendors → more products → better SEO/selection → more customers → attracts more vendors. **Protect the flywheel by keeping vendor onboarding smooth (the promised 4–5 day approval must actually happen).**

### 13.7 Trust Marketing
- Show real reviews/ratings prominently (they exist because of §9).
- Publicize COD + easy returns + "admin-verified sellers" — directly answers the #1 objection of Pakistani online shoppers.

### 13.8 Performance Marketing (paid, once unit economics are known)
- Google Shopping ads for high-intent queries; Meta ads for discovery; retargeting lists from site pixels.
- Rule: don't scale paid ads until average order value, repeat rate, and margin per order are measured.

---

# 14. DEVELOPMENT WORKFLOW — FRESH PAGE-BY-PAGE PHASE PLAN

> This roadmap starts from the system overview in §3 and builds the platform page by page. Each feature is shaped by the competitor lessons in §2 and implemented with a clear action and system activity.

## PHASE 1 — PLATFORM SHELL, ROUTING & ROLE ENTRY *(Week 1–2)*
**Goal:** Build the three-channel foundation from §3 and prepare the app shell for customer, vendor, and admin experiences.

### 1.1 Route Shell & Entry Pages
- Feature: Separate customer, vendor, and admin entry routes.
- Action: A visitor lands on `/` and sees the customer storefront; approved vendors use `/vendor/login`; admins use `/admin/login`.
- Activity: Create route guards, role-based redirects, and hidden admin/vendor entry URLs.
- Competitor reference: Daraz, Amazon, and Shopify all use separate seller/admin environments, but Duo Bro Mart keeps them hidden from normal customers.

### 1.2 Global Layout Foundation
- Feature: Shared customer navbar/footer shell and separate vendor/admin sidebar shell.
- Action: Customer pages show Home • Shop • Deals • Terms • Become a Vendor • Cart • Account; vendor/admin pages show role-specific navigation.
- Activity: Build reusable layout components, responsive spacing, and mobile-first navigation.
- Competitor reference: Amazon and Shopify use strong navigation systems; Daraz and Alibaba use role-specific seller panels.

### 1.3 RBAC & Permission Structure
- Feature: Role-based access control foundation.
- Action: Customers only access their own orders/account; vendors only their own products/orders; admins can manage the platform.
- Activity: Implement backend permission checks and API-level protection.
- Competitor reference: Alibaba and Shopify both rely on clear seller vs buyer boundaries.

---

## PHASE 2 — AUTHENTICATION, SECURITY & ACCOUNT FOUNDATION *(Week 3–4)*
**Goal:** Deliver the authentication experience from §4 and create the first trust layer for the platform.

### 2.1 Customer Signup & Login Page
- Feature: Customer auth screen with email/password, social login, and password recovery.
- Action: User signs up with full name, Pakistani phone number, email, password, and terms checkbox.
- Activity: Validate phone format, password strength, duplicate email, and show clear success/error states.
- Competitor reference: Shopify and Daraz prioritize fast account creation; our version adds local phone validation and Pakistani market fit.

### 2.2 Social Login (Google/Facebook)
- Feature: OAuth-based sign-up/sign-in.
- Action: User signs in with Google or Facebook and is redirected to the customer experience.
- Activity: Create or link the customer profile and prompt for phone number if missing.
- Competitor reference: Amazon and Shopify use social login for faster onboarding.

### 2.3 Forgot Password & Session Security
- Feature: Password reset flow and secure session management.
- Action: User requests a reset email, receives a time-limited link, and can reset password securely.
- Activity: Invalidate old sessions and enforce secure cookies/token handling.
- Competitor reference: Shopify handles trust through strong account recovery; Daraz also uses secure account flows.

### 2.4 Vendor & Admin Login Pages
- Feature: Hidden login portals for vendors and admins.
- Action: Vendor logs in on `/vendor/login`; admin logs in on `/admin/login`.
- Activity: Separate auth logic, role-specific redirect, and first-login password change for vendors.
- Competitor reference: Alibaba and Daraz have seller portals; Duo Bro Mart makes them separate and non-public.

### 2.5 Customer Account Page
- Feature: Profile and preference management.
- Action: Customer updates name, phone, email, password, saved addresses, and saved cards.
- Activity: Display order history and enable logout.
- Competitor reference: Shopify and Amazon both place account controls in one persistent profile area.

---

## PHASE 3 — CUSTOMER STORE FRONT PAGES *(Week 5–8)*
**Goal:** Build the customer-facing browsing experience from §5 and make the shop feel like a modern marketplace.

### 3.1 Home Page — Hero & Promo Banners
- Feature: Hero carousel with 5 banner slots and 3 promo slots.
- Action: User sees rotating promotional banners with CTA links to categories or products.
- Activity: Auto-advance banners, pause on hover, show arrows/dots, and load admin/vendor-managed content.
- Competitor reference: Amazon uses featured areas; Daraz uses sales banners; Temu uses urgency-driven banners.

### 3.2 Home Page — Flash Deals, Featured, New Arrivals
- Feature: Product discovery sections on home.
- Action: User sees discounted low-stock products, top-selling items, and newly approved products.
- Activity: Pull data from inventory, discounts, and approval status; show urgency messaging and badges.
- Competitor reference: Daraz and Temu use flash deals; Amazon uses featured and new release sections.

### 3.3 Home Page — Categories Grid & Trust Strip
- Feature: Category tiles and trust badges.
- Action: User clicks a category and enters the shop filtered to that category; trust badges communicate delivery, payment, and support reliability.
- Activity: Render category cards and trust icons with consistent design.
- Competitor reference: Amazon uses category-led discovery; Shopify uses trust-driven UX cues.

### 3.4 Shop Page — Product Listing with Filters
- Feature: Shop page with category, price, brand, and rating filters.
- Action: User narrows results by different attributes and sees active filter chips.
- Activity: Apply AND logic across filters, update URL query params, and paginate results.
- Competitor reference: Amazon and eBay use filtering heavily; our version also adds brand-based discovery from vendor approvals.

### 3.5 Shop Page — Deals, Trending, Best Deals
- Feature: Deal-focused shopping sections.
- Action: User opens the Deals view and sees discounted or BOGO products sorted by urgency and discount.
- Activity: Filter products by active deals and show badge states.
- Competitor reference: Temu uses urgency and discount-driven sections; Daraz uses mega deals and promotions.

### 3.6 Product Detail Page
- Feature: Full product experience with gallery, price, stock, specs, vendor info, and reviews.
- Action: User views product details, selects quantity, and chooses Add to Cart or Buy Now.
- Activity: Show real-time stock status and linked reviews/ratings.
- Competitor reference: Amazon sets the standard for product detail pages; Daraz adds seller visibility and ratings.

### 3.7 Terms & Become-a-Vendor Pages
- Feature: Public content pages.
- Action: User reads customer/vendor terms and submits a vendor application.
- Activity: Render legal content sections, FAQ accordion, and application form submission.
- Competitor reference: Alibaba and Shopify both separate buyer and seller terms; Daraz uses seller onboarding pages.

---

## PHASE 4 — CART, CHECKOUT & ORDER TRACKING *(Week 9–12)*
**Goal:** Deliver the money path from §5.4 and make checkout feel simple, trustworthy, and local-market friendly.

### 4.1 Cart Page
- Feature: Cart experience with line items, quantity controls, remove action, and discount display.
- Action: User updates quantities, removes items, and sees a live order summary.
- Activity: Recalculate subtotal, discount, shipping, and total on each change.
- Competitor reference: Shopify and Amazon both use clear and persistent cart summaries.

### 4.2 Guest & Logged-In Cart Persistence
- Feature: Cart continuity across sessions.
- Action: Guest cart is saved in local storage; logged-in cart is saved in the database and merged on login.
- Activity: Sync cart states safely when the user signs in.
- Competitor reference: Shopify is strong here, and this is essential for reducing abandonment.

### 4.3 Shipping Page — Address & Rural Delivery
- Feature: Mandatory shipping form with province/city selection and rural landmark support.
- Action: User enters full shipping details and selects city or rural delivery.
- Activity: Validate fields, change city list by province, and capture nearest landmark for rural orders.
- Competitor reference: This is a unique Duo Bro Mart feature, built specifically for Pakistan’s logistics reality where Daraz and Amazon do not fully solve rural pickup issues.

### 4.4 Shipping Page — Delivery Method Selection
- Feature: Standard, Express, and Urgent delivery tiers.
- Action: User selects delivery speed and sees the shipping fee update instantly.
- Activity: Recalculate the virtual bill and show ETA for each option.
- Competitor reference: Shopify and Daraz both support delivery options; our version adds local tiers and Pakistan-friendly estimates.

### 4.5 Payment Page — Card, Wallets & COD
- Feature: Checkout payment methods with admin toggles.
- Action: User chooses card, wallet, or COD; can optionally save a card as a tokenized payment method.
- Activity: Respect gateway availability, trigger payment flow, and create the order only after payment/COD acceptance.
- Competitor reference: Daraz leads on COD and local wallets; Shopify leads on slick checkout; we combine both for Pakistan.

### 4.6 Confirmation & Tracking Pages
- Feature: Order confirmation and tracking experience.
- Action: User sees a confirmation message, generated order ID, delivery estimate, and tracking link.
- Activity: Create the order record, decrement stock, send confirmation email, and make the order traceable.
- Competitor reference: Amazon and Shopify both provide strong order confirmation and tracking flows.

---

## PHASE 5 — VENDOR PANEL PAGES *(Week 13–16)*
**Goal:** Build the vendor side from §6 so approved sellers can manage products and promotions safely.

### 5.1 Vendor Login & First Login Experience
- Feature: Vendor portal access and password reset on first login.
- Action: Approved vendor logs in with credentials and must change the password immediately.
- Activity: Enforce first-login password change and redirect into the dashboard.
- Competitor reference: Daraz and Alibaba both have seller onboarding flows; we make the experience more controlled and approval-based.

### 5.2 Vendor Dashboard
- Feature: Seller overview panel.
- Action: Vendor sees order summary, product counts, and pending actions.
- Activity: Aggregate sales, pending approvals, and platform messages into a simple dashboard.
- Competitor reference: Amazon Seller Central and Shopify merchant dashboards inspire this structure.

### 5.3 Vendor Product Management
- Feature: Product submission flow.
- Action: Vendor creates a product with name, images, category, brand, price, specs, and stock.
- Activity: Save as draft/pending and route for admin approval before publishing.
- Competitor reference: Daraz and Amazon both require seller product review; we add stricter approval rules.

### 5.4 Vendor Discount, Deal & Price Change Requests
- Feature: Seller change requests for promotions and pricing.
- Action: Vendor requests discounts, flash deals, BOGO offers, or price changes.
- Activity: Create a review request and wait for admin approval before the change goes live.
- Competitor reference: Alibaba uses negotiated pricing; Temu uses aggressive discounts; our version makes these requests controlled and visible.

### 5.5 Vendor Banner Application Flow
- Feature: Paid banner placement request.
- Action: Vendor selects position, duration, and uploads banner assets.
- Activity: Queue the application for admin review and payment confirmation.
- Competitor reference: Amazon ads and eBay promoted listings use paid visibility; we adapt it for marketplace banners.

### 5.6 Vendor Orders & Stock Management
- Feature: Seller order and stock control.
- Action: Vendor views orders for their products and requests restocks when needed.
- Activity: Decrement stock on order placement and route restock increases through admin approval.
- Competitor reference: Shopify and Amazon both require reliable inventory visibility; we add a stronger approval gate for restock.

### 5.7 Vendor Settings
- Feature: Vendor profile and compliance settings.
- Action: Vendor updates contact info, reviews commission rate, and reads vendor terms.
- Activity: Store and display vendor profile data and platform policy details.
- Competitor reference: Shopify merchant settings and Alibaba supplier settings inspire this page.

---

## PHASE 6 — ADMIN PANEL PAGES *(Week 17–20)*
**Goal:** Build the control center from §7 so admin can govern every part of the marketplace.

### 6.1 Admin Login & Dashboard
- Feature: Admin sign-in and KPI dashboard.
- Action: Admin logs in and sees revenue, orders, products, and vendor metrics.
- Activity: Render summary cards, recent orders, and charts for weekly/monthly trends.
- Competitor reference: Amazon Seller Central and Shopify admin panels both use KPI-first dashboards.

### 6.2 Admin Products Management
- Feature: Product moderation and catalog control.
- Action: Admin approves, edits, or deletes products.
- Activity: Search by product/vendor, filter by category, and apply cascade deletion when needed.
- Competitor reference: Daraz and Amazon both require strong moderation tools for marketplace quality.

### 6.3 Admin Banners Management
- Feature: Banner publishing and expiry management.
- Action: Admin reviews banner applications, confirms payment, and publishes them into hero/promo slots.
- Activity: Set title/subtitle/CTA, schedule expiry, and auto-remove expired banners.
- Competitor reference: Amazon and eBay use paid placement systems; we adapt this to a vendor-driven marketplace model.

### 6.4 Admin Orders Management
- Feature: Order operations and status updates.
- Action: Admin opens any order, reviews items, and changes delivery status.
- Activity: Advance orders through pending → processing → shipped → delivered/cancelled and trigger notifications.
- Competitor reference: Shopify admin and Amazon seller tools use order lifecycle control; we adapt it to multi-vendor operations.

### 6.5 Admin Vendors Management
- Feature: Vendor approval and quality control.
- Action: Admin reviews new applications, approves or rejects vendors, and suspends poor-performing vendors.
- Activity: Review CNIC photos and business information, create accounts, and enforce suspension rules.
- Competitor reference: Daraz and Alibaba both rely on seller verification and supplier quality controls.

### 6.6 Admin Pricing & Commission Management
- Feature: Platform pricing control.
- Action: Admin reviews price-change and discount requests and sets commission rates.
- Activity: Push approved changes live and ensure customer price always includes platform commission.
- Competitor reference: Alibaba uses negotiated supplier pricing; Amazon uses dynamic listing economics; our version is controlled and transparent.

### 6.7 Admin Settings
- Feature: Platform-wide configuration.
- Action: Admin updates website details, shipping rules, payment toggles, and notification settings.
- Activity: Save PKR currency settings, free-shipping thresholds, distance-based shipping, and gateway availability.
- Competitor reference: Shopify’s settings area is the model here, but adapted for Pakistan-specific shipping and payment realities.

---

## PHASE 7 — REAL-TIME INVENTORY, FEEDBACK & TRUST SYSTEMS *(Week 21–22)*
**Goal:** Add the operational trust loop from §8 and §9 so the marketplace feels reliable and live.

### 7.1 Real-Time Inventory Sync
- Feature: Shared stock view across customer, vendor, and admin panels.
- Action: Every order updates stock instantly; restock changes are approved before becoming live.
- Activity: Use transactional stock updates and WebSocket push updates for live dashboards.
- Competitor reference: Large marketplaces rely on real-time inventory; we implement this as a core product requirement, not an afterthought.

### 7.2 Low Stock & Flash Deal Eligibility
- Feature: Stock-threshold logic.
- Action: When stock is low, the product becomes eligible for flash-deal visibility and triggers admin alerts.
- Activity: Evaluate stock thresholds and push dynamic states to the storefront.
- Competitor reference: Temu and Daraz both use scarcity messaging to drive urgency.

### 7.3 Feedback & Rating Flow
- Feature: Post-delivery feedback collection.
- Action: After delivery, the customer can leave ratings for service, packaging, product quality, and overall experience.
- Activity: Save feedback, update product/vendor ratings, and surface them in shop filters and vendor summaries.
- Competitor reference: Amazon and Daraz rely heavily on ratings; this is a trust engine for the platform.

### 7.4 Complaint Handling Flow
- Feature: Wrong-product or damaged-item complaint system.
- Action: Customer selects a complaint reason and submits a problem report.
- Activity: Route complaints into the admin queue for refund/replacement handling and vendor quality review.
- Competitor reference: eBay and Amazon use structured dispute systems; we adapt this for a local marketplace environment.

---

## PHASE 8 — HARDENING, LAUNCH & GROWTH *(Week 23–24 and beyond)*
**Goal:** Turn the platform into a production-ready marketplace and prepare it for growth.

### 8.1 Security, Performance & Reliability
- Feature: Production hardening.
- Action: User experiences faster load times, safer payments, and more dependable checkout.
- Activity: Add caching, CDN, monitoring, backups, and security testing.
- Competitor reference: Shopify and Amazon both invest heavily in uptime and performance; this matters even more for mobile-first markets.

### 8.2 SEO, Mobile UX & Accessibility
- Feature: Discoverability and usability improvements.
- Action: Search engines and mobile customers can discover and use the platform efficiently.
- Activity: Add SEO metadata, schemas, responsive layouts, and accessible UI patterns.
- Competitor reference: Amazon and Daraz win partly through search visibility and mobile convenience.

### 8.3 Growth Features
- Feature: Retention and acquisition tools.
- Action: Users can receive referral rewards, affiliate links, coupons, and lifecycle emails.
- Activity: Build post-purchase engagement and campaign-based marketing workflows.
- Competitor reference: Temu and Amazon use referral and promotional loops; Shopify uses lifecycle marketing and retention systems.

---

## PHASE DEPENDENCY SUMMARY
1. Build the shell and roles first.
2. Add authentication and account trust.
3. Launch the customer storefront pages.
4. Add cart and checkout to create revenue flow.
5. Build vendor panel so sellers can participate.
6. Build admin panel so the marketplace can be governed.
7. Add inventory, feedback, and complaint systems for reliability.
8. Harden the platform and prepare growth features.

This sequence ensures that the platform is not built as a generic e-commerce site, but as a full marketplace with the customer journey, vendor operations, and admin governance all working together from the start.

---

## 14.9 REQUIREMENTS COVERAGE CHECKLIST & EXTRA IMPLEMENTATION DETAILS

The phases above cover the major customer, vendor, and admin journeys from §3 to §13. To make the plan more complete, the following implementation details are now explicitly included as part of the build scope.

### A. Cross-Page UI & Experience Requirements
- Every customer-facing page must include the same navbar, footer, cart badge, and consistent mobile-first layout.
- Every page must support loading states, empty states, validation errors, success toasts, and graceful fallback behavior.
- Every form must have both client-side validation and server-side validation for security and data integrity.
- Every major action must be logged for auditability, including admin approvals, deletions, suspensions, price changes, and settings updates.

### B. Authentication & Security Details
- Customer signup must enforce Pakistani phone validation, password strength, terms acceptance, CAPTCHA, email verification, and secure password reset.
- Vendor and admin portals must remain hidden from the customer experience and use separate role-based authentication.
- All payment-related actions must use tokenization for card data; no raw card numbers may be stored.
- RBAC must enforce that customers only access their own accounts/orders, vendors only their own products/orders, and admins can manage the platform-wide state.

### C. Customer Journey Details
- Home page must include banner carousel, promo banners, flash deals, featured products, new arrivals, category grid, trust strip, and footer links.
- Shop page must support category, price, brand, and rating filters; active filters must appear as removable chips; pagination must appear in the URL.
- Product detail page must support image gallery, stock state, quantity selection, Add to Cart, Buy Now, vendor/brand info, and review display.
- Cart and checkout must include a persistent order summary panel on every level, link-based progress, and live shipping/payment recalculation.
- Checkout must support COD, card, and wallet flows, plus a separate billing address option and rural landmark handling.
- Order confirmation and tracking must show order ID, delivery estimate, status timeline, and courier information where applicable.

### D. Vendor Journey Details
- Vendor onboarding must include a public application page, upload of CNIC images, business details, and clear approval status messaging.
- Vendor product creation must enforce category and brand selection and must require admin approval before listing.
- Vendor discounts, deals, and price changes must be routed through a review queue before they go live.
- Vendor banner applications must include duration, position, image, title, subtitle, and payment confirmation requirements.
- Vendor orders and stock views must show order status, sales totals, and pending stock-restock activities.

### E. Admin Journey Details
- Admin dashboard must show KPI cards, recent orders, and sales analytics.
- Admin product section must allow search, filtering, approval, editing, and delete actions with cascading removal from storefront/vendor views.
- Admin banners must support position-based publishing, expiry control, and automatic removal on schedule.
- Admin orders must support status progression and notification triggers.
- Admin vendors must support application review, approval/rejection, account creation, and suspensions.
- Admin pricing must control commissions and approve or reject vendor pricing/deal changes.
- Admin settings must control shipping rules, payment gateways, notification toggles, and platform identity.

### F. Operational & Trust-System Details
- Inventory must be synchronized in real time across customer, vendor, and admin panels.
- Orders must not oversell stock; stock changes must be atomic and protected by locking logic.
- Feedback and complaints must be captured after delivery and routed to product/vendor quality systems.
- Banner expiry, low-stock alerts, confirmation emails, and admin notifications must be handled through scheduled or event-driven jobs.
- The platform must be designed for Pakistan-specific delivery realities, including COD, wallets, PKR currency, provincial/city selection, and rural pickup terms.

### G. Additional Product Quality Requirements
- SEO metadata, structured product data, and clean URLs must be planned from the beginning, not treated as a later patch.
- The platform must be designed to support future growth features such as referrals, affiliate links, gift cards, Urdu localization, and vendor analytics.
- Launch readiness must include performance optimization, backup/restore testing, monitoring, and security hardening before public release.

This makes the roadmap more complete by covering both the visible pages and the hidden operational requirements that make the platform usable, secure, and scalable.

---

# 15. RISKS & MITIGATIONS

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | COD refusals / fake orders | High | Margin loss | Phone/OTP order confirmation; COD limits for new accounts; blacklist repeat refusers |
| 2 | Payment gateway/bank outages | Medium | Checkout blocked | Admin gateway toggles (§7.8) keep COD alive; multi-gateway fallback |
| 3 | Vendors listing counterfeit/poor products | Medium | Trust damage | Strict product approval, complaint tracking, suspension policy |
| 4 | Overselling under concurrent checkout | Medium | Cancelled orders | DB row locking + atomic transactions (§8) |
| 5 | Rural deliveries failing | Medium | Refunds, bad reviews | Landmark/branch-pickup flow with explicit customer confirmation of pickup terms |
| 6 | Admin approval queue becomes bottleneck | Medium | Vendor churn | SLA dashboards, bulk-approve tooling, and (later) trusted-vendor fast lanes |
| 7 | Data breach (customer PII / vendor CNIC) | Low | Severe legal/trust | §4.4 controls, private storage, pen test before launch, minimal data retention |
| 8 | Banner payment defaults | Medium | Revenue leakage | Prepay-only publishing; auto-expiry + manual delete on non-payment |
| 9 | Traffic spike crashes (11.11 etc.) | Medium | Lost sales | Load testing (P6), CDN, caching, horizontal scaling plan |
| 10 | Cart abandonment (~70% industry avg) | High | Lost revenue | Guest-friendly cart, minimal checkout fields, COD, abandoned-cart emails (P7) |

---

# 16. SUCCESS METRICS (KPIs)

| Area | KPI | Initial Target |
|---|---|---|
| Acquisition | Monthly visitors / signup conversion | 10k visits, ≥3% signup |
| Conversion | Checkout conversion (cart→order) | ≥ 25% |
| Revenue | GMV, commission revenue, banner revenue | Track from day 1 |
| Retention | Repeat purchase rate (90-day) | ≥ 20% |
| Vendors | Application→approval time | ≤ 5 business days (as promised) |
| Quality | Avg product rating / complaint rate | ≥ 4.0★ / < 5% of orders |
| Ops | Order→delivery time per tier | Within promised windows ≥ 90% |
| Reliability | Uptime / p95 API latency | ≥ 99.5% / < 300ms |

---

# 17. GLOSSARY

| Term | Meaning |
|---|---|
| **GMV** | Gross Merchandise Value — total value of goods sold on the platform |
| **COD** | Cash on Delivery |
| **BOGO** | Buy One Get One (free) deal type |
| **CTA** | Call To Action — the link/button a banner points to |
| **RBAC** | Role-Based Access Control |
| **Tokenization** | Replacing card data with a gateway-issued token so we never store card numbers |
| **CNIC** | Computerized National Identity Card (Pakistan) — vendor verification document |
| **Flash Deal** | Discounted, low-stock product promoted with urgency messaging |
| **Free-Shipping Threshold** | Cart value above which shipping is free (default PKR 5,000) |
| **Commission** | Platform's cut added on top of vendor base price (customer price = base + commission) |
| **SLA** | Service Level Agreement (e.g., vendor approval within 4–5 business days) |

---

*End of document — DUOBRO_research.md v1.0. Next step (separate discussion): coding kickoff per Phase 0 with React.js + Django + PostgreSQL.*
