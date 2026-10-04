# Pixel Directory

A scrollable web directory of brands and advertisements. Brands appear as cards of different sizes, mixed together on one frosted-glass wall that fills the window. Visitors search at the top, scroll to load more cards, and click a card to open its full details. Admins manage brands, card sizes and prices, metadata fields, users, roles and permissions, and they can see click metrics for each brand. Users who have been allocated a brand can edit its content and pay to upgrade its card size.

| | |
|---|---|
| **Frontend** | Next.js 16 (App Router, React 19, TypeScript). Plain CSS glassmorphism design with light and dark themes |
| **Backend** | NestJS 12 (TypeScript, ESM), Mongoose 9, JWT in an httpOnly cookie |
| **Database** | MongoDB 7 |
| **Ops** | Docker Compose for local use. A separate production setup has Caddy (automatic HTTPS) and a standalone database stack |

---

## Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Repository layout](#repository-layout)
4. [Run locally with Docker (recommended)](#run-locally-with-docker-recommended)
5. [Run locally without Docker](#run-locally-without-docker)
6. [Configuration reference](#configuration-reference)
7. [Roles and permissions](#roles-and-permissions)
8. [Card sizes, prices and payments](#card-sizes-prices-and-payments)
9. [Metadata fields](#metadata-fields)
10. [API reference](#api-reference)
11. [Live (production) deployment](#live-production-deployment)
12. [Operations: updates, backups, logs](#operations-updates-backups-logs)
13. [Security notes](#security-notes)
14. [Troubleshooting](#troubleshooting)
15. [Known limitations and next steps](#known-limitations-and-next-steps)

---

## Features

**Public directory**
- A wall of brand cards in **four default sizes**: Small 1×1, Wide 2×1, Tall 1×2 and Large 2×2. Admins can add more sizes, up to 4×4. Sizes and brands come from the database.
- Cards are placed in a **mixed, shuffled order**. Each visit gets a new shuffle that stays stable while paging, so no card repeats or goes missing. CSS grid `dense` packing fills the gaps.
- **Lazy loading**: more cards load as you near the bottom (infinite scroll).
- **Search bar** at the top. Results are listed by name and description, matching text is highlighted, and the list also lazy-loads. The query is kept in the URL (`/?q=coffee`), so results can be linked.
- **Click a card** to open an enlarged glass dialog showing the banner, logo, description, phone numbers, email, website, address, tags, gallery and any metadata fields. Each open counts as a click in the metrics.
- **Light and dark themes**. The toggle saves your choice in a cookie. Without a saved choice, the site follows the browser or OS colour-scheme setting, applied before the first paint so the page doesn't flash the wrong theme.
- **Responsive** from phone width up to large desktop screens.

**Accounts and access**
- Sign up and sign in. New sign-ups get the role marked as the *sign-up default*.
- **Dynamic role-based access**: admins create, edit, **soft-delete** and restore roles, and decide which permissions each role has. They can also create custom permission keys and assign a role to each user.

**Admin**
- Overview dashboard: click totals, a chart of clicks per day (7/30/90 days, with a table view) and the most-clicked brands.
- Brands: list, search and filter, create, edit, **activate or deactivate**, delete, **resize freely**, **allocate to users**, and view **per-brand click metrics**.
- Card sizes and **price tiers**.
- Shared metadata field definitions.
- Users: assign roles, activate or deactivate accounts.
- Payments: list of payments and total revenue.

**Brand owners** (users allocated to a brand)
- "My brands" lists the brands allocated to them, with their click metrics.
- They can edit the description, images (logo, banner, gallery), contacts, tags, accent colour and metadata.
- To **upgrade a card size**, they pay the price difference through checkout. Moving to a size that costs the same or less is free and applies immediately.

---

## Architecture

```
                 ┌──────────────────────────── browser ────────────────────────────┐
                 │  same origin: pages, /api/*, /uploads/*  (httpOnly auth cookie)  │
                 └───────────────────────────────┬──────────────────────────────────┘
 local:  Next.js (port 3000) proxies /api and /uploads to the backend
 live:   Caddy (443) sends /api and /uploads to the backend, everything else to Next.js
                                                 │
                ┌────────────────────┐   ┌───────┴────────────┐       ┌──────────────┐
                │ frontend (Next.js) │   │ backend (NestJS)   │──────▶│  MongoDB 7   │
                │ standalone server  │   │ /api, /uploads     │       │ (own host in │
                └────────────────────┘   │ uploads volume     │       │  production) │
                                         └────────────────────┘       └──────────────┘
```

- The browser only talks to **one origin**, so the auth cookie is `httpOnly` and `SameSite=Lax` and no CORS setup is needed.
- On every request the API resolves the user's role and permissions from the database, so changes to roles apply immediately.
- The API checks every permission itself. The UI only uses permissions to decide what to show.

---

## Repository layout

```
.
├── docker-compose.yml          # LOCAL stack: mongo + backend + frontend
├── .env.example                # optional overrides for the local stack
├── docker-compose.override.example.yml  # opt-in: publish MongoDB on the host
├── backend/                    # NestJS API
│   ├── Dockerfile
│   └── src/
│       ├── main.ts             # bootstrap: /api prefix, cookies, validation, /uploads static
│       ├── config.ts           # all environment variables
│       ├── common/             # auth guard, permission catalog, decorators, helpers (+ unit tests)
│       ├── schemas/            # Mongoose models (users, roles, permissions, brands, …)
│       ├── auth/  users/  roles/  card-sizes/  metadata-fields/
│       ├── brands/             # public feed & search, admin CRUD, owner editing, metrics
│       ├── payments/           # checkout + mock gateway
│       ├── uploads/            # image upload (content-sniffed)
│       └── seed/               # idempotent bootstrap + optional demo data
├── frontend/                   # Next.js app
│   ├── Dockerfile
│   └── src/
│       ├── app/                # routes: /, /signin, /signup, /dashboard/*, /admin/*
│       ├── components/         # BrandGrid, BrandDialog, BrandForm, ClicksChart, Header, …
│       └── lib/                # api client, auth context, theme, types
└── deploy/                     # LIVE deployment
    ├── docker-compose.prod.yml # app host: caddy + frontend + backend
    ├── docker-compose.db.yml   # database host: MongoDB with auth
    ├── Caddyfile
    ├── mongo-init/01-app-user.js
    ├── .env.prod.example
    └── .env.db.example
```

---

## Run locally with Docker (recommended)

**Requirements:** Docker 24+ with the Compose plugin.

```bash
git clone <this repo> pixel_directory_web
cd pixel_directory_web
docker compose up --build
```

Open **http://localhost:3000**. The first build downloads dependencies and takes a few minutes. Later builds use the cache.

The local stack seeds itself on first start:

| Account | Email | Password | What it shows |
|---|---|---|---|
| Admin | `admin@pixel.local` | `Admin@12345` | everything under **Admin** |
| Demo member | `member@pixel.local` | `Member@12345` | **My brands** with 3 allocated brands, editing, upgrade checkout |

It also seeds 36 demo brands with a month of synthetic clicks, the four default card sizes and four sample metadata fields.

**Change ports or credentials:** copy `.env.example` to `.env` and edit it. Example:

```bash
cp .env.example .env
# WEB_PORT=8080, API_PORT=8081, ADMIN_PASSWORD=…, SEED_DEMO_DATA=false
docker compose up -d --build
```

| URL | What |
|---|---|
| `http://localhost:3000` | the website |
| `http://localhost:4000/api/health` | API health (bound to 127.0.0.1) |

MongoDB is **not published on the host** by default, so it won't clash with another MongoDB you already run. To open a shell, run `docker compose exec mongo mongosh pixel_directory`. To connect with Compass, enable the override:

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
echo "MONGO_PORT=27018" >> .env            # any free port
docker compose up -d                       # then connect to mongodb://localhost:27018/pixel_directory
```

Useful commands:

```bash
docker compose logs -f backend      # follow API logs
docker compose down                 # stop (keeps data)
docker compose down -v              # stop AND wipe database + uploads (fresh demo on next start)
```

> Demo data is only inserted when the `brands` collection is empty. To re-seed, run `docker compose down -v`.

---

## Run locally without Docker

**Requirements:** Node.js 24 and a MongoDB 7 you can reach (for example `docker run -d -p 27017:27017 mongo:7`). If 27017 is taken, map another port (`-p 27018:27017`) and start the API with `MONGODB_URI=mongodb://localhost:27018/pixel_directory`.

```bash
# 1. API (http://localhost:4000)
cd backend
npm ci
SEED_DEMO_DATA=true npm run start:dev        # watches and recompiles
npm test                                     # unit tests (vitest)

# 2. Web (http://localhost:3000), in another terminal
cd frontend
npm ci
npm run dev                                  # proxies /api to http://localhost:4000
```

If the API runs somewhere else, set `BACKEND_URL` (for example `BACKEND_URL=http://localhost:4100 npm run dev`). `next dev` and `next start` read it at startup. The Docker image reads it at **build** time (see [Troubleshooting](#troubleshooting)).

---

## Configuration reference

### Backend (environment variables)

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `4000` | |
| `MONGODB_URI` | `mongodb://localhost:27017/pixel_directory` | |
| `JWT_SECRET` | dev placeholder | **Required in production** (the API refuses to start without it). Use a long random value. |
| `JWT_EXPIRES_IN_SECONDS` | `604800` (7 days) | Session lifetime |
| `AUTH_COOKIE_NAME` | `pd_token` | |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS (the production compose file does) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated. Only matters if the API is called cross-origin |
| `UPLOAD_DIR` | `./uploads` (`/app/uploads` in Docker) | Uploaded images. Mount a volume here |
| `MAX_UPLOAD_MB` | `5` | Per image |
| `CURRENCY` | `USD` | ISO code used for prices and payments |
| `PAYMENT_PROVIDER` | `mock` | Only `mock` is implemented (see [Payments](#card-sizes-prices-and-payments)) |
| `SEED_ON_START` | `true` | Make sure permissions, roles, default sizes and the admin exist on every start (idempotent) |
| `SEED_DEMO_DATA` | `false` (`true` in local compose) | Adds demo brands, clicks and the demo member when there are no brands |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `Administrator` / `admin@pixel.local` / `Admin@12345` | First admin, created only if no user has the Admin role |

### Frontend

| Variable | Default | Notes |
|---|---|---|
| `BACKEND_URL` | `http://localhost:4000` | Target of the `/api` and `/uploads` rewrites. It is a **build arg** in Docker (`http://backend:4000`) |

---

## Roles and permissions

Every user has **one role**. A role is a named list of permission keys. Roles are stored in the database and admins manage them under **Admin → Roles & permissions**:

- **Create or edit** a role and tick its permissions (grouped for readability).
- **Soft-delete** a role. Its users immediately lose those permissions, but the role stays in the database. **Restore** gives them back. The system *Admin* role and the current sign-up default can't be deleted.
- **Sign-up default**: exactly one role is given to new sign-ups (by default, *Member*).
- **Custom permissions**: you can add new permission keys (for example `reports.export`) and assign them to roles. The built-in keys below are the ones the API enforces. Custom keys are for your own conventions or for features you add later.
- **Assign roles to users** under **Admin → Users**. Admins can't change their own role or deactivate themselves, so they can't lock themselves out.

### Built-in permissions

| Key | Allows |
|---|---|
| `brands.read` | Open the admin brand list and brand pages |
| `brands.create` | Create brands |
| `brands.update` | Edit any brand's content |
| `brands.status` | Activate or deactivate brands |
| `brands.resize` | Change a brand's card size **without payment** |
| `brands.assign` | Allocate brands to users |
| `brands.delete` | Delete brands (soft delete) |
| `own-brands.read` | See "My brands" (brands allocated to me) |
| `own-brands.update` | Edit content of my brands |
| `own-brands.metrics` | See click metrics of my brands |
| `metrics.view` | Admin overview and metrics for every brand |
| `card-sizes.manage` | Manage card sizes and prices |
| `metadata-fields.manage` | Manage shared metadata fields |
| `users.manage` | Manage users (roles, active flag) |
| `roles.manage` | Manage roles and permissions |
| `payments.create` | Pay to change card sizes |
| `payments.view` | See all payments |
| `uploads.create` | Upload images |

### Seeded roles

| Role | Permissions |
|---|---|
| **Admin** (system) | `*` (everything) |
| **Member** (sign-up default) | `own-brands.read`, `own-brands.update`, `own-brands.metrics`, `payments.create`, `uploads.create` |

Example: an "Editor" role with `brands.read`, `brands.update` and `brands.status` can edit any brand and switch it on or off. It can't resize, allocate or delete brands, and the API rejects those changes even if someone calls it directly.

**Allocating brands:** on a brand's admin page, under *Placement & access*, search for users and add them as owners. This needs `brands.assign`.

---

## Card sizes, prices and payments

- Each card size has a **footprint** (columns × rows, 1–4 each), a **price**, a sort order, and an *available* flag.
- **Admins** (`brands.resize`) can set any brand to any size, free of charge.
- **Owners** change size from *My brands → (brand) → Card size*:
  - **More expensive size** → they pay the **difference** (`new price − current price`) at checkout, and the size changes once the payment succeeds.
  - **Same price or cheaper** → applied immediately, nothing to pay.
- An existing pending checkout for the same change is reused, so repeated clicks don't pile up payments.
- Sizes that brands still use can't be deleted. Hide them instead (untick *Available*).

### Mock payment gateway

Only a **mock gateway** ships for now (`PAYMENT_PROVIDER=mock`). The checkout page clearly says it is in test mode.

| Card number | Result |
|---|---|
| `4242 4242 4242 4242` (or anything else) | Payment succeeds |
| `4000 0000 0000 0002` | Payment is declined (marked `failed`) |

**Adding a real gateway** (Stripe, PayHere, PayPal, …): the code is already set up for it in `backend/src/payments/payments.service.ts`.
1. Implement the `PaymentProvider` interface. `startCheckout()` creates the hosted checkout session and returns its URL.
2. Add a public webhook endpoint that verifies the provider's signature and calls `markPaid(paymentId)`. That call atomically moves the payment from `pending` to `paid` and applies the new size.
3. Select the provider with `PAYMENT_PROVIDER`.

Don't use the mock gateway for real money.

---

## Metadata fields

Brands can carry extra details beyond the fixed fields:

- **Shared fields** (*Admin → Metadata fields*, `metadata-fields.manage`) appear on **every** brand form. Each has a label, key, type (`text`, `textarea`, `url`, `phone`, `email`, `number`) and order. Seeded examples: Opening hours, Instagram, Facebook, WhatsApp.
- **Custom fields**: on any brand form, owners and admins can click **Add custom field** to add a label, type and value that belong to that brand only.

Filled-in values appear in the brand dialog. URLs, phone numbers and email addresses become links (only `http(s)` URLs are ever turned into links). Deleting a shared field keeps the values brands already saved; they become custom fields of those brands.

---

## API reference

All routes are under `/api`. Auth uses the `pd_token` httpOnly cookie that sign-in sets (an `Authorization: Bearer <jwt>` header also works). Validation errors return `400` with a `message` array.

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /health` | public | Liveness + DB status |
| `POST /auth/signup` · `POST /auth/signin` · `POST /auth/signout` | public | Sessions |
| `GET /auth/me` | public | Current user + permissions (or `null`) |
| `GET /public/brands?page&limit&seed&q` | public | Shuffled feed (`seed`) or search (`q`) |
| `GET /public/brands/:idOrSlug` | public | Brand details (active brands only) |
| `POST /public/brands/:id/click` | public | Record a click |
| `GET /card-sizes` | public | Available sizes + prices |
| `GET /metadata-fields` | signed in | Active shared field definitions |
| `GET/POST /admin/brands`, `GET/PATCH/DELETE /admin/brands/:id` | `brands.*` | Admin brand management (field-level checks for status/resize/assign/update) |
| `GET /admin/brands/:id/metrics?days` · `GET /admin/metrics/summary?days` | `metrics.view` | Metrics |
| `GET /my/brands`, `GET/PATCH /my/brands/:id`, `GET /my/brands/:id/metrics` | `own-brands.*` | Owner area |
| `POST /payments/checkout` · `GET /payments/:id` · `POST /payments/:id/confirm` · `POST /payments/:id/cancel` | `payments.create` | Size upgrades |
| `GET /my/payments` | signed in | My payment history |
| `GET /admin/payments?status` | `payments.view` | All payments + revenue |
| `GET/POST/PATCH/DELETE /admin/card-sizes[/:id]` | `card-sizes.manage` | Price tiers |
| `GET/POST/PATCH/DELETE /admin/metadata-fields[/:id]` | `metadata-fields.manage` | Shared fields |
| `GET /admin/users` · `PATCH /admin/users/:id` · `GET /admin/users/roles` | `users.manage` | Users & role assignment |
| `GET /admin/users/lookup?q` | `brands.assign` | User search when allocating brands |
| `GET/POST/PATCH/DELETE /admin/roles[/:id]` · `POST /admin/roles/:id/restore` | `roles.manage` | Roles (soft delete/restore) |
| `GET/POST/PATCH/DELETE /admin/permissions[/:id]` | `roles.manage` | Permission catalog |
| `POST /uploads` (multipart `file`) | `uploads.create` | Upload an image → `{ url }` |

---

## Live (production) deployment

In production the **app and the database run as two separate Docker stacks**, usually on two hosts:

```
           Internet ──443/80──▶  APP HOST  (deploy/docker-compose.prod.yml)
                                  caddy ─▶ frontend
                                        └▶ backend ──private network 27017──▶  DB HOST (deploy/docker-compose.db.yml)
                                                                                MongoDB 7, auth on, private IP only
```

The DB host can be replaced with a managed MongoDB such as **MongoDB Atlas**. In that case skip step 1 and put the Atlas connection string in `MONGODB_URI`.

### Prerequisites

- Two Linux servers (or VMs) with Docker 24+ and the Compose plugin. A single server also works, see the note at the end of this section.
- A **private network** between them (cloud VPC, LAN, or WireGuard).
- A domain whose DNS **A/AAAA record points to the app host**. Ports **80 and 443** must be open on the app host so Caddy can get certificates from Let's Encrypt.
- On the DB host, the firewall allows port **27017 from the app host only**.

### 1. Database host

```bash
git clone <this repo> pixel_directory_web && cd pixel_directory_web/deploy
cp .env.db.example .env.db
nano .env.db          # set MONGO_BIND_IP to this host's PRIVATE IP and strong passwords
docker compose -f docker-compose.db.yml --env-file .env.db up -d
docker compose -f docker-compose.db.yml --env-file .env.db logs mongo | grep "Created application user"
```

- MongoDB runs with **authentication on**. On first start, `mongo-init/01-app-user.js` creates a **least-privilege user** with `readWrite` on the app database only. The app connects as that user, never as root.
- The port is published only on `MONGO_BIND_IP`. Don't use `0.0.0.0` or a public IP.
- The init script runs only when the data volume is empty. To change the app password later, use `mongosh` as root (`db.getSiblingDB('pixel_directory').changeUserPassword(...)`).

### 2. App host

```bash
git clone <this repo> pixel_directory_web && cd pixel_directory_web/deploy
cp .env.prod.example .env
nano .env
```

Set at least:

```dotenv
DOMAIN=directory.example.com
ACME_EMAIL=ops@example.com
MONGODB_URI=mongodb://pixel_app:<APP_DB_PASSWORD>@<DB_PRIVATE_IP>:27017/pixel_directory?authSource=pixel_directory
JWT_SECRET=<output of: openssl rand -base64 48>
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<strong password>
```

Then build and start:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml --env-file .env ps        # all services healthy/up
curl https://directory.example.com/api/health                       # {"ok":true,"db":"up"}
```

Open `https://<DOMAIN>` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. The production stack **doesn't** load demo data (`SEED_DEMO_DATA=false`). The four default card sizes, the Admin and Member roles, and your admin account are created on first start.

What the production stack sets up for you:
- Automatic HTTPS from Let's Encrypt (Caddy), with HTTP redirected to HTTPS and certificates renewed automatically.
- HSTS, `nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy` headers.
- `COOKIE_SECURE=true`, so the session cookie is only sent over HTTPS.
- Upload size capped at the proxy (`MAX_UPLOAD_MB`).
- Uploaded images stored in the `uploads` Docker volume on the app host.
- Rotating container logs.

> **Single server?** You can run both stacks on one machine. Set `MONGO_BIND_IP` to the Docker bridge address (usually `172.17.0.1`) and use that address in `MONGODB_URI`. Keep port 27017 closed in the server firewall.

---

## Operations: updates, backups, logs

**Deploy a new version** (app host):

```bash
cd pixel_directory_web && git pull
cd deploy && docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker image prune -f
```

**Back up the database** (DB host):

```bash
docker compose -f docker-compose.db.yml --env-file .env.db exec -T mongo \
  sh -c 'mongodump --archive --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' \
  > backup-$(date +%F).archive.gz
```

Restore with `mongorestore --archive --gzip --drop …`, piping the file into the same `exec -T` command.

**Back up uploaded images** (app host):

```bash
docker run --rm -v pixel-directory-app_uploads:/data -v "$PWD":/out alpine tar czf /out/uploads-$(date +%F).tgz -C /data .
```

**Logs:** `docker compose -f docker-compose.prod.yml --env-file .env logs -f backend` (or `caddy`, `frontend`).

---

## Security notes

- Passwords are hashed with bcrypt (cost 12). Sessions are signed JWTs in an `httpOnly`, `SameSite=Lax` cookie, `Secure` in production.
- Every request body is validated with whitelisting (unknown fields are dropped). For example, an owner can't change `cardSize` or `active` through the owner endpoint.
- Image and link URLs are restricted to `http(s)` or the app's own `/uploads/…` paths, so `javascript:` URLs are rejected. Uploads are checked by their **file signature** (JPG, PNG, GIF, WEBP, AVIF), get random names, and are served with `nosniff`.
- Search input is regex-escaped before it reaches MongoDB.
- Post-login redirects only accept same-site relative paths.
- Production refuses to start with the default `JWT_SECRET`.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Website loads but shows *"The service is unavailable"* or API calls return 500 | The frontend can't reach the API. In Docker, check `docker compose logs backend`. Outside Docker, start the API and make sure `BACKEND_URL` is correct. |
| Changed `BACKEND_URL` but the Docker frontend still uses the old one | The rewrites are compiled into the standalone image. Rebuild: `docker compose build frontend`. |
| `port is already allocated` | Another service uses 3000 or 4000 (or `MONGO_PORT` if you enabled the Mongo override). Set `WEB_PORT`, `API_PORT` or `MONGO_PORT` in `.env`, then run `docker compose up -d` again. |
| Caddy keeps restarting | `DOMAIN` or `ACME_EMAIL` is missing, or DNS doesn't point to the host yet. Check `docker compose … logs caddy`. |
| App host can't connect to MongoDB | Check `MONGO_BIND_IP` (private IP), the DB host firewall, and the `authSource` and password in `MONGODB_URI`. URL-encode special characters in the password. |
| No demo brands locally | Demo data only loads into an empty database. Run `docker compose down -v`, then `up` again. |
| Forgot the admin password | In mongosh, delete that user (`db.users.deleteOne({ email: '…' })`) and restart the backend. If no user has the Admin role any more, the seeder creates `ADMIN_EMAIL` with `ADMIN_PASSWORD`. Their brand allocations must be redone. |

---

## Known limitations and next steps

- **Payments use a mock gateway.** Connect a real provider before charging customers (see [Payments](#card-sizes-prices-and-payments)).
- **Uploads are stored on the app host's disk.** To run more than one backend instance, move uploads to object storage (S3, R2, GCS) or a shared volume.
- **Click counting has no rate limit or bot filtering.** Add a rate limit at the proxy or in the API if exact numbers matter.
- No email verification or password reset yet.
- Search uses case-insensitive substring matching, which is fine for thousands of brands. For much larger data, switch to MongoDB Atlas Search or a text index.
