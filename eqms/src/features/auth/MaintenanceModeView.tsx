import React from 'react';
import { motion } from 'framer-motion';
import { BrandLogo } from '@/components/branding/BrandLogo';
import { useTranslation } from '@/i18n';

export const MaintenanceModeView: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="relative isolate flex min-h-screen min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#fefcff] px-6 py-12">
      {/* Background radial gradients matching AuthLayout */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(circle at 30% 70%, rgba(173, 216, 230, 0.35), transparent 60%),
            radial-gradient(circle at 70% 30%, rgba(255, 182, 193, 0.4), transparent 60%)`,
        }}
      />

      {/* Brand Logo */}
      <div className="mb-16 flex items-center justify-center">
        <BrandLogo className="h-10 w-auto object-contain" />
      </div>

      {/* Content Section */}
      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          {t('maintenance.headingPrefix')}
          <br />
          {t('maintenance.headingSuffix')}
        </h1>

        <p className="mt-6 text-xs sm:text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
          {t('maintenance.description')}
        </p>

        {/* Animated Custom SVG Plug Illustration */}
        <div className="mt-12 w-full overflow-visible flex justify-center">
          <svg
            width="100%"
            height="200"
            viewBox="0 0 800 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="max-w-2xl overflow-visible"
          >
            {/* Left side (Blue Plug & Wire) */}
            <motion.g
              animate={{ x: [0, 8, 0] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
            >
              {/* Left wire segment stretching off-screen left */}
              <path
                d="M -200,90 L 210,90 A 16,16 0 0,1 226,106 L 226,114 A 16,16 0 0,0 242,130 L 284,130"
                stroke="#bae6fd"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Left wire accent/bend */}
              <path
                d="M 210,90 A 16,16 0 0,1 226,106 L 226,114 A 16,16 0 0,0 242,130"
                stroke="#0ea5e9"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Left plug cable guard */}
              <rect x="284" y="121" width="16" height="18" rx="3" fill="#0284c7" />

              {/* Left plug body */}
              <rect x="300" y="115" width="20" height="30" rx="4" fill="#1e3a8a" />
              <rect x="320" y="110" width="34" height="40" rx="6" fill="#3b82f6" />

              {/* Left plug prongs (Perfect symmetry around y=130) */}
              <rect x="354" y="117" width="20" height="8" rx="2" fill="#bae6fd" />
              <rect x="354" y="135" width="20" height="8" rx="2" fill="#bae6fd" />
            </motion.g>

            {/* Right side (Green Socket & Wire) */}
            <motion.g
              animate={{ x: [0, -8, 0] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
            >
              {/* Right wire segment stretching off-screen right */}
              <path
                d="M 516,130 L 558,130 A 16,16 0 0,0 574,114 L 574,106 A 16,16 0 0,1 590,90 L 1000,90"
                stroke="#4ade80"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Right wire accent/bend */}
              <path
                d="M 558,130 A 16,16 0 0,0 574,114 L 574,106 A 16,16 0 0,1 590,90"
                stroke="#16a34a"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Right socket cable guard */}
              <rect x="500" y="121" width="16" height="18" rx="3" fill="#15803d" />

              {/* Right socket body */}
              <rect x="446" y="110" width="34" height="40" rx="6" fill="#22c55e" />
              <rect x="480" y="115" width="20" height="30" rx="4" fill="#14532d" />
            </motion.g>
          </svg>
        </div>
      </div>
    </div>
  );
};
