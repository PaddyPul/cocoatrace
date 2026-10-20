import type { Listing } from './types';

export function readShortlist(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.some((id) => typeof id !== 'string' || !id.trim()) ||
    value.length > 20
  )
    throw new Error(
      'Saved shortlist could not be read. Return to the marketplace to review your selections.',
    );
  return [...new Set(value)] as string[];
}

export function comparisonRows(
  ids: string[],
  pages: unknown[],
): { rows: Listing[]; unavailable: number } {
  if (pages.length !== ids.length)
    throw new Error('Comparison response is incomplete. Retry comparison.');
  const rows: Listing[] = [];
  let unavailable = 0;
  for (const [index, value] of pages.entries()) {
    const page = value as { items?: Listing[]; hasMore?: boolean; nextCursor?: unknown } | null;
    if (
      !page ||
      !Array.isArray(page.items) ||
      page.hasMore !== false ||
      page.nextCursor !== null ||
      page.items.length > 1 ||
      page.items.some(
        (item) =>
          !item ||
          item.id !== ids[index] ||
          !Number.isFinite(Number(item.available_quantity_kg)) ||
          !Number.isFinite(Number(item.price_per_kg)) ||
          typeof item.currency !== 'string',
      )
    )
      throw new Error('Invalid comparison response. Retry comparison.');
    if (page.items.length) rows.push(page.items[0]);
    else unavailable++;
  }
  return { rows, unavailable };
}
