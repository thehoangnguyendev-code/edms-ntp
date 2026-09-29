-- Remove controls from the previous PDF.js viewer. EmbedPDF preview is read-only
-- and does not expose pan, rotate, or a viewer theme switch.
UPDATE system_configurations
SET documents_config = jsonb_set(
    documents_config,
    '{pdfPreview}',
    (documents_config -> 'pdfPreview')
        - 'showPanTool'
        - 'showRotateControls'
        - 'showThemeSwitch',
    true
)
WHERE jsonb_typeof(documents_config -> 'pdfPreview') = 'object'
  AND (documents_config -> 'pdfPreview') ?| ARRAY[
      'showPanTool',
      'showRotateControls',
      'showThemeSwitch'
  ];
