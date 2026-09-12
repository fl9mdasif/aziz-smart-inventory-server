import { z } from 'zod';

// ── Create Staff Account ────────────────────────────────────────────────────────
const createUserValidationSchema = z.object({
    body: z.object({
        username: z.string({ message: 'Username is required' }).trim().min(1).max(50),
        email: z.string({ message: 'Email is required' }).email(),
        password: z.string({ message: 'Password is required' }).min(6).max(30),
        contactNumber: z.string({ message: 'Contact number is required' }).trim().min(1),
        profilePicture: z.string().optional(),
        // Role promotion to 'admin' is enforced server-side (superAdmin only);
        // this just lets the caller request it.
        role: z.enum(['staff', 'admin']).optional().default('staff'),
    }),
});

// ── Update Staff/Admin Account ──────────────────────────────────────────────────
const updateUserValidationSchema = z.object({
    body: z
        .object({
            username: z.string().trim().min(1).max(50).optional(),
            email: z.string().email().optional(),
            contactNumber: z.string().trim().min(1).optional(),
            profilePicture: z.string().optional(),
            role: z.enum(['staff', 'admin', 'superAdmin']).optional(),
        })
        .refine((data) => Object.keys(data).length > 0, {
            message: 'At least one field must be provided to update',
        }),
});

export const userValidations = {
    createUserValidationSchema,
    updateUserValidationSchema,
};
