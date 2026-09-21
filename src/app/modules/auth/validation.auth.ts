import { z } from 'zod';

export const loginValidationSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string({ message: 'Password is required' }),
  }),
});

const changePasswordValidationSchema = z.object({
  body: z.object({
    oldPassword: z.string({
      message: 'Old password is required',
    }),
    newPassword: z.string({ message: 'Password is required' }),
  }),
});


const updateProfileValidationSchema = z.object({
  body: z
    .object({
      username: z.string().min(1).max(50).optional(),
      email: z.string().email().optional(),
      contactNumber: z.string().optional(),
      profilePicture: z.string().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided to update',
    }),
});

export const authValidations = {
  loginValidationSchema,
  changePasswordValidationSchema,
  updateProfileValidationSchema,
};
