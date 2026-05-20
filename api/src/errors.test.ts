import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, ValidationError, AuthenticationError, ForbiddenError, ConflictError } from './errors';

describe('AppError', () => {
  it('creates error with status and code', () => {
    const err = new AppError('test', 400, 'TEST_CODE');
    expect(err.message).toBe('test');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('TEST_CODE');
    expect(err.isOperational).toBe(true);
  });
});

describe('NotFoundError', () => {
  it('defaults to 404 with resource name', () => {
    const err = new NotFoundError('Farm');
    expect(err.message).toBe('Farm not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('ValidationError', () => {
  it('defaults to 400', () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});

describe('AuthenticationError', () => {
  it('defaults to 401', () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTHENTICATION_ERROR');
  });
});

describe('ForbiddenError', () => {
  it('defaults to 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('ConflictError', () => {
  it('defaults to 409', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });
});
