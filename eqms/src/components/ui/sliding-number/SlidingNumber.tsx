import { useEffect } from "react";
import { motion, useReducedMotion, useSpring, useTransform, type HTMLMotionProps, type MotionValue, type SpringOptions } from "motion/react";

/**
 * Sliding Number: every digit of a number is a column of 0-9 that slides to the new digit, so a number that changes is seen changing. The rolling and the spring are those of the
 * Animate UI primitive "Sliding Number" (https://animate-ui.com/docs/primitives/animate-ui/sliding-number), written here on `motion/react`, which the project already has, so that no
 * package with a long list of peer dependencies is added for one component. It differs in two things the check-in code needs: `minDigits` keeps the leading zeros of a code
 * ("048291" shows six digits), and the digits can start still (`initiallyStable`) while another animation shows the whole code.
 */
const ROLLER: SpringOptions = { stiffness: 200, damping: 20, mass: 0.4 };

export type SlidingNumberProps = Omit<HTMLMotionProps<"span">, "children"> & {
  /** A whole number, zero or more. */
  number: number;
  /** The number of digits is at least this: shorter numbers get leading zeros. */
  minDigits?: number;
  /** Spring of one digit. */
  transition?: SpringOptions;
  /** The digits start at `number` and roll only when it changes; by default they roll in from 0. */
  initiallyStable?: boolean;
};

function Digit({ value, transition, reduce, startAt }: { value: number; transition: SpringOptions; reduce: boolean; startAt: number }) {
  const position = useSpring(startAt, transition);
  useEffect(() => {
    if (reduce) position.jump(value);
    else position.set(value);
  }, [value, reduce, position]);
  return (
    <span
      aria-hidden="true"
      data-slot="sliding-number-roller"
      style={{ position: "relative", display: "inline-block", width: "1ch", overflowX: "visible", overflowY: "clip", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
    >
      <span style={{ visibility: "hidden" }}>0</span>
      {Array.from({ length: 10 }, (_, i) => (
        <Face key={i} position={position} face={i} />
      ))}
    </span>
  );
}

function Face({ position, face }: { position: MotionValue<number>; face: number }) {
  const transform = useTransform(position, (latest) => {
    const current = ((latest % 10) + 10) % 10;
    let offset = (10 + face - current) % 10;
    if (offset > 5) offset -= 10;
    return `translateY(${offset * 100}%)`;
  });
  return (
    <motion.span data-slot="sliding-number-display" style={{ transform, position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {face}
    </motion.span>
  );
}

export function SlidingNumber({ number, minDigits = 0, transition = ROLLER, initiallyStable = false, style, ...props }: SlidingNumberProps) {
  const reduce = Boolean(useReducedMotion());
  const text = String(Math.max(0, Math.floor(number))).padStart(minDigits, "0");
  return (
    <motion.span data-slot="sliding-number" style={{ display: "inline-flex", alignItems: "center", ...style }} {...props}>
      <span className="sr-only">{text}</span>
      {text.split("").map((char, i) => {
        // keyed from the right, so a digit that stays in its place keeps its own spring when the number gets longer or shorter
        return <Digit key={text.length - i} value={Number(char)} transition={transition} reduce={reduce} startAt={initiallyStable ? Number(char) : 0} />;
      })}
    </motion.span>
  );
}
