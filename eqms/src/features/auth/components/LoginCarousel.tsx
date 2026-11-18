import React from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { LOGIN_CAROUSEL_LIMITS, type LoginCarouselConfig } from "@/services/api/branding";

const FADE_SECONDS = 1.1;
const SWIPE_DISTANCE = 60;
const EASE = [0.22, 1, 0.36, 1] as const;

const clampSeconds = (value?: number) => Math.min(LOGIN_CAROUSEL_LIMITS.maxSeconds, Math.max(LOGIN_CAROUSEL_LIMITS.minSeconds, value ?? LOGIN_CAROUSEL_LIMITS.defaultSeconds));
const two = (n: number) => String(n).padStart(2, "0");

const glassButton =
  "flex size-10 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

/**
 * The right-hand panel of the Split sign-in screen when the administrator has configured slides: the pictures cross-fade while slowly settling, the
 * title and subtitle rise in after them, and a bar under the slide fills for as long as the slide stays. It rests while the pointer or the keyboard is
 * on it and while the tab is hidden, it can be paused, swiped, or driven with the arrow keys, and with "reduce motion" it only cross-fades.
 */
export const LoginCarousel: React.FC<{ carousel: LoginCarouselConfig }> = ({ carousel }) => {
  const reduced = useReducedMotion();
  const slides = carousel.slides;
  const count = slides.length;
  const seconds = clampSeconds(carousel.intervalSeconds);

  const [index, setIndex] = React.useState(0);
  const [direction, setDirection] = React.useState<1 | -1>(1);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [hidden, setHidden] = React.useState(() => typeof document !== "undefined" && document.hidden);
  const [userPaused, setUserPaused] = React.useState(false);

  // the list can get shorter while the screen is open (the branding is refreshed), so the position never points past the end
  const current = Math.min(index, count - 1);

  React.useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // the next picture is fetched before it is needed, so the cross-fade never shows an empty frame
  React.useEffect(() => {
    if (count < 2) return;
    const next = new Image();
    next.src = slides[(current + 1) % count].image;
  }, [current, count, slides]);

  const go = React.useCallback((target: number, dir?: 1 | -1) => {
    setDirection(dir ?? (target >= current ? 1 : -1));
    setIndex(((target % count) + count) % count);
  }, [count, current]);
  const next = React.useCallback(() => go(current + 1, 1), [go, current]);
  const previous = React.useCallback(() => go(current - 1, -1), [go, current]);

  const resting = hovered || focused || hidden || userPaused;
  const slide = slides[current];

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") { event.preventDefault(); next(); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x <= -SWIPE_DISTANCE) next();
    else if (info.offset.x >= SWIPE_DISTANCE) previous();
  };

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-slate-900"
      role="region"
      aria-roledescription="carousel"
      aria-label="Product highlights"
      tabIndex={0}
      data-login-carousel
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(event) => { try { if ((event.target as HTMLElement).matches(":focus-visible")) setFocused(true); } catch { setFocused(true); } }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
      onKeyDown={onKeyDown}
    >
      <style>{"@keyframes eqms-login-carousel-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}"}</style>

      <AnimatePresence initial={false}>
        <motion.img
          key={current}
          src={slide.image}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full select-none object-cover"
          initial={{ opacity: 0, scale: reduced ? 1 : 1.12 }}
          animate={{ opacity: 1, scale: 1, transition: { opacity: { duration: reduced ? 0.3 : FADE_SECONDS, ease: "easeOut" }, scale: { duration: seconds + FADE_SECONDS + 1, ease: "linear" } } }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0.3 : FADE_SECONDS, ease: "easeInOut" } }}
        />
      </AnimatePresence>

      {/* the veil keeps white text readable on any picture */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/25 to-transparent" />

      {/* a transparent layer takes the swipe, so the picture itself is never dragged */}
      {count > 1 ? (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          dragSnapToOrigin
          onDragEnd={onDragEnd}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-[32px] pb-[32px] xl:px-[44px] xl:pb-[40px] min-[1440px]:px-[56px]">
        <div className="min-h-[132px] xl:min-h-[148px]" aria-live={resting && count > 1 ? "polite" : "off"} aria-atomic="true">
          <AnimatePresence mode="wait" initial>
            <motion.div
              key={current}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28 * direction, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: reduced ? 0.2 : 0.7, ease: EASE, delay: reduced ? 0 : 0.15 } }}
              exit={reduced ? { opacity: 0, transition: { duration: 0.15 } } : { opacity: 0, y: -16 * direction, filter: "blur(4px)", transition: { duration: 0.3, ease: "easeIn" } }}
            >
              {slide.title ? <h2 className="max-w-[500px] text-[26px] font-semibold leading-[1.2] tracking-tight text-white xl:text-[32px] min-[1440px]:text-[36px]">{slide.title}</h2> : null}
              {slide.subtitle ? <p className="mt-3 max-w-[480px] text-[14px] leading-6 text-white/80 xl:text-[15px]">{slide.subtitle}</p> : null}
            </motion.div>
          </AnimatePresence>
        </div>

        {count > 1 ? (
          <motion.div
            className="pointer-events-auto mt-6 flex items-center gap-3"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2" role="group" aria-label="Choose a slide">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Slide ${i + 1} of ${count}`}
                  aria-current={i === current ? "true" : undefined}
                  className="group flex h-6 max-w-[64px] flex-1 items-center focus:outline-none"
                >
                  <span className="relative block h-[3px] w-full overflow-hidden rounded-full bg-white/30 transition-[height] group-hover:h-[5px] group-focus-visible:h-[5px] group-focus-visible:ring-2 group-focus-visible:ring-white/80 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-transparent">
                    <span
                      key={`${i}-${i === current ? "a" : "s"}`}
                      className="absolute inset-0 origin-left rounded-full bg-white"
                      style={
                        i === current
                          ? { animation: `eqms-login-carousel-fill ${seconds}s linear forwards`, animationPlayState: resting ? "paused" : "running" }
                          : { transform: i < current ? "scaleX(1)" : "scaleX(0)" }
                      }
                      onAnimationEnd={i === current ? next : undefined}
                    />
                  </span>
                </button>
              ))}
            </div>
            <span className="hidden text-[13px] tabular-nums text-white/75 xl:block" aria-hidden="true">{two(current + 1)} / {two(count)}</span>
            <button type="button" className={glassButton} onClick={() => setUserPaused((v) => !v)} aria-label={userPaused ? "Play slideshow" : "Pause slideshow"}>
              {userPaused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
            </button>
            <button type="button" className={glassButton} onClick={previous} aria-label="Previous slide"><ChevronLeft className="size-5" aria-hidden="true" /></button>
            <button type="button" className={glassButton} onClick={next} aria-label="Next slide"><ChevronRight className="size-5" aria-hidden="true" /></button>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};
