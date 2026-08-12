import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { FileWarning, FileText } from "lucide-react";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { documentApi } from "@/services/api/documents";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/images/logo_nobg.png";

const buildWatermarkDataUri = (lines: string[]) => {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tileWidth = 460;
  const tileHeight = 260;
  const text = lines
    .map((line, index) => `<tspan x="0" dy="${index === 0 ? 0 : 18}">${escape(line)}</tspan>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}">
    <text x="20" y="${tileHeight / 2}" font-size="13" font-family="sans-serif" fill="rgba(15,23,42,0.09)" transform="rotate(-28 ${tileWidth / 2} ${tileHeight / 2})">${text}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const KnowledgeDocumentPreviewPage: React.FC = () => {
  const { documentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const documentName = searchParams.get("name") || "Document Preview";
  const documentNumber = searchParams.get("number") || "";
  const revisionNumber = searchParams.get("revision") || "";
  const departmentName = searchParams.get("department") || "";

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [openedAt] = useState(() => new Date());

  const watermarkUrl = useMemo(() => {
    const who = user?.fullName || user?.username || "Unknown user";
    const stamp = openedAt.toLocaleString();
    return buildWatermarkDataUri([who, stamp]);
  }, [user?.fullName, user?.username, openedAt]);

  useEffect(() => {
    document.title = `${documentName} — Preview`;
  }, [documentName]);

  useEffect(() => {
    if (!documentId) {
      setLoadError(true);
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    setLoadError(false);
    documentApi
      .previewDocument(documentId)
      .then((blob) => {
        if (!active) return;
        setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    void documentApi.logKnowledgeBasePreviewOpened(documentId).catch(() => {
      // Best-effort audit log; do not block the preview if this fails.
    });
    return () => {
      active = false;
    };
  }, [documentId]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ["p", "s"].includes(key)) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50">
      <div className="relative shrink-0 border-b border-slate-200 bg-white px-3 md:px-6 py-2.5 md:py-3 flex items-center justify-between gap-2 md:gap-4">
        <img
          src={logo}
          alt="Ngoc Thien"
          className="hidden sm:block h-7 md:h-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        />
        <div className="relative z-10 min-w-0 flex items-center gap-2 md:gap-3 max-w-[55%] sm:max-w-[38%]">
          <div className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 md:h-4.5 md:w-4.5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs md:text-sm font-semibold text-slate-900 truncate">{documentName}</p>
            <p className="text-2xs md:text-xs text-slate-500 truncate">
              {[documentNumber, revisionNumber && `Rev ${revisionNumber}`, departmentName].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        {loadError || (!isLoading && !blobUrl) ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <FileWarning className="h-10 w-10 text-red-300" />
            <p className="text-sm font-medium text-red-500">Unable to load this document's preview</p>
          </div>
        ) : isLoading || !blobUrl ? (
          <FullPageLoading text="Loading preview..." />
        ) : (
          <DocumentPdfViewer
            fileUrl={blobUrl}
            withFrame={false}
            forceHideDownloadAndPrint
          />
        )}
        {blobUrl && !isLoading && (
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{ backgroundImage: `url("${watermarkUrl}")`, backgroundRepeat: "repeat" }}
          />
        )}
      </div>
    </div>
  );
};
