import { useReducedMotion } from "framer-motion";

/**
 * One motion for every expandable table row (the chevron in the first column): an ease-in-out tween of 0.4 s, not a spring. The earlier
 * spring (stiffness 90, damping 16) took close to a second to settle and overshot, which read as stutter on a tall table.
 */
export const EXPAND_ROW_TRANSITION = { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

/** The transition to use now: none at all for a user who asked the system for reduced motion. */
export const useExpandTransition = () => {
  const reduce = useReducedMotion();
  return reduce ? { duration: 0 } : EXPAND_ROW_TRANSITION;
};

/** The height-and-fade states of the content of an expanded row, shared by every expand row. */
export const EXPAND_CONTENT_MOTION = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
} as const;
