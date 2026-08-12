export const AUTH_PARTNER_BRANDS = [
  "Document Control",
  "Training Management",
  "Deviations & NCs",
  "Reports & Analytics",
  "Audit Trail",
  "... and more",
] as const;

export const AUTH_UI = {
  pageWrapper:
    "relative isolate flex min-h-screen min-h-dvh w-full items-center justify-center overflow-hidden bg-[#fefcff] px-3 py-3 sm:px-6 sm:py-8 lg:px-8",

  // Option 1: Dreamy Sky Pink (active)
  pageBgBase:
    "pointer-events-none absolute inset-0 -z-10",
  pageBgGlow:
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
    "text-xs leading-5 text-slate-500 sm:text-sm sm:leading-7",
  formStack: "space-y-4 sm:space-y-6",
  fieldBlock: "space-y-1.5 sm:space-y-2.5",
  inputBase:
    "h-11 w-full rounded-xl border bg-white/92 px-3.5 text-sm text-slate-700 transition-all sm:h-12 sm:px-4",
  inputFocus:
    "placeholder:text-slate-400 focus:outline-none focus:ring-1",
  inputDefault:
    "border-slate-300/90 hover:border-slate-400 focus:border-emerald-700 focus:ring-emerald-700",
  inputError: "border-red-300 focus:border-red-500 focus:ring-red-500",
  submitButton:
    "mt-2 h-11 w-full rounded-xl bg-emerald-900 text-sm font-medium text-white transition-colors hover:bg-emerald-950 sm:h-12 sm:text-base",
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
    "group inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 focus-visible:text-slate-700",
} as const;
