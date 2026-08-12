import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/utils";

const THEME_COLORS: string[][] = [
  ["#FFFFFF", "#F2F2F2", "#D9D9D9", "#BDBDBD", "#757575", "#424242", "#212121", "#000000"],
  ["#E3F2FD", "#BBDEFB", "#90CAF9", "#64B5F6", "#1E88E5", "#1565C0", "#0D47A1", "#0A2744"],
  ["#FFFDE7", "#FFF176", "#FFD740", "#FFC107", "#FB8C00", "#E65100", "#BF360C", "#4E2B1E"],
  ["#FCE4EC", "#F48FB1", "#F06292", "#E91E63", "#C2185B", "#880E4F", "#6A1B9A", "#311B92"],
  ["#E8F5E9", "#A5D6A7", "#66BB6A", "#43A047", "#2E7D32", "#1B5E20", "#004D40", "#00251A"],
];

const DEFAULT_MY_COLORS: string[] = [
  "#9E9E9E", "#607D8B", "#2196F3", "#00BCD4", "#673AB7", "#2979FF", "#FF4081", "#3F51B5",
  "#7C4DFF", "#448AFF", "#FF6D00", "#212121", "#FFEB3B", "#F44336", "#E91E63", "#9C27B0",
  "#FF9800", "#8BC34A", "#00BFA5", "#00E5FF", "#FF1744", "#FF6E40", "#69F0AE", "#40C4FF",
  "#651FFF", "#FFAB40", "#B2FF59", "#18FFFF",
];

interface ColorPickerInputProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  label?: string;
}

const isValidHex = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value);

const normalizeHex = (value: string): string => {
  const cleaned = value.startsWith("#") ? value : `#${value}`;
  return isValidHex(cleaned) ? cleaned.toUpperCase() : "";
};

export const ColorPickerInput: React.FC<ColorPickerInputProps> = ({
  value,
  onChange,
  disabled = false,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value || "#000000");
  const [myColors, setMyColors] = useState<string[]>(DEFAULT_MY_COLORS);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHexInput((value || "#000000").toUpperCase());
  }, [value]);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownH = 340;
    const dropdownW = Math.min(280, window.innerWidth - 16);
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < dropdownH && rect.top > dropdownH;
    const top = showAbove ? rect.top + window.scrollY - dropdownH - 4 : rect.bottom + window.scrollY + 4;
    let left = rect.left + window.scrollX;
    if (left + dropdownW > window.innerWidth - 8) {
      left = window.innerWidth - dropdownW - 8;
    }
    setDropdownStyle({ position: "absolute", top, left, width: dropdownW, zIndex: 9999 });
  }, []);

  const open = () => {
    if (disabled) return;
    computePosition();
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleScroll = () => computePosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isOpen, computePosition]);

  const selectColor = (color: string) => {
    onChange(color);
    setHexInput(color.toUpperCase());
    setIsOpen(false);
  };

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setHexInput(raw);
    const normalized = normalizeHex(raw);
    if (normalized) onChange(normalized);
  };

  const handleHexBlur = () => {
    const normalized = normalizeHex(hexInput);
    if (normalized) {
      setHexInput(normalized);
      onChange(normalized);
    } else {
      setHexInput((value || "#000000").toUpperCase());
    }
  };

  const handleAddColor = () => {
    const normalized = normalizeHex(hexInput);
    if (!normalized || myColors.includes(normalized)) return;
    setMyColors((prev) => [normalized, ...prev].slice(0, 30));
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value.toUpperCase();
    onChange(color);
    setHexInput(color);
  };

  const currentColor = isValidHex(value) ? value : "#000000";

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-xs font-medium text-slate-700 sm:text-sm">{label}</span>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition hover:border-slate-300",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          className="h-5 w-5 shrink-0 rounded border border-slate-300"
          style={{ backgroundColor: currentColor }}
        />
        <span className="text-xs tracking-wide text-slate-600">{currentColor.toUpperCase()}</span>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <p className="text-sm font-semibold text-slate-800">Color Picker</p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Theme colors */}
            <div className="px-4 pb-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Theme color</p>
                <button
                  type="button"
                  onClick={() => nativeInputRef.current?.click()}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Edit
                </button>
                <input
                  ref={nativeInputRef}
                  type="color"
                  value={currentColor}
                  onChange={handleNativeChange}
                  className="sr-only"
                />
              </div>
              <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(8, 1fr)` }}>
                {THEME_COLORS.map((row, ri) =>
                  row.map((color, ci) => (
                    <button
                      key={`${ri}-${ci}`}
                      type="button"
                      title={color}
                      onClick={() => selectColor(color)}
                      className={cn(
                        "h-7 w-full transition hover:scale-110 hover:z-10 relative",
                        ri === 0 && ci === 0 && "border border-slate-200",
                        color === currentColor && "ring-2 ring-emerald-500 ring-offset-1",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  )),
                )}
              </div>
            </div>

            {/* My colors */}
            <div className="border-t border-slate-100 px-4 pt-3 pb-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">My color</p>
                <button
                  type="button"
                  onClick={handleAddColor}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  + Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {myColors.map((color, i) => (
                  <button
                    key={`my-${i}`}
                    type="button"
                    title={color}
                    onClick={() => selectColor(color)}
                    className={cn(
                      "h-6 w-6 rounded-full transition hover:scale-110",
                      color === currentColor && "ring-2 ring-emerald-500 ring-offset-1",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Hex input */}
            <div className="border-t border-slate-100 px-4 py-3">
              <div className="flex items-center justify-end gap-2">
                <span
                  className="h-5 w-5 shrink-0 rounded border border-slate-200"
                  style={{ backgroundColor: currentColor }}
                />
                <input
                  type="text"
                  value={hexInput}
                  onChange={handleHexInput}
                  onBlur={handleHexBlur}
                  maxLength={7}
                  className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-xs text-slate-700 focus:border-emerald-400 focus:outline-none"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
