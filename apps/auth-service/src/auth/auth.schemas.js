import { z } from 'zod';
import { AdminAccountAction, AdminAccountSort, PROFILE_LIMITS } from '@appenglish/auth-contracts';
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
  search: z.string().trim().max(320).optional(),
  role: z.enum(Object.values(AccountRole)).optional(),
  status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'DISABLED', 'SUSPENDED']).optional(),
  stale: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  sort: z.enum(Object.values(AdminAccountSort)).default(AdminAccountSort.NEWEST),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export const adminAccountIdSchema = z.string().uuid();
const reason = z.string().trim().max(300).optional();
export const adminAccountUpdateSchema = z.object({
  role: z.enum(Object.values(AccountRole)).optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'SUSPENDED']).optional(),
  reason,
}).strict().refine((value) => value.role !== undefined || value.status !== undefined, {
  message: 'At least one account field is required',
});
export const adminAccountActionSchema = z.object({
  action: z.enum(Object.values(AdminAccountAction)),
  reason,
}).strict();
export const adminInviteSchema = z.object({
  email,
  displayName: z
    .string()
    .trim()
    .max(PROFILE_LIMITS.displayNameMax)
    .transform((value) => value.replace(/\s+/g, ' '))
    .optional()
    .default(''),
  role: z.enum(Object.values(AccountRole)).default(AccountRole.STUDENT),
}).strict();
export const acceptInviteSchema = resetPasswordSchema;

export const updateProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .max(PROFILE_LIMITS.displayNameMax)
      .transform((value) => value.replace(/\s+/g, ' ')),
  })
  .strict();
export const verifyPasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128) })
  .strict();
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
  .strict();
export const avatarUploadSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(100),
  })
  .strict();
export const profileIdsSchema = z.array(z.string().uuid()).max(200);

export const accountResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(Object.values(AccountRole)),
  status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'DISABLED', 'SUSPENDED']),
  createdAt: z.string(),
  displayName: z.string().nullable().default(null),
  avatarUrl: z.string().nullable().default(null),
});

export const authResponseSchema = z.object({
  account: accountResponseSchema,
  authenticated: z.literal(true),
  authentication: z.enum(['credential_verified', 'session']),
});
