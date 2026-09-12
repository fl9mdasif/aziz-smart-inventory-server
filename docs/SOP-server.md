---
title: SOP - Aziz Brothers Smart Inventory Server
base_repo: D:\aziz brothers\developed producs\Aziz-smart-inventory\aziz-server
stack: Node.js + Express 5 + TypeScript + MongoDB (Mongoose) + Zod validation
companion: aziz-inventory-prd-server.md (read this first, especially §12 the audit)
---

# SOP: Aziz Brothers Smart Inventory Server

## Goal

Turn the existing (partially broken) `aziz-server` repo into a working internal inventory system: staff/admin record offline sales, watch stock levels, and browse the catalog, while the public sees a read-only "what's available" view. Do not start from zero, most of the hard scaffolding already exists and works, the job is fixing what's stale and building what's missing.

## Don't start from zero, but don't trust it blindly either

This repo was scaffolded from HydraaZone/Sultan Bazar. Some of that carried over correctly (auth, category, the product low-stock auto-status logic, the activity log, security middleware, superAdmin seeding), some of it is unedited e-commerce leftovers that will actively break the build or don't fit an offline-sale business (`app.ts`, `routes/index.ts`, the entire `order` module). The PRD's §12 lists every one of these findings by file. Read it before writing a line of code, that's the actual current state, not a guess.

## Step-by-step workflow

1. **Phase 0 first, no exceptions.** Confirm the project actually builds (`npm run build`) before doing anything else. It currently won't, `routes/index.ts` imports five modules that don't exist. Strip the dead imports back to the five real modules (`auth`, `category`, `order`, `product`, `activity`), fix `app.ts`'s CORS allowlist and root-route string, rename the `user` role to `staff` in `const.auth.ts` / `interface.auth.ts` / `model.auth.ts`, drop `savedAddresses`/`address` from the `User` schema. Confirm the app boots locally and the existing superAdmin seed still runs.
2. **Rebuild the `order` module** exactly per PRD §5.4: new interface/model/validation, updated controller/service. Keep the file-shape convention (`controller.order.ts`, `service.order.ts`, `model.order.ts`, `interface.order.ts`, `route.order.ts`, `validation.order.ts`) — don't rename files, don't restructure the folder. Fix the duplicate `findByIdAndUpdate` calls while you're in this file.
3. **Build the new `user` module** (User Management) following the same five/six-file shape as every other module. Role-gate: `admin`/`superAdmin` can create/deactivate staff, only `superAdmin` can promote to `admin`.
4. **Extend `auth`**, don't create a separate `settings` module: add `me` / `update-profile` / `change-password` controllers/services/routes inside the existing `auth` folder, wired at `/auth/me` etc.
5. **Wire the public homepage path**: add an `optionalAuth` middleware (decodes a token if present, doesn't reject if absent, per PRD §7 of v1.0's original design), apply it to `GET /products` and shape the response down for anonymous callers. Confirm `GET /categories` needs no auth at all.
6. **Extend sales analytics, don't build a Sales module.** Add `top-products` and `by-category` alongside the existing `analytics/sales` route, all three inside `order`'s controller/service/route files. If you catch yourself creating a `src/app/modules/sales/` folder, stop, that's explicitly not what the owner asked for.
7. **Re-test the owner's own smoke test** against the new Order shape once everything above is done, then update `README.md` / `SERVER-ARCHITECTURE.md` to drop the HydraaZone branding leftovers.

## Definition of done (per phase)

Builds clean with `npm run build`, the specific PRD acceptance-checklist lines for that phase pass, no module outside `order`'s own three files was touched to add sales analytics, roles are gated exactly per the PRD §6.1 table, nothing that already worked (auth login, category CRUD, low-stock auto-status) regresses.

## What's explicitly out of scope

Online checkout/payment of any kind, multi-warehouse support, SMS/email notifications, a `Product` → `Variant` split (unless the owner explicitly asks for it later, see PRD §5.3), profit-margin/cost-price reporting (see PRD §12.5), building a real S3 image-upload flow unless the owner confirms he wants product photos now (PRD §12.6, manual URLs are fine short-term).
