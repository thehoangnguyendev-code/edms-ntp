import React, { useEffect, useState } from "react";
import { ImageOff, Check, Camera, CameraOff } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { IconFileBroken } from "@tabler/icons-react";
import { cn } from "@/components/ui/utils";
import { tr } from "@/i18n";

interface DestructionTypeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: ReportType) => void;
  allowedTypes?: Array<ReportType>;
}

type ReportType = "Lost" | "Damaged";

const TYPE_STYLES: Record<ReportType, { tile: string; selected: string; dot: string; icon: React.ReactNode }> = {
  Damaged: {
    tile: "bg-red-50 text-red-600",
    selected: "border-red-400 bg-red-50/40 ring-1 ring-red-400",
    dot: "border-red-500 bg-red-500",
    icon: <IconFileBroken className="h-5 w-5" />,
  },
  Lost: {
    tile: "bg-amber-50 text-amber-600",
    selected: "border-amber-400 bg-amber-50/40 ring-1 ring-amber-400",
    dot: "border-amber-500 bg-amber-500",
    icon: <ImageOff className="h-5 w-5" />,
  },
};

// Radio-style choice rows: one full-width row per report type (icon tile, title, description, and
// an evidence-photo hint as its own chip) so the rule that differs between the two types is
// readable at a glance instead of buried in the description sentence.
const ReportTypeOption: React.FC<{
  type: ReportType;
  description: string;
  evidenceRequired: boolean;
  selected: boolean;
  onSelect: () => void;
}> = ({ type, description, evidenceRequired, selected, onSelect }) => {
  const styles = TYPE_STYLES[type];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
        selected ? styles.selected : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", styles.tile)}>
        {styles.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{tr(type)}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
        <span
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium",
            evidenceRequired ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-500",
          )}
        >
          {evidenceRequired ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
          {evidenceRequired ? tr("Evidence photos required") : tr("No evidence photos")}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? styles.dot : "border-slate-300 bg-white",
        )}
      >
        {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
};

export const DestructionTypeSelectionModal: React.FC<
  DestructionTypeSelectionModalProps
> = ({ isOpen, onClose, onConfirm, allowedTypes = ["Damaged", "Lost"] }) => {
  const [selectedType, setSelectedType] = useState<ReportType>("Damaged");
  const visibleOptions = [
    allowedTypes.includes("Damaged")
      ? {
          type: "Damaged" as const,
          description: tr("The controlled copy is damaged and needs to be destroyed."),
          evidenceRequired: true,
        }
      : null,
    allowedTypes.includes("Lost")
      ? {
          type: "Lost" as const,
          description: tr("The controlled copy cannot be located and is considered lost."),
          evidenceRequired: false,
        }
      : null,
  ].filter(Boolean) as Array<{ type: ReportType; description: string; evidenceRequired: boolean }>;

  useEffect(() => {
    if (isOpen) {
      setSelectedType(allowedTypes.includes("Damaged") ? "Damaged" : "Lost");
    }
  }, [allowedTypes, isOpen]);

  const handleConfirm = () => {
    onConfirm(selectedType);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title={tr("Select Report Type")}
      description={tr("Please select the appropriate report type for this controlled copy:")}
      confirmText={tr("Continue")}
      cancelText={tr("Cancel")}
      size="lg"
      showCancel={true}
    >
      <div role="radiogroup" aria-label={tr("Report type")} className="space-y-3">
        {visibleOptions.map((option) => (
          <ReportTypeOption
            key={option.type}
            type={option.type}
            description={option.description}
            evidenceRequired={option.evidenceRequired}
            selected={selectedType === option.type}
            onSelect={() => setSelectedType(option.type)}
          />
        ))}
      </div>
    </FormModal>
  );
};
