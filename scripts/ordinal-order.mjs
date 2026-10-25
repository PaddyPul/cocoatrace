// Deterministic UTF-16 string ordering, independent of the host locale.
export function compareOrdinal(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
