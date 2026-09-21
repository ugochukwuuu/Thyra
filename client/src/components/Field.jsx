import { useId, useState } from 'react'

/** Label + input + optional hint + error, wired together for screen readers. */
export function Field({ label, error, hint, children, className = '', hideLabel = false }) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy })}
      {hint && (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-err`} className="error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export function TextField({ label, error, hint, className, ...inputProps }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(aria) => <input className="input" {...aria} {...inputProps} />}
    </Field>
  )
}

export function PasswordField({ label, error, hint, show, onToggle, ...inputProps }) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(aria) => (
        <div className="password-wrap">
          <input className="input" type={show ? 'text' : 'password'} {...aria} {...inputProps} />
          <button type="button" className="password-toggle" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      )}
    </Field>
  )
}

/** Show/hide state shared by a password field and its confirmation. */
// eslint-disable-next-line react-refresh/only-export-components
export function useShowPassword() {
  const [show, setShow] = useState(false)
  return { show, onToggle: () => setShow((s) => !s) }
}

export function LoadingLabel({ children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {children}
      <span className="dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </span>
  )
}
