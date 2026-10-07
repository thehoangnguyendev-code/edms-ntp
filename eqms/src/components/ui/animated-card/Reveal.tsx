import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Fades and lifts its child into place; `index` staggers siblings. */
export const Reveal: React.FC<{ index?: number; className?: string; children: React.ReactNode }> = ({ index = 0, className, children }) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : Math.min(index, 12) * 0.05, ease: [0.2, 0.8, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};
