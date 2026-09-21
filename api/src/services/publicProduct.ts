export type JourneyEvent = {
  type: 'harvest' | 'verification' | 'custody' | 'shipment' | 'recall';
  title: string;
  summary: string;
  occurredAt: string;
  location?: string | null;
  organization?: string | null;
  verified?: boolean;
};

export function buildJourney(parts: JourneyEvent[][]): JourneyEvent[] {
  return parts
    .flat()
    .filter((event) => Boolean(event.occurredAt))
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
}

export function deriveSafetyStatus(recalls: Array<{ status: string; severity: string }>):
  'clear' | 'advisory' | 'warning' | 'critical' {
  const active = recalls.filter((recall) => recall.status === 'active');
  if (active.some((recall) => recall.severity === 'critical')) return 'critical';
  if (active.some((recall) => recall.severity === 'warning')) return 'warning';
  if (active.some((recall) => recall.severity === 'advisory')) return 'advisory';
  return 'clear';
}
