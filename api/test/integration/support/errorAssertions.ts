import { expect } from 'vitest';

type FailureResponse = {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, unknown>;
};
/** Correlation differs per request; every other denial field must remain identical. */
export function expectIdenticalNotFound(left: FailureResponse, right: FailureResponse): void {
  for (const response of [left, right]) {
    expect(response.status, JSON.stringify(response.body)).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
    expect(typeof response.body.requestId).toBe('string');
    expect(response.body.requestId).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  }
  const { requestId: leftId, ...leftDenial } = left.body;
  const { requestId: rightId, ...rightDenial } = right.body;
  void leftId;
  void rightId;
  expect(leftDenial).toEqual(rightDenial);
}
