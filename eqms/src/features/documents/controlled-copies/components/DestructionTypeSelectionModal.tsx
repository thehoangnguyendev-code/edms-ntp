import React, { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { RadioGroup } from "@/components/ui/radio/Radio";
import { IconFileBroken } from "@tabler/icons-react";

interface DestructionTypeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: "Lost" | "Damaged") => void;
  allowedTypes?: Array<"Lost" | "Damaged">;
}

export const DestructionTypeSelectionModal: React.FC<
  DestructionTypeSelectionModalProps
> = ({ isOpen, onClose, onConfirm, allowedTypes = ["Damaged", "Lost"] }) => {
  const [selectedType, setSelectedType] = useState<"Lost" | "Damaged">("Damaged");
  const visibleOptions = [
    allowedTypes.includes("Damaged")
      ? {
          label: "Damaged",
          value: "Damaged",
          description: "The controlled copy is damaged and needs to be destroyed. Evidence photos required",
          icon: <IconFileBroken className="h-5 w-5 text-red-600" />,
        }
      : null,
    allowedTypes.includes("Lost")
      ? {
          label: "Lost",
          value: "Lost",
          description: "The controlled copy cannot be located and is considered lost. No evidence photos required",
          icon: <ImageOff className="h-5 w-5 text-amber-600" />,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: "Lost" | "Damaged";
    description: string;
    icon: React.ReactNode;
  }>;

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
      <RadioGroup
        name="destructionType"
        value={selectedType}
        onChange={(val) => setSelectedType(val as "Lost" | "Damaged")}
        layout="horizontal"
        variant="card"
        options={visibleOptions}
      />
    </FormModal>
  );
};
