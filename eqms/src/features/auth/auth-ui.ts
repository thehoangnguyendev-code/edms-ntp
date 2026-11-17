export const AUTH_PARTNER_BRANDS = [
  "Document Control",
  "Training Management",
  "Deviations & NCs",
  "Reports",
  "Audit Trail",
  "... and more",
] as const;

export const AUTH_UI = {
  pageWrapper:
    "relative isolate flex min-h-screen min-h-dvh w-full items-center justify-center overflow-hidden bg-gray-100/50 px-3 py-3 sm:px-6 sm:py-8 lg:px-8",

  pageBgBase:
    "pointer-events-none absolute inset-0 -z-10",
  pageBgTopo:
    "pointer-events-none absolute inset-0 -z-10",
  pageBgNoise:
    "pointer-events-none absolute inset-0 -z-10 hidden",

  // Option 2: Aurora Ribbon (active)
  // pageBgBase:
  //   "pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(160deg,#f8fcff_0%,#f2f9f8_46%,#eef6ff_100%)]",
  // pageBgAuroraA:
  //   "pointer-events-none absolute -left-[18%] top-[-24%] -z-10 h-[72vh] w-[72vh] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.26)_0%,rgba(20,184,166,0.08)_38%,transparent_70%)] blur-3xl",
  // pageBgAuroraB:
  //   "pointer-events-none absolute -right-[20%] top-[8%] -z-10 h-[68vh] w-[68vh] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.22)_0%,rgba(34,197,94,0.08)_42%,transparent_70%)] blur-3xl",
  // pageBgRibbon:
  //   "pointer-events-none absolute inset-x-[-12%] top-[42%] -z-10 h-[34vh] rotate-[-7deg] bg-[linear-gradient(90deg,rgba(20,184,166,0.20)_0%,rgba(6,182,212,0.12)_32%,rgba(16,185,129,0.10)_58%,rgba(59,130,246,0.14)_100%)] blur-2xl",

  // Option 3: Dot Matrix + Halo (commented for later use)
  // pageBgBase:
  //   "pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,#fbfdff_0%,#f3f7fc_100%)]",
  // pageBgHalo:
  //   "pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.16),transparent_38%),radial-gradient(circle_at_78%_74%,rgba(14,165,233,0.14),transparent_36%)]",
  // pageBgMatrix:
  //   "pointer-events-none absolute inset-0 -z-10 opacity-[0.18] bg-[radial-gradient(rgba(15,23,42,0.42)_0.65px,transparent_0.65px)] bg-[length:18px_18px] hidden lg:block",
  // pageBgNoise:
  //   "pointer-events-none absolute inset-0 -z-10 opacity-[0.07] mix-blend-multiply bg-[radial-gradient(rgba(15,23,42,0.75)_0.45px,transparent_0.45px)] bg-[length:3px_3px] hidden lg:block",
  // cardWrapper:
  //   "mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/80 bg-white/88 shadow-[0_10px_35px_rgba(15,23,42,0.08)] backdrop-blur-md",
  // Full-bleed on mobile — no card chrome, the form sits directly on the page gradient. The
  // card look (border/shadow/white bg) only kicks in from sm: up, where there's enough width
  // that a floating card reads as intentional rather than as a lot of dead space around it.
  cardWrapper:
    "mx-auto w-full max-w-[560px] overflow-hidden sm:rounded-2xl sm:border sm:border-slate-200/70 sm:bg-white sm:shadow-[0_12px_40px_rgba(15,23,42,0.09)]",
  gridWrapper:
    "grid min-h-screen min-h-dvh w-full grid-cols-1 lg:min-h-0 lg:grid-cols-2 lg:min-h-[640px] xl:min-h-[720px]",
  leftPanel:
    "flex flex-col items-center justify-center px-4 py-7 sm:px-8 sm:py-9",
  formColumn:
    "flex w-full max-w-full flex-1 flex-col justify-center sm:max-w-[460px]",
  headerArea: "mb-4 sm:mb-8",
  headingBlock: "space-y-1.5 sm:space-y-3",
  pageTitle:
    "text-2xl font-semibold sm:font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl lg:text-4xl",
  pageTitleStrong:
    "text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl lg:text-4xl",
  description:
    "text-sm leading-6 text-slate-500 sm:leading-7",
  formStack: "space-y-4 sm:space-y-6",
  fieldBlock: "space-y-1.5 sm:space-y-2.5",
  inputBase:
    "auth-input h-11 w-full rounded-xl border bg-white/92 px-3 text-base text-slate-700 transition-all sm:h-12 md:text-sm",
  inputFocus:
    "placeholder:text-slate-400 focus:outline-none focus:ring-1",
  inputDefault:
    "border-slate-300/90 hover:border-slate-400 focus:border-emerald-700 focus:ring-emerald-700",
  inputError: "border-red-300 focus:border-red-500 focus:ring-red-500",
  submitButton:
    "mt-2 h-11 w-full rounded-xl bg-emerald-900 text-sm font-medium text-white transition-colors hover:bg-emerald-950 disabled:opacity-60 sm:h-12 sm:text-base",
  rightPanel:
    "relative hidden overflow-hidden bg-emerald-900 px-8 py-10 text-white lg:flex lg:flex-col xl:px-12 xl:py-14",
  rightPanelGlow:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_6%,rgba(110,231,183,0.35),transparent_30%)]",
  rightPanelHero:
    "relative z-10 mt-10 max-w-[460px] space-y-6 xl:mt-24 xl:space-y-8",
  rightPanelFooter: "relative z-10 mt-auto pt-10 xl:pt-16",
  modulesHeader: "mb-7 flex items-center gap-5",
  modulesGrid:
    "grid grid-cols-2 gap-x-4 gap-y-4 text-xs font-medium text-emerald-100/90 lg:text-sm xl:grid-cols-3",
  backLink:
    "group inline-flex min-h-11 items-center text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 focus-visible:text-slate-700",
  // Touch target 40px (size-10); the icon stays 16/20px. Sits at the input's right edge.
  eyeButton:
    "flex size-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus:text-slate-700",
  eyeButtonAbsolute:
    "absolute inset-y-0 right-0 my-auto flex size-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-600 sm:right-1.5",
  // Password rules / helper text: 12px, slate-500 (4.8:1 on white) instead of 11px slate-400 (2.6:1).
  hintText: "text-xs text-slate-500",
  // The logo block of a screen: the Split layout lifts it to the top-left corner of the card.
  brand: "auth-brand mb-6 flex items-center gap-3 text-slate-900 sm:mb-10 lg:mb-12",
  // Text links and the interactive accent. Split swaps the green for the blue of its panel.
  accentLink: "text-emerald-700 hover:text-emerald-800",
  // A choice card (pick the verification method).
  choiceCard: "hover:border-emerald-700/40 hover:bg-emerald-50/30",
  // Focus ring of the one-digit code boxes.
  otpRing: "focus-visible:ring-emerald-600/60",
} as const;

/**
 * Class strings of the "Split" sign-in design (a card with a blue product panel), under the same keys as
 * AUTH_UI so a screen picks one set with useAuthUi() and uses it unchanged. The blue is the colour of that
 * design, not the green of the app, so it is kept here as literals.
 */
export const SPLIT_AUTH_UI: Record<keyof typeof AUTH_UI, string> = {
  ...AUTH_UI,
  formColumn: "flex w-full max-w-full flex-1 flex-col justify-center",
  headerArea: "mb-8 text-center",
  headingBlock: "space-y-3",
  pageTitle: "text-[32px] font-semibold leading-tight tracking-tight text-[#111111] sm:text-[40px]",
  pageTitleStrong: "text-[32px] font-semibold leading-tight tracking-tight text-[#111111] sm:text-[40px]",
  description: "text-[15px] leading-6 text-[#6b7280]",
  formStack: "space-y-5",
  inputBase:
    "auth-input h-[46px] w-full rounded-[10px] border bg-white px-3.5 text-base text-[#111111] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors md:text-[15px]",
  inputFocus: "placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#4340f5]/20",
  inputDefault: "border-[#e4e4e7] hover:border-[#c7c7d1] focus:border-[#4340f5]",
  inputError: "border-red-300 hover:border-red-300 focus:border-red-500 focus:ring-red-500/20",
  submitButton:
    "mt-2 h-[46px] w-full rounded-[10px] bg-[linear-gradient(180deg,#5250f7_0%,#3f3cf0_100%)] text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_1px_2px_rgba(67,64,245,0.35)] transition-[filter] hover:bg-[linear-gradient(180deg,#5250f7_0%,#3f3cf0_100%)] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4340f5]/40 focus-visible:ring-offset-2 disabled:opacity-60",
  accentLink: "text-[#2b2bd9] hover:text-[#1f1fb5]",
  choiceCard: "hover:border-[#4340f5]/40 hover:bg-[#4340f5]/5",
  otpRing: "focus-visible:ring-[#4340f5]/60",
};
