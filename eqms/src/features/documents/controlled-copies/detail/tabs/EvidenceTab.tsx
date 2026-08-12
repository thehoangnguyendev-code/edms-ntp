import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ImageOff, X } from "lucide-react";
import { documentApi } from "@/services/api/documents";
import { formatDateTime } from "@/utils/format";
import type { ControlledCopyEvidenceFile } from "../../types";

interface EvidenceTabProps {
  controlledCopyId: string;
  evidence: ControlledCopyEvidenceFile[];
  reportType?: string;
}

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "";
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
};

export const EvidenceTab: React.FC<EvidenceTabProps> = ({ controlledCopyId, evidence, reportType }) => {
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    void Promise.all(
      evidence.map(async (item) => {
        try {
          const blob = await documentApi.downloadControlledCopyEvidence(controlledCopyId, item.id);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setObjectUrls((prev) => ({ ...prev, [item.id]: url }));
        } catch {
          if (!cancelled) {
            setFailedIds((prev) => ({ ...prev, [item.id]: true }));
          }
        }
      })
    );

    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledCopyId, evidence.map((item) => item.id).join(",")]);

  const lightboxItem = evidence.find((item) => item.id === lightboxId) || null;
  const lightboxIndex = lightboxItem ? evidence.findIndex((item) => item.id === lightboxItem.id) : -1;

  useEffect(() => {
    if (!lightboxItem) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxId(null);
      if (evidence.length < 2) return;
      if (event.key === "ArrowLeft") setLightboxId(evidence[lightboxIndex > 0 ? lightboxIndex - 1 : evidence.length - 1].id);
      if (event.key === "ArrowRight") setLightboxId(evidence[lightboxIndex < evidence.length - 1 ? lightboxIndex + 1 : 0].id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [evidence, lightboxIndex, lightboxItem]);

  if (evidence.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs sm:text-sm text-slate-500">
        {reportType?.toLowerCase() === "lost"
          ? "No evidence photos are required for a Lost controlled copy. The report details and audit trail remain available."
          : "No evidence files have been uploaded for this controlled copy."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {evidence.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => objectUrls[item.id] && setLightboxId(item.id)}
            className="flex flex-col rounded-lg border border-slate-200 overflow-hidden bg-white hover:border-emerald-300 transition-colors text-left"
          >
            <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
              {objectUrls[item.id] ? (
                <img src={objectUrls[item.id]} alt={item.fileName} className="h-full w-full object-cover" />
              ) : failedIds[item.id] ? (
                <ImageOff className="h-6 w-6 text-slate-400" />
              ) : (
                <div className="h-6 w-6 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin" />
              )}
            </div>
            <div className="p-2">
              <p className="text-2xs sm:text-xs font-medium text-slate-700 truncate" title={item.fileName}>
                {item.fileName}
              </p>
              <p className="text-2xs text-slate-400 truncate">
                {item.uploadedBy || "-"}{item.uploadedAt ? ` · ${formatDateTime(item.uploadedAt)}` : ""}
              </p>
              {formatFileSize(item.fileSize) && (
                <p className="text-2xs text-slate-400">{formatFileSize(item.fileSize)}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {lightboxItem && objectUrls[lightboxItem.id] && createPortal(
        <>
          <div className="fixed inset-0 z-[9998] bg-black/90" onClick={() => setLightboxId(null)} aria-hidden="true" />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-5">
            <button type="button" onClick={() => setLightboxId(null)} className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close image viewer">
              <X className="h-5 w-5 md:h-6 md:w-6" />
            </button>
            <div className="relative flex h-full w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
              <img src={objectUrls[lightboxItem.id]} alt={lightboxItem.fileName} className="max-h-[calc(100vh-7rem)] max-w-[calc(100vw-4rem)] rounded-lg object-contain shadow-2xl" />
              {evidence.length > 1 && <>
                <button type="button" onClick={() => setLightboxId(evidence[lightboxIndex > 0 ? lightboxIndex - 1 : evidence.length - 1].id)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:left-4 md:p-3" aria-label="Previous evidence image"><ArrowLeft className="h-5 w-5 md:h-6 md:w-6" /></button>
                <button type="button" onClick={() => setLightboxId(evidence[lightboxIndex < evidence.length - 1 ? lightboxIndex + 1 : 0].id)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:right-4 md:p-3" aria-label="Next evidence image"><ArrowLeft className="h-5 w-5 rotate-180 md:h-6 md:w-6" /></button>
              </>}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white md:bottom-4 md:px-4 md:py-2">{lightboxIndex + 1} / {evidence.length}</div>
            </div>
          </div>
        </>,
        window.document.body,
      )}
    </div>
  );
};
