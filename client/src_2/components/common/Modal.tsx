/**
 * Modal - Accessible modal dialog for kiosk.
 */

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onClose={onClose}
      aria-label={title}
    >
      <div className="modal__header">
        <h2>{title}</h2>
        <button
          className="modal__close"
          onClick={onClose}
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
      <div className="modal__content">
        {children}
      </div>
    </dialog>
  );
}
