import React, { useRef, useState } from "react";
import { Upload, Link, X, CloudUpload } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/utils";
import { TabNav } from "@/components/ui/tabs/TabNav";

interface LogoUploaderProps {
  value: string;
  onChange: (url: string, fileName?: string) => void;
}

type Mode = "url" | "upload";

export const LogoUploader: React.FC<LogoUploaderProps> = ({ value, onChange }) => {
  const [mode, setMode] = useState<Mode>("url");
  const [isDragging, setIsDragging] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string, file.name);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isUploaded = value?.startsWith("data:");
  const hasValue = !!value;

  return (
    <>
      <div className="space-y-3">
        {/* Tab Toggle using Central TabNav */}
        <TabNav
          tabs={[
            { id: "url", label: "Link URL", icon: Link },
            { id: "upload", label: "Upload File", icon: CloudUpload },
          ]}
          activeTab={mode}
          onChange={(tabId) => setMode(tabId as Mode)}
          variant="pill"
          className="mb-3"
          layoutId="logoTabIndicator"
        />

        {/* URL Input */}
        {mode === "url" && (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Link className="h-3.5 w-3.5 text-slate-400" />
            </div>
              <input
              type="url"
              value={isUploaded ? "" : value}
              onChange={(e) => onChange(e.target.value, undefined)}
              placeholder="https://example.com/logo.png"
              className="block w-full h-9 pl-9 pr-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm placeholder:text-slate-400 transition-all"
            />
            {value && !isUploaded && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Upload Drop Zone */}
        {mode === "upload" && !hasValue && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center w-full min-h-[140px] border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 p-4 md:p-5",
              isDragging
                ? "border-emerald-500 bg-emerald-50/50"
                : "border-slate-300 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/30"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors",
              isDragging ? "bg-emerald-100" : "bg-slate-100"
            )}>
              <Upload className={cn("h-6 w-6", isDragging ? "text-emerald-600" : "text-slate-400")} />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-700 text-center">
              {isDragging ? "Drop your file here" : "Click to upload or drag & drop"}
            </p>
            <p className="text-2xs sm:text-xs font-normal text-slate-400 mt-1 flex items-center gap-1">PNG, JPG, SVG, WEBP (max 10MB)</p>
          </div>
        )}

        {/* Thumbnail Preview — click to lightbox, hover to show X */}
        {hasValue && (
          <div className="border border-slate-200 rounded-xl p-4 md:p-5 bg-slate-50/50 group hover:bg-slate-100/50 transition-colors">
            <div className="flex items-start gap-3">
              <div
                className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 cursor-pointer hover:border-emerald-400 transition-all overflow-hidden"
                onClick={() => setShowLightbox(true)}
              >
                <img
                  src={value}
                  alt="Logo preview"
                  className="w-full h-full object-contain p-1"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {isUploaded ? "Uploaded image" : value}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isUploaded ? "Local file" : "External URL"} · Click to preview
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("", undefined);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-200 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove logo"
              >
                <X className="h-4 w-4 text-slate-500 hover:text-red-600 transition-colors" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Portal */}
      {showLightbox && hasValue && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/90"
            onClick={() => setShowLightbox(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-5">
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={value}
              alt="Logo full size"
              className="max-w-full max-h-full w-auto h-auto object-contain rounded-xl shadow-2xl"
            />
          </div>
        </>,
        document.body
      )}
    </>
  );
};
