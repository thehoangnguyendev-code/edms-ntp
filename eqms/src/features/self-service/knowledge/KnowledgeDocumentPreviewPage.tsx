import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/app/routes.constants";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import {
  DocumentStateMessage,
  documentStateFromError,
  type DocumentStateVariant,
} from "@/components/ui/document-state/DocumentStateMessage";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { knowledgeApi } from "@/services/api/knowledge";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/images/logo_nobg.png";
import { displayDateTime } from "@/utils/format";
import { tr, getCatalogLanguage } from "@/i18n";

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const documentName = searchParams.get("name") || "Document Preview";
  const documentNumber = searchParams.get("number") || "";
  const revisionNumber = searchParams.get("revision") || "";
  const departmentName = searchParams.get("department") || "";

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [errorState, setErrorState] = useState<DocumentStateVariant>("no-document");
  const [openedAt] = useState(() => new Date());

  const watermarkUrl = useMemo(() => {
    const who = tr(user?.fullName || user?.username || "Unknown user");
    const stamp = displayDateTime(openedAt);
    return buildWatermarkDataUri([who, stamp]);
  }, [user?.fullName, user?.username, openedAt, getCatalogLanguage()]);

  useEffect(() => {
    document.title = `${documentName} — Preview`;
  }, [documentName]);

  // The preview opens in a tab of its own: closing that tab is the way out; when the browser refuses, the Knowledge Base is.
  const closePreview = useCallback(() => {
    window.close();
    navigate(ROUTES.DOCUMENTS.KNOWLEDGE_EXPLORER, { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!documentId) {
      setLoadError(true);
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    setLoadError(false);
    knowledgeApi
      .previewDocument(documentId)
      .then((blob) => {
        if (!active) return;
        setBlobUrl(URL.createObjectURL(blob));
      })
      .catch((error) => {
        if (!active) return;
        setErrorState(documentStateFromError(error));
        setLoadError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
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
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50 pb-[env(safe-area-inset-bottom)]">
      <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] md:gap-4 md:px-6 md:py-3">
        <img
          src={logo}
          alt={tr("EQMS logo")}
          className="hidden sm:block h-7 md:h-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        />
        <div className="relative z-10 min-w-0 flex items-center gap-2 md:gap-3 max-w-[55%] sm:max-w-[38%]">
          <div className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 md:h-4.5 md:w-4.5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs md:text-sm font-semibold text-slate-900 truncate">{documentName}</p>
            <p className="text-xs text-slate-600 truncate">
              {[documentNumber, revisionNumber && `${tr("Revision")} ${revisionNumber}`, departmentName].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={closePreview}
          aria-label={tr("Close preview")}
          className="relative z-10 shrink-0 text-slate-500 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative flex-1 min-h-0">
        {loadError || (!isLoading && !blobUrl) ? (
          <div className="h-full overflow-y-auto flex items-center justify-center">
            {errorState === "no-access" ? (
              <DocumentStateMessage
                variant="no-access"
                title={tr("You can no longer open this document")}
                description={tr("Access to it was withdrawn or it is no longer available to you. Contact Document Control if you need it.")}
              />
            ) : (
              <DocumentStateMessage
                variant="no-document"
                title={tr("Unable to load this document's preview")}
                description={tr("The document could not be found or opened. Please try again later.")}
              />
            )}
          </div>
        ) : isLoading || !blobUrl ? (
          <FullPageLoading text={tr("Loading preview...")} />
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
