import { z } from 'zod';

// ── Variant (size) — sku/sizeLabel/status/restockIgnored are always
// server-derived, never accepted from the client. ──────────────────────────
const variantInputSchema = z.object({
    thickness: z.number().positive('Thickness must be greater than 0'),
    width: z.number().positive('Width must be greater than 0'),
    length: z.number().positive('Length must be greater than 0'),
    price: z.number().min(0, 'Price cannot be negative'),
    stockQuantity: z
        .number()
        .int('Stock quantity must be a whole number')
        .min(0, 'Stock quantity cannot be negative')
        .default(0),
    minStockThreshold: z
        .number()
        .int('Min stock threshold must be a whole number')
        .min(0, 'Min stock threshold cannot be negative')
        .default(5),
});

// ── Create ─────────────────────────────────────────────────────────────────────
const createProductValidationSchema = z.object({
    body: z.object({
        modelNo: z
            .string({ message: 'Model number is required' })
            .trim()
            .min(1, 'Model number cannot be empty')
            .transform((v) => v.toUpperCase()),

        name: z
            .string({ message: 'Product name is required' })
            .trim()
            .min(1, 'Product name cannot be empty'),

        slug: z
            .string({ message: 'Slug is required' })
            .trim()
            .min(1)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
                message: 'Slug must be lowercase letters, numbers, and hyphens only',
            }).optional(),

        description: z
            .string({ message: 'Description is required' })
            .min(1, 'Description cannot be empty'),

        category: z
            .string({ message: 'Category ID is required' })
            .regex(/^[a-f\d]{24}$/i, { message: 'Category must be a valid MongoDB ObjectId' }),

        thumbnail: z
            .string({ message: 'Thumbnail URL is required' })
            .url({ message: 'Thumbnail must be a valid URL' }),

        // ── Open-ended commercial fields (not enums — see model.product.ts) ────
        brand: z.string().trim().optional(),
        moq: z.string().trim().optional(),
        samplesAvailable: z.boolean().optional().default(false),
        transportPackage: z.string().trim().optional(),
        origin: z.string().trim().optional(),
        hsCode: z.string().trim().optional(),
        note: z.string().trim().optional(),

        variants: z.array(variantInputSchema).min(1, 'At least one size is required'),
    }),
});

// ── Update (product-level fields) ─────────────────────────────────────────────
const updateProductValidationSchema = z.object({
    body: z
        .object({
            modelNo: z
                .string()
                .trim()
                .min(1)
                .transform((v) => v.toUpperCase())
                .optional(),

            name: z.string().trim().min(1).optional(),

            slug: z
                .string()
                .trim()
                .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
                    message: 'Slug must be lowercase letters, numbers, and hyphens only',
                })
                .optional(),

            description: z.string().min(1).optional(),

            category: z
                .string()
                .regex(/^[a-f\d]{24}$/i, { message: 'Category must be a valid MongoDB ObjectId' })
                .optional(),

            thumbnail: z.string().url().optional(),

            brand: z.string().trim().optional(),
            moq: z.string().trim().optional(),
            samplesAvailable: z.boolean().optional(),
            transportPackage: z.string().trim().optional(),
            origin: z.string().trim().optional(),
            hsCode: z.string().trim().optional(),
            note: z.string().trim().optional(),

            // Replaces the entire variants array when provided (the product
            // edit form submits its full repeatable variant-row section at
            // once) — for touching a single size without the rest, use
            // PATCH /:productId/variants/:variantId instead.
            variants: z.array(variantInputSchema).min(1).optional(),
        })
        .refine((data) => Object.keys(data).length > 0, {
            message: 'At least one field must be provided to update',
        }),
});

// ── Update a single variant (price/stock edit from the inventory table) ──────
const updateVariantValidationSchema = z.object({
    body: z
        .object({
            thickness: z.number().positive().optional(),
            width: z.number().positive().optional(),
            length: z.number().positive().optional(),
            price: z.number().min(0).optional(),
            stockQuantity: z.number().int().min(0).optional(),
            minStockThreshold: z.number().int().min(0).optional(),
            restockIgnored: z.boolean().optional(),
        })
        .refine((data) => Object.keys(data).length > 0, {
            message: 'At least one field must be provided to update',
        }),
});

export const productValidations = {
    createProductValidationSchema,
    updateProductValidationSchema,
    updateVariantValidationSchema,
};
