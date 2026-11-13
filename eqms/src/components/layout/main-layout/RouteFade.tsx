import React, { useLayoutEffect, useRef } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";

interface RouteFadeProps {
  /** Changes when the person goes to another page; the page fades in each time. */
  routeKey: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Fades the page in when the route changes, so a new page does not pop in.
 * The page is NOT remounted (a key would reset the state of a page that stays mounted when only its id changes); the fade is
 * started from a layout effect, which runs before the browser paints, so the new content is never seen at full opacity first.
 * Only opacity is animated (no transform: that would trap the fixed elements of the page inside this box). Nothing runs for
 * people who ask their system for reduced motion, and not for the first page of a visit.
 */
export const RouteFade: React.FC<RouteFadeProps> = ({ routeKey, className, children }) => {
  const controls = useAnimationControls();
  const reduceMotion = useReducedMotion();
  const isFirstRoute = useRef(true);

  useLayoutEffect(() => {
    if (isFirstRoute.current) {
      isFirstRoute.current = false;
      return;
    }
    if (reduceMotion) return;
    controls.set({ opacity: 0 });
    void controls.start({ opacity: 1, transition: { duration: 0.18, ease: "easeOut" } });
  }, [routeKey, reduceMotion, controls]);

  return (
    <motion.div animate={controls} className={className}>
      {children}
    </motion.div>
  );
};
