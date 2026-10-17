import type { z } from 'zod';
import type { createMilestoneSchema, updateShipmentDetailsSchema } from '../../validation';
import type { PaymentPlan } from '../../services/paymentProtection';
import type { TransportFacts } from '../transport/responsibilities';

export type ArrangementInput = z.infer<typeof updateShipmentDetailsSchema>;
export type MilestoneInput = z.infer<typeof createMilestoneSchema>;
export interface WorkflowResult {
  status: number;
  body: unknown;
}
export interface ArrangementRow extends TransportFacts {
  status: string;
}
export interface ShipmentRow {
  id: string;
  contract_id: string;
  current_milestone: string;
  dispatch_exception: boolean;
  service_provider_name: string | null;
  booking_reference: string | null;
  transport_mode: string | null;
  origin_port: string | null;
  destination_port: string | null;
}
export interface ProgressRow extends ShipmentRow, Omit<TransportFacts, 'current_milestone'> {
  seller_organization_id: string;
  buyer_organization_id: string;
  payment_plan: PaymentPlan;
  payment_terms_status: string;
  credit_days: number | null;
  contract_currency: string;
  payment_currency: string;
  contract_minor_units: number;
  payment_minor_units: number;
  holding_id: string;
  contract_quantity_kg: string;
  contract_status: string;
  payment_request_id: string;
  amount_confirmed: string | null;
  dispatch_required_amount: string | null;
  security_status: string | null;
}
