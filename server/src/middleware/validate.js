import { HttpError } from '../lib/errors.js';

/**
 * Validates req[source] with a zod schema (or a function returning one, for
 * schemas that depend on the request) and replaces it with the parsed value.
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const resolved = typeof schema === 'function' ? schema(req) : schema;
    const result = resolved.safeParse(req[source] ?? {});
    if (result.success) {
      req[source] = result.data;
      return next();
    }
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    const first = Object.values(fields)[0];
    next(new HttpError(400, first, { fields }));
  };
