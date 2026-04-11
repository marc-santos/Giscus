import { ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { DialogContext, IAlertDialogOptions, IConfirmDialogOptions } from '../lib/context';

interface DialogProviderProps {
  children: ReactNode;
}

type ConfirmDialogState = {
  type: 'confirm';
  message: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  scopeElement: HTMLElement | null;
  resolve: (value: boolean) => void;
};

type AlertDialogState = {
  type: 'alert';
  message: string;
  confirmText: string;
  scopeElement: HTMLElement | null;
  resolve: () => void;
};

type DialogState = ConfirmDialogState | AlertDialogState;

const FOCUSABLE_ELEMENTS_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function DialogProvider({ children }: DialogProviderProps) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [scopeRect, setScopeRect] = useState<DOMRect | null>(null);
  const [scopeRadius, setScopeRadius] = useState('0px');
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const messageId = useId();

  const closeConfirm = useCallback((result: boolean) => {
    setDialog((prevDialog) => {
      if (!prevDialog || prevDialog.type !== 'confirm') return prevDialog;
      prevDialog.resolve(result);
      return null;
    });
  }, []);

  const closeAlert = useCallback(() => {
    setDialog((prevDialog) => {
      if (!prevDialog || prevDialog.type !== 'alert') return prevDialog;
      prevDialog.resolve();
      return null;
    });
  }, []);

  const confirm = useCallback((options: IConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        type: 'confirm',
        message: options.message,
        confirmText: options.confirmText || 'OK',
        cancelText: options.cancelText || 'Cancel',
        destructive: !!options.destructive,
        scopeElement: options.scopeElement || null,
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: IAlertDialogOptions) => {
    return new Promise<void>((resolve) => {
      setDialog({
        type: 'alert',
        message: options.message,
        confirmText: options.confirmText || 'OK',
        scopeElement: options.scopeElement || null,
        resolve,
      });
    });
  }, []);

  useEffect(() => {
    if (!dialog?.scopeElement) {
      setScopeRect(null);
      setScopeRadius('0px');
      return;
    }

    const updateScope = () => {
      setScopeRect(dialog.scopeElement.getBoundingClientRect());
      setScopeRadius(getComputedStyle(dialog.scopeElement).borderRadius || '0px');
    };

    updateScope();
    window.addEventListener('resize', updateScope);
    window.addEventListener('scroll', updateScope, true);

    const observer = new ResizeObserver(updateScope);
    observer.observe(dialog.scopeElement);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScope);
      window.removeEventListener('scroll', updateScope, true);
    };
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const focusTarget =
      dialog.type === 'confirm'
        ? cancelButtonRef.current || confirmButtonRef.current
        : confirmButtonRef.current;

    (focusTarget || dialogRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (dialog.type === 'confirm') {
          closeConfirm(false);
          return;
        }
        closeAlert();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialogElement = dialogRef.current;
      if (!dialogElement) return;

      const focusableElements = Array.from(
        dialogElement.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS_SELECTOR),
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogElement.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (activeElement === firstElement || activeElement === dialogElement)) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [closeAlert, closeConfirm, dialog]);

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  const backdropStyle =
    scopeRect && dialog?.scopeElement
      ? {
          top: scopeRect.top,
          left: scopeRect.left,
          width: scopeRect.width,
          height: scopeRect.height,
          borderRadius: scopeRadius,
        }
      : undefined;

  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialog ? (
        <div
          className={`gsc-dialog-backdrop ${dialog.scopeElement ? 'is-scoped' : ''}`}
          role="presentation"
          style={backdropStyle}
          onMouseDown={() => {
            if (dialog.type === 'confirm') {
              closeConfirm(false);
              return;
            }
            closeAlert();
          }}
        >
          <div
            ref={dialogRef}
            role={dialog.type === 'alert' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-describedby={messageId}
            tabIndex={-1}
            className="gsc-dialog color-bg-overlay color-border-primary"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p id={messageId} className="gsc-dialog-message color-text-primary">
              {dialog.message}
            </p>
            <div className="gsc-dialog-actions">
              {dialog.type === 'confirm' ? (
                <button
                  ref={cancelButtonRef}
                  className="btn"
                  type="button"
                  onClick={() => closeConfirm(false)}
                >
                  {dialog.cancelText}
                </button>
              ) : null}
              <button
                ref={confirmButtonRef}
                className={`btn ${dialog.type === 'confirm' ? 'btn-primary' : ''} ${
                  dialog.type === 'confirm' && dialog.destructive ? 'gsc-dialog-danger' : ''
                }`}
                type="button"
                onClick={() => {
                  if (dialog.type === 'confirm') {
                    closeConfirm(true);
                    return;
                  }
                  closeAlert();
                }}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}
