import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { ACCOUNT_BRAND } from '../components/brandCopy.js'
import { ApiError, api } from '../lib/api.js'

// Not in the Claude Design files. Built from the same pieces as the other account pages.
export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { user, refresh } = useAuth()
  const [state, setState] = useState(token ? 'checking' : 'error')
  const [message, setMessage] = useState(token ? '' : 'This confirmation link is incomplete.')
  const started = useRef(false)

  useEffect(() => {
    // The link works once, so make sure React's development double render doesn't use it twice.
    if (!token || started.current) return
    started.current = true
    api('/auth/verify-email', { method: 'POST', body: { token } })
      .then(async () => {
        setState('done')
        await refresh()
      })
      .catch((err) => {
        setMessage(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
        setState('error')
      })
  }, [token, refresh])

  const next = user ? { to: '/onboarding', label: 'Continue to store setup' } : { to: '/login', label: 'Log in' }

  return (
    <AuthLayout pageLabel="Confirm email" headerLink={{ to: next.to, text: next.label }} brand={ACCOUNT_BRAND}>
      {state === 'checking' && (
        <>
          <h2>Confirming your email</h2>
          <p className="sub">One moment…</p>
        </>
      )}
      {state === 'done' && (
        <>
          <h2>Email confirmed</h2>
          <p className="sub">Thanks. You can finish your onboarding and submit it whenever you&apos;re ready.</p>
          <Link to={next.to} className="btn btn-primary btn-block">
            {next.label}
          </Link>
        </>
      )}
      {state === 'error' && (
        <>
          <h2>This link didn&apos;t work</h2>
          <p className="sub">
            {message} {user ? 'You can send yourself a new one from your store setup.' : 'Log in and send yourself a new one from your store setup.'}
          </p>
          <Link to={next.to} className="btn btn-primary btn-block">
            {next.label}
          </Link>
        </>
      )}
    </AuthLayout>
  )
}
