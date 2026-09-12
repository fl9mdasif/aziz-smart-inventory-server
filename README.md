<div align="center">

# Aziz Brothers — Smart Inventory Server

**Internal inventory & offline-sales management API for Aziz Brothers**

![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/license-Proprietary-lightgrey)

</div>

---

## Overview

Aziz Brothers imports and distributes rubber sheet rolls, fusing belts, and garment/sewing-machine supplies. This service is the backend for their internal inventory system, replacing manual/paper tracking with:

- A **public catalog** — anonymous visitors can browse what's currently in stock ("available now, come buy it in person").
- An **internal dashboard API** — staff and admins manage categories and products, record sales, monitor stock levels, and review activity history.

**Every sale is offline.** A staff member records a sale *after* the customer has already paid in person at the counter. There is no cart, no online checkout, no payment gateway integration, and no shipping — this is the single biggest thing that distinguishes this system from a typical e-commerce backend, and it shapes the data model throughout.

> 📄 Full requirements and the original build audit live in [`docs/PRD-server.md`](docs/PRD-server.md). The step-by-step implementation workflow lives in [`docs/SOP-server.md`](docs/SOP-server.md). This README documents how to run and use the server as it exists today.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Server](#running-the-server)
- [Roles & Permissions](#roles--permissions)
- [API Reference](#api-reference)
- [Response & Error Format](#response--error-format)
- [Security](#security)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)
- [Contributing Conventions](#contributing-conventions)

---

## Features

- 📦 **Catalog management** — categories and products with slugs, search, filtering, and pagination
- 📉 **Automatic stock status** — `active` / `low_stock` / `out_of_stock` recomputed on every stock change, plus a dedicated restock queue sorted by urgency
- 🧾 **Offline sale recording** — staff record a sale in seconds; price and product name are snapshotted so historical records never drift if the catalog changes later
- 📊 **Sales analytics** — revenue and order counts by day/week/month/year, top-selling products, and revenue by category
- 🕒 **Activity feed** — a running log of catalog, sale, and staff-account changes
- 👥 **Role-based staff management** — `staff` / `admin` / `superAdmin`, with role promotion gated to `superAdmin`
- 🌐 **Public storefront view** — the same product/category endpoints serve a shaped-down, public-safe response to anonymous visitors and the full document to an authenticated session

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 5 |
| Language | TypeScript (`strict` mode) |
| Database | MongoDB via Mongoose |
| Validation | Zod, via a `validateRequest` middleware wired per-route |
| Auth | JWT (access + refresh tokens), bcrypt password hashing |
| Security | `helmet`, `express-rate-limit`, a hand-written Mongo-injection sanitizer |

Product photos are plain URL strings (`Product.thumbnail`) — paste a hosted image link. There is no upload pipeline wired up yet; see [Known Limitations](#known-limitations).

---

## Project Structure

```
src/
├── app.ts                      # Express app: security middleware, CORS, route mounting
├── server.ts                   # Entry point: DB connect, superAdmin seed, listen
└── app/
    ├── config/                 # Single source of truth for env vars
    ├── db/                     # One-time superAdmin seed, run on boot
    ├── errors/                 # AppError class
    ├── middlewares/            # auth, optionalAuth, validateRequest, sanitizeInput,
    │                           # rateLimiters, and the error-handling chain
    ├── routes/index.ts         # Mounts every module's router under /api/v1
    ├── utils/                  # catchAsync, sendResponse, jwt helpers
    └── modules/
        ├── auth/               # register, login, tokens, profile, password
        ├── user/                # staff/admin account management
        ├── category/            # catalog categories
        ├── product/              # catalog products + stock + restock queue
        ├── order/                 # offline sale records + analytics
        └── activity/               # read-only event feed
```

Each module follows the same shape:

| File | Responsibility |
|---|---|
| `interface.<name>.ts` | TypeScript types for the module |
| `model.<name>.ts` | Mongoose schema (`{ timestamps: true }`) |
| `validation.<name>.ts` | Zod request schemas |
| `service.<name>.ts` | All business logic and database access |
| `controller.<name>.ts` | Thin HTTP layer, wrapped in `catchAsync` |
| `route.<name>.ts` (or `router.<name>.ts`) | Express router, wires `auth`/`validateRequest` per endpoint |

Controllers never talk to the database directly; every response goes through `response.createSendResponse` / `response.getSendResponse`; every thrown error is an `AppError`, caught centrally by `globalErrorHandler`; every protected route names its allowed roles explicitly (`auth(USER_ROLE.staff, USER_ROLE.admin, USER_ROLE.superAdmin)`).

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- A MongoDB connection string (Atlas free tier or self-hosted)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

| Variable | Required | Description |
|---|:---:|---|
| `NODE_ENV` | | `production` enables secure, `httpOnly`, `sameSite` cookies |
| `PORT` | | HTTP port, defaults to `5000` |
| `DATABASE_URL` | ✅ | MongoDB connection string |
| `BCRYPT_SALT_ROUND` | ✅ | e.g. `12` |
| `SUPER_ADMIN_PASS` | ✅ | Password for the auto-seeded `superAdmin` account |
| `JWT_ACCESS_SECRET` | ✅ | Signing secret for access tokens |
| `JWT_REFRESH_SECRET` | ✅ | Signing secret for refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | ✅ | e.g. `10d` |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | e.g. `100d` |

Any other keys present in `.env` (`ADMIN_EMAIL`, `PLUNK_SECRET_KEY`, etc.) are unused leftovers from the template this project was scaffolded from and can be left blank.

### Running the Server

```bash
npm run dev      # ts-node-dev, auto-restarts on file change
npm run build    # type-checks and compiles to dist/
npm start        # runs the compiled build (dist/server.js)
```

On first boot, the server connects to MongoDB and seeds a `superAdmin` account (`superAdmin@gmail.com`, password from `SUPER_ADMIN_PASS`) if one doesn't already exist. The API is mounted under `/api/v1`.

---

## Roles & Permissions

Accounts are seeded/created internally — there is no public self-registration.

| Role | Permissions |
|---|---|
| **staff** | View categories, products, low-stock list, and activity feed; record sales; manage own profile and password |
| **admin** | Everything `staff` can, plus: create/edit/delete categories and products; cancel or delete sales; manage staff accounts; view full sales analytics |
| **superAdmin** | Everything `admin` can, plus: promote or demote `admin` accounts |

---

## API Reference

Base URL: `/api/v1` · All request/response bodies are JSON · Authenticated requests send `Authorization: <accessToken>` (the raw JWT — no `Bearer ` prefix).

<details>
<summary><strong>Auth</strong> — <code>/auth</code></summary>

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | — | Create an account |
| `POST` | `/login` | — | Returns an access token; sets auth cookies |
| `GET` | `/me` | any | Get the caller's own profile |
| `PATCH` | `/update-profile` | any | Update own `username` / `email` / `contactNumber` / `profilePicture` |
| `POST` | `/change-password` | any | Requires current + new password |
| `POST` | `/logout` | — | Clears auth cookies |
| `POST` | `/refresh-token` | — | Reads the `refreshToken` cookie, issues a new access token |

</details>

<details>
<summary><strong>Users</strong> (staff/admin account management) — <code>/users</code></summary>

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/` | admin, superAdmin | Create a staff account (promoting straight to `admin` requires `superAdmin`) |
| `GET` | `/` | admin, superAdmin | List accounts (search, paginate) |
| `GET` | `/:userId` | admin, superAdmin | Get one account |
| `PATCH` | `/:userId` | admin, superAdmin | Update an account (role changes require `superAdmin`) |
| `PATCH` | `/:userId/deactivate` | admin, superAdmin | Block an account from logging in |

</details>

<details>
<summary><strong>Categories</strong> — <code>/categories</code></summary>

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/`, `/:categoryId` | public | Browse categories |
| `POST` | `/` | admin, superAdmin | Create a category |
| `PATCH` | `/:categoryId`, `/:categoryId/toggle-status` | admin, superAdmin | Update / activate-deactivate |
| `DELETE` | `/:categoryId` | admin, superAdmin | Delete |

</details>

<details>
<summary><strong>Products</strong> — <code>/products</code></summary>

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/`, `/:idOrSlug` | public* | Browse / view a product |
| `GET` | `/restock-queue` | admin, superAdmin | Products at or below their stock threshold, ranked by urgency |
| `POST` | `/` | admin, superAdmin | Create a product |
| `PATCH` | `/:productId` | admin, superAdmin | Update fields / stock |
| `DELETE` | `/:productId` | admin, superAdmin | Delete |

\* Optionally authenticated: an anonymous caller gets a shaped-down public response (`name`, `slug`, `thumbnail`, `category`, `price`, `availability`); a logged-in staff/admin session gets the full document.

Stock status (`active` / `low_stock` / `out_of_stock`) is recomputed automatically whenever `stockQuantity` changes, based on `minStockThreshold`.

</details>

<details>
<summary><strong>Orders (sales)</strong> — <code>/orders</code></summary>

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/` | staff, admin, superAdmin | Record a completed offline sale; deducts stock |
| `GET` | `/` | staff, admin, superAdmin | List sales (search, filter, paginate) |
| `GET` | `/:orderId` | staff, admin, superAdmin | Sale detail |
| `PATCH` | `/:orderId/cancel` | admin, superAdmin | Void a sale, restore stock |
| `DELETE` | `/:orderId` | admin, superAdmin | Delete a sale record |
| `GET` | `/analytics/sales?period=daily\|weekly\|monthly\|yearly&from=&to=` | admin, superAdmin | Revenue & order counts over time |
| `GET` | `/analytics/top-products?limit=` | admin, superAdmin | Best-selling products by revenue |
| `GET` | `/analytics/by-category` | admin, superAdmin | Revenue grouped by category |

An order is a **sale record**, not an e-commerce checkout — no shipping address, no payment gateway, no multi-step lifecycle. `status` is either `completed` or `cancelled`. `productName` and `unitPrice` are snapshotted at the moment of sale, so a historical record never changes if the product is edited or repriced afterward.

</details>

<details>
<summary><strong>Activity</strong> — <code>/activity</code></summary>

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | staff, admin, superAdmin | Recent catalog / sale / staff-account events, newest first |

</details>

---

## Response & Error Format

Every successful response follows the same envelope:

```jsonc
{
  "success": true,
  "statusCode": 200,
  "message": "Products retrieved successfully",
  "data": { /* ... */ },
  "meta": { "page": 1, "limit": 20, "total": 42 } // present on paginated list endpoints only
}
```

Errors are normalized the same way regardless of source (`AppError`, Zod, or a Mongoose cast/validation/duplicate-key error):

```jsonc
{
  "success": false,
  "statusCode": 400,
  "message": "Quantity must be at least 1",
  "errorDetails": { "statusCode": 400 }
}
```

---

## Security

- JWT authentication with explicit per-route role checks (`middlewares/auth.ts`); bcrypt-hashed passwords; `passwordChangedAt` invalidates tokens issued before a password change
- `optionalAuth` on public catalog routes decodes a token if present but never rejects an anonymous request
- `helmet()` for standard security headers
- `express-rate-limit` limiters available for auth and high-volume write endpoints (`middlewares/rateLimiters.ts`)
- Zod validation (`validateRequest`) on every mutating route
- A **hand-written** Mongo-injection sanitizer (`middlewares/sanitizeInput.ts`) strips `$`-prefixed and dotted keys from `req.body` / `req.params`. `express-mongo-sanitize` is intentionally **not** used — it reassigns `req.query`, which is a read-only getter under Express 5 and throws at request time
- CORS allowlist in `app.ts` — update it with Aziz Brothers' real production domain(s) before deploying to production

---

## Deployment

| Target | How |
|---|---|
| **Docker** | `Dockerfile` + `docker-compose.yml` build and run the compiled server (`npm run build && npm start`) on port `5000`, reading secrets from `.env` |
| **Vercel** | `vercel.json` routes all traffic to the compiled `dist/server.js` via `@vercel/node`. Run `npm run build` before deploying, or let Vercel's build step handle it |

Recommended non-functional baseline: MongoDB Atlas M0 (free tier) is sufficient for this workload; indexes already exist on `Product.status`/`stockQuantity`, `Order.createdAt`/`status`, and `User.role`.

---

## Known Limitations

- **No image-upload pipeline.** `product.thumbnail` is a plain URL string — paste a manually-hosted image link. `@aws-sdk/*` packages are installed but unused; wiring up S3 pre-signed uploads is a future enhancement, not required for v1.
- **No automated test suite yet.** Verify changes with `npm run build` (type-checking) plus manual smoke testing against a real MongoDB instance.

---

## Contributing Conventions

- Follow the existing five/six-file module shape for any new feature — don't invent a different structure.
- Business logic belongs in `service.<name>.ts`, never in the controller.
- Every protected route must name its allowed roles explicitly; a route with no `auth()` at all should be a deliberate, reviewed decision.
- After adding a module, confirm it's wired into `routes/index.ts` — an unmounted module is a silent no-op bug that has happened before on this stack.
- Keep this README and [`docs/PRD-server.md`](docs/PRD-server.md) in sync with what's actually built; update them as part of the change, not as an afterthought.

---

<div align="center">

Internal project — Aziz Brothers. Not for public distribution.

</div>
