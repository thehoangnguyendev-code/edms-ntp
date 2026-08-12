export const CONTROL_STATE_CLASSES = {
  readonly: 'bg-slate-100 border-slate-200 text-slate-600 cursor-default',
  disabled: 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed',
  readonlyInteractive: 'bg-slate-100 border-slate-200 text-slate-600',
  disabledInteractive: 'bg-slate-100 border-slate-200 text-slate-600',
  readonlyField:
    'w-full h-9 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default',
  readonlyFieldCompact:
    'w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-600 cursor-default focus:outline-none',
  readonlyContainer:
    'flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm h-9 text-slate-600 cursor-default',
  readonlyTextarea:
    'w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default',
  disabledTextarea: 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed resize-none',
  readonlyLabel: 'text-slate-600',
  readonlyPlaceholder: 'placeholder:text-slate-400',
  readonlyChip: 'bg-slate-100 text-slate-600 border border-slate-200',
  disabledChip: 'bg-slate-100 text-slate-500 border border-slate-200',
  readonlyChipMuted: 'bg-slate-100 text-slate-500 border border-slate-200',
} as const;
