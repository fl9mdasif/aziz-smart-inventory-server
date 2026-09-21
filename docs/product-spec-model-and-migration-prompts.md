# Aziz Brothers, Product Field Model (v2, trimmed to exactly what's needed)

Only the fields below. Nothing else gets added without you asking for it.

## Product level

| Field | Type | Notes |
|---|---|---|
| `modelNo` | string, uppercase | search key |
| `name` | string | search key |
| `brand` | string, optional | select on client, see below |
| `moq` | string | e.g. `"1 PC"` |
| `samplesAvailable` | boolean | |
| `transportPackage` | string, optional | select on client, see below |
| `origin` | string | select on client, see below |
| `hsCode` | string | |
| `note` | string, optional | free text remarks box |

`category`, `slug`, `description`, `thumbnail` stay too, those already exist on the current product model and this change doesn't touch them.

## Variant level (per size)

| Field | Type | Notes |
|---|---|---|
| `sku` | string | `<MODEL>-<thickness>x<width>`, generated server-side |
| `thickness` | number, mm | search key |
| `width` | number, mm | search key |
| `length` | number, mm | |
| `sizeLabel` | string, derived | e.g. `"0.4mm x 6000mm"`, computed server-side, never typed |
| `price` | number | |
| `stockQuantity` | number | default 0 |
| `minStockThreshold` | number | default 5 |

## About the three "select on client" fields

`brand`, `transportPackage`, and `origin` stay plain strings in the database, not a fixed enum, because the supplier list will keep growing (today it's K-fab and Jiangsu Fuyuan, tomorrow it's someone else) and a hardcoded enum means a code change every time a new one shows up. On the client, render them as a searchable dropdown (a combobox): it lists the distinct values already used across existing products, plus an "add new" option when typing something that isn't in the list yet. That gives you select-style consistency without ever blocking a new value. If you'd rather have a genuinely fixed, short list instead (e.g. origin really is always going to be China for the foreseeable future), say so and it becomes a real enum, that's a one-line change either way.

## Example

```json
{
  "modelNo": "KB040B",
  "name": "PTFE Fusing Machine Belt",
  "brand": "K-fab",
  "moq": "1 PC",
  "samplesAvailable": true,
  "transportPackage": "Carton",
  "origin": "China",
  "hsCode": "7019590000",
  "note": "",
  "variants": [
    {
      "sku": "KB040B-0.4x6000",
      "thickness": 0.4,
      "width": 6000,
      "length": 1450,
      "sizeLabel": "0.4mm x 6000mm",
      "price": 340,
      "stockQuantity": 32,
      "minStockThreshold": 5
    }
  ]
}
```

---

# Implementation prompts (server, then client)

Grounded in the actual current code in `src/app/modules/product/` (read directly, not assumed). Paste each block into a coding session that has that repo open.

## SERVER PROMPT (aziz-server)

```
Context: the Product module at src/app/modules/product/ is currently FLAT: one
Product document IS the sellable unit, with price and stockQuantity directly
on it (interface.product.ts, model.product.ts, validation.product.ts,
router.product.ts). Change it to product + variants: a product carries
identity/commercial info once, and each size (variant) carries its own
price and stock.

Read every file in src/app/modules/product/ first (controller, service,
model, interface, validation, router) and match the existing code's exact
style: one folder per feature, files named controller.<name>.ts /
service.<name>.ts / model.<name>.ts / interface.<name>.ts /
router.<name>.ts / validation.<name>.ts, Zod validation via
validateRequest, auth(USER_ROLE.admin, USER_ROLE.superAdmin) on mutating
routes, catchAsync + sendResponse + AppError, optionalAuth on the public
read routes. Do not restructure the folder or rename files.

1. interface.product.ts:

   Keep unchanged: name, slug, description, thumbnail, category.

   Add to TProduct, all as plain strings/booleans (not enums, see point 3):
     modelNo: string (required, unique, store uppercase)
     brand?: string
     moq?: string
     samplesAvailable?: boolean
     transportPackage?: string
     origin?: string
     hsCode?: string
     note?: string

   Remove from product level, these move to the variant: price,
   stockQuantity, minStockThreshold, restockIgnored.

   Add a TVariant interface:
     sku: string          // unique across the whole collection, not just one product
     thickness: number     // mm, this is what the business calls "height", use this name only
     width: number          // mm
     length: number          // mm
     sizeLabel: string        // derived server-side from thickness+width, e.g. "0.4mm x 6000mm"
     price: number
     stockQuantity: number (default 0)
     minStockThreshold: number (default 5)
     status: TProductStatus   // moved here from product level
     restockIgnored: boolean (default false, moved here)

   TProduct gets: variants: TVariant[] (min length 1, enforced in validation).

2. model.product.ts: add a variantSchema subdocument array on Product. Move
   the existing auto-status pre-save logic (out_of_stock / low_stock / active
   based on stockQuantity vs minStockThreshold) so it runs per variant
   instead of per product, iterate this.variants and set each one's own
   status/restockIgnored.

   The existing pre('findOneAndUpdate') hook reads a flat $set.stockQuantity
   and cannot work unchanged against a subdocument array. Don't force it
   through a schema-level hook, instead compute the new status in
   service.product.ts's updateVariant function before writing (using
   arrayFilters for the actual $set), the same way the create path does.

   sku needs to be unique across the whole collection. Mongoose won't
   uniquely index a field inside a subdocument array on its own, so enforce
   it the same way name/slug duplicate checks already work in
   service.product.ts: an explicit query before insert.

3. validation.product.ts: createProductValidationSchema needs modelNo
   (required, min 1, transform to uppercase), name, slug, description,
   category, thumbnail unchanged, plus brand/moq/samplesAvailable/
   transportPackage/origin/hsCode/note all as plain optional strings/booleans,
   no z.enum, these are open-ended values not a fixed list. variants:
   z.array(variantSchema).min(1, 'At least one size is required'), where
   variantSchema requires thickness/width/length/price (positive numbers)
   and optional stockQuantity/minStockThreshold with the existing defaults.
   sku is NOT required from the client, generate it server-side from
   modelNo + thickness + width. Update updateProductValidationSchema the
   same way, all optional, keep the existing "at least one field" refine.

4. controller.product.ts / service.product.ts:
   - getAllProducts: any price/stock filtering now queries
     variants.price / variants.stockQuantity, not a flat field.
   - Add updateVariant (PATCH /products/:productId/variants/:variantId),
     admin/superAdmin only, for changing one size's price/stock without
     touching the rest of the product.
   - getRestockQueue must become an aggregation that $unwind's variants and
     matches on variants.status/stockQuantity/restockIgnored, returning one
     row per low/out-of-stock SIZE with its parent product's name/modelNo
     attached, not one row per product.
   - Add a sku duplicate check across all products' variants (an
     $elemMatch query), alongside the existing name/slug checks.
   - Add a small GET /products/meta (or extend an existing meta endpoint if
     one exists) that returns the distinct brand / transportPackage / origin
     values currently in use, for the client's select-with-add-new dropdowns.

5. router.product.ts: add PATCH /:productId/variants/:variantId
   (admin/superAdmin) and GET /meta (public or optionalAuth, whichever
   matches how /categories is exposed). Keep every existing route path and
   method the same otherwise.

6. Update aziz-inventory-prd-server.md 5.3 once this is built, replace the
   "keep the flat model for v1" line with what was actually built.

Do not touch: category module, auth module, activity module, order module.
Confirm the build is clean (npm run build) and manually create one product
with 2+ variants through Postman before calling this done.
```

## CLIENT PROMPT (aziz-client)

```
Context: the Inventory / Product dashboard page currently expects the OLD
flat product shape (one price, one stockQuantity). The server is moving to
product + variants (see the companion server prompt): modelNo, name, brand,
moq, samplesAvailable, transportPackage, origin, hsCode, note at the product
level, and thickness/width/length/sizeLabel/price/stockQuantity/
minStockThreshold per variant (size).

Read the actual current product page, product form, and product API
slice/types in this repo first, don't assume they match any doc exactly.

1. Types: update Product to { modelNo, name, brand?, moq?,
   samplesAvailable?, transportPackage?, origin?, hsCode?, note?, category,
   slug, description, thumbnail, variants: Variant[] }, Variant = { _id, sku,
   thickness, width, length, sizeLabel, price, stockQuantity,
   minStockThreshold, status, restockIgnored }.

2. brand / transportPackage / origin fields: build ONE reusable
   "combobox" component (searchable select + add-new-value option), fed by
   GET /products/meta (see server prompt point 4). Use it for all three
   fields rather than three separate hardcoded dropdowns, so a brand-new
   supplier or origin doesn't need a code change to become selectable.

3. Product table: a row can't show one price/stock number anymore. Either
   show a price range + total stock with a drill-down to each size, or one
   row per variant with the product name repeated, pick whichever the
   existing table component supports with less rework.

4. Product create/edit form: two sections, a product-details section
   (modelNo, name, brand, moq, samplesAvailable, transportPackage, origin,
   hsCode, note, plus the existing category/slug/description/thumbnail) and
   a repeatable variant section (thickness, width, length, price,
   stockQuantity, minStockThreshold per row, add/remove rows). Show
   sizeLabel as read-only derived text as thickness/width are typed, never
   let the user type it directly. At least one variant row required.

5. Low Stock Quantity page: once the server returns one row per low/
   out-of-stock variant, show which size is low, not just which product.

6. Public homepage cards: if a product has multiple variants, show a price
   range ("from tk X") instead of a single price.

Test as staff and as admin per the existing role table. A product can never
have zero variants once the form requires one, but the table/detail view
should still not crash if it somehow happens.
```
