import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { homePathFor, isStaff, useAuth } from '../auth/AuthContext.jsx'

const Splash = () => <div className="splash">Loading…</div>

/** Login / sign up / forgot pages: signed-in visitors go straight to their home page. */
export function PublicOnly() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  return user ? <Navigate to={homePathFor(user)} replace /> : <Outlet />
}

export function RequireClient() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  if (isStaff(user)) return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}

/** Admin pages: staff only. Anyone else is sent to the staff login, then back here. */
export function RequireStaff() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  if (!isStaff(user)) return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}

export function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  return <Navigate to={user ? homePathFor(user) : '/login'} replace />
}
