import type { Express, RequestHandler } from 'express';
import { AppError } from '../errors';

export const requestLimits = Object.freeze({
  jsonBytes: 100 * 1024,
  queryBytes: 8192,
  queryParameters: 64,
  queryKeyBytes: 128,
  queryValueBytes: 2048,
  queryDepth: 4,
});

// Run before Express's existing parser: never silently truncate excess parameters.
export function validateQueryBudget(raw: string): void {
  if (Buffer.byteLength(raw) > requestLimits.queryBytes)
    throw new AppError('Query string is too large', 414, 'REQUEST_QUERY_TOO_LARGE');
  const entries = [...new URLSearchParams(raw)];
  if (entries.length > requestLimits.queryParameters)
    throw new AppError('Too many query parameters', 400, 'REQUEST_QUERY_LIMIT');
  for (const [key, value] of entries) {
    if (
      Buffer.byteLength(key) > requestLimits.queryKeyBytes ||
      Buffer.byteLength(value) > requestLimits.queryValueBytes ||
      (key.match(/\[/g)?.length ?? 0) > requestLimits.queryDepth
    )
      throw new AppError('Query parameter exceeds the request limit', 400, 'REQUEST_QUERY_LIMIT');
  }
}

export function createQueryBudget(app: Express): RequestHandler {
  const parser = app.get('query parser fn') as (raw: string) => unknown;
  // Disable the built-in eager parser, then validate after Express initializes
  // response helpers. Parser errors can now use the normal JSON error boundary.
  app.set('query parser', false);
  return (req, _res, next) => {
    const question = req.originalUrl.indexOf('?');
    const raw = question < 0 ? '' : req.originalUrl.slice(question + 1);
    validateQueryBudget(raw);
    req.query = parser(raw) as typeof req.query;
    next();
  };
}

export function isEvidenceContentRequest(method: string, path: string): boolean {
  return method === 'PUT' && /^\/evidence\/upload-intents\/[^/]+\/content\/?$/i.test(path);
}
