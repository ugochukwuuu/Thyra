import { z } from 'zod';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const email = z
  .string({ error: 'Enter your email.' })
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email.')
  .max(254, 'That email is too long.')
  .regex(EMAIL_RE, 'Enter a valid email address.');

// bcrypt silently ignores everything past 72 bytes, so refuse longer passwords outright.
export const newPassword = z
  .string({ error: 'Choose a password.' })
  .min(1, 'Choose a password.')
  .min(8, 'Use at least 8 characters.')
  .refine((p) => Buffer.byteLength(p) <= 72, 'Use 72 bytes or fewer.');

const confirmPassword = z.string({ error: 'Re-enter your password.' }).min(1, 'Re-enter your password.');
const token = (message) => z.string({ error: message }).min(1, message).max(256);

const passwordsMatch = (data) => data.password === data.confirmPassword;
const mismatch = { message: "Those passwords don't match.", path: ['confirmPassword'] };

export const requiredText = (message, max = 200) =>
  z.string({ error: message }).trim().min(1, message).max(max, 'That is too long.');

export const registerSchema = z
  .object({
    businessName: requiredText('Enter your business name.'),
    email,
    password: newPassword,
    confirmPassword,
    // Present when the client is accepting an invite from the Thyra team.
    inviteToken: z.string().max(256).optional(),
  })
  .refine(passwordsMatch, mismatch);

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.').max(1024),
  // 'staff' is sent by the admin login page, which only lets staff in.
  scope: z.enum(['any', 'staff']).default('any'),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: token('This reset link is invalid.'),
    password: newPassword,
    confirmPassword,
  })
  .refine(passwordsMatch, mismatch);

export const joinTeamSchema = z
  .object({
    token: token('This invite link is invalid.'),
    fullName: requiredText('Enter your full name.'),
    password: newPassword,
    confirmPassword,
  })
  .refine(passwordsMatch, mismatch);

export const verifyEmailSchema = z.object({ token: token('This confirmation link is invalid.') });
