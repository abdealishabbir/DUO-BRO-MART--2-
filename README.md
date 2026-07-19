# Duo Bro Mart — Multi-Vendor E-Commerce Platform

Pakistan-focused multi-vendor marketplace. React frontend, Django/DRF backend,
PostgreSQL, Redis. Full product/technical requirements live in
[`DUOBROMART.md`](./DUOBROMART.md) (PRD + R&D, v1.0).

## Status: Phase 2 — Authentication, Security & Account Foundation

Phase 1 (platform shell, routing, RBAC skeleton) is done — see git history.
Phase 2 adds real authentication end-to-end. Everything below was actually
run and verified (Django test suite + live curl integration tests against
a running dev server), not just written:

- **Customer signup/login** (§2.1): email+password, phone (PK format) and
  password-strength validation client- and server-side, duplicate-email
  rejection, terms-checkbox enforcement.
- **JWT auth via secure HttpOnly cookies**, not localStorage (§4.4.3) —
  `CookieJWTAuthentication` reads `dbm_access`/`dbm_refresh` cookies;
  access token auto-refreshes on 401 via the frontend's `api.js` wrapper.
- **Google Sign-In** (§2.2): backend verifies the ID token server-side
  (`google-auth`), links to an existing email account or creates a new
  one, prompts for phone number if missing. Renders only if
  `VITE_GOOGLE_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_ID` are configured — hidden
  otherwise rather than shown broken. Facebook follows the same shape once
  `FACEBOOK_APP_ID`/`SECRET` are set (not wired yet).
- **Forgot/reset password** (§2.3): 30-minute single-use token, identical
  response whether or not the email exists (no account enumeration),
  resetting a password blacklists every other active session.
- **Vendor & admin login** (§2.4): separate hidden endpoints/pages, reject
  wrong-role credentials even if otherwise valid, vendor forced
  first-login password change (`must_change_password`) enforced by both
  the API and a frontend route guard.
- **Customer Account page** (§2.5): profile edit, saved addresses
  (province/city/landmark for rural delivery), change password, order
  history placeholder (real data in Phase 4).
- **Security**: Argon2 password hashing, per-IP throttling on all
  auth-write endpoints, cache-based lockout after 5 failed logins in 15
  minutes, immutable single-use email-verification/reset tokens.
- **Dev-only `create_vendor_account` management command** stands in for
  the admin-approval flow (real UI arrives in Phase 6).

### Explicitly NOT in Phase 2 (by design, deferred with a comment at the
### point they'd be wired in)

- **reCAPTCHA on signup** — no-ops until real site/secret keys exist
  (Phase 8 hardening).
- **TOTP two-factor for admin** — "strongly recommended" per §4.3, not a
  hard requirement; deferred to Phase 8.
- **Facebook login** — same code shape as Google, not implemented yet.
- **Saved card tokenization** — that's Phase 4, once a payment gateway is
  actually chosen.
- **CSRF tokens** — DRF's `APIView` doesn't enforce Django session-based
  CSRF for non-`SessionAuthentication` requests (see comment in
  `authentication.py`); `SameSite=Lax` cookies are the primary mitigation
  for now. Full double-submit CSRF is a Phase 8 hardening candidate if
  the cookie's SameSite policy ever needs loosening for a subdomain setup.

## Getting started

```bash
git clone <this-repo>
cd duobromart
cp .env.example .env   # then edit .env with real local secrets
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/health/
- Django admin: http://localhost:8000/django-admin/ (create a superuser first:
  `docker compose exec backend python manage.py createsuperuser` — this
  automatically gets `role=admin`, so it also works for `/admin/login` in
  the React app, not just `/django-admin/`)
- Create a test vendor account: `docker compose exec backend python manage.py create_vendor_account vendor@example.com --name "Vendor Name"`
  (prints a temp password to the console since `EMAIL_BACKEND` defaults to
  console output in dev)
- Run the backend test suite: `docker compose exec backend python manage.py test apps.accounts` —
  or locally without Docker: `DJANGO_SETTINGS_MODULE=config.settings_test python manage.py test apps.accounts`
  (uses SQLite + local-memory cache so it doesn't need Postgres/Redis running)

## Repo layout

```
duobromart/
├── DUOBROMART.md        # PRD + R&D (source of truth for all requirements)
├── docker-compose.yml
├── .env.example
├── backend/              # Django + DRF
│   ├── config/           # settings, settings_test (SQLite/locmem for CI), urls, wsgi, asgi
│   └── apps/
│       ├── accounts/     # User model, RBAC, auth views/serializers/tests, Address, tokens
│       └── core/         # shared / health check
└── frontend/              # React + Vite + Tailwind
    └── src/
        ├── auth/          # AuthContext — real backend-wired session state
        ├── lib/           # api.js — fetch wrapper with cookie auth + auto-refresh
        ├── routes/        # CustomerRoutes, VendorRoutes, AdminRoutes, RoleRoute guard
        ├── layouts/        # CustomerLayout, VendorLayout, AdminLayout
        ├── components/     # FormField, GoogleSignInButton, PagePlaceholder
        └── pages/          # customer/, vendor/, admin/ — real Phase 2 auth pages, rest still placeholders
```

## Branching (per the dev checklist)

Suggested branches going forward: `main`, `develop`, `feature/auth`,
`feature/customer-ui`, `feature/vendor-panel`, `feature/admin-panel`. Phase
1 and Phase 2 both landed directly on `main` as foundational commits; from
Phase 3 onward, work should branch off `develop`.

## Next up: Phase 3 — Customer Storefront Pages

Home page (hero/promo banners, flash deals, featured, new arrivals,
categories grid, trust strip), Shop page (filters, pagination), Product
Detail page, Terms pages. See PRD §5 and §14 Phase 3 for full detail.
