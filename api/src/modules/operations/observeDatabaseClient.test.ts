import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { observeDatabaseClient } from './observeDatabaseClient';

function client(query: (...args: unknown[]) => unknown) {
  return { query } as unknown as PoolClient;
}

describe('database client observations', () => {
  it('preserves promise identity and results across reused clients without duplicate samples', async () => {
    const record = vi.fn();
    const result = Promise.resolve({ rows: [{ value: 1 }] });
    const original = vi.fn(() => result);
    const connection = client(original);
    observeDatabaseClient(connection, record);
    observeDatabaseClient(connection, record);
    expect(connection.query('private SQL', ['secret'])).toBe(result);
    await result;
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0]).toEqual([expect.any(Number), false]);
    expect(original).toHaveBeenCalledWith('private SQL', ['secret']);
    await connection.query('COMMIT');
    expect(record).toHaveBeenCalledTimes(2);
  });
  it('preserves rejected errors and synchronous throws', async () => {
    const record = vi.fn();
    const error = new Error('database rejected');
    const rejected = Promise.reject(error);
    const connection = client(() => rejected);
    observeDatabaseClient(connection, record);
    await expect(connection.query('ROLLBACK')).rejects.toBe(error);
    expect(record).toHaveBeenCalledWith(expect.any(Number), true);
    const throwing = client(() => {
      throw error;
    });
    observeDatabaseClient(throwing, record);
    expect(() => throwing.query('SELECT')).toThrow(error);
    expect(record).toHaveBeenCalledTimes(2);
  });
  it('preserves callback arguments, receiver and return semantics', () => {
    const record = vi.fn();
    const receiver = {};
    const row = { rows: [] };
    const callback = vi.fn(function (this: unknown, error: unknown, value: unknown) {
      expect(this).toBe(receiver);
      expect(error).toBeNull();
      expect(value).toBe(row);
    });
    const connection = client((...args) => {
      Reflect.apply(args.at(-1) as (...values: unknown[]) => void, receiver, [null, row]);
      return undefined;
    });
    observeDatabaseClient(connection, record);
    expect(connection.query('SELECT', callback)).toBeUndefined();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(expect.any(Number), false);
  });
  it('counts callback errors and retains no SQL labels in the observer', () => {
    const record = vi.fn();
    const error = new Error('failed');
    const callback = vi.fn();
    const connection = client((...args) => Reflect.apply(args.at(-1) as () => void, null, [error]));
    observeDatabaseClient(connection, record);
    connection.query('confidential', callback);
    expect(callback).toHaveBeenCalledWith(error);
    expect(record.mock.calls).toEqual([[expect.any(Number), true]]);
  });
});
