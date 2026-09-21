import { z } from 'zod';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const email = z
  .string({ error: 'Enter your email.' })
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email.')
  .max(254, 'That email is too long.')
  .regex(EMAIL_RE, 'Enter a valid email address.');

// bcrypt silently ignores everything past 72 bytes, so refuse longer passwords outright.
const newPassword = z
  .string({ error: 'Choose a password.' })
  .min(1, 'Choose a password.')
  .min(8, 'Use at least 8 characters.')
  .refine((p) => Buffer.byteLength(p) <= 72, 'Use 72 bytes or fewer.');

const passwordsMatch = (data) => data.password === data.confirmPassword;
const mismatch = { message: "Those passwords don't match.", path: ['confirmPassword'] };

export const registerSchema = z
  .object({
    businessName: z
      .string({ error: 'Enter your business name.' })
      .trim()
      .min(1, 'Enter your business name.')
      .max(200, 'That name is too long.'),
    email,
    password: newPassword,
    confirmPassword: z.string({ error: 'Re-enter your password.' }).min(1, 'Re-enter your password.'),
  })
  .refine(passwordsMatch, mismatch);

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.').max(1024),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string({ error: 'This reset link is invalid.' }).min(1, 'This reset link is invalid.').max(256),
    password: newPassword,
    confirmPassword: z.string({ error: 'Re-enter your password.' }).min(1, 'Re-enter your password.'),
  })
  .refine(passwordsMatch, mismatch);
