export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isEmail = (value) => EMAIL_RE.test(value.trim())
