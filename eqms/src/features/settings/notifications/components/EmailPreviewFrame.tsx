import { tr as __ariaTr } from "@/i18n";
import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { TabNav, type TabItem } from '@/components/ui/tabs/TabNav';
import { cn } from '@/components/ui/utils';
import { tr } from "@/i18n";

/** The scroll bar of the tables (thin, slate), for every area that scrolls on these screens. */
export const SCROLL = 'scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400';

const DEVICES: TabItem[] = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'mobile', label: 'Mobile' },
];

/** The Desktop / Mobile switch every preview of an email has, built from the shared tabs. */
export const DeviceSwitch: React.FC<{ mobile: boolean; onChange: (mobile: boolean) => void }> = ({ mobile, onChange }) => (
  <TabNav tabs={DEVICES} activeTab={mobile ? 'mobile' : 'desktop'} onChange={(id) => onChange(id === 'mobile')} variant="pill" ariaLabel={__ariaTr("Preview size")} layoutId="email-preview-device" />
);

/** A preview is a picture of the mail: its links and its button open nothing, so a click cannot leave the screen or load another page. */
const INERT = '<style>a,a *{pointer-events:none!important;cursor:default!important;}</style>';

/**
 * An email as the reader gets it, in a sandboxed frame: full width on desktop, 375px wide on mobile. Switching between the two slides the
 * frame out and the other one in (the page-transition of Animate UI, built on the motion the app already uses); with reduced motion it only fades.
 */
export const EmailPreviewFrame: React.FC<{ html: string; mobile: boolean; height?: number }> = ({ html, mobile, height = 300 }) => {
  const [fitted, setFitted] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const shift = reduced ? 0 : 28;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={mobile ? 'mobile' : 'desktop'}
        initial={{ opacity: 0, x: mobile ? shift : -shift }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: mobile ? -shift : shift }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <div className={cn('overflow-x-auto overflow-y-hidden', SCROLL)}>
          <iframe
            title={tr("Email preview")}
            // the frame has no scripts; the same-origin right only lets this page read how tall the mail is, so the frame never shows a scrollbar of its own
            sandbox="allow-same-origin"
            srcDoc={html + INERT}
            style={{ height: fitted ?? height }}
            scrolling="no"
            onLoad={(event) => {
              const doc = event.currentTarget.contentDocument;
              if (doc) setFitted(Math.max(120, Math.ceil(doc.body.getBoundingClientRect().height)));
            }}
            className={cn('block max-w-full border-0', mobile ? 'mx-auto w-[375px]' : 'w-full')}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
