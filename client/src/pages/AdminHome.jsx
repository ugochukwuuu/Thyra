import { useAuth } from '../auth/AuthContext.jsx'
import { Logo } from '../components/Logo.jsx'

// Phase 1 only authenticates admins. The dashboard (submission list, detail, export) is Phase 2.
export default function AdminHome() {
  const { user, logout } = useAuth()
  return (
    <div className="center-page">
      <header className="app-header">
        <Logo />
        <span className="divider" />
        <span className="label">Admin</span>
        <div className="spacer" />
        <span className="label hide-sm">{user.email}</span>
        <button type="button" className="link-muted" onClick={logout}>
          Log out
        </button>
      </header>
      <div className="center-body">
        <div>
          <span className="pill-tag">Coming in Phase 2</span>
          <h1>The admin dashboard isn&apos;t built yet.</h1>
          <p>You&apos;re signed in as an admin. The submission list, detail view and export arrive in the next phase.</p>
        </div>
      </div>
    </div>
  )
}
