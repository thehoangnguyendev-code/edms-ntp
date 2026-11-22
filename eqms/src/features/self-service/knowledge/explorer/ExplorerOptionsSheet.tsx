import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, LayoutDashboard, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { FOCUS_RING, GROUP_LABEL } from "./explorerStyles";
import { SORT_OPTIONS, type SortKey, type ViewMode } from "./explorerModel";
import { useLanguage } from "@/i18n";

interface ExplorerOptionsSheetProps {
  open: boolean;
  sort: SortKey;
  view: ViewMode;
  widgetsVisible: boolean;
  widgetsAvailable: boolean;
  onSort: (value: SortKey) => void;
  onView: (value: ViewMode) => void;
  onToggleWidgets: () => void;
  onClose: () => void;
}

/**
 * Sort and view options on a phone, where the toolbar has no room for a select. Every control is a full-width row with a
 * 44px target, so it can be reached with one hand from the bottom of the screen.
 */
export const ExplorerOptionsSheet: React.FC<ExplorerOptionsSheetProps> = ({
  open, sort, view, widgetsVisible, widgetsAvailable, onSort, onView, onToggleWidgets, onClose,
}) => {
  const reduceMotion = useReducedMotion();
  const { t, tLabel } = useLanguage();
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
            aria-label="Sort and view options"
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl outline-none custom-scrollbar"
            initial={reduceMotion ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduceMotion ? undefined : { y: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 pb-2.5 pt-3">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-900">{t("knowledge.sortAndView", "Sort and view")}</p>
            </div>

            <div className="px-4 pb-2 pt-3">
              <p className={cn(GROUP_LABEL, "pb-1.5")}>{t("knowledge.sortBy", "Sort by")}</p>
              <div role="radiogroup" aria-label={t("knowledge.sortBy", "Sort by")} className="grid grid-cols-1 gap-0.5">
                {SORT_OPTIONS.map((option) => {
                  const active = option.value === sort;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onSort(option.value)}
                      className={cn(
                        "flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors",
                        FOCUS_RING,
                        active ? "bg-emerald-50 font-medium text-emerald-700" : "text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                        {active && <Check className="h-4 w-4" />}
                      </span>
                      {tLabel(option.label)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 px-4 pb-3 pt-3">
              <p className={cn(GROUP_LABEL, "pb-1.5")}>{t("knowledge.view", "View")}</p>
              <div role="group" aria-label={t("knowledge.view", "View mode")} className="flex gap-2">
                {([["grid", LayoutGrid, t("knowledge.grid", "Grid")], ["list", List, t("knowledge.list", "List")]] as const).map(([mode, Icon, label]) => (
                  <Button
                    key={mode}
                    variant={view === mode ? "outline-emerald" : "outline"}
                    onClick={() => onView(mode)}
                    aria-pressed={view === mode}
                    className="h-11 flex-1 gap-2"
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </Button>
                ))}
              </div>
            </div>

            {widgetsAvailable && (
              <div className="border-t border-slate-100 px-4 pb-3 pt-3">
                <p className={cn(GROUP_LABEL, "pb-1.5")}>{t("knowledge.home", "Home")}</p>
                <Button
                  variant={widgetsVisible ? "outline-emerald" : "outline"}
                  onClick={onToggleWidgets}
                  aria-pressed={widgetsVisible}
                  className="h-11 w-full justify-start gap-2"
                >
                  <LayoutDashboard className="h-4 w-4" /> {widgetsVisible ? t("knowledge.hideWidgets", "Hide overview widgets") : t("knowledge.showWidgets", "Show overview widgets")}
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
