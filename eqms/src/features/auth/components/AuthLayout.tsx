import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AUTH_UI } from "../auth-ui";

interface AuthLayoutProps {
  left: React.ReactNode;
  right?: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ left, right: _right }) => {
  const prefersReducedMotion = useReducedMotion();

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const };

  const cardVariants = prefersReducedMotion
    ? {
        initial: { opacity: 1, y: 0, scale: 1 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 1, y: 0, scale: 1 },
      }
    : {
        initial: { opacity: 0, y: 16, scale: 0.995 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -10, scale: 0.995 },
      };

  return (
    <div className={AUTH_UI.pageWrapper} role="main">
      {/* Option 1: Dreamy Sky Pink (active) */}
      <div
        className={AUTH_UI.pageBgGlow}
        style={{
          backgroundImage: `
            radial-gradient(circle at 30% 70%, rgba(173, 216, 230, 0.35), transparent 60%),
            radial-gradient(circle at 70% 30%, rgba(255, 182, 193, 0.4), transparent 60%)`,
        }}
      />

      {/* Option 2: Aurora Ribbon (commented for later use) */}
      {/*
      <div className={AUTH_UI.pageBgBase} />
      <motion.div
        className={AUTH_UI.pageBgAuroraA}
        animate={prefersReducedMotion ? undefined : { x: [0, 28, -10], y: [0, 18, -8] }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 24, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.div
        className={AUTH_UI.pageBgAuroraB}
        animate={prefersReducedMotion ? undefined : { x: [0, -24, 12], y: [0, -14, 10] }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 29, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.div
        className={AUTH_UI.pageBgRibbon}
        animate={prefersReducedMotion ? undefined : { x: [0, 18, -14], y: [0, -8, 8] }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 31, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
      />
      <div className={AUTH_UI.pageBgNoise} />
      */}

      {/* Option 3: Dot Matrix + Halo (commented for later use) */}
      {/*
      <div className={AUTH_UI.pageBgBase} />
      <motion.div
        className={AUTH_UI.pageBgHalo}
        animate={prefersReducedMotion ? undefined : { x: [0, 24, -10], y: [0, -16, 8] }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 26, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
      />
      <div className={AUTH_UI.pageBgMatrix} />
      <div className={AUTH_UI.pageBgNoise} />
      */}

      <motion.div
        initial={cardVariants.initial}
        animate={cardVariants.animate}
        exit={cardVariants.exit}
        transition={transition}
        className={AUTH_UI.cardWrapper}
      >
        <div className={AUTH_UI.leftPanel}>
          {left}
        </div>
      </motion.div>
    </div>
  );
};
