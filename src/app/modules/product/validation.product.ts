import { z } from 'zod';

// ── Shared status enum ─────────────────────────────────────────────────────────
const productStatusEnum = z.enum(['active', 'draft', 'archived', 'out_of_stock', 'low_stock']);

// ── Create ─────────────────────────────────────────────────────────────────────
const createProductValidationSchema = z.object({
    body: z.object({
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
            }),

        description: z
            .string({ message: 'Description is required' })
            .min(1, 'Description cannot be empty'),

        category: z
            .string({ message: 'Category ID is required' })
            .regex(/^[a-f\d]{24}$/i, { message: 'Category must be a valid MongoDB ObjectId' }),

        thumbnail: z
            .string({ message: 'Thumbnail URL is required' })
            .url({ message: 'Thumbnail must be a valid URL' }),

        // ── Inventory ──────────────────────────────────────────────────────────
        stockQuantity: z
            .number()
            .int({ message: 'Stock quantity must be a whole number' })
            .min(0, 'Stock quantity cannot be negative')
            .default(0),

        minStockThreshold: z
            .number()
            .int({ message: 'Min stock threshold must be a whole number' })
            .min(0, 'Min stock threshold cannot be negative')
            .default(5),

        status: productStatusEnum.optional().default('draft'),
    }),
});

// ── Update ─────────────────────────────────────────────────────────────────────
const updateProductValidationSchema = z.object({
    body: z
        .object({
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

            stockQuantity: z
                .number()
                .int()
                .min(0, 'Stock quantity cannot be negative')
                .optional(),

            minStockThreshold: z
                .number()
                .int()
                .min(0, 'Min stock threshold cannot be negative')
                .optional(),

            status: productStatusEnum.optional(),
        })
        .refine((data) => Object.keys(data).length > 0, {
            message: 'At least one field must be provided to update',
        }),
});

export const productValidations = {
    createProductValidationSchema,
    updateProductValidationSchema,
};