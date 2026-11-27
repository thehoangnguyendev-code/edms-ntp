import { tr as __ariaTr } from "@/i18n";
import React from 'react';
import onlyOfficeLogo from '@/assets/images/logo-app/onlyoffice.webp';
import EmbedPDF from '@/assets/images/logo-app/PDF_file_icon.svg.webp'
import { Select } from '@/components/ui/select/Select';
import { Button } from '@/components/ui/button/Button';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { FieldHint } from '@/components/ui/form/FieldHint';
import { WatermarkTraceabilityEditor } from './WatermarkTraceabilityEditor';
import { DocumentConfig, PdfPreviewConfig, OnlyOfficeStorageConfig, OnlyOfficeViewerConfig } from '../types';
import { ConfigTabs, HISTORY_TAB } from './ConfigTabs';
import { ConfigHistory } from './ConfigHistory';
import type { PreviewTabId } from './pageTabs';
import { tr } from "@/i18n";

interface PreviewFileTabProps {
  onlyOfficeConfig: OnlyOfficeStorageConfig;
  onOnlyOfficeChange: (config: OnlyOfficeStorageConfig) => void;
  documentsConfig: DocumentConfig;
  onDocumentsChange: (config: DocumentConfig) => void;
  /** The tab that is open. When the page keeps it (in the address), it is given here with onTabChange; otherwise the tab keeps its own. */
  activeTab?: PreviewTabId;
  onTabChange?: (tab: PreviewTabId) => void;
  /** What was last saved, to mark the tabs that hold a change that is not saved yet. */
  savedOnlyOffice?: OnlyOfficeStorageConfig | null;
  savedDocuments?: DocumentConfig | null;
}

const TABS = [
  { id: 'onlyoffice-preview', get label() { return tr('OnlyOffice Preview'); }, icon: () => <img src={onlyOfficeLogo} alt="" className="h-4 w-4 object-contain" /> },
  { id: 'pdf-preview', get label() { return tr('PDF Preview'); }, icon: () => <img src={EmbedPDF} alt="" className="h-4 w-4 object-contain" /> },
  HISTORY_TAB,
] as const;

/** Community Edition options supported by OnlyOffice Document Server. */
const VIEWER_OPTIONS: Array<{ key: 'showPluginsTab' | 'showRightMenu' | 'showFileName'; label: string; hint: string; defaultValue: boolean }> = [
  { key: 'showPluginsTab', get label() { return tr('Enable plugins'); }, get hint() { return tr('Allow OnlyOffice plugins in the viewer.'); }, defaultValue: false },
  { key: 'showRightMenu', get label() { return tr('Open right menu by default'); }, get hint() { return tr('OnlyOffice may restore a viewer preference saved in that browser.'); }, defaultValue: false },
  { key: 'showFileName', get label() { return tr('Show document name in header'); }, get hint() { return tr('Hiding it uses OnlyOffice compact header layout.'); }, defaultValue: true },
];

export { DEFAULT_WATERMARK_ANGLE, MIN_WATERMARK_ANGLE, MAX_WATERMARK_ANGLE } from './WatermarkTraceabilityEditor';

type StageMode = 'REVIEW' | 'COMMENT_ONLY';
const STAGE_MODE_OPTIONS = [
  { get label() { return tr('Review Mode'); }, value: 'REVIEW' },
  { get label() { return tr('Comment Only'); }, value: 'COMMENT_ONLY' },
];
const STAGE_MODE_HINT: Record<StageMode, string> = {
  REVIEW: 'Review Mode: the person suggests changes. Track changes is on, and they cannot type outside a tracked change.',
  COMMENT_ONLY: 'Comment Only: the person can only add comments. The text cannot be changed.',
};

type PdfToggleOption = { key: keyof PdfPreviewConfig; label: string; hint: string; defaultValue: boolean };

const PDF_TOGGLE_GROUPS: Array<{ title: string; description: string; options: PdfToggleOption[] }> = [
  {
    get title() { return tr('Viewing and Navigation'); },
    get description() { return tr('Controls used to move around and inspect the current PDF.'); },
    options: [
      { key: 'showThumbnailSidebar', get label() { return tr('Thumbnails and outline'); }, get hint() { return tr('Show the side panel for page thumbnails and document outline.'); }, defaultValue: true },
      { key: 'showSearch', get label() { return tr('Find in document'); }, get hint() { return tr('Show the search control for text in the current PDF.'); }, defaultValue: true },
      { key: 'showPageNavigation', get label() { return tr('Previous / next page'); }, get hint() { return tr('Show page navigation controls in the viewer toolbar.'); }, defaultValue: true },
      { key: 'showZoomControls', get label() { return tr('Zoom menu and controls'); }, get hint() { return tr('Show zoom percentage, fit page, fit width, marquee zoom, and zoom buttons.'); }, defaultValue: true },
      { key: 'showFullScreen', get label() { return tr('Full-screen viewer'); }, get hint() { return tr('Allow the viewer to enter browser full-screen mode.'); }, defaultValue: true },
    ],
  },
  {
    get title() { return tr('Document Menu'); },
    get description() { return tr('Commands available from the menu at the top left of the viewer.'); },
    options: [
      { key: 'showOpenDocumentAction', get label() { return tr('Open document'); }, get hint() { return tr('Allow a user to select a local PDF in the Document menu.'); }, defaultValue: true },
      { key: 'showCloseDocumentAction', get label() { return tr('Close document'); }, get hint() { return tr('Show the Close command for the current preview.'); }, defaultValue: true },
      { key: 'showSecurityAction', get label() { return tr('Security information'); }, get hint() { return tr('Show the PDF permission details dialog.'); }, defaultValue: true },
      { key: 'showScreenshotAction', get label() { return tr('Screenshot'); }, get hint() { return tr('Allow temporary screenshot capture; captured content is not saved to EQMS.'); }, defaultValue: true },
    ],
  },
  {
    get title() { return tr('Session Tools'); },
    get description() { return tr('Temporary browser-only tools; none can change the stored PDF.'); },
    options: [
      { key: 'allowAnnotations', get label() { return tr('Allow annotations and comments'); }, get hint() { return tr('Allow temporary highlighting, drawing, and comments. Disabled by default; EQMS never saves these changes to the stored PDF.'); }, defaultValue: false },
      { key: 'showInsertTools', get label() { return tr('Insert tab'); }, get hint() { return tr('Allow temporary stamps, images, and signatures only when annotations are enabled. Exported PDFs may include session marks.'); }, defaultValue: false },
      { key: 'allowTextSelection', get label() { return tr('Select and copy text'); }, get hint() { return tr('Allow text selection and copying only when export and print are permitted.'); }, defaultValue: false },
    ],
  },
];

export const PreviewFileTab: React.FC<PreviewFileTabProps> = ({
  onlyOfficeConfig,
  onOnlyOfficeChange,
  documentsConfig,
  onDocumentsChange,
  activeTab: activeTabProp,
  onTabChange,
  savedOnlyOffice,
  savedDocuments,
}) => {
  const [ownTab, setOwnTab] = React.useState<PreviewTabId>('onlyoffice-preview');
  const activeTab = activeTabProp ?? ownTab;
  const selectTab = (tab: PreviewTabId) => { setOwnTab(tab); onTabChange?.(tab); };
  const changed = React.useMemo(() => {
    const set = new Set<PreviewTabId>();
    if (savedOnlyOffice) {
      if (JSON.stringify(onlyOfficeConfig.viewer ?? null) !== JSON.stringify(savedOnlyOffice.viewer ?? null)) set.add('onlyoffice-preview');
    }
    if (savedDocuments) {
      const d = documentsConfig as unknown as Record<string, unknown>;
      const v = savedDocuments as unknown as Record<string, unknown>;
      if (['enableWatermark', 'allowDownload', 'pdfPreview'].some((key) => JSON.stringify(d[key] ?? null) !== JSON.stringify(v[key] ?? null))) set.add('pdf-preview');
    }
    return set;
  }, [onlyOfficeConfig.viewer, savedOnlyOffice, documentsConfig, savedDocuments]);
  const setViewer = (patch: Partial<OnlyOfficeViewerConfig>) =>
    onOnlyOfficeChange({ ...onlyOfficeConfig, viewer: { ...(onlyOfficeConfig.viewer ?? {}), ...patch } });
  const setPdf = (patch: PdfPreviewConfig) =>
    onDocumentsChange({ ...documentsConfig, pdfPreview: { ...(documentsConfig.pdfPreview ?? {}), ...patch } });
  return (
  <ConfigTabs
    tabs={TABS}
    activeTab={activeTab}
    onChange={selectTab}
    changed={changed}
    onReset={(tab) => {
      if (tab === 'onlyoffice-preview' && savedOnlyOffice) {
        const { viewer, ...rest } = onlyOfficeConfig as OnlyOfficeStorageConfig & { viewer?: OnlyOfficeViewerConfig };
        onOnlyOfficeChange({ ...rest, ...(savedOnlyOffice.viewer === undefined ? {} : { viewer: JSON.parse(JSON.stringify(savedOnlyOffice.viewer)) }) } as OnlyOfficeStorageConfig);
        void viewer;
      } else if (tab === 'pdf-preview' && savedDocuments) {
        const next = { ...documentsConfig } as unknown as Record<string, unknown>;
        const saved = savedDocuments as unknown as Record<string, unknown>;
        ['enableWatermark', 'allowDownload', 'pdfPreview'].forEach((key) => { if (key in saved) next[key] = JSON.parse(JSON.stringify(saved[key])); else delete next[key]; });
        onDocumentsChange(next as unknown as DocumentConfig);
      }
    }}
    ariaLabel={__ariaTr("Preview file sections")}
    idPrefix="preview-file"
  >
    {activeTab === 'onlyoffice-preview' && (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{tr("Viewer")}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{tr("What the read-only OnlyOffice viewer shows around the document.")}</p>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {VIEWER_OPTIONS.map((option) => (
            <div key={option.key}>
              <Checkbox
                id={`onlyoffice-viewer-${option.key}`}
                        label={tr(option.label)}
                checked={onlyOfficeConfig.viewer?.[option.key] ?? option.defaultValue}
                onChange={(checked) =>
                  onOnlyOfficeChange({
                    ...onlyOfficeConfig,
                    viewer: { ...(onlyOfficeConfig.viewer ?? {}), [option.key]: checked },
                  })
                }
              />
                      <p className="ml-7 text-xs text-slate-500">{tr(option.hint)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-sm font-semibold text-slate-900">{tr("Review and Approval Stages")}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{tr("How the assigned person opens the Word file in OnlyOffice. Drafts are edited by the author; every other stage is read-only.")}</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Select
              label={tr("Pending Review")}
              value={onlyOfficeConfig.viewer?.pendingReviewMode ?? 'REVIEW'}
              enableSearch={false}
              onChange={(value) => setViewer({ pendingReviewMode: value as StageMode })}
              options={STAGE_MODE_OPTIONS}
            />
            <p className="mt-1.5 text-xs text-slate-500">{STAGE_MODE_HINT[onlyOfficeConfig.viewer?.pendingReviewMode ?? 'REVIEW']}</p>
          </div>
          <div>
            <Select
              label={tr("Pending Approval")}
              value={onlyOfficeConfig.viewer?.pendingApprovalMode ?? 'COMMENT_ONLY'}
              enableSearch={false}
              onChange={(value) => setViewer({ pendingApprovalMode: value as StageMode })}
              options={STAGE_MODE_OPTIONS}
            />
            <p className="mt-1.5 text-xs text-slate-500">{STAGE_MODE_HINT[onlyOfficeConfig.viewer?.pendingApprovalMode ?? 'COMMENT_ONLY']}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-sm font-semibold text-slate-900">{tr("Copies out of the editor")}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{tr("For a person who edits, reviews or comments on a Word file in OnlyOffice. The read-only viewer never allows download or print.")}</p>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <Checkbox id="onlyoffice-editor-download" label={tr("Allow download")} checked={onlyOfficeConfig.viewer?.editorAllowDownload ?? true} onChange={(checked) => setViewer({ editorAllowDownload: checked })} />
            <p className="ml-7 text-xs text-slate-500">{tr("Off hides the Download button and the Download As entries of the File menu.")}</p>
          </div>
          <div>
            <Checkbox id="onlyoffice-editor-print" label={tr("Allow print")} checked={onlyOfficeConfig.viewer?.editorAllowPrint ?? true} onChange={(checked) => setViewer({ editorAllowPrint: checked })} />
            <p className="ml-7 text-xs text-slate-500">{tr("Off hides the Print button and menu entry, and Ctrl+P does nothing.")}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <WatermarkTraceabilityEditor
          idPrefix="onlyoffice-viewer-watermark"
          enabled={!!onlyOfficeConfig.viewer?.watermarkEnabled}
          onEnabledChange={(checked) => setViewer({ watermarkEnabled: checked })}
          fields={onlyOfficeConfig.viewer}
          onChange={setViewer}
          description={tr("Drawn by OnlyOffice on every page while a Word file is shown in View Mode (the Document tab and the training files).")}
          textHint={tr("Made by the server each time the file is opened, from the signed-in user and the server clock. The stored file is never modified, and the editors do not save it.")}
          sampleNote="Example values. The viewer is filled in when the file is opened."
        />
      </div>
    </div>
    )}

    {activeTab === 'pdf-preview' && (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WatermarkTraceabilityEditor
          idPrefix="pdf-preview-watermark"
          enabled={!!documentsConfig.enableWatermark}
          onEnabledChange={(checked) => onDocumentsChange({ ...documentsConfig, enableWatermark: checked })}
          fields={documentsConfig.pdfPreview}
          onChange={setPdf}
          description={tr("Information rendered only into the generated preview response.")}
          textHint={tr("Shown as an overlay on every page of the preview only. The stored PDF is never modified.")}
          sampleNote="Example values. The viewer is filled in at preview time."
        />

        <section className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-800">{tr("Access and Output")}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{tr("Controls that determine whether a viewer may take content outside the preview.")}</p>
          </div>
          <Checkbox
            id="pdf-preview-allow-download"
            label={tr("Allow download and print")}
            checked={!!documentsConfig.allowDownload}
            onChange={(checked) => onDocumentsChange({ ...documentsConfig, allowDownload: checked })}
          />
          <FieldHint indent className="mt-0.5">{tr("When off, the PDF viewer hides export and print.")}</FieldHint>
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <div className="mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{tr("Viewing and Navigation")}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{tr("Default view and toolbar controls for reading a PDF.")}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {PDF_TOGGLE_GROUPS[0].options.map((option) => (
              <div key={option.key}>
                <Checkbox id={`pdf-preview-${option.key}`} label={option.label} checked={(documentsConfig.pdfPreview?.[option.key] as boolean | undefined) ?? option.defaultValue} onChange={(checked) => setPdf({ [option.key]: checked })} />
                      <p className="ml-7 text-xs text-slate-500">{tr(option.hint)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <Select label={tr("Initial zoom")} value={documentsConfig.pdfPreview?.defaultZoom ?? 'page-fit'} onChange={(value) => setPdf({ defaultZoom: value as PdfPreviewConfig['defaultZoom'] })} enableSearch={false} options={[{ label: 'Fit page', value: 'page-fit' }, { label: 'Fit width', value: 'page-width' }, { label: tr('Actual size (100%)'), value: 'actual-size' }]} />
          </div>
        </section>

        {PDF_TOGGLE_GROUPS.slice(1).map((group) => (
          <section key={group.title} className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800">{tr(group.title)}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{tr(group.description)}</p>
            <div className="mt-4 space-y-3">
              {group.options.map((option) => (
                <div key={option.key}>
                  <Checkbox id={`pdf-preview-${option.key}`} label={option.label} checked={(documentsConfig.pdfPreview?.[option.key] as boolean | undefined) ?? option.defaultValue} onChange={(checked) => setPdf({ [option.key]: checked })} />
                      <p className="ml-7 text-xs text-slate-500">{tr(option.hint)}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
        </div>
      </div>
    )}

    {activeTab === 'history' && <ConfigHistory page="preview-file" />}
  </ConfigTabs>
  );
};
