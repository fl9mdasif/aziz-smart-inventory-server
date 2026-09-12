---
title: PRD - Aziz Brothers Smart Inventory Management System (Server)
stack: Node.js + Express 5 + TypeScript + MongoDB (Mongoose) + Zod validation
version: 2.0 (merged) - supersedes Aziz-Brothers-Smart-Inventory-PRD.md v1.0
base_repo: D:\aziz brothers\developed producs\Aziz-smart-inventory\aziz-server (audited 2026-09-12)
---

# PRD: Aziz Brothers Smart Inventory Management System (Server) — v2.0

This replaces v1.0. It keeps every part of the old PRD that the current codebase already implements well, drops the parts that don't match how the business actually works, and adds what the owner (Asif) asked for in the latest brief. Section 12 below is a direct audit of the real repo — read it before writing any code, several things in the current repo are broken or leftover from the HydraaZone project it was scaffolded from.

## 1. What this system is

Aziz Brothers imports and distributes rubber sheet rolls, fusing belts, and garment/sewing-machine supplies from China. This system replaces manual/paper tracking with: a public homepage that shows what's currently available (so a customer can see stock and come buy it in person), and an internal dashboard where staff/admin manage the catalog, record sales, and watch stock levels.

**Critical business fact that shapes the whole design: every sale is offline.** No online checkout, no payment gateway, no shipping. A staff member records a sale after the customer has already paid in person. This is the single biggest way this system differs from a normal e-commerce order flow, and it's the main thing the current codebase gets wrong (see §12.3).

## 2. Roles

`staff`, `admin`, `superAdmin` — seeded, no public self-registration.

| Role | Can do |
|---|---|
| Staff | View dashboard, categories, products, place/record orders (sales), view low-stock list, view inventory activity log, update own profile/password |
| Admin | Everything staff can, plus: create/edit/delete categories & products, delete orders, manage users (create/deactivate staff), view full order history (not just today's) |
| SuperAdmin | Everything admin can, plus: promote/demote admin accounts, system-level settings |

This is simpler than v1.0's role matrix (which had staff as view-only). Asif's instruction is explicit: staff can place orders. Keep the permission check centralized in one place (a small `permissions.ts` map, per v1.0 §7) rather than scattering role arrays across route files, so this is easy to adjust later.

## 3. Public homepage requirement (new in v2.0)

Anonymous visitors need a way to browse what's currently in stock, with "available now, come buy it" messaging. Offline sale only — no cart, no checkout, no online payment anywhere on the public side.

- `GET /products` is already public in the current code (no `auth()` on that route) — reuse it as-is.
- Add lightweight public-safe shaping: the public response should show name, slug, thumbnail, category, price, and a simple availability flag (in stock / low stock / out of stock derived from `status`), nothing else needs hiding since the current `Product` model has no internal-only field like a cost price. If a `costPrice` field is added later (see §12.5), it must never appear in the public response — use an `optionalAuth` middleware (v1.0 §7) so the same route can also return the full internal document to a logged-in staff/admin session, rather than building two separate endpoints.
- `GET /categories` (already public) powers a homepage filter/browse-by-category view.
- No new "public" module is needed. This is a response-shaping concern on the existing product/category routes, not a new resource.

## 4. Navigation / module map (as specified by the owner)

```
General
  - Dashboard
  - Category
  - Inventory / Product        (display product)

Tracking
  - Order                      (which orders staff/admin placed)
  - Sales                      (total sales tracking & analysis — daily/weekly/monthly/yearly)
  - Low Stock Quantity
  - Inventory Activity

Management
  - User Management
  - Settings                   (profile update, change password)
```

Server-side mapping of this nav to actual modules/endpoints:

| Nav item | Backend reality |
|---|---|
| Dashboard | **No new module.** Client aggregates existing endpoints (product count, `restock-queue` count, order analytics summary, recent activity feed). Zero new server code, matching the Sales approach below. |
| Category | Existing `category` module, reused as-is |
| Inventory / Product | Existing `product` module, reused as-is (minor cleanup, §12.5) |
| Order | The `order` module, **rebuilt** as a sale-recording entity, not a shipping order (§5, §12.3) |
| Sales | **No dedicated module, no new server code.** Pure client-side visualization over the existing order-analytics endpoint (extended, not replaced — §6.2). This is explicit per the owner's instruction. |
| Low Stock Quantity | Existing `GET /products/restock-queue`, reused as-is |
| Inventory Activity | Existing `activity` module, reused as-is |
| User Management | **New module** — doesn't exist in the current repo despite being imported in `routes/index.ts` (§12.1) |
| Settings | **New, small** — extend the `auth` module with `me` / `update-profile` / `change-password` endpoints, not a whole separate CRUD module |

## 5. Data model changes

### 5.1 User (`auth` module) — modify existing

Keep the model, drop the e-commerce leftovers, rename the generic role:

- `role`: `'staff' | 'admin' | 'superAdmin'` (rename `user` → `staff` in `USER_ROLE`, the interface, and the schema enum)
- **Remove**: `savedAddresses`, `address` (customer-shipping fields, not relevant to an internal staff account)
- **Keep**: `username`, `email`, `contactNumber`, `password`, `profilePicture?`, `isBlocked`, `passwordChangedAt`
- **Add**: `createdBy?` (ref User) so admin/superAdmin can see who created which staff account

### 5.2 Category — no change

Already correct: `name`, `slug`, `description?`, `thumbnail?`, `isActive`. Reuse as-is.

### 5.3 Product — mostly no change (one open decision, see §12.5)

Already correct and already has the auto status-management logic (`active` / `low_stock` / `out_of_stock` on save and on update) which is exactly what "Low Stock Quantity" tracking needs. Keep: `name`, `slug`, `description`, `thumbnail`, `category`, `price`, `status`, `stockQuantity`, `minStockThreshold`, `restockIgnored`.

**Open decision, needs the owner's confirmation before building further**: the current model is flat (one Product = one sellable item, no variant/SKU level). The original v1.0 PRD proposed a `Product` → `Variant` split so a single rubber-sheet product could carry multiple widths/lengths as SKUs. The current, working code does not have this. **Recommendation: keep the flat model for v1** (it's what's built, it's what "Inventory/Product - display product" describes, and each width/size can simply be its own `Product` row under the same `Category` in the meantime). Revisit variants only if the owner explicitly says he needs one product with multiple sub-SKUs tracked under a single detail page.

### 5.4 Order (`order` module) — rebuild, this is the biggest change

The current `Order` model is a copy of HydraaZone's customer-checkout order (`shippingAddress`, `pending → confirmed → shipped → delivered` lifecycle, `cod`/`bkash`/`card` payment methods, a "duplicate active order" guard). None of that fits an offline sale a staff member types in after the fact. Rebuild it as a sale record:

```ts
interface TOrder {
  productId: Types.ObjectId;
  productName: string;        // snapshot at time of sale
  quantity: number;
  unitPrice: number;          // snapshot of Product.price at time of sale
  discount?: number;          // default 0
  totalAmount: number;        // (unitPrice * quantity) - discount
  customerName?: string;      // optional, free text — walk-in customer's name if given, not a full shipping profile
  customerContact?: string;   // optional, free text — phone number if given
  note?: string;
  status: 'completed' | 'cancelled';   // no shipping pipeline — a sale either happened or was voided
  cancelledAt?: Date;
  cancelReason?: string;
  performedBy: Types.ObjectId; // ref User — which staff/admin recorded this sale
}
```

Drop: `shippingAddress` (and its sub-schema), the `pending/confirmed/shipped/delivered/returned` statuses, `PAYMENT_METHOD`/`PAYMENT_STATUS` consts (unused already, and irrelevant to a cash sale), the "duplicate active order for same product" guard (that guard exists to stop a customer double-clicking checkout — it makes no sense when staff are manually entering completed sales and can legitimately record two separate sales of the same product in a day).

Keep from the existing service logic: stock validation before recording (reject if `quantity > stockQuantity`), the stock-deduction-on-create + auto status recompute (fix the duplicate double-`findByIdAndUpdate` call noted in §12.3, it's harmless but wasteful), stock-restoration-on-cancel, and the Activity log write on every create/cancel.

`statusHistory` can be dropped entirely — with only two possible states (`completed`, `cancelled`) and one transition, a full history sub-document is unnecessary; `cancelledAt` + `cancelReason` already capture what happened.

### 5.5 Activity — no change

Already correct and generic (`type: 'order' | 'product' | 'system'`). Reuse as-is. Optionally add `'user'` and `'auth'` to the type enum once User Management exists, so staff-account changes show up in the same feed.

## 6. API design

### 6.1 Endpoints — new/changed only (everything not listed here is unchanged from the current code)

| Method & path | Role | Change |
|---|---|---|
| `POST /orders` | staff, admin, superAdmin | Was admin-only. Body drops `shippingAddress`, adds optional `customerName`/`customerContact`/`note`. `performedBy` set from the authenticated user, not the body. |
| `GET /orders` | staff, admin, superAdmin | Staff sees all orders (per owner's instruction — no restriction to "today only" like v1.0 proposed), filter/search unchanged in shape |
| `PATCH /orders/:orderId/cancel` | admin, superAdmin | Replaces `PATCH /orders/:orderId/status` — there's no longer a status pipeline to walk through, just a completed→cancelled transition. Staff cannot cancel their own recorded sales (prevents quiet revenue hiding); admin/superAdmin only. |
| `DELETE /orders/:orderId` | admin, superAdmin | Unchanged in role, logic simplified to match the new model (no `delivered`/`returned` branching) |
| `GET /orders/analytics/sales` | admin, superAdmin | Kept and extended (§6.2) — this is the one and only "sales" endpoint, it is a sub-route of `order`, not a separate module |
| `GET /products` | public (optionalAuth) | Response shaped down for anonymous callers per §3 |
| `POST /users`, `GET /users`, `PATCH /users/:id`, `PATCH /users/:id/deactivate` | admin, superAdmin (role promotion to `admin`/`superAdmin` itself: superAdmin only) | New `user` module |
| `GET /auth/me` | any authenticated role | New — returns the logged-in user's own profile |
| `PATCH /auth/update-profile` | any authenticated role | New — update own `username`/`email`/`contactNumber`/`profilePicture` |
| `PATCH /auth/change-password` | any authenticated role | New — requires current password + new password |

### 6.2 Sales analytics endpoint (the only backend surface "Sales" gets)

Extend the existing `getSalesAnalytics` service rather than building a new module:

- `GET /orders/analytics/sales?period=daily|weekly|monthly|yearly&from=&to=`
- Match `status: 'completed'` (not `'delivered'`, since that status no longer exists)
- Return the same shape as today (`{ date, revenue, orders }[]`), plus add two more aggregations the client will want for a real sales page: `GET /orders/analytics/top-products?period=` (group by `productId`, sum quantity/revenue, sort desc, limit) and `GET /orders/analytics/by-category?period=` (join through `productId → category`, sum revenue). All three live under `/orders/analytics/*`, all three are aggregation queries over the `Order` collection, none of them are a new collection, model, or module. This is what "client-side visual, no server code" means in practice: the *presentation* (charts, date-range pickers, drill-downs) is 100% client-side; the three thin aggregation endpoints above are the minimum data access needed and stay inside the `order` module.

## 7. Security (unchanged from the established pattern, carried over from HydraaZone/v1.0)

helmet, express-rate-limit (especially on `/auth/login`), a Mongo-injection sanitizer (the repo already has a custom `sanitizeInput` middleware, not `express-mongo-sanitize` — keep using it, it's what `SERVER-ARCHITECTURE.md` recommends and why), bcrypt password hashing (already wired), short-lived JWT access token + refresh flow (already wired), Zod validation on every mutating route, centralized `AppError` + `globalErrorHandler` (already wired, don't touch), CORS allowlist (needs updating, §12.2).

## 8. Tech stack

Unchanged from what's already installed: Express 5, TypeScript, Mongoose 8, Zod 4, JWT, bcrypt, express-rate-limit, helmet, cookie-parser, dotenv. No AWS SDK usage exists yet even though it's in `package.json` — see §12.6 for the product-image question.

## 9. Build phases

**Phase 0 — Fix what's broken (must happen before any feature work, see §12):** rewrite `app.ts` and `src/app/routes/index.ts` (currently reference five modules that don't exist and would fail to build), fix branding leftovers, update CORS allowlist, rename the `user` role to `staff` across `const.auth.ts` / `interface.auth.ts` / `model.auth.ts`, strip customer-only fields from the `User` model.

**Phase 1 — Rebuild Order as a sale record:** new `interface.order.ts` / `model.order.ts` / `validation.order.ts` per §5.4, update `controller.order.ts` / `service.order.ts` (fix the double-update bug while you're in there), open `POST /orders` to `staff`.

**Phase 2 — User Management + Settings:** build the new `user` module (list/create/deactivate staff, role-gated), extend `auth` with `me` / `update-profile` / `change-password`.

**Phase 3 — Public homepage support:** `optionalAuth` middleware, response shaping on `GET /products`, confirm `GET /categories` is public.

**Phase 4 — Sales analytics extension:** add `top-products` and `by-category` aggregations under `/orders/analytics/*` per §6.2.

**Phase 5 — QA & deploy:** re-run the owner's own smoke test against the new Order shape, confirm Vercel + Atlas free-tier config still matches (§10 of v1.0, unchanged), seed one `staff` and one `admin` account alongside the existing superAdmin seed for testing.

## 10. Non-functional requirements (carried over from v1.0, unchanged)

MongoDB Atlas M0 free tier, Vercel Hobby serverless deploy (cold starts acceptable), indexes on `Product.status`/`stockQuantity`, `Order.createdAt`/`status`, `User.role`.

## 11. Acceptance checklist

- [ ] `app.ts` and `routes/index.ts` reference only modules that actually exist; project builds clean (`npm run build`)
- [ ] Roles are `staff` / `admin` / `superAdmin` everywhere (const, interface, schema, seed) — no leftover `user` role
- [ ] `POST /orders` works for staff and admin/superAdmin, deducts stock exactly once, logs one Activity entry
- [ ] `PATCH /orders/:id/cancel` restores stock, admin/superAdmin only
- [ ] `GET /products` returns a public-safe shape with no auth header, and the full document with a valid staff/admin token
- [ ] `GET /orders/analytics/sales|top-products|by-category` all read from `Order` only, no new collection created for "sales"
- [ ] User Management: admin/superAdmin can create a staff account, deactivate one, and only superAdmin can promote to admin
- [ ] `/auth/me`, `/auth/update-profile`, `/auth/change-password` work end to end
- [ ] Low-stock and out-of-stock statuses still auto-update correctly on every stock change (existing pre-save/pre-update hooks untouched)
- [ ] CORS allowlist points at Aziz Brothers' real domain(s), not `hydraazone.com`

## 12. Codebase audit (read before starting Phase 0)

This is what the actual `aziz-server` repo looks like as of 2026-09-12, checked file by file. Nothing here is guesswork.

**12.1 — `app.ts` and `routes/index.ts` are still the HydraaZone files, unedited.** `routes/index.ts` imports `user`, `cart`, `upload`, `wishlist`, `settings`, `review` modules — **none of these folders exist** in `src/app/modules/` (only `activity`, `auth`, `category`, `order`, `product` exist). This file will not compile as-is. `app.ts`'s root route also still says `"hydraazone-server is running...."`. This must be the very first fix, before touching any feature.

**12.2 — CORS allowlist is still HydraaZone's.** `allowedOrigins` in `app.ts` lists `localhost:3000`, `hydraazone.com`, `www.hydraazone.com`. Needs Aziz Brothers' real production domain once known (ask the owner), plus whatever `localhost` port the Aziz frontend runs on.

**12.3 — The `Order` model and its whole service layer are a copy of HydraaZone's e-commerce checkout order**, not an internal sale record: it requires a full Bangladeshi `shippingAddress`, has a `pending → confirmed → shipped → delivered/cancelled/returned` lifecycle, defines (unused) `cod`/`bkash`/`card` payment methods, and blocks a second order on a product while one is "pending." None of this matches "staff/admin records an offline sale." This is why §5.4 rebuilds it rather than extending it. Also found: `service.order.ts` calls `Product.findByIdAndUpdate(...)` twice in a row with identical arguments in three separate places (`createOrder`, `updateOrderStatus`'s cancel branch, `deleteOrder`) — a harmless but wasteful duplicate write, fix it while rebuilding.

**12.4 — README.md and SERVER-ARCHITECTURE.md are also unedited HydraaZone docs** (title says "HydraaZone Server," stack table mentions Plunk email and an `upload` module neither of which exist in this repo). Low priority, but update them once Phase 0 is done so they don't mislead whoever (or whichever AI agent) reads them next.

**12.5 — `Product` has no `costPrice` field**, only `price` (the sell price). v1.0's PRD assumed a cost/sell split for margin reporting. The owner's latest brief didn't ask for profit-margin analytics, so this PRD does not add it — flagging it here only so it's a deliberate omission, not an oversight, if margin reporting comes up later.

**12.6 — No image-upload module exists yet.** `product.thumbnail` is a plain string URL field with no way to populate it — `package.json` has the AWS SDK installed (leftover from the HydraaZone copy) but no `upload` module was ever built here. Before "Inventory/Product" can have real product photos, either port over HydraaZone's S3 presigned-upload pattern (`controller.upload.ts`) or the owner manually hosts images elsewhere and pastes URLs. Not blocking for v1 if manual URLs are acceptable short-term.

**12.7 — `User` role seeding already uses `superAdmin` casing** (`const.auth.ts`: `user | admin | superAdmin`), which matches the owner's latest instruction exactly — the only change needed is renaming the generic `user` role to `staff`, not a full re-casing exercise like v1.0 flagged as a risk.

**12.8 — `superAdmin` seeding on boot already works** (`src/app/db/index.ts`, runs in `server.ts` before `app.listen`). Reuse as-is; just add a similar one-time seed (or a manual `POST /users` call) for a test `staff` and `admin` account.
