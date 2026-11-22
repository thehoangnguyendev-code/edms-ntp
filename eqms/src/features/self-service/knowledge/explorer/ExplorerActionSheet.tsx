import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/components/ui/utils";
import type { ContextMenuAction } from "./ExplorerContextMenu";
import { FOCUS_RING } from "./explorerStyles";
import { useLanguage } from "@/i18n";

interface ExplorerActionSheetProps {
  open: boolean;
  title: string;
  actions: ContextMenuAction[];
  onClose: () => void;
}

/**
 * The actions of a tile or a row, on a small screen: a bottom sheet instead of a right-click menu. Right-click is not a touch
 * gesture people can rely on, so every item also carries a visible "actions" button that opens this sheet.
 */
export const ExplorerActionSheet: React.FC<ExplorerActionSheetProps> = ({ open, title, actions, onClose }) => {
  const reduceMotion = useReducedMotion();
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => { document.removeEventListener("keydown", onKeyDown); window.clearTimeout(timer); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden" role="presentation">
          <motion.div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title ? `${t("knowledge.actionsFor", "Actions for")} ${title}` : t("knowledge.actions", "Actions")}
            className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl outline-none custom-scrollbar"
            initial={reduceMotion ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduceMotion ? undefined : { y: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 pb-2.5 pt-3">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
              <p className="truncate text-sm font-semibold text-slate-900" title={title}>{title}</p>
            </div>
            <div className="p-2" role="menu" aria-label={t("knowledge.actions", "Actions")}>
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  onClick={() => { onClose(); action.onSelect(); }}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors",
                    FOCUS_RING,
                    action.separatorBefore && "mt-1 border-t border-slate-100 pt-2",
                    "text-slate-700 hover:bg-slate-50 active:bg-slate-100",
                  )}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center text-slate-500" aria-hidden="true">{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
            <div className="px-2 pb-1 pt-1">
              <button
                type="button"
                onClick={onClose}
                className={cn("min-h-12 w-full rounded-lg text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50", FOCUS_RING)}
              >
                {t("knowledge.cancel", "Cancel")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
