import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { ACCOUNT_BRAND } from '../components/brandCopy.js'
import { LoadingLabel, PasswordField, TextField, useShowPassword } from '../components/Field.jsx'
import { ApiError } from '../lib/api.js'
import { isEmail } from '../lib/validation.js'

export default function SignUp() {
  const { register } = useAuth()
  const [values, setValues] = useState({ businessName: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const pw = useShowPassword()

  const bind = (name) => ({
    value: values[name],
    error: errors[name],
    onChange: (e) => {
      setValues((v) => ({ ...v, [name]: e.target.value }))
      setErrors((er) => ({ ...er, [name]: undefined, form: undefined }))
    },
  })

  async function onSubmit(e) {
    e.preventDefault()
    const { businessName, email, password, confirmPassword } = values
    const next = {}
    if (!businessName.trim()) next.businessName = 'Enter your business name.'
    if (!email.trim()) next.email = 'Enter your email.'
    else if (!isEmail(email)) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Choose a password.'
    else if (password.length < 8) next.password = 'Use at least 8 characters.'
    if (!confirmPassword) next.confirmPassword = 'Re-enter your password.'
    else if (password && confirmPassword !== password) next.confirmPassword = "Those passwords don't match."
    if (Object.keys(next).length) return setErrors(next)

    setErrors({})
    setLoading(true)
    try {
      await register({ businessName: businessName.trim(), email: email.trim(), password, confirmPassword })
      // The new account is signed in; PublicOnly redirects into onboarding.
    } catch (err) {
      setLoading(false)
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields)
      else setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' })
    }
  }

  return (
    <AuthLayout
      pageLabel="Create account"
      headerLink={{ to: '/login', text: 'Already have an account? Log in' }}
      brand={ACCOUNT_BRAND}
    >
      <form onSubmit={onSubmit} noValidate>
        <h2>Create your account</h2>
        <p className="sub">A few details and your store&apos;s numbers are ready.</p>

        <div className="stack">
          <TextField label="Business name" autoComplete="organization" placeholder="Adé Fine Jewellery" {...bind('businessName')} />
          <TextField label="Email" type="email" autoComplete="email" placeholder="you@yourstore.com" {...bind('email')} />
          <PasswordField label="Password" autoComplete="new-password" placeholder="At least 8 characters" {...pw} {...bind('password')} />
          <TextField
            label="Confirm password"
            type={pw.show ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            {...bind('confirmPassword')}
          />
        </div>

        {errors.form && (
          <p className="error-text" role="alert" style={{ margin: '-8px 0 14px' }}>
            {errors.form}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <LoadingLabel>Creating account</LoadingLabel> : 'Create account'}
        </button>

        <p className="switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
