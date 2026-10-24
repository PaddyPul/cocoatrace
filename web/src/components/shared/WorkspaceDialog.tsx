import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { containDialogTab } from './dialogKeyboard';

export default function WorkspaceDialog({
  children,
  label,
  onClose,
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      element?.close();
      queueMicrotask(() => {
        if (
          trigger?.isConnected &&
          trigger.getClientRects().length &&
          !document.querySelector('dialog[open]')
        )
          trigger.focus();
      });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={label}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-4 text-inherit open:flex open:items-center open:justify-center backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      onKeyDown={containDialogTab}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
