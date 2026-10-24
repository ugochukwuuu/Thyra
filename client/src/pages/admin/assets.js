import { zipSync } from 'fflate'
import { saveBlob } from './format.js'

// The asset zip, put together in the browser from the files on Cloudinary.
// The folder layout matches what the admin design describes, one folder per section.

const LOGO_LABELS = { primary: 'primary', mark: 'mark', light: 'light-background', dark: 'dark-background', favicon: 'favicon' }

const slug = (s, fallback = 'item') =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || fallback

/** Every uploaded file in a submission, with its path inside the zip. */
export function collectFiles(submission) {
  const out = []
  const add = (folder, file, prefix = '') => file?.url && out.push({ folder, file, prefix })

  ;(submission.products?.items ?? []).forEach((p, i) => {
    const folder = `shop/${String(i + 1).padStart(2, '0')}-${slug(p.name, 'product')}`
    add(folder, p.mainImage, 'main-')
    ;(p.images ?? []).forEach((f) => add(folder, f))
  })
  ;(submission.homePage?.media ?? []).forEach((f) => add('home-page/media', f))
  ;(submission.homePage?.testimonials ?? []).forEach((t) => add('home-page/testimonials', t.photo, `${slug(t.name, 'customer')}-`))
  ;(submission.inspiration?.items ?? []).forEach((it) => add('design-inspiration', it.screenshot))
  for (const [slot, label] of Object.entries(LOGO_LABELS)) add('visual-identity/logos', submission.visualIdentity?.logos?.[slot], `${label}-`)
  add('visual-identity', submission.visualIdentity?.brandGuide, 'brand-guide-')

  // Give every entry a unique, readable path.
  const used = new Set()
  return out.map(({ folder, file, prefix }) => {
    const base = (prefix + (file.name || file.publicId.split('/').pop())).replace(/[\\/:*?"<>|]+/g, '-')
    let path = `${folder}/${base}`
    for (let n = 2; used.has(path.toLowerCase()); n++) {
      path = `${folder}/${base.replace(/(\.[^.]*)?$/, `-${n}$1`)}`
    }
    used.add(path.toLowerCase())
    return { path, file }
  })
}

async function fetchBytes(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Cloudinary returned ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

/**
 * Downloads every file and saves them as one zip. Files that can't be fetched are listed in
 * MISSING-FILES.txt instead of stopping the whole download. Returns how many were missing.
 */
export async function downloadAssets(submission, name) {
  const files = collectFiles(submission)
  if (!files.length) throw new Error('This client has not uploaded any files yet.')

  const entries = {}
  const failed = []
  // A few at a time, so a large submission doesn't open dozens of downloads at once.
  for (let i = 0; i < files.length; i += 4) {
    await Promise.all(
      files.slice(i, i + 4).map(async ({ path, file }) => {
        try {
          // Images and videos are already compressed, so store them as they are.
          entries[path] = [await fetchBytes(file.url), { level: 0 }]
        } catch {
          failed.push(path)
        }
      }),
    )
  }
  if (failed.length) {
    entries['MISSING-FILES.txt'] = new TextEncoder().encode(`These files could not be downloaded from Cloudinary:\n\n${failed.join('\n')}\n`)
  }
  saveBlob(new Blob([zipSync(entries)], { type: 'application/zip' }), `${name}-assets.zip`)
  return failed.length
}

/** Downloads one uploaded file under its original name. */
export async function downloadOne(file, name) {
  let bytes
  try {
    bytes = await fetchBytes(file.url)
  } catch {
    throw new Error('The download failed. Please try again.')
  }
  saveBlob(new Blob([bytes]), name)
}
