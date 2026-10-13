import React, { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, File as FileGlyph, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/components/ui/utils";

/**
 * Files: an expandable tree of folders and files, in the manner of Animate UI's Files component (same parts and props:
 * Files, FolderItem, FolderTrigger, FolderPanel, FileItem, SubFiles). Folders open and close with a height animation,
 * a highlight slides between the rows the pointer visits, and each level hangs from a thin rail.
 *
 * It is written with framer-motion and the app's slate/emerald palette rather than copied from that library, because the
 * library's primitives sit on Base UI and Tailwind v4 colour variables, neither of which this app uses.
 */

interface FilesContextValue {
  /** Values of the folders that are open. */
  open: readonly string[];
  toggle: (value: string) => void;
  /** Row the pointer or keyboard focus is on; the highlight follows it. */
  hovered: string | null;
  setHovered: (id: string | null) => void;
  highlightId: string;
}

const FilesContext = createContext<FilesContextValue | null>(null);

const useFiles = () => {
  const context = useContext(FilesContext);
  if (!context) throw new Error("Files parts must be used inside <Files>");
  return context;
};

const FolderContext = createContext<{ value: string; isOpen: boolean } | null>(null);

const useFolder = () => {
  const context = useContext(FolderContext);
  if (!context) throw new Error("FolderTrigger and FolderPanel must be used inside <FolderItem>");
  return context;
};

export interface FilesProps {
  children: React.ReactNode;
  /** Folders open at the start (uncontrolled). */
  defaultOpen?: string[];
  /** Folders that are open (controlled). */
  open?: string[];
  onOpenChange?: (open: string[]) => void;
  className?: string;
  "aria-label"?: string;
}

export const Files: React.FC<FilesProps> = ({ children, defaultOpen = [], open, onOpenChange, className, "aria-label": ariaLabel }) => {
  const [inner, setInner] = useState<string[]>(defaultOpen);
  const [hovered, setHovered] = useState<string | null>(null);
  const highlightId = useId();
  const current = open ?? inner;

  const toggle = useCallback(
    (value: string) => {
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      if (open === undefined) setInner(next);
      onOpenChange?.(next);
    },
    [current, open, onOpenChange],
  );

  const context = useMemo<FilesContextValue>(() => ({ open: current, toggle, hovered, setHovered, highlightId }), [current, toggle, hovered, highlightId]);

  return (
    <FilesContext.Provider value={context}>
      <div role="tree" aria-label={ariaLabel} className={cn("w-full", className)} onMouseLeave={() => setHovered(null)}>
        {children}
      </div>
    </FilesContext.Provider>
  );
};

/** The children of an open folder, hung from a rail. */
export const SubFiles: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div role="group" className={cn("relative ml-3 border-l border-slate-200 pl-1.5", className)}>
    {children}
  </div>
);

/** The sliding highlight behind the row under the pointer. */
const RowHighlight: React.FC<{ rowId: string }> = ({ rowId }) => {
  const { hovered, highlightId } = useFiles();
  const reduceMotion = useReducedMotion();
  if (hovered !== rowId) return null;
  return (
    <motion.span
      aria-hidden="true"
      layoutId={highlightId}
      className="pointer-events-none absolute inset-0 z-0 rounded-lg bg-emerald-50/70"
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
    />
  );
};

const rowBase = "relative flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm font-medium transition-colors md:gap-2 md:py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

export interface FolderItemProps {
  /** Identifies the folder in `open`. */
  value: string;
  children: React.ReactNode;
}

export const FolderItem: React.FC<FolderItemProps> = ({ value, children }) => {
  const { open } = useFiles();
  const isOpen = open.includes(value);
  return (
    <FolderContext.Provider value={{ value, isOpen }}>
      <div role="treeitem" aria-expanded={isOpen} aria-selected={false}>
        {children}
      </div>
    </FolderContext.Provider>
  );
};

export interface FolderTriggerProps {
  children: React.ReactNode;
  /** Replaces the folder glyph. */
  icon?: React.ReactNode;
  /** Marks the folder that holds the current location. */
  active?: boolean;
  /** Shown at the right of the row, e.g. a count. */
  trailing?: React.ReactNode;
  /** Pressing the name; when omitted the name opens and closes the folder like the arrow does. */
  onSelect?: () => void;
  /** Called after the folder opens, so a caller can load its contents. */
  onOpen?: () => void;
  /** Called when the pointer or focus reaches the row, so contents can be ready before the folder is opened. */
  onPrefetch?: () => void;
  /** Hides the arrow, for a folder known to be empty. */
  leaf?: boolean;
  /** Accessible name of the arrow; defaults to "Expand"/"Collapse". */
  toggleLabel?: string;
  className?: string;
}

export const FolderTrigger: React.FC<FolderTriggerProps> = ({ children, icon, active, trailing, onSelect, onOpen, onPrefetch, leaf, toggleLabel, className }) => {
  const { toggle, setHovered } = useFiles();
  const { value, isOpen } = useFolder();
  const reduceMotion = useReducedMotion();
  const rowId = useId();

  const flip = () => {
    toggle(value);
    if (!isOpen) onOpen?.();
  };

  return (
    <div
      className="relative flex items-center gap-0.5"
      onMouseEnter={() => { setHovered(rowId); onPrefetch?.(); }}
      onFocus={() => { setHovered(rowId); onPrefetch?.(); }}
    >
      <RowHighlight rowId={rowId} />
      {leaf ? (
        <span className="h-10 w-6 shrink-0 md:h-7" aria-hidden="true" />
      ) : (
        <button
          type="button"
          onClick={flip}
          aria-label={toggleLabel ?? (isOpen ? "Collapse" : "Expand")}
          aria-expanded={isOpen}
          className="relative z-10 grid h-10 w-6 shrink-0 place-items-center md:h-7 rounded-lg text-slate-400 transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }} className="flex">
            <ChevronRight className="h-4 w-4 md:h-3.5 md:w-3.5" aria-hidden="true" />
          </motion.span>
        </button>
      )}
      <button
        type="button"
        onClick={onSelect ?? flip}
        aria-current={active ? "page" : undefined}
        className={cn(rowBase, "z-10", active ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:text-emerald-700", className)}
      >
        <span className="flex shrink-0 items-center" aria-hidden="true">
          {icon ?? (isOpen ? <FolderOpen className="h-5 w-5 md:h-4 md:w-4" /> : <Folder className="h-5 w-5 md:h-4 md:w-4" />)}
        </span>
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {trailing}
      </button>
    </div>
  );
};

/**
 * The contents of a folder. The panel animates to the height its contents really have and keeps following it, so rows that
 * arrive after it opened (a level read from the server) grow the panel smoothly instead of making it jump.
 */
export const FolderPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOpen } = useFolder();
  const reduceMotion = useReducedMotion();
  const content = useRef<HTMLDivElement>(null);
  // "auto" until the browser can measure; where it cannot (no ResizeObserver) the panel simply keeps "auto".
  const [height, setHeight] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    const element = content.current;
    if (!isOpen || !element || typeof ResizeObserver === "undefined") return undefined;
    setHeight(element.offsetHeight);
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [isOpen]);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
          animate={{ height, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { height: { type: "spring", stiffness: 260, damping: 32, mass: 0.9 }, opacity: { duration: 0.18 } }
          }
          className="overflow-hidden"
        >
          <div ref={content}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export interface FileItemProps {
  children: React.ReactNode;
  icon?: React.ElementType;
  active?: boolean;
  trailing?: React.ReactNode;
  onSelect?: () => void;
  className?: string;
}

export const FileItem: React.FC<FileItemProps> = ({ children, icon: Icon = FileGlyph, active, trailing, onSelect, className }) => {
  const { setHovered } = useFiles();
  const rowId = useId();
  return (
    <div role="treeitem" aria-selected={!!active} className="relative flex items-center" onMouseEnter={() => setHovered(rowId)} onFocus={() => setHovered(rowId)}>
      <RowHighlight rowId={rowId} />
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className={cn(rowBase, "z-10", active ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:text-emerald-700", className)}
      >
        <Icon className="h-5 w-5 shrink-0 md:h-4 md:w-4" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {trailing}
      </button>
    </div>
  );
};
