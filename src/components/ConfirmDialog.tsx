import { useEffect, useRef } from 'react';
import { ChunkyButton } from './ChunkyButton.tsx';
import './ConfirmDialog.css';

/**
 * A plain-language confirmation. Uses the native <dialog> for built-in focus
 * trapping and Escape handling. Copy should be reassuring, not scary.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Keep it',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog ref={ref} className="confirm" onCancel={onCancel} onClose={onCancel}>
      <h2 className="confirm__title">{title}</h2>
      {body && <p className="confirm__body">{body}</p>}
      <div className="confirm__actions">
        <ChunkyButton size="lg" onClick={onCancel}>
          {cancelLabel}
        </ChunkyButton>
        <ChunkyButton size="lg" variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </ChunkyButton>
      </div>
    </dialog>
  );
}
