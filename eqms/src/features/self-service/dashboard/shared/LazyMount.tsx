import React, { useEffect, useRef, useState } from 'react';

interface LazyMountProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Shown, in the same box, until the content has come near the window. */
  placeholder?: React.ReactNode;
  /** How far (CSS margin) outside the window counts as "near", so the content is ready just before it is seen. */
  rootMargin?: string;
}

/**
 * Builds its children the first time the box comes near the visible window, and keeps them afterwards.
 *
 * A dashboard has many charts and most are below the fold; building them all at once costs time and makes every chart
 * animate while nobody is looking. Here a chart is created, and plays its entrance animation, when it is about to be seen.
 * Where IntersectionObserver does not exist the children are simply shown at once.
 */
export const LazyMount: React.FC<LazyMountProps> = ({ children, className, style, placeholder = null, rootMargin = '240px' }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (near) return undefined;
    const box = boxRef.current;
    if (!box) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [near, rootMargin]);

  return (
    <div ref={boxRef} className={className} style={style}>
      {near ? children : placeholder}
    </div>
  );
};
