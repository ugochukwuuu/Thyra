export class ApiError extends Error {
  constructor(status, message, { fields, problems } = {}) {
    super(message)
    this.status = status
    this.fields = fields ?? {}
    this.problems = problems ?? []
  }
}

/**
 * Thin fetch wrapper for the Thyra API. Sends the session cookie, sends/receives JSON,
 * and turns error responses into ApiError with the server's message and field errors.
 */
export async function api(path, { method = 'GET', body, form, keepalive = false } = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      keepalive,
    })
  } catch {
    throw new ApiError(0, "We can't reach the server. Check your connection and try again.")
  }

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Non-JSON body (e.g. a proxy error page); fall through to the generic message.
  }

  if (!res.ok) {
    const err = data?.error
    throw new ApiError(res.status, err?.message ?? 'Something went wrong. Please try again.', err)
  }
  return data
}
