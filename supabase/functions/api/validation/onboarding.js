import { z } from 'zod';
import { userFolder } from '../lib/cloudinary.js';

const str = (max) => z.string().max(max).default('');
const id = z.string().min(1).max(64);

const short = 300;
const long = 20000;

/** A file the client uploaded through our API: it must live on Cloudinary, in that client's folder. */
const file = (userId) =>
  z.object({
    url: z
      .url()
      .max(1000)
      .refine((u) => {
        try {
          const { protocol, hostname } = new URL(u);
          return protocol === 'https:' && hostname === 'res.cloudinary.com';
        } catch {
          return false;
        }
      }, 'Files must be uploaded through Thyra.'),
    publicId: z
      .string()
      .max(500)
      .refine((p) => p.startsWith(`${userFolder(userId)}/`), 'Unknown file.'),
    name: str(200),
    resourceType: z.enum(['image', 'video', 'raw']).default('image'),
  });
const optionalFile = (userId) => file(userId).nullable().default(null);

const price = z.number().min(0).max(1_000_000_000).nullable().default(null);

// ---- Step schemas (one per JSONB column) ----

const businessInfo = z.object({
  name: str(short),
  description: str(1000),
  email: str(254),
  phone: str(60),
  address: str(1000),
});

const products = (userId) =>
  z.object({
    count: z.number().int().min(0).max(1_000_000).nullable().default(null),
    categories: z
      .array(
        z.object({
          id,
          name: str(short),
          subcategories: z.array(z.object({ id, name: str(short) })).max(50).default([]),
        }),
      )
      .max(100)
      .default([]),
    items: z
      .array(
        z.object({
          id,
          name: str(short),
          categoryIds: z.array(id).max(5).default([]),
          subcategoryIds: z.array(id).max(5).default([]),
          mainImage: optionalFile(userId),
          images: z.array(file(userId)).max(20).default([]),
          shortDescription: str(500),
          longDescription: str(long),
          price,
          variations: z
            .array(
              z.object({
                id,
                name: str(short),
                priceVaries: z.boolean().default(false),
                options: z
                  .array(z.object({ id, label: str(short), price }))
                  .max(50)
                  .default([]),
              }),
            )
            .max(20)
            .default([]),
        }),
      )
      .max(500)
      .default([]),
  });

const homePage = (userId) =>
  z.object({
    media: z.array(file(userId)).max(30).default([]),
    bestSellers: z.array(id).max(12).default([]),
    newIn: z.array(id).max(12).default([]),
    testimonials: z
      .array(z.object({ id, name: str(short), quote: str(2000), photo: optionalFile(userId) }))
      .max(50)
      .default([]),
    excerpt: str(2000),
    differentiators: z
      .array(z.object({ id, title: str(short), text: str(1000) }))
      .max(20)
      .default([]),
  });

const aboutBrand = z.object({
  story: str(long),
  vision: str(long),
  mission: str(long),
  whyDifferent: str(long),
  values: z
    .array(z.object({ id, title: str(short), description: str(1000) }))
    .max(30)
    .default([]),
  team: z
    .array(z.object({ id, name: str(short), role: str(short) }))
    .max(100)
    .default([]),
});

export const CONTACT_FIELD_TYPES = ['name', 'phone', 'email', 'message', 'dropdown'];

const contactPage = z.object({
  phone: str(60),
  email: str(254),
  address: str(1000),
  // True once the details above were pre-filled from business info, so we don't overwrite later edits.
  seeded: z.boolean().default(false),
  fields: z
    .array(
      z.object({
        id,
        type: z.enum(CONTACT_FIELD_TYPES),
        required: z.boolean().default(false),
        reasons: z.array(z.object({ id, label: str(short) })).max(30).default([]),
      }),
    )
    .max(20)
    .default([]),
});

const inspiration = (userId) =>
  z.object({
    items: z
      .array(z.object({ id, link: str(1000), screenshot: optionalFile(userId), note: str(1000) }))
      .max(50)
      .default([]),
  });

export const TONES = ['Professional', 'Casual', 'Premium', 'Playful', 'Minimal', 'Bold', 'Elegant', 'Warm', 'Modern', 'Luxury'];
export const LOGO_SLOTS = ['primary', 'mark', 'light', 'dark', 'favicon'];

const visualIdentity = (userId) =>
  z.object({
    tones: z.array(z.enum(TONES)).max(2).default([]),
    logos: z
      .object(Object.fromEntries(LOGO_SLOTS.map((slot) => [slot, optionalFile(userId)])))
      .default(Object.fromEntries(LOGO_SLOTS.map((slot) => [slot, null]))),
    brandColor: str(20),
    brandGuide: optionalFile(userId),
  });

// The platform list is set by an admin in Settings, so any short name is accepted here.
const socialMedia = z.object({
  items: z
    .array(z.object({ id, platform: z.string().trim().min(1).max(50).default('Instagram'), link: str(1000) }))
    .max(20)
    .default([]),
});

const policy = z.object({ text: str(50000), draft: z.boolean().default(false) });
const emptyPolicy = { text: '', draft: false };
const policies = z.object({
  privacy: policy.default(emptyPolicy),
  terms: policy.default(emptyPolicy),
  returns: policy.default(emptyPolicy),
});

/** Request key -> DB column -> schema. The API and the client both use the request keys. */
export const SECTIONS = {
  businessInfo: { column: 'business_info', schema: () => businessInfo },
  products: { column: 'products', schema: products },
  homePage: { column: 'home_page', schema: homePage },
  aboutBrand: { column: 'about_brand', schema: () => aboutBrand },
  contactPage: { column: 'contact_page', schema: () => contactPage },
  inspiration: { column: 'inspiration', schema: inspiration },
  visualIdentity: { column: 'visual_identity', schema: visualIdentity },
  socialMedia: { column: 'social_media', schema: () => socialMedia },
  policies: { column: 'policies', schema: () => policies },
};

export const LAST_STEP = 9;

/** Body of PUT /api/onboarding. Every section is optional; a section sent is replaced whole. */
export const draftSchema = (userId) =>
  z.object({
    currentStep: z.number().int().min(0).max(LAST_STEP).optional(),
    ...Object.fromEntries(
      Object.entries(SECTIONS).map(([key, { schema }]) => [key, schema(userId).optional()]),
    ),
  });

// ---- Completeness check run when the client confirms the submission ----

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_RE = /^#?[0-9a-fA-F]{6}$/;
const blank = (s) => !String(s ?? '').trim();

/** Accepts "https://x.com/a", "x.com/a" and the like; rejects anything with spaces or no dot. */
function looksLikeUrl(text) {
  const t = String(text).trim();
  if (/\s/.test(t)) return false;
  try {
    const { hostname } = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`);
    return hostname.includes('.');
  } catch {
    return false;
  }
}

/**
 * Returns [{ step, field, message }] for everything that blocks submission.
 * Steps are 0-based wizard positions (0 business ... 8 policies). Policies may stay blank.
 * The client runs the same rules per step; this is the backstop.
 */
export function findSubmissionProblems(row) {
  const problems = [];
  const add = (step, field, message) => problems.push({ step, field, message });

  // 0 · Business info
  const biz = row.business_info ?? {};
  if (blank(biz.name)) add(0, 'name', 'Add your business name.');
  if (blank(biz.description)) add(0, 'description', 'Add a short description of the business.');
  if (blank(biz.email)) add(0, 'email', 'Add a business email.');
  else if (!EMAIL_RE.test(String(biz.email).trim())) add(0, 'email', 'Check the business email format.');
  if (blank(biz.phone)) add(0, 'phone', 'Add a business phone number.');
  if (blank(biz.address)) add(0, 'address', 'Add a business address.');

  // 1 · Shop page
  const { categories = [], items = [] } = row.products ?? {};
  categories.forEach((c, i) => {
    if (blank(c.name)) add(1, `categories.${i}`, 'Name this category or remove it.');
    (c.subcategories ?? []).forEach((s, j) => blank(s.name) && add(1, `categories.${i}.subcategories.${j}`, 'Name this subcategory or remove it.'));
  });
  items.forEach((p, i) => {
    if (blank(p.name)) add(1, `items.${i}.name`, 'Give this product a name.');
    (p.variations ?? []).forEach((v, j) => {
      if (blank(v.name)) add(1, `items.${i}.variations.${j}.name`, 'Name this variation or remove it.');
      if ((v.options ?? []).length === 0) add(1, `items.${i}.variations.${j}.options`, 'Add at least one option.');
      (v.options ?? []).forEach((o, k) => {
        if (blank(o.label)) add(1, `items.${i}.variations.${j}.options.${k}`, 'Name this option or remove it.');
        else if (v.priceVaries && o.price == null) {
          add(1, `items.${i}.variations.${j}.options.${k}`, 'Add a price for this option.');
        }
      });
    });
  });

  // 2 · Home page
  const home = row.home_page ?? {};
  (home.testimonials ?? []).forEach((t, i) => {
    if (blank(t.name)) add(2, `testimonials.${i}.name`, 'Add the customer’s name or remove this testimonial.');
    if (blank(t.quote)) add(2, `testimonials.${i}.quote`, 'Add what they said or remove this testimonial.');
  });
  (home.differentiators ?? []).forEach((d, i) => blank(d.title) && add(2, `differentiators.${i}.title`, 'Add a short title or remove this reason.'));

  // 3 · About the brand
  const values = (row.about_brand?.values ?? []).filter((v) => !blank(v.title));
  if (values.length < 3) add(3, 'values', 'Add at least 3 values.');

  // 4 · Contact us
  const contact = row.contact_page ?? {};
  if (!blank(contact.email) && !EMAIL_RE.test(String(contact.email).trim())) add(4, 'email', 'Check the contact email format.');
  (contact.fields ?? []).forEach((f, i) => {
    if (f.type !== 'dropdown') return;
    const reasons = (f.reasons ?? []).filter((r) => !blank(r.label));
    if (reasons.length === 0) add(4, `fields.${i}.reasons`, 'Add at least one reason, or remove this dropdown.');
  });

  // 5 · Design inspiration
  (row.inspiration?.items ?? []).forEach((it, i) => {
    if (blank(it.link) && !it.screenshot) add(5, `items.${i}`, 'Add a link or a screenshot, or remove this one.');
    else if (!blank(it.link) && !looksLikeUrl(it.link)) add(5, `items.${i}.link`, 'Enter a valid link, like https://example.com.');
  });

  // 6 · Visual identity
  const color = row.visual_identity?.brandColor;
  if (!blank(color) && !HEX_RE.test(String(color).trim())) add(6, 'brandColor', 'Use a 6-digit hex code, like #D9714E.');

  // 7 · Social media
  (row.social_media?.items ?? []).forEach((s, i) => {
    if (blank(s.link)) add(7, `items.${i}.link`, 'Add the profile link or remove this row.');
    else if (!looksLikeUrl(s.link)) add(7, `items.${i}.link`, 'Enter a valid link, like https://instagram.com/yourbrand.');
  });

  return problems;
}
