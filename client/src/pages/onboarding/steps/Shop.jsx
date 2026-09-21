import { Field } from '../../../components/Field.jsx'
import { blankProduct, uid } from '../model.js'
import { AddButton, Chip, EmptyState, ErrorLine, FilePicker, Group, ItemCard, RemoveButton, StepCard, Toggle } from '../ui.jsx'
import { VoiceTextarea } from '../VoiceTextarea.jsx'

const pad = (i) => String(i + 1).padStart(2, '0')

export default function Shop({ data, update, errors, clearError, uploadFiles }) {
  const { count, categories, items } = data.products

  // Apply a change to the products section and clear the related error.
  const edit = (mutate, errorKey) =>
    update('products', (d) => {
      mutate(d)
      if (errorKey) clearError(errorKey)
    })

  const removeCategory = (index) =>
    edit((d) => {
      const [gone] = d.categories.splice(index, 1)
      const subIds = gone.subcategories.map((s) => s.id)
      d.items.forEach((item) => {
        item.categoryIds = item.categoryIds.filter((id) => id !== gone.id)
        item.subcategoryIds = item.subcategoryIds.filter((id) => !subIds.includes(id))
      })
    })

  const removeSubcategory = (ci, si) =>
    edit((d) => {
      const [gone] = d.categories[ci].subcategories.splice(si, 1)
      d.items.forEach((item) => {
        item.subcategoryIds = item.subcategoryIds.filter((id) => id !== gone.id)
      })
    })

  // Products also appear in the Home page pickers, so removing one must clear it from there too.
  const removeProduct = (index) => {
    const id = items[index].id
    update('homePage', (h) => {
      h.bestSellers = h.bestSellers.filter((x) => x !== id)
      h.newIn = h.newIn.filter((x) => x !== id)
    })
    edit((d) => d.items.splice(index, 1))
  }

  return (
    <StepCard
      number={2}
      name="Shop page"
      title="Build your catalog"
      intro="Group products into categories, then add each product with its photos and options. You can add more anytime."
    >
      <div className="stack-lg">
        <Field label="About how many products will you carry?" hint="A rough number is fine — it helps us plan the layout." error={errors.count} className="narrow">
          {(aria) => (
            <input className="input" inputMode="numeric" placeholder="e.g. 24" value={count} onChange={(e) => edit((d) => (d.count = e.target.value), 'count')} {...aria} />
          )}
        </Field>

        <Group
          title="Product categories"
          hint={'The groups your products fall into, e.g. "Tops," "Accessories." Add subcategories under any category if you have them.'}
        >
          <div className="stack-md" style={{ marginBottom: 14 }}>
            {categories.map((c, i) => (
              <div key={c.id} className="item-card white">
                <div className="inline-row" style={{ marginBottom: 12 }}>
                  <input
                    className="input"
                    aria-label={`Category ${i + 1} name`}
                    aria-invalid={errors[`categories.${i}`] ? 'true' : undefined}
                    placeholder="Category name (e.g. Tops)"
                    value={c.name}
                    onChange={(e) => edit((d) => (d.categories[i].name = e.target.value), `categories.${i}`)}
                  />
                  <RemoveButton onClick={() => removeCategory(i)} label={`Remove category ${c.name || i + 1}`} />
                </div>
                <ErrorLine>{errors[`categories.${i}`]}</ErrorLine>

                <div className="sub-row">
                  <span className="sub-label">Subcategories</span>
                  {c.subcategories.map((sub, si) => (
                    <div key={sub.id} className="sub-pill">
                      <input
                        aria-label={`Subcategory ${si + 1} of ${c.name || `category ${i + 1}`}`}
                        aria-invalid={errors[`categories.${i}.subcategories.${si}`] ? 'true' : undefined}
                        placeholder="Subcategory"
                        value={sub.name}
                        onChange={(e) => edit((d) => (d.categories[i].subcategories[si].name = e.target.value), `categories.${i}.subcategories.${si}`)}
                      />
                      <RemoveButton small onClick={() => removeSubcategory(i, si)} label={`Remove subcategory ${sub.name || si + 1}`} />
                    </div>
                  ))}
                  <AddButton size="sm" onClick={() => edit((d) => d.categories[i].subcategories.push({ id: uid(), name: '' }))}>
                    Add subcategory
                  </AddButton>
                </div>
                {c.subcategories.map((_, si) => (
                  <ErrorLine key={si}>{errors[`categories.${i}.subcategories.${si}`]}</ErrorLine>
                ))}
                <div className="hint" style={{ marginTop: 8 }}>
                  Optional — narrower groups inside this one, e.g. &quot;T-shirts&quot; and &quot;Blouses&quot; under Tops.
                </div>
              </div>
            ))}
          </div>
          <AddButton onClick={() => edit((d) => d.categories.push({ id: uid(), name: '', subcategories: [] }))}>Add category</AddButton>
        </Group>

        <Group title="Products" hint="Everything you want live at launch. Give each one a name so you can feature it later.">
          {items.length === 0 && <EmptyState title="No products yet">Add your first — customers can&apos;t buy what they can&apos;t see.</EmptyState>}
          <div className="stack-md" style={{ marginBottom: 16 }}>
            {items.map((item, i) => {
              const at = `items.${i}`
              const set = (key, errorKey) => (value) => edit((d) => (d.items[i][key] = value), errorKey)

              // One category and one subcategory per product. Picking a subcategory also sets its category.
              const toggleCategory = (c) =>
                edit((d) => {
                  const p = d.items[i]
                  const active = p.categoryIds.includes(c.id) || c.subcategories.some((s) => p.subcategoryIds.includes(s.id))
                  p.categoryIds = active ? [] : [c.id]
                  p.subcategoryIds = []
                })
              const toggleSub = (c, sub) =>
                edit((d) => {
                  const p = d.items[i]
                  if (p.categoryIds.includes(c.id)) p.subcategoryIds = p.subcategoryIds.includes(sub.id) ? [] : [sub.id]
                  else {
                    p.categoryIds = [c.id]
                    p.subcategoryIds = [sub.id]
                  }
                })

              return (
                <ItemCard key={item.id} number={i + 1} label="Product" removeLabel={`Remove product ${item.name || i + 1}`} onRemove={() => removeProduct(i)}>
                  <div className="stack-md">
                    <Field label="Product name" hint="What you'd call it on the shelf." error={errors[`${at}.name`]}>
                      {(aria) => <input className="input" placeholder="Signet ring" value={item.name} onChange={(e) => set('name', `${at}.name`)(e.target.value)} {...aria} />}
                    </Field>

                    <div className="field">
                      <span className="label" id={`cat-${item.id}`}>
                        Category
                      </span>
                      {categories.length === 0 ? (
                        <span className="hint">Add a category above first, then tap to assign it here.</span>
                      ) : (
                        <div className="stack-sm" role="group" aria-labelledby={`cat-${item.id}`}>
                          {categories.map((c, ci) => {
                            const active = item.categoryIds.includes(c.id) || c.subcategories.some((s) => item.subcategoryIds.includes(s.id))
                            return (
                              <div key={c.id} className="chip-row">
                                <Chip active={active} onClick={() => toggleCategory(c)}>
                                  {c.name.trim() || `Category ${pad(ci)}`}
                                </Chip>
                                {c.subcategories.length > 0 && <span className="chev" aria-hidden="true">›</span>}
                                {c.subcategories.map((sub, si) => (
                                  <Chip key={sub.id} small active={item.subcategoryIds.includes(sub.id)} onClick={() => toggleSub(c, sub)}>
                                    {sub.name.trim() || `Subcategory ${pad(si)}`}
                                  </Chip>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <span className="hint">A product sits under one category and one subcategory. Tap a category, or tap a subcategory — picking a subcategory sets its category automatically.</span>
                    </div>

                    <div className="field">
                      <span className="label">Main product photo</span>
                      <FilePicker
                        kind="image"
                        label="Main photo"
                        files={item.mainImage ? [item.mainImage] : []}
                        uploadFiles={uploadFiles}
                        onChange={(files) => edit((d) => (d.items[i].mainImage = files[0] ?? null))}
                      />
                      <span className="hint">One image — the cover shot shown first on the product card.</span>
                    </div>

                    <div className="field">
                      <span className="label">Product gallery</span>
                      <FilePicker
                        kind="image"
                        multiple
                        label="Gallery images"
                        files={item.images}
                        uploadFiles={uploadFiles}
                        onChange={(files) => edit((d) => (d.items[i].images = files))}
                      />
                      <span className="hint">More angles and detail shots — add as many as you like.</span>
                    </div>

                    <Field label="Short description" hint="One line that shows on the product card.">
                      {(aria) => <input className="input" placeholder="14k gold, hand-finished" value={item.shortDescription} onChange={(e) => set('shortDescription')(e.target.value)} {...aria} />}
                    </Field>

                    <VoiceTextarea
                      label="Long description"
                      hint="The full story customers read on the product page."
                      placeholder="Materials, sizing, care, and what makes it worth it."
                      rows={4}
                      value={item.longDescription}
                      onChange={set('longDescription')}
                    />

                    <Field label="Price (₦)" hint="Numbers only, like 45000." error={errors[`${at}.price`]} className="narrow">
                      {(aria) => (
                        <input className="input" inputMode="decimal" placeholder="45000" value={item.price} onChange={(e) => set('price', `${at}.price`)(e.target.value)} {...aria} />
                      )}
                    </Field>

                    <div className="variations">
                      <div className="label">Variations</div>
                      <div className="hint" style={{ margin: '4px 0 12px' }}>
                        Options a customer chooses from, like colour or size. Skip if this product has none.
                      </div>
                      <div className="stack-sm" style={{ marginBottom: 12 }}>
                        {item.variations.map((v, j) => {
                          const vat = `${at}.variations.${j}`
                          return (
                            <div key={v.id} className="item-card white">
                              <div className="inline-row" style={{ marginBottom: 12 }}>
                                <input
                                  className="input"
                                  aria-label={`Variation ${j + 1} name`}
                                  aria-invalid={errors[`${vat}.name`] ? 'true' : undefined}
                                  placeholder="Variation name (e.g. Colour)"
                                  value={v.name}
                                  onChange={(e) => edit((d) => (d.items[i].variations[j].name = e.target.value), `${vat}.name`)}
                                />
                                <RemoveButton onClick={() => edit((d) => d.items[i].variations.splice(j, 1))} label={`Remove variation ${v.name || j + 1}`} />
                              </div>
                              <ErrorLine>{errors[`${vat}.name`]}</ErrorLine>

                              <div className="stack-sm" style={{ margin: '0 0 12px' }}>
                                {v.options.map((o, k) => (
                                  <div key={o.id}>
                                    <div className="inline-row">
                                      <input
                                        className="input"
                                        aria-label={`Option ${k + 1} of ${v.name || `variation ${j + 1}`}`}
                                        aria-invalid={errors[`${vat}.options.${k}`] ? 'true' : undefined}
                                        placeholder="Option (e.g. Red)"
                                        value={o.label}
                                        onChange={(e) => edit((d) => (d.items[i].variations[j].options[k].label = e.target.value), `${vat}.options.${k}`)}
                                      />
                                      {v.priceVaries && (
                                        <input
                                          className="input price-input"
                                          inputMode="decimal"
                                          aria-label={`Price for ${o.label || `option ${k + 1}`}`}
                                          placeholder="₦ price"
                                          value={o.price}
                                          onChange={(e) => edit((d) => (d.items[i].variations[j].options[k].price = e.target.value), `${vat}.options.${k}`)}
                                        />
                                      )}
                                      <RemoveButton small onClick={() => edit((d) => d.items[i].variations[j].options.splice(k, 1))} label={`Remove option ${o.label || k + 1}`} />
                                    </div>
                                    <ErrorLine>{errors[`${vat}.options.${k}`]}</ErrorLine>
                                  </div>
                                ))}
                              </div>
                              <ErrorLine>{errors[`${vat}.options`]}</ErrorLine>

                              <div className="variation-foot">
                                <AddButton size="sm" onClick={() => edit((d) => d.items[i].variations[j].options.push({ id: uid(), label: '', price: '' }), `${vat}.options`)}>
                                  Add option
                                </AddButton>
                                <Toggle
                                  on={v.priceVaries}
                                  label="Does price change per option?"
                                  onChange={(on) =>
                                    edit((d) => {
                                      const variation = d.items[i].variations[j]
                                      variation.priceVaries = on
                                      if (!on) variation.options.forEach((o) => (o.price = ''))
                                    })
                                  }
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <AddButton size="sm" onClick={() => edit((d) => d.items[i].variations.push({ id: uid(), name: '', priceVaries: false, options: [] }))}>
                        Add variation
                      </AddButton>
                    </div>
                  </div>
                </ItemCard>
              )
            })}
          </div>
          <AddButton onClick={() => edit((d) => d.items.push(blankProduct()))}>Add product</AddButton>
        </Group>
      </div>
    </StepCard>
  )
}
