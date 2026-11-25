import { useId } from 'react';
import { Select } from '@/components/ui/select/Select';
import { ColorPickerInput } from '@/components/ui/color-picker/ColorPickerInput';
import { LoadingVisual } from '@/components/ui/loading/LoadingIndicator';
import { LOADING_STYLES, LOADING_STYLE_LABELS, loadingColor, loadingStyle, type LoadingStyle } from '@/config/loading';
import { tr } from '@/i18n';

interface Props {
  variant?: LoadingStyle;
  color?: string;
  onStyleChange: (value: LoadingStyle) => void;
  onColorChange: (value: string) => void;
}

export function LoadingSettings({ variant, color, onStyleChange, onColorChange }: Props) {
  const titleId = useId();
  const selected = loadingStyle(variant);
  const selectedColor = loadingColor(color);
  return (
    <section aria-labelledby={titleId} className="border-t border-slate-200 pt-6">
      <h3 id={titleId} className="mb-3 text-sm font-semibold text-slate-900">{tr('Loading Animation')}</h3>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <Select
            label={tr('Loading Style')}
            value={selected}
            options={LOADING_STYLES.map((value) => ({ value, label: tr(LOADING_STYLE_LABELS[value]) }))}
            onChange={(value) => onStyleChange(loadingStyle(value))}
          />
          <ColorPickerInput label={tr('Loading Color')} value={selectedColor} onChange={onColorChange} />
          <p className="text-xs text-slate-500">{tr('Applies to every user after Save Changes. Preview changes are not saved yet.')}</p>
        </div>
        <div className="flex min-h-48 min-w-0 flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white p-4" role="img" aria-label={tr('Loading Preview')}>
          <LoadingVisual key={selected} variant={selected} color={selectedColor} size={56} />
          <span className="text-xs font-medium text-slate-500">{tr(LOADING_STYLE_LABELS[selected])}</span>
        </div>
      </div>
    </section>
  );
}
