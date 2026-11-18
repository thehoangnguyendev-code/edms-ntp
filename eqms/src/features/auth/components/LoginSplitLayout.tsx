import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useBranding } from "@/components/branding/BrandLogo";
import { LoginCarousel } from "./LoginCarousel";
import type { LoginCarouselConfig } from "@/services/api/branding";

/**
 * The "Split" sign-in screen: a rounded card on a light page, the form on the left and a blue product
 * panel with a dashboard preview on the right (hidden below lg). The Classic screen is AuthLayout.
 * The blue is the colour of this design, not the green of the app, so it is kept here as literals.
 */
export const SPLIT_UI = {
  page: "relative isolate flex min-h-dvh w-full items-center justify-center bg-[#eceef2] p-0 sm:p-6 lg:p-[60px]",
  card: "relative w-full max-w-[1354px] overflow-hidden bg-white sm:rounded-[28px] sm:shadow-[0_0_0_1px_rgba(15,23,42,0.04),0_18px_50px_rgba(15,23,42,0.08)]",
  grid: "grid min-h-dvh w-full grid-cols-1 sm:min-h-[640px] lg:min-h-[max(800px,calc(100dvh-120px))] lg:grid-cols-2",
  left: "flex min-w-0 flex-col px-6 py-8 sm:px-10 sm:py-10 lg:px-[45px] lg:py-[45px]",
  title: "text-center text-[32px] font-semibold leading-tight tracking-tight text-[#111111] sm:text-[40px]",
  subtitle: "mt-3 text-center text-[15px] leading-6 text-[#6b7280]",
  label: "mb-2 block text-[13px] font-medium text-[#111111]",
  input:
    "h-[46px] w-full rounded-[10px] border border-[#e4e4e7] bg-white px-3.5 text-[15px] text-[#111111] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors placeholder:text-[#9ca3af] hover:border-[#c7c7d1] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 disabled:opacity-60",
  inputError: "border-red-300 hover:border-red-300 focus:border-red-500 focus:ring-red-500/20",
  link: "text-[14px] font-medium text-emerald-800 transition-colors hover:text-emerald-950 focus:outline-none focus-visible:underline",
  button:
    "mt-7 h-[46px] w-full rounded-[10px] bg-emerald-900 text-[15px] font-medium text-white transition-colors hover:bg-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 focus-visible:ring-offset-2 disabled:opacity-60",
  footer: "mt-8 flex items-center justify-between gap-4 text-[13px] text-[#8a8f98] sm:text-[15px]",
  eye: "absolute inset-y-0 right-1.5 my-auto flex size-10 items-center justify-center rounded-lg text-[#9ca3af] transition-colors hover:text-[#6b7280] focus:outline-none focus:text-[#374151]",
} as const;

export const SplitField: React.FC<{ htmlFor: string; label: string; error?: string; children: React.ReactNode }> = ({ htmlFor, label, error, children }) => (
  <div>
    <label htmlFor={htmlFor} className={SPLIT_UI.label}>{label}</label>
    {children}
    {error && <p id={`${htmlFor}-error`} className="mt-1.5 text-xs text-red-600" role="alert">{error}</p>}
  </div>
);

/** A small white card of the preview. */
const Tile: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = "", children }) => (
  <div className={`rounded-[7px] bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${className}`}>{children}</div>
);

const ROWS: Array<[string, string, string, "Effective" | "In review" | "Draft"]> = [
  ["#SOP-0412", "Cleaning of tablet press", "13 Nov 2026", "Effective"],
  ["#SOP-0398", "Gowning procedure, Grade C", "12 Nov 2026", "In review"],
  ["#WI-0127", "Balance daily check", "12 Nov 2026", "Effective"],
  ["#SOP-0377", "Deviation handling", "10 Nov 2026", "Draft"],
  ["#POL-0016", "Data integrity policy", "09 Nov 2026", "Effective"],
  ["#SOP-0361", "Change control", "08 Nov 2026", "In review"],
  ["#WI-0119", "Sampling of raw materials", "07 Nov 2026", "Effective"],
  ["#SOP-0344", "Equipment calibration", "06 Nov 2026", "Effective"],
  ["#FRM-0208", "Training attendance sheet", "05 Nov 2026", "Draft"],
  ["#SOP-0329", "Out-of-specification results", "04 Nov 2026", "Effective"],
  ["#WI-0104", "Line clearance", "03 Nov 2026", "In review"],
  ["#SOP-0312", "Complaint handling", "02 Nov 2026", "Effective"],
];
const BADGE = { Effective: "bg-[#e8f7ee] text-[#16a34a]", "In review": "bg-[#fff6dd] text-[#d9a400]", Draft: "bg-[#fdeaea] text-[#e5484d]" } as const;

/** A picture of the product, not live data: every number is an example. */
const DashboardPreview: React.FC = () => (
  <div aria-hidden="true" className="relative h-[381px] w-[451px] select-none">
    <div className="absolute inset-0 overflow-hidden rounded-[10px] bg-[#f3f4f8] p-[10px] shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
      <div className="grid grid-cols-[84px_1fr_1fr] gap-[8px]">
        <div className="rounded-[7px] bg-[#6a56f6] p-2 text-white">
          <p className="text-[6px] opacity-80">Effective documents</p>
          <p className="mt-2 text-[15px] font-semibold leading-none">1,284</p>
          <p className="mt-2 inline-block rounded bg-white/20 px-1 text-[5px]">↑ 7% from last month</p>
        </div>
        <Tile>
          <p className="text-[6px] font-medium text-slate-700">Training compliance</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-900">94%</p>
          <svg viewBox="0 0 100 34" className="mt-1 h-[26px] w-full"><defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6a56f6" stopOpacity=".25" /><stop offset="1" stopColor="#6a56f6" stopOpacity="0" /></linearGradient></defs><path d="M0 26 C14 28 18 8 32 14 S52 30 64 16 S86 4 100 8 V34 H0Z" fill="url(#lg)" /><path d="M0 26 C14 28 18 8 32 14 S52 30 64 16 S86 4 100 8" fill="none" stroke="#6a56f6" strokeWidth="1.6" /></svg>
        </Tile>
        <Tile>
          <p className="text-[6px] font-medium text-slate-700">Open reviews</p>
          <div className="mt-1 flex items-end gap-[3px]">
            {[18, 26, 14, 30, 22, 34, 20].map((h, i) => <span key={i} className="w-[7px] rounded-full bg-[#d9d6fc]" style={{ height: h }} />)}
          </div>
        </Tile>
      </div>
      <div className="mt-[8px] grid grid-cols-[84px_1fr] gap-[8px]">
        <Tile>
          <p className="text-[6px] text-slate-500">Pending approvals</p>
          <p className="mt-1 text-[13px] font-semibold text-slate-900">38</p>
          <p className="mt-1 text-[5px] text-[#16a34a]">↑ 5% from last month</p>
        </Tile>
        <Tile className="py-2">
          <p className="mb-1 text-[7px] font-semibold text-slate-800">Recent documents</p>
          <div className="grid grid-cols-[52px_1fr_46px_40px] gap-x-2 border-b border-slate-100 pb-1 text-[5px] text-slate-400"><span>Number</span><span>Title</span><span>Date</span><span>Status</span></div>
          {ROWS.map(([id, title, date, status]) => (
            <div key={id} className="grid grid-cols-[52px_1fr_46px_40px] items-center gap-x-2 border-b border-slate-50 py-[3px] text-[5px] text-slate-600">
              <span>{id}</span><span className="truncate">{title}</span><span>{date}</span>
              <span className={`w-fit rounded px-1 py-px ${BADGE[status]}`}>{status}</span>
            </div>
          ))}
        </Tile>
      </div>
    </div>
    <div className="absolute -right-[52px] top-[58px] w-[188px] rounded-[10px] bg-white p-3 shadow-[0_10px_32px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between">
        <div><p className="text-[7px] font-semibold text-slate-800">Document status</p><p className="text-[5px] text-slate-400">Share of documents by state</p></div>
        <span className="rounded border border-slate-200 px-1.5 py-px text-[5px] text-slate-500">Monthly</span>
      </div>
      <svg viewBox="0 0 120 70" className="mx-auto mt-2 h-[70px] w-[120px]">
        <path d="M10 62 A50 50 0 0 1 42 16" fill="none" stroke="#4340f5" strokeWidth="13" strokeLinecap="round" />
        <path d="M52 12 A50 50 0 0 1 90 18" fill="none" stroke="#7c4dff" strokeWidth="13" strokeLinecap="round" />
        <path d="M98 26 A50 50 0 0 1 110 62" fill="none" stroke="#a78bfa" strokeWidth="13" strokeLinecap="round" />
        <text x="60" y="48" textAnchor="middle" fontSize="5" fill="#9ca3af">Total documents</text>
        <text x="60" y="60" textAnchor="middle" fontSize="9" fontWeight="600" fill="#111827">1,284</text>
      </svg>
      {[["#4340f5", "Effective", "1,031"], ["#7c4dff", "In review", "162"], ["#a78bfa", "Draft", "91"]].map(([color, name, n]) => (
        <div key={name} className="mt-1 flex items-center justify-between text-[5px] text-slate-600"><span className="flex items-center gap-1"><i className="inline-block size-[5px] rounded-full" style={{ background: color }} />{name}</span><span>{n}</span></div>
      ))}
    </div>
  </div>
);

export const SPLIT_HEADLINE = "Keep your quality processes under control.";
export const SPLIT_TAGLINE = "Sign in to access your eQMS and manage your quality.";

/**
 * The blue panel at the right of the Split screen: the slides the administrator configured, or, when there are none, the headline and a picture of the product.
 * The screen and the preview in Configuration draw the same panel, so what the administrator sees there is what the sign-in screen shows.
 */
export const SplitPanel: React.FC<{ carousel?: LoginCarouselConfig | null; headline?: string; tagline?: string }> = ({ carousel, headline = SPLIT_HEADLINE, tagline = SPLIT_TAGLINE }) => {
  const slides = carousel?.slides?.filter((slide) => slide.image) ?? [];
  return (
        <div className="relative h-full overflow-hidden rounded-[28px] bg-[#4340f5]">
          {slides.length > 0 && carousel ? (
            <LoginCarousel carousel={{ ...carousel, slides }} />
          ) : (
          <>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -top-10 left-[12%] h-[420px] w-[120px] rotate-12 rounded-[40px] bg-white/[0.04]" />
              <div className="absolute right-[6%] top-[8%] h-[380px] w-[200px] rounded-[48px] bg-black/[0.06]" />
              <div className="absolute -bottom-24 -left-16 h-[300px] w-[300px] rounded-full bg-black/[0.07]" />
              <div className="absolute bottom-[4%] right-[8%] h-[200px] w-[260px] rounded-[40px] border border-dashed border-white/15" />
            </div>
            {/* The preview keeps its size from 1440px; on narrower windows it shrinks (zoom) so the floating card is not cut by the panel. */}
            <div className="relative z-10 px-[40px] pt-[150px] xl:px-[48px] min-[1440px]:px-[75px] min-[1440px]:pt-[170px]">
              <h2 className="max-w-[470px] text-[28px] font-medium leading-[1.3] text-white xl:text-[32px] min-[1440px]:text-[36px]">{headline}</h2>
              <p className="mt-5 max-w-[470px] text-[15px] leading-6 text-white/85">{tagline}</p>
              <div className="mt-10 [zoom:.62] xl:[zoom:.8] min-[1440px]:[zoom:1]"><DashboardPreview /></div>
            </div>
          </>
          )}
        </div>
  );
};

interface LoginSplitLayoutProps {
  /** The logo at the top-left. Screens built on AuthLayout draw their own logo block (class auth-brand), which is lifted to the same corner. */
  logo?: React.ReactNode;
  children: React.ReactNode;
  footerLeft: string;
  footerRight?: string;
  headline?: string;
  tagline?: string;
}

export const LoginSplitLayout: React.FC<LoginSplitLayoutProps> = ({ logo, children, footerLeft, footerRight, headline = SPLIT_HEADLINE, tagline = SPLIT_TAGLINE }) => {
  const reduced = useReducedMotion();
  const carousel = useBranding().loginCarousel;
  return (
    <div className={SPLIT_UI.page} role="main" data-auth-layout data-login-layout="SPLIT">
      <motion.div
        data-auth-card
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
        className={SPLIT_UI.card}
      >
        <div className={SPLIT_UI.grid}>
          <div className={`${SPLIT_UI.left} relative [&_.auth-brand]:absolute [&_.auth-brand]:left-6 [&_.auth-brand]:top-8 [&_.auth-brand]:!m-0 sm:[&_.auth-brand]:left-10 sm:[&_.auth-brand]:top-10 lg:[&_.auth-brand]:left-[45px] lg:[&_.auth-brand]:top-[45px]`}>
            {logo ? <div className="flex items-center gap-3 text-slate-900">{logo}</div> : null}
            <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-16">{children}</div>
            <div className={SPLIT_UI.footer}>
              <span>{footerLeft}</span>
              {footerRight ? <span className="text-right">{footerRight}</span> : null}
            </div>
          </div>

          <div className="relative hidden overflow-hidden lg:block lg:py-[22px] lg:pr-[22px]">
            <SplitPanel carousel={carousel} headline={headline} tagline={tagline} />
          </div>
        </div>
      </motion.div>
    </div>
  );
};
