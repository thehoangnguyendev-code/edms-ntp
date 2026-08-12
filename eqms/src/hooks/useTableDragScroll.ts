import { useState, useRef, useCallback } from 'react';

/**
 * A hook that enables drag-to-scroll functionality for table containers.
 * Prevents accidental clicks when dragging is detected.
 */
export const useTableDragScroll = () => {
  const [isDragging, setIsDragging] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragStartX = useRef(0);
  const scrollStartLeft = useRef(0);
  const dragMoved = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Reset drag flag at the very start of any mouse down
    dragMoved.current = false;

    // Only handle left mouse button
    if (e.button !== 0) return;
    
    // Don't start dragging if clicking on an interactive element (except for buttons/links if we want to allow dragging on them)
    const target = e.target as HTMLElement;
    if (target.closest('a, input, select')) {
      return;
    }

    dragStartX.current = e.clientX;
    scrollStartLeft.current = scrollerRef.current?.scrollLeft ?? 0;
    setIsDragging(true);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollerRef.current) return;
    
    const deltaX = e.clientX - dragStartX.current;
    if (Math.abs(deltaX) > 5) {
      dragMoved.current = true;
    }
    scrollerRef.current.scrollLeft = scrollStartLeft.current - deltaX;
  }, [isDragging]);

  const onMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  const onMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

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
