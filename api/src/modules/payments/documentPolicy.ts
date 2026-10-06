// Physical handover is a prerequisite, not a carrier integration or legal delivery claim.
export function documentsCanBePresentedAt(milestone: string | undefined): boolean {
  return [
    'handed_over',
    'loaded',
    'departed',
    'arrived',
    'customs_cleared',
    'unloaded',
    'delivered',
  ].includes(milestone || '');
}
