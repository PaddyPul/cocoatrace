export interface Contract {
  currency: string;
  trade_value?: string | number;
  currency_minor_units?: number;
  id: string;
  seller_name?: string;
  buyer_name?: string;
  quantity_kg: number;
  price_per_kg: number;
  incoterm: string;
  status: string;
  payment_plan?: string;
  deposit_percentage?: number;
  credit_days?: number;
  payment_terms_status?: string;
  payment_request_id?: string;
  platform_fee_amount?: number;
}
