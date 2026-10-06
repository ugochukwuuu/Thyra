import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError, api } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  /** Re-reads the signed-in user from the server, e.g. after sign-up or confirming an email. */
  const refresh = useCallback(async () => {
    try {
      const data = await api('/auth/me')
      setUser(data.user)
      return data.user
    } catch (err) {
      // 401 just means "not logged in"; anything else also leaves us logged out.
      if (!(err instanceof ApiError) || err.status !== 401) console.error(err)
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api('/auth/me')
      .then((data) => !cancelled && setUser(data.user))
      .catch((err) => {
        if (!(err instanceof ApiError) || err.status !== 401) console.error(err)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password, scope = 'any') => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password, scope } })
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} })
    } finally {
      setUser(null)
    }
  }, [])

  // For when any request comes back 401: the session ended, so drop the user and let routing redirect.
  const sessionExpired = useCallback(() => setUser(null), [])

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh, setUser, sessionExpired }),
    [user, loading, login, logout, refresh, sessionExpired],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export const isStaff = (user) => user?.role === 'admin' || user?.role === 'viewer'

// eslint-disable-next-line react-refresh/only-export-components
export const homePathFor = (user) => (isStaff(user) ? '/admin/submissions' : '/onboarding')
