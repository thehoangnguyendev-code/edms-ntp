import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, PenTool } from 'lucide-react';
import { IconArrowBigUpFilled } from "@tabler/icons-react";
import { Button } from '../button/Button';
import { Loading } from '../loading/Loading';
import { cn } from "@/components/ui/utils";
import { authApi } from "@/services/api/auth";
import { electronicSignatureSettingsApi, type ElectronicSignatureMeaning } from "@/services/api/electronicSignatureSettings";
import { tr } from "@/i18n";

export interface ESignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void | Promise<void>;
  /** Not shown: the dialog header always carries the compliance line. Kept so existing callers still compile. */
  actionTitle?: string;
  changes?: {
    action: string;
    oldValue: string;
    newValue: string;
    category?: 'metadata' | 'status' | 'approver' | 'reviewer';
  }[];
  /** Read-only context for the record or operation being signed. */
  targetDetails?: {
    code?: string;
    title?: string;
    revision?: string;
  };
  /** @deprecated Use targetDetails. Kept temporarily for existing callers. */
  documentDetails?: {
    code?: string;
    title?: string;
    revision?: string;
  };
  transactionType?: 'distribute' | 'cancel-distribution' | 'recall-distribution';
  /** Fallback meaning display name shown as readonly — e.g. "Approved". Overridden by the
   * admin-configured display name fetched via `meaningCode`, if any. */
  meaningDisplayName?: string;
  /** Stable system code (e.g. "APPROVED") used to fetch the admin-configured display name. */
  meaningCode?: string;
  /**
   * When true, this modal closes as soon as the signature/password itself is verified instead of
   * staying open (showing "Processing signature...") for the entire duration of onConfirm. Use
   * this whenever onConfirm kicks off a longer-running action that has its own dedicated
   * progress UI (e.g. a batch progress-bar modal) -- otherwise this modal's blocking spinner
   * covers that UI for the whole operation. onConfirm errors are not shown by this modal in that
   * case; the caller is responsible for its own error handling/feedback.
   */
  deferConfirm?: boolean;
}

export const ESignatureModal: React.FC<ESignatureModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  meaningDisplayName,
  meaningCode,
  deferConfirm = false,
}) => {
  const modalId = useId();
  const titleId = `${modalId}-title`;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [meaningPolicy, setMeaningPolicy] = useState<ElectronicSignatureMeaning | null>(null);
  const [freeReason, setFreeReason] = useState('');
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'username' | 'password' | 'reason', string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen || !meaningCode) return;
    let cancelled = false;
    setMeaningPolicy(null);
    electronicSignatureSettingsApi.getMeaningPolicy(meaningCode).then((policy) => {
      if (!cancelled) setMeaningPolicy(policy || null);
    }).catch(() => {
      if (!cancelled) setMeaningPolicy(null);
    });
    return () => { cancelled = true; };
  }, [isOpen, meaningCode]);

  const effectiveMeaningDisplayName = meaningPolicy?.displayName || meaningDisplayName;
  const effectiveReason = freeReason.trim();

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      const id = setTimeout(() => dialogRef.current?.focus(), 50);
      return () => clearTimeout(id);
    } else {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setUsername('');
      setPassword('');
      setFreeReason('');
      setIsCapsLockOn(false);
      setFormError('');
      setFieldErrors({});
    }
  }, [isOpen]);

  const handleDialogKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    if (isSubmitting) return;

    const nextErrors: Partial<Record<'username' | 'password' | 'reason', string>> = {};

    if (!username.trim()) {
      nextErrors.username = 'Username is required to complete the electronic signature.';
    }

    if (!effectiveReason) {
      nextErrors.reason = 'A signing reason is required for compliance.';
    }
    if (!password) {
      nextErrors.password = 'Password is required to complete the electronic signature.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const verification = await authApi.verifyESignature({ username: username.trim(), password });
      const confirmArgs = {
        username: verification.username,
        password,
        reason: effectiveReason,
        signatureToken: verification.signatureToken,
        timestamp: verification.timestamp,
      };
      if (deferConfirm) {
        // The signature itself is verified -- hand off to the caller's own progress/error UI
        // instead of keeping this modal (and its spinner) up for the whole action.
        void Promise.resolve(onConfirm(confirmArgs)).catch((err) => {
          console.error('Deferred onConfirm handler failed after signature verification', err);
        });
      } else {
        await onConfirm(confirmArgs);
      }
      setUsername('');
      setPassword('');
      setFreeReason('');
      setFormError('');
      setFieldErrors({});
    } catch (error) {
      const responseData = (error as any)?.response?.data;
      const message =
        responseData?.error?.message ||
        responseData?.message ||
        (error as Error)?.message ||
        'Unable to verify electronic signature.';
      const normalized = String(message).toLowerCase();

      const nextFieldErrors: Partial<Record<'username' | 'password' | 'reason', string>> = {};
      if (normalized.includes('current user') || normalized.includes('username')) {
        nextFieldErrors.username = 'Enter the username of the currently signed-in account.';
      } else if (normalized.includes('attempt') && normalized.includes('remaining')) {
        // A wrong password counts toward the account lockout; the person is told how many tries are left, so the server's words are shown as they are.
        nextFieldErrors.password = message;
      } else if (normalized.includes('invalid signature credentials') || normalized.includes('password') || normalized.includes('credential')) {
        nextFieldErrors.password = 'Electronic signature authentication failed. Please verify your username and password and try again.';
      } else if (normalized.includes('reason')) {
        nextFieldErrors.reason = message;
      } else {
        setFormError(message);
      }
      if (Object.keys(nextFieldErrors).length > 0) setFieldErrors(nextFieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordKeyEvent = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setIsCapsLockOn(event.getModifierState?.('CapsLock') ?? false);
  };

  // Keep modal visible while submitting even if parent sets isOpen=false
  const shouldShow = isOpen || isSubmitting;

  return createPortal(
    <AnimatePresence mode="wait">
      {shouldShow && (
        <motion.div
          key="esign-modal-wrapper"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overflow-hidden p-0 sm:p-4"
        >
          <motion.div
            key="esign-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={isSubmitting ? undefined : onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />

          <motion.div
            ref={dialogRef}
            key="esign-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360, duration: 0.3 }}
            className={cn(
              "bg-white shadow-2xl w-full sm:max-w-md border-0 sm:border border-slate-200 overflow-hidden relative z-10 flex flex-col focus:outline-none",
              "h-full sm:h-auto sm:max-h-[min(780px,90dvh)] rounded-none sm:rounded-xl",
              "pb-[env(safe-area-inset-bottom)]"
            )}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleDialogKeyDown}
          >
            {/* Submitting overlay */}
            <AnimatePresence>
              {isSubmitting && (
                <motion.div
                  key="esign-submitting-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/90 backdrop-blur-sm rounded-none sm:rounded-xl"
                >
                  <Loading size="lg" text="Processing signature..." />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50/50 min-h-[56px]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 shrink-0">
                  <PenTool className="h-4 w-4 text-emerald-700 -rotate-[90deg]" />
                </div>
                <div className="min-w-0">
                  <h3 id={titleId} className="text-sm md:text-base font-semibold text-slate-900 leading-tight truncate">
                    {tr("Electronic Signature")}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium truncate">{tr("Compliant with FDA 21 CFR Part 11")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={isSubmitting ? undefined : onClose}
                disabled={isSubmitting}
                aria-label={tr("Close dialog")}
                className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">

                {/* The signature carries its meaning; what changed is recorded in the Audit Trail. */}
                {effectiveMeaningDisplayName && (
                  <div className="flex items-baseline gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3.5 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 shrink-0">{tr("Meaning")}</span>
                    <span className="text-xs sm:text-sm font-medium text-slate-900 wrap-break-word min-w-0">{effectiveMeaningDisplayName}</span>
                  </div>
                )}

                {/* Form Fields */}
                <div className="space-y-3">
                  {/* Reason */}
                  <div className="space-y-1">
                    <label htmlFor={`${modalId}-reason`} className="text-xs sm:text-sm font-medium text-slate-700 capitalize">
                      {tr("Reason")}
                      <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
                    </label>

                    <textarea
                      id={`${modalId}-reason`}
                      value={freeReason}
                      onChange={(e) => setFreeReason(e.target.value)}
                      rows={2}
                      maxLength={500}
                      className={cn(
                        "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm resize-none",
                        fieldErrors.reason ? "border-red-400" : "border-slate-200"
                      )}
                      placeholder={tr("Enter your reason...")}
                    />

                    {fieldErrors.reason && (
                      <p className="text-xs text-red-600 leading-tight">{fieldErrors.reason}</p>
                    )}
                  </div>

                  {/* Both credentials are entered for every signing request. */}
                  <div className="space-y-1">
                    <label htmlFor={`${modalId}-username`} className="text-xs sm:text-sm font-medium text-slate-700 capitalize">
                      {tr("Username")} <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id={`${modalId}-username`}
                      name="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                      aria-invalid={Boolean(fieldErrors.username)}
                      aria-describedby={fieldErrors.username ? `${modalId}-username-error` : undefined}
                      className={cn(
                        "w-full h-9 px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm",
                        fieldErrors.username ? "border-red-400" : "border-slate-200"
                      )}
                      placeholder={tr("Enter your username")}
                    />
                    {fieldErrors.username && <p id={`${modalId}-username-error`} className="text-xs text-red-600 leading-tight">{fieldErrors.username}</p>}
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label htmlFor={`${modalId}-password`} className="text-xs sm:text-sm font-medium text-slate-700 capitalize">
                      {tr("Password")} <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id={`${modalId}-password`}
                        name="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handlePasswordKeyEvent}
                        onKeyUp={handlePasswordKeyEvent}
                        onBlur={() => setIsCapsLockOn(false)}
                        autoComplete="current-password"
                        className={cn(
                          "w-full h-9 px-3 py-1.5 pr-10 border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm",
                          fieldErrors.password ? "border-red-400" : "border-slate-200"
                        )}
                        placeholder={tr("Enter your password")}
                      />
                      {isCapsLockOn && (
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                          <div className="rounded-md border border-emerald-100 bg-emerald-50 p-1" title={tr("Caps Lock is ON")}>
                            <IconArrowBigUpFilled className="h-4 w-4 text-emerald-700" />
                          </div>
                        </div>
                      )}
                    </div>
                    {fieldErrors.password && (
                      <p className="text-xs text-red-600 leading-tight">{fieldErrors.password}</p>
                    )}
                  </div>

                  {formError && (
                    <div role="alert" className="flex items-start gap-1.5 text-xs text-red-600 font-medium bg-red-50 p-2 rounded-lg border border-red-100">
                      <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden="true" />
                      <span>{formError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 px-5 py-3 border-t border-slate-200 bg-slate-50/30 flex justify-end gap-2 min-h-[56px]">
                <Button type="button" size="sm" variant="outline" onClick={onClose} className="min-w-[5rem]">
                  {tr("Cancel")}
                </Button>
                <Button type="submit" size="sm" className="min-w-[5rem]" disabled={isSubmitting}>
                  {tr("Sign & Confirm")}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
