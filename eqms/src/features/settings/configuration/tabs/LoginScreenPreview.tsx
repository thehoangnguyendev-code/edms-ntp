import React from 'react';
import type { LoginCarouselConfig } from '@/services/api/branding';
import { SPLIT_UI, SplitPanel } from '@/features/auth/components/LoginSplitLayout';
import { tr } from "@/i18n";

const SCREEN_WIDTH = 1280;
const SCREEN_HEIGHT = 800;

/**
 * The Split sign-in screen as it would look with the slides on the screen now (saved or not), drawn at the size of a 1280 x 800 window and scaled to fit
 * the width it is given. The right-hand panel is the real one, so the pictures, the texts and the speed move exactly as they will for everyone. It cannot be
 * clicked or reached with the keyboard: it is a picture of the screen, not the screen.
 */
export const LoginScreenPreview: React.FC<{ carousel?: LoginCarouselConfig | null; logo?: string }> = ({ carousel, logo }) => {
  const frame = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.4);

  React.useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return undefined;
    const measure = () => setScale(Math.max(0.2, element.clientWidth / SCREEN_WIDTH));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // `inert` takes the picture out of the tab order and out of reach of the pointer and of screen readers
  React.useEffect(() => {
    if (inner.current) (inner.current as HTMLElement & { inert: boolean }).inert = true;
  }, []);

  return (
    <div
      ref={frame}
      data-login-screen-preview
      role="img"
      aria-label={tr("Preview of the sign-in screen with the slides as they are now")}
      className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-[#eceef2] shadow-sm"
      style={{ height: SCREEN_HEIGHT * scale }}
    >
      <div ref={inner} aria-hidden="true" className="origin-top-left select-none" style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, transform: `scale(${scale})` }}>
        <div className="flex h-full w-full items-center justify-center p-[60px]">
          <div className="h-full w-full max-w-[1354px] overflow-hidden rounded-[28px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.04),0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="grid h-full grid-cols-2">
              <div className="relative flex flex-col px-[45px] py-[45px]">
                {logo ? <img src={logo} alt="" className="h-10 w-auto self-start object-contain" /> : <div className="h-10 w-28 rounded-md bg-slate-100" />}
                <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center">
                  <p className={SPLIT_UI.title}>{tr("Welcome Back")}</p>
                  <p className={SPLIT_UI.subtitle}>{tr("Enter your credentials to access your account.")}</p>
                  <div className="mt-10 space-y-5">
                    <div><p className={SPLIT_UI.label}>{tr("Email or Username")}</p><div className="h-[46px] rounded-[10px] border border-[#e4e4e7]" /></div>
                    <div><p className={SPLIT_UI.label}>{tr("Password")}</p><div className="h-[46px] rounded-[10px] border border-[#e4e4e7]" /></div>
                  </div>
                  <div className="mt-7 h-[46px] rounded-[10px] bg-emerald-900" />
                </div>
              </div>
              <div className="relative py-[22px] pr-[22px]">
                <SplitPanel carousel={carousel} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
