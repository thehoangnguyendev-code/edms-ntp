import React, { useEffect, useState } from "react";
import { cn } from "@/components/ui/utils";
import { IconChevronUp } from "@tabler/icons-react";
import { useTranslation } from "@/i18n";

// Easing function: easeInOutQuart
const easeInOutQuart = (t: number): number =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

const smoothScrollTo = (el: HTMLElement | Window, targetY: number, duration = 500) => {
  const start = el instanceof Window ? el.scrollY : el.scrollTop;
  const distance = targetY - start;
  if (distance === 0) return;
  const startTime = performance.now();

  const step = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutQuart(progress);
    const scrollTo = start + distance * eased;

    if (el instanceof Window) {
      el.scrollTo(0, scrollTo);
    } else {
      el.scrollTop = scrollTo;
    }

    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
};

interface ScrollToTopProps {
  /** Ref to the scrollable container element. Defaults to window if not provided. */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** Threshold in pixels to show the button. Default: 300 */
  threshold?: number;
  /** Hide button when mobile sidebar is open */
  isMobileMenuOpen?: boolean;
}

export const ScrollToTop: React.FC<ScrollToTopProps> = ({
  scrollContainerRef,
  threshold = 300,
  isMobileMenuOpen = false,
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // We need to wait for the ref to be populated
    const container = scrollContainerRef?.current ?? window;

    const handleScroll = () => {
      const scrollTop =
        container instanceof Window
          ? container.scrollY
          : (container as HTMLElement).scrollTop;
      setVisible(scrollTop > threshold);
    };

    // Attach listener
    container.addEventListener("scroll", handleScroll, { passive: true });
    
    // Trigger initial check
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [scrollContainerRef?.current, threshold]);

  const scrollToTop = () => {
    const container = scrollContainerRef?.current ?? window;
    smoothScrollTo(container, 0);
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label={t("scrollToTop.label")}
      className={cn(
        "fixed bottom-20 right-6 z-50 flex items-center justify-center",
        "h-10 w-10 rounded-full bg-emerald-600 text-white border border-emerald-500/50",
        "hover:bg-emerald-700 active:scale-95",
        "transition-all duration-300 ease-in-out",
        visible && !isMobileMenuOpen
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none",
        isMobileMenuOpen && "md:opacity-100 md:translate-y-0 md:pointer-events-auto"
      )}
    >
      <IconChevronUp className="h-5 w-5" />
    </button>
  );
};
