/** Stable transport metadata for callers; display only the safe server message. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly retryAfter: string | null;
  constructor(
    message: string,
    status: number,
    code: string,
    requestId: string | null = null,
    retryAfter: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
  }
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
export function responseCode(value: unknown): string | null {
  const code = record(value)?.code;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,99}$/.test(code) ? code : null;
}
export function responseError(response: Response, value: unknown): ApiError {
  const data = record(value);
  const base =
    typeof data?.error === 'string' && data.error.trim() ? data.error : `HTTP ${response.status}`;
  const details = Array.isArray(data?.details)
    ? data.details.slice(0, 20).flatMap((detail: unknown) => {
        const message = record(detail)?.message;
        return typeof message === 'string' && message.trim() ? [message] : [];
      })
    : [];
  const message = details.length ? `${base}: ${details.join('; ')}` : base;
  const rawId = response.headers.get('x-request-id') ?? data?.requestId;
  const requestId =
    typeof rawId === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(rawId) ? rawId : null;
  return new ApiError(
    message,
    response.status,
    responseCode(value) ?? `HTTP_${response.status}`,
    requestId,
    response.headers.get('retry-after'),
  );
}
