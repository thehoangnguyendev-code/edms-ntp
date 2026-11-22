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
import { DEFAULT_TOAST_HEX, DEFAULT_TOAST_SHADOW } from "@/styles/tokens";
import { cn } from "../utils";
import { IconAlertTriangle, IconCheck, IconX } from "@tabler/icons-react";
import { useBranding } from "@/components/branding/BrandLogo";
import { tr } from "@/i18n";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number; // ms
  /** A toast that shows a notification of the bell carries the icon of that notification and the colour of its priority (Low green, Medium yellow, High red), so that the toast and the list look the same. */
  icon?: React.ComponentType<{ className?: string }>;
  /** The background and text colour classes of that icon (for example "bg-amber-50 text-amber-600"). */
  iconClassName?: string;
  /** A colour (six-digit hex) for this toast alone, instead of the one of the system: the border and the time bar take it. A notification toast gives the colour of its priority. */
  color?: string;
  position?: "center" | "top-center" | "bottom-center" | "top-right" | "top-left" | "bottom-right" | "bottom-left";
  /** The strength of the shadow (0 to 100) for this toast alone, as the colour and the position above. */
  shadow?: number;
  /** What happens when the toast is clicked (open the notification); the toast closes after it. Without it the toast is not clickable. */
  onOpen?: () => void;
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

/**
 * Every toast has the one colour the administrator chose (Configuration, Notifications): its border, its time bar and, unless the caller gives the colours of a
 * notification icon, the tile of its icon. The kind of the toast (success, error…) only picks the icon and the default heading.
 */
const HEX = /^#[0-9a-f]{6}$/i;
const toastHex = (color?: string) => (color && HEX.test(color) ? color : DEFAULT_TOAST_HEX);

/** The shadow of a toast for a strength from 0 (none) to 100: it grows in offset, blur and darkness together. */
export const toastShadowCss = (strength?: number): string => {
  const level = typeof strength === "number" && Number.isFinite(strength) ? Math.min(100, Math.max(0, Math.round(strength))) : DEFAULT_TOAST_SHADOW;
  if (level === 0) return "none";
  return `0 ${Math.round(level * 0.25)}px ${Math.round(level * 0.5)}px rgba(15, 23, 42, ${(level * 0.0035).toFixed(3)})`;
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

type ToastPlacement = 'center' | 'top-center' | 'bottom-center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

const SAFE_TOP = "max(1rem, env(safe-area-inset-top, 1rem))";
const SAFE_BOTTOM = "max(1rem, env(safe-area-inset-bottom, 1rem))";

/** Container placement per admin-configured position. Top-right is the historical default. */
const TOAST_CONTAINER: Record<ToastPlacement, { align: string; style: React.CSSProperties }> = {
  'top-right': { align: "items-center md:items-end", style: { top: SAFE_TOP, right: 0 } },
  'top-left': { align: "items-center md:items-start", style: { top: SAFE_TOP, left: 0 } },
  center: { align: "items-center", style: { top: "50%", left: 0, transform: "translateY(-50%)" } },
  'bottom-right': { align: "items-center md:items-end", style: { bottom: SAFE_BOTTOM, right: 0 } },
  'top-center': { align: "items-center", style: { top: SAFE_TOP, left: 0 } },
  'bottom-center': { align: "items-center", style: { bottom: SAFE_BOTTOM, left: 0 } },
  'bottom-left': { align: "items-center md:items-start", style: { bottom: SAFE_BOTTOM, left: 0 } },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { toastPosition: configuredPosition, toastDurationSeconds, toastColor, toastShadow } = useBranding();
  const defaultDuration = (toastDurationSeconds ?? 5) * 1000;
  const toastPosition: ToastPlacement =
    configuredPosition && configuredPosition in TOAST_CONTAINER ? configuredPosition : 'top-right';

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, "id"> & { id?: string }) => {
      const id = toast.id || Math.random().toString(36).slice(2, 10);

      setToasts((prev) => {
        const newToasts = [
          ...prev,
          { ...toast, id, title: resolveToastTitle(toast), duration: toast.duration ?? defaultDuration },
        ];
        if (newToasts.length > MAX_TOASTS) {
          return newToasts.slice(-MAX_TOASTS);
        }
        return newToasts;
      });
    },
    [defaultDuration],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* one stack for each place a toast is shown in: the place of the system, and the one of a preview that has its own */}
      {Array.from(new Set(toasts.map((t) => t.position ?? toastPosition))).map((place) => (
        <div
          key={place}
          className={cn(
            "fixed z-[9999] pointer-events-none flex flex-col w-full px-4 md:px-6",
            TOAST_CONTAINER[place].align,
          )}
          style={TOAST_CONTAINER[place].style}
        >
          <div className="flex flex-col gap-3 w-full max-w-[400px] pointer-events-auto">
            <AnimatePresence mode="popLayout">
              {toasts
                .filter((toast) => (toast.position ?? toastPosition) === place)
                .map((toast) => (
                  <ToastItem key={toast.id} toast={toast} color={toast.color ?? toastColor} shadow={toast.shadow ?? toastShadow} onRemove={removeToast} />
                ))}
            </AnimatePresence>
          </div>
        </div>
      ))}
    </ToastContext.Provider>
  );
};

const ToastItem: React.FC<{ toast: Toast; color?: string; shadow?: number; onRemove: (id: string) => void }> = ({
  toast,
  color,
  shadow,
  onRemove,
}) => {
  const hex = toastHex(color);
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

  // The bar shows the time left. It is drawn from the clock, not from a CSS animation: a phone that asks for reduced motion (or saves battery) has every
  // animation cut to 0.01ms by the global rule, and an animated bar was then empty from the first moment.
  const duration = toast.duration ?? 5000;
  const [fraction, setFraction] = useState(1);
  useEffect(() => {
    if (isPaused) return;
    const from = remaining;
    const began = Date.now();
    let frame = 0;
    const tick = () => {
      const left = Math.max(0, from - (Date.now() - began));
      setFraction(duration > 0 ? left / duration : 0);
      if (left > 0) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [remaining, isPaused, duration]);

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

  const Icon = toast.icon ?? ICONS[toast.type];
  const open = toast.onOpen;

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
        "relative group w-full border rounded-xl overflow-hidden backdrop-blur-sm bg-white/95 text-slate-900",
        open && "cursor-pointer",
      )}
      role="alert"
      style={{ borderColor: hex, boxShadow: toastShadowCss(shadow) }}
      onClick={open ? () => { open(); onRemove(toast.id); } : undefined}
    >
      <div className="flex items-center gap-3 px-3 py-2.5 md:py-3">
        <div
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-lg shrink-0 shadow-sm",
            toast.iconClassName,
          )}
          // without the colours of a notification icon, the tile is the toast colour: a light tint behind the icon in the colour itself
          style={toast.iconClassName ? undefined : { backgroundColor: `${hex}1A`, color: hex }}
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
              aria-label={tr("Close")}
              onClick={(event) => { event.stopPropagation(); onRemove(toast.id); }}
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
          className="h-full origin-left"
          role="progressbar"
          aria-label={tr("Time left")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
          style={{ width: "100%", transform: `scaleX(${fraction})`, backgroundColor: hex }}
        />
      </div>
    </motion.div>
  );
};
