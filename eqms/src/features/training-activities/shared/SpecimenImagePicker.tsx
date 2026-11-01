import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { imageWatermarkApi } from "@/services/api/imageWatermark";

const MAX_BYTES = 5 * 1024 * 1024;
/** The watermark is drawn on a PNG or a JPEG only, so only those two are accepted. */
const TYPES = ["image/png", "image/jpeg"];

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
}

/** Drop zone for a picture (PNG or JPEG; same look as the other image uploads); the chosen image is shown before it is uploaded, with the watermark the server would stamp on it. */
export function SpecimenImagePicker({ file, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; stamped: boolean; note?: string } | null>(null);

  // The picture is shown at once; the server then answers with the same picture stamped as the upload would stamp it (when a watermark is set for specimen signatures).
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const local = URL.createObjectURL(file);
    let stamped: string | undefined;
    let live = true;
    setPreview({ url: local, stamped: false });
    imageWatermarkApi.uploadPreview("specimenSignature", file).then((result) => {
      if (!live) return;
      if (result.applied) stamped = URL.createObjectURL(result.blob);
      setPreview({ url: stamped ?? local, stamped: result.applied, note: result.note });
    }).catch(() => undefined);
    return () => { live = false; URL.revokeObjectURL(local); if (stamped) URL.revokeObjectURL(stamped); };
  }, [file]);

  const pick = (next?: File) => {
    if (!next) return;
    if (!TYPES.includes(next.type)) { setError("Only a PNG or JPEG image is accepted."); return; }
    if (next.size > MAX_BYTES) { setError("The image is larger than 5 MB."); return; }
    setError("");
    onChange(next);
  };
  const clear = () => { setError(""); onChange(null); if (inputRef.current) inputRef.current.value = ""; };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 transition-all duration-200 md:p-5",
            dragging ? "border-emerald-500 bg-emerald-50/50" : "border-slate-300 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/30",
          )}
        >
          <div className={cn("mb-3 flex h-12 w-12 items-center justify-center rounded-full", dragging ? "bg-emerald-100" : "bg-slate-100")}>
            <Upload className={cn("h-6 w-6", dragging ? "text-emerald-600" : "text-slate-400")} />
          </div>
          <p className="text-center text-xs font-medium text-slate-700 sm:text-sm">{dragging ? "Drop your file here" : "Click to upload or drag & drop"}</p>
          <p className="mt-1 text-2xs font-normal text-slate-400 sm:text-xs">PNG or JPG (max 5 MB)</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-24 w-40 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
              {preview && <img src={preview.url} alt={preview.stamped ? "Specimen signature preview with the watermark" : "Specimen signature preview"} className="h-full w-full object-contain p-1" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`} · {preview?.stamped ? "Preview with the watermark. The upload time is the time of upload." : "Preview before upload"}</p>
              {preview?.note && <p className="mt-0.5 text-xs text-amber-700">{preview.note}.</p>}
            </div>
            <button type="button" onClick={clear} className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-slate-200" title="Remove image">
              <X className="h-4 w-4 text-slate-500 hover:text-red-600" />
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
