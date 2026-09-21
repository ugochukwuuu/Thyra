import { LOGO_SLOTS, STEPS, blank, contactTypeLabel, formatPrice } from '../model.js'

const dash = '—'
const val = (text) => (blank(text) ? dash : String(text).trim())
const pad = (i) => String(i + 1).padStart(2, '0')
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const list = (lines, empty = 'None added') => (lines.length ? lines.join('\n') : empty)

function buildSections(data) {
  const { businessInfo: b, products: p, homePage: h, aboutBrand: a, contactPage: c, inspiration, visualIdentity: v, socialMedia, policies } = data

  const productName = (id) => {
    const i = p.items.findIndex((x) => x.id === id)
    return i < 0 ? '' : p.items[i].name.trim() || `Product ${pad(i)}`
  }
  const catName = (id) => p.categories.find((cat) => cat.id === id)?.name.trim() ?? ''
  const subName = (id) => p.categories.flatMap((cat) => cat.subcategories).find((s) => s.id === id)?.name.trim() ?? ''

  const productLines = p.items.map((item, i) => {
    const where = [...item.categoryIds.map(catName), ...item.subcategoryIds.map(subName)].filter(Boolean).join(' › ')
    return [
      item.name.trim() || `Product ${pad(i)}`,
      formatPrice(item.price),
      where,
      `${plural((item.mainImage ? 1 : 0) + item.images.length, 'photo')}`,
      item.variations.length ? plural(item.variations.length, 'variation') : '',
    ]
      .filter(Boolean)
      .join(' · ')
  })

  const policyStatus = (pol) => (pol.draft ? 'Thyra to draft' : blank(pol.text) ? 'Left blank' : pol.text.trim())
  const logosUploaded = LOGO_SLOTS.filter(([slot]) => v.logos[slot]).length

  return [
    {
      step: 0,
      rows: [
        ['Business name', val(b.name)],
        ['Description', val(b.description)],
        ['Email', val(b.email)],
        ['Phone', val(b.phone)],
        ['Address', val(b.address)],
      ],
    },
    {
      step: 1,
      rows: [
        ['Approx. products', val(p.count)],
        [
          'Categories',
          list(
            p.categories.map((cat) => {
              const subs = cat.subcategories.filter((s) => !blank(s.name)).length
              return (cat.name.trim() || 'Untitled') + (subs ? ` (${subs} sub)` : '')
            }),
          ),
        ],
        ['Products added', list(productLines)],
      ],
    },
    {
      step: 2,
      rows: [
        ['Homepage media', h.media.length ? plural(h.media.length, 'file') : 'None'],
        ['Best sellers', list(h.bestSellers.map(productName).filter(Boolean), 'None')],
        ['New in', list(h.newIn.map(productName).filter(Boolean), 'None')],
        ['Testimonials', h.testimonials.length ? `${h.testimonials.length} added` : 'None'],
        ['Brand excerpt', val(h.excerpt)],
        ['Differentiators', list(h.differentiators.map((d) => d.title.trim() || 'Untitled'), 'None')],
      ],
    },
    {
      step: 3,
      rows: [
        ['How it started', val(a.story)],
        ['Vision', val(a.vision)],
        ['Mission', val(a.mission)],
        ["Why we're different", val(a.whyDifferent)],
        ['Values', list(a.values.map((x) => x.title.trim() || 'Untitled'))],
        ['Team', list(a.team.map((m) => [m.name.trim() || 'Unnamed', m.role.trim()].filter(Boolean).join(' — ')))],
      ],
    },
    {
      step: 4,
      rows: [
        ['Phone', val(c.phone)],
        ['Email', val(c.email)],
        ['Address', val(c.address)],
        ['Form fields', c.fields.length ? c.fields.map((f) => contactTypeLabel(f.type) + (f.required ? ' (required)' : '')).join(', ') : 'None'],
      ],
    },
    {
      step: 5,
      rows: [['References', list(inspiration.items.map((it) => [it.link.trim(), it.screenshot ? 'screenshot' : ''].filter(Boolean).join(' + ')), 'None')]],
    },
    {
      step: 6,
      rows: [
        ['Tone', v.tones.length ? v.tones.join(', ') : dash],
        ['Base brand colour', val(v.brandColor)],
        ['Logos uploaded', `${logosUploaded} of ${LOGO_SLOTS.length}`],
        ['Brand guide', v.brandGuide ? v.brandGuide.name || 'Added' : 'Not provided'],
      ],
    },
    {
      step: 7,
      rows: [['Profiles', list(socialMedia.items.map((s) => `${s.platform}: ${s.link.trim() || dash}`), 'None')]],
    },
    {
      step: 8,
      rows: [
        ['Privacy policy', policyStatus(policies.privacy)],
        ['Terms & conditions', policyStatus(policies.terms)],
        ['Cancellation & returns', policyStatus(policies.returns)],
      ],
    },
  ]
}

export default function Review({ data, goTo, readOnly, problemSteps }) {
  const sections = buildSections(data)
  return (
    <section className="card">
      <div className="eyebrow">Step 10 · Review &amp; confirm</div>
      <h1>{readOnly ? 'Your answers' : 'Check everything over'}</h1>
      <p className="lede">
        {readOnly
          ? "This is what you sent us. It's locked now, so get in touch with your Thyra team if something needs to change."
          : "Edit anything that's off, then confirm. Nothing goes live until you say so."}
      </p>

      {problemSteps.length > 0 && (
        <div className="notice has-error" role="alert" style={{ marginBottom: 16, flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
          <span style={{ paddingLeft: 16 }}>A few details still need attention before you can confirm:</span>
          <span className="problem-links">
            {problemSteps.map((s) => (
              <button key={s} type="button" className="link-btn" onClick={() => goTo(s)}>
                {STEPS[s].label}
              </button>
            ))}
          </span>
        </div>
      )}

      <div className="stack-md">
        {sections.map((section, index) => (
          <div key={section.step} className="review-card">
            <div className="review-head">
              <span className="review-title">
                <span className="item-num">{pad(index)}</span>
                {STEPS[section.step].label}
              </span>
              {!readOnly && (
                <button type="button" className="link-btn" onClick={() => goTo(section.step)} aria-label={`Edit ${STEPS[section.step].label}`}>
                  Edit
                </button>
              )}
            </div>
            <dl className="review-rows">
              {section.rows.map(([label, value]) => (
                <div key={label} className="review-row">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}
