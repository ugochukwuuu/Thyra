import { POLICIES } from '../model.js'
import { StepCard, Toggle } from '../ui.jsx'
import { VoiceTextarea } from '../VoiceTextarea.jsx'

export default function Policies({ data, update }) {
  const set = (key, mutate) =>
    update('policies', (d) => {
      mutate(d[key])
    })

  return (
    <StepCard
      number={9}
      name="Policy pages"
      title="The fine print"
      intro="Write these in your own words, or tick the box and we'll draft them for you to approve. Every one can be left blank."
    >
      <div className="stack-lg">
        {POLICIES.map(([key, label, placeholder]) => {
          const policy = data.policies[key]
          return (
            <div key={key} className="stack-sm">
              <div className="policy-head">
                <span className="label">{label}</span>
                <Toggle on={policy.draft} label="Help me draft this" onChange={(on) => set(key, (p) => (p.draft = on))} />
              </div>
              {policy.draft ? (
                <div className="draft-note" role="status">
                  Great — the Thyra team will draft your {label.toLowerCase()} and send it for approval before launch.
                </div>
              ) : (
                <VoiceTextarea
                  hideLabel
                  label={label}
                  hint="Optional — you can leave this blank."
                  placeholder={placeholder}
                  rows={5}
                  value={policy.text}
                  onChange={(value) => set(key, (p) => (p.text = value))}
                />
              )}
            </div>
          )
        })}
      </div>
    </StepCard>
  )
}
