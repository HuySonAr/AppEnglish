import { z } from 'zod';

export const PASSWORD_MIN = 8;

const email = z.string().email('Enter a valid email address');
const newPassword = z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`);

export const authFormSchema = z.object({ email, password: newPassword });

export const registerFormSchema = authFormSchema
  .extend({ confirmPassword: z.string().min(1, 'Repeat your password') })
  .refine((values) => values.password === values.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const loginFormSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password').min(PASSWORD_MIN, 'Incorrect email or password')
});
