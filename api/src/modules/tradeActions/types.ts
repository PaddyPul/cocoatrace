export type TradeActionKind =
  | 'offer_decision'
  | 'offer_waiting'
  | 'configure_terms'
  | 'confirm_terms'
  | 'payment'
  | 'payment_verification'
  | 'transport'
  | 'delivery'
  | 'documents'
  | 'waiting'
  | 'complete';

export interface TradeAction {
  id: string;
  kind: TradeActionKind;
  priority: number;
  requiresAction: boolean;
  title: string;
  description: string;
  actionLabel: string;
  actionPath: string;
  contractId?: string;
  offerId?: string;
  installmentId?: string;
  operation?: TradeOperation;
}

export type TradeOperation =
  | 'view'
  | 'configure_terms'
  | 'confirm_terms'
  | 'submit_payment'
  | 'verify_payment'
  | 'bank_security'
  | 'documents'
  | 'transport';
export type OfferFact = {
  id: string;
  status: string;
  buyer_organization_id: string;
  seller_organization_id: string;
  buyer_name?: string;
  seller_name?: string;
};
export type DealFact = {
  facts_loaded?: boolean;
  amount_confirmed?: string;
  dispatch_required_amount?: string;
  payment_issue_status?: string;
  recall_held?: boolean;
  documents_pending?: boolean;
  documents_presented_at?: string;
  incoterm?: string;
  currency_minor_units?: number;
  id: string;
  seller_organization_id: string;
  buyer_organization_id: string;
  seller_name: string;
  buyer_name: string;
  fee_status?: string;
  fee_payer_organization_id?: string;
  fee_amount?: string;
  fee_payment_submitted?: boolean;
  payment_terms_status: string;
  payment_plan: string;
  payment_request_id?: string;
  payment_status?: string;
  security_status?: string;
  installment_id?: string;
  installment_status?: string;
  installment_type?: string;
  amount_due?: number;
  currency?: string;
  cancellation_requested_by_organization_id?: string;
  delivery_accepted_at?: string;
  delivery_discrepancy_status?: string;
  shipment_id?: string;
  transport_coordinator_organization_id?: string;
  current_milestone?: string;
  status: string;
};

export type ActionContext = {
  deal: DealFact;
  organizationId: string;
  seller: boolean;
  buyer: boolean;
  room: string;
  payment: string;
};
