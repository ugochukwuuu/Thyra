// Turns a stored submission into the fields the admin detail page shows, section by section.
// Only what the onboarding form actually collects is shown.

import { contactTypeLabel, formatPrice, LOGO_SLOTS } from '../onboarding/model.js'

export const SECTION_TITLES = [
  'Business info',
  'Shop page',
  'Home page',
  'About the brand',
  'Contact us page',
  'Design inspiration',
  'Visual identity',
  'Social media',
  'Policy pages',
]

const blank = (s) => !String(s ?? '').trim()
const T = (label, value) => ({ type: 'text', label, value })
const L = (label, value) => ({ type: 'long', label, value })
const LI = (label, value) => ({ type: 'list', label, value })
const F = (label, value) => ({ type: 'files', label, value })
const lines = (arr) => arr.filter((s) => !blank(s)).join('\n')
const price = (n) => (n == null ? '' : formatPrice(String(n)))

/** Problems that would make a product import into WooCommerce incomplete. */
export function productIssue(p) {
  const out = []
  const varying = (p.variations ?? []).some((v) => v.priceVaries)
  if (p.price == null && !varying) out.push('No price')
  if (!p.mainImage && !(p.images ?? []).length) out.push('No images')
  if ((p.variations ?? []).some((v) => v.priceVaries && (v.options ?? []).some((o) => o.price == null))) out.push('A variation is missing a price')
  return out.join(' · ')
}

export function buildSections(s) {
  const b = s.businessInfo ?? {}
  const shop = s.products ?? {}
  const home = s.homePage ?? {}
  const about = s.aboutBrand ?? {}
  const contact = s.contactPage ?? {}
  const insp = s.inspiration?.items ?? []
  const vi = s.visualIdentity ?? {}
  const social = s.socialMedia?.items ?? []
  const pol = s.policies ?? {}

  const items = shop.items ?? []
  const categories = shop.categories ?? []
  const productName = (id) => items.find((p) => p.id === id)?.name?.trim() || null
  const where = (p) => {
    const cats = (p.categoryIds ?? []).map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean)
    const subs = (p.subcategoryIds ?? [])
      .map((id) => categories.flatMap((c) => (c.subcategories ?? []).map((x) => ({ ...x, parent: c.name }))).find((x) => x.id === id))
      .filter(Boolean)
      .map((x) => `${x.parent} › ${x.name}`)
    return subs.length ? subs.join(', ') : cats.join(', ')
  }

  const policy = (label, p) =>
    p?.draft ? T(label, 'Client asked Thyra to draft this') : L(label, p?.text)

  return [
    {
      title: SECTION_TITLES[0],
      fields: [T('Business name', b.name), L('Description', b.description), T('Email', b.email), T('Phone', b.phone), L('Address', b.address)],
    },
    {
      title: SECTION_TITLES[1],
      fields: [
        T('Approx. products', shop.count == null ? '' : String(shop.count)),
        LI(
          'Categories',
          categories
            .filter((c) => !blank(c.name))
            .map((c) => {
              const subs = (c.subcategories ?? []).filter((x) => !blank(x.name)).map((x) => x.name)
              return subs.length ? `${c.name} (${subs.join(', ')})` : c.name
            }),
        ),
        {
          type: 'products',
          label: 'Products',
          value: items.map((p) => ({
            id: p.id,
            name: p.name || 'Untitled product',
            meta: [where(p) || 'No category', p.variations?.length ? `${p.variations.length} variation${p.variations.length > 1 ? 's' : ''}` : 'No variations'].join(' · '),
            // A product priced only through its options has no base price, and that's fine.
            price: p.price == null ? ((p.variations ?? []).some((v) => v.priceVaries) ? 'Varies by option' : null) : price(p.price),
            shortDescription: p.shortDescription,
            longDescription: p.longDescription,
            images: [p.mainImage, ...(p.images ?? [])].filter(Boolean),
            issue: productIssue(p),
            variations: (p.variations ?? []).map((v) => ({
              name: v.name,
              priceVaries: v.priceVaries,
              options: (v.options ?? []).map((o) => ({
                label: o.label,
                price: v.priceVaries ? (o.price == null ? null : price(o.price)) : price(p.price) || '—',
              })),
            })),
          })),
        },
      ],
    },
    {
      title: SECTION_TITLES[2],
      fields: [
        F('Homepage media', home.media ?? []),
        LI('Best sellers', (home.bestSellers ?? []).map(productName).filter(Boolean)),
        LI('New in', (home.newIn ?? []).map(productName).filter(Boolean)),
        L('Testimonials', ((home.testimonials ?? []).map((t) => `"${t.quote?.trim()}" — ${t.name?.trim()}`)).join('\n\n')),
        F('Testimonial photos', (home.testimonials ?? []).map((t) => t.photo).filter(Boolean)),
        L('Brand excerpt', home.excerpt),
        L('What makes them different', lines((home.differentiators ?? []).map((d) => (blank(d.text) ? d.title : `${d.title}: ${d.text}`)))),
      ],
    },
    {
      title: SECTION_TITLES[3],
      fields: [
        L('How it started', about.story),
        L('Vision', about.vision),
        L('Mission', about.mission),
        L("Why we're different", about.whyDifferent),
        L('Values', lines((about.values ?? []).map((v) => (blank(v.description) ? v.title : `${v.title}: ${v.description}`)))),
        L('Team', lines((about.team ?? []).map((m) => [m.name, m.role].filter((x) => !blank(x)).join(' — ')))),
      ],
    },
    {
      title: SECTION_TITLES[4],
      fields: [
        T('Phone', contact.phone),
        T('Email', contact.email),
        L('Address', contact.address),
        LI(
          'Form fields',
          (contact.fields ?? []).map((f) => {
            const reasons = f.type === 'dropdown' ? (f.reasons ?? []).map((r) => r.label).filter(Boolean) : []
            return `${contactTypeLabel(f.type)}${f.required ? ' (required)' : ''}${reasons.length ? `: ${reasons.join(' / ')}` : ''}`
          }),
        ),
      ],
    },
    {
      title: SECTION_TITLES[5],
      fields: [
        L('Links and notes', lines(insp.map((it) => [it.link, it.note].filter((x) => !blank(x)).join(' — ')))),
        F('Screenshots', insp.map((it) => it.screenshot).filter(Boolean)),
      ],
    },
    {
      title: SECTION_TITLES[6],
      fields: [
        LI('Tone', vi.tones ?? []),
        { type: 'color', label: 'Base brand colour', value: vi.brandColor },
        F(
          'Logo files',
          LOGO_SLOTS.map(([slot, label]) => vi.logos?.[slot] && { ...vi.logos[slot], caption: label }).filter(Boolean),
        ),
        F('Brand guide', vi.brandGuide ? [vi.brandGuide] : []),
      ],
    },
    {
      title: SECTION_TITLES[7],
      fields: social.length ? social.map((x) => T(x.platform, x.link)) : [T('Profiles', '')],
    },
    {
      title: SECTION_TITLES[8],
      fields: [policy('Privacy policy', pol.privacy), policy('Terms and conditions', pol.terms), policy('Cancellation and returns', pol.returns)],
    },
  ]
}

/** Names the admin can tick when asking for changes in a section: its products or its files. */
export function flaggableItems(section) {
  const out = []
  for (const f of section.fields) {
    if (f.type === 'products') f.value.forEach((p) => out.push(p.name))
    if (f.type === 'files') f.value.forEach((file) => out.push(file.name || file.publicId.split('/').pop()))
  }
  return [...new Set(out)]
}
