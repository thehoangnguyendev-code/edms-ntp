import React, { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../button/Button';
import { cn } from '../utils';
import { ButtonLoading } from '../loading/Loading';

export interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmText?: React.ReactNode;
  cancelText?: React.ReactNode;
  isLoading?: boolean;
  confirmDisabled?: boolean;
  showCancel?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  confirmVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  showFooter?: boolean;
  footerLeft?: React.ReactNode;
  className?: string;
}

const sizeToClass: Record<NonNullable<FormModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-3xl',
};

export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmText = 'Save',
  cancelText = 'Cancel',
  isLoading = false,
  confirmDisabled = false,
  showCancel = true,
  confirmVariant = 'default',
  showFooter = true,
  footerLeft,
  size = 'xl',
  className,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !modalRef.current) {
        return;
      }

      const focusableEls = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusableEls.length === 0) {
        return;
      }

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
        return;
      }

      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  // Manage Keyboard Events
  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Manage Initial Focus and Restore Focus
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const focusTimeout = setTimeout(() => {
      if (!modalRef.current) return;

      const firstFocusable = modalRef.current.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      firstFocusable?.focus();
    }, 100); // Small delay to ensure animation has started

    return () => {
      clearTimeout(focusTimeout);
      // Restore focus safely
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  const portalContent = createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="form-modal-wrapper"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden"
          style={{
            paddingTop: `max(0.75rem, env(safe-area-inset-top))`,
            paddingBottom: `max(0.75rem, env(safe-area-inset-bottom))`,
            paddingLeft: `max(0.75rem, env(safe-area-inset-left))`,
            paddingRight: `max(0.75rem, env(safe-area-inset-right))`,
          }}
        >
          {/* Backdrop */}
          <motion.div
            key="form-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            ref={modalRef}
            key="form-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 350,
              duration: 0.3
            }}
            className={cn(
              'bg-white/95 backdrop-blur-md rounded-xl w-full border border-slate-200 overflow-hidden flex flex-col relative z-10',
              sizeToClass[size],
              className
            )}
            style={{ maxHeight: 'calc(100dvh - 2rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-200 bg-white shrink-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h3 id={titleId} className="text-sm sm:text-base font-semibold text-slate-900 leading-tight truncate">{title}</h3>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 sm:py-5 bg-white overflow-y-auto flex-1 min-h-0">
              {description && (
                <div id={descriptionId} className="mb-4 text-xs sm:text-sm text-slate-500 leading-relaxed">{description}</div>
              )}
              {children}
            </div>

            {showFooter && (
              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50/50 border-t border-slate-200 flex justify-between items-center shrink-0">
                <div className="flex-1">
                  {footerLeft}
                </div>
                <div className="flex justify-end gap-2 sm:gap-3">
                  {showCancel && (
                    <Button size="sm" variant="outline" onClick={onClose} disabled={isLoading}>
                      {cancelText}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={confirmVariant}
                    onClick={onConfirm || onClose}
                    disabled={isLoading || confirmDisabled}
                  >
                    {isLoading ? <ButtonLoading text="Processing..." light={confirmVariant === 'default' || confirmVariant === 'destructive'} /> : confirmText}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );

  return portalContent;
};
