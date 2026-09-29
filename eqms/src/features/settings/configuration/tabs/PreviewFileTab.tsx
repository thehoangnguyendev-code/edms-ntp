import React from 'react';
import { FileText } from 'lucide-react';
import onlyOfficeLogo from '@/assets/images/logo-app/onlyoffice.webp';
import EmbedPDF from '@/assets/images/logo-app/PDF_file_icon.svg.webp'
import { FormSection } from '@/components/ui/form/FormSection';
import { Select } from '@/components/ui/select/Select';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { DocumentConfig, PdfPreviewConfig, OnlyOfficeStorageConfig, OnlyOfficeViewerConfig } from '../types';
import { IconFileTypePdf } from '@tabler/icons-react';

interface PreviewFileTabProps {
  onlyOfficeConfig: OnlyOfficeStorageConfig;
  onOnlyOfficeChange: (config: OnlyOfficeStorageConfig) => void;
  documentsConfig: DocumentConfig;
  onDocumentsChange: (config: DocumentConfig) => void;
}

/** Community Edition options supported by OnlyOffice Document Server. */
const VIEWER_OPTIONS: Array<{ key: keyof OnlyOfficeViewerConfig; label: string; hint: string; defaultValue: boolean }> = [
  { key: 'showPluginsTab', label: 'Enable plugins', hint: 'Allow OnlyOffice plugins in the viewer.', defaultValue: false },
  { key: 'showRightMenu', label: 'Open right menu by default', hint: 'OnlyOffice may restore a viewer preference saved in that browser.', defaultValue: false },
  { key: 'showFileName', label: 'Show document name in header', hint: 'Hiding it uses OnlyOffice compact header layout.', defaultValue: true },
];

type PdfToggleOption = { key: keyof PdfPreviewConfig; label: string; hint: string; defaultValue: boolean };

const PDF_TOGGLE_GROUPS: Array<{ title: string; description: string; options: PdfToggleOption[] }> = [
  {
    title: 'Viewing and navigation',
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
    title: 'Document menu',
    description: 'Commands available from the menu at the top left of the viewer.',
    options: [
      { key: 'showOpenDocumentAction', label: 'Open document', hint: 'Allow a user to select a local PDF in the Document menu.', defaultValue: true },
      { key: 'showCloseDocumentAction', label: 'Close document', hint: 'Show the Close command for the current preview.', defaultValue: true },
      { key: 'showSecurityAction', label: 'Security information', hint: 'Show the PDF permission details dialog.', defaultValue: true },
      { key: 'showScreenshotAction', label: 'Screenshot', hint: 'Allow temporary screenshot capture; captured content is not saved to EQMS.', defaultValue: true },
    ],
  },
  {
    title: 'Session tools',
    description: 'Temporary browser-only tools; none can change the stored PDF.',
    options: [
      { key: 'showInsertTools', label: 'Insert tab', hint: 'Allow temporary stamps, images, and signatures in this browser session.', defaultValue: false },
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
  const setPdf = (patch: PdfPreviewConfig) =>
    onDocumentsChange({ ...documentsConfig, pdfPreview: { ...(documentsConfig.pdfPreview ?? {}), ...patch } });
  return (
  <div className="p-4 md:p-5 space-y-4">
    <FormSection
      title="OnlyOffice preview"
      icon={<img src={onlyOfficeLogo} alt="OnlyOffice" className="h-4 w-4 object-contain" />}
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
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
    </FormSection>

    <FormSection
      title="PDF preview"
      icon={<img src={EmbedPDF} alt="EmbedPDF" className="h-4 w-4 object-contain" />}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          The PDF viewer always uses light mode. Preview is read-only: editing, annotations, form filling,
          stamps, redaction, and signatures are unavailable.
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 xl:col-span-2">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Watermark and traceability</h3>
            <p className="mt-0.5 text-xs text-slate-500">Information rendered only into the generated preview response.</p>
          </div>
          <Checkbox
            id="pdf-preview-watermark"
            label="Enable watermarking"
            checked={!!documentsConfig.enableWatermark}
            onChange={(checked) => onDocumentsChange({ ...documentsConfig, enableWatermark: checked })}
          />
          {documentsConfig.enableWatermark && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Watermark text</label>
                <input
                  value={documentsConfig.pdfPreview?.watermarkText ?? 'FOR PREVIEW ONLY'}
                  onChange={(event) => setPdf({ watermarkText: event.target.value.slice(0, 120) })}
                  maxLength={120}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-500"
                  placeholder="FOR PREVIEW ONLY"
                />
                <p className="mt-1 text-xs text-slate-500">The stored PDF is never modified.</p>
              </div>
              <Checkbox id="pdf-preview-watermark-viewer" label="Show viewer name" checked={documentsConfig.pdfPreview?.watermarkShowViewerName ?? false} onChange={(checked) => setPdf({ watermarkShowViewerName: checked })} />
              <Checkbox id="pdf-preview-watermark-opened-at" label="Show preview opened time" checked={documentsConfig.pdfPreview?.watermarkShowOpenedAt ?? false} onChange={(checked) => setPdf({ watermarkShowOpenedAt: checked })} />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Access and output</h3>
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
              <h3 className="text-sm font-semibold text-slate-800">Viewing and navigation</h3>
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
