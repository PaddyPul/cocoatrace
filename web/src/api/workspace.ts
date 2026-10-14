import { api } from './http';
import type { CatalogPage } from './http';
import type { PaymentSummary, ShipmentSummary } from './trades';
import type { TradeAction } from '../components/trading/TradeAction';

export interface PilotFeedback {
  id: string;
  page: string;
  task: string;
  rating: number;
  comment: string;
  created_at: string;
  user_name: string | null;
  organization_name: string | null;
}

export interface FeedbackSummary {
  count: number;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
}

export const workspace = {
  feedbackPage: (parameters: Record<string, string>) =>
    api<CatalogPage<PilotFeedback> & { count: number }>(
      'GET',
      `/pilot-feedback/page?${new URLSearchParams(parameters)}`,
    ),
  feedbackSummary: () => api<FeedbackSummary>('GET', '/pilot-feedback/summary'),
  getOnboarding: () => api<import('../types').OnboardingState>('GET', '/onboarding'),
  updateOnboarding: (data: {
    status: 'not_started' | 'in_progress' | 'completed';
    currentStep: number;
    primaryGoal?: string;
    pilotMode: boolean;
  }) => api<import('../types').OnboardingState>('PUT', '/onboarding', data),
  sendFeedback: (data: { page: string; task: string; rating: number; comment: string }) =>
    api<any>('POST', '/pilot-feedback', data),
  tradeActions: () => api<TradeAction[]>('GET', '/trade-actions'),
  listFeedback: () => api<any[]>('GET', '/pilot-feedback'),
};

export const readiness = {
  get: () => api<any>('GET', '/readiness'),
};

export interface WorkspaceOverview {
  batches: { count: number; reviewed_count: number } | null;
  products: { count: number; published_count: number; held_count: number } | null;
  lots: { count: number; source_kg: string } | null;
  recalls: { count: number; active_count: number };
  evidence: { count: number } | null;
  shipments: ShipmentSummary | null;
  farms: { count: number; owned_count: number } | null;
  listings: { count: number; own_count: number; quantity_kg: string } | null;
  contracts: {
    count: number;
    active_count: number;
    settled_count: number;
    cancelled_count: number;
    latest_active_id: string | null;
  } | null;
  offers: {
    received_count: number;
    sent_count: number;
    received_pending: number;
    sent_pending: number;
  } | null;
  payments: PaymentSummary | null;
}

export const workspaceOverview = () => api<WorkspaceOverview>('GET', '/workspace/overview');
