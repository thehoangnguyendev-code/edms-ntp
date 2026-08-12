import React from "react";
import { Worker, Viewer, type RenderPageProps } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import { Loader2 } from "lucide-react";
import { config } from "@/config";
import { useDocumentPreviewSettings } from "../useDocumentPreviewSettings";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/page-navigation/lib/styles/index.css";
import "@react-pdf-viewer/thumbnail/lib/styles/index.css";

interface DocumentPdfViewerProps {
  fileUrl: string;
  className?: string;
  height?: string;
  minHeight?: string;
  withFrame?: boolean;
  showThumbnailSidebar?: boolean;
  thumbnailSidebarWidth?: number;
  isLoading?: boolean;
  pageRangeHighlights?: Array<{
    key: string;
    label: string;
    from: number;
    to: number;
    tone?: "emerald" | "slate" | "amber" | "blue" | "rose";
  }>;
  /** Always hide download/print controls regardless of the system-wide allowDownloadAndPrint setting. */
  forceHideDownloadAndPrint?: boolean;
  /** Per-resource policy. When omitted, the system-wide setting is used. */
  allowDownload?: boolean;
  allowPrint?: boolean;
  /** Allow the browser context menu (needed for native Print when enabled). */
  allowContextMenu?: boolean;
  onDocumentLoad?: () => void;
  /** Injects a page-relative overlay (e.g. review comment pins) on top of each rendered page.
   * `pageIndex` is 0-based (pdf.js convention) — callers anchoring to a 1-based page number
   * must convert. `pageWidth`/`pageHeight` are the page's rendered CSS pixel dimensions, so an
   * overlay child can position pins with `left: x * pageWidth`, `top: y * pageHeight`. */
  renderPageOverlay?: (pageIndex: number, pageWidth: number, pageHeight: number) => React.ReactNode;
  /** Called once with a `jumpToPage(pageIndex0Based)` function, letting a parent (e.g. a review
   * comment list panel) navigate the viewer to a specific page. */
  onJumpToPageReady?: (jumpToPage: (pageIndex0Based: number) => void) => void;
}

export const DocumentPdfViewer: React.FC<DocumentPdfViewerProps> = ({
  fileUrl,
  className = "",
  height = "calc(100vh - 120px)",
  minHeight = "720px",
  withFrame = true,
  showThumbnailSidebar = false,
  thumbnailSidebarWidth = 220,
  isLoading = false,
  pageRangeHighlights = [],
  forceHideDownloadAndPrint = false,
  allowDownload,
  allowPrint,
  allowContextMenu = false,
  onDocumentLoad,
  renderPageOverlay,
  onJumpToPageReady,
}) => {
  const { allowDownloadAndPrint: systemAllowsDownloadAndPrint } = useDocumentPreviewSettings();
  const effectiveAllowDownload = systemAllowsDownloadAndPrint && (allowDownload ?? true) && !forceHideDownloadAndPrint;
  const effectiveAllowPrint = systemAllowsDownloadAndPrint && (allowPrint ?? true) && !forceHideDownloadAndPrint;

  const toneClassMap: Record<NonNullable<NonNullable<DocumentPdfViewerProps["pageRangeHighlights"]>[number]["tone"]>, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };

  // React PDF Viewer plugins use hooks internally and must run on every render.
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    toolbarPlugin: {
      printPlugin: {
        enableShortcuts: effectiveAllowPrint,
      },
    },
  });
  const pageNavigationPluginInstance = pageNavigationPlugin({
    enableShortcuts: effectiveAllowPrint,
  });
  const { jumpToPage } = pageNavigationPluginInstance;

  const handleDocumentLoad = React.useCallback(() => {
    // The navigation plugin is only ready after pdf.js has loaded the document.
    // Publishing it earlier leaves a comparison viewer unable to honour a
    // pending comment jump when it is still mounting.
    onJumpToPageReady?.(jumpToPage);
    onDocumentLoad?.();
  }, [jumpToPage, onDocumentLoad, onJumpToPageReady]);

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P") && !effectiveAllowPrint) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
    };
  }, [effectiveAllowPrint]);

  const previewControlsStyle = (
    <style>{`
      .eqms-document-pdf-viewer [data-testid="open__button"],
      .eqms-document-pdf-viewer [data-testid="open__file-button"],
      .eqms-document-pdf-viewer [data-testid="open-file__button"],
      .eqms-document-pdf-viewer [data-testid="open-file__menu"],
      .eqms-document-pdf-viewer [aria-label*="Open file"],
      .eqms-document-pdf-viewer [aria-label*="Open File"],
      .eqms-document-pdf-viewer [aria-label*="Mở tệp"],
      .eqms-document-pdf-viewer [aria-label*="Mở file"],
      .eqms-document-pdf-viewer [title*="Open file"],
      .eqms-document-pdf-viewer [title*="Open File"],
      .eqms-document-pdf-viewer [title*="Mở tệp"],
      .eqms-document-pdf-viewer [title*="Mở file"] {
        display: none !important;
      }
      ${!effectiveAllowDownload ? `
      .eqms-document-pdf-viewer [data-testid="get-file__download-button"],
      .eqms-document-pdf-viewer [data-testid="get-file__download-menu"] {
        display: none !important;
      }
      ` : ""}
      ${!effectiveAllowPrint ? `
      .eqms-document-pdf-viewer [data-testid="print__button"],
      .eqms-document-pdf-viewer [data-testid="print__menu"] {
        display: none !important;
      }
      ` : ""}
      ${!effectiveAllowPrint ? `@media print {
        body {
          display: none !important;
        }
      }` : ""}
    `}</style>
  );

  const content = (
    <Worker workerUrl={config.pdf.workerUrl}>
      {previewControlsStyle}
      <div
        className="eqms-document-pdf-viewer relative flex h-full min-h-0 overflow-hidden select-none"
        onContextMenu={(e) => { if (!allowContextMenu) e.preventDefault(); }}
      >
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-[1px]">
            <div className="w-full max-w-[320px] rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                Loading preview...
              </div>
              <div className="mt-4 space-y-3">
                <div className="h-3 w-3/4 animate-pulse rounded-full bg-slate-200" />
                <div className="h-3 w-5/6 animate-pulse rounded-full bg-slate-100" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="h-16 animate-pulse rounded-lg bg-emerald-50" />
                  <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
                  <div className="h-16 animate-pulse rounded-lg bg-amber-50" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <Viewer
            key={fileUrl}
            fileUrl={fileUrl}
            plugins={[defaultLayoutPluginInstance, pageNavigationPluginInstance]}
            defaultScale={1}
            onDocumentLoad={handleDocumentLoad}
            renderPage={
              renderPageOverlay
                ? (props: RenderPageProps) => (
                    <>
                      {props.canvasLayer.children}
                      {props.textLayer.children}
                      {props.annotationLayer.children}
                      <div className="pointer-events-none absolute inset-0 z-10" style={{ width: props.width, height: props.height }}>
                        {renderPageOverlay(props.pageIndex, props.width, props.height)}
                      </div>
                    </>
                  )
                : undefined
            }
          />
        </div>
      </div>
    </Worker>
  );

  if (!withFrame) {
    return content;
  }

  return (
    <div
      className={`eqms-document-pdf-viewer w-full bg-white border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden select-none ${className}`.trim()}
      style={{ height, minHeight }}
      onContextMenu={(e) => { if (!allowContextMenu) e.preventDefault(); }}
    >
      <div className="flex-1 min-h-0 overflow-hidden">{content}</div>
    </div>
  );
};
