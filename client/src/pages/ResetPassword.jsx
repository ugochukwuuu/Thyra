import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { ACCOUNT_BRAND } from '../components/brandCopy.js'
import { LoadingLabel, PasswordField, useShowPassword } from '../components/Field.jsx'
import { ApiError, api } from '../lib/api.js'

// Not in the Claude Design files (they stop at "Link sent"). Built from the same pieces.
export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const pw = useShowPassword()

  async function onSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!password) next.password = 'Choose a password.'
    else if (password.length < 8) next.password = 'Use at least 8 characters.'
    if (!confirm) next.confirmPassword = 'Re-enter your password.'
    else if (password && confirm !== password) next.confirmPassword = "Those passwords don't match."
    if (Object.keys(next).length) return setErrors(next)

    setErrors({})
    setLoading(true)
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { token, password, confirmPassword: confirm },
      })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError && err.fields.password) setErrors({ password: err.fields.password })
      else setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const brand = ACCOUNT_BRAND
  const headerLink = { to: '/login', text: 'Remembered it? Log in' }

  if (!token) {
    return (
      <AuthLayout pageLabel="Reset password" headerLink={headerLink} brand={brand}>
        <h2>This link isn&apos;t valid</h2>
        <p className="sub">The reset link is missing or incomplete. Request a new one and try again.</p>
        <Link to="/forgot-password" className="btn btn-primary btn-block">
          Request a new link
        </Link>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout pageLabel="Reset password" headerLink={headerLink} brand={brand}>
        <h2>Password updated</h2>
        <p className="sub">You can log in with your new password now.</p>
        <Link to="/login" className="btn btn-primary btn-block">
          Log in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout pageLabel="Reset password" headerLink={headerLink} brand={brand}>
      <form onSubmit={onSubmit} noValidate>
        <h2>Choose a new password</h2>
        <p className="sub">Use at least 8 characters. This link works once.</p>

        <div className="stack">
          <PasswordField
            label="New password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            error={errors.password}
            {...pw}
            onChange={(e) => {
              setPassword(e.target.value)
              setErrors({})
            }}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirm}
            error={errors.confirmPassword}
            {...pw}
            onChange={(e) => {
              setConfirm(e.target.value)
              setErrors({})
            }}
          />
        </div>

        {errors.form && (
          <div style={{ margin: '-8px 0 14px' }}>
            <p className="error-text" role="alert" style={{ margin: '0 0 6px' }}>
              {errors.form}
            </p>
            <Link to="/forgot-password" style={{ fontSize: 13, fontWeight: 600 }}>
              Request a new link
            </Link>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <LoadingLabel>Saving</LoadingLabel> : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  )
}
