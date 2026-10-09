import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AnnouncementDialogContent, type AnnouncementDialogContentProps } from "./AnnouncementDialogContent";

export interface AnnouncementModalProps extends Omit<AnnouncementDialogContentProps, "titleId" | "descriptionId" | "closeButtonRef" | "className"> {
  open: boolean;
}

/**
 * A system announcement as a modal in the centre of the screen. It is closed with its Close button or the Escape key; a click
 * on the backdrop deliberately does not close it, so a notice (for example about a planned maintenance) is not dismissed by
 * accident. Focus starts on Close and stays inside the dialog, the page behind does not scroll, and the dialog is announced
 * to assistive technology (as an alert dialog when it is critical). Motion is switched off for users who ask for less of it.
 */
export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ open, onClose, severity = "INFO", ...content }) => {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape closes; Tab never leaves the dialog (its focusable parts are the message, when it scrolls, and Close).
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>("[data-announcement-dialog]");
      const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Lock the page behind, put focus on Close, and give focus back to where it was when the dialog goes away.
  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      if (previousFocus.current && typeof previousFocus.current.focus === "function") previousFocus.current.focus();
    };
  }, [open]);

  const fade = reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" as const };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="announcement-modal"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
        >
          <div aria-hidden className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <motion.div
            data-announcement-dialog
            role={severity === "CRITICAL" ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="relative z-10 w-full max-w-md"
            style={{ maxHeight: "calc(100dvh - 2rem)" }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={fade}
          >
            <AnnouncementDialogContent
              {...content}
              severity={severity}
              onClose={onClose}
              titleId={titleId}
              descriptionId={descriptionId}
              closeButtonRef={closeRef}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
