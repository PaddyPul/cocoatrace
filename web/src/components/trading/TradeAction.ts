// Public response contract for the server-owned next-action policy.
export interface TradeAction {
  id: string;
  kind: string;
  priority: number;
  requiresAction: boolean;
  title: string;
  description: string;
  actionLabel: string;
  actionPath: string;
  contractId?: string;
  offerId?: string;
  installmentId?: string;
  operation?:
    | 'view'
    | 'configure_terms'
    | 'confirm_terms'
    | 'submit_payment'
    | 'verify_payment'
    | 'bank_security'
    | 'documents'
    | 'transport';
}
