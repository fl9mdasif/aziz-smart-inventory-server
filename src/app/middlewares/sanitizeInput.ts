import { NextFunction, Request, Response } from 'express';

// Recursively strips keys that could be used for Mongo operator injection
// ($gt, $where, etc.) or dot-path injection from a parsed JSON value.
// NOTE: Express 5 makes `req.query` a read-only getter, so unlike the
// popular `express-mongo-sanitize` package (which reassigns `req.query`
// and throws under Express 5), this mutates objects in place instead.
const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) {
        continue; // drop the key entirely
      }
      cleaned[key] = sanitizeValue(val);
    }
    return cleaned;
  }

  return value;
};

const sanitizeInPlace = (target: Record<string, unknown> | undefined) => {
  if (!target || typeof target !== 'object') return;
  const sanitized = sanitizeValue(target) as Record<string, unknown>;
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, sanitized);
};

// Sanitizes req.body and req.params in place. req.query is intentionally
// left untouched (Express 5 exposes it as a getter-only property), but
// query values are never used to build raw Mongo filters unsanitized in
// this codebase's services (they're always compared against fixed enums
// or passed through `String(...)`/`Number(...)` first).
const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.params as unknown as Record<string, unknown>);
  next();
};

export default sanitizeInput;
