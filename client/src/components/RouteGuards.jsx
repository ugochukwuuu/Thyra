import { Navigate, Outlet } from 'react-router-dom'
import { homePathFor, useAuth } from '../auth/AuthContext.jsx'

const Splash = () => <div className="splash">Loading…</div>

/** Login / sign up / forgot: signed-in visitors go straight to their home page. */
export function PublicOnly() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  return user ? <Navigate to={homePathFor(user)} replace /> : <Outlet />
}

export function RequireRole({ role }) {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}

export function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  return <Navigate to={user ? homePathFor(user) : '/login'} replace />
}
