import React from 'react';
import { FileText } from 'lucide-react';
import onlyOfficeLogo from '@/assets/images/logo-app/onlyoffice.webp';
import EmbedPDF from '@/assets/images/logo-app/PDF_file_icon.svg.webp'
import { FormSection } from '@/components/ui/form/FormSection';
import { Select } from '@/components/ui/select/Select';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { ColorPickerInput } from '@/components/ui/color-picker/ColorPickerInput';
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
  const setPdf = (patch: PdfPreviewConfig) =>
    onDocumentsChange({ ...documentsConfig, pdfPreview: { ...(documentsConfig.pdfPreview ?? {}), ...patch } });
  return (
  <div className="p-4 md:p-5 space-y-4">
    <FormSection
      title="OnlyOffice Preview"
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
      title="PDF Preview"
      icon={<img src={EmbedPDF} alt="EmbedPDF" className="h-4 w-4 object-contain" />}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          The PDF viewer always uses light mode. The stored PDF is read-only. Annotations and Insert tools
          are available only when enabled below; form filling, content editing, and redaction remain disabled.
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
          {documentsConfig.enableWatermark && (() => {
            const pdf = documentsConfig.pdfPreview;
            const text = (pdf?.watermarkText ?? 'FOR PREVIEW ONLY').trim() || 'FOR PREVIEW ONLY';
            const colour = pdf?.watermarkColor ?? '#B3B3F5';
            const strength = pdf?.watermarkStrength ?? 'standard';
            const tiled = pdf?.watermarkTiled ?? false;
            // The viewer line: code and name together, as the server prints them.
            const viewer = [pdf?.watermarkShowEmployeeCode ? 'NTP.0005' : null, pdf?.watermarkShowViewerName ? 'Nguyen The Hoang' : null]
              .filter(Boolean).join(' - ') || null;
            const sample = [
              text,
              viewer,
              pdf?.watermarkShowOpenedAt ? '16/10/2026 10:00:00' : null,
            ].filter((line): line is string => !!line);
            // The same opacity the server uses for each strength, so the sample is as faint or as strong as the real preview.
            const alpha = strength === 'light' ? 0.10 : strength === 'strong' ? 0.30 : 0.18;
            const mark = (
              <div className="flex -rotate-45 flex-col items-center gap-1 whitespace-nowrap text-center font-bold" style={{ color: colour, opacity: alpha }}>
                {sample.map((line, index) => (
                  <span key={index} className={index === 0 ? 'text-2xl' : 'text-sm font-semibold'}>{line}</span>
                ))}
              </div>
            );
            return (
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Watermark text</label>
                    <input
                      value={pdf?.watermarkText ?? 'FOR PREVIEW ONLY'}
                      onChange={(event) => setPdf({ watermarkText: event.target.value.slice(0, 120) })}
                      maxLength={120}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-500"
                      placeholder="FOR PREVIEW ONLY"
                    />
                    <p className="mt-1 text-xs text-slate-500">Shown as an overlay on every page of the preview only. The stored PDF is never modified.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Select
                        label="Strength"
                        value={strength}
                        onChange={(value) => setPdf({ watermarkStrength: value as 'light' | 'standard' | 'strong' })}
                        enableSearch={false}
                        options={[
                          { label: 'Light', value: 'light' },
                          { label: 'Standard', value: 'standard' },
                          { label: 'Strong', value: 'strong' },
                        ]}
                      />
                      <p className="mt-1 text-xs text-slate-500">Strong is harder to read through, and harder to photograph cleanly.</p>
                    </div>
                    <div>
                      <p className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Colour</p>
                      <ColorPickerInput value={colour} onChange={(value) => setPdf({ watermarkColor: value })} />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">Shown on each page of the preview</p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <Checkbox id="pdf-preview-watermark-employee" label="Viewer employee code" checked={pdf?.watermarkShowEmployeeCode ?? false} onChange={(checked) => setPdf({ watermarkShowEmployeeCode: checked })} />
                      <Checkbox id="pdf-preview-watermark-viewer" label="Viewer name" checked={pdf?.watermarkShowViewerName ?? false} onChange={(checked) => setPdf({ watermarkShowViewerName: checked })} />
                      <Checkbox id="pdf-preview-watermark-opened-at" label="Time the preview was opened" checked={pdf?.watermarkShowOpenedAt ?? false} onChange={(checked) => setPdf({ watermarkShowOpenedAt: checked })} />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">When both code and name are on, they show on one line: code - name.</p>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">Layout</p>
                    <Checkbox id="pdf-preview-watermark-tiled" label="Repeat the watermark as a grid" checked={tiled} onChange={(checked) => setPdf({ watermarkTiled: checked })} />
                    <p className="ml-7 mt-0.5 text-xs text-slate-500">Off shows one large mark in the centre. On repeats it covers the page so a photograph cannot avoid it.</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">Sample</p>
                  <div className="relative grid h-[260px] place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
                    {tiled ? (
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        {/* The same lattice as the server: copies on rows that run along the text, scaled to the box. */}
                        {[-2, -1, 0, 1, 2].flatMap((i) => [-2, -1, 0, 1, 2].map((j) => {
                          const k = 0.7071 * 0.67;
                          const x = i * 420 * k + j * 240 * k * -1;
                          const y = i * 420 * k * -1 + j * 240 * k * -1;
                          return (
                            <div key={`${i}-${j}`} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}>
                              {mark}
                            </div>
                          );
                        }))}
                      </div>
                    ) : (
                      <div className="pointer-events-none">{mark}</div>
                    )}
                    <p className="absolute bottom-2 left-0 right-0 text-center text-2xs text-slate-400">Example values. The viewer is filled in at preview time.</p>
                  </div>
                </div>
              </div>
            );
          })()}
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
