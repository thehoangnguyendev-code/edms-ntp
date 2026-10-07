import React, { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

/** Animates an integer toward its real value; always lands on exactly `value`. */
export const CountUp: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const shown = useRef(display);
  shown.current = display;

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const controls = animate(shown.current, value, {
      duration: 0.9,
      ease: [0.2, 0.8, 0.3, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
      onComplete: () => setDisplay(value),
    });
    return () => controls.stop();
  }, [value, reduceMotion]);

  return (
    <span className={className} aria-label={value.toLocaleString()}>
      <span aria-hidden>{display.toLocaleString()}</span>
    </span>
  );
};
