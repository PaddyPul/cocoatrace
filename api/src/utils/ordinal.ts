// Preserve JavaScript's existing UTF-16 string order for canonical hashes and locks.
// Locale collation would change signatures, cursor scopes and lock acquisition order.
export function compareOrdinal(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
