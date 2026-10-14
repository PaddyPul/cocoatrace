export interface User {
  mfa?: { required: boolean; enrolled: boolean; verified: boolean; fresh: boolean };
  id: string;
  email: string;
  name: string;
  organizationId: string;
  orgName: string;
  orgType: string;
  roles: string[];
  permissions: string[];
}

export interface OnboardingState {
  user_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  current_step: number;
  primary_goal?: string | null;
  pilot_mode: boolean;
  completed_at?: string | null;
}
