// Shared constants and helpers for the admin pages.

import { apiFetch, errorFrom } from '../../lib/api.js'

export const STATUS_LABELS = {
  invited: 'Invited',
  notstarted: 'Not started',
  progress: 'In progress',
  changes: 'Changes requested',
  submitted: 'Submitted',
}
export const STATUS_ORDER = ['invited', 'notstarted', 'progress', 'changes', 'submitted']

export const STAGE_LABELS = { new: 'New', booked: 'Call booked', won: 'Won', notfit: 'Not a fit' }
export const STAGE_ORDER = ['new', 'booked', 'won', 'notfit']

export const TOTAL_SECTIONS = 9

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-09-26" or an ISO timestamp -> "26 Sep 2026". Plain dates are read as written, never shifted by time zone. */
export function formatDate(value, { year = true } = {}) {
  if (!value) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const [y, mo, d] = m ? [Number(m[1]), Number(m[2]) - 1, Number(m[3])] : (() => {
    const dt = new Date(value)
    return [dt.getFullYear(), dt.getMonth(), dt.getDate()]
  })()
  return `${d} ${MONTHS[mo]}${year ? ` ${y}` : ''}`
}

export const initials = (name, email = '') =>
  (name || email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

/** Downloads a file from the API with the access token, then hands it to the browser. */
export async function downloadFile(path, fallbackName) {
  const res = await apiFetch(path)
  if (!res.ok) throw new Error((await errorFrom(res)).message)
  const disposition = res.headers.get('content-disposition') ?? ''
  const star = /filename\*=UTF-8''([^;]+)/.exec(disposition)
  const plain = /filename="([^"]+)"/.exec(disposition)
  const name = star ? decodeURIComponent(star[1]) : plain?.[1] ?? fallbackName
  saveBlob(await res.blob(), name)
}

/** Saves a blob the browser already has, as a download with this name. */
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
