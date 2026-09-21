import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { ACCOUNT_BRAND } from '../components/brandCopy.js'
import { LoadingLabel, TextField } from '../components/Field.jsx'
import { ApiError, api } from '../lib/api.js'
import { isEmail } from '../lib/validation.js'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return setError('Enter your email.')
    if (!isEmail(email)) return setError('Enter a valid email address.')

    setError('')
    setSent(false)
    setLoading(true)
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      pageLabel="Reset password"
      headerLink={{ to: '/login', text: 'Remembered it? Log in' }}
      brand={ACCOUNT_BRAND}
    >
      <form onSubmit={onSubmit} noValidate>
        <h2>Reset your password</h2>
        <p className="sub">We&apos;ll email you a secure link to set a new one.</p>

        <div className="stack">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@yourstore.com"
            value={email}
            error={error}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <LoadingLabel>Sending link</LoadingLabel> : 'Send reset link'}
        </button>

        {sent && (
          <div className="notice" role="status" style={{ marginTop: 16 }}>
            Link sent — it expires in 15 minutes.
          </div>
        )}

        <p className="switch">
          Remembered it? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
