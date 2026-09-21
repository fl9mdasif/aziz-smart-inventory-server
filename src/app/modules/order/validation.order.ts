import { z } from 'zod';

const objectIdRegex = /^[a-f\d]{24}$/i;

// ── Create Order (record a sale) ───────────────────────────────────────────────
const placeOrderValidationSchema = z.object({
    body: z.object({
        productId: z
            .string({ message: 'Product ID is required.' })
            .regex(objectIdRegex, 'Product ID must be a valid MongoDB ObjectId'),

        variantId: z
            .string({ message: 'Variant (size) ID is required.' })
            .regex(objectIdRegex, 'Variant ID must be a valid MongoDB ObjectId'),

        quantity: z
            .number({ message: 'Quantity is required' })
            .int('Quantity must be a whole number')
            .min(1, 'Quantity must be at least 1'),

        discount: z
            .number()
            .min(0, 'Discount cannot be negative')
            .optional()
            .default(0),

        customerName: z.string().trim().optional(),
        customerContact: z.string().trim().optional(),
        note: z.string().trim().optional(),
    }),
});

// ── Cancel Order (admin/superAdmin) ────────────────────────────────────────────
const cancelOrderValidationSchema = z.object({
    body: z.object({
        cancelReason: z.string().trim().optional(),
    }),
});

export const orderValidations = {
    placeOrderValidationSchema,
    cancelOrderValidationSchema,
};
