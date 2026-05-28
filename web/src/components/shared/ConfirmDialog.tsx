export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-center py-4">
          <div className="text-2xl mb-3">{danger ? '⚠️' : '❓'}</div>
          <div className="text-base font-semibold mb-2">{title}</div>
          <p className="text-xs text-text-muted mb-5">{message}</p>
          <div className="flex gap-2 justify-center">
            <button className="btn" onClick={onCancel} disabled={loading}>Cancel</button>
            <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={loading}>
              {loading ? 'Processing…' : confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
