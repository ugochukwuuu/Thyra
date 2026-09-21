import { uid } from '../model.js'
import { AddButton, Group, ItemCard, StepCard } from '../ui.jsx'
import { VoiceTextarea } from '../VoiceTextarea.jsx'

export default function AboutBrand({ data, update, errors, clearError }) {
  const a = data.aboutBrand
  const setText = (key) => (value) =>
    update('aboutBrand', (d) => {
      d[key] = value
    })
  const setRow = (list, index, key) => (e) =>
    update('aboutBrand', (d) => {
      d[list][index][key] = e.target.value
      if (list === 'values') clearError('values')
    })
  const removeRow = (list, index) => () =>
    update('aboutBrand', (d) => {
      d[list].splice(index, 1)
    })

  return (
    <StepCard
      number={4}
      name="About the brand"
      title="Tell your story"
      intro="This fills your About page. Write it like you'd explain the brand to a new customer in person. You can type, or tap the mic and speak."
    >
      <div className="stack-lg">
        <VoiceTextarea
          label="How it all started"
          hint="The origin story — as long or short as feels true."
          placeholder="The moment or reason you decided to start this."
          rows={5}
          value={a.story}
          onChange={setText('story')}
        />

        <div className="grid-2">
          <VoiceTextarea
            label="Our vision"
            hint="Where you're headed, in a sentence or two."
            placeholder="The change you want to see."
            rows={3}
            value={a.vision}
            onChange={setText('vision')}
          />
          <VoiceTextarea
            label="Our mission"
            hint="The job you're here to do, every day."
            placeholder="What you do for customers, every day."
            rows={3}
            value={a.mission}
            onChange={setText('mission')}
          />
        </div>

        <VoiceTextarea
          label="Why we're different"
          hint="The full story — deeper than the short version on your homepage."
          placeholder="The fuller version of what sets you apart."
          rows={5}
          value={a.whyDifferent}
          onChange={setText('whyDifferent')}
        />

        <Group title="Our values" hint="Add at least 3 — the principles that guide how you work. A title and a short explanation for each.">
          <div className="stack-md">
            {a.values.map((v, i) => (
              <ItemCard key={v.id} number={i + 1} onRemove={removeRow('values', i)} removeLabel={`Remove value ${i + 1}`}>
                <div className="stack-sm">
                  <input className="input" aria-label={`Value ${i + 1} title`} placeholder="Value (e.g. Craft over speed)" value={v.title} onChange={setRow('values', i, 'title')} />
                  <input
                    className="input"
                    aria-label={`Value ${i + 1} explanation`}
                    placeholder="Short explanation"
                    value={v.description}
                    onChange={setRow('values', i, 'description')}
                  />
                </div>
              </ItemCard>
            ))}
          </div>
          {errors.values && (
            <div className="error-text has-error" role="alert" style={{ margin: '12px 0' }}>
              {errors.values}
            </div>
          )}
          <AddButton
            onClick={() =>
              update('aboutBrand', (d) => {
                d.values.push({ id: uid(), title: '', description: '' })
                clearError('values')
              })
            }
          >
            Add value
          </AddButton>
        </Group>

        <Group title="Team members" hint="Optional — the people customers might want to know about.">
          <div className="stack-md">
            {a.team.map((m, i) => (
              <ItemCard key={m.id} number={i + 1} onRemove={removeRow('team', i)} removeLabel={`Remove team member ${i + 1}`}>
                <div className="grid-2">
                  <input className="input" aria-label={`Team member ${i + 1} name`} placeholder="Name" value={m.name} onChange={setRow('team', i, 'name')} />
                  <input className="input" aria-label={`Team member ${i + 1} role`} placeholder="Role (e.g. Founder)" value={m.role} onChange={setRow('team', i, 'role')} />
                </div>
              </ItemCard>
            ))}
          </div>
          <AddButton
            onClick={() =>
              update('aboutBrand', (d) => {
                d.team.push({ id: uid(), name: '', role: '' })
              })
            }
          >
            Add team member
          </AddButton>
        </Group>
      </div>
    </StepCard>
  )
}
