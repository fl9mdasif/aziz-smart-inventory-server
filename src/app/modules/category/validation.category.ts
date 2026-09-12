import { z } from 'zod';

const createCategoryValidationSchema = z.object({
  body: z.object({
    name: z.string({ message: 'Name is required' }).trim().min(1),
    slug: z
      .string({ message: 'Slug is required' })
      .trim()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message:
          'Slug must be lowercase letters, numbers, and hyphens only (e.g. cooking-oil)',
      }).optional(),
    description: z.string().optional(),
    thumbnail: z.string().optional(),
    isActive: z.boolean().optional().default(true),
    // order: z.number().int().min(0).optional().default(0),
  }),
});

const updateCategoryValidationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).optional(),
    slug: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'Slug must be lowercase letters, numbers, and hyphens only',
      })
      .optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    // order: z.number().int().min(0).optional(),
  }),
});

export const categoryValidations = {
  createCategoryValidationSchema,
  updateCategoryValidationSchema,
};