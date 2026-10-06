import { useCallback, useEffect, useRef, useState } from 'react'
import { STATUS_LABELS } from './format.js'
import { ToastContext } from './toast.js'

export function Pill({ kind, children }) {
  return <span className={`pill ${kind}`}>{children}</span>
}

export const StatusPill = ({ status }) => <Pill kind={status}>{STATUS_LABELS[status]}</Pill>

export function Dots() {
  return (
    <span className="dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

export function Busy({ busy, label, busyLabel }) {
  return busy ? (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {busyLabel}
      <Dots />
    </span>
  ) : (
    label
  )
}

/** Closes on Escape and returns focus to whatever opened it. */
function useDialog(onClose) {
  const ref = useRef(null)
  useEffect(() => {
    const opener = document.activeElement
    ref.current?.querySelector('input, textarea, select, button:not(.sheet-close)')?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
    // Run once per open; onClose may change identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ref
}

/** Side panel on desktop, full screen on phones. */
export function Panel({ title, onClose, children, footer, intro }) {
  const ref = useDialog(onClose)
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="sheet panel">
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {intro && <p className="sheet-text">{intro}</p>}
        <div className="sheet-body">{children}</div>
        <div className="sheet-foot">{footer}</div>
      </div>
    </>
  )
}

/** Centred dialog on desktop, full screen on phones. */
export function Modal({ title, onClose, children, footer, alert = false }) {
  const ref = useDialog(onClose)
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} role={alert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={title} className="sheet modal">
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
        <div className="sheet-foot">{footer}</div>
      </div>
    </>
  )
}

export function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="sw" onClick={() => onChange(!on)}>
      <span className="track">
        <span className="knob" />
      </span>
    </button>
  )
}

// ---- Toasts ----

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const show = useCallback((message, tone = 'ok') => {
    clearTimeout(timer.current)
    setToast({ message, tone })
    timer.current = setTimeout(() => setToast(null), 4000)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div role="status" className={`toast ${toast.tone}`}>
          <span className="tick">
            {toast.tone === 'error' ? (
              <span style={{ color: '#E7A38A', fontWeight: 700 }}>!</span>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D9714E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.5 12.5l4 4 9-9" />
              </svg>
            )}
          </span>
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function SearchBox({ value, onChange }) {
  return (
    <div className="search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B655C" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20 20l-4.2-4.2" />
      </svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search by business name or email" aria-label="Search by business name or email" />
    </div>
  )
}

export function DownloadIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M5 19.5h14" />
    </svg>
  )
}
