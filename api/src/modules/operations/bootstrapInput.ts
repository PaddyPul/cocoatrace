import { z } from 'zod';

export class BootstrapInputError extends Error {
  constructor(readonly fields: readonly string[]) {
    super(
      `Invalid administrator input: ${fields.join(', ')}. Email must be valid; password requires at least 20 characters, at most 72 UTF-8 bytes, no terminal control characters or placeholder phrases.`,
    );
  }
}

export class BootstrapConflictError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const schema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z
      .string()
      .min(20)
      .max(72)
      .refine(
        (value) =>
          Buffer.byteLength(value, 'utf8') <= 72 &&
          ![...value].some(
            (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
          ) &&
          !/password123|change.?me/i.test(value),
      ),
  })
  .strict();

export function parseBootstrapInput(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fields = [
      ...new Set(
        parsed.error.issues.map((issue) =>
          issue.path[0] === 'email'
            ? 'email'
            : issue.path[0] === 'password'
              ? 'password'
              : 'input shape',
        ),
      ),
    ];
    throw new BootstrapInputError(fields);
  }
  return parsed.data;
}

export function bootstrapFailureMessage(error: unknown): string {
  if (
    error instanceof Error &&
    error.message === 'Bootstrap requires normal sign-in, secure cookies and privileged MFA'
  )
    return error.message;
  if (error instanceof BootstrapInputError || error instanceof BootstrapConflictError)
    return error.message;
  if (error instanceof SyntaxError)
    return 'Bootstrap input is not valid JSON; no credentials were accepted.';
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const safeCode =
    typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code) ? ` Database code: ${code}.` : '';
  return `Administrator bootstrap failed.${safeCode} Existing identities are never overwritten. Inspect database availability and bootstrap state; do not reset the database.`;
}
