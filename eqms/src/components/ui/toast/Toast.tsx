import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { X, Info, XCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../utils";
import { IconAlertTriangle, IconCheck, IconX } from "@tabler/icons-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number; // ms
}

interface ToastContextProps {
  showToast: (toast: Omit<Toast, "id"> & { id?: string }) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

const ICONS = {
  success: IconCheck,
  error: IconX,
  warning: IconAlertTriangle,
  info: Info,
};

const COLORS = {
  success:
    "bg-white/95 border-emerald-500 text-emerald-900 shadow-emerald-400/5",
  error: "bg-white/95 border-red-500 text-red-900 shadow-red-400/5",
  warning: "bg-white/95 border-amber-500 text-amber-900 shadow-amber-400/5",
  info: "bg-white/95 border-blue-500 text-blue-900 shadow-blue-400/5",
};

const ICON_COLORS = {
  success: "text-emerald-500 bg-emerald-50",
  error: "text-red-500 bg-red-50",
  warning: "text-amber-500 bg-amber-50",
  info: "text-blue-500 bg-blue-50",
};

const PROGRESS_COLORS = {
  success: "bg-emerald-500",
  error: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

/** Every toast must have a concise, visible heading. Callers can override this with an action-specific title. */
const DEFAULT_TITLES: Record<ToastType, string> = {
  success: "Success",
  error: "Action failed",
  warning: "Attention required",
  info: "Information",
};

const resolveToastTitle = (toast: Pick<Toast, "type" | "title">) =>
  toast.title?.trim() || DEFAULT_TITLES[toast.type];

const MAX_TOASTS = 3;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, "id"> & { id?: string }) => {
      const id = toast.id || Math.random().toString(36).slice(2, 10);

      setToasts((prev) => {
        const newToasts = [
          ...prev,
          { ...toast, id, title: resolveToastTitle(toast) },
        ];
        if (newToasts.length > MAX_TOASTS) {
          return newToasts.slice(-MAX_TOASTS);
        }
        return newToasts;
      });
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div
        className={cn(
          "fixed z-[9999] pointer-events-none flex flex-col items-center md:items-end w-full px-4 md:px-6",
        )}
        style={{
          top: "max(1rem, env(safe-area-inset-top, 1rem))",
          right: 0,
        }}
      >
        <div className="flex flex-col gap-3 w-full max-w-[400px] pointer-events-auto">
          <AnimatePresence mode="popLayout">
            {toasts.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({
  toast,
  onRemove,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [remaining, setRemaining] = useState(toast.duration ?? 5000);
  const startTime = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback(
    (time: number) => {
      startTime.current = Date.now();
      timerRef.current = setTimeout(() => onRemove(toast.id), time);
    },
    [onRemove, toast.id],
  );

  useEffect(() => {
    if (!isPaused) {
      startTimer(remaining);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startTimer, remaining, isPaused]);

  const handleMouseEnter = () => {
    setIsPaused(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      const elapsed = Date.now() - startTime.current;
      setRemaining((prev) => Math.max(0, prev - elapsed));
    }
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    // startTimer will be called by the useEffect because remaining is updated or just call it here if needed
    // But since we want to resume, we just let the effect handle it or trigger a re-render
  };

  const Icon = ICONS[toast.type];
  const duration = toast.duration ?? 5000;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -100, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        y: -100,
        scale: 0.95,
        transition: { duration: 0.2, ease: "easeIn" },
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        mass: 0.8,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative group w-full border rounded-xl shadow-lg overflow-hidden backdrop-blur-sm",
        COLORS[toast.type],
      )}
      role="alert"
    >
      <div className="flex items-center gap-3 px-3 py-2.5 md:py-3">
        <div
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-lg shrink-0 shadow-sm",
            ICON_COLORS[toast.type],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="mb-0.5 text-sm font-semibold tracking-normal text-slate-900">
              {resolveToastTitle(toast)}
            </h4>
            <button
              className="shrink-0 -mr-1 p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              aria-label="Close"
              onClick={() => onRemove(toast.id)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[13px] leading-relaxed text-slate-600 font-medium">
            {toast.message}
          </p>
        </div>
      </div>

      {/* Enhanced Progress Bar with Pause Support */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-100/50">
        <div
          className={cn("h-full origin-left", PROGRESS_COLORS[toast.type])}
          style={{
            width: "100%",
            animation: `shrink ${duration}ms linear forwards`,
            animationPlayState: isPaused ? "paused" : "running",
          }}
        />
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </motion.div>
  );
};
