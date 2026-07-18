# Duo Bro Mart — Multi-Vendor E-Commerce Platform

Pakistan-focused multi-vendor marketplace. React frontend, Django/DRF backend,
PostgreSQL, Redis. Full product/technical requirements live in
[`DUOBROMART.md`](./DUOBROMART.md) (PRD + R&D, v1.0).

## Status: Phase 1 — Platform Shell, Routing & Role Entry

Per the phase-wise roadmap in the PRD (§14) and the dev checklist we're
following, nothing beyond Phase 1 is built yet — no real auth, no storefront
data, no vendor/admin functionality. What **is** done:

- **Repo/monorepo layout**: `backend/` (Django) and `frontend/` (React) as
  clearly separated folders, per the pre-implementation checklist.
- **Docker Compose stack**: Postgres, Redis, Django, React dev server — one
  command boots the full local environment.
- **Custom `User` model with a `role` field** (`customer` / `vendor` /
  `admin`) — the single source of truth every RBAC check in this codebase
  keys off. Initial migration is generated and included.
- **DRF permission classes** (`IsCustomerRole`, `IsVendorRole`, `IsAdminRole`,
  `IsOwnerOrAdmin`, `ReadOnlyOrIsAdmin`) — not wired to any endpoints yet
  (there are none besides the health check), but ready for Phase 2+ views.
- **React route shell** for all 19 pages in the PRD's page inventory (§3.2),
  each a wired placeholder that names which phase builds it for real.
- **Three route trees**: customer (default, at `/`), vendor (hidden, at
  `/vendor/*`), admin (hidden, at `/admin/*`) — matching the routing rule in
  §3.2 that normal visitors always land on the customer experience.
- **Role-based route guard** (`RoleRoute`) protecting `/vendor/*` and
  `/admin/*` subtrees, backed by a mock `AuthContext` (in-memory only, no
  real login yet — that's Phase 2).
- **Mobile-first layouts**: shared customer navbar/footer with a hamburger
  menu below `md`, separate vendor/admin sidebar shells.

### Explicitly NOT in Phase 1 (by design, per the roadmap)

- Real authentication (signup/login/social/password reset) — Phase 2.
- Any storefront content, cart, checkout, vendor or admin functionality.
- Celery workers, WebSocket consumers (Channels) — reserved in config,
  wired up in Phase 7.

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
  `docker compose exec backend python manage.py createsuperuser`)

## Repo layout

```
duobromart/
├── DUOBROMART.md        # PRD + R&D (source of truth for all requirements)
├── docker-compose.yml
├── .env.example
├── backend/              # Django + DRF
│   ├── config/           # settings, urls, wsgi, asgi
│   └── apps/
│       ├── accounts/     # custom User model + RBAC permission classes
│       └── core/         # shared / health check
└── frontend/              # React + Vite + Tailwind
    └── src/
        ├── auth/          # AuthContext (mock — replaced in Phase 2)
        ├── routes/        # CustomerRoutes, VendorRoutes, AdminRoutes, RoleRoute guard
        ├── layouts/        # CustomerLayout, VendorLayout, AdminLayout
        └── pages/          # customer/, vendor/, admin/ placeholder pages
```

## Branching (per the dev checklist)

Suggested branches going forward: `main`, `develop`, `feature/auth`,
`feature/customer-ui`, `feature/vendor-panel`, `feature/admin-panel`. This
Phase 1 commit lands directly on `main` as the project's foundation; from
Phase 2 onward, work should branch off `develop`.

## Next up: Phase 2 — Authentication, Security & Account Foundation

Customer signup/login (email + Google/Facebook), forgot-password flow,
vendor/admin login pages with real credential checks, first-login forced
password change for vendors, and the customer Account page. See PRD §4 and
§14 Phase 2 for full detail.
