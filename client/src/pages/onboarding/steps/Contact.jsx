import { Field } from '../../../components/Field.jsx'
import { CONTACT_FIELD_TYPES, contactTypeLabel, uid } from '../model.js'
import { AddButton, EmptyState, ErrorLine, RemoveButton, StepCard, Toggle } from '../ui.jsx'

export default function Contact({ data, update, errors, clearError }) {
  const c = data.contactPage

  const edit = (mutate, errorKey) =>
    update('contactPage', (d) => {
      mutate(d)
      if (errorKey) clearError(errorKey)
    })

  return (
    <StepCard
      number={5}
      name="Contact us page"
      title="How customers reach you"
      intro="Confirm the details to display, then build the contact form customers fill in."
    >
      <div className="stack-lg">
        <div className="stack-md">
          <div className="group-title" style={{ fontSize: 16 }}>Contact details to display</div>
          <span className="hint" style={{ marginTop: -8 }}>
            Pre-filled from your business info — edit any line if this page should show something different.
          </span>
          <div className="grid-2">
            <Field label="Phone">
              {(aria) => <input className="input" type="tel" placeholder="+234 800 000 0000" value={c.phone} onChange={(e) => edit((d) => (d.phone = e.target.value))} {...aria} />}
            </Field>
            <Field label="Email" error={errors.email}>
              {(aria) => (
                <input className="input" type="email" inputMode="email" placeholder="hello@yourstore.com" value={c.email} onChange={(e) => edit((d) => (d.email = e.target.value), 'email')} {...aria} />
              )}
            </Field>
          </div>
          <Field label="Address">
            {(aria) => <input className="input" placeholder="12 Awolowo Road, Ikoyi, Lagos" value={c.address} onChange={(e) => edit((d) => (d.address = e.target.value))} {...aria} />}
          </Field>
        </div>

        <div className="group">
          <div className="group-title">Contact form</div>
          <div className="group-hint">Add the fields customers fill in. Tap a field type to add it; mark each required or optional.</div>
          <div className="chip-row" style={{ marginBottom: 16 }}>
            {CONTACT_FIELD_TYPES.map(([type, label]) => (
              <AddButton key={type} size="sm" onClick={() => edit((d) => d.fields.push({ id: uid(), type, required: false, reasons: [] }))}>
                {label}
              </AddButton>
            ))}
          </div>

          {c.fields.length === 0 && <EmptyState title="No fields yet">Most stores start with Name, Email, and Message.</EmptyState>}

          <div className="stack-sm">
            {c.fields.map((f, i) => (
              <div key={f.id} className="item-card cream">
                <div className="field-row">
                  <span className="field-type">{contactTypeLabel(f.type)}</span>
                  <Toggle on={f.required} label={f.required ? 'Required' : 'Optional'} onChange={(on) => edit((d) => (d.fields[i].required = on))} />
                  <RemoveButton onClick={() => edit((d) => d.fields.splice(i, 1))} label={`Remove ${contactTypeLabel(f.type)} field`} />
                </div>
                {f.type === 'dropdown' && (
                  <div className="dropdown-reasons">
                    <div className="label" style={{ marginBottom: 10 }}>Reasons for enquiry</div>
                    <div className="stack-sm" style={{ marginBottom: 10 }}>
                      {f.reasons.map((r, k) => (
                        <div key={r.id} className="inline-row">
                          <input
                            className="input"
                            aria-label={`Reason ${k + 1}`}
                            placeholder="Reason (e.g. Wholesale enquiry)"
                            value={r.label}
                            onChange={(e) => edit((d) => (d.fields[i].reasons[k].label = e.target.value), `fields.${i}.reasons`)}
                          />
                          <RemoveButton small onClick={() => edit((d) => d.fields[i].reasons.splice(k, 1))} label={`Remove reason ${r.label || k + 1}`} />
                        </div>
                      ))}
                    </div>
                    <ErrorLine>{errors[`fields.${i}.reasons`]}</ErrorLine>
                    <AddButton size="sm" onClick={() => edit((d) => d.fields[i].reasons.push({ id: uid(), label: '' }), `fields.${i}.reasons`)}>
                      Add reason
                    </AddButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </StepCard>
  )
}
