import React, { useEffect, useState } from "react";
import { ImageOff, Check } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { IconFileBroken } from "@tabler/icons-react";
import { cn } from "@/components/ui/utils";

interface DestructionTypeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: "Lost" | "Damaged") => void;
  allowedTypes?: Array<"Lost" | "Damaged">;
}

const TYPE_STYLES: Record<"Lost" | "Damaged", { badge: string; ring: string; icon: React.ReactNode }> = {
  Damaged: {
    badge: "bg-red-50 text-red-600",
    ring: "border-red-300 ring-red-500 shadow-red-100/60",
    icon: <IconFileBroken className="h-5 w-5" />,
  },
  Lost: {
    badge: "bg-amber-50 text-amber-600",
    ring: "border-amber-300 ring-amber-500 shadow-amber-100/60",
    icon: <ImageOff className="h-5 w-5" />,
  },
};

// Same compact selectable-card language as the "New Document" choice modal
// (NewDocumentChoiceCard in DocumentsView.tsx) -- neutral by default, colored accent on
// hover/selection, small icon badge + title + description, so the two "pick one" modals in this
// app read as the same pattern.
const ReportTypeCard: React.FC<{
  type: "Lost" | "Damaged";
  description: string;
  selected: boolean;
  onSelect: () => void;
}> = ({ type, description, selected, onSelect }) => {
  const styles = TYPE_STYLES[type];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex flex-col rounded-xl border bg-white p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        selected
          ? cn("ring-1", styles.ring)
          : "border-slate-200 hover:border-slate-300 hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", styles.badge)}>
          {styles.icon}
        </span>
        {selected && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>
      <span className="mt-3 block text-sm font-semibold text-slate-900">{type}</span>
      <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
    </button>
  );
};

export const DestructionTypeSelectionModal: React.FC<
  DestructionTypeSelectionModalProps
> = ({ isOpen, onClose, onConfirm, allowedTypes = ["Damaged", "Lost"] }) => {
  const [selectedType, setSelectedType] = useState<"Lost" | "Damaged">("Damaged");
  const visibleOptions = [
    allowedTypes.includes("Damaged")
      ? {
          type: "Damaged" as const,
          description: "The controlled copy is damaged and needs to be destroyed. Evidence photos required.",
        }
      : null,
    allowedTypes.includes("Lost")
      ? {
          type: "Lost" as const,
          description: "The controlled copy cannot be located and is considered lost. No evidence photos required.",
        }
      : null,
  ].filter(Boolean) as Array<{ type: "Lost" | "Damaged"; description: string }>;

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
      title="Select Report Type"
      description="Please select the appropriate report type for this controlled copy:"
      confirmText="Continue"
      cancelText="Cancel"
      size="lg"
      showCancel={true}
    >
      <div className={cn("grid gap-3", visibleOptions.length > 1 && "sm:grid-cols-2")}>
        {visibleOptions.map((option) => (
          <ReportTypeCard
            key={option.type}
            type={option.type}
            description={option.description}
            selected={selectedType === option.type}
            onSelect={() => setSelectedType(option.type)}
          />
        ))}
      </div>
    </FormModal>
  );
};
