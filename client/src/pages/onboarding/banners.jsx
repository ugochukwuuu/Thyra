import { useState } from 'react'

/** Shown until the client confirms their email; submitting is blocked until then. */
export function VerifyBanner({ email, resend }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="resume-banner verify-banner" role="status">
      <i />
      <span>
        Confirm your email so we can reach you. We sent a link to <strong>{email}</strong>. You can keep filling this in, but you&apos;ll need to
        confirm before you submit.
      </span>
      {note ? (
        <span className="hint" style={{ marginLeft: 'auto' }}>
          {note}
        </span>
      ) : (
        <button
          type="button"
          className="link-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setNote(await resend())
          }}
        >
          {busy ? 'Sending…' : 'Resend link'}
        </button>
      )}
    </div>
  )
}

/** The Thyra team's notes for the current step, at the top of it. */
export function ChangeNotes({ requests }) {
  if (!requests.length) return null
  return (
    <div className="change-notes">
      {requests.map((r) => (
        <div key={r.id} className="change-note" role="note">
          <div className="change-note-title">The Thyra team asked for a change here</div>
          <p>{r.message}</p>
          {r.flaggedItems.length > 0 && <div className="hint">About: {r.flaggedItems.join(', ')}</div>}
        </div>
      ))}
    </div>
  )
}
