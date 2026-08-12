import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/components/ui/utils';

interface FilterOptionButtonProps {
  label: string;
  sublabel?: string;
  isSelected: boolean;
  onClick: () => void;
}

export const FilterOptionButton: React.FC<FilterOptionButtonProps> = ({
  label,
  sublabel,
  isSelected,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors',
      isSelected
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    )}
  >
    <span className="flex flex-col min-w-0">
      <span className="truncate">{label}</span>
      {sublabel && <span className="text-[10px] font-normal text-slate-400 mt-0.5 truncate">{sublabel}</span>}
    </span>
    {isSelected && <Check className="h-4 w-4 text-emerald-500 shrink-0 ml-2" />}
  </button>
);
