import { useRef, useState } from 'react'
import { FILE_KINDS, previewUrl } from './model.js'

/** The paper-coloured step card: eyebrow, heading, intro, then the step's fields. */
export function StepCard({ number, name, title, intro, children }) {
  return (
    <section className="card">
      <div className="eyebrow">
        Step {String(number).padStart(2, '0')} · {name}
      </div>
      <h1>{title}</h1>
      <p className="lede">{intro}</p>
      {children}
    </section>
  )
}

export function Group({ title, hint, children }) {
  return (
    <div className="group">
      <div className="group-title">{title}</div>
      {hint && <div className="group-hint">{hint}</div>}
      {children}
    </div>
  )
}

/** "–" control that removes one item from a repeatable list. */
export function RemoveButton({ onClick, label, small }) {
  return (
    <button type="button" className={`remove-btn${small ? ' small' : ''}`} onClick={onClick} aria-label={label} title={label}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  )
}

/** Click-to-add control for a repeatable list. */
export function AddButton({ onClick, children, size = 'md', disabled }) {
  return (
    <button type="button" className={`add-btn ${size}`} onClick={onClick} disabled={disabled}>
      <span aria-hidden="true">+</span>
      {children}
    </button>
  )
}

/** A numbered card in a repeatable list, with the "–" control top right. */
export function ItemCard({ number, label, onRemove, removeLabel, children, tone = 'cream' }) {
  return (
    <div className={`item-card ${tone}`}>
      <div className="item-head">
        <span className="item-num">
          {String(number).padStart(2, '0')}
          {label && <span className="item-label">{label}</span>}
        </span>
        <RemoveButton onClick={onRemove} label={removeLabel} />
      </div>
      {children}
    </div>
  )
}

export function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="toggle-row" onClick={() => onChange(!on)}>
      <span className="toggle-label">{label}</span>
      <span className={`toggle-track${on ? ' on' : ''}`}>
        <span className="toggle-knob" />
      </span>
    </button>
  )
}

export function Chip({ active, onClick, small, children }) {
  return (
    <button type="button" className={`chip${small ? ' small' : ''}${active ? ' active' : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      <div>{children}</div>
    </div>
  )
}

export const ErrorLine = ({ children }) =>
  children ? (
    <span className="error-text has-error" role="alert">
      {children}
    </span>
  ) : null

/**
 * Upload control for one or many files. `files` is the stored list (for a single-file field, pass
 * `[value]` or `[]`); `onChange` receives the new list. Files go to Cloudinary through the API and
 * we keep the public URLs it returns.
 */
export function FilePicker({ kind, files, onChange, uploadFiles, multiple = false, label, maxFiles = 20 }) {
  const config = FILE_KINDS[kind]
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onPick(e) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // lets the same file be picked again later
    if (!picked.length) return
    setError('')

    if (files.length + picked.length > maxFiles) return setError(`You can add up to ${maxFiles} files here.`)
    if (picked.some((f) => !config.types.includes(f.type))) return setError(config.message)
    if (picked.some((f) => f.size > config.maxBytes)) return setError(`Each file must be ${config.maxBytes / (1024 * 1024)} MB or smaller.`)

    setBusy(true)
    try {
      const stored = await uploadFiles(picked, kind)
      onChange(multiple ? [...files, ...stored] : stored.slice(0, 1))
    } catch (err) {
      setError(err.message || 'The upload failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const remove = (index) => onChange(files.filter((_, i) => i !== index))
  const idleLabel = files.length && multiple ? `Add more ${label.toLowerCase()}` : files.length ? 'Replace' : `Upload ${label.toLowerCase()}`

  return (
    <div className="uploader">
      {files.length > 0 && (
        <ul className="thumbs">
          {files.map((file, i) => (
            <li key={file.publicId} className={file.resourceType === 'raw' ? 'file-chip' : 'thumb'}>
              {file.resourceType === 'raw' ? (
                <>
                  <a href={file.url} target="_blank" rel="noreferrer" title={file.name}>
                    {file.name || 'Document'}
                  </a>
                  <RemoveButton small onClick={() => remove(i)} label={`Remove ${file.name || 'document'}`} />
                </>
              ) : (
                <>
                  <img src={previewUrl(file)} alt={file.name || `${label} ${i + 1}`} loading="lazy" />
                  {file.resourceType === 'video' && <span className="play" aria-hidden="true">▶</span>}
                  <button type="button" className="thumb-remove" onClick={() => remove(i)} aria-label={`Remove ${file.name || `${label} ${i + 1}`}`}>
                    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div>
        <input ref={inputRef} type="file" accept={config.accept} multiple={multiple} hidden onChange={onPick} />
        <button type="button" className="btn btn-outline small" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Uploading…' : idleLabel}
        </button>
      </div>
      {error && (
        <span className="error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

/** Search-and-tick list of the products from the Shop page, capped at `max` picks. */
export function ProductPicker({ products, selected, max, onChange, emptyText }) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const label = (p, i) => p.name.trim() || `Product ${String(i + 1).padStart(2, '0')}`
  const rows = products.map((p, i) => ({ id: p.id, label: label(p, i) })).filter((r) => !q || r.label.toLowerCase().includes(q))
  const picked = selected.filter((id) => products.some((p) => p.id === id))

  if (products.length === 0) return <div className="empty compact">{emptyText}</div>

  return (
    <div>
      <div className="picker-count" aria-live="polite">
        {picked.length} of {max} selected
      </div>
      <input className="input picker-search" placeholder="Search your products" aria-label="Search your products" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="picker-list">
        {rows.map((r) => {
          const checked = picked.includes(r.id)
          const atCap = picked.length >= max && !checked
          return (
            <button
              key={r.id}
              type="button"
              role="checkbox"
              aria-checked={checked}
              disabled={atCap}
              className={`picker-row${checked ? ' checked' : ''}`}
              onClick={() => onChange(checked ? picked.filter((id) => id !== r.id) : [...picked, r.id])}
            >
              <span className="box">{checked ? '✓' : ''}</span>
              <span>{r.label}</span>
            </button>
          )
        })}
        {rows.length === 0 && <div className="picker-none">No products match “{search}”.</div>}
      </div>
    </div>
  )
}

const ICON_PATHS = {
  business: ['M3 21V9l3-6h12l3 6v12', 'M3 9h18', 'M9 21v-6h6v6'],
  shop: ['M6 8h12l1 12H5z', 'M9 8a3 3 0 0 1 6 0'],
  home: ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
  about: ['M4 5c2.5-1.5 6-1.5 8 0 2-1.5 5.5-1.5 8 0v13c-2.5-1.5-6-1.5-8 0-2-1.5-5.5-1.5-8 0z', 'M12 5v13'],
  contact: ['M3 6h18v12H3z', 'M3 7l9 6 9-6'],
  inspiration: ['M12 3l2.1 5.4L20 9l-4.5 3.4L17 18l-5-3.2L7 18l1.5-5.6L4 9l5.9-.6z'],
  identity: [
    'M12 3a9 9 0 1 0 0 18c1.7 0 2-1.3 1.2-2.3-.8-1 .1-2.2 1.3-2.2H18a3 3 0 0 0 3-3c0-4.9-4-8.5-9-8.5z',
    'M7.5 12.5h.01',
    'M10 8h.01',
    'M14.5 8h.01',
  ],
  social: ['M18 8a3 3 0 1 0-2.8-4', 'M6 15a3 3 0 1 0 2.8 4', 'M8.6 13.5l6.8-4', 'M8.6 10.5l6.8 4'],
  policies: ['M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z', 'M9 12l2 2 4-4'],
  review: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M8.5 12l2.2 2.2L15.5 9.5'],
}

export function StepIcon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
