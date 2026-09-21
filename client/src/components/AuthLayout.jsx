import { Link } from 'react-router-dom'
import { Logo } from './Logo.jsx'

/**
 * Shared frame for Login / Sign up / Forgot / Reset: sticky header, charcoal brand
 * panel on the left, cream form panel on the right.
 */
export function AuthLayout({ pageLabel, headerLink, brand, children }) {
  return (
    <div className="auth-page">
      <header className="app-header">
        <Logo />
        <span className="divider" />
        <span className="label">{pageLabel}</span>
        <div className="spacer" />
        <Link to={headerLink.to} className="link-muted hide-sm">
          {headerLink.text}
        </Link>
      </header>

      <div className="auth-body">
        <div className="auth-brand">
          <div>
            <h1>{brand.title}</h1>
            <p>{brand.body}</p>
          </div>
          <div>
            <div className="stat-num">{brand.statNum}</div>
            <div className="stat-label">{brand.statLabel}</div>
          </div>
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
