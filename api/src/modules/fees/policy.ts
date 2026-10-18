import { ConflictError, ValidationError } from '../../errors';
export const feePolicyVersion = 'seller-completion-v2';
export function textInput(value: string, minimum: number, label: string): string {
  const result = value.trim();
  if ([...result].length < minimum || result.length > (minimum === 3 ? 200 : 2000))
    throw new ValidationError(`${label} is incomplete or too long`);
  return result;
}
export function requireCollectible(fee: {
  status: string;
  policy_version?: string;
  contract_status: string;
  amount_total: string;
  payer_organization_id: string | null;
  amount_matches?: boolean;
  payer_matches?: boolean;
}) {
  if (
    fee.status !== 'invoiced' ||
    (fee.policy_version !== 'seller-predispatch-v3' && fee.contract_status !== 'settled') ||
    ['cancelled'].includes(fee.contract_status)
  )
    throw new ConflictError(
      'The fee is not collectible under its recorded policy and contract state',
    );
  if (fee.amount_matches === false || fee.payer_matches === false)
    throw new ConflictError(
      'The fee snapshot does not reconcile with its contract; platform finance must review it',
    );
  if (!fee.payer_organization_id)
    throw new ConflictError('The fee payer must be resolved before collection');
  if (!/[1-9]/.test(fee.amount_total))
    throw new ConflictError('This zero-value fee does not require payment');
}
