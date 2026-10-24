import { z } from 'zod';
import { email, newPassword, requiredText } from './auth.js';

export const clientInviteSchema = z.object({
  businessName: requiredText('Enter the business name.'),
  contactName: requiredText('Enter who the invite is for.'),
  email,
  note: z.string().trim().max(2000).default(''),
});

export const changeRequestSchema = z.object({
  step: z.number().int().min(0).max(8),
  message: requiredText('Tell the client what to fix.', 2000),
  items: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
});

export const deleteClientSchema = z.object({ confirmName: z.string().max(300) });

export const staffInviteSchema = z.object({
  email,
  role: z.enum(['admin', 'viewer'], { error: 'Choose Admin or Viewer.' }),
});

export const roleSchema = z.object({ role: z.enum(['admin', 'viewer']) });

export const leadStageSchema = z.object({ stage: z.enum(['new', 'booked', 'won', 'notfit']) });

const listOfNames = (label) =>
  z
    .array(z.string().trim().max(100))
    .max(50)
    .transform((list) => [...new Set(list.filter(Boolean))])
    .refine((list) => list.length > 0, `Keep at least one ${label}.`);

export const onboardingSettingsSchema = z.object({
  businessTypes: listOfNames('business type'),
  socialPlatforms: listOfNames('platform'),
  voiceInput: z.boolean(),
  verificationHours: z.union([z.literal(24), z.literal(48), z.literal(168)]),
  senderName: z.string().trim().max(100),
  replyTo: z.union([z.literal(''), email]),
});

export const exportSettingsSchema = z.object({
  skuPrefix: z.string().trim().max(20).regex(/^[A-Za-z0-9_-]*$/, 'Use letters, numbers, - or _ only.'),
  importAs: z.enum(['draft', 'published']),
  stockStatus: z.enum(['instock', 'outofstock', 'onbackorder']),
  includeNoImages: z.boolean(),
});

export const accountSchema = z
  .object({
    fullName: requiredText('Enter your name.'),
    email,
    currentPassword: z.string().max(1024).default(''),
    newPassword: z.union([z.literal(''), newPassword]).default(''),
    confirmPassword: z.string().max(1024).default(''),
  })
  .refine((d) => !d.newPassword || d.newPassword === d.confirmPassword, {
    message: "Those passwords don't match.",
    path: ['confirmPassword'],
  });

export const notificationsSchema = z.object({
  signup: z.boolean(),
  submitted: z.boolean(),
  stalled: z.boolean(),
  weekly: z.boolean(),
  to: email,
});

// ---- Public lead form (pre-call qualifier) ----

const optional = (max) => z.string().trim().max(max).default('');

export const leadSchema = z.object({
  businessName: requiredText('Enter your business name.'),
  contactName: optional(200),
  businessType: optional(100),
  phone: optional(60),
  email,
  budget: optional(100),
  timeline: optional(100),
  callDate: z
    .union([z.literal(''), z.iso.date('Use the format YYYY-MM-DD.')])
    .default('')
    .transform((d) => d || null),
  source: optional(100),
  // Honeypot: hidden from people, so only bots fill it in.
  website: z.string().max(500).default(''),
});
