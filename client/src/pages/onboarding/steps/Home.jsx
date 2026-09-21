import { Field } from '../../../components/Field.jsx'
import { MAX_PICKS, uid } from '../model.js'
import { AddButton, ErrorLine, FilePicker, Group, ItemCard, ProductPicker, StepCard } from '../ui.jsx'

export default function Home({ data, update, errors, clearError, uploadFiles }) {
  const h = data.homePage
  const products = data.products.items

  const edit = (mutate, errorKey) =>
    update('homePage', (d) => {
      mutate(d)
      if (errorKey) clearError(errorKey)
    })

  return (
    <StepCard
      number={3}
      name="Home page"
      title="Your storefront's first impression"
      intro="The homepage is what most visitors see first. Give it the imagery and picks that show you at your best."
    >
      <div className="stack-lg">
        <div className="field">
          <span className="label">Images &amp; videos for the homepage</span>
          <FilePicker
            kind="media"
            multiple
            label="Media"
            maxFiles={30}
            files={h.media}
            uploadFiles={uploadFiles}
            onChange={(files) => edit((d) => (d.media = files))}
          />
          <span className="hint">
            Lifestyle, landscape-orientation photos and short videos — people wearing or using the product, minimal background, product stays the focus.
          </span>
        </div>

        <Group title="Best sellers" hint={`Pick up to ${MAX_PICKS} products to feature — straight from the catalog you just built.`}>
          <ProductPicker
            products={products}
            selected={h.bestSellers}
            max={MAX_PICKS}
            onChange={(ids) => edit((d) => (d.bestSellers = ids))}
            emptyText="Add products in the Shop page first, then choose your best sellers here."
          />
        </Group>

        <Group title="New in" hint={`Up to ${MAX_PICKS} of your newest or recently added products to feature as just arrived.`}>
          <ProductPicker
            products={products}
            selected={h.newIn}
            max={MAX_PICKS}
            onChange={(ids) => edit((d) => (d.newIn = ids))}
            emptyText="These come from your catalog too — add products first."
          />
        </Group>

        <Group title="Customer testimonials" hint="Real words from happy customers do more selling than anything you can write yourself.">
          <div className="stack-md" style={{ marginBottom: 14 }}>
            {h.testimonials.map((t, i) => (
              <ItemCard key={t.id} number={i + 1} onRemove={() => edit((d) => d.testimonials.splice(i, 1))} removeLabel={`Remove testimonial ${i + 1}`}>
                <div className="stack-sm">
                  <Field label="Customer name" error={errors[`testimonials.${i}.name`]}>
                    {(aria) => (
                      <input className="input" placeholder="Customer name" value={t.name} onChange={(e) => edit((d) => (d.testimonials[i].name = e.target.value), `testimonials.${i}.name`)} {...aria} />
                    )}
                  </Field>
                  <Field label="What they said" error={errors[`testimonials.${i}.quote`]}>
                    {(aria) => (
                      <textarea
                        className="textarea"
                        style={{ minHeight: 64 }}
                        placeholder="What they said about you."
                        value={t.quote}
                        onChange={(e) => edit((d) => (d.testimonials[i].quote = e.target.value), `testimonials.${i}.quote`)}
                        {...aria}
                      />
                    )}
                  </Field>
                  <div className="field">
                    <span className="label">Photo (optional)</span>
                    <FilePicker
                      kind="image"
                      label="Photo"
                      files={t.photo ? [t.photo] : []}
                      uploadFiles={uploadFiles}
                      onChange={(files) => edit((d) => (d.testimonials[i].photo = files[0] ?? null))}
                    />
                  </div>
                </div>
              </ItemCard>
            ))}
          </div>
          <AddButton onClick={() => edit((d) => d.testimonials.push({ id: uid(), name: '', quote: '', photo: null }))}>Add testimonial</AddButton>
        </Group>

        <div className="group">
          <Field label="Short brand excerpt" hint="Shown near the top of the homepage — keep it warm and short.">
            {(aria) => (
              <textarea
                className="textarea"
                style={{ minHeight: 80 }}
                placeholder="A few sentences on who you are and why you exist."
                value={h.excerpt}
                onChange={(e) => edit((d) => (d.excerpt = e.target.value))}
                {...aria}
              />
            )}
          </Field>
        </div>

        <Group title="What makes you different" hint="Aim for 3–5 short reasons customers should buy from you over anyone else.">
          <div className="stack-md" style={{ marginBottom: 14 }}>
            {h.differentiators.map((d, i) => (
              <ItemCard key={d.id} number={i + 1} onRemove={() => edit((x) => x.differentiators.splice(i, 1))} removeLabel={`Remove reason ${i + 1}`}>
                <div className="stack-sm">
                  <input
                    className="input"
                    aria-label={`Reason ${i + 1} title`}
                    aria-invalid={errors[`differentiators.${i}.title`] ? 'true' : undefined}
                    placeholder="Short title (e.g. Made to order)"
                    value={d.title}
                    onChange={(e) => edit((x) => (x.differentiators[i].title = e.target.value), `differentiators.${i}.title`)}
                  />
                  <ErrorLine>{errors[`differentiators.${i}.title`]}</ErrorLine>
                  <input
                    className="input"
                    aria-label={`Reason ${i + 1} explanation`}
                    placeholder="One-line explanation"
                    value={d.text}
                    onChange={(e) => edit((x) => (x.differentiators[i].text = e.target.value))}
                  />
                </div>
              </ItemCard>
            ))}
          </div>
          <AddButton onClick={() => edit((x) => x.differentiators.push({ id: uid(), title: '', text: '' }))}>Add reason</AddButton>
        </Group>
      </div>
    </StepCard>
  )
}
