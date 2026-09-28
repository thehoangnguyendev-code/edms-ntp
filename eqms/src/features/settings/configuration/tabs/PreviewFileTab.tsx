import React from 'react';
import { FileText } from 'lucide-react';
import onlyOfficeLogo from '@/assets/images/logo-app/onlyoffice.webp';
import pdfView from '@/assets/images/logo-app/PDF_file_icon.svg.webp'
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

/** Same defaults the backend applies when nothing is saved (OnlyOfficeConfigurationService#getViewerOptions). */
const VIEWER_OPTIONS: Array<{ key: keyof OnlyOfficeViewerConfig; label: string; hint: string; defaultValue: boolean }> = [
  { key: 'showFileTab', label: 'File tab', hint: 'File menu (info, download, print options).', defaultValue: false },
  { key: 'showViewTab', label: 'View tab', hint: 'Zoom, fit to page / width, interface theme, dark document.', defaultValue: true },
  { key: 'showPluginsTab', label: 'Plugins tab', hint: 'OnlyOffice plugins.', defaultValue: false },
  { key: 'showLeftPanel', label: 'Left panel', hint: 'Search and headings navigation panel.', defaultValue: false },
  { key: 'showRightMenu', label: 'Right menu', hint: 'Text / table / shape settings side bar.', defaultValue: false },
  { key: 'showStatusBar', label: 'Status bar', hint: 'Page count and zoom at the bottom.', defaultValue: true },
  { key: 'showFileName', label: 'Document name in the header', hint: 'File name shown in the top bar.', defaultValue: true },
];

const PDF_TOGGLES: Array<{ key: keyof PdfPreviewConfig; label: string; hint: string; defaultValue: boolean }> = [
  { key: 'showThumbnailSidebar', label: 'Thumbnail / bookmark sidebar', hint: 'Side panel with page thumbnails and bookmarks.', defaultValue: true },
  { key: 'showSearch', label: 'Search', hint: 'Search-in-document button.', defaultValue: true },
  { key: 'showPageNavigation', label: 'Page navigation', hint: 'Previous / next page and page number input.', defaultValue: true },
  { key: 'showZoomControls', label: 'Zoom controls', hint: 'Zoom in / out and zoom level selector.', defaultValue: true },
  { key: 'showFullScreen', label: 'Full screen', hint: 'Full screen button.', defaultValue: true },
  { key: 'showThemeSwitch', label: 'Theme switch', hint: 'Light / dark viewer theme button.', defaultValue: true },
  { key: 'allowTextSelection', label: 'Allow text selection', hint: 'Let users select text. Only effective when Download or Print is allowed.', defaultValue: false },
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
      icon={<IconFileTypePdf className="h-4 w-4" />}
    >
      <div className="space-y-4">
        <div>
          <Checkbox
            id="pdf-preview-watermark"
            label="Enable Watermarking"
            checked={!!documentsConfig.enableWatermark}
            onChange={(checked) => onDocumentsChange({ ...documentsConfig, enableWatermark: checked })}
          />
          <p className="ml-7 text-xs text-slate-500">Apply "For Preview Only" watermark to server-side document previews.</p>
        </div>
        <div>
          <Checkbox
            id="pdf-preview-allow-download"
            label="Allow Document Download or Print"
            checked={!!documentsConfig.allowDownload}
            onChange={(checked) => onDocumentsChange({ ...documentsConfig, allowDownload: checked })}
          />
          <p className="ml-7 text-xs text-slate-500">If disabled, documents can only be viewed within the system viewer.</p>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Default zoom</label>
          <Select
            value={documentsConfig.pdfPreview?.defaultZoom ?? 'actual-size'}
            onChange={(value) => setPdf({ defaultZoom: value as PdfPreviewConfig['defaultZoom'] })}
            enableSearch={false}
            className="w-full sm:w-64"
            options={[
              { label: 'Actual size (100%)', value: 'actual-size' },
              { label: 'Fit page', value: 'page-fit' },
              { label: 'Fit width', value: 'page-width' },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 border-t border-slate-100 pt-4">
          {PDF_TOGGLES.map((option) => (
            <div key={option.key}>
              <Checkbox
                id={`pdf-preview-${option.key}`}
                label={option.label}
                checked={(documentsConfig.pdfPreview?.[option.key] as boolean | undefined) ?? option.defaultValue}
                onChange={(checked) => setPdf({ [option.key]: checked })}
              />
              <p className="ml-7 text-xs text-slate-500">{option.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </FormSection>
  </div>  );
};
