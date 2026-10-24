import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors';
import { TraceIncompleteError } from '../modules/trace/limits';
import { isEvidenceContentRequest } from './requestLimits';
import logger from '../logger';
const codes: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'AUTHENTICATION_REQUIRED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  410: 'GONE',
  413: 'REQUEST_BODY_TOO_LARGE',
  414: 'REQUEST_URI_TOO_LONG',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_REQUEST',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};
const messages: Record<number, string> = {
  400: 'Invalid request',
  401: 'Authentication required',
  403: 'Access denied',
  404: 'Not found',
  409: 'Request conflicts with the current state',
  413: 'Request body is too large',
  422: 'Request cannot be processed',
  429: 'Too many requests',
};
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const safeCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,99}$/.test(value);
export function safeValidationDetails(error: ZodError) {
  return error.issues.slice(0, 30).map((issue) => ({
    path: issue.path
      .slice(0, 10)
      .map((part) =>
        typeof part === 'number'
          ? String(part)
          : typeof part === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,79}$/.test(part)
            ? part
            : 'field',
      )
      .join('.'),
    message:
      issue.code === 'invalid_type'
        ? 'Required value is missing or has the wrong type'
        : issue.code === 'too_small'
          ? 'Value is below the required minimum'
          : issue.code === 'too_big'
            ? 'Value exceeds the allowed maximum'
            : issue.code === 'unrecognized_keys'
              ? 'Unexpected fields are not allowed'
              : issue.code === 'invalid_value'
                ? 'Choose a supported value'
                : issue.code === 'invalid_format'
                  ? 'Value has an invalid format'
                  : 'Value is invalid',
  }));
}
export function normalizeErrorEnvelope(status: number, body: unknown, requestId: string) {
  const input = record(body);
  const result: Record<string, unknown> = {
    error:
      status >= 500
        ? 'Internal server error'
        : typeof input.error === 'string' && input.error.trim()
          ? input.error
          : (messages[status] ?? 'Request failed'),
    code: safeCode(input.code)
      ? input.code
      : (codes[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED')),
    requestId,
  };
  // Explicit allowlist: no provider objects, stack, SQL detail, request body or arbitrary metadata.
  if (status < 500 && Array.isArray(input.details))
    result.details = input.details.slice(0, 30).map((item) => {
      const detail = record(item);
      return {
        path: typeof detail.path === 'string' ? detail.path.slice(0, 800) : '',
        message:
          typeof detail.message === 'string' ? detail.message.slice(0, 300) : 'Value is invalid',
      };
    });
  if (
    status === 409 &&
    input.code === 'TRANSPORT_ARRANGEMENT_REQUIRED' &&
    Array.isArray(input.missingFields)
  ) {
    const fields = [
      'provider name or booking reference',
      'transport mode',
      'origin',
      'destination',
    ];
    result.missingFields = input.missingFields
      .filter((field) => typeof field === 'string' && fields.includes(field))
      .slice(0, 4);
  }
  const analysis = record(input.analysis);
  if (
    analysis.status === 'incomplete' &&
    analysis.safetyClearance === false &&
    typeof analysis.reason === 'string' &&
    /^[A-Z_]{1,50}$/.test(analysis.reason)
  )
    result.analysis = { status: 'incomplete', reason: analysis.reason, safetyClearance: false };
  if (['error', 'not_ready'].includes(String(input.status))) result.status = input.status;
  if (input.db === 'disconnected') result.db = 'disconnected';
  if (input.dependency === 'database_storage_or_evidence_scanner')
    result.dependency = input.dependency;
  return result;
}
/** Install before parsers, authorization and routes so manual JSON failures share one contract. */
export const errorEnvelope: RequestHandler = (_req, res, next) => {
  const json = res.json;
  res.json = function (body: unknown): Response {
    if (this.statusCode >= 400 && this.statusCode <= 599) {
      const id = this.getHeader('X-Request-Id');
      body = normalizeErrorEnvelope(
        this.statusCode,
        body,
        typeof id === 'string' ? id : 'unavailable',
      );
    }
    return json.call(this, body);
  };
  next();
};
export const apiErrorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const source = record(error);
  if (source.type === 'entity.too.large') {
    const evidence = isEvidenceContentRequest(req.method, req.path);
    res.status(413).json({
      error: evidence
        ? 'Request body exceeds the configured evidence file limit'
        : 'JSON request body exceeds the 100 KiB limit',
      code: evidence ? 'EVIDENCE_FILE_TOO_LARGE' : 'REQUEST_BODY_TOO_LARGE',
    });
    return;
  }
  if (source.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON request body', code: 'REQUEST_JSON_INVALID' });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: safeValidationDetails(error),
    });
    return;
  }
  if (error instanceof AppError) {
    logger.warn(
      { code: error.code, statusCode: error.statusCode, method: req.method },
      'Operational request error',
    );
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      ...(error instanceof TraceIncompleteError ? { analysis: error.analysis } : {}),
    });
    return;
  }
  // Unexpected details may contain provider credentials, SQL or submitted secrets even in local/test.
  logger.error(
    { errorType: error instanceof Error ? error.name : 'UnknownError', method: req.method },
    'Unhandled request error',
  );
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
};
