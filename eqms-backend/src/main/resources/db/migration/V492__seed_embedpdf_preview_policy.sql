-- Persist the EmbedPDF read-only preview defaults in the existing configuration JSONB.
-- Existing administrator-selected values win; this migration supplies only missing values.
UPDATE system_configurations
SET documents_config = jsonb_set(
    documents_config,
    '{pdfPreview}',
    jsonb_build_object(
        'defaultZoom', 'page-fit',
        'showThumbnailSidebar', true,
        'showSearch', true,
        'showPageNavigation', true,
        'showZoomControls', true,
        'showFullScreen', true,
        'allowTextSelection', false,
        'watermarkText', 'FOR PREVIEW ONLY',
        'watermarkShowViewerName', false,
        'watermarkShowOpenedAt', false
    ) || CASE
        WHEN jsonb_typeof(documents_config -> 'pdfPreview') = 'object'
            THEN documents_config -> 'pdfPreview'
        ELSE '{}'::jsonb
    END,
    true
)
WHERE documents_config IS NOT NULL;
