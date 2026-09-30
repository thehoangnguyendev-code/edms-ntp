import { useEffect, useState } from "react";
import { SECURITY_CONFIG_STORAGE_KEY } from "@/config/security";
import { settingsApi } from "@/services/api/settings";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";

export interface PdfPreviewSettings {
  defaultZoom?: "page-fit" | "page-width" | "actual-size";
  showThumbnailSidebar?: boolean;
  showSearch?: boolean;
  showPageNavigation?: boolean;
  showZoomControls?: boolean;
  showFullScreen?: boolean;
  showInsertTools?: boolean;
  showOpenDocumentAction?: boolean;
  showCloseDocumentAction?: boolean;
  showSecurityAction?: boolean;
  showScreenshotAction?: boolean;
  allowTextSelection?: boolean;
  watermarkText?: string;
  watermarkShowViewerName?: boolean;
  watermarkShowOpenedAt?: boolean;
}

const readPdfPreviewSettings = (): PdfPreviewSettings => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SECURITY_CONFIG_STORAGE_KEY);
    return (raw ? (JSON.parse(raw) as SystemConfigLike).documents?.pdfPreview : undefined) ?? {};
  } catch {
    return {};
  }
};

interface SystemConfigLike {
  documents?: {
    allowDownload?: boolean;
    pdfPreview?: PdfPreviewSettings;
  };
}

const readAllowDownloadSetting = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(SECURITY_CONFIG_STORAGE_KEY);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw) as SystemConfigLike;
    return Boolean(parsed.documents?.allowDownload);
  } catch {
    return false;
  }
};

export const useDocumentPreviewSettings = () => {
  const [allowDownloadAndPrint, setAllowDownloadAndPrint] = useState<boolean>(() =>
    readAllowDownloadSetting(),
  );

  const [pdfPreview, setPdfPreview] = useState<PdfPreviewSettings>(() => readPdfPreviewSettings());

  useEffect(() => {
    const syncFromStorage = () => {
      setAllowDownloadAndPrint(readAllowDownloadSetting());
      setPdfPreview(readPdfPreviewSettings());
    };

    syncFromStorage();

    const handleSecurityConfigUpdated = () => {
      syncFromStorage();
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SECURITY_CONFIG_STORAGE_KEY) {
        syncFromStorage();
      }
    };

    const unsubscribeRealtime = subscribeNotificationRealtime((event) => {
      if (event.type !== "documents-preview-config-updated") return;
      void settingsApi.getDocumentsOperationalConfig().then((documents) => {
        try {
          const cached = JSON.parse(window.localStorage.getItem(SECURITY_CONFIG_STORAGE_KEY) || "{}") as SystemConfigLike;
          window.localStorage.setItem(SECURITY_CONFIG_STORAGE_KEY, JSON.stringify({ ...cached, documents }));
        } catch {
          window.localStorage.setItem(SECURITY_CONFIG_STORAGE_KEY, JSON.stringify({ documents }));
        }
        syncFromStorage();
      }).catch(() => undefined);
    });

    window.addEventListener("eqms:security-config-updated", handleSecurityConfigUpdated);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("eqms:security-config-updated", handleSecurityConfigUpdated);
      window.removeEventListener("storage", handleStorageChange);
      unsubscribeRealtime();
    };
  }, []);

  return { allowDownloadAndPrint, pdfPreview };
};
