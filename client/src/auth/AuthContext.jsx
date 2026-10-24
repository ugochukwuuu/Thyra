import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError, api } from '../lib/api.js'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

const NO_MATCH = "That email and password don't match."

/** Asks the API who is signed in. Null when nobody is, or the account no longer exists. */
async function fetchMe() {
  try {
    return (await api('/auth/me')).user
  } catch (err) {
    // 401 just means "not logged in"; anything else also leaves us logged out.
    if (!(err instanceof ApiError) || err.status !== 401) console.error(err)
    return null
  }
}

/**
 * Starts a Supabase session for an email and password. Does not change `user`, so a page can
 * finish what it is showing first (e.g. sign-up's "check your inbox" note) and call refresh() after.
 */
// eslint-disable-next-line react-refresh/only-export-components
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (!error) return
  if (error.status === 429) throw new ApiError(429, 'Too many attempts. Please wait a few minutes and try again.')
  if (error.status === 400 || error.code === 'invalid_credentials') throw new ApiError(401, NO_MATCH)
  throw new ApiError(error.status ?? 0, "We can't reach the server. Check your connection and try again.")
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  /** Re-reads the signed-in user from the server, e.g. after sign-up or confirming an email. */
  const refresh = useCallback(async () => {
    const me = await fetchMe()
    setUser(me)
    return me
  }, [])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      const me = data.session ? await fetchMe() : null
      if (!cancelled) {
        setUser(me)
        setLoading(false)
      }
    })
    // Signing out in another tab, or a refresh token that no longer works, ends the session here too.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setUser(null)
    })
    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  /** `scope: 'staff'` is the admin login: clients get the same answer as a wrong password, so it reveals nothing. */
  const login = useCallback(async (email, password, scope = 'any') => {
    await signIn(email, password)
    const me = await fetchMe()
    if (!me || (scope === 'staff' && !isStaff(me))) {
      await supabase.auth.signOut({ scope: 'local' })
      throw new ApiError(401, NO_MATCH)
    }
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' })
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
