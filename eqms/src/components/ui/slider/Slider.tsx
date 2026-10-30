import { Slider as SliderPrimitive, SliderFill, SliderThumb, SliderTrack } from '@animate-ui/react/primitives/react-aria';
import { cn } from '../utils';

/** Accessible, animated single-value slider shared across settings screens. */
export function Slider({ value, onChange, min = 0, max = 100, label, className }: {
  value: number; onChange: (value: number) => void; min?: number; max?: number; label: string; className?: string;
}) {
  return (
    <SliderPrimitive aria-label={label} value={value} onChange={onChange} minValue={min >= max ? 0 : min} maxValue={min >= max ? 100 : max} isDisabled={min >= max} step={1}
      className={cn('group relative flex min-h-10 w-full touch-none select-none items-center', className)}>
      <SliderTrack className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
        <SliderFill className="absolute h-full bg-emerald-600" />
      </SliderTrack>
      <SliderThumb className="relative top-1/2 block h-4 w-4 shrink-0 rounded-full border-2 border-emerald-600 bg-white shadow-sm outline-none ring-emerald-500/30 after:absolute after:-inset-3 hover:ring-4 focus-visible:ring-4 group-data-disabled:opacity-50" />
    </SliderPrimitive>
  );
}
