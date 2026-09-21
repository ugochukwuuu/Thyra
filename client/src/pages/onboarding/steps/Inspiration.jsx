import { uid } from '../model.js'
import { AddButton, EmptyState, ErrorLine, FilePicker, ItemCard, StepCard } from '../ui.jsx'

export default function Inspiration({ data, update, errors, clearError, uploadFiles }) {
  const items = data.inspiration.items

  const edit = (mutate, errorKey) =>
    update('inspiration', (d) => {
      mutate(d)
      if (errorKey) {
        clearError(errorKey)
        clearError(errorKey.replace(/\.link$/, ''))
      }
    })

  return (
    <StepCard
      number={6}
      name="Design inspiration"
      title="Show us what you love"
      intro="Sites, stores, or screenshots you admire — and a note on what caught your eye. Add as many as you like."
    >
      {items.length === 0 && <EmptyState title="Nothing added yet">Paste a link or drop a screenshot of a look you&apos;d like.</EmptyState>}
      <div className="stack-md" style={{ marginBottom: 16 }}>
        {items.map((it, i) => (
          <ItemCard key={it.id} number={i + 1} onRemove={() => edit((d) => d.items.splice(i, 1))} removeLabel={`Remove inspiration ${i + 1}`}>
            <div className="stack-sm">
              <input
                className="input"
                aria-label={`Inspiration ${i + 1} link`}
                aria-invalid={errors[`items.${i}.link`] || errors[`items.${i}`] ? 'true' : undefined}
                placeholder="Paste a link (https://…)"
                value={it.link}
                onChange={(e) => edit((d) => (d.items[i].link = e.target.value), `items.${i}.link`)}
              />
              <ErrorLine>{errors[`items.${i}.link`] ?? errors[`items.${i}`]}</ErrorLine>
              <FilePicker
                kind="image"
                label="Screenshot"
                files={it.screenshot ? [it.screenshot] : []}
                uploadFiles={uploadFiles}
                onChange={(files) => edit((d) => (d.items[i].screenshot = files[0] ?? null), `items.${i}`)}
              />
              <input
                className="input"
                aria-label={`Inspiration ${i + 1} note`}
                placeholder="What do you like about it? (optional)"
                value={it.note}
                onChange={(e) => edit((d) => (d.items[i].note = e.target.value))}
              />
            </div>
          </ItemCard>
        ))}
      </div>
      <AddButton onClick={() => edit((d) => d.items.push({ id: uid(), link: '', screenshot: null, note: '' }))}>Add inspiration</AddButton>
    </StepCard>
  )
}
