import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError, api } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api('/auth/me')
      .then((data) => !cancelled && setUser(data.user))
      .catch((err) => {
        // 401 just means "not logged in"; anything else also leaves us logged out.
        if (!(err instanceof ApiError) || err.status !== 401) console.error(err)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } })
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (fields) => {
    const data = await api('/auth/register', { method: 'POST', body: fields })
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
    () => ({ user, loading, login, register, logout, sessionExpired }),
    [user, loading, login, register, logout, sessionExpired],
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
export const homePathFor = (user) => (user?.role === 'admin' ? '/admin' : '/onboarding')
