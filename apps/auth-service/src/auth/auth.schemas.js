import { z } from 'zod';
import { AccountRole } from './auth.constants.js';

const email = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);

export const registerSchema = z
  .object({
    email,
    password,
    role: z
      .literal(AccountRole.STUDENT)
      .optional()
      .default(AccountRole.STUDENT),
  })
  .strict();

export const loginSchema = z.object({ email, password }).strict();
export const verifyEmailSchema = z
  .object({ email, otp: z.string().regex(/^\d{6}$/) })
  .strict();
export const resendVerificationSchema = z.object({ email }).strict();
export const forgotPasswordSchema =z.object({ email }).strict();
export const resetPasswordSchema = z
  .object({ email, otp: z.string().regex(/^\d{6}$/), password })
  .strict();
export const adminAccountQuerySchema = z.object({
  email: z.string().trim().max(320).optional(),
  role: z.enum(Object.values(AccountRole)).optional(),
  status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'DISABLED', 'SUSPENDED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export const adminAccountIdSchema = z.string().uuid();
export const adminAccountUpdateSchema = z.object({
  role: z.enum(Object.values(AccountRole)).optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'SUSPENDED']).optional(),
}).strict().refine((value) => value.role !== undefined || value.status !== undefined, {
  message: 'At least one account field is required',
});

export const accountResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(Object.values(AccountRole)),
  status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'DISABLED', 'SUSPENDED']),
  createdAt: z.string(),
});

export const authResponseSchema = z.object({
  account: accountResponseSchema,
  authenticated: z.literal(true),
  authentication: z.enum(['credential_verified', 'session']),
});
