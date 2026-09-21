import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { LOGIN_BRAND } from '../components/brandCopy.js'
import { LoadingLabel, PasswordField, TextField, useShowPassword } from '../components/Field.jsx'
import { ApiError } from '../lib/api.js'
import { isEmail } from '../lib/validation.js'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const pw = useShowPassword()

  const clear = (...keys) => setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => ![...keys, 'form'].includes(k))))

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
      await login(email.trim(), password)
      // PublicOnly sees the new session and redirects to onboarding (or the admin page).
    } catch (err) {
      setLoading(false)
      setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' })
    }
  }

  return (
    <AuthLayout
      pageLabel="Log in"
      headerLink={{ to: '/signup', text: 'New to Thyra? Create an account' }}
      brand={LOGIN_BRAND}
    >
      <form onSubmit={onSubmit} noValidate>
        <h2>Log in</h2>
        <p className="sub">Pick up right where you left off.</p>

        <div className="stack" style={{ marginBottom: 6 }}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@yourstore.com"
            value={email}
            error={errors.email}
            onChange={(e) => {
              setEmail(e.target.value)
              clear('email')
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
              clear('password')
            }}
          />
        </div>

        <div className="forgot-row" style={{ margin: '0 0 22px' }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <LoadingLabel>Logging in</LoadingLabel> : 'Log in'}
        </button>

        <p className="switch">
          New to Thyra? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
