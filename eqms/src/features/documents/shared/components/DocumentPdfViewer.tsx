import React from "react";
import {
  PDFViewer,
  ZoomPlugin,
  type PDFViewerConfig,
  type PluginRegistry,
  type ZoomLevel,
} from "@embedpdf/react-pdf-viewer";
import { Loader2 } from "lucide-react";
import { useDocumentPreviewSettings } from "../useDocumentPreviewSettings";

interface DocumentPdfViewerProps {
  fileUrl: string;
  className?: string;
  height?: string;
  minHeight?: string;
  withFrame?: boolean;
  showThumbnailSidebar?: boolean;
  thumbnailSidebarWidth?: number;
  isLoading?: boolean;
  /** Retained for caller compatibility. EmbedPDF does not render range labels into document pages. */
  pageRangeHighlights?: Array<{ key: string; label: string; from: number; to: number; tone?: "emerald" | "slate" | "amber" | "blue" | "rose" }>;
  /** Always hide download/print controls regardless of the system-wide allowDownloadAndPrint setting. */
  forceHideDownloadAndPrint?: boolean;
  /** Per-resource policy. When omitted, the system-wide setting is used. */
  allowDownload?: boolean;
  allowPrint?: boolean;
  /** Allow the browser context menu (needed for native Print when enabled). */
  allowContextMenu?: boolean;
  onDocumentLoad?: () => void;
  /** Legacy extension point retained until review-comment pins are migrated to EmbedPDF annotations. */
  renderPageOverlay?: (pageIndex: number, pageWidth: number, pageHeight: number) => React.ReactNode;
  /** Legacy extension point retained until review-comment navigation is migrated to EmbedPDF. */
  onJumpToPageReady?: (jumpToPage: (pageIndex0Based: number) => void) => void;
}

const BASE_READ_ONLY_CATEGORIES = [
  "redaction",
  "form",
  "capture",
  "history",
] as const;

export const DocumentPdfViewer: React.FC<DocumentPdfViewerProps> = ({
  fileUrl,
  className = "",
  height = "calc(100vh - 120px)",
  minHeight = "720px",
  withFrame = true,
  showThumbnailSidebar = false,
  isLoading = false,
  forceHideDownloadAndPrint = false,
  allowDownload,
  allowPrint,
  allowContextMenu = false,
  onDocumentLoad,
}) => {
  const { allowDownloadAndPrint: systemAllowsDownloadAndPrint, pdfPreview } = useDocumentPreviewSettings();
  const initialZoomRequestKey = React.useRef<string | null>(null);
  const effectiveAllowDownload = systemAllowsDownloadAndPrint && (allowDownload ?? true) && !forceHideDownloadAndPrint;
  const effectiveAllowPrint = systemAllowsDownloadAndPrint && (allowPrint ?? true) && !forceHideDownloadAndPrint;
  const defaultZoomLevel: ZoomLevel = pdfPreview.defaultZoom === "page-fit"
    ? "fit-page"
    : pdfPreview.defaultZoom === "page-width"
      ? "fit-width"
      : 1;
  // The EmbedPDF React wrapper initialises its engine once per mount. Include
  // every viewer policy input in the key so a live Admin configuration update
  // remounts the engine with the newly allowed/disabled controls.
  const viewerInstanceKey = React.useMemo(() => JSON.stringify({
    fileUrl,
    defaultZoomLevel,
    effectiveAllowDownload,
    effectiveAllowPrint,
    pdfPreview,
    showThumbnailSidebar,
  }), [
    defaultZoomLevel,
    effectiveAllowDownload,
    effectiveAllowPrint,
    fileUrl,
    pdfPreview,
    showThumbnailSidebar,
  ]);

  const viewerConfig = React.useMemo<PDFViewerConfig>(() => {
    const disabledCategories = new Set<string>(BASE_READ_ONLY_CATEGORIES);
    if (!effectiveAllowDownload) {
      disabledCategories.add("export");
      disabledCategories.add("document-export");
    }
    if (!effectiveAllowPrint) disabledCategories.add("document-print");
    if (pdfPreview.allowTextSelection !== true || !effectiveAllowDownload) disabledCategories.add("selection");
    // EmbedPDF's categories are its native command/UI categories, not those of
    // the retired PDF.js viewer. Keep this mapping aligned with its UI schema.
    if (pdfPreview.showSearch === false) disabledCategories.add("panel-search");
    if (pdfPreview.showPageNavigation === false) disabledCategories.add("navigation");
    if (pdfPreview.showZoomControls === false) disabledCategories.add("zoom");
    if (pdfPreview.showFullScreen === false) disabledCategories.add("document-fullscreen");
    if (pdfPreview.showOpenDocumentAction === false) disabledCategories.add("document-open");
    if (pdfPreview.showCloseDocumentAction === false) disabledCategories.add("document-close");
    if (pdfPreview.showSecurityAction === false) {
      disabledCategories.add("document-protect");
      disabledCategories.add("security");
    }
    if (pdfPreview.showScreenshotAction === false) {
      disabledCategories.add("document-capture");
      disabledCategories.add("capture");
      disabledCategories.add("capture-screenshot");
    }
    // EmbedPDF's Insert tab contains annotation tools. It is hidden by default for a regulated
    // read-only preview, but can be explicitly enabled as session-only markup by an administrator.
    if (pdfPreview.showInsertTools !== true) {
      disabledCategories.add("insert");
      disabledCategories.add("mode-insert");
    }
    // Never expose the other editing modes in a preview, even when Insert is enabled.
    disabledCategories.add("mode-annotate");
    disabledCategories.add("mode-shapes");
    // Pan/rotate are editing-style utilities rather than document-viewing
    // controls. Keep them unavailable across all regulated preview surfaces.
    disabledCategories.add("pan");
    disabledCategories.add("rotate");
    if (pdfPreview.showThumbnailSidebar === false && !showThumbnailSidebar) disabledCategories.add("panel-sidebar");

    return {
      src: fileUrl,
      worker: true,
      // PDFium WASM is emitted with the Vite build and served from this application origin.
      // No CDN, CloudPDF service, or external font request is used by this read-only viewer.
      fontFallback: null,
      fonts: { ui: null, signature: null },
      tabBar: "never",
      // Preview is deliberately light-only so the rendered document and its
      // watermark remain visually consistent across operating-system themes.
      theme: { preference: "light" },
      zoom: {
        defaultZoomLevel,
      },
      permissions: {
        enforceDocumentPermissions: true,
        overrides: {
          print: effectiveAllowPrint,
          copyContents: pdfPreview.allowTextSelection === true && effectiveAllowDownload,
        },
      },
      disabledCategories: [...disabledCategories],
    };
  }, [defaultZoomLevel, effectiveAllowDownload, effectiveAllowPrint, fileUrl, pdfPreview, showThumbnailSidebar]);

  const handleViewerReady = React.useCallback((registry: PluginRegistry) => {
    // Reapply the configured initial zoom only once per mounted document. The former delayed
    // second request fired while users were already reading and visibly reloaded/reflowed pages.
    // A pair of animation frames waits for the tab panel to receive its dimensions.
    const requestInitialZoom = () => {
      if (registry.isDestroyed() || initialZoomRequestKey.current === viewerInstanceKey) return;
      initialZoomRequestKey.current = viewerInstanceKey;
      registry.getPlugin<ZoomPlugin>(ZoomPlugin.id)?.provides().requestZoom(defaultZoomLevel);
    };
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(requestInitialZoom);
    });
    onDocumentLoad?.();
  }, [defaultZoomLevel, onDocumentLoad, viewerInstanceKey]);

  React.useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === "p" || event.key === "P") && !effectiveAllowPrint) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [effectiveAllowPrint]);

  const content = (
    <div
      className="eqms-document-pdf-viewer relative h-full min-h-0 overflow-hidden rounded-xl bg-white"
      onContextMenu={(event) => { if (!allowContextMenu) event.preventDefault(); }}
    >
      <PDFViewer
        key={viewerInstanceKey}
        config={viewerConfig}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
        onReady={handleViewerReady}
      />
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-[1px]">
          <div className="w-full max-w-[320px] rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              Loading preview...
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (!withFrame) return content;

  return (
    <div
      className={`eqms-document-pdf-viewer flex w-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}
      style={{ height, minHeight }}
      onContextMenu={(event) => { if (!allowContextMenu) event.preventDefault(); }}
    >
      <div className="min-h-0 flex-1 overflow-hidden">{content}</div>
    </div>
  );
};
