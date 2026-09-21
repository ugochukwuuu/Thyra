import { v2 as cloudinary } from 'cloudinary';
import { config, cloudinaryConfigured } from '../config.js';
import { HttpError } from './errors.js';

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

/** All of a client's uploads live under one folder, so ownership is a prefix check. */
export const userFolder = (userId) => `thyra/onboarding/${userId}`;

/**
 * Uploads a file buffer to the client's folder and returns the public URL to store.
 * `resourceType` is Cloudinary's: 'image', 'video' (media clips) or 'raw' (documents such as a PDF).
 */
export function uploadFile(buffer, userId, resourceType) {
  if (!cloudinaryConfigured) throw new HttpError(503, 'File uploads are not set up yet.');

  const options = { folder: userFolder(userId), resource_type: resourceType };

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (!err) {
        return resolve({ url: result.secure_url, publicId: result.public_id, resourceType: result.resource_type });
      }
      // Cloudinary refusing the file (corrupt, wrong format) is the client's problem, not ours.
      if (err.http_code >= 400 && err.http_code < 500 && err.http_code !== 401 && err.http_code !== 403) {
        return reject(new HttpError(400, 'That file could not be processed. Check it opens on your device, or try another.'));
      }
      reject(err);
    });
    stream.end(buffer);
  });
}
