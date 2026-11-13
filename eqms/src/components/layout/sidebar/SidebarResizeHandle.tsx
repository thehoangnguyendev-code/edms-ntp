import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/utils";
import {
  APP_SIDEBAR_KEYBOARD_STEP,
  APP_SIDEBAR_MAX_WIDTH,
  APP_SIDEBAR_MIN_WIDTH,
  APP_SIDEBAR_WIDTH,
  clampSidebarWidth,
} from "./sidebarWidths";

interface SidebarResizeHandleProps {
  width: number;
  /** The sidebar's left edge in the viewport, so the pointer position gives the new width. */
  getLeft: () => number;
  /** Live change while dragging or pressing keys. */
  onResize: (width: number) => void;
  /** The user let go (or finished a key press): store the width. */
  onCommit: (width: number) => void;
  onReset: () => void;
  /** Tells the sidebar to stop animating its width while the pointer drags it. */
  onDraggingChange: (dragging: boolean) => void;
}

/**
 * A handle on the sidebar's right edge, halfway down. Drag it, or focus it and press the arrow keys
 * (Home/End jump to the limits, Enter or a double click restores the default). The range is limited
 * on purpose: wide enough for the longest menu names, narrow enough to leave room for the page.
 */
export const SidebarResizeHandle: React.FC<SidebarResizeHandleProps> = ({
  width,
  getLeft,
  onResize,
  onCommit,
  onReset,
  onDraggingChange,
}) => {
  const [dragging, setDragging] = useState(false);
  const lastWidth = useRef(width);
  lastWidth.current = width;
  // Pointer moves are applied once per animation frame, with the latest position only.
  const pendingWidth = useRef<number | null>(null);
  const frame = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    if (pendingWidth.current !== null) {
      lastWidth.current = pendingWidth.current;
      onResize(pendingWidth.current);
      pendingWidth.current = null;
    }
  }, [onResize]);

  const stopDragging = useCallback(() => {
    setDragging(false);
    onDraggingChange(false);
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, [onDraggingChange]);

  // A drag that ends outside the window or is cancelled must never leave the page stuck in resize mode.
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onDraggingChange(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    pendingWidth.current = clampSidebarWidth(event.clientX - getLeft());
    if (frame.current === null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        flush();
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    flush();
    stopDragging();
    onCommit(lastWidth.current);
  };

  const handlePointerCancel = () => {
    if (!dragging) return;
    flush();
    stopDragging();
    onCommit(lastWidth.current);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = width - APP_SIDEBAR_KEYBOARD_STEP;
    else if (event.key === "ArrowRight") next = width + APP_SIDEBAR_KEYBOARD_STEP;
    else if (event.key === "Home") next = APP_SIDEBAR_MIN_WIDTH;
    else if (event.key === "End") next = APP_SIDEBAR_MAX_WIDTH;
    else if (event.key === "Enter") {
      event.preventDefault();
      onReset();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    const clamped = clampSidebarWidth(next);
    onResize(clamped);
    onCommit(clamped);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={APP_SIDEBAR_MIN_WIDTH}
      aria-valuemax={APP_SIDEBAR_MAX_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      title={`Drag to resize the sidebar. Double-click to reset to ${APP_SIDEBAR_WIDTH}px.`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
      // A 24px-wide strip straddles the sidebar edge; the visible grip is the slim bar inside it.
      className={cn(
        "group/resize absolute right-0 top-1/2 z-30 hidden h-20 w-6 -translate-y-1/2 translate-x-1/2 cursor-col-resize touch-none select-none items-center justify-center md:flex",
        "outline-none",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "rounded-[3px] bg-slate-300 transition-[width,height,background-color] duration-200 ease-out motion-reduce:transition-none",
          "group-hover/resize:bg-slate-400 group-focus-visible/resize:bg-slate-500",
          // A little bigger while it is held, so it is clear what is being dragged.
          dragging ? "h-10 w-[7px] bg-slate-500" : "h-8 w-[5px]",
        )}
      />
    </div>
  );
};
