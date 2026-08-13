import React, { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "../button/Button";
import { ButtonLoading } from "../loading/Loading";
import { cn } from "../utils";
import { useTranslation } from "@/i18n";

interface NavigationGuardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mode?: "navigate" | "discard";
  title?: string;
  description?: React.ReactNode;
  currentPageTitle?: string;
  destinationLabel?: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  isLoading?: boolean;
}

export const NavigationGuardModal: React.FC<NavigationGuardModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  mode = "navigate",
  title,
  description,
  currentPageTitle,
  destinationLabel,
  primaryActionLabel,
  secondaryActionLabel,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableEls = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusableEls.length === 0) return;
        const first = focusableEls[0];
        const last = focusableEls[focusableEls.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    requestAnimationFrame(() => {
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled])',
      );
      firstFocusable?.focus();
    });

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))",
            paddingLeft: "max(1rem, env(safe-area-inset-left, 1rem))",
            paddingRight: "max(1rem, env(safe-area-inset-right, 1rem))",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
          />

          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="navigation-guard-modal-title"
            aria-describedby="navigation-guard-modal-desc"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-md"
            style={{ maxHeight: "calc(100dvh - 2rem)" }}
          >
            <div className="border-b border-slate-100 bg-amber-50/70 px-5 py-3 sm:px-6">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3
                    id="navigation-guard-modal-title"
                    className="text-base font-semibold text-slate-900"
                  >
                    {title || (mode === "discard" ? t("navigationGuard.discardTitle") : t("navigationGuard.leaveTitle"))}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {mode === "discard"
                      ? t("navigationGuard.discardSummary")
                      : t("navigationGuard.leaveSummary")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
                  aria-label={t("alertModal.closeDialog")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-5 py-5 sm:px-6">
              <div id="navigation-guard-modal-desc" className="space-y-3 text-sm leading-relaxed text-slate-700">
                {description ? (
                  <div className="space-y-3">{description}</div>
                ) : mode === "discard" ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <p>
                      {t("navigationGuard.discardWarningPrefix")} {" "}
                      <span className="font-semibold text-slate-900">{currentPageTitle || t("navigationGuard.thisForm")}</span> {t("navigationGuard.discardWarningSuffix")}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">
                      {t("navigationGuard.cannotUndo")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p>
                      {t("navigationGuard.leaveWarningPrefix")} <span className="font-semibold text-slate-900">{currentPageTitle || t("navigationGuard.thisPage")}</span>{t("navigationGuard.leaveWarningSuffix")}
                    </p>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t("navigationGuard.currentPage")}
                          </div>
                          <div className="mt-1 font-medium text-slate-900">
                            {currentPageTitle || t("navigationGuard.thisPage")}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t("navigationGuard.nextPage")}
                          </div>
                          <div className="mt-1 font-medium text-amber-700">
                            {destinationLabel || t("navigationGuard.anotherPage")}
                          </div>
                        </div>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        {t("navigationGuard.progressNotRecovered")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 sm:gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
              <Button
                size="sm"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="min-w-[120px]"
              >
                {secondaryActionLabel || (mode === "discard" ? t("navigationGuard.keepEditing") : t("navigationGuard.stayOnPage"))}
              </Button>
              <Button
                size="sm"
                onClick={onConfirm}
                disabled={isLoading}
                className={cn(
                  "min-w-[120px]",
                  "bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500",
                )}
              >
                {isLoading ? (
                  <ButtonLoading text={t("alertModal.processing")} light />
                ) : (
                  primaryActionLabel || (mode === "discard" ? t("navigationGuard.discardChanges") : t("navigationGuard.leaveAnyway"))
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
