import { HEX_RE, LOGO_SLOTS, MAX_TONES, TONES } from '../model.js'
import { ErrorLine, FilePicker, StepCard } from '../ui.jsx'

export default function Identity({ data, update, errors, clearError, uploadFiles }) {
  const v = data.visualIdentity

  const edit = (mutate, errorKey) =>
    update('visualIdentity', (d) => {
      mutate(d)
      if (errorKey) clearError(errorKey)
    })

  const raw = v.brandColor.trim()
  const valid = HEX_RE.test(raw)
  const hex = valid ? `#${raw.replace('#', '')}` : '#D9714E'
  const atCap = v.tones.length >= MAX_TONES

  return (
    <StepCard
      number={7}
      name="Visual identity"
      title="Your look and logos"
      intro="Give us your brand's tone and logo files so everything matches from day one."
    >
      <div className="stack-lg">
        <div className="field">
          <span className="label" id="tone-label">Business tone</span>
          <span className="hint">
            Pick one or two that fit best — this steers colours, type, and imagery. Not sure? The note under each one explains it in plain terms.
          </span>
          <div className="tone-grid" role="group" aria-labelledby="tone-label">
            {TONES.map(([tone, desc]) => {
              const active = v.tones.includes(tone)
              const locked = atCap && !active
              return (
                <button
                  key={tone}
                  type="button"
                  className={`tone${active ? ' active' : ''}`}
                  aria-pressed={active}
                  disabled={locked}
                  onClick={() =>
                    edit((d) => {
                      const i = d.tones.indexOf(tone)
                      if (i >= 0) d.tones.splice(i, 1)
                      else if (d.tones.length < MAX_TONES) d.tones.push(tone)
                    })
                  }
                >
                  <span className="tone-name">
                    <i />
                    {tone}
                  </span>
                  <span className="tone-desc">{desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="group">
          <div className="group-title" style={{ fontSize: 16 }}>Logo files</div>
          <div className="group-hint">Upload whatever you have — we&apos;ll clean them up if needed.</div>
          <div className="grid-logos">
            {LOGO_SLOTS.map(([slot, label, hint]) => (
              <div key={slot} className="item-card cream">
                <div className="logo-slot-title">{label}</div>
                <div className="hint" style={{ marginBottom: 12 }}>{hint}</div>
                <FilePicker
                  kind="image"
                  label="Logo"
                  files={v.logos[slot] ? [v.logos[slot]] : []}
                  uploadFiles={uploadFiles}
                  onChange={(files) => edit((d) => (d.logos[slot] = files[0] ?? null))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="group">
          <div className="field">
            <label className="label" htmlFor="brand-color">Base brand colour</label>
            <span className="hint">Your main brand colour. Pick it below, or paste the exact hex code if you already know it.</span>
            <div className="color-row">
              <label className="swatch" style={{ background: valid ? hex : 'var(--cream)' }}>
                <span className="sr-only">Pick a colour</span>
                <input type="color" value={hex} onChange={(e) => edit((d) => (d.brandColor = e.target.value.toUpperCase()), 'brandColor')} />
              </label>
              <input
                id="brand-color"
                className="input hex-input"
                placeholder="#D9714E"
                value={v.brandColor}
                aria-invalid={errors.brandColor ? 'true' : undefined}
                onChange={(e) => edit((d) => (d.brandColor = e.target.value), 'brandColor')}
              />
            </div>
            <ErrorLine>{errors.brandColor}</ErrorLine>
          </div>
        </div>

        <div className="group">
          <div className="field">
            <span className="label">
              Brand guide <span style={{ fontWeight: 500, color: 'var(--grey)' }}>— optional</span>
            </span>
            <span className="hint">
              If you already have a brand or style guide (a PDF or doc), add it here. No guide yet? Skip this — we&apos;ll build one with you.
            </span>
            <FilePicker
              kind="document"
              label="Brand guide"
              files={v.brandGuide ? [v.brandGuide] : []}
              uploadFiles={uploadFiles}
              onChange={(files) => edit((d) => (d.brandGuide = files[0] ?? null))}
            />
          </div>
        </div>
      </div>
    </StepCard>
  )
}
