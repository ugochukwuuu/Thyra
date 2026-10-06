import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { LoadingLabel, PasswordField, TextField, useShowPassword } from '../../components/Field.jsx'
import { LogoMark } from '../../components/Logo.jsx'
import { ApiError, api } from '../../lib/api.js'
import { isEmail } from '../../lib/validation.js'
import './admin.css'

/** Charcoal brand panel on the left ("Thyra admin"), form on the right. Staff only. */
function AdminAuthLayout({ children }) {
  return (
    <div className="auth-page">
      <div className="adm-topbar mobile-only" style={{ position: 'static' }}>
        <div className="adm-brand" style={{ padding: 0 }}>
          <LogoMark />
          <span>Thyra</span>
          <span className="tag">Admin</span>
        </div>
      </div>
      <div className="auth-body">
        <div className="auth-brand desktop-only" style={{ justifyContent: 'flex-start' }}>
          <div className="adm-brand" style={{ fontSize: 26, padding: 0 }}>
            <LogoMark />
            <span>Thyra</span>
          </div>
          <div style={{ fontSize: 15, color: 'var(--dmuted)', marginTop: -20 }}>Thyra admin</div>
        </div>
        <div className="auth-form-panel">
          <div className="auth-form-center">
            <div className="auth-form">{children}</div>
          </div>
          <footer className="auth-footer">
            <div className="links">
              <Link to="/legal/terms">Terms</Link>
              <Link to="/legal/privacy">Privacy</Link>
              <Link to="/legal/cookies">Cookies</Link>
            </div>
            <span>© 2026 Thyra Technologies</span>
          </footer>
        </div>
      </div>
    </div>
  )
}

const BackToLogin = () => (
  <p className="switch">
    <Link to="/admin/login">Back to log in</Link>
  </p>
)

export function AdminLogin() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const pw = useShowPassword()

  async function onSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!email.trim()) next.email = 'Enter your email.'
    else if (!isEmail(email)) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Enter your password.'
    if (Object.keys(next).length) return setErrors(next)
    setErrors({})
    setLoading(true)
    try {
      await login(email.trim(), password, 'staff')
      navigate(location.state?.from ?? '/admin/submissions', { replace: true })
    } catch (err) {
      setLoading(false)
      setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' })
    }
  }

  return (
    <AdminAuthLayout>
      <form onSubmit={onSubmit} noValidate>
        <h2>Admin log in</h2>
        <p className="sub">For Thyra staff only.</p>
        <div className="stack" style={{ marginBottom: 6 }}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@thyratechnology.com"
            value={email}
            error={errors.email}
            onChange={(e) => {
              setEmail(e.target.value)
              setErrors({})
            }}
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            error={errors.password ?? errors.form}
            {...pw}
            onChange={(e) => {
              setPassword(e.target.value)
              setErrors({})
            }}
          />
        </div>
        <div className="forgot-row" style={{ margin: '0 0 22px' }}>
          <Link to="/admin/forgot-password">Forgot password?</Link>
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <LoadingLabel>Logging in</LoadingLabel> : 'Log in'}
        </button>
      </form>
    </AdminAuthLayout>
  )
}

const RESEND_SECONDS = 30

export function AdminForgotPassword() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [step, setStep] = useState(params.get('sent') === '1' ? 'sent' : 'request')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [secs, setSecs] = useState(params.get('sent') === '1' ? RESEND_SECONDS : 0)
  const [resentNote, setResentNote] = useState(params.get('resent') === '1')
  const timer = useRef(null)

  useEffect(() => {
    if (secs <= 0) return
    timer.current = setTimeout(() => setSecs((s) => s - 1), 1000)
    return () => clearTimeout(timer.current)
  }, [secs])

  async function send() {
    setLoading(true)
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } })
      setStep('sent')
      setSecs(RESEND_SECONDS)
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return setError('Enter your email.')
    if (!isEmail(email)) return setError('Enter a valid email address.')
    setError('')
    await send()
  }

  if (step === 'sent') {
    return (
      <AdminAuthLayout>
        <h2>Check your inbox</h2>
        <p className="sub">
          If an account exists for <strong>{email}</strong>, a reset link is on its way. Can&apos;t find it? Check your spam or promotions folder.
        </p>
        <button
          type="button"
          className="btn btn-outline btn-block"
          disabled={secs > 0 || loading}
          onClick={async () => {
            if (await send()) setResentNote(true)
          }}
        >
          {loading ? <LoadingLabel>Sending</LoadingLabel> : secs > 0 ? `Resend in ${secs}s` : 'Resend email'}
        </button>
        {resentNote && (
          <div className="notice" role="status" style={{ marginTop: 16 }}>
            New link sent.
          </div>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <p className="switch">
          <button
            type="button"
            className="link-muted"
            style={{ fontSize: 14 }}
            onClick={() => {
              setStep('request')
              setResentNote(false)
            }}
          >
            Wrong email? Try another
          </button>
        </p>
        <BackToLogin />
      </AdminAuthLayout>
    )
  }

  return (
    <AdminAuthLayout>
      <form onSubmit={onSubmit} noValidate>
        <h2>Reset your password</h2>
        <p className="sub">Enter your email and we&apos;ll send you a reset link.</p>
        <div className="stack">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@thyratechnology.com"
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
        <BackToLogin />
      </form>
    </AdminAuthLayout>
  )
}

export function AdminResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''
  const [step, setStep] = useState(token ? 'set' : 'expired')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const pw = useShowPassword()

  async function onSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!password) next.password = 'Choose a new password.'
    else if (password.length < 8) next.password = 'Use at least 8 characters.'
    if (!confirm) next.confirm = 'Re-enter your new password.'
    else if (password && confirm !== password) next.confirm = "Those passwords don't match."
    if (Object.keys(next).length) return setErrors(next)
    setErrors({})
    setLoading(true)
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password, confirmPassword: confirm } })
      setStep('done')
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && !err.fields.password) setStep('expired')
      else setErrors({ password: err.fields?.password ?? err.message })
    } finally {
      setLoading(false)
    }
  }

  async function requestNew() {
    if (!email) return navigate('/admin/forgot-password')
    setLoading(true)
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } })
      navigate(`/admin/forgot-password?sent=1&resent=1&email=${encodeURIComponent(email)}`)
    } catch {
      navigate('/admin/forgot-password')
    }
  }

  if (step === 'done') {
    return (
      <AdminAuthLayout>
        <h2>Password updated.</h2>
        <p className="sub">Log in with your new password to pick up where you left off.</p>
        <Link to="/admin/login" className="btn btn-primary btn-block">
          Log in
        </Link>
      </AdminAuthLayout>
    )
  }

  if (step === 'expired') {
    return (
      <AdminAuthLayout>
        <h2>This link has expired.</h2>
        <p className="sub">Reset links last 1 hour. Request a new one and we&apos;ll send it straight away.</p>
        <button type="button" className="btn btn-primary btn-block" disabled={loading} onClick={requestNew}>
          {loading ? <LoadingLabel>Sending</LoadingLabel> : 'Send a new link'}
        </button>
        <BackToLogin />
      </AdminAuthLayout>
    )
  }

  return (
    <AdminAuthLayout>
      <form onSubmit={onSubmit} noValidate>
        <h2>Choose a new password</h2>
        <p className="sub">Use at least 8 characters. You&apos;ll use it to log in from now on.</p>
        <div className="stack">
          <PasswordField
            label="New password"
            autoComplete="new-password"
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
            value={confirm}
            error={errors.confirm}
            {...pw}
            onChange={(e) => {
              setConfirm(e.target.value)
              setErrors({})
            }}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <LoadingLabel>Updating password</LoadingLabel> : 'Update password'}
        </button>
        <BackToLogin />
      </form>
    </AdminAuthLayout>
  )
}

export function JoinTeam() {
  const [params] = useSearchParams()
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [invite, setInvite] = useState(null)
  const [step, setStep] = useState(token ? 'loading' : 'invalid')
  const [values, setValues] = useState({ fullName: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const pw = useShowPassword()

  useEffect(() => {
    if (!token) return
    api(`/auth/invites/${encodeURIComponent(token)}`)
      .then(({ invite: inv }) => {
        if (inv.kind !== 'staff') return setStep('invalid')
        setInvite(inv)
        setStep(inv.expired ? 'expired' : 'join')
      })
      .catch(() => setStep('invalid'))
  }, [token])

  const inviter = invite?.inviterName || params.get('inviter') || 'The Thyra team'
  const role = invite ? (invite.role === 'admin' ? 'Admin' : 'Viewer') : params.get('role') || 'Viewer'

  const bind = (k) => ({
    value: values[k],
    error: errors[k === 'confirm' ? 'confirmPassword' : k],
    onChange: (e) => {
      setValues((v) => ({ ...v, [k]: e.target.value }))
      setErrors({})
    },
  })

  async function onSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!values.fullName.trim()) next.fullName = 'Enter your full name.'
    if (!values.password) next.password = 'Choose a password.'
    else if (values.password.length < 8) next.password = 'Use at least 8 characters.'
    if (!values.confirm) next.confirmPassword = 'Re-enter your password.'
    else if (values.password && values.confirm !== values.password) next.confirmPassword = "Those passwords don't match."
    if (Object.keys(next).length) return setErrors(next)
    setLoading(true)
    try {
      const { user } = await api('/auth/join-team', {
        method: 'POST',
        body: { token, fullName: values.fullName.trim(), password: values.password, confirmPassword: values.confirm },
      })
      setUser(user)
      navigate('/admin/submissions', { replace: true })
    } catch (err) {
      setLoading(false)
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields)
      else setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' })
    }
  }

  if (step === 'loading') return <div className="splash">Checking your invite…</div>

  if (step === 'expired' || step === 'invalid') {
    return (
      <AdminAuthLayout>
        <h2>{step === 'expired' ? 'This invite has expired.' : "This invite can't be used."}</h2>
        <p className="sub">{step === 'expired' ? `Ask ${inviter} to send a new one.` : 'It may have been cancelled or already used. Ask the person who invited you to send a new one.'}</p>
        <Link to="/admin/login" className="btn btn-primary btn-block">
          Back to log in
        </Link>
      </AdminAuthLayout>
    )
  }

  return (
    <AdminAuthLayout>
      <form onSubmit={onSubmit} noValidate>
        <h2>Join the Thyra team</h2>
        <p className="sub">
          {inviter} invited you as {role}.
        </p>
        <div className="stack">
          <div className="field">
            <span className="label">Email</span>
            <span style={{ fontSize: 15 }}>{invite.email}</span>
          </div>
          <TextField label="Full name" autoComplete="name" {...bind('fullName')} />
          <PasswordField label="Password" autoComplete="new-password" placeholder="At least 8 characters" {...pw} {...bind('password')} />
          <TextField label="Confirm password" type={pw.show ? 'text' : 'password'} autoComplete="new-password" {...bind('confirm')} />
        </div>
        {errors.form && (
          <p className="error-text" role="alert" style={{ margin: '-8px 0 14px' }}>
            {errors.form}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <LoadingLabel>Joining</LoadingLabel> : 'Join team'}
        </button>
        <p className="switch">
          Already have an account? <Link to="/admin/login">Log in</Link>
        </p>
      </form>
    </AdminAuthLayout>
  )
}
