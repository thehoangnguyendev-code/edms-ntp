import React from 'react';
import { FileText } from 'lucide-react';
import onlyOfficeLogo from '@/assets/images/logo-app/onlyoffice.webp';
import EmbedPDF from '@/assets/images/logo-app/PDF_file_icon.svg.webp'
import { FormSection } from '@/components/ui/form/FormSection';
import { Select } from '@/components/ui/select/Select';
import { Button } from '@/components/ui/button/Button';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { WatermarkTraceabilityEditor } from './WatermarkTraceabilityEditor';
import { DocumentConfig, PdfPreviewConfig, OnlyOfficeStorageConfig, OnlyOfficeViewerConfig } from '../types';
import { IconFileTypePdf } from '@tabler/icons-react';

interface PreviewFileTabProps {
  onlyOfficeConfig: OnlyOfficeStorageConfig;
  onOnlyOfficeChange: (config: OnlyOfficeStorageConfig) => void;
  documentsConfig: DocumentConfig;
  onDocumentsChange: (config: DocumentConfig) => void;
}

/** Community Edition options supported by OnlyOffice Document Server. */
const VIEWER_OPTIONS: Array<{ key: 'showPluginsTab' | 'showRightMenu' | 'showFileName'; label: string; hint: string; defaultValue: boolean }> = [
  { key: 'showPluginsTab', label: 'Enable plugins', hint: 'Allow OnlyOffice plugins in the viewer.', defaultValue: false },
  { key: 'showRightMenu', label: 'Open right menu by default', hint: 'OnlyOffice may restore a viewer preference saved in that browser.', defaultValue: false },
  { key: 'showFileName', label: 'Show document name in header', hint: 'Hiding it uses OnlyOffice compact header layout.', defaultValue: true },
];

export { DEFAULT_WATERMARK_ANGLE, MIN_WATERMARK_ANGLE, MAX_WATERMARK_ANGLE } from './WatermarkTraceabilityEditor';

type StageMode = 'REVIEW' | 'COMMENT_ONLY';
const STAGE_MODE_OPTIONS = [
  { label: 'Review Mode', value: 'REVIEW' },
  { label: 'Comment Only', value: 'COMMENT_ONLY' },
];
const STAGE_MODE_HINT: Record<StageMode, string> = {
  REVIEW: 'Review Mode: the person suggests changes. Track changes is on, and they cannot type outside a tracked change.',
  COMMENT_ONLY: 'Comment Only: the person can only add comments. The text cannot be changed.',
};

type PdfToggleOption = { key: keyof PdfPreviewConfig; label: string; hint: string; defaultValue: boolean };

const PDF_TOGGLE_GROUPS: Array<{ title: string; description: string; options: PdfToggleOption[] }> = [
  {
    title: 'Viewing and Navigation',
    description: 'Controls used to move around and inspect the current PDF.',
    options: [
      { key: 'showThumbnailSidebar', label: 'Thumbnails and outline', hint: 'Show the side panel for page thumbnails and document outline.', defaultValue: true },
      { key: 'showSearch', label: 'Find in document', hint: 'Show the search control for text in the current PDF.', defaultValue: true },
      { key: 'showPageNavigation', label: 'Previous / next page', hint: 'Show page navigation controls in the viewer toolbar.', defaultValue: true },
      { key: 'showZoomControls', label: 'Zoom menu and controls', hint: 'Show zoom percentage, fit page, fit width, marquee zoom, and zoom buttons.', defaultValue: true },
      { key: 'showFullScreen', label: 'Full-screen viewer', hint: 'Allow the viewer to enter browser full-screen mode.', defaultValue: true },
    ],
  },
  {
    title: 'Document Menu',
    description: 'Commands available from the menu at the top left of the viewer.',
    options: [
      { key: 'showOpenDocumentAction', label: 'Open document', hint: 'Allow a user to select a local PDF in the Document menu.', defaultValue: true },
      { key: 'showCloseDocumentAction', label: 'Close document', hint: 'Show the Close command for the current preview.', defaultValue: true },
      { key: 'showSecurityAction', label: 'Security information', hint: 'Show the PDF permission details dialog.', defaultValue: true },
      { key: 'showScreenshotAction', label: 'Screenshot', hint: 'Allow temporary screenshot capture; captured content is not saved to EQMS.', defaultValue: true },
    ],
  },
  {
    title: 'Session Tools',
    description: 'Temporary browser-only tools; none can change the stored PDF.',
    options: [
      { key: 'allowAnnotations', label: 'Allow annotations and comments', hint: 'Allow temporary highlighting, drawing, and comments. Disabled by default; EQMS never saves these changes to the stored PDF.', defaultValue: false },
      { key: 'showInsertTools', label: 'Insert tab', hint: 'Allow temporary stamps, images, and signatures only when annotations are enabled. Exported PDFs may include session marks.', defaultValue: false },
      { key: 'allowTextSelection', label: 'Select and copy text', hint: 'Allow text selection and copying only when export and print are permitted.', defaultValue: false },
    ],
  },
];

export const PreviewFileTab: React.FC<PreviewFileTabProps> = ({
  onlyOfficeConfig,
  onOnlyOfficeChange,
  documentsConfig,
  onDocumentsChange,
}) => {
  const setViewer = (patch: Partial<OnlyOfficeViewerConfig>) =>
    onOnlyOfficeChange({ ...onlyOfficeConfig, viewer: { ...(onlyOfficeConfig.viewer ?? {}), ...patch } });
  const setPdf = (patch: PdfPreviewConfig) =>
    onDocumentsChange({ ...documentsConfig, pdfPreview: { ...(documentsConfig.pdfPreview ?? {}), ...patch } });
  return (
  <div className="p-4 md:p-5 space-y-4">
    <FormSection
      title="OnlyOffice Preview"
      icon={<img src={onlyOfficeLogo} alt="OnlyOffice" className="h-4 w-4 object-contain" />}
    >
      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Viewer</h3>
        <p className="mt-0.5 text-xs text-slate-500">What the read-only OnlyOffice viewer shows around the document.</p>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {VIEWER_OPTIONS.map((option) => (
            <div key={option.key}>
              <Checkbox
                id={`onlyoffice-viewer-${option.key}`}
                label={option.label}
                checked={onlyOfficeConfig.viewer?.[option.key] ?? option.defaultValue}
                onChange={(checked) =>
                  onOnlyOfficeChange({
                    ...onlyOfficeConfig,
                    viewer: { ...(onlyOfficeConfig.viewer ?? {}), [option.key]: checked },
                  })
                }
              />
              <p className="ml-7 text-xs text-slate-500">{option.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Review and Approval Stages</h3>
        <p className="mt-0.5 text-xs text-slate-500">How the assigned person opens the Word file in OnlyOffice. Drafts are edited by the author; every other stage is read-only.</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Select
              label="Pending Review"
              value={onlyOfficeConfig.viewer?.pendingReviewMode ?? 'REVIEW'}
              enableSearch={false}
              onChange={(value) => setViewer({ pendingReviewMode: value as StageMode })}
              options={STAGE_MODE_OPTIONS}
            />
            <p className="mt-1 text-xs text-slate-500">{STAGE_MODE_HINT[onlyOfficeConfig.viewer?.pendingReviewMode ?? 'REVIEW']}</p>
          </div>
          <div>
            <Select
              label="Pending Approval"
              value={onlyOfficeConfig.viewer?.pendingApprovalMode ?? 'COMMENT_ONLY'}
              enableSearch={false}
              onChange={(value) => setViewer({ pendingApprovalMode: value as StageMode })}
              options={STAGE_MODE_OPTIONS}
            />
            <p className="mt-1 text-xs text-slate-500">{STAGE_MODE_HINT[onlyOfficeConfig.viewer?.pendingApprovalMode ?? 'COMMENT_ONLY']}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Copies out of the editor</h3>
        <p className="mt-0.5 text-xs text-slate-500">For a person who edits, reviews or comments on a Word file in OnlyOffice. The read-only viewer never allows download or print.</p>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <Checkbox id="onlyoffice-editor-download" label="Allow download" checked={onlyOfficeConfig.viewer?.editorAllowDownload ?? true} onChange={(checked) => setViewer({ editorAllowDownload: checked })} />
            <p className="ml-7 text-xs text-slate-500">Off hides the Download button and the Download As entries of the File menu.</p>
          </div>
          <div>
            <Checkbox id="onlyoffice-editor-print" label="Allow print" checked={onlyOfficeConfig.viewer?.editorAllowPrint ?? true} onChange={(checked) => setViewer({ editorAllowPrint: checked })} />
            <p className="ml-7 text-xs text-slate-500">Off hides the Print button and menu entry, and Ctrl+P does nothing.</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">This stops the buttons and the shortcut, not a photograph or a screenshot of the screen: keep the watermark for that. Applies to files opened after it is saved.</p>
      </div>

      <div className="mt-5">
        <WatermarkTraceabilityEditor
          idPrefix="onlyoffice-viewer-watermark"
          enabled={!!onlyOfficeConfig.viewer?.watermarkEnabled}
          onEnabledChange={(checked) => setViewer({ watermarkEnabled: checked })}
          fields={onlyOfficeConfig.viewer}
          onChange={setViewer}
          description="Drawn by OnlyOffice on every page while a Word file is shown in View Mode (the Document tab and the training files)."
          textHint="Made by the server each time the file is opened, from the signed-in user and the server clock. The stored file is never modified, and the editors do not save it."
          sampleNote="Example values. The viewer is filled in when the file is opened."
        />
      </div>
    </FormSection>

    <FormSection
      title="PDF Preview"
      icon={<img src={EmbedPDF} alt="EmbedPDF" className="h-4 w-4 object-contain" />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WatermarkTraceabilityEditor
          idPrefix="pdf-preview-watermark"
          enabled={!!documentsConfig.enableWatermark}
          onEnabledChange={(checked) => onDocumentsChange({ ...documentsConfig, enableWatermark: checked })}
          fields={documentsConfig.pdfPreview}
          onChange={setPdf}
          description="Information rendered only into the generated preview response."
          textHint="Shown as an overlay on every page of the preview only. The stored PDF is never modified."
          sampleNote="Example values. The viewer is filled in at preview time."
        />

        <section className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Access and Output</h3>
            <p className="mt-0.5 text-xs text-slate-500">Controls that determine whether a viewer may take content outside the preview.</p>
          </div>
          <Checkbox
            id="pdf-preview-allow-download"
            label="Allow download and print"
            checked={!!documentsConfig.allowDownload}
            onChange={(checked) => onDocumentsChange({ ...documentsConfig, allowDownload: checked })}
          />
          <p className="ml-7 mt-0.5 text-xs text-slate-500">When disabled, EmbedPDF hides export and print actions.</p>
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <div className="mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Viewing and Navigation</h3>
              <p className="mt-0.5 text-xs text-slate-500">Default view and toolbar controls for reading a PDF.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {PDF_TOGGLE_GROUPS[0].options.map((option) => (
              <div key={option.key}>
                <Checkbox id={`pdf-preview-${option.key}`} label={option.label} checked={(documentsConfig.pdfPreview?.[option.key] as boolean | undefined) ?? option.defaultValue} onChange={(checked) => setPdf({ [option.key]: checked })} />
                <p className="ml-7 text-xs text-slate-500">{option.hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4 sm:w-56">
            <Select label="Initial zoom" value={documentsConfig.pdfPreview?.defaultZoom ?? 'page-fit'} onChange={(value) => setPdf({ defaultZoom: value as PdfPreviewConfig['defaultZoom'] })} enableSearch={false} options={[{ label: 'Fit page', value: 'page-fit' }, { label: 'Fit width', value: 'page-width' }, { label: 'Actual size (100%)', value: 'actual-size' }]} />
          </div>
        </section>

        {PDF_TOGGLE_GROUPS.slice(1).map((group) => (
          <section key={group.title} className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800">{group.title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{group.description}</p>
            <div className="mt-4 space-y-3">
              {group.options.map((option) => (
                <div key={option.key}>
                  <Checkbox id={`pdf-preview-${option.key}`} label={option.label} checked={(documentsConfig.pdfPreview?.[option.key] as boolean | undefined) ?? option.defaultValue} onChange={(checked) => setPdf({ [option.key]: checked })} />
                  <p className="ml-7 text-xs text-slate-500">{option.hint}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
        </div>
      </div>
    </FormSection>
  </div>  );
};
