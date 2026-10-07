export default function PageNavigation({
  page,
  label,
}: {
  page: {
    pageNumber: number;
    hasNext: boolean;
    hasPrevious: boolean;
    loading: boolean;
    next: () => void;
    previous: () => void;
  };
  label: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3" aria-label={`${label} pagination`}>
      <button
        type="button"
        className="btn"
        disabled={page.loading || !page.hasPrevious}
        onClick={page.previous}
      >
        Previous {label}
      </button>
      <span className="text-xs text-text-muted" role="status">
        Page {page.pageNumber}
      </span>
      <button
        type="button"
        className="btn"
        disabled={page.loading || !page.hasNext}
        onClick={page.next}
      >
        Next {label}
      </button>
    </div>
  );
}
