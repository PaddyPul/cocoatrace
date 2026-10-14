export interface Payment {
  currency_minor_units?: number;
  id: string;
  contract_id: string;
  amount_total: number;
  currency: string;
  status: string;
  payment_reference_external?: string;
  payment_plan?: string;
  payment_terms_status?: string;
  amount_confirmed?: number;
  dispatch_required_amount?: number;
  release_status?: string;
}
