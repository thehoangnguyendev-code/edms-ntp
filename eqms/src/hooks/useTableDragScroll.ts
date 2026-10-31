import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * A hook that enables drag-to-scroll functionality for table containers.
 * Prevents accidental clicks when dragging is detected.
 */
export const useTableDragScroll = () => {
  const [isDragging, setIsDragging] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const scrollStartLeft = useRef(0);
  const dragMoved = useRef(false);
  const canStartDrag = useRef(false);
  const scrollFrame = useRef<number | null>(null);
  const pendingScrollLeft = useRef<number | null>(null);
  const dragScrollStyle = useRef<{ element: HTMLElement; behavior: string } | null>(null);

  const restoreScrollBehavior = useCallback(() => {
    const saved = dragScrollStyle.current;
    if (saved) saved.element.style.scrollBehavior = saved.behavior;
    dragScrollStyle.current = null;
  }, []);

  const flushScroll = useCallback(() => {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
    if (pendingScrollLeft.current !== null && scrollerRef.current) {
      scrollerRef.current.scrollLeft = pendingScrollLeft.current;
    }
    pendingScrollLeft.current = null;
  }, []);

  useEffect(() => () => {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    restoreScrollBehavior();
  }, [restoreScrollBehavior]);

  // Native scrollbar gestures must never also start content dragging. clientWidth/clientHeight
  // exclude the scrollbar gutter; the bounding rectangle includes it (and the border).
  const isOverScrollbar = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current;
    if (!scroller || !scroller.clientWidth || !scroller.clientHeight) return false;
    const bounds = scroller.getBoundingClientRect();
    const left = bounds.left + scroller.clientLeft;
    const top = bounds.top + scroller.clientTop;
    return e.clientX < left || e.clientX >= left + scroller.clientWidth
      || e.clientY < top || e.clientY >= top + scroller.clientHeight;
  }, []);

  /**
   * The browser reports an element (usually a TD) for both its text and its padding.
   * A caret range lets us tell whether the pointer is actually over rendered characters:
   * text keeps native selection/copy; padding remains the drag-to-scroll surface.
   */
  const isPointerOverText = useCallback((clientX: number, clientY: number) => {
    const range = document.caretRangeFromPoint?.(clientX, clientY);
    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE || !range.startContainer.textContent?.trim()) {
      return false;
    }

    const textRange = document.createRange();
    textRange.selectNodeContents(range.startContainer);
    return Array.from(textRange.getClientRects()).some((rect) =>
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom,
    );
  }, []);

  /**
   * The container has a grab cursor by default, but that must not suggest dragging when
   * the pointer is over selectable record text or an interactive control.
   */
  const updateCursor = useCallback((e: React.MouseEvent<HTMLDivElement>, forceIdle = false) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    if (isDragging && !forceIdle) {
      scroller.style.cursor = "grabbing";
      return;
    }

    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, [contenteditable="true"]')) {
      scroller.style.cursor = "text";
    } else if (target.closest('a, button, select, [role="button"]')) {
      scroller.style.cursor = "pointer";
    } else {
      scroller.style.cursor = isPointerOverText(e.clientX, e.clientY) ? "text" : "grab";
    }
  }, [isDragging, isPointerOverText]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Reset drag flag at the very start of any mouse down
    dragMoved.current = false;
    canStartDrag.current = false;
    flushScroll();

    // Only handle left mouse button
    if (e.button !== 0 || isOverScrollbar(e)) return;
    updateCursor(e);
    
    // Don't start dragging if clicking on an interactive element (except for buttons/links if we want to allow dragging on them)
    const target = e.target as HTMLElement;
    if (target.closest('a, button, input, select, textarea, [contenteditable="true"]')) {
      return;
    }

    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    scrollStartLeft.current = scrollerRef.current?.scrollLeft ?? 0;
    // Never take over a drag that started on visible record text. This preserves standard
    // click-and-drag text selection and Ctrl/Cmd+C, while cell padding still scrolls horizontally.
    canStartDrag.current = !isPointerOverText(e.clientX, e.clientY);
  }, [isPointerOverText, updateCursor, isOverScrollbar, flushScroll]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!canStartDrag.current || !scrollerRef.current) {
      if (!isOverScrollbar(e)) updateCursor(e);
      return;
    }
    
    const deltaX = e.clientX - dragStartX.current;
    const deltaY = e.clientY - dragStartY.current;
    // A small threshold avoids stealing ordinary clicks. Vertical movement is left to the
    // page/table's normal scroll behavior; this hook is intentionally horizontal only.
    if (!dragMoved.current && Math.abs(deltaX) > 5 && Math.abs(deltaX) > Math.abs(deltaY)) {
      const element = scrollerRef.current;
      dragScrollStyle.current = { element, behavior: element.style.scrollBehavior };
      // Smooth programmatic navigation is useful elsewhere, but direct dragging must follow
      // the pointer immediately instead of restarting a CSS scroll animation on every frame.
      element.style.scrollBehavior = 'auto';
      setIsDragging(true);
      dragMoved.current = true;
      scrollerRef.current.style.cursor = "grabbing";
    }
    if (isDragging || dragMoved.current) {
      e.preventDefault();
      // Only write once per paint; use the latest pointer position instead of queuing moves.
      // Do not perform caret/layout hit testing while a drag is already in progress.
      pendingScrollLeft.current = scrollStartLeft.current - deltaX;
      if (scrollFrame.current === null) {
        scrollFrame.current = requestAnimationFrame(() => {
          scrollFrame.current = null;
          flushScroll();
        });
      }
    }
  }, [isDragging, updateCursor, isOverScrollbar, flushScroll]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    flushScroll();
    restoreScrollBehavior();
    canStartDrag.current = false;
    if (isDragging) {
      setIsDragging(false);
    }
    updateCursor(e, true);
  }, [isDragging, updateCursor, flushScroll, restoreScrollBehavior]);

  const onMouseLeave = useCallback(() => {
    flushScroll();
    restoreScrollBehavior();
    canStartDrag.current = false;
    if (scrollerRef.current) {
      scrollerRef.current.style.cursor = "";
    }
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging, flushScroll, restoreScrollBehavior]);

  const onClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMoved.current) {
      dragMoved.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    scrollerRef,
    isDragging,
    dragEvents: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
      onClickCapture,
    }
  };
};
