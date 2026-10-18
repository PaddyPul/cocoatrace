import { useLayoutEffect, useRef } from 'react';

export default function UnsavedChangesDialog({
  onStay,
  onLeave,
  local = false,
}: {
  onStay: () => void;
  onLeave: () => void;
  local?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    stay.current?.focus();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="unsaved-navigation-title"
      aria-describedby="unsaved-navigation-description"
      className="rounded-2xl border border-border bg-surface text-text p-6 max-w-md w-[calc(100%-2rem)] backdrop:bg-black/60"
      onCancel={(event) => {
        event.preventDefault();
        onStay();
      }}
    >
      <h2 id="unsaved-navigation-title" className="text-lg font-semibold">
        {local ? 'Discard unsaved changes?' : 'Leave unsaved changes?'}
      </h2>
      <p id="unsaved-navigation-description" className="my-4 text-sm">
        Your changes have not been saved. Stay to continue editing, or leave and discard the current
        draft. No draft is sent or stored by this prompt.
      </p>
      <div className="flex flex-wrap gap-3">
        <button ref={stay} type="button" className="btn" onClick={onStay}>
          Stay and keep editing
        </button>
        <button type="button" className="btn btn-danger" onClick={onLeave}>
          {local ? 'Discard changes' : 'Leave and discard changes'}
        </button>
      </div>
    </dialog>
  );
}
