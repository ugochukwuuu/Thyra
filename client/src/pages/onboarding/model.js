import { isEmail } from '../../lib/validation.js'

// Rail order, straight from the design. The server's `currentStep` uses these 0-based positions.
export const STEPS = [
  { key: 'business', label: 'Business info', name: 'Business info' },
  { key: 'shop', label: 'Shop page', name: 'Shop page' },
  { key: 'home', label: 'Home page', name: 'Home page' },
  { key: 'about', label: 'About the brand', name: 'About the brand' },
  { key: 'contact', label: 'Contact us', name: 'Contact us page' },
  { key: 'inspiration', label: 'Design inspiration', name: 'Design inspiration' },
  { key: 'identity', label: 'Visual identity', name: 'Visual identity' },
  { key: 'social', label: 'Social media', name: 'Social media' },
  { key: 'policies', label: 'Policy pages', name: 'Policy pages' },
  { key: 'review', label: 'Review & confirm', name: 'Review & confirm' },
]
export const REVIEW_STEP = STEPS.length - 1
export const CONTACT_STEP = 4
export const MIN_VALUES = 3
export const MAX_PICKS = 12
export const MAX_TONES = 2

export const TONES = [
  ['Professional', 'Polished and trustworthy — feels like an established business.'],
  ['Casual', 'Relaxed and friendly, like chatting with a mate.'],
  ['Premium', 'High-end and considered, worth paying more for.'],
  ['Playful', 'Fun and cheerful, with personality and colour.'],
  ['Minimal', 'Clean and simple — lots of space, little clutter.'],
  ['Bold', 'Loud and confident, with strong colours and big type.'],
  ['Elegant', 'Refined and graceful, understated and tasteful.'],
  ['Warm', 'Homely and welcoming, soft and personal.'],
  ['Modern', 'Current and sleek, in step with the latest look.'],
  ['Luxury', 'Exclusive and indulgent — the finest of everything.'],
]

export const LOGO_SLOTS = [
  ['primary', 'Primary logo', 'Your main, full logo.'],
  ['mark', 'Icon / mark only', 'The symbol without text.'],
  ['light', 'For light backgrounds', 'A version that reads on cream/white.'],
  ['dark', 'For dark backgrounds', 'A version that reads on charcoal/black.'],
  ['favicon', 'Favicon', 'The tiny icon in the browser tab.'],
]

export const CONTACT_FIELD_TYPES = [
  ['name', 'Name'],
  ['phone', 'Phone number'],
  ['email', 'Email'],
  ['message', 'Message'],
  ['dropdown', 'Dropdown'],
]
export const contactTypeLabel = (type) => CONTACT_FIELD_TYPES.find(([t]) => t === type)?.[1] ?? type

export const POLICIES = [
  ['privacy', 'Privacy policy', 'How you handle customer data.'],
  ['terms', 'Terms and conditions', 'The rules of buying from you.'],
  ['returns', 'Cancellation and returns policy', 'When and how customers can cancel or return.'],
]

// Which data sections each step edits, and their keys in the API.
export const SECTIONS = [
  'businessInfo',
  'products',
  'homePage',
  'aboutBrand',
  'contactPage',
  'inspiration',
  'visualIdentity',
  'socialMedia',
  'policies',
]

export const uid = () => crypto.randomUUID()
export const blank = (value) => !String(value ?? '').trim()
const numToText = (n) => (n === null || n === undefined ? '' : String(n))

export const blankData = () => ({
  businessInfo: { name: '', description: '', email: '', phone: '', address: '' },
  products: { count: '', categories: [], items: [] },
  homePage: { media: [], bestSellers: [], newIn: [], testimonials: [], excerpt: '', differentiators: [] },
  aboutBrand: { story: '', vision: '', mission: '', whyDifferent: '', values: [], team: [] },
  contactPage: { phone: '', email: '', address: '', seeded: false, fields: [] },
  inspiration: { items: [] },
  visualIdentity: {
    tones: [],
    logos: { primary: null, mark: null, light: null, dark: null, favicon: null },
    brandColor: '',
    brandGuide: null,
  },
  socialMedia: { items: [] },
  policies: {
    privacy: { text: '', draft: false },
    terms: { text: '', draft: false },
    returns: { text: '', draft: false },
  },
})

export const blankProduct = () => ({
  id: uid(),
  name: '',
  categoryIds: [],
  subcategoryIds: [],
  mainImage: null,
  images: [],
  shortDescription: '',
  longDescription: '',
  price: '',
  variations: [],
})

/** Parses what a person typed into a price. '' -> null, "45,000" -> 45000, junk -> NaN. */
export function parseNumber(text) {
  const cleaned = String(text ?? '').replace(/[,\s₦]/g, '')
  if (cleaned === '') return null
  return /^\d*\.?\d+$/.test(cleaned) ? Number(cleaned) : NaN
}

/** Turns what the server stored into form state (numbers become text, missing keys get defaults). */
export function hydrate(submission, user) {
  const base = blankData()
  const s = submission
  const p = s.products ?? {}
  const identity = s.visualIdentity ?? {}
  const pol = s.policies ?? {}

  return {
    businessInfo: {
      ...base.businessInfo,
      ...s.businessInfo,
      // The name given at sign-up is the natural starting point for this field.
      name: s.businessInfo?.name ?? user?.businessName ?? '',
    },
    products: {
      count: numToText(p.count),
      categories: (p.categories ?? []).map((c) => ({ ...c, subcategories: c.subcategories ?? [] })),
      items: (p.items ?? []).map((item) => ({
        ...blankProduct(),
        ...item,
        price: numToText(item.price),
        variations: (item.variations ?? []).map((v) => ({
          ...v,
          options: (v.options ?? []).map((o) => ({ ...o, price: numToText(o.price) })),
        })),
      })),
    },
    homePage: { ...base.homePage, ...s.homePage },
    aboutBrand: { ...base.aboutBrand, ...s.aboutBrand },
    contactPage: { ...base.contactPage, ...s.contactPage },
    inspiration: { items: s.inspiration?.items ?? [] },
    visualIdentity: {
      ...base.visualIdentity,
      ...identity,
      logos: { ...base.visualIdentity.logos, ...identity.logos },
    },
    socialMedia: { items: s.socialMedia?.items ?? [] },
    policies: {
      privacy: { ...base.policies.privacy, ...pol.privacy },
      terms: { ...base.policies.terms, ...pol.terms },
      returns: { ...base.policies.returns, ...pol.returns },
    },
  }
}

/** Form state -> the JSON the API stores. Unparseable numbers are sent as null (step validation blocks them). */
export function toPayload(section, data) {
  const value = data[section]
  if (section !== 'products') return value
  const num = (text) => {
    const n = parseNumber(text)
    return Number.isFinite(n) ? n : null
  }
  const count = num(value.count)
  return {
    count: count === null ? null : Math.trunc(count),
    categories: value.categories,
    items: value.items.map((item) => ({
      ...item,
      price: num(item.price),
      variations: item.variations.map((v) => ({
        ...v,
        options: v.options.map((o) => ({ ...o, price: num(o.price) })),
      })),
    })),
  }
}

/** Accepts "https://x.com/a", "x.com/a" and the like; rejects anything with spaces or no dot. */
export function looksLikeUrl(text) {
  const t = String(text).trim()
  if (/\s/.test(t)) return false
  try {
    const { hostname } = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`)
    return hostname.includes('.')
  } catch {
    return false
  }
}

export const HEX_RE = /^#?[0-9a-fA-F]{6}$/

/**
 * Returns { [fieldPath]: message } for a step; empty means the step is fine to leave.
 * Paths mirror the server's `findSubmissionProblems`, which is the backstop on submit.
 */
export function validateStep(step, data) {
  const e = {}

  if (step === 0) {
    const b = data.businessInfo
    if (blank(b.name)) e.name = "Add your business name so customers know who they're buying from."
    if (blank(b.description)) e.description = 'A short description helps people find you online.'
    if (blank(b.email)) e.email = 'Add a business email we can reach you on.'
    else if (!isEmail(b.email)) e.email = "That email doesn't look right — check the format."
    if (blank(b.phone)) e.phone = 'Add a phone number customers can use.'
    if (blank(b.address)) e.address = 'Add your business address.'
  }

  if (step === 1) {
    const { count, categories, items } = data.products
    const n = parseNumber(count)
    if (Number.isNaN(n) || (n !== null && !Number.isInteger(n))) e.count = 'Enter a whole number, like 24.'

    categories.forEach((c, i) => {
      if (blank(c.name)) e[`categories.${i}`] = 'Name this category or remove it.'
      c.subcategories.forEach((s, j) => {
        if (blank(s.name)) e[`categories.${i}.subcategories.${j}`] = 'Name this subcategory or remove it.'
      })
    })
    items.forEach((p, i) => {
      if (blank(p.name)) e[`items.${i}.name`] = 'Give this product a name.'
      if (Number.isNaN(parseNumber(p.price))) e[`items.${i}.price`] = 'Enter a number, like 45000.'
      p.variations.forEach((v, j) => {
        const at = `items.${i}.variations.${j}`
        if (blank(v.name)) e[`${at}.name`] = 'Name this variation (for example Colour) or remove it.'
        if (v.options.length === 0) e[`${at}.options`] = 'Add at least one option, or remove this variation.'
        v.options.forEach((o, k) => {
          if (blank(o.label)) e[`${at}.options.${k}`] = 'Name this option or remove it.'
          else if (v.priceVaries && (blank(o.price) || Number.isNaN(parseNumber(o.price)))) {
            e[`${at}.options.${k}`] = 'Add a price for this option, like 45000.'
          }
        })
      })
    })
  }

  if (step === 2) {
    data.homePage.testimonials.forEach((t, i) => {
      if (blank(t.name)) e[`testimonials.${i}.name`] = "Add the customer's name, or remove this testimonial."
      if (blank(t.quote)) e[`testimonials.${i}.quote`] = 'Add what they said, or remove this testimonial.'
    })
    data.homePage.differentiators.forEach((d, i) => {
      if (blank(d.title)) e[`differentiators.${i}.title`] = 'Add a short title, or remove this reason.'
    })
  }

  if (step === 3) {
    const filled = data.aboutBrand.values.filter((v) => !blank(v.title)).length
    if (filled < MIN_VALUES) e.values = `Add at least ${MIN_VALUES} values — a title for each is enough.`
  }

  if (step === CONTACT_STEP) {
    const c = data.contactPage
    if (!blank(c.email) && !isEmail(c.email)) e.email = "That email doesn't look right — check the format."
    c.fields.forEach((f, i) => {
      if (f.type === 'dropdown' && f.reasons.filter((r) => !blank(r.label)).length === 0) {
        e[`fields.${i}.reasons`] = 'Add at least one reason, or remove this dropdown.'
      }
    })
  }

  if (step === 5) {
    data.inspiration.items.forEach((it, i) => {
      if (blank(it.link) && !it.screenshot) e[`items.${i}`] = 'Add a link or a screenshot, or remove this one.'
      else if (!blank(it.link) && !looksLikeUrl(it.link)) e[`items.${i}.link`] = 'Enter a valid link, like https://example.com.'
    })
  }

  if (step === 6) {
    const color = data.visualIdentity.brandColor
    if (!blank(color) && !HEX_RE.test(color.trim())) e.brandColor = 'Use a 6-digit hex code, like #D9714E.'
  }

  if (step === 7) {
    data.socialMedia.items.forEach((s, i) => {
      if (blank(s.link)) e[`items.${i}.link`] = 'Add the profile link, or remove this row.'
      else if (!looksLikeUrl(s.link)) e[`items.${i}.link`] = 'Enter a valid link, like https://instagram.com/yourbrand.'
    })
  }

  return e
}

/** Steps that can block submission (everything before policies, which may stay blank). */
export const VALIDATED_STEPS = [0, 1, 2, 3, 4, 5, 6, 7]

/** Drops list rows that were added but never filled in, so they don't reach the export as blanks. */
export function pruneBlankRows(data) {
  const { aboutBrand, homePage, inspiration, socialMedia } = data
  return {
    ...data,
    aboutBrand: {
      ...aboutBrand,
      values: aboutBrand.values.filter((v) => !(blank(v.title) && blank(v.description))),
      team: aboutBrand.team.filter((m) => !(blank(m.name) && blank(m.role))),
    },
    homePage: {
      ...homePage,
      testimonials: homePage.testimonials.filter((t) => !(blank(t.name) && blank(t.quote) && !t.photo)),
      differentiators: homePage.differentiators.filter((d) => !(blank(d.title) && blank(d.text))),
    },
    inspiration: {
      items: inspiration.items.filter((it) => !(blank(it.link) && blank(it.note) && !it.screenshot)),
    },
    socialMedia: { items: socialMedia.items.filter((s) => !blank(s.link)) },
  }
}

/** Sections whose blank rows pruneBlankRows would remove, so the caller knows what to save. */
export function prunedSections(before, after) {
  const changed = []
  const len = (d) => [
    d.aboutBrand.values.length + d.aboutBrand.team.length,
    d.homePage.testimonials.length + d.homePage.differentiators.length,
    d.inspiration.items.length,
    d.socialMedia.items.length,
  ]
  const [a1, h1, i1, s1] = len(before)
  const [a2, h2, i2, s2] = len(after)
  if (a1 !== a2) changed.push('aboutBrand')
  if (h1 !== h2) changed.push('homePage')
  if (i1 !== i2) changed.push('inspiration')
  if (s1 !== s2) changed.push('socialMedia')
  return changed
}

/** Pre-fills the contact page from business info the first time, without overwriting later edits. */
export function seedContact(data) {
  const { contactPage, businessInfo } = data
  if (contactPage.seeded) return data
  return {
    ...data,
    contactPage: {
      ...contactPage,
      phone: contactPage.phone || businessInfo.phone,
      email: contactPage.email || businessInfo.email,
      address: contactPage.address || businessInfo.address,
      seeded: true,
    },
  }
}

// ---- Files ----

const MB = 1024 * 1024

/** What each upload kind accepts; mirrors the server so people get feedback before anything is sent. */
export const FILE_KINDS = {
  image: {
    accept: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico',
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'],
    maxBytes: 10 * MB,
    message: 'Only JPG, PNG, WebP, GIF, SVG or ICO images can be uploaded here.',
  },
  media: {
    accept: 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm',
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'],
    maxBytes: 50 * MB,
    message: 'Only images (JPG, PNG, WebP, GIF) or videos (MP4, MOV, WebM) can be uploaded here.',
  },
  document: {
    accept: '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    types: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxBytes: 20 * MB,
    message: 'Only a PDF or Word document can be uploaded here.',
  },
}

const isVector = (file) => /\.(svg|ico)$/i.test(file.name || file.url)

/** Small preview URL. Cloudinary resizes on the fly; vectors and icons are shown as uploaded. */
export function previewUrl(file, size = 160) {
  if (file.resourceType === 'video') {
    return file.url
      .replace('/video/upload/', `/video/upload/so_0,c_fill,w_${size},h_${size},q_auto/`)
      .replace(/\.[a-z0-9]+$/i, '.jpg')
  }
  if (file.resourceType === 'image' && !isVector(file)) {
    return file.url.replace('/image/upload/', `/image/upload/c_fill,w_${size},h_${size},q_auto,f_auto/`)
  }
  return file.url
}

export const formatPrice = (text) => {
  const n = parseNumber(text)
  return Number.isFinite(n) && n !== null ? `₦${n.toLocaleString('en-NG')}` : ''
}
