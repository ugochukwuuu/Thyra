import { API_URL, accessToken } from './supabase.js'

export class ApiError extends Error {
  constructor(status, message, { fields, problems } = {}) {
    super(message)
    this.status = status
    this.fields = fields ?? {}
    this.problems = problems ?? []
  }
}

const unreachable = () => new ApiError(0, "We can't reach the server. Check your connection and try again.")

/** fetch() against the Thyra API, with the signed-in person's access token. */
export async function apiFetch(path, init = {}) {
  const token = await accessToken()
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...init.headers, ...(token && { Authorization: `Bearer ${token}` }) },
    })
  } catch {
    throw unreachable()
  }
}

/** Turns an error response into an ApiError with the server's message and field errors. */
export async function errorFrom(res) {
  let data = null
  try {
    data = await res.json()
  } catch {
    // Non-JSON body (e.g. a proxy error page); fall through to the generic message.
  }
  const err = data?.error
  return new ApiError(res.status, err?.message ?? 'Something went wrong. Please try again.', err)
}

/**
 * Thin fetch wrapper for the Thyra API. Sends the access token, sends/receives JSON,
 * and turns error responses into ApiError with the server's message and field errors.
 */
export async function api(path, { method = 'GET', body, keepalive = false } = {}) {
  const res = await apiFetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    keepalive,
  })
  if (!res.ok) throw await errorFrom(res)
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}
