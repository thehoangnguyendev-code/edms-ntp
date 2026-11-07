import React from "react";
import { Button } from "@/components/ui/button/Button";
import { ColorPickerInput } from "@/components/ui/color-picker/ColorPickerInput";
import { Folder } from "@/components/ui/folder-component";
import { folderColor } from "@/features/self-service/knowledge/explorer/explorerModel";

interface FolderColorFieldProps {
  /** The name the folder carries; it only decides the automatic colour. */
  name: string;
  /** The chosen colour as #rrggbb; empty means the automatic one. */
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

/** Design the colour of the folder of a Business Unit or a Department in the Knowledge Base explorer, with a preview of the folder. */
export const FolderColorField: React.FC<FolderColorFieldProps> = ({ name, value, onChange, disabled }) => {
  const automatic = folderColor(name);
  return (
    <div>
      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">Knowledge Base Folder Color</label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-16 w-20 shrink-0">
          <Folder color={(value || automatic) as `#${string}`} scale={0.24} />
        </div>
        <div className="w-36">
          <ColorPickerInput value={value || automatic} onChange={(color) => onChange(color.toLowerCase())} disabled={disabled} />
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} disabled={disabled || !value}>
          Default
        </Button>
      </div>
    </div>
  );
};
