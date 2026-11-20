import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/utils";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";
import { useCountBump } from "@/hooks/useCountBump";

export interface TabItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ElementType;
  count?: number;
  /** A small dot after the label: something on this tab needs attention (for example a change that is not saved yet). */
  dot?: boolean;
  dotLabel?: string;
  /** "danger" draws the dot red (something blocks saving); the default is amber. */
  dotTone?: "warning" | "danger";
}

type TabNavVariant = "underline" | "pill" | "simple-underline" | "vertical";
type HorizontalVariant = Exclude<TabNavVariant, "vertical">;

interface TabNavProps {
  tabs: readonly TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: TabNavVariant;
  layoutId?: string;
  className?: string;
  ariaLabel?: string;
  tabIdPrefix?: string;
  panelIdPrefix?: string;
  /** Horizontal variants only: stretch tabs evenly across the full width instead of hugging content. */
  fullWidth?: boolean;
  /** Vertical variants: use a compact single-line layout without descriptions. */
  compactVertical?: boolean;
}

interface IndicatorStyle {
  left: number;
  width: number;
}

interface HorizontalVariantConfig {
  rootClassName: string;
  tabListClassName: string;
  buttonClassName: string;
  activeButtonClassName: string;
  inactiveButtonClassName: string;
  indicatorClassName: string;
  iconClassName: string;
  labelClassName?: string;
  badgeClassName: string;
  activeBadgeClassName: string;
  inactiveBadgeClassName: string;
  contentWrapperClassName?: string;
}

const HORIZONTAL_VARIANTS: Record<HorizontalVariant, HorizontalVariantConfig> = {
  underline: {
    rootClassName: "border-b border-slate-200",
    tabListClassName: "relative flex overflow-x-auto",
    buttonClassName:
      "flex items-center gap-2 px-3 sm:px-4 md:px-6 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap border-r border-slate-200 last:border-r-0 transition-colors relative z-10",
    activeButtonClassName: "text-emerald-700 bg-transparent",
    inactiveButtonClassName: "text-slate-600 hover:text-emerald-600 hover:bg-slate-50",
    indicatorClassName: "absolute bottom-0 h-0.5 rounded-full bg-emerald-600 z-0 pointer-events-none",
    iconClassName: "h-4 w-4 shrink-0",
    badgeClassName:
      "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-2xs font-bold rounded-full",
    activeBadgeClassName: "bg-emerald-100 text-emerald-700",
    inactiveBadgeClassName: "bg-slate-100 text-slate-500",
  },
  "simple-underline": {
    rootClassName: "border-b border-slate-200",
    tabListClassName: "relative flex overflow-x-auto",
    buttonClassName:
      "flex items-center gap-2 px-3 sm:px-4 md:px-6 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap border-r border-slate-200 last:border-r-0 transition-colors relative z-10",
    activeButtonClassName: "text-emerald-700 bg-transparent",
    inactiveButtonClassName: "text-slate-600 hover:text-emerald-600 hover:bg-slate-50",
    indicatorClassName: "absolute bottom-0 h-0.5 rounded-full bg-emerald-600 z-0 pointer-events-none",
    iconClassName: "h-4 w-4 shrink-0",
    badgeClassName:
      "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-2xs font-bold rounded-full",
    activeBadgeClassName: "bg-emerald-100 text-emerald-700",
    inactiveBadgeClassName: "bg-slate-100 text-slate-500",
  },
  pill: {
    rootClassName: "flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg w-full relative",
    tabListClassName: "relative flex flex-wrap w-full gap-1",
    buttonClassName:
      "flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 relative whitespace-nowrap text-[clamp(0.65rem,1.8vw,0.875rem)] font-medium rounded-lg transition-colors duration-200 flex-1 z-10",
    activeButtonClassName: "text-emerald-700",
    inactiveButtonClassName: "text-slate-500 hover:text-slate-900",
    indicatorClassName: "absolute top-0 bottom-0 bg-white rounded-lg shadow-sm z-0 pointer-events-none",
    iconClassName: "h-4 w-4 shrink-0",
    labelClassName: "text-sm truncate",
    badgeClassName:
      "inline-flex items-center justify-center min-w-[16px] sm:min-w-[18px] h-4 sm:h-[18px] px-1 sm:px-1.5 text-2xs font-bold rounded-full",
    activeBadgeClassName: "bg-emerald-100 text-emerald-700",
    inactiveBadgeClassName: "bg-slate-200 text-slate-500",
    contentWrapperClassName: "relative z-10 flex items-center gap-1 sm:gap-1.5",
  },
};

function useHorizontalIndicator(activeTab: string, enabled: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const hasMeasuredRef = useRef(false);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<IndicatorStyle | null>(null);
  const [animateIndicator, setAnimateIndicator] = useState(false);

  const setButtonRef = useCallback((tabId: string, element: HTMLButtonElement | null) => {
    if (element) {
      buttonRefs.current.set(tabId, element);
      return;
    }

    buttonRefs.current.delete(tabId);
  }, []);

  useLayoutEffect(() => {
    if (!enabled) {
      hasMeasuredRef.current = false;
      setIndicatorStyle(null);
      setAnimateIndicator(false);
      return;
    }

    const container = containerRef.current;
    const activeButton = buttonRefs.current.get(activeTab);

    if (!container || !activeButton) {
      hasMeasuredRef.current = false;
      setIndicatorStyle(null);
      setAnimateIndicator(false);
      return;
    }

    const measure = () => {
      const nextStyle = {
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
      };

      setIndicatorStyle((currentStyle) => {
        if (
          currentStyle &&
          currentStyle.left === nextStyle.left &&
          currentStyle.width === nextStyle.width
        ) {
          return currentStyle;
        }

        return nextStyle;
      });

      if (hasMeasuredRef.current) {
        setAnimateIndicator(true);
      } else {
        hasMeasuredRef.current = true;
        setAnimateIndicator(false);
      }
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    resizeObserver.observe(activeButton);

    return () => resizeObserver.disconnect();
  }, [activeTab, enabled]);

  // The indicator's position is written here and not through the style prop: GSAP stretches it from where it is to the measured target.
  // The edge that leads the move arrives first and the other edge catches up, so the bar stretches and then shrinks. The first measure and
  // "reduce motion" place it at once. The tween always ends on the exact measured numbers.
  useGSAP(() => {
    const element = indicatorRef.current;
    if (!element || !indicatorStyle) return;
    const targetLeft = indicatorStyle.left;
    const targetRight = indicatorStyle.left + indicatorStyle.width;
    gsap.killTweensOf(element);
    if (!animateIndicator || prefersReducedMotion()) {
      gsap.set(element, { left: targetLeft, width: indicatorStyle.width });
      return;
    }
    const edges = { left: element.offsetLeft, right: element.offsetLeft + element.offsetWidth };
    const apply = () => { element.style.left = `${edges.left}px`; element.style.width = `${Math.max(edges.right - edges.left, 0)}px`; };
    const movingRight = targetLeft >= edges.left;
    const lead = { duration: 0.22, ease: "power3.out", onUpdate: apply };
    const trail = { duration: 0.34, delay: 0.03, ease: "power3.out", onUpdate: apply };
    gsap.to(edges, { right: targetRight, ...(movingRight ? lead : trail) });
    gsap.to(edges, { left: targetLeft, ...(movingRight ? trail : lead), onComplete: () => gsap.set(element, { left: targetLeft, width: indicatorStyle.width }) });
  }, { dependencies: [indicatorStyle, animateIndicator] });

  return {
    containerRef,
    indicatorRef,
    indicatorStyle,
    setButtonRef,
  };
}

/** The number on a tab: it pops once when the count goes up. */
function TabCount({ value, className }: { value: number; className: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useCountBump(ref, value);
  return <span ref={ref} data-tab-count className={className}>{value}</span>;
}

function renderBadge(tab: TabItem, isActive: boolean, config: HorizontalVariantConfig) {
  if (tab.dot && tab.count === undefined) {
    return (
      <span role="img" aria-label={tab.dotLabel ?? "Needs attention"} title={tab.dotLabel} className={cn("h-2 w-2 shrink-0 rounded-full", tab.dotTone === "danger" ? "bg-red-500" : "bg-amber-500")} />
    );
  }
  if (tab.count === undefined) {
    return null;
  }

  return (
    <TabCount
      value={tab.count}
      className={cn(
        config.badgeClassName,
        isActive ? config.activeBadgeClassName : config.inactiveBadgeClassName
      )}
    />
  );
}

function HorizontalTabs({
  tabs,
  activeTab,
  onChange,
  className,
  ariaLabel,
  tabIdPrefix,
  panelIdPrefix,
  variant,
  fullWidth,
}: Omit<TabNavProps, "variant" | "layoutId"> & { variant: HorizontalVariant }) {
  const config = HORIZONTAL_VARIANTS[variant];
  const safeTabs = tabs.filter(Boolean) as TabItem[];
  const { containerRef, indicatorRef, indicatorStyle, setButtonRef } = useHorizontalIndicator(
    activeTab,
    safeTabs.length > 0
  );

  // The tab that was just chosen lifts its icon and label a couple of pixels (the count keeps its own pop, the fallback underline stays put).
  const shownTab = useRef<string | null>(null);
  useGSAP(() => {
    const before = shownTab.current;
    shownTab.current = activeTab;
    if (before === null || before === activeTab || prefersReducedMotion()) return;
    const active = containerRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!active) return;
    const parts = Array.from(active.children).filter((child): child is HTMLElement => child instanceof HTMLElement && !child.hasAttribute("data-tab-count") && !child.classList.contains("absolute"));
    if (parts.length === 0) return;
    gsap.fromTo(parts, { y: 2, opacity: 0.55 }, { y: 0, opacity: 1, duration: 0.26, ease: "power2.out", clearProps: "opacity,transform" });
  }, { scope: containerRef, dependencies: [activeTab] });

  return (
    <div className={cn(config.rootClassName, className)}>
      <div
        ref={containerRef}
        className={cn(config.tabListClassName, fullWidth && "overflow-visible")}
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
      >
        {safeTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const tabId = tabIdPrefix ? `${tabIdPrefix}-${tab.id}` : undefined;
          const panelId = panelIdPrefix ? `${panelIdPrefix}-${tab.id}` : undefined;

          const content = config.contentWrapperClassName ? (
            <span className={config.contentWrapperClassName}>
              {Icon && <Icon className={config.iconClassName} />}
              <span className={cn("capitalize", config.labelClassName)}>{tab.label}</span>
              {renderBadge(tab, isActive, config)}
            </span>
          ) : (
            <>
              {Icon && <Icon className={config.iconClassName} />}
              <span className={cn("capitalize", config.labelClassName)}>{tab.label}</span>
              {renderBadge(tab, isActive, config)}
            </>
          );

          return (
            <button
              key={tab.id}
              ref={(element) => setButtonRef(tab.id, element)}
              type="button"
              onClick={() => onChange(tab.id)}
              role="tab"
              id={tabId}
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              className={cn(
                config.buttonClassName,
                fullWidth && "flex-1 justify-center",
                isActive ? config.activeButtonClassName : config.inactiveButtonClassName
              )}
            >
              {content}
              {isActive && !indicatorStyle && variant !== "pill" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-emerald-600" />
              )}
            </button>
          );
        })}

        {indicatorStyle && (
          <div
            aria-hidden="true"
            ref={indicatorRef}
            className={config.indicatorClassName}
          />
        )}
      </div>
    </div>
  );
}

function VerticalTabs({
  tabs,
  activeTab,
  onChange,
  className,
  ariaLabel,
  tabIdPrefix,
  panelIdPrefix,
  compactVertical,
}: Omit<TabNavProps, "variant" | "layoutId">) {
  const safeTabs = tabs.filter(Boolean) as TabItem[];
  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="vertical"
    >
      {safeTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const tabId = tabIdPrefix ? `${tabIdPrefix}-${tab.id}` : undefined;
        const panelId = panelIdPrefix ? `${panelIdPrefix}-${tab.id}` : undefined;

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            role="tab"
            id={tabId}
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            className={cn(
              "w-full text-left rounded-lg border transition-all duration-300 relative overflow-hidden",
              compactVertical ? "px-3 py-2" : "px-3 py-3",
              isActive
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm font-medium"
                : "border-transparent hover:border-slate-200 hover:bg-slate-50 text-slate-700"
            )}
          >
            <div className="flex items-center gap-3.5">
              {Icon && (
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive ? "text-emerald-600" : "text-slate-500"
                  )}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm font-semibold capitalize">{tab.label}</div>
                {!compactVertical && tab.description && (
                  <div className="text-xs mt-1 opacity-70 leading-relaxed font-normal">
                    {tab.description}
                  </div>
                )}
              </div>
              {tab.count !== undefined && (
                <TabCount
                  value={tab.count}
                  className={cn(
                    "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 ml-auto text-2xs font-bold rounded-full",
                    isActive
                      ? "bg-emerald-200/50 text-emerald-800"
                      : "bg-slate-200 text-slate-500"
                  )}
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export const TabNav: React.FC<TabNavProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = "underline",
  className,
  ariaLabel,
  tabIdPrefix,
  panelIdPrefix,
  fullWidth,
  compactVertical,
}) => {
  const safeTabs = tabs.filter(Boolean) as TabItem[];
  if (variant === "vertical") {
    return (
      <VerticalTabs
        tabs={safeTabs}
        activeTab={activeTab}
        onChange={onChange}
        className={className}
        ariaLabel={ariaLabel}
        tabIdPrefix={tabIdPrefix}
        panelIdPrefix={panelIdPrefix}
        compactVertical={compactVertical}
      />
    );
  }

  return (
    <HorizontalTabs
      tabs={safeTabs}
      activeTab={activeTab}
      onChange={onChange}
      className={className}
      ariaLabel={ariaLabel}
      tabIdPrefix={tabIdPrefix}
      panelIdPrefix={panelIdPrefix}
      variant={variant}
      fullWidth={fullWidth}
    />
  );
};
