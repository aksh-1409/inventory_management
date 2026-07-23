import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  warehouseId: z.string().min(1, 'Please select a warehouse'),
});

export const setupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  warehouseId: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const passwordResetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
