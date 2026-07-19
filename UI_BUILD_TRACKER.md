# UI Build Tracker (Duo Bro Mart, matched to ShopNest reference)

Not part of the original PRD — my own working notes for this UI-matching
pass, so I don't lose track of design decisions or which pages still need
reference screenshots across a long multi-turn build. Source of truth for
*functionality/requirements* is still `DUOBROMART.md`; this file is purely
about visual/structural matching to the ShopNest Replit reference the user
shared, rebranded as Duo Bro Mart.

## Workflow

For each page/panel: user sends screenshots -> I build it to match -> I
name the next page I need screenshots for -> repeat. Order: customer pages
first, then vendor panel (incl. new Banner/Promotion section), then admin
panel (incl. Banner/Promotion changes).

## Design tokens extracted from ShopNest screenshots

- **Primary brand color** (logo, CTA buttons, links, "Become a Vendor" tile): warm terracotta/burnt-orange, ~`#C2703C` / Tailwind `orange-700`-ish. Hover: darker terracotta.
- **Accent gold** ("New Arrivals" tile, newsletter banner background): muted mustard/gold, ~`#D9A94E`.
- **Cream/off-white page background**: ~`#FDF6EE`.
- **Ink/near-black** (top border under header, "Best of [Brand]" section bg, footer bg): ~`#171512`.
- **Pill-shaped buttons** (fully rounded, not just rounded-md) for primary CTAs ("Shop Now", "Subscribe").
- **Cards**: white bg, subtle border, rounded-lg, soft shadow on hover.
- **Sale/discount badge**: solid red-600 pill, top-left of product image, e.g. "-50%".
- **Store icon**: house/shop outline icon next to wordmark, in brand color.
- Header: logo+name (left) — nav links (Home/Shop/Deals/Vendors) — search bar (flex-1, pill, magnifying glass icon) — Account (icon+label) — Cart (icon+label+badge count).
- Footer: 4 columns (brand blurb, Shop links, Support links, Business links) on near-black bg, then a bottom bar (copyright + Privacy/Terms/Cookie links).

## Mapping ShopNest nav/footer items -> our actual routes (per DUOBROMART.md §3.2)

- Nav "Vendors" -> `/become-a-vendor` (their top-nav "Vendors" plays the role our PRD gives "Become a Vendor")
- Footer "Become a Vendor" -> `/become-a-vendor`
- Footer "Vendor Terms" -> `/vendor-terms`
- Footer "Track Order" -> `/track-order`
- Footer bottom "Terms of Service" -> `/terms`
- Footer "Seller Dashboard" -> `/vendor/login` (their existing-vendor entry point)
- "Deals" nav -> `/shop?deals=1` (no separate Deals page in our route inventory)
- Footer "Privacy Policy" / "Cookie Policy" -> not in our 19-page inventory; rendered as footer links for now, real pages are a Phase 8 addition if the user wants them, not silently dropped

## Data note

Home page sections (Flash Deals, Top Selling, Best of Duo Bro Mart,
Categories) are built against **mock arrays** in the component for now —
matches the phase roadmap: real Product/Category models + APIs don't
exist until Phase 5/6 (vendor product management, admin approval). Mock
data is shaped so swapping in a real API call later is a small diff, not
a rewrite.

## Page status

| Page | Screenshots received | Built | Notes |
|---|---|---|---|
| Customer: Home | Yes (6 sections) | In progress | Hero carousel, promo tiles, flash deals w/ countdown, categories, top selling, dark "Best of" strip, trust strip, newsletter, footer |
| Customer: Shop | No | No | Next to request |
| Customer: Product Detail | No | No | |
| Customer: Cart | No | No | |
| Customer: Checkout (shipping/payment/confirmation) | No | No | |
| Customer: Account | No | No | Already functionally built (Phase 2), may need restyling to match |
| Vendor: Dashboard | No | No | |
| Vendor: Products | No | No | |
| Vendor: Orders | No | No | |
| Vendor: Settings | No | No | |
| Vendor: Banner/Promotion (NEW section, doesn't exist in ShopNest reference) | No | No | User wants this added — no reference exists, so this gets designed to match the rest of the vendor panel's style once that style is established |
| Admin: Dashboard | No | No | |
| Admin: Products | No | No | |
| Admin: Banner/Promotion (EXISTS in ShopNest, needs changes) | No | No | User wants "a few changes" — need specifics once we get here |
| Admin: Orders | No | No | |
| Admin: Vendors | No | No | |
| Admin: Settings | No | No | |
