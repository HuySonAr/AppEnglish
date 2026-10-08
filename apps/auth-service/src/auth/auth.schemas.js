import { z } from 'zod';
import { AccountRole } from './auth.constants.js';

const email = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);

export const registerSchema = z.object({
  email,
  password,
  role: z.literal(AccountRole.STUDENT).optional().default(AccountRole.STUDENT)
}).strict();

export const loginSchema = z.object({ email, password }).strict();

export const accountResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(Object.values(AccountRole)),
  status: z.enum(['ACTIVE', 'DISABLED']),
  createdAt: z.string()
});

export const authResponseSchema = z.object({
  account: accountResponseSchema,
  authenticated: z.literal(true),
  authentication: z.literal('credential_verified')
});
