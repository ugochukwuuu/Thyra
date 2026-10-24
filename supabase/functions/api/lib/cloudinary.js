import crypto from 'node:crypto';
import { config, cloudinaryConfigured } from './config.js';
import { HttpError } from './errors.js';

const { cloudName, apiKey, apiSecret } = config.cloudinary;
const API = `https://api.cloudinary.com/v1_1/${cloudName}`;

/** All of a client's uploads live under one folder, so ownership is a prefix check. */
export const userFolder = (userId) => `thyra/onboarding/${userId}`;

/**
 * What the browser needs to upload straight to Cloudinary into the client's folder.
 * Files never pass through the API, so their size is not limited by the Edge Function.
 * Cloudinary signs the sorted parameters followed by the API secret, with SHA-1.
 */
export function uploadSignature(userId) {
  if (!cloudinaryConfigured) throw new HttpError(503, 'File uploads are not set up yet.');
  const params = { folder: userFolder(userId), timestamp: Math.floor(Date.now() / 1000) };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return {
    ...params,
    uploadUrl: API,
    apiKey,
    signature: crypto.createHash('sha1').update(toSign + apiSecret).digest('hex'),
  };
}

const adminHeaders = () => ({ Authorization: `Basic ${btoa(`${apiKey}:${apiSecret}`)}` });

/** Removes every file a client uploaded. Best effort: failures are logged, not thrown. */
export async function deleteUserFiles(userId) {
  if (!cloudinaryConfigured) return;
  const prefix = userFolder(userId);
  for (const type of ['image', 'video', 'raw']) {
    const res = await fetch(`${API}/resources/${type}/upload?prefix=${encodeURIComponent(`${prefix}/`)}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    if (!res.ok) console.error(`Could not delete ${type} files under ${prefix}: ${res.status} ${await res.text()}`);
  }
  // The folder may already be gone or never have existed.
  await fetch(`${API}/folders/${prefix}`, { method: 'DELETE', headers: adminHeaders() }).catch(() => {});
}
