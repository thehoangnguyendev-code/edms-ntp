import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface CollapsibleProps {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * The content of a block that opens and closes: it grows to its height and fades in (200ms), and closes the same way, instead of
 * appearing and disappearing at once. The content is unmounted when closed, exactly as `{open && ...}` did.
 * Clipping applies only while it moves, so focus rings and shadows of the content are not cut off when it is still.
 * For people who ask their system for reduced motion it opens and closes at once.
 */
export const Collapsible: React.FC<CollapsibleProps> = ({ open, className, children }) => {
  const reduceMotion = useReducedMotion();
  const [moving, setMoving] = useState(false);
  const transition = { duration: reduceMotion ? 0 : 0.2, ease: "easeOut" as const };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapsible-content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={transition}
          onAnimationStart={() => setMoving(true)}
          onAnimationComplete={() => setMoving(false)}
          style={moving ? { overflow: "hidden" } : undefined}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
