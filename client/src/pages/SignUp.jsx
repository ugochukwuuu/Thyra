import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { ACCOUNT_BRAND } from '../components/brandCopy.js'
import { LoadingLabel, PasswordField, TextField, useShowPassword } from '../components/Field.jsx'
import { ApiError, api } from '../lib/api.js'
import { isEmail } from '../lib/validation.js'

const HEADER_LINK = { to: '/login', text: 'Already have an account? Log in' }

export default function SignUp() {
  const { refresh } = useAuth()
  const [params] = useSearchParams()
  const inviteToken = params.get('invite')

  // 'loading' while an invite link is checked, then 'form', 'done' (self sign-up) or 'bad-invite'.
  const [phase, setPhase] = useState(inviteToken ? 'loading' : 'form')
  const [invite, setInvite] = useState(null)
  const [inviteError, setInviteError] = useState('')
  const [values, setValues] = useState({ businessName: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const pw = useShowPassword()

  useEffect(() => {
    if (!inviteToken) return
    let cancelled = false
    api(`/auth/invites/${encodeURIComponent(inviteToken)}`)
      .then(({ invite: inv }) => {
        if (cancelled) return
        if (inv.kind !== 'client') throw new ApiError(404, 'This invite link is no longer valid.')
        if (inv.expired) {
          setInviteError('This invite has expired. Ask the Thyra team to send you a new one.')
          return setPhase('bad-invite')
        }
        setInvite(inv)
        setValues((v) => ({ ...v, businessName: inv.businessName ?? '', email: inv.email }))
        setPhase('form')
      })
      .catch((err) => {
        if (cancelled) return
        setInviteError(err instanceof ApiError ? err.message : 'We could not check this invite link.')
        setPhase('bad-invite')
      })
    return () => {
      cancelled = true
    }
  }, [inviteToken])

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
      await api('/auth/register', {
        method: 'POST',
        body: { businessName: businessName.trim(), email: email.trim(), password, confirmPassword, ...(invite && { inviteToken }) },
      })
      // An invite already proves the email, so go straight in. Otherwise show the "check your inbox" note first.
      if (invite) await refresh()
      else setPhase('done')
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields)
      else setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'loading') return <div className="splash">Checking your invite…</div>

  if (phase === 'bad-invite') {
    return (
      <AuthLayout pageLabel="Create account" headerLink={HEADER_LINK} brand={ACCOUNT_BRAND}>
        <h2>This invite can&apos;t be used</h2>
        <p className="sub">{inviteError}</p>
        <Link to="/signup" className="btn btn-primary btn-block">
          Create an account instead
        </Link>
        <p className="switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout pageLabel="Create account" headerLink={HEADER_LINK} brand={ACCOUNT_BRAND}>
      <form onSubmit={onSubmit} noValidate>
        <h2>Create your account</h2>
        <p className="sub">
          {invite ? `Welcome${invite.contactName ? `, ${invite.contactName}` : ''}. Choose a password to get started.` : "A few details and your store's numbers are ready."}
        </p>

        <div className="stack">
          <TextField label="Business name" autoComplete="organization" placeholder="Adé Fine Jewellery" disabled={phase === 'done'} {...bind('businessName')} />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@yourstore.com"
            readOnly={Boolean(invite)}
            disabled={phase === 'done'}
            hint={invite ? 'This is the email your invite was sent to.' : undefined}
            {...bind('email')}
          />
          <PasswordField label="Password" autoComplete="new-password" placeholder="At least 8 characters" disabled={phase === 'done'} {...pw} {...bind('password')} />
          <TextField
            label="Confirm password"
            type={pw.show ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            disabled={phase === 'done'}
            {...bind('confirmPassword')}
          />
        </div>

        {errors.form && (
          <p className="error-text" role="alert" style={{ margin: '-8px 0 14px' }}>
            {errors.form}
          </p>
        )}

        {phase === 'done' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="notice" role="status">
              Account created — check your inbox to confirm.
            </div>
            <button type="button" className="btn btn-ghost-link btn-block" onClick={refresh}>
              Continue to store setup →
            </button>
          </div>
        ) : (
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <LoadingLabel>Creating account</LoadingLabel> : 'Create account'}
          </button>
        )}

        <p className="switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
