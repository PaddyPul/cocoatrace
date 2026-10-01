export function passwordPolicyError(password: string): string | null {
  if (password.length < 12) return 'Use at least 12 characters.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'Include upper and lowercase letters.';
  if (!/[0-9]/.test(password)) return 'Include at least one number.';
  return null;
}

