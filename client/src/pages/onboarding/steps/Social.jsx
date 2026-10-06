import { uid } from '../model.js'
import { AddButton, EmptyState, ErrorLine, RemoveButton, StepCard } from '../ui.jsx'

export default function Social({ data, update, errors, clearError, options }) {
  const items = data.socialMedia.items
  const platforms = options.socialPlatforms.length ? options.socialPlatforms : ['Instagram']
  // Keep a platform the client already chose, even if an admin has since removed it from the list.
  const choicesFor = (current) => (platforms.includes(current) ? platforms : [current, ...platforms])

  const edit = (mutate, errorKey) =>
    update('socialMedia', (d) => {
      mutate(d)
      if (errorKey) clearError(errorKey)
    })

  return (
    <StepCard
      number={8}
      name="Social media"
      title="Link your profiles"
      intro="We'll connect these to your store so customers can find and follow you."
    >
      {items.length === 0 && <EmptyState title="No profiles yet">Add the platforms where customers already find you.</EmptyState>}
      <div className="stack-sm" style={{ marginBottom: 16 }}>
        {items.map((s, i) => (
          <div key={s.id}>
            <div className="social-row">
              <select className="select" aria-label={`Platform for profile ${i + 1}`} value={s.platform} onChange={(e) => edit((d) => (d.items[i].platform = e.target.value))}>
                {choicesFor(s.platform).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                className="input"
                aria-label={`Profile link ${i + 1}`}
                aria-invalid={errors[`items.${i}.link`] ? 'true' : undefined}
                placeholder="Profile link"
                value={s.link}
                onChange={(e) => edit((d) => (d.items[i].link = e.target.value), `items.${i}.link`)}
              />
              <RemoveButton onClick={() => edit((d) => d.items.splice(i, 1))} label={`Remove ${s.platform} profile`} />
            </div>
            <ErrorLine>{errors[`items.${i}.link`]}</ErrorLine>
          </div>
        ))}
      </div>
      <AddButton onClick={() => edit((d) => d.items.push({ id: uid(), platform: platforms[0], link: '' }))}>Add profile</AddButton>
    </StepCard>
  )
}
