import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "@/i18n";

// ─── FilterAccordionItem ──────────────────────────────────────────────
interface FilterAccordionItemProps {
  label: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export const FilterAccordionItem: React.FC<FilterAccordionItemProps> = ({
  label,
  isExpanded,
  onToggle,
  children,
  disabled,
}) => {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = useMemo(
    () =>
      shouldReduceMotion
        ? { duration: 0 }
        : { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const },
    [shouldReduceMotion]
  );

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 text-left group"
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium transition-colors duration-200",
            disabled
              ? "text-slate-400"
              : isExpanded
                ? "text-emerald-600"
                : "text-slate-900"
          )}>
            {label}
          </span>
          {disabled && (
            <Badge size="xs" color="slate">{t("filter.readOnly")}</Badge>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={transitionConfig}
          className={cn(
            "w-7 h-7 flex items-center justify-center",
            isExpanded ? "text-emerald-600" : "text-slate-300"
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -4 }}
            transition={{
              height: transitionConfig,
              opacity: { duration: shouldReduceMotion ? 0 : 0.24 },
              y: transitionConfig,
            }}
            style={{ overflow: "hidden" }}
            className={cn(
              "will-change-[height,opacity,transform]",
              disabled && "pointer-events-none grayscale-[0.2] opacity-60",
            )}
          >
            <div className="px-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


// ─── FilterDrawer Shell ──────────────────────────────────────────────
interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  title?: string;
  subTitle?: string;
  children: React.ReactNode;
  clearLabel?: string;
  applyLabel?: string;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  onClear,
  onApply,
  title,
  subTitle,
  children,
  clearLabel,
  applyLabel,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("filter.options");
  const resolvedClearLabel = clearLabel ?? t("filter.clearAll");
  const resolvedApplyLabel = applyLabel ?? t("filter.showResults");
  const [isClosing, setIsClosing] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(85); // vh
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(85);

  const CLOSE_THRESHOLD = 25;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartHeight.current = drawerHeight;
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const viewportHeight = window.innerHeight;
    const deltaY = dragStartY.current - clientY;
    const deltaVh = (deltaY / viewportHeight) * 100;
    let newHeight = dragStartHeight.current + deltaVh;
    newHeight = Math.max(0, Math.min(100, newHeight));
    setDrawerHeight(newHeight);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (drawerHeight < CLOSE_THRESHOLD) {
      handleClose();
    } else {
      setDrawerHeight(85); // Snap back
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientY);
  const handleTouchEnd = () => handleDragEnd();

  if (!isOpen && !isClosing) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:hidden">
      <style>{`
        @keyframes slideInBottom { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideOutBottom { from { transform: translateY(0); } to { transform: translateY(100%); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        .mobile-drawer-enter { animation: slideInBottom 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .mobile-drawer-exit { animation: slideOutBottom 0.3s cubic-bezier(0.4, 0, 1, 1) forwards; }
        .backdrop-enter { animation: fadeIn 0.3s ease-out forwards; }
        .backdrop-exit { animation: fadeOut 0.25s ease-in forwards; }
      `}</style>

      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-slate-900/60 backdrop-blur-sm",
          isClosing ? "backdrop-exit" : "backdrop-enter"
        )}
        onClick={handleClose}
      />

      {/* Drawer Content */}
      <div
        className={cn(
          "relative w-full bg-white rounded-t-2xl flex flex-col overflow-hidden shadow-2xl",
          isClosing ? "mobile-drawer-exit" : (!isDragging && "mobile-drawer-enter")
        )}
        style={{
          height: `${drawerHeight}dvh`,
          transition: isDragging ? 'none' : 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), height 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Mobile drag handle */}
        <div
          className="flex flex-col items-center py-3 cursor-grab active:cursor-grabbing select-none touch-none bg-white shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={cn(
            "rounded-full transition-all duration-200",
            isDragging ? "w-16 h-1.5 bg-slate-400" : "w-10 h-1 bg-slate-200"
          )} />
        </div>

        {/* Header */}
        <div className="px-4 py-1 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 leading-tight">{resolvedTitle}</h2>
              {subTitle && <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">{subTitle}</p>}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-0 bg-slate-50/30 scroll-smooth custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center gap-3 shrink-0 mb-safe">
          <Button
            variant="outline"
            className="flex-1 h-10"
            onClick={() => {
              onClear();
              handleClose();
            }}
          >
            {resolvedClearLabel}
          </Button>
          <Button
            variant="default"
            className="flex-1 h-10"
            onClick={onApply}
          >
            {resolvedApplyLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
