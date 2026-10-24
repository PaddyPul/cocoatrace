// A deliberately small envelope-address policy, not a complete RFC mailbox parser.
// Split once before checking the domain to avoid ambiguous backtracking on long input.
export function isEnvelopeAddress(value: string, supportAddress = false): boolean {
  if (/\s/.test(value) || (supportAddress && /[<>"']/.test(value))) return false;
  const at = value.indexOf('@');
  if (at <= 0 || at !== value.lastIndexOf('@')) return false;
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}
