import { useId, useLayoutEffect, useRef } from 'react';

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
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    cancel.current?.focus();
    return () => element?.close();
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      aria-busy={loading || undefined}
      className="rounded-2xl border border-border bg-surface text-text p-6 max-w-sm w-[calc(100%-2rem)] backdrop:bg-black/60"
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) onCancel();
      }}
    >
      <h2 id={titleId} className="text-base font-semibold mb-2">
        {title}
      </h2>
      <p id={messageId} className="text-xs text-text-muted mb-5">
        {message}
      </p>
      <div className="flex gap-2 justify-center">
        <button ref={cancel} type="button" className="btn" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Processing…' : confirmLabel || 'Confirm'}
        </button>
      </div>
    </dialog>
  );
}
